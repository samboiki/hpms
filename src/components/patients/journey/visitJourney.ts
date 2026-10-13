/**
 * What a visit card on the patient journey (patient file > Encounters) shows and offers, as pure
 * rules: the date day first, a status in plain words, counts of what the visit holds, its bill and
 * which actions appear. JourneyVisitCard only lays these out.
 */
import { formatServiceDate, toDateKey, todayKey } from '../../../utils/billing/dates';
import { formatNad, fromCents, sumCents, toCents } from '../../../utils/billing/money';
import { isVisitType, VISIT_TYPE_LABELS } from '../../../utils/diary/bookingLength';
import { checkBloodPressure } from '../../../utils/vitalSigns';
import { getVisitStage, type VisitStageFields } from '../../../utils/visitStage';
import type { PatientInvoice } from '../patientBilling';

/** Tabs of the visit screen (FullScreenEditVisitModal) that a card action opens */
export type VisitQuickTab = 'media' | 'laboratory' | 'imaging' | 'leave' | 'billing' | 'medications';

/** What a visit's tabs list, counted per visit when the patient file loads (fetchPatientDetailsOptimized) */
export interface VisitRecordCounts {
  media: number;
  lab: number;
  imaging: number;
}

export interface JourneyVitals {
  blood_pressure?: string | null;
  created_at?: string | null;
}

/** The visit fields a journey card reads (the patient file passes fuller rows) */
export interface JourneyVisit extends VisitStageFields {
  id: string;
  visit_date?: string | null;
  visit_time?: string | null;
  /** Bookings made outside the visit form may only carry these */
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  visit_number?: number | null;
  visit_type?: string | null;
  chief_complaint?: string | null;
  diagnosis?: string | null;
  treatment_plan?: string | null;
  doctor_name?: string | null;
  doctor?: { full_name?: string | null } | null;
  medications?: readonly unknown[] | null;
  lab_requests?: readonly unknown[] | null;
  /** One row per reading (a visit can have several); older callers passed a single object */
  vitals?: JourneyVitals | readonly JourneyVitals[] | null;
}

/** The visit's calendar date ('yyyy-MM-dd'): the visit date, else the booking date */
export const visitDateKey = (visit: JourneyVisit): string | null =>
  toDateKey(visit.visit_date ?? null) ?? toDateKey(visit.scheduled_date ?? null);

/** "08:30" from "08:30:00"; null when no time was recorded */
export function visitTimeLabel(visit: JourneyVisit): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec((visit.visit_time || visit.scheduled_time || '').trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** "9 Oct 2026, 08:30": day first and 24-hour, as Namibian staff write it */
export function formatVisitWhen(visit: JourneyVisit): string {
  const key = visitDateKey(visit);
  if (!key) return 'Date not recorded';
  const time = visitTimeLabel(visit);
  return time ? `${formatServiceDate(key)}, ${time}` : formatServiceDate(key);
}

/** The same moment in machine-readable form, for <time dateTime> */
export function visitDateTimeAttribute(visit: JourneyVisit): string | undefined {
  const key = visitDateKey(visit);
  if (!key) return undefined;
  const time = visitTimeLabel(visit);
  return time ? `${key}T${time}` : key;
}

/** "Consultation", "Follow-up" (the diary's names for the visit types); "Visit" when none was recorded */
export function visitTypeLabel(type?: string | null): string {
  const text = (type ?? '').trim();
  if (!text) return 'Visit';
  const key = text.toLowerCase();
  if (isVisitType(key)) return VISIT_TYPE_LABELS[key];
  return text.replace(/[-_]/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

/**
 * The card is headed by why the patient came (the chief complaint), with the visit type under it.
 * A visit without a recorded reason is headed by its type alone.
 */
export function visitHeadline(visit: JourneyVisit): { title: string; type: string | null } {
  const type = visitTypeLabel(visit.visit_type);
  const reason = visit.chief_complaint?.trim();
  return reason ? { title: reason, type } : { title: type, type: null };
}

/** Newest first: by date, then time; visits without a date go last */
export function sortNewestFirst<V extends JourneyVisit>(visits: readonly V[]): V[] {
  return [...visits].sort((a, b) => {
    const dateA = visitDateKey(a);
    const dateB = visitDateKey(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    if (dateA !== dateB) return dateA < dateB ? 1 : -1;
    return (visitTimeLabel(b) ?? '00:00').localeCompare(visitTimeLabel(a) ?? '00:00');
  });
}

export type JourneyStatusKind = 'done' | 'pending' | 'scheduled' | 'cancelled' | 'no-show';

export interface JourneyStatus {
  kind: JourneyStatusKind;
  label: string;
}

const STATUS_LABELS: Record<JourneyStatusKind, string> = {
  done: 'Done',
  pending: 'Pending',
  scheduled: 'Scheduled',
  cancelled: 'Cancelled',
  'no-show': 'No-show'
};

/**
 * The visit's status in plain words, from its stage in the clinic flow (utils/visitStage): Done or
 * Pending, as staff read the journey; a booking still ahead is Scheduled; cancelled and missed
 * bookings say so (they used to read "Pending" and one click marked them done).
 */
export function journeyStatus(visit: JourneyVisit, today: string = todayKey()): JourneyStatus {
  const stage = getVisitStage(visit);
  const dateKey = visitDateKey(visit);
  let kind: JourneyStatusKind;
  if (stage === 'completed') kind = 'done';
  else if (stage === 'cancelled') kind = 'cancelled';
  else if (stage === 'no-show') kind = 'no-show';
  else if (stage === 'scheduled' && (dateKey === null || dateKey >= today)) kind = 'scheduled';
  else kind = 'pending';
  return { kind, label: STATUS_LABELS[kind] };
}

/**
 * "Mark as done" is offered while a visit is open: pending, or booked for today or earlier. Not for
 * a booking still ahead (nothing has happened yet), nor for cancelled or missed bookings, which the
 * visit screen restores first.
 */
export function canMarkDone(visit: JourneyVisit, today: string = todayKey()): boolean {
  const { kind } = journeyStatus(visit, today);
  if (kind === 'pending') return true;
  const dateKey = visitDateKey(visit);
  return kind === 'scheduled' && dateKey !== null && dateKey <= today;
}

export type VisitBillingLabel = 'Paid' | 'Part paid' | 'Unpaid' | 'Overdue';

export type VisitBilling =
  /** The patient's invoices have not loaded: say nothing rather than "Not billed" */
  | { state: 'unknown' }
  /** No bill, and none expected yet: the visit is not done */
  | { state: 'none' }
  /** A done visit with no bill */
  | { state: 'not-billed' }
  | { state: 'billed'; total: number; label: VisitBillingLabel; invoiceCount: number };

/**
 * The visit's bill: what its invoices add up to and whether they are paid, by the status rules of
 * the patient's Billing tab (patientBilling.ts). Cancelled invoices are void, so a visit whose only
 * invoice was cancelled has no bill; that is worth saying ("Not billed") only once the visit is done.
 * Overdue wins (it needs chasing); all paid is Paid; money received (a paid invoice or a part
 * payment) with more still owed is Part paid; otherwise Unpaid.
 */
export function visitBilling(visit: JourneyVisit, invoices?: readonly PatientInvoice[] | null, today: string = todayKey()): VisitBilling {
  if (!invoices) return { state: 'unknown' };
  const counted = invoices.filter((invoice) => invoice.visitId === visit.id && invoice.status !== 'cancelled');
  if (counted.length === 0) return journeyStatus(visit, today).kind === 'done' ? { state: 'not-billed' } : { state: 'none' };
  const total = fromCents(sumCents(counted.map((invoice) => toCents(invoice.total))));
  let label: VisitBillingLabel;
  if (counted.some((invoice) => invoice.status === 'overdue')) label = 'Overdue';
  else if (counted.every((invoice) => invoice.status === 'paid')) label = 'Paid';
  else if (counted.some((invoice) => invoice.status === 'paid' || invoice.partPaid)) label = 'Part paid';
  else label = 'Unpaid';
  return { state: 'billed', total, label, invoiceCount: counted.length };
}

/** What a screen reader says for the billing action, e.g. "Billing: N$ 450.00, unpaid" */
export function billingActionName(billing: VisitBilling): string {
  if (billing.state === 'billed') {
    const invoices = billing.invoiceCount > 1 ? ` (${billing.invoiceCount} invoices)` : '';
    return `Billing: ${formatNad(billing.total)}, ${billing.label.toLowerCase()}${invoices}`;
  }
  return billing.state === 'not-billed' ? 'Billing: not billed yet' : 'Billing';
}

/**
 * The card's main action is opening the visit. For a done visit with no bill it is billing it
 * instead: an unbilled visit is income the practice never collects.
 */
export const mainAction = (billing: VisitBilling): 'open' | 'billing' => (billing.state === 'not-billed' ? 'billing' : 'open');

export interface VisitRecords {
  medications: number;
  lab: number;
  imaging: number;
  media: number;
}

/**
 * How many medications, lab requests, imaging requests and media files the visit holds, as its tabs
 * list them. Medications come with the visit row; the per-visit counts give the rest, with the
 * visit row's lab requests standing in when the counts are missing.
 */
export function visitRecords(visit: JourneyVisit, counts?: Partial<VisitRecordCounts> | null): VisitRecords {
  return {
    medications: visit.medications?.length ?? 0,
    lab: counts?.lab ?? visit.lab_requests?.length ?? 0,
    imaging: counts?.imaging ?? 0,
    media: counts?.media ?? 0
  };
}

export interface RecordAction {
  tab: Extract<VisitQuickTab, 'medications' | 'laboratory' | 'imaging' | 'media'>;
  label: string;
  /** Solar bold-duotone icon: the one the visit screen's tab uses */
  icon: string;
  count: number;
  /** "2 lab requests" for screen readers; null when there are none */
  countText: string | null;
}

const countText = (count: number, one: string, many: string): string | null =>
  count > 0 ? `${count} ${count === 1 ? one : many}` : null;

/** The record shortcuts on every card, in a fixed order so each sits in the same place on every visit */
export function recordActions(records: VisitRecords): RecordAction[] {
  return [
    { tab: 'medications', label: 'Medications', icon: 'solar:pill-bold-duotone', count: records.medications, countText: countText(records.medications, 'medication', 'medications') },
    { tab: 'laboratory', label: 'Lab', icon: 'solar:test-tube-bold-duotone', count: records.lab, countText: countText(records.lab, 'lab request', 'lab requests') },
    { tab: 'imaging', label: 'Imaging', icon: 'solar:camera-bold-duotone', count: records.imaging, countText: countText(records.imaging, 'imaging request', 'imaging requests') },
    { tab: 'media', label: 'Media', icon: 'solar:gallery-bold-duotone', count: records.media, countText: countText(records.media, 'file', 'files') }
  ];
}

export type VisitMenuActionId = 'letters' | 'follow-up' | 'reopen';

export interface VisitMenuAction {
  id: VisitMenuActionId;
  label: string;
  icon: string;
}

/**
 * The less-used actions, one tap away under "More": letters (sick notes, referrals) on every visit;
 * a follow-up and reopening only once the visit is done.
 */
export function moreActions(visit: JourneyVisit, options: { canFollowUp: boolean }, today: string = todayKey()): VisitMenuAction[] {
  const done = journeyStatus(visit, today).kind === 'done';
  const actions: VisitMenuAction[] = [{ id: 'letters', label: 'Letters', icon: 'solar:document-text-bold-duotone' }];
  if (done && options.canFollowUp) actions.push({ id: 'follow-up', label: 'Create follow-up', icon: 'solar:calendar-add-bold-duotone' });
  if (done) actions.push({ id: 'reopen', label: 'Reopen visit', icon: 'solar:restart-bold-duotone' });
  return actions;
}

export interface VisitBloodPressure {
  reading: string;
  /** "128/82 mmHg" */
  text: string;
  high: boolean;
  /** The shared warning text (utils/vitalSigns) when high */
  message: string | null;
}

const isVitalsList = (vitals: JourneyVitals | readonly JourneyVitals[]): vitals is readonly JourneyVitals[] =>
  Array.isArray(vitals);

/** The visit's blood pressure (its latest reading) flagged by the shared limits; null when none was taken */
export function visitBloodPressure(vitals: JourneyVisit['vitals']): VisitBloodPressure | null {
  const rows: readonly JourneyVitals[] = !vitals ? [] : isVitalsList(vitals) ? vitals : [vitals];
  let latest: { reading: string; at: string } | null = null;
  for (const row of rows) {
    const reading = row.blood_pressure?.trim();
    if (!reading) continue;
    const at = row.created_at ?? '';
    if (!latest || at >= latest.at) latest = { reading, at };
  }
  if (!latest) return null;
  const check = checkBloodPressure(latest.reading);
  const text = /mmhg/i.test(latest.reading) ? latest.reading : `${latest.reading} mmHg`;
  return { reading: latest.reading, text, high: check.status === 'high', message: check.message };
}
