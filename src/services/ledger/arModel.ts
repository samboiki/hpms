import { hasAtMostDecimals, toCents as nadToCents } from '../../utils/billing/money';
import { toCents } from './money';
import { dateKeyFrom } from './dates';

// ---------------------------------------------------------------------------------------------
// Accounts receivable: receipts, allocations and invoice adjustments
// (tables and views in proposals/2026-10-07-receipts-and-allocations.sql)
//
// Every amount here is in whole cents (integers), so N$ 0.10 + N$ 0.20 is exactly N$ 0.30 and a
// limit check never fails by a fraction of a cent. Database numerics arrive as strings and are
// converted once, here.
// ---------------------------------------------------------------------------------------------

/** Who owes a part of an invoice: the medical aid fund or the patient */
export type Portion = 'medical_aid' | 'patient';
export const PORTIONS: readonly Portion[] = ['medical_aid', 'patient'];

export type PayerType = 'patient' | 'medical_aid' | 'other';

/**
 * Cash, card (the practice's own machine), EFT and medical aid are captured: patients pay on their own and reception
 * confirms it (owner, 13 Oct 2026: no debit orders, payment links or QR payments). Debit order, other and not_recorded
 * only come from older payments, and still show and count.
 */
export type ReceiptMethod = 'cash' | 'card' | 'eft' | 'medical_aid' | 'debit_order' | 'other' | 'not_recorded';
export const CAPTURE_METHODS: readonly ReceiptMethod[] = ['cash', 'card', 'eft', 'medical_aid'];
export type RefundMethod = 'cash' | 'card' | 'eft' | 'debit_order';
export const REFUND_METHODS: readonly RefundMethod[] = ['cash', 'eft', 'card'];

export type ReceiptSource = 'manual' | 'batch' | 'remittance_import' | 'status_bridge' | 'legacy_backfill';

/** discount: off the patient's portion only, with a reason (proposals/2026-10-13-discounts-and-statements.sql; discounts.ts) */
export type AdjustmentKind = 'credit_note' | 'write_off' | 'journal' | 'refund' | 'shortfall_transfer' | 'discount';

export type WriteOffReason = 'bad_debt' | 'small_balance' | 'scheme_rate' | 'claim_expired' | 'courtesy' | 'deceased' | 'other';
export const WRITE_OFF_REASONS: ReadonlyArray<{ code: WriteOffReason; label: string }> = [
  { code: 'small_balance', label: 'Small balance not worth collecting' },
  { code: 'scheme_rate', label: 'Medical aid paid its tariff (difference may not be billed)' },
  { code: 'claim_expired', label: 'Medical aid claim deadline missed' },
  { code: 'bad_debt', label: 'Bad debt: cannot be collected' },
  { code: 'courtesy', label: 'Professional courtesy' },
  { code: 'deceased', label: 'Deceased estate' },
  { code: 'other', label: 'Other (explain in the reason)' }
];

export interface PortionCents {
  medical_aid: number;
  patient: number;
}

export const zeroPortions = (): PortionCents => ({ medical_aid: 0, patient: 0 });
export const portionTotal = (value: PortionCents): number => value.medical_aid + value.patient;

export interface Reversal {
  /** ISO timestamp */
  at: string;
  by: string | null;
  reason: string;
}

export interface ArReceipt {
  id: string;
  number: string;
  payerType: PayerType;
  patientId: string | null;
  fundName: string | null;
  payerName: string | null;
  method: ReceiptMethod;
  amountCents: number;
  /** yyyy-MM-dd, the day the money came in */
  receivedOn: string | null;
  reference: string | null;
  source: ReceiptSource;
  notes: string | null;
  createdBy: string | null;
  createdAt: string | null;
  reversal: Reversal | null;
  /** From ar_receipt_balances: effective allocations, effective refunds, and what is left */
  allocatedCents: number;
  refundedCents: number;
  unallocatedCents: number;
}

export interface ArAllocation {
  id: string;
  receiptId: string;
  invoiceId: string;
  portion: Portion;
  amountCents: number;
  createdBy: string | null;
  createdAt: string | null;
  reversal: Reversal | null;
  /** What it covered, line by line (receipt_allocation_lines); absent before that table exists */
  covers?: AllocationCover[];
}

/** Part of an allocation on one invoice line (receipt_allocation_lines), the line as it was when paid */
export interface AllocationCover {
  allocationId: string;
  /** invoice_services.id; null for money on the invoice but on none of its lines (interest, corrections) */
  invoiceLineId: string | null;
  code: string | null;
  description: string | null;
  /** yyyy-MM-dd */
  dateKey: string | null;
  portion: Portion;
  amountCents: number;
  /** chosen by staff, or split automatically (oldest line first) */
  chosen: boolean;
  /**
   * The practitioner of the line it paid, as it was when paid (receipt_allocation_lines.practitioner_id: the line's own,
   * else its invoice's); null when neither has one, absent before proposals/2026-10-12-allocation-practitioner.sql
   */
  practitionerId?: string | null;
}

export interface ArAdjustment {
  id: string;
  number: string;
  kind: AdjustmentKind;
  invoiceId: string | null;
  receiptId: string | null;
  patientId: string | null;
  portion: Portion | null;
  /** Positive, except journals: positive adds to what is owed, negative takes off */
  amountCents: number;
  method: RefundMethod | null;
  reasonCode: string | null;
  reason: string;
  approvedBy: string | null;
  /** yyyy-MM-dd */
  effectiveOn: string | null;
  createdBy: string | null;
  createdAt: string | null;
  reversal: Reversal | null;
  /** A discount given as a percentage (10 = 10 %), when it was read with its percentage; absent otherwise */
  percent?: number | null;
}

/** One invoice's figures from ar_invoice_balances */
export interface ArInvoiceBalance {
  invoiceId: string;
  patientId: string | null;
  invoiceNumber: string;
  issueDate: string | null;
  dueDate: string | null;
  paymentStatus: string | null;
  billed: PortionCents;
  allocated: PortionCents;
  credited: PortionCents;
  writtenOff: PortionCents;
  journals: PortionCents;
  /** Unpaid medical aid portion moved to the patient */
  shortfallCents: number;
  /** Standing discounts (the patient's portion only); absent when the row was read without them */
  discounted?: PortionCents;
  /** May be negative: more was settled than is owed */
  outstanding: PortionCents;
  /** Entries that still stand (not reversed) */
  hasActivity: boolean;
  /** Any entry, reversed or not: from then on the ledger, not the status menu, says what is owed */
  hasEntries: boolean;
}

// ---------------------------------------------------------------------------------------------
// Raw rows (views and tables; numeric columns may arrive as strings)
// ---------------------------------------------------------------------------------------------

type Numeric = number | string | null | undefined;

export interface RawReceiptRow {
  receipt_id?: string | null;
  id?: string | null;
  receipt_number?: string | null;
  payer_type?: string | null;
  patient_id?: string | null;
  fund_name?: string | null;
  payer_name?: string | null;
  method?: string | null;
  amount?: Numeric;
  received_on?: string | null;
  reference?: string | null;
  source?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversal_reason?: string | null;
  allocated?: Numeric;
  refunded?: Numeric;
  unallocated?: Numeric;
}

export interface RawAllocationRow {
  id: string;
  receipt_id?: string | null;
  invoice_id?: string | null;
  portion?: string | null;
  amount?: Numeric;
  created_by?: string | null;
  created_at?: string | null;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversal_reason?: string | null;
}

export interface RawAdjustmentRow {
  id: string;
  adjustment_number?: string | null;
  kind?: string | null;
  invoice_id?: string | null;
  receipt_id?: string | null;
  patient_id?: string | null;
  portion?: string | null;
  amount?: Numeric;
  method?: string | null;
  reason_code?: string | null;
  reason?: string | null;
  approved_by?: string | null;
  effective_on?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversal_reason?: string | null;
  /** Discounts only, read where the percentage is shown (not in ADJUSTMENT_COLUMNS, so loaders work before the column) */
  percent?: Numeric;
}

export interface RawInvoiceBalanceRow {
  invoice_id: string;
  patient_id?: string | null;
  invoice_number?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  payment_status?: string | null;
  medical_aid_billed?: Numeric;
  patient_billed?: Numeric;
  medical_aid_allocated?: Numeric;
  patient_allocated?: Numeric;
  medical_aid_credited?: Numeric;
  patient_credited?: Numeric;
  medical_aid_written_off?: Numeric;
  patient_written_off?: Numeric;
  medical_aid_journals?: Numeric;
  patient_journals?: Numeric;
  shortfall_transferred?: Numeric;
  /** proposals/2026-10-13-discounts-and-statements.sql (not in BALANCE_COLUMNS, so loaders work before it) */
  medical_aid_discounted?: Numeric;
  patient_discounted?: Numeric;
  medical_aid_outstanding?: Numeric;
  patient_outstanding?: Numeric;
  has_activity?: boolean | null;
  has_entries?: boolean | null;
}

const PAYER_TYPES: readonly PayerType[] = ['patient', 'medical_aid', 'other'];
const METHODS: readonly ReceiptMethod[] = ['cash', 'card', 'eft', 'medical_aid', 'debit_order', 'other', 'not_recorded'];
const SOURCES: readonly ReceiptSource[] = ['manual', 'batch', 'remittance_import', 'status_bridge', 'legacy_backfill'];
const KINDS: readonly AdjustmentKind[] = ['credit_note', 'write_off', 'journal', 'refund', 'shortfall_transfer', 'discount'];

const pick = <T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const text = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const reversalOf = (row: { reversed_at?: string | null; reversed_by?: string | null; reversal_reason?: string | null }): Reversal | null =>
  row.reversed_at ? { at: row.reversed_at, by: row.reversed_by ?? null, reason: row.reversal_reason?.trim() || 'No reason recorded' } : null;

export const asPortion = (value: string | null | undefined): Portion | null =>
  value === 'medical_aid' || value === 'patient' ? value : null;

export function normalizeReceipt(row: RawReceiptRow): ArReceipt {
  const amountCents = toCents(row.amount);
  const reversal = reversalOf(row);
  const allocatedCents = toCents(row.allocated);
  const refundedCents = toCents(row.refunded);
  return {
    id: row.receipt_id ?? row.id ?? '',
    number: row.receipt_number?.trim() || 'Unnumbered',
    payerType: pick(row.payer_type, PAYER_TYPES, 'other'),
    patientId: row.patient_id ?? null,
    fundName: text(row.fund_name),
    payerName: text(row.payer_name),
    method: pick(row.method, METHODS, 'not_recorded'),
    amountCents,
    receivedOn: dateKeyFrom(row.received_on),
    reference: text(row.reference),
    source: pick(row.source, SOURCES, 'manual'),
    notes: text(row.notes),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    reversal,
    allocatedCents,
    refundedCents,
    // The view computes it; a table row without it is worked out the same way
    unallocatedCents: row.unallocated !== undefined && row.unallocated !== null
      ? toCents(row.unallocated)
      : (reversal ? 0 : amountCents - allocatedCents - refundedCents)
  };
}

export function normalizeAllocation(row: RawAllocationRow): ArAllocation | null {
  const portion = asPortion(row.portion);
  if (!row.receipt_id || !row.invoice_id || !portion) return null;
  return {
    id: row.id,
    receiptId: row.receipt_id,
    invoiceId: row.invoice_id,
    portion,
    amountCents: toCents(row.amount),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    reversal: reversalOf(row)
  };
}

export function normalizeAdjustment(row: RawAdjustmentRow): ArAdjustment | null {
  const kind = KINDS.includes(row.kind as AdjustmentKind) ? (row.kind as AdjustmentKind) : null;
  if (!kind) return null;
  const method = row.method === 'cash' || row.method === 'card' || row.method === 'eft' || row.method === 'debit_order' ? row.method : null;
  return {
    id: row.id,
    number: row.adjustment_number?.trim() || 'Unnumbered',
    kind,
    invoiceId: row.invoice_id ?? null,
    receiptId: row.receipt_id ?? null,
    patientId: row.patient_id ?? null,
    portion: kind === 'shortfall_transfer' ? 'medical_aid' : asPortion(row.portion),
    amountCents: toCents(row.amount),
    method,
    reasonCode: text(row.reason_code),
    reason: row.reason?.trim() || '',
    approvedBy: row.approved_by ?? null,
    effectiveOn: dateKeyFrom(row.effective_on),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    reversal: reversalOf(row),
    // A discount's percentage, when the row was read with it
    ...(kind === 'discount' && row.percent !== undefined ? { percent: row.percent === null || !Number.isFinite(Number(row.percent)) ? null : Number(row.percent) } : {})
  };
}

export function normalizeInvoiceBalance(row: RawInvoiceBalanceRow): ArInvoiceBalance {
  const both = (medicalAid: Numeric, patient: Numeric): PortionCents => ({ medical_aid: toCents(medicalAid), patient: toCents(patient) });
  return {
    invoiceId: row.invoice_id,
    patientId: row.patient_id ?? null,
    invoiceNumber: row.invoice_number?.trim() || row.invoice_id.slice(0, 8),
    issueDate: dateKeyFrom(row.issue_date),
    dueDate: dateKeyFrom(row.due_date),
    paymentStatus: row.payment_status ?? null,
    billed: both(row.medical_aid_billed, row.patient_billed),
    allocated: both(row.medical_aid_allocated, row.patient_allocated),
    credited: both(row.medical_aid_credited, row.patient_credited),
    writtenOff: both(row.medical_aid_written_off, row.patient_written_off),
    journals: both(row.medical_aid_journals, row.patient_journals),
    shortfallCents: toCents(row.shortfall_transferred),
    ...(row.medical_aid_discounted !== undefined || row.patient_discounted !== undefined
      ? { discounted: both(row.medical_aid_discounted, row.patient_discounted) }
      : {}),
    outstanding: both(row.medical_aid_outstanding, row.patient_outstanding),
    hasActivity: row.has_activity === true,
    hasEntries: row.has_entries === true || row.has_activity === true
  };
}

export const isEffective = (entry: { reversal: Reversal | null }): boolean => entry.reversal === null;

// ---------------------------------------------------------------------------------------------
// Amounts typed by staff
// ---------------------------------------------------------------------------------------------

/**
 * Cents from what someone typed: "1,234.50", "N$ 250", " 99.9 ". Null when it is not a positive
 * amount with at most 2 decimals (so "12.345" is refused rather than silently rounded).
 */
export function parseAmountInput(input: string): number | null {
  const cleaned = input.replace(/N\$/gi, '').replace(/[\s,]/g, '');
  if (!/^\d+(\.\d*)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || !hasAtMostDecimals(value, 2)) return null;
  return nadToCents(value);
}

/** Cents as an input value: 12345 -> "123.45", 0 -> "" */
export const centsToInput = (cents: number): string => (cents > 0 ? (cents / 100).toFixed(2) : '');

// ---------------------------------------------------------------------------------------------
// Labels (sentence case)
// ---------------------------------------------------------------------------------------------

export const PORTION_LABELS: Record<Portion, string> = { medical_aid: 'Medical aid', patient: 'Patient' };

export const RECEIPT_METHOD_LABELS: Record<ReceiptMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  eft: 'EFT',
  medical_aid: 'Medical aid',
  debit_order: 'Debit order',
  other: 'Other',
  not_recorded: 'Not recorded'
};

export const ADJUSTMENT_LABELS: Record<AdjustmentKind, string> = {
  credit_note: 'Credit note',
  write_off: 'Write-off',
  journal: 'Correction (journal)',
  refund: 'Refund',
  shortfall_transfer: 'Shortfall moved to patient',
  discount: 'Discount'
};

export const PAYER_LABELS: Record<PayerType, string> = { patient: 'Patient', medical_aid: 'Medical aid fund', other: 'Someone else' };

/** Who paid, for lists and receipts */
export function payerLabel(receipt: Pick<ArReceipt, 'payerType' | 'fundName' | 'payerName' | 'patientId'>, patientNames: Record<string, string> = {}): string {
  if (receipt.payerType === 'medical_aid') return receipt.fundName ?? 'Medical aid';
  if (receipt.payerType === 'other') return receipt.payerName ?? 'Someone else';
  return (receipt.patientId && patientNames[receipt.patientId]) || 'Patient';
}

export const writeOffReasonLabel = (code: string | null): string =>
  WRITE_OFF_REASONS.find(reason => reason.code === code)?.label ?? (code ?? '');
