/**
 * Is the automation sender really running? Nothing in the database can run on a schedule by itself (pg_cron and
 * pg_net are not installed), so the screen says so honestly instead of pretending: it reads automation_status()
 * (proposals/2026-10-08-automations.sql) and shows when the sender last ran and last processed this practice's
 * messages, or a plain notice when it has not run for a day.
 */
import {
  WIRED_AUTOMATION_IDS,
  type WiredAutomationId
} from '../../../supabase/functions/process-automation-queue/automationRules.ts';
import { formatDiaryTimestamp } from '../diary/diaryTime';

export interface AutomationStats {
  /** Sent by the sender in the last 30 days */
  sent30d: number;
  /** Closed by the sender without sending in the last 30 days (no cell number, STOP, bundle used up...) */
  notSent30d: number;
  lastSentAt: string | null;
  /** The most common reasons, in plain words */
  notSentReasons: Array<{ reason: string; count: number }>;
}

/**
 * Only items the sender itself finished count (automation_queue.worker_id = 'process-automation-queue', filtered in
 * automation_status): the 2026-10-06 demo seed and the old in-database processors closed hundreds of items without
 * sending anything, and those must not look like activity.
 */
export interface AutomationStatus {
  /** When the sender last ran (for any practice): proof that the scheduler is on */
  processorLastRunAt: string | null;
  /** When the sender last finished one of this practice's messages (sent or not) */
  lastProcessedAt: string | null;
  /** This practice's messages that are due and still waiting */
  waitingDue: number;
  oldestWaitingSince: string | null;
  automations: Record<WiredAutomationId, AutomationStats>;
}

const EMPTY_STATS: AutomationStats = { sent30d: 0, notSent30d: 0, lastSentAt: null, notSentReasons: [] };

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);
const count = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

function statsFrom(value: unknown): AutomationStats {
  if (!value || typeof value !== 'object') return { ...EMPTY_STATS, notSentReasons: [] };
  const v = value as Record<string, unknown>;
  const reasons = Array.isArray(v.not_sent_reasons) ? v.not_sent_reasons : [];
  return {
    sent30d: count(v.sent_30d),
    notSent30d: count(v.not_sent_30d),
    lastSentAt: text(v.last_sent_at),
    notSentReasons: reasons.flatMap((entry) => {
      const e = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null;
      const reason = text(e?.reason);
      return reason ? [{ reason, count: count(e?.count) }] : [];
    })
  };
}

/** automation_status() as the screen uses it; anything missing reads as "nothing yet". */
export function automationStatusFromRpc(data: unknown): AutomationStatus {
  const d = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const perAutomation = d.automations && typeof d.automations === 'object' ? (d.automations as Record<string, unknown>) : {};
  const automations = Object.fromEntries(WIRED_AUTOMATION_IDS.map((id) => [id, statsFrom(perAutomation[id])])) as Record<WiredAutomationId, AutomationStats>;
  return {
    processorLastRunAt: text(d.processor_last_run_at),
    lastProcessedAt: text(d.last_processed_at),
    waitingDue: count(d.waiting_due),
    oldestWaitingSince: text(d.oldest_waiting_since),
    automations
  };
}

/** The scheduler runs every few minutes; a whole day without a run means it is not running. */
export const NOT_RUNNING_AFTER_HOURS = 24;

/** The owner's wording, shown instead of pretending when the sender has not run. */
export const NOT_RUNNING_NOTICE = 'Automations are switched on but not running yet: OneHealth support must start the scheduler';

export const NOT_SET_UP_NOTICE =
  'Automatic messages are not set up yet: OneHealth support must apply the automations update. Nothing can be switched on or sent until then.';

export type ProcessorHealth =
  /** The database part is missing: nothing can be switched on */
  | { state: 'not_set_up'; notice: string }
  /** Nothing is switched on, so nothing needs to run */
  | { state: 'idle'; lastProcessed: string | null }
  /** Switched on, but the sender has not run for a day (or ever) */
  | { state: 'not_running'; notice: string; lastProcessed: string | null }
  /** The sender runs, but this practice's messages have waited more than a day */
  | { state: 'waiting'; notice: string; lastRun: string; lastProcessed: string | null }
  | { state: 'running'; lastRun: string; lastProcessed: string | null };

const hoursSince = (iso: string | null, now: Date): number | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : (now.getTime() - ms) / 3_600_000;
};

/** The owner's words for one switch that is on while nothing runs it (the diary's reminders, a list's automatic SMS). */
export const SCHEDULER_NOT_RUNNING_NOTICE = 'On, but not running yet: OneHealth support must start the scheduler';

export type ScheduleState = 'off' | 'not_running' | 'running';

/**
 * Does a switched-on job really run? The switch proves nothing (nothing in the database runs by itself); only a recorded
 * run does, and a whole day without one means it is not running. The one rule for every scheduled job: this page's
 * sender, the diary's reminders (diary_settings.reminders_last_run_at) and the lists' automatic SMS.
 */
export function scheduleState(on: boolean, lastRunAt: string | null, now: Date): ScheduleState {
  if (!on) return 'off';
  const since = hoursSince(lastRunAt, now);
  return since === null || since > NOT_RUNNING_AFTER_HOURS ? 'not_running' : 'running';
}

/** What the screen says about the sender. */
export function processorHealth(input: { setUp: boolean; status: AutomationStatus | null; anyOn: boolean; now: Date }): ProcessorHealth {
  if (!input.setUp || !input.status) return { state: 'not_set_up', notice: NOT_SET_UP_NOTICE };
  const lastProcessed = formatDiaryTimestamp(input.status.lastProcessedAt);
  if (!input.anyOn) return { state: 'idle', lastProcessed };

  if (scheduleState(true, input.status.processorLastRunAt, input.now) === 'not_running') {
    return { state: 'not_running', notice: NOT_RUNNING_NOTICE, lastProcessed };
  }
  const lastRun = formatDiaryTimestamp(input.status.processorLastRunAt) ?? '';
  const waited = hoursSince(input.status.oldestWaitingSince, input.now);
  if (input.status.waitingDue > 0 && waited !== null && waited > NOT_RUNNING_AFTER_HOURS) {
    return {
      state: 'waiting',
      notice: 'Some automatic messages have waited more than a day: OneHealth support should check the scheduler.',
      lastRun,
      lastProcessed
    };
  }
  return { state: 'running', lastRun, lastProcessed };
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One line for a card: what the sender did with this automation lately. */
export function automationStatsLine(stats: AutomationStats): string {
  if (stats.sent30d === 0 && stats.notSent30d === 0) return 'Nothing sent in the last 30 days.';
  const parts = [`${plural(stats.sent30d, 'message')} sent in the last 30 days`];
  if (stats.notSent30d > 0) {
    const top = stats.notSentReasons[0];
    parts.push(`${stats.notSent30d} not sent${top ? ` (mostly: ${top.reason.replace(/^Not sent: /, '')})` : ''}`);
  }
  const last = formatDiaryTimestamp(stats.lastSentAt);
  return `${parts.join(', ')}.${last ? ` Last sent ${last}.` : ''}`;
}
