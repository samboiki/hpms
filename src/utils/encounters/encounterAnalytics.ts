/**
 * Encounters > Analytics: the rules that turn the practice's rows into the figures on screen
 * (src/services/encounterAnalyticsService.ts reads the rows). Every figure keeps the ids of the visits it counts, so
 * a tap opens exactly those visits, and its number is always how many ids it holds: nothing on the page is typed in,
 * estimated or random. (October 2026: the page showed invented procedures, a fixed status chart and made-up
 * percentages, labelled "Live data".)
 *
 * The words the page uses:
 * - Visits: every booking of the period, cancelled ones included. A visit's day is its booked date, else the day it
 *   was seen (walk-ins have only that), as in the diary.
 * - Seen, No-shows, Cancelled: as the diary report (reportOutcome in src/utils/diary/diaryReport.ts). Not marked:
 *   past bookings nobody checked in or marked as a no-show. Still to come: today's bookings not seen yet. Together
 *   they add up to Visits, and so do the days, the practitioners and the visit types.
 * - Diagnoses: the ICD-10 codes on the lines of invoices dated in the period (cancelled invoices left out), counted
 *   once per visit.
 * - Follow-ups due: seen visits whose follow-up date has come (from the start of the period up to today) while the
 *   patient has had nothing booked or seen since.
 */
import { format, subMonths } from 'date-fns';
import { reportOutcome } from '../diary/diaryReport';
import { addDaysToKey, formatDiaryDateRange, parseDateKey, toDateKey } from '../diary/diaryTime';
import { visitDay } from '../diary/visitOverlap';
import { isVisitType, VISIT_TYPE_LABELS } from '../diary/bookingLength';
import { weekBounds } from '../patientLists/listDates';

export type AnalyticsPeriod = '7d' | '30d' | '3m' | '6m';

export const ANALYTICS_PERIODS: ReadonlyArray<{ id: AnalyticsPeriod; label: string; short: string }> = [
  { id: '7d', label: 'Last 7 days', short: '7 days' },
  { id: '30d', label: 'Last 30 days', short: '30 days' },
  { id: '3m', label: 'Last 3 months', short: '3 months' },
  { id: '6m', label: 'Last 6 months', short: '6 months' }
];

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = '30d';

export const isAnalyticsPeriod = (value: unknown): value is AnalyticsPeriod =>
  ANALYTICS_PERIODS.some((period) => period.id === value);

export const periodLabel = (period: AnalyticsPeriod): string =>
  ANALYTICS_PERIODS.find((item) => item.id === period)?.label ?? '';

/** First and last day of a period ('yyyy-MM-dd', both included) */
export interface PeriodRange {
  from: string;
  to: string;
}

/** A period ends today: "Last 30 days" is today and the 29 days before it. */
export function periodRange(period: AnalyticsPeriod, todayKey: string): PeriodRange {
  const monthsBack = (months: number): string => {
    const today = parseDateKey(todayKey);
    return today ? addDaysToKey(toDateKey(subMonths(today, months)), 1) : todayKey;
  };
  const from =
    period === '7d' ? addDaysToKey(todayKey, -6) :
    period === '30d' ? addDaysToKey(todayKey, -29) :
    monthsBack(period === '3m' ? 3 : 6);
  return { from, to: todayKey };
}

/** Every day of a range, in order (none for a range that is not made of dates) */
export function daysOf(range: PeriodRange): string[] {
  if (!parseDateKey(range.from) || !parseDateKey(range.to)) return [];
  const days: string[] = [];
  for (let day = range.from; day <= range.to && days.length <= 400; day = addDaysToKey(day, 1)) days.push(day);
  return days;
}

/** The columns of a visit the figures need */
export interface AnalyticsVisitRow {
  id: string;
  patient_id: string | null;
  doctor_id: string | null;
  scheduled_date: string | null;
  visit_date: string | null;
  status: string | null;
  is_cancelled: boolean | null;
  is_checked_in: boolean | null;
  is_ready: boolean | null;
  visit_type: string | null;
}

export type VisitOutcome = 'seen' | 'no_show' | 'cancelled' | 'not_marked' | 'still_to_come';

export const VISIT_OUTCOMES: readonly VisitOutcome[] = ['seen', 'no_show', 'cancelled', 'not_marked', 'still_to_come'];

export const OUTCOME_LABELS: Record<VisitOutcome, string> = {
  seen: 'Seen',
  no_show: 'No-shows',
  cancelled: 'Cancelled',
  not_marked: 'Not marked',
  still_to_come: 'Still to come'
};

/** Where a visit ended up (the diary report's rule); bookings not seen yet are split into past and today */
export function visitOutcome(visit: AnalyticsVisitRow, todayKey: string): VisitOutcome {
  const outcome = reportOutcome(visit);
  if (outcome !== 'upcoming') return outcome;
  return visitDay(visit) < todayKey ? 'not_marked' : 'still_to_come';
}

/** A line of a breakdown: what it is and the visits it counts (its number is ids.length) */
export interface CountedGroup {
  key: string;
  label: string;
  ids: string[];
}

/** One bar of the visits chart: a day, or a week (Monday to Sunday, cut to the period) */
export interface VisitBucket {
  from: string;
  /** The same as from for a day */
  to: string;
  ids: string[];
}

export interface VisitFigures {
  range: PeriodRange;
  /** Every visit of the period */
  ids: string[];
  outcomes: Record<VisitOutcome, string[]>;
  unit: 'day' | 'week';
  buckets: VisitBucket[];
  byPractitioner: CountedGroup[];
  byVisitType: CountedGroup[];
}

/** Periods up to this many days get a bar per day; longer ones a bar per week */
export const MAX_DAY_BARS = 31;

export interface PractitionerName {
  id: string;
  full_name?: string | null;
}

/** `staff` null: the practice's staff list could not be read, so no name is known */
export function practitionerLabel(id: string | null, staff: readonly PractitionerName[] | null): string {
  if (!id) return 'No practitioner chosen';
  if (!staff) return 'Practitioner (name not loaded)';
  return staff.find((member) => member.id === id)?.full_name?.trim() || 'Former practitioner';
}

/** The diary's name for a visit type; a type the diary does not know keeps its own words */
export function visitTypeName(type: string | null): string {
  const text = (type ?? '').trim();
  const key = text.toLowerCase();
  return isVisitType(key) ? VISIT_TYPE_LABELS[key] : text || 'Type not recorded';
}

function groupVisits(
  rows: readonly AnalyticsVisitRow[],
  keyOf: (row: AnalyticsVisitRow) => string,
  labelOf: (row: AnalyticsVisitRow) => string
): CountedGroup[] {
  const groups = new Map<string, CountedGroup>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key) ?? { key, label: labelOf(row), ids: [] };
    group.ids.push(row.id);
    groups.set(key, group);
  }
  // Busiest first; equal ones by name, so the order does not jump between loads
  return [...groups.values()].sort((a, b) => b.ids.length - a.ids.length || a.label.localeCompare(b.label));
}

function bucketsOf(days: readonly string[], unit: VisitFigures['unit']): VisitBucket[] {
  if (unit === 'day') return days.map((day) => ({ from: day, to: day, ids: [] }));
  const weeks = new Map<string, VisitBucket>();
  const first = days[0];
  const last = days[days.length - 1];
  for (const day of days) {
    const week = weekBounds(day);
    if (!weeks.has(week.from)) {
      weeks.set(week.from, { from: week.from < first ? first : week.from, to: week.to > last ? last : week.to, ids: [] });
    }
  }
  return [...weeks.values()];
}

/** The figures of the Visits view, from the period's visits and the practice's staff (for names). */
export function summariseVisits(
  rows: readonly AnalyticsVisitRow[],
  range: PeriodRange,
  todayKey: string,
  staff: readonly PractitionerName[] | null
): VisitFigures {
  const days = daysOf(range);
  const inPeriod = rows.filter((row) => {
    const day = visitDay(row);
    return day >= range.from && day <= range.to;
  });

  const outcomes = { seen: [], no_show: [], cancelled: [], not_marked: [], still_to_come: [] } as Record<VisitOutcome, string[]>;
  for (const row of inPeriod) outcomes[visitOutcome(row, todayKey)].push(row.id);

  const unit = days.length <= MAX_DAY_BARS ? 'day' : 'week';
  const buckets = bucketsOf(days, unit);
  for (const row of inPeriod) {
    const day = visitDay(row);
    buckets.find((bucket) => day >= bucket.from && day <= bucket.to)?.ids.push(row.id);
  }

  return {
    range,
    ids: inPeriod.map((row) => row.id),
    outcomes,
    unit,
    buckets,
    byPractitioner: groupVisits(inPeriod, (row) => row.doctor_id ?? '', (row) => practitionerLabel(row.doctor_id, staff)),
    byVisitType: groupVisits(inPeriod, (row) => visitTypeName(row.visit_type), (row) => visitTypeName(row.visit_type))
  };
}

/** A bar's name in full: "Tue 7 Oct 2026", or a week's days "6-12 Oct 2026" */
export function bucketTitle(bucket: Pick<VisitBucket, 'from' | 'to'>, unit: VisitFigures['unit']): string {
  if (unit === 'week') return formatDiaryDateRange(bucket.from, bucket.to);
  const day = parseDateKey(bucket.from);
  return day ? format(day, 'EEE d MMM yyyy') : bucket.from;
}

/** An invoice line with its codes, and the visit of its invoice */
export interface DiagnosisLineRow {
  icd10_primary: string | null;
  icd10_secondary: string[] | null;
  invoice: { visit_id: string | null; payment_status: string | null } | null;
}

export interface DiagnosisCount {
  code: string;
  visitIds: string[];
}

export const TOP_DIAGNOSES = 10;

/** The codes billed most often: how many visits carried each, most first (a visit counts once per code). */
export function topDiagnoses(lines: readonly DiagnosisLineRow[], limit = TOP_DIAGNOSES): DiagnosisCount[] {
  const visitsByCode = new Map<string, Set<string>>();
  for (const line of lines) {
    const visitId = line.invoice?.visit_id;
    // A cancelled invoice billed nothing
    if (!visitId || (line.invoice?.payment_status ?? '').trim().toLowerCase() === 'cancelled') continue;
    const codes = [line.icd10_primary, ...(line.icd10_secondary ?? [])]
      .map((code) => (code ?? '').trim().toUpperCase())
      .filter(Boolean);
    for (const code of new Set(codes)) {
      const visits = visitsByCode.get(code) ?? new Set<string>();
      visits.add(visitId);
      visitsByCode.set(code, visits);
    }
  }
  return [...visitsByCode.entries()]
    .map(([code, visits]) => ({ code, visitIds: [...visits] }))
    .sort((a, b) => b.visitIds.length - a.visitIds.length || a.code.localeCompare(b.code))
    .slice(0, limit);
}

/** Another visit of the same patient, to see whether they came back */
export interface PatientVisitRow {
  id: string;
  scheduled_date: string | null;
  visit_date: string | null;
  status: string | null;
  is_cancelled: boolean | null;
  is_checked_in?: boolean | null;
  is_ready?: boolean | null;
}

export interface FollowUpVisitRow extends AnalyticsVisitRow {
  follow_up_date: string | null;
  patient: { first_name: string | null; last_name: string | null; visits: PatientVisitRow[] | null } | null;
}

export interface DueFollowUp {
  /** The visit that asked for the follow-up */
  visitId: string;
  patientId: string;
  patientName: string;
  /** The follow-up date */
  dueOn: string;
  /** The day of the visit that asked for it */
  seenOn: string;
  practitionerId: string | null;
  /** 0: due today */
  daysOverdue: number;
}

const patientName = (patient: FollowUpVisitRow['patient']): string =>
  [patient?.first_name, patient?.last_name].filter(Boolean).join(' ').trim() || 'Patient without a name';

const daysBetween = (fromKey: string, toKey: string): number => {
  const utc = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
  return Math.round((utc(toKey) - utc(fromKey)) / 86_400_000);
};

/** Patients to call back: most overdue first, one line per patient. */
export function followUpsDue(rows: readonly FollowUpVisitRow[], range: PeriodRange, todayKey: string): DueFollowUp[] {
  const due = new Map<string, DueFollowUp>();
  for (const row of rows) {
    const dueOn = (row.follow_up_date ?? '').slice(0, 10);
    if (!row.patient_id || !dueOn || dueOn < range.from || dueOn > todayKey) continue;
    // Only a visit that took place can ask the patient to come back
    if (reportOutcome(row) !== 'seen') continue;
    const seenOn = visitDay(row);
    // Seen or booked again since then (a no-show or a cancelled booking is not coming back)
    const cameBack = (row.patient?.visits ?? []).some((other) => {
      if (other.id === row.id || visitDay(other) <= seenOn) return false;
      const outcome = reportOutcome(other);
      return outcome === 'seen' || outcome === 'upcoming';
    });
    if (cameBack) continue;
    const item: DueFollowUp = {
      visitId: row.id,
      patientId: row.patient_id,
      patientName: patientName(row.patient),
      dueOn,
      seenOn,
      practitionerId: row.doctor_id,
      daysOverdue: daysBetween(dueOn, todayKey)
    };
    // Two visits on one day that both ask for a follow-up are still one call
    const current = due.get(row.patient_id);
    if (!current || item.dueOn < current.dueOn) due.set(row.patient_id, item);
  }
  return [...due.values()].sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.patientName.localeCompare(b.patientName));
}
