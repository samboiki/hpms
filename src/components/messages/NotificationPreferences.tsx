import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { useMessagingStore } from '../../stores/messagingStore';
import { toast } from 'react-hot-toast';
import { loadNotificationPreferences, saveNotificationPreferences } from '../../services/notificationPreferencesService';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_TYPE_GROUPS,
  type NotificationTypeKey,
  type StaffNotificationPrefs
} from '../../utils/notifications/notificationPreferences';

interface NotificationPreferencesProps {
  className?: string;
}

const TYPE_LOOK: Record<NotificationTypeKey, { icon: string; color: string }> = {
  appointments: { icon: 'solar:calendar-bold-duotone', color: 'text-blue-500' },
  messages: { icon: 'solar:chat-round-dots-bold-duotone', color: 'text-purple-500' },
  lab_results: { icon: 'solar:test-tube-bold-duotone', color: 'text-green-500' },
  billing: { icon: 'solar:dollar-minimalistic-bold-duotone', color: 'text-amber-500' },
  reminders: { icon: 'solar:bell-bing-bold-duotone', color: 'text-red-500' },
  announcements: { icon: 'solar:volume-loud-bold-duotone', color: 'text-indigo-500' }
};

/**
 * The person's own notification settings. Staff notifications are shown in OneHealth only, so these are the settings
 * the app honours: notifications on or off and which kinds to show (the notification lists, the Dashboard panel and
 * the unread counts follow them). Owner decision 13 Oct 2026: no setting that nothing reads.
 */
export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ className }) => {
  const { user } = useAuthStore();
  const applyNotificationPrefs = useMessagingStore(state => state.applyNotificationPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<'ready' | 'not_set_up' | 'error'>('ready');
  const [preferences, setPreferences] = useState<StaffNotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    void loadNotificationPreferences(user.id).then(result => {
      if (cancelled) return;
      setState(result.status);
      if (result.status === 'ready') setPreferences(result.prefs);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const savePreferences = async () => {
    if (!user?.id) return;
    setSaving(true);
    const result = await saveNotificationPreferences(user.id, user.practice_id, preferences);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    // Used at once: hidden kinds leave the lists and the unread counts
    applyNotificationPrefs(user.id, preferences);
    toast.success('Notification settings saved');
  };

  const toggleTypePreference = (type: NotificationTypeKey, value: boolean) => {
    setPreferences(prev => ({ ...prev, types: { ...prev.types, [type]: value } }));
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Icon icon="solar:bell-bold-duotone" className="w-6 h-6 text-amber-500" />
            Notification Preferences
          </h3>
          <p className="text-sm text-gray-500 mt-1">Choose which notifications you see in OneHealth</p>
        </div>
        <button
          onClick={savePreferences}
          disabled={saving || state !== 'ready'}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
          ) : (
            <Icon icon="solar:diskette-bold-duotone" className="w-4 h-4" />
          )}
          Save Changes
        </button>
      </div>

      {state !== 'ready' && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          {state === 'not_set_up'
            ? 'Notification settings are not set up yet for this practice. You see every notification for now.'
            : 'Your notification settings could not be loaded. Please try again later; you see every notification for now.'}
        </p>
      )}

      <div className="space-y-6">
        {/* Master Toggle */}
        <div className="pb-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Enable All Notifications</p>
              <p className="text-sm text-gray-500">
                {preferences.notificationsEnabled
                  ? 'Master switch for all notification types'
                  : 'Notifications are off. Turn this on to change the settings below.'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.notificationsEnabled}
                onChange={(e) => setPreferences(prev => ({ ...prev, notificationsEnabled: e.target.checked }))}
                aria-label="Enable all notifications"
                disabled={state !== 'ready'}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-500 peer-checked:to-orange-600"></div>
            </label>
          </div>
        </div>

        {/* Notification Types */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Icon icon="solar:widget-add-bold-duotone" className="w-5 h-5" />
            Notification Types
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {NOTIFICATION_TYPE_GROUPS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Icon icon={TYPE_LOOK[key].icon} className={`w-5 h-5 ${TYPE_LOOK[key].color}`} />
                  <span className="font-medium text-gray-700">{label}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.types[key] !== false}
                    onChange={(e) => toggleTypePreference(key, e.target.checked)}
                    aria-label={`${label} notifications`}
                    disabled={!preferences.notificationsEnabled || state !== 'ready'}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gray-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                </label>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Emergencies, system alerts and urgent notifications always show. Tasks, leave and payroll notices have no switch.
          </p>
        </div>
      </div>
    </div>
  );
};