import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon, { SolarIcons } from '../ui/Icon';
import Button from '../ui/Button';
import { useAuthStore } from '../../stores/authStore';
import { canEditPracticeSettings } from './practiceSettingsAccess';
import {
  disconnectMeta,
  loadMetaConnections,
  loadMetaSetup,
  metaReturnMessage,
  startMetaConnect,
  type MetaConnection,
  type MetaSetup
} from '../../services/metaConnectService';

const PLATFORMS = [
  {
    key: 'facebook_page' as const,
    label: 'Facebook',
    icon: 'devicon:facebook',
    color: 'bg-blue-100 text-blue-600',
    description: 'Your practice\'s own Facebook page'
  },
  {
    key: 'instagram_business' as const,
    label: 'Instagram',
    icon: 'skill-icons:instagram',
    color: 'bg-pink-100 text-pink-600',
    description: 'The Instagram business account linked to your page'
  }
];

/**
 * Settings > Social: the practice connects its OWN Facebook page and Instagram business account (owner, 13 Oct 2026).
 * Two cards in the Supported Platforms grid, in the same look as the Gmail card. One "Connect Facebook / Instagram"
 * sign-in covers both (Instagram business accounts are linked to a page). Until OneHealth's Meta app is registered
 * and meta-oauth is deployed, both say "Not set up yet" and nothing can be clicked that would fail.
 */
export const MetaConnectCards: React.FC<{ practiceId: string | null }> = ({ practiceId }) => {
  const { user } = useAuthStore();
  const canManage = canEditPracticeSettings(user);
  const [setup, setSetup] = useState<MetaSetup | null>(null);
  const [connections, setConnections] = useState<MetaConnection[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!practiceId) return;
    const [nextSetup, listed] = await Promise.all([loadMetaSetup(), loadMetaConnections(practiceId)]);
    setSetup(listed.ok || !listed.notSetUp ? nextSetup : 'not_set_up');
    setConnections(listed.ok ? listed.value : []);
  }, [practiceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Facebook sends the person back to Settings > Social with the outcome: say it once, then tidy the address
  useEffect(() => {
    const address = new URL(window.location.href);
    const message = metaReturnMessage(address.searchParams);
    if (!message) return;
    if (message.tone === 'success') toast.success(message.text);
    else toast.error(message.text);
    address.searchParams.delete('meta');
    address.searchParams.delete('count');
    window.history.replaceState(window.history.state, '', `${address.pathname}${address.search}${address.hash}`);
  }, []);

  const connect = async () => {
    if (!practiceId) return;
    setBusy(true);
    const result = await startMetaConnect(practiceId);
    if (!result.ok) {
      setBusy(false);
      toast.error(result.message);
      return;
    }
    window.location.assign(result.url);
  };

  const disconnect = async (connection: MetaConnection) => {
    if (!practiceId || !window.confirm(`Disconnect ${connection.displayName} from OneHealth?`)) return;
    setBusy(true);
    const result = await disconnectMeta(practiceId, connection.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`${connection.displayName} is disconnected`);
    await refresh();
  };

  return (
    <>
      {PLATFORMS.map(platform => {
        const linked = connections.filter(connection => connection.platform === platform.key);
        return (
          <div key={platform.key} data-platform={platform.key} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg ${platform.color}`}>
                  <Icon icon={platform.icon} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900">{platform.label}</h3>
                  <p className="text-xs text-gray-500">{platform.description}</p>
                </div>
              </div>
              {linked.length > 0 ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600 font-medium">Connected</span>
                </div>
              ) : setup === 'ready' && canManage ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { void connect(); }} className="flex-shrink-0">
                  <Icon icon={SolarIcons.plus} className="w-3 h-3 mr-1" />
                  Connect
                </Button>
              ) : (
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {setup === null ? 'Checking...' : setup === 'ready' ? 'Not connected' : 'Not set up yet'}
                </span>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              {linked.map(connection => (
                <div key={connection.id} className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-700 truncate">{connection.displayName}</p>
                  {canManage && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { void disconnect(connection); }}
                      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 flex-shrink-0"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              ))}
              {linked.length === 0 && (
                <p className="text-xs text-gray-500">
                  {setup === 'ready'
                    ? canManage
                      ? 'Connect Facebook / Instagram: Facebook asks which of your pages OneHealth may use.'
                      : 'A practice administrator or doctor can connect it.'
                    : 'Connecting Facebook and Instagram opens once OneHealth\'s Meta app is registered.'}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default MetaConnectCards;
