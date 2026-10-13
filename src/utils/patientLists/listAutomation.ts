/**
 * Message settings of a patient list: the SMS text, when it is sent, quiet hours, and how often
 * the same patient may receive it. Stored as jsonb on patient_lists.automation, so everything read
 * back is checked here. Whether scheduled sending is on is the separate column
 * patient_lists.automation_enabled (the scheduled sender selects lists by it).
 *
 * All times are Windhoek time (see listDates.ts). No third-party imports (Deno).
 */
import { isoWeekKey, type PracticeClock } from './listDates.ts';

export type SendSchedule = 'manual' | 'daily' | 'birthday_morning';
export type RepeatGuard = 'day' | 'week' | 'month' | 'year' | 'ever';

export interface ListAutomationSettings {
  /** SMS text with {{variables}} (see listMessages.ts) */
  template: string;
  /** manual: only when staff press Send now; daily: every day at sendTime; birthday_morning: at
   *  sendTime on each member's birthday */
  schedule: SendSchedule;
  /** 'HH:MM', Windhoek time */
  sendTime: string;
  /** No messages from quietStart until quietEnd ('HH:MM', may run past midnight). Equal = off. */
  quietStart: string;
  quietEnd: string;
  /** A patient gets this list's message at most once per day/week/month/year, or only once ever */
  repeat: RepeatGuard;
}

export const DEFAULT_AUTOMATION: ListAutomationSettings = {
  template: '',
  schedule: 'manual',
  sendTime: '09:00',
  quietStart: '19:00',
  quietEnd: '08:00',
  repeat: 'ever'
};

/** Four SMS parts: longer messages cost too much to send to a whole list. */
export const MAX_TEMPLATE_LENGTH = 612;

const SCHEDULES: readonly SendSchedule[] = ['manual', 'daily', 'birthday_morning'];
const REPEATS: readonly RepeatGuard[] = ['day', 'week', 'month', 'year', 'ever'];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since midnight for 'HH:MM', or null. */
export function parseTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = TIME_PATTERN.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** True inside quiet hours. A window that ends earlier than it starts runs past midnight. */
export function isQuietTime(minutes: number, quietStart: string, quietEnd: string): boolean {
  const start = parseTime(quietStart);
  const end = parseTime(quietEnd);
  if (start === null || end === null || start === end) return false;
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads stored settings, filling anything missing or unreadable with the defaults. Used to show
 * and run a list; saving goes through validateAutomation.
 */
export function parseAutomation(value: unknown): ListAutomationSettings {
  const stored = isRecord(value) ? value : {};
  const pickTime = (key: keyof ListAutomationSettings): string =>
    parseTime(stored[key]) !== null ? String(stored[key]).trim() : (DEFAULT_AUTOMATION[key] as string);
  return {
    template: typeof stored.template === 'string' ? stored.template : DEFAULT_AUTOMATION.template,
    schedule: SCHEDULES.includes(stored.schedule as SendSchedule)
      ? (stored.schedule as SendSchedule)
      : DEFAULT_AUTOMATION.schedule,
    sendTime: pickTime('sendTime'),
    quietStart: pickTime('quietStart'),
    quietEnd: pickTime('quietEnd'),
    repeat: REPEATS.includes(stored.repeat as RepeatGuard) ? (stored.repeat as RepeatGuard) : DEFAULT_AUTOMATION.repeat
  };
}

export type AutomationValidation = { ok: true; settings: ListAutomationSettings } | { ok: false; error: string };

/** Checks settings before they are saved. `enabled` = scheduled sending will be switched on. */
export function validateAutomation(input: ListAutomationSettings, enabled: boolean): AutomationValidation {
  const template = input.template.trim();
  if (template.length > MAX_TEMPLATE_LENGTH) {
    return { ok: false, error: `The message is too long: keep it under ${MAX_TEMPLATE_LENGTH} characters (4 SMS).` };
  }
  if (enabled && !template) return { ok: false, error: 'Write the message before switching on automatic sending.' };
  if (!SCHEDULES.includes(input.schedule)) return { ok: false, error: 'Choose when to send.' };
  if (!REPEATS.includes(input.repeat)) return { ok: false, error: 'Choose how often a patient may get this message.' };
  for (const [label, value] of [
    ['send time', input.sendTime],
    ['start of quiet hours', input.quietStart],
    ['end of quiet hours', input.quietEnd]
  ] as const) {
    if (parseTime(value) === null) return { ok: false, error: `The ${label} must be a time such as 08:30.` };
  }
  const sendMinutes = parseTime(input.sendTime) as number;
  if (input.schedule !== 'manual' && isQuietTime(sendMinutes, input.quietStart, input.quietEnd)) {
    return {
      ok: false,
      error: `${input.sendTime} is inside your quiet hours (${input.quietStart} to ${input.quietEnd}). Choose a later or earlier time.`
    };
  }
  if (enabled && input.schedule === 'manual') {
    return { ok: false, error: 'Choose a daily time or birthday mornings for automatic sending.' };
  }
  return { ok: true, settings: { ...input, template } };
}

/**
 * Whether the scheduled sender should run a list now: sending is switched on, today's send time
 * has passed, it has not run today, and it is not quiet hours. The sender checks every 15 minutes,
 * so a list set for 08:00 goes out between 08:00 and 08:15; after a missed run it still goes out
 * later the same day.
 */
export function isScheduledRunDue(
  settings: ListAutomationSettings,
  enabled: boolean,
  lastRunOn: string | null,
  clock: PracticeClock
): boolean {
  if (!enabled || settings.schedule === 'manual' || lastRunOn === clock.dateKey) return false;
  const sendMinutes = parseTime(settings.sendTime);
  if (sendMinutes === null || clock.minutes < sendMinutes) return false;
  return !isQuietTime(clock.minutes, settings.quietStart, settings.quietEnd);
}

/**
 * The key that stops a patient getting the same list's message twice in one period, e.g. '2026'
 * for once a year. Stored per member when a message is sent (patient_list_members.last_sent_period).
 */
export function periodKeyFor(repeat: RepeatGuard, todayKey: string): string {
  switch (repeat) {
    case 'day':
      return todayKey;
    case 'week':
      return isoWeekKey(todayKey);
    case 'month':
      return todayKey.slice(0, 7);
    case 'year':
      return todayKey.slice(0, 4);
    case 'ever':
      return 'once';
  }
}
