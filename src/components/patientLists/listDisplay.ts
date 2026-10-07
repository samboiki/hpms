/**
 * Wording and formatting for the patient-list screens: what a rule means in plain language, why
 * a patient is on a list, when the list sends, why someone is skipped, and the CSV export.
 * Dates are day-first ("7 Oct 2026") and money is N$ (formatNad).
 */
import { format } from 'date-fns';
import { formatNad } from '../../utils/billing/money';
import { daysBetweenKeys } from '../../utils/billing/dates';
import type { ListAutomationSettings, RepeatGuard } from '../../utils/patientLists/listAutomation';
import { ageOn, birthdayBetween, currentBirthday } from '../../utils/patientLists/listDates';
import {
  birthdayWindowBounds,
  lastRecallVisit,
  type ListMember,
  type SmartRule
} from '../../utils/patientLists/listRules';
import type { ListRunSummary, SkipReason } from '../../utils/patientLists/listSend';

const keyToDate = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** "7 Oct 2026" */
export const formatDateKey = (key: string | null | undefined): string => (key ? format(keyToDate(key), 'd MMM yyyy') : '');

/** "7 Oct" */
const formatDayMonth = (key: string): string => format(keyToDate(key), 'd MMM');

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

const visitTypeLabel = (types: readonly string[]): string =>
  types.length === 0 ? 'visit' : `${types.map((type) => type.replace(/[-_]/g, ' ')).join(' or ')} visit`;

/** What the rule means, for the list card and the list header. */
export function describeRule(rule: SmartRule): string {
  switch (rule.type) {
    case 'birthday':
      return rule.window === 'today'
        ? 'Patients whose birthday is today'
        : rule.window === 'this_week'
          ? 'Birthdays this week (Monday to Sunday)'
          : 'Birthdays this month';
    case 'recall_due':
      return `Seen before, no completed ${visitTypeLabel(rule.visitTypes)} in ${plural(rule.months, 'month')}, nothing booked`;
    case 'lapsed':
      return `No completed visit for ${plural(rule.months, 'month')} or more, nothing booked`;
    case 'outstanding_balance':
      return `Owe ${formatNad(rule.minAmount)} or more, unpaid for ${plural(rule.minDays, 'day')} or more`;
    case 'missed_appointment':
      return `Missed an appointment in the last ${plural(rule.withinDays, 'day')}, not seen or rebooked since`;
    case 'regular_follow_up':
      return `${plural(rule.minVisitsInYear, 'visit')} or more in the last year, last one ${plural(rule.everyDays, 'day')} or more ago, nothing booked`;
  }
}

/** Why this patient is on the list today, e.g. "Birthday 12 Oct · turns 40". */
export function memberReason(member: ListMember, rule: SmartRule | null, todayKey: string): string {
  const facts = member.facts;
  if (!member.automatic || !rule) {
    const added = member.addedAt ? new Date(member.addedAt) : null;
    return added && !Number.isNaN(added.getTime()) ? `Added by hand on ${format(added, 'd MMM yyyy')}` : 'Added by hand';
  }
  switch (rule.type) {
    case 'birthday': {
      const { from, to } = birthdayWindowBounds(rule.window, todayKey);
      const birthday = birthdayBetween(facts.dateOfBirth, from, to) ?? currentBirthday(facts.dateOfBirth, todayKey);
      if (!birthday) return 'Birthday';
      const age = ageOn(facts.dateOfBirth, birthday);
      const when = birthday === todayKey ? 'Birthday today' : `Birthday ${formatDayMonth(birthday)}`;
      if (age === null || age <= 0) return when;
      return `${when} · ${birthday < todayKey ? 'turned' : 'turns'} ${age}`;
    }
    case 'recall_due':
    case 'lapsed':
    case 'regular_follow_up': {
      const last = rule.type === 'recall_due' ? lastRecallVisit(facts, rule.visitTypes) : facts.lastCompletedVisitOn;
      if (!last) return `No completed ${visitTypeLabel(rule.type === 'recall_due' ? rule.visitTypes : [])} yet`;
      const days = daysBetweenKeys(last, todayKey);
      const ago = days < 60 ? plural(days, 'day') : plural(Math.floor(days / 30.44), 'month');
      const visits = rule.type === 'regular_follow_up' ? ` · ${plural(facts.completedVisitsLastYear, 'visit')} this year` : '';
      return `Last visit ${formatDateKey(last)} · ${ago} ago${visits}`;
    }
    case 'outstanding_balance':
      return facts.oldestUnpaidOn
        ? `Owes ${formatNad(facts.balanceDue)} · unpaid since ${formatDateKey(facts.oldestUnpaidOn)}`
        : `Owes ${formatNad(facts.balanceDue)}`;
    case 'missed_appointment':
      return facts.lastNoShowOn ? `Missed appointment on ${formatDateKey(facts.lastNoShowOn)}` : 'Missed appointment';
  }
}

/** When the list sends, for the card and the message panel. */
export function scheduleSummary(settings: ListAutomationSettings, enabled: boolean): string {
  if (!enabled || settings.schedule === 'manual') {
    return settings.schedule === 'manual' ? 'Sends only when you press Send now' : 'Automatic sending is off';
  }
  return settings.schedule === 'daily'
    ? `Sends automatically every day at ${settings.sendTime}`
    : `Sends automatically on each birthday at ${settings.sendTime}`;
}

const REPEAT_PERIOD: Record<RepeatGuard, string> = {
  day: 'today',
  week: 'this week',
  month: 'this month',
  year: 'this year',
  ever: 'before (only once per patient)'
};

export const REPEAT_LABELS: Record<RepeatGuard, string> = {
  day: 'Once a day',
  week: 'Once a week',
  month: 'Once a month',
  year: 'Once a year',
  ever: 'Only once'
};

/** Why a member does not get the message, in plain words. */
export function skipReasonLabel(reason: SkipReason, repeat: RepeatGuard): string {
  switch (reason) {
    case 'opted_out':
      return 'Asked not to get SMS';
    case 'no_cell':
      return 'No cell number on file';
    case 'invalid_cell':
      return 'Cell number is not valid';
    case 'already_sent':
      return `Already got this message ${REPEAT_PERIOD[repeat]}`;
    case 'no_message':
      return 'The message is empty';
    case 'missing_details':
      return 'Missing a detail the message needs';
  }
}

/** "Last sent 7 Oct 2026, 09:02 · 12 sent, 3 skipped" */
export function lastRunText(summary: ListRunSummary | null): string | null {
  if (!summary) return null;
  const when = format(new Date(summary.at), 'd MMM yyyy, HH:mm');
  const parts = [`${summary.sent} sent`];
  if (summary.failed > 0) parts.push(`${summary.failed} failed`);
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
  const how = summary.mode === 'scheduled' ? 'Automatic send' : 'Sent';
  return `${how} ${when} · ${parts.join(', ')}`;
}

// ---------------------------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------------------------

/**
 * One CSV cell. Quotes are doubled, and a value starting with = + - @ (or a tab/return) gets a
 * leading apostrophe, so a spreadsheet never runs a patient's "name" as a formula.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Byte order mark: makes Excel read the file as UTF-8 */
const UTF8_BOM = String.fromCharCode(0xfeff);

export function buildMembersCsv(members: readonly ListMember[], rule: SmartRule | null, todayKey: string): string {
  const header = ['First name', 'Surname', 'Cell number', 'Date of birth', 'Why on this list', 'How added', 'Last messaged'];
  const lines = members.map((member) =>
    [
      member.facts.firstName,
      member.facts.lastName,
      member.facts.cellNumber ?? '',
      member.facts.dateOfBirth ? format(keyToDate(member.facts.dateOfBirth), 'dd/MM/yyyy') : '',
      memberReason(member, rule, todayKey),
      member.automatic ? 'Automatic' : 'Added by hand',
      member.lastSentAt ? format(new Date(member.lastSentAt), 'dd/MM/yyyy') : ''
    ]
      .map(csvCell)
      .join(',')
  );
  // With the byte order mark Excel shows names such as "Ndapewa Nangolo-Kandjii" correctly
  return `${UTF8_BOM}${[header.map(csvCell).join(','), ...lines].join('\r\n')}`;
}

/** File name for the export, e.g. "recall-due-2026-10-07.csv". */
export function csvFileName(listName: string, todayKey: string): string {
  const slug = listName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'patient-list'}-${todayKey}.csv`;
}
