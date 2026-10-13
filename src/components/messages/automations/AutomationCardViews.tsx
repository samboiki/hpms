import React from 'react';
import { Icon } from '@iconify/react';
import type { AutomationSetting } from '../../../../supabase/functions/process-automation-queue/automationRules.ts';
import type { ElsewhereCard, NotOfferedCard, SendsCard } from '../../../utils/automations/automationCatalog';
import { formatDiaryTimestamp } from '../../../utils/diary/diaryTime';
import { SCHEDULER_NOT_RUNNING_NOTICE, automationStatsLine, type AutomationStats, type ScheduleState } from '../../../utils/automations/processorHealth';
import { CARD, CHIP, SECONDARY_BUTTON } from '../../patientLists/listStyles';

const TILE = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1';

/** An on/off switch that is a real control (keyboard and screen reader), never a decoration. */
const Switch: React.FC<{ on: boolean; label: string; disabled: boolean; onChange: () => void }> = ({ on, label, disabled, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}
  >
    <span
      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
      aria-hidden="true"
    />
  </button>
);

const OnPill: React.FC<{ on: boolean }> = ({ on }) => (
  <span className={`${CHIP} ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{on ? 'On' : 'Off'}</span>
);

export interface SendsCardViewProps {
  card: SendsCard;
  setting: AutomationSetting;
  on: boolean;
  /** The engine's database part is applied */
  setUp: boolean;
  /** Practice administrators switch automations and change their messages */
  canChange: boolean;
  busy: boolean;
  stats: AutomationStats | null;
  onToggle: () => void;
  onOpenMessage: () => void;
}

/** An automation OneHealth sends by itself: a real switch, its channels, and what it did lately. */
export const SendsCardView: React.FC<SendsCardViewProps> = ({ card, setting, on, setUp, canChange, busy, stats, onToggle, onOpenMessage }) => (
  <article className={`${CARD} flex h-full flex-col p-4 sm:p-5 ${on ? 'border-emerald-200' : ''}`} aria-label={card.name}>
    <div className="flex items-start gap-3">
      <span className={`${TILE} ${on ? 'bg-emerald-50 ring-emerald-100' : 'bg-indigo-50 ring-indigo-100'}`}>
        <Icon icon={card.icon} className={`h-6 w-6 ${on ? 'text-emerald-600' : 'text-indigo-600'}`} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-gray-900">{card.name}</h3>
        <p className="mt-0.5 text-sm text-gray-600">{card.summary}</p>
      </div>
      <Switch on={on} label={card.name} disabled={!setUp || !canChange || busy} onChange={onToggle} />
    </div>
    <p className="mt-3 text-xs text-gray-500">{card.when}</p>
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {setting.smsEnabled && (
        <span className={`${CHIP} bg-purple-50 text-purple-700`}>
          <Icon icon="solar:chat-round-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
          SMS
        </span>
      )}
      {setting.emailEnabled && (
        <span className={`${CHIP} bg-blue-50 text-blue-700`}>
          <Icon icon="solar:letter-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
          Email
        </span>
      )}
    </div>
    {setUp && stats && on && <p className="mt-2 text-xs text-gray-500">{automationStatsLine(stats)}</p>}
    {setUp && !canChange && <p className="mt-2 text-xs text-gray-500">Only a practice administrator can switch this or change its message.</p>}
    <div className="mt-auto pt-4">
      <button type="button" onClick={onOpenMessage} disabled={!setUp} className={`${SECONDARY_BUTTON} w-full sm:w-auto`}>
        <Icon icon={canChange ? 'solar:pen-bold-duotone' : 'solar:eye-bold-duotone'} className="h-4 w-4" aria-hidden="true" />
        {canChange ? 'Change the message' : 'See the message'}
      </button>
    </div>
  </article>
);

export interface ElsewhereCardViewProps {
  card: ElsewhereCard;
  /**
   * Only for the diary reminders: the diary's own switch and whether the reminder schedule really runs (scheduleState
   * on diary_settings.reminders_last_run_at). Null for every other card.
   */
  schedule: { state: ScheduleState; lastRunAt: string | null } | null;
  /** Null when there is no way to open the place from here (then the card only names it) */
  onOpen: (() => void) | null;
}

/** A job another part of OneHealth already does: the card says where and opens it. */
export const ElsewhereCardView: React.FC<ElsewhereCardViewProps> = ({ card, schedule, onOpen }) => (
  <article className={`${CARD} flex h-full flex-col p-4 sm:p-5`} aria-label={card.name}>
    <div className="flex items-start gap-3">
      <span className={`${TILE} bg-cyan-50 ring-cyan-100`}>
        <Icon icon={card.icon} className="h-6 w-6 text-cyan-600" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-gray-900">{card.name}</h3>
        <p className="mt-0.5 text-sm text-gray-600">{card.summary}</p>
      </div>
      {schedule && schedule.state !== 'not_running' && <OnPill on={schedule.state === 'running'} />}
      {schedule?.state === 'not_running' && <span className={`${CHIP} bg-amber-50 text-amber-800`}>Not running</span>}
    </div>
    {schedule?.state === 'not_running' && <p className="mt-3 text-xs font-medium text-amber-800">{SCHEDULER_NOT_RUNNING_NOTICE}.</p>}
    {schedule?.state === 'running' && <p className="mt-3 text-xs text-gray-500">Last checked {formatDiaryTimestamp(schedule.lastRunAt)}.</p>}
    <div className="mt-auto pt-4">
      {onOpen ? (
        <button type="button" onClick={onOpen} className={`${SECONDARY_BUTTON} w-full sm:w-auto`}>
          {card.target.label}
          <Icon icon="solar:alt-arrow-right-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <p className="text-xs text-gray-500">Find it under Messages &gt; Lists.</p>
      )}
    </div>
  </article>
);

/** Nothing does this yet: no switch, never shown as on, and what to do by hand meanwhile. */
export const NotOfferedCardView: React.FC<{ card: NotOfferedCard }> = ({ card }) => (
  <article className="flex h-full flex-col rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 sm:p-5" aria-label={`${card.name}: not available yet`}>
    <div className="flex items-start gap-3">
      <span className={`${TILE} bg-white ring-gray-200`}>
        <Icon icon={card.icon} className="h-6 w-6 text-gray-400" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-gray-700">{card.name}</h3>
        <span className={`${CHIP} mt-1 bg-gray-200 text-gray-600`}>Not available yet</span>
        <p className="mt-1.5 text-sm text-gray-500">{card.summary}</p>
      </div>
    </div>
    {card.meanwhile && <p className="mt-3 text-xs text-gray-500">Meanwhile: {card.meanwhile}</p>}
  </article>
);
