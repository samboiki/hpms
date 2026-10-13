/**
 * Dental lab orders (parity N5, R36): work a practice sends to a dental laboratory for a patient (a crown, a bridge, a
 * denture ...), on which teeth or which jaw, in which shade, with the lab and its dates, and the steps the work goes
 * through: at the lab -> back from the lab -> fitted, sent back to be remade (with why) or cancelled (with why). The
 * database allows the same steps and checks the same limits (dental_lab_order_save and dental_lab_order_set_status in
 * proposals/2026-10-13-dental-lab-work.sql). The lab's own invoice lines, billed under 8099, are in labSlips.ts.
 * Dental practices only (isDentalPractice). Pure; tested in __tests__/labOrders.test.ts.
 */
import { isValidFdiTooth } from '../billing/pricing';
import { addDaysToKey, daysBetweenKeys, isValidDateKey } from '../billing/dates';

export type DentalLabStatus = 'sent' | 'received' | 'fitted' | 'remake' | 'cancelled';
export const DENTAL_LAB_STATUSES: readonly DentalLabStatus[] = ['sent', 'received', 'fitted', 'remake', 'cancelled'];

export const DENTAL_LAB_STATUS_LABELS: Readonly<Record<DentalLabStatus, string>> = {
  sent: 'At the lab',
  received: 'Back from the lab',
  fitted: 'Fitted',
  remake: 'Sent back to be remade',
  cancelled: 'Cancelled'
};

/** The button that moves an order to each status */
export const DENTAL_LAB_STATUS_ACTIONS: Readonly<Record<DentalLabStatus, string>> = {
  sent: 'Sent',
  received: 'Back from the lab',
  fitted: 'Fitted',
  remake: 'Send back to be remade',
  cancelled: 'Cancel order'
};

/**
 * The steps an order may take. Work comes back from the lab and is fitted; work that does not fit goes back to be
 * remade (also after fitting, when it fails), and a remake comes back like the first work did. Only work still at the
 * lab can be cancelled: what came back has been made and is charged.
 */
export const NEXT_DENTAL_LAB_STATUSES: Readonly<Record<DentalLabStatus, readonly DentalLabStatus[]>> = {
  sent: ['received', 'cancelled'],
  received: ['fitted', 'remake'],
  fitted: ['remake'],
  remake: ['received', 'cancelled'],
  cancelled: []
};

export const canMoveDentalLabOrder = (from: DentalLabStatus, to: DentalLabStatus): boolean => NEXT_DENTAL_LAB_STATUSES[from].includes(to);
/** A remake or a cancellation says why (the lab, the patient file and the tracking need it) */
export const dentalLabStatusNeedsReason = (to: DentalLabStatus): boolean => to === 'remake' || to === 'cancelled';
/** The work is at the lab: sent, or sent back to be remade */
export const isAtLab = (status: DentalLabStatus): boolean => status === 'sent' || status === 'remake';
/** Still in the practice's hands: not fitted and not cancelled */
export const isOpenDentalLabOrder = (status: DentalLabStatus): boolean => status !== 'fitted' && status !== 'cancelled';

export type DentalLabWork =
  | 'crown'
  | 'bridge'
  | 'veneer'
  | 'inlay_onlay'
  | 'implant_crown'
  | 'full_denture'
  | 'partial_denture'
  | 'denture_repair'
  | 'night_guard'
  | 'orthodontic'
  | 'other';

export const DENTAL_LAB_WORKS: readonly DentalLabWork[] = [
  'crown',
  'bridge',
  'veneer',
  'inlay_onlay',
  'implant_crown',
  'full_denture',
  'partial_denture',
  'denture_repair',
  'night_guard',
  'orthodontic',
  'other'
];

export const DENTAL_LAB_WORK_LABELS: Readonly<Record<DentalLabWork, string>> = {
  crown: 'Crown',
  bridge: 'Bridge',
  veneer: 'Veneer',
  inlay_onlay: 'Inlay or onlay',
  implant_crown: 'Crown on an implant',
  full_denture: 'Full denture',
  partial_denture: 'Partial denture',
  denture_repair: 'Denture repair or reline',
  night_guard: 'Night guard or splint',
  orthodontic: 'Orthodontic appliance',
  other: 'Other (say in the notes)'
};

/** Work made for teeth: the lab needs the tooth numbers; a bridge spans at least two. */
const TOOTH_WORK: readonly DentalLabWork[] = ['crown', 'bridge', 'veneer', 'inlay_onlay', 'implant_crown'];
export const workNeedsTeeth = (work: DentalLabWork | ''): boolean => work !== '' && TOOTH_WORK.includes(work);
export const minimumTeeth = (work: DentalLabWork | ''): number => (work === 'bridge' ? 2 : workNeedsTeeth(work) ? 1 : 0);

export type Jaw = 'upper' | 'lower' | 'both';
export const JAWS: readonly Jaw[] = ['upper', 'lower', 'both'];
export const JAW_LABELS: Readonly<Record<Jaw, string>> = { upper: 'Upper jaw', lower: 'Lower jaw', both: 'Both jaws' };

/** A shade is short ("A2", "A3.5", "2M2"); notes are what the lab must know. The database has the same limits. */
export const SHADE_MAX = 20;
export const NOTES_MAX = 500;
export const REASON_MAX = 200;
export const MAX_ORDER_TEETH = 32;

/** Teeth once each, in FDI order (11 ... 18, 21 ... 28, ...): the order the lab and the slip read them in. */
export const sortedTeeth = (teeth: readonly string[]): string[] =>
  [...new Set(teeth.map(tooth => tooth.trim()).filter(Boolean))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));

export interface DentalLabOrderDraft {
  workType: DentalLabWork | '';
  teeth: string[];
  jaw: Jaw | '';
  shade: string;
  notes: string;
  supplierId: string;
  sentOn: string;
  dueOn: string;
}

export type DentalLabOrderDraftErrors = Partial<Record<keyof DentalLabOrderDraft, string>>;

export const emptyDentalLabOrderDraft = (today: string, teeth: readonly string[] = []): DentalLabOrderDraft => ({
  workType: '',
  teeth: sortedTeeth(teeth),
  jaw: '',
  shade: '',
  notes: '',
  supplierId: '',
  sentOn: today,
  dueOn: ''
});

/**
 * Checks the order form and builds the dental_lab_order_save payload. The lab makes the work for the teeth or the jaw
 * named, so an order names at least one of them, and work made for teeth names its teeth; the dates say when it went
 * and when the lab promised it back (never before it went).
 */
export function validateDentalLabOrderDraft(
  draft: DentalLabOrderDraft,
  context: { today: string }
): { ok: true; payload: Record<string, unknown> } | { ok: false; errors: DentalLabOrderDraftErrors } {
  const errors: DentalLabOrderDraftErrors = {};
  if (!draft.workType) errors.workType = 'Choose the work the lab makes.';
  const teeth = sortedTeeth(draft.teeth);
  const notTeeth = teeth.filter(tooth => !isValidFdiTooth(tooth));
  if (notTeeth.length > 0) errors.teeth = `${notTeeth.join(', ')} ${notTeeth.length === 1 ? 'is not a tooth' : 'are not teeth'} (FDI 11-48, or 51-85 for milk teeth).`;
  else if (teeth.length > MAX_ORDER_TEETH) errors.teeth = `At most ${MAX_ORDER_TEETH} teeth.`;
  else if (draft.workType && teeth.length < minimumTeeth(draft.workType)) {
    errors.teeth = draft.workType === 'bridge' ? 'A bridge spans at least two teeth: choose them all.' : `Choose the tooth for the ${DENTAL_LAB_WORK_LABELS[draft.workType].toLowerCase()}.`;
  } else if (teeth.length === 0 && !draft.jaw) errors.teeth = 'Choose the teeth or the jaw the work is for.';
  if (draft.shade.trim().length > SHADE_MAX) errors.shade = `Keep the shade to ${SHADE_MAX} characters, e.g. A2.`;
  if (draft.notes.trim().length > NOTES_MAX) errors.notes = `Keep the notes to ${NOTES_MAX} characters.`;
  if (!isValidDateKey(draft.sentOn)) errors.sentOn = 'Choose the day it went to the lab.';
  else if (draft.sentOn > context.today) errors.sentOn = 'The day it went to the lab cannot be in the future.';
  if (draft.dueOn) {
    if (!isValidDateKey(draft.dueOn)) errors.dueOn = 'Choose a date.';
    else if (isValidDateKey(draft.sentOn) && draft.dueOn < draft.sentOn) errors.dueOn = 'The lab cannot have it back before it went.';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const optional = (value: string): string | null => (value.trim() ? value.trim() : null);
  return {
    ok: true,
    payload: {
      work_type: draft.workType,
      teeth,
      jaw: draft.jaw || null,
      shade: optional(draft.shade),
      notes: optional(draft.notes),
      supplier_id: optional(draft.supplierId),
      sent_on: draft.sentOn,
      due_on: optional(draft.dueOn)
    }
  };
}

/** "Crown on 11", "Bridge on 14, 15, 16", "Full denture, upper jaw", "Partial denture on 36, 46, lower jaw" */
export function describeLabWork(order: { workType: DentalLabWork; teeth: readonly string[]; jaw: Jaw | null }): string {
  const work = order.workType === 'other' ? 'Lab work' : DENTAL_LAB_WORK_LABELS[order.workType];
  const teeth = sortedTeeth(order.teeth);
  const onTeeth = teeth.length > 0 ? ` on ${teeth.join(', ')}` : '';
  const jaw = order.jaw ? `, ${JAW_LABELS[order.jaw].toLowerCase()}` : '';
  return `${work}${onTeeth}${jaw}`;
}

// ---------------------------------------------------------------------------------------------------
// When it is due
// ---------------------------------------------------------------------------------------------------

/** For work at the lab: past the date the lab promised, due today, due within two days, later, or no date given. */
export type DueState = 'overdue' | 'due_today' | 'due_soon' | 'later' | 'no_date';
export const DUE_SOON_DAYS = 2;

export function dueState(order: { status: DentalLabStatus; dueOn: string | null }, today: string): DueState | null {
  if (!isAtLab(order.status)) return null;
  if (!order.dueOn || !isValidDateKey(order.dueOn) || !isValidDateKey(today)) return 'no_date';
  if (order.dueOn < today) return 'overdue';
  if (order.dueOn === today) return 'due_today';
  return order.dueOn <= addDaysToKey(today, DUE_SOON_DAYS) ? 'due_soon' : 'later';
}

/** Whole days past the due date (0 when not late). */
export const daysLate = (dueOn: string | null, today: string): number =>
  dueOn && isValidDateKey(dueOn) && isValidDateKey(today) ? Math.max(0, daysBetweenKeys(dueOn, today)) : 0;

/** Days an open order has waited in its step (at the lab, or back and waiting to be fitted). */
export function daysInStep(status: DentalLabStatus, statusOn: string, today: string): number | null {
  if (!isOpenDentalLabOrder(status) || !isValidDateKey(statusOn) || !isValidDateKey(today)) return null;
  return Math.max(0, daysBetweenKeys(statusOn, today));
}

// ---------------------------------------------------------------------------------------------------
// Across the practice (R36): what is out, due or overdue, by lab
// ---------------------------------------------------------------------------------------------------

export interface TrackableOrder {
  id: string;
  orderNo: number;
  status: DentalLabStatus;
  sentOn: string;
  dueOn: string | null;
  supplierId: string | null;
  labName: string | null;
}

export interface TrackingCounts {
  /** At the lab (sent or being remade) */
  atLab: number;
  overdue: number;
  dueToday: number;
  /** Back from the lab, waiting to be fitted */
  back: number;
}

export interface LabGroup<T extends TrackableOrder> {
  /** The supplier id, or '' for orders without a lab named */
  key: string;
  labName: string;
  orders: T[];
  counts: TrackingCounts;
}

export const NO_LAB_NAME = 'Lab not named';

export function trackingCounts(orders: readonly TrackableOrder[], today: string): TrackingCounts {
  const counts: TrackingCounts = { atLab: 0, overdue: 0, dueToday: 0, back: 0 };
  for (const order of orders) {
    if (order.status === 'received') counts.back += 1;
    if (!isAtLab(order.status)) continue;
    counts.atLab += 1;
    const state = dueState(order, today);
    if (state === 'overdue') counts.overdue += 1;
    if (state === 'due_today') counts.dueToday += 1;
  }
  return counts;
}

/** Most urgent first: overdue (longest late first), due today, due soon, later, no date; then back from the lab. */
const urgency = (order: TrackableOrder, today: string): number => {
  const state = dueState(order, today);
  return state === 'overdue' ? 0 : state === 'due_today' ? 1 : state === 'due_soon' ? 2 : state === 'later' ? 3 : state === 'no_date' ? 4 : 5;
};

export function sortByUrgency<T extends TrackableOrder>(orders: readonly T[], today: string): T[] {
  return [...orders].sort(
    (a, b) =>
      urgency(a, today) - urgency(b, today) ||
      (a.dueOn ?? '9999-12-31').localeCompare(b.dueOn ?? '9999-12-31') ||
      a.sentOn.localeCompare(b.sentOn) ||
      a.orderNo - b.orderNo
  );
}

/**
 * The open orders by lab: each lab with its orders most urgent first and its counts; labs with overdue work first,
 * then by name, and orders without a lab named last.
 */
export function groupByLab<T extends TrackableOrder>(orders: readonly T[], today: string): LabGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const order of orders.filter(item => isOpenDentalLabOrder(item.status))) {
    const key = order.supplierId ?? '';
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      labName: key ? items.find(item => item.labName)?.labName ?? 'Lab' : NO_LAB_NAME,
      orders: sortByUrgency(items, today),
      counts: trackingCounts(items, today)
    }))
    .sort((a, b) => Number(a.key === '') - Number(b.key === '') || Number(b.counts.overdue > 0) - Number(a.counts.overdue > 0) || a.labName.localeCompare(b.labName));
}
