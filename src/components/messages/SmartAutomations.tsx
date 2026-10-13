import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { useDiarySettings } from '../../hooks/useDiarySettings';
import { useSmsRepliesLive } from '../../hooks/useSmsRepliesLive';
import {
  automationSettingFromRow,
  checkAutomationMessages,
  type AutomationMessages,
  type WiredAutomationId
} from '../../../supabase/functions/process-automation-queue/automationRules.ts';
import {
  AUTOMATION_CARDS,
  cardsForView,
  isCardOn,
  type AutomationCard,
  type AutomationLiveState,
  type AutomationView,
  type ElsewhereCard
} from '../../utils/automations/automationCatalog';
import { processorHealth, scheduleState } from '../../utils/automations/processorHealth';
import { loadAutomations, saveAutomationSetting, type AutomationsLoad } from '../../services/automations/automationSettingsService';
import { CARD, SECONDARY_BUTTON } from '../patientLists/listStyles';
import { ElsewhereCardView, NotOfferedCardView, SendsCardView } from './automations/AutomationCardViews';
import { AutomationMessageSheet } from './automations/AutomationMessageSheet';
import { ProcessorNotice } from './automations/ProcessorNotice';

/**
 * Communications > Automations. Every card is honest about what it is (src/utils/automations/automationCatalog.ts):
 * - "Sends by itself": OneHealth sends it through one engine (database trigger -> automation_queue ->
 *   process-automation-queue -> SMS / email gateway). Only these have a switch, for practice administrators.
 * - "Done elsewhere": the diary's reminders, Lists, Remittances, Batches or Payroll do the job; the card opens it.
 * - "Not available yet": no switch, never shown as on, and folded away under "All".
 * The screen also says whether the sender really runs (nothing in the database runs on a schedule by itself).
 * The older version saved about 20 switches that sent nothing, a test mode nobody honoured and custom automations
 * nothing could trigger; all of that is gone.
 */
export interface SmartAutomationsProps {
  /** Opens Communications > Lists, where several of these jobs are done (the Communications page passes it) */
  onOpenLists?: () => void;
}

const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3';

const SmartAutomations: React.FC<SmartAutomationsProps> = ({ onOpenLists }) => {
  const { user } = useAuthStore();
  const practiceId = user?.practice_id ?? null;
  // The database lets only practice administrators (and OneHealth support) save (save_automation_setting)
  const canChange = user?.role === 'admin' || user?.is_super_admin === true;
  const navigate = useNavigate();
  const diarySettings = useDiarySettings(practiceId).settings;
  const diaryRemindersOn = diarySettings.reminders.enabled;
  // The diary's switch is not proof that reminders go out: only a run of the reminder schedule is
  const diaryReminders = scheduleState(diaryRemindersOn, diarySettings.remindersLastRunAt, new Date());
  // SMS invite a reply only while the practice's replies are collected (OneHealth support switches it on)
  const repliesLive = useSmsRepliesLive(practiceId) === true;
  const [load, setLoad] = useState<AutomationsLoad | null>(null);
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<AutomationView>('active');
  const [editing, setEditing] = useState<WiredAutomationId | null>(null);
  const [busy, setBusy] = useState<WiredAutomationId | null>(null);
  const [showNotOffered, setShowNotOffered] = useState(false);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    loadAutomations(practiceId).then((loaded) => {
      if (!cancelled) setLoad(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  const settings = load && load.state !== 'error' ? load.settings : null;
  const setUp = load?.state === 'ready';
  const enabledIds = useMemo(
    () => new Set<string>(settings ? Object.values(settings).filter((setting) => setting.enabled).map((setting) => setting.automationId) : []),
    [settings]
  );
  const live: AutomationLiveState = { setUp, enabledIds, diaryRemindersOn };
  const health = processorHealth({ setUp, status: load?.state === 'ready' ? load.status : null, anyOn: setUp && enabledIds.size > 0, now: new Date() });
  const activeCards = cardsForView('active', live);
  const settingFor = (id: WiredAutomationId) => settings?.[id] ?? automationSettingFromRow(id, null);
  const nameOf = (id: WiredAutomationId) => AUTOMATION_CARDS.find((card) => card.id === id)?.name ?? 'The automation';

  const save = async (id: WiredAutomationId, enabled: boolean, messages: AutomationMessages): Promise<boolean> => {
    if (!practiceId) return false;
    setBusy(id);
    const result = await saveAutomationSetting(practiceId, id, enabled, messages);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    setVersion((current) => current + 1);
    return true;
  };

  const toggle = async (id: WiredAutomationId) => {
    const setting = settingFor(id);
    const switchingOn = !setting.enabled;
    // A message that cannot be filled in is never switched on: fix it first
    const checked = checkAutomationMessages(id, setting, repliesLive);
    if (switchingOn && !checked.ok) {
      toast.error('Check the message first: it cannot be sent as it is.');
      setEditing(id);
      return;
    }
    if (await save(id, switchingOn, checked.ok ? checked.messages : setting)) {
      toast.success(switchingOn ? `${nameOf(id)} is on` : `${nameOf(id)} is off: nothing more is sent`);
    }
  };

  const saveMessages = async (id: WiredAutomationId, messages: AutomationMessages) => {
    if (await save(id, settingFor(id).enabled, messages)) {
      toast.success('Message saved');
      setEditing(null);
    }
  };

  /** Lists is another tab of this page (the page passes onOpenLists); the rest are other pages */
  const openerFor = (card: ElsewhereCard): (() => void) | null => {
    if (card.target.kind === 'lists') return onOpenLists ?? null;
    const href = card.target.href;
    return () => navigate(href);
  };

  const renderCard = (card: AutomationCard) => {
    if (card.kind === 'sends') {
      return (
        <SendsCardView
          key={card.id}
          card={card}
          setting={settingFor(card.id)}
          on={isCardOn(card, live)}
          setUp={setUp}
          canChange={canChange}
          busy={busy === card.id}
          stats={load?.state === 'ready' ? load.status.automations[card.id] : null}
          onToggle={() => void toggle(card.id)}
          onOpenMessage={() => setEditing(card.id)}
        />
      );
    }
    if (card.kind === 'elsewhere') {
      return (
        <ElsewhereCardView
          key={card.id}
          card={card}
          schedule={card.target.kind === 'diary_reminders' ? { state: diaryReminders, lastRunAt: diarySettings.remindersLastRunAt } : null}
          onOpen={openerFor(card)}
        />
      );
    }
    return <NotOfferedCardView key={card.id} card={card} />;
  };

  const section = (title: string, help: string, cards: AutomationCard[]) => (
    <section className="space-y-3" aria-label={title}>
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{help}</p>
      </div>
      <div className={GRID}>{cards.map(renderCard)}</div>
    </section>
  );

  const notOffered = AUTOMATION_CARDS.filter((card) => card.kind === 'not_offered');

  const allView = (
    <div className="space-y-8">
      {section('Sends by itself', 'Switch one on and OneHealth sends it for you.', AUTOMATION_CARDS.filter((card) => card.kind === 'sends'))}
      {section('Done elsewhere in OneHealth', 'These jobs have their own place. Each card opens it.', AUTOMATION_CARDS.filter((card) => card.kind === 'elsewhere'))}
      <section className="space-y-3" aria-label="Not available yet">
        <button
          type="button"
          onClick={() => setShowNotOffered((current) => !current)}
          aria-expanded={showNotOffered}
          className="inline-flex items-center gap-2 rounded-lg text-base font-semibold text-gray-700 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          Not available yet ({notOffered.length})
          <Icon
            icon="solar:alt-arrow-down-bold-duotone"
            className={`h-5 w-5 transition-transform motion-reduce:transition-none ${showNotOffered ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {showNotOffered && <div className={GRID}>{notOffered.map(renderCard)}</div>}
      </section>
    </div>
  );

  const activeView =
    activeCards.length > 0 ? (
      <div className={GRID}>{activeCards.map(renderCard)}</div>
    ) : (
      <div className={`${CARD} mx-auto max-w-lg p-6 text-center`}>
        <Icon icon="solar:magic-stick-3-bold-duotone" className="mx-auto mb-3 h-10 w-10 text-indigo-400" aria-hidden="true" />
        <p className="font-medium text-gray-900">Nothing is switched on</p>
        <p className="mt-1 text-sm text-gray-500">
          OneHealth can welcome new patients and confirm bookings by itself, and the diary can send appointment reminders.
        </p>
        <button type="button" onClick={() => setView('all')} className={`${SECONDARY_BUTTON} mt-4`}>
          See all automations
        </button>
      </div>
    );

  let status: React.ReactNode;
  if (!practiceId) status = <p className="text-sm text-gray-500">Sign in to a practice to see its automations.</p>;
  else if (load === null) status = <p className="text-sm text-gray-500" role="status">Loading the automations...</p>;
  else if (load.state === 'error') {
    status = (
      <div className={`${CARD} flex flex-wrap items-center gap-3 p-4 text-sm`} role="alert">
        <Icon icon="solar:danger-triangle-bold-duotone" className="h-5 w-5 text-amber-500" aria-hidden="true" />
        <span className="min-w-0 flex-1 text-gray-700">{load.message}</span>
        <button type="button" onClick={() => setVersion((current) => current + 1)} className={SECONDARY_BUTTON}>
          <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  } else status = <ProcessorNotice health={health} />;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <header>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <Icon icon="solar:magic-stick-3-bold-duotone" className="h-6 w-6 text-purple-600" aria-hidden="true" />
            Automations
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Messages OneHealth sends for you. Each card says what it does, or where in OneHealth the job is done.
          </p>
        </header>

        {status}

        <div className="inline-flex rounded-xl bg-gray-100 p-1" role="group" aria-label="Which automations to show">
          {(['active', 'all'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                view === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {id === 'active' ? `Active (${activeCards.length})` : `All (${AUTOMATION_CARDS.length})`}
            </button>
          ))}
        </div>

        {/* Nothing below until the settings are read, so "Nothing is switched on" never flashes up wrongly */}
        {practiceId && load === null ? null : view === 'active' ? activeView : allView}
      </div>

      {editing && (
        <AutomationMessageSheet
          name={nameOf(editing)}
          setting={settingFor(editing)}
          readOnly={!canChange || !setUp}
          repliesLive={repliesLive}
          saving={busy === editing}
          onClose={() => setEditing(null)}
          onSave={(messages) => void saveMessages(editing, messages)}
        />
      )}
    </div>
  );
};

export default SmartAutomations;
