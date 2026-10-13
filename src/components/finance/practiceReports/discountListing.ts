/**
 * Discounts given (parity R3; Eminance's discount listing): every discount of a period, per practitioner and per
 * reason. Two kinds count:
 * - a discount given on an invoice (invoice_adjustments kind 'discount', DS-000001): its own entry, with a reason from
 *   the list, the percentage when it was given as one, and who gave it; taken-back discounts are not listed;
 * - a private patient's line discount typed while billing (invoice_services.discount_amount): no reason was asked, so
 *   it says so; the invoice's date is its day. A line discount a promotion put on (invoice_services.promotion_id,
 *   proposals/2026-10-13-billing-extras.sql) is listed under the promotion's name instead.
 * A discount counts for the invoice's practitioner (a line discount: the line's practitioner, else the invoice's), and
 * each row opens its invoice. Amounts are whole cents.
 */
import {
  discountReasonLabel,
  discountReasonText,
  isDiscountReason,
  percentText,
  toCents,
  type ArAdjustment,
  type DiscountReason
} from '../../../services/ledgerService';
import type { CsvCell } from '../financeExport';
import { staffName, type LinkedReport, type StaffNames } from './reportTargets';

export interface DiscountItem {
  key: string;
  source: 'invoice' | 'line';
  /** yyyy-MM-dd */
  dateKey: string;
  /** DS-000001; null for a line's own discount */
  number: string | null;
  invoiceId: string;
  invoiceNumber: string;
  patientId: string | null;
  practitionerId: string | null;
  /** null for a line's own discount (no reason was asked) */
  reasonCode: DiscountReason | null;
  reasonText: string;
  percent: number | null;
  /** Who gave it; null for a line's own discount (not recorded) */
  givenBy: string | null;
  /** The tariff code of a line discount */
  code: string | null;
  /** The promotion a line discount came from; null otherwise */
  promotionId: string | null;
  cents: number;
}

/** The invoice a discount is on, as the report needs it */
export interface DiscountInvoice {
  id: string;
  invoiceNumber: string;
  patientId: string | null;
  practitionerId: string | null;
}

/** A line with a discount, with its invoice (invoice_services joined to invoices_enhanced) */
export interface RawLineDiscountRow {
  id: string;
  code: string | null;
  discount_amount: number | string | null;
  practitioner_id: string | null;
  /** Absent before proposals/2026-10-13-billing-extras.sql */
  promotion_id?: string | null;
  invoice: {
    id: string;
    invoice_number: string | null;
    patient_id: string | null;
    practitioner_id: string | null;
    payment_status: string | null;
    issue_date: string | null;
  } | null;
}

/** No reason was asked for a line discount: the report's notes say so */
export const LINE_DISCOUNT_REASON = 'Line discount while billing';
/** Group keys besides a practitioner's user id or a reason code */
export const NO_PRACTITIONER = 'none';
export const LINE_REASON = 'line';
/** A promotion's discounts group under "promotion:<id>" */
const PROMOTION_KEY = 'promotion:';

/** "Promotion: Spring smile" */
export const promotionReason = (promotionId: string, promotionNames: Readonly<Record<string, string>> = {}): string =>
  `Promotion: ${promotionNames[promotionId] ?? 'no longer on the list'}`;

const CANCELLED = ['cancelled', 'canceled', 'void', 'voided'];

/** A discount given on an invoice; null when it is not one (or was taken back) */
export function discountFromAdjustment(adjustment: ArAdjustment, invoice: DiscountInvoice | undefined): DiscountItem | null {
  if (adjustment.kind !== 'discount' || adjustment.reversal || !adjustment.invoiceId || !adjustment.effectiveOn) return null;
  return {
    key: `invoice:${adjustment.id}`,
    source: 'invoice',
    dateKey: adjustment.effectiveOn,
    number: adjustment.number,
    invoiceId: adjustment.invoiceId,
    invoiceNumber: invoice?.invoiceNumber ?? adjustment.invoiceId.slice(0, 8),
    patientId: adjustment.patientId ?? invoice?.patientId ?? null,
    practitionerId: invoice?.practitionerId ?? null,
    reasonCode: isDiscountReason(adjustment.reasonCode) ? adjustment.reasonCode : null,
    reasonText: discountReasonText(adjustment),
    percent: adjustment.percent ?? null,
    givenBy: adjustment.createdBy,
    code: null,
    promotionId: null,
    cents: adjustment.amountCents
  };
}

/**
 * A private patient's line discount; null when there is none or the invoice is cancelled. A promotion's discount is
 * named after the promotion (`promotionNames`: id -> name).
 */
export function discountFromLine(row: RawLineDiscountRow, promotionNames: Readonly<Record<string, string>> = {}): DiscountItem | null {
  const invoice = row.invoice;
  const cents = toCents(row.discount_amount);
  if (!invoice || cents <= 0 || !invoice.issue_date) return null;
  if (CANCELLED.includes((invoice.payment_status ?? '').trim().toLowerCase())) return null;
  const promotionId = row.promotion_id?.trim() || null;
  return {
    key: `line:${row.id}`,
    source: 'line',
    dateKey: invoice.issue_date.slice(0, 10),
    number: null,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number?.trim() || invoice.id.slice(0, 8),
    patientId: invoice.patient_id,
    practitionerId: row.practitioner_id ?? invoice.practitioner_id,
    reasonCode: null,
    reasonText: promotionId ? promotionReason(promotionId, promotionNames) : LINE_DISCOUNT_REASON,
    percent: null,
    givenBy: null,
    code: row.code?.trim() || null,
    promotionId,
    cents
  };
}

export const practitionerKey = (item: Pick<DiscountItem, 'practitionerId'>): string => item.practitionerId ?? NO_PRACTITIONER;
export const reasonKey = (item: Pick<DiscountItem, 'reasonCode' | 'source'> & Partial<Pick<DiscountItem, 'promotionId'>>): string =>
  item.source === 'line' ? (item.promotionId ? `${PROMOTION_KEY}${item.promotionId}` : LINE_REASON) : item.reasonCode ?? 'other';

export const practitionerKeyLabel = (key: string, names: StaffNames): string =>
  key === NO_PRACTITIONER ? 'No practitioner recorded' : staffName(key, names, 'Practitioner not on the staff list');
export const reasonKeyLabel = (key: string, promotionNames: Readonly<Record<string, string>> = {}): string =>
  key === LINE_REASON
    ? LINE_DISCOUNT_REASON
    : key.startsWith(PROMOTION_KEY)
      ? promotionReason(key.slice(PROMOTION_KEY.length), promotionNames)
      : discountReasonLabel(key);

export interface DiscountGroup {
  key: string;
  count: number;
  cents: number;
}

/** Discounts per group, the largest first */
export function groupDiscounts(items: readonly DiscountItem[], keyOf: (item: DiscountItem) => string): DiscountGroup[] {
  const groups = new Map<string, DiscountGroup>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? { key, count: 0, cents: 0 };
    group.count += 1;
    group.cents += item.cents;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.cents - a.cents || a.key.localeCompare(b.key));
}

const amount = (cents: number): number => cents / 100;

export const DISCOUNT_NOTES = [
  'A discount given on an invoice comes off what the patient pays; the medical aid is claimed as billed. Discounts that were taken back are not listed.',
  'A line discount was typed while billing a private patient: no reason was asked for it. Each discount counts for the invoice\'s practitioner (a line discount for the line\'s).',
  'A promotion\'s discount was put on a private patient\'s line while billing, between the promotion\'s first and last day; it is listed under the promotion\'s name.'
];

/** One row per practitioner or per reason; a row filters the list */
export function discountGroupTable(input: {
  groups: readonly DiscountGroup[];
  title: string;
  header: string;
  label: (key: string) => string;
  periodLabel: string;
}): LinkedReport & { keys: string[] } {
  const total = input.groups.reduce((sum, group) => ({ count: sum.count + group.count, cents: sum.cents + group.cents }), { count: 0, cents: 0 });
  return {
    table: {
      title: input.title,
      basis: `Discounts dated ${input.periodLabel}`,
      columns: [
        { header: input.header, type: 'text' },
        { header: 'Discounts', type: 'count' },
        { header: 'Amount', type: 'money' }
      ],
      rows: input.groups.map(group => [input.label(group.key), group.count, amount(group.cents)] as CsvCell[]),
      totals: ['Total', total.count, amount(total.cents)],
      notes: DISCOUNT_NOTES
    },
    targets: input.groups.map(() => null),
    keys: input.groups.map(group => group.key)
  };
}

/** Every discount: day, discount, invoice, patient, practitioner, reason, percentage, who gave it and the amount; each opens its invoice */
export function discountListTable(items: readonly DiscountItem[], periodLabel: string, names: StaffNames, patientNames: Readonly<Record<string, string>>): LinkedReport {
  const sorted = [...items].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.invoiceNumber.localeCompare(b.invoiceNumber) || a.key.localeCompare(b.key));
  return {
    table: {
      title: 'Discounts given',
      basis: `Discounts dated ${periodLabel}`,
      columns: [
        { header: 'Day', type: 'date' },
        { header: 'Discount', type: 'text' },
        { header: 'Invoice', type: 'text' },
        { header: 'Patient', type: 'text' },
        { header: 'Practitioner', type: 'text' },
        { header: 'Reason', type: 'text' },
        { header: 'Percentage', type: 'text' },
        { header: 'Given by', type: 'text' },
        { header: 'Amount', type: 'money' }
      ],
      rows: sorted.map(item => [
        item.dateKey,
        item.number ?? `Line${item.code ? ` ${item.code}` : ''}`,
        item.invoiceNumber,
        (item.patientId && patientNames[item.patientId]) || 'Patient not found',
        practitionerKeyLabel(practitionerKey(item), names),
        item.reasonText,
        item.percent !== null ? percentText(item.percent) : '',
        item.givenBy ? staffName(item.givenBy, names) : 'Not recorded',
        amount(item.cents)
      ] as CsvCell[]),
      totals: ['Total', `${sorted.length}`, '', '', '', '', '', '', amount(sorted.reduce((sum, item) => sum + item.cents, 0))],
      notes: DISCOUNT_NOTES
    },
    targets: sorted.map(item => ({ kind: 'invoice' as const, id: item.invoiceId })),
    names: sorted.map(item => item.invoiceNumber)
  };
}
