import { dateKeyFrom, isInRange, type DateRange } from './dates';
import { invoiceDateKey, normalizePaymentMethod, type LedgerInvoice, type PaymentMethodKey } from './invoices';
import { billedPortions } from './arBalances';
import { isEffective, type AdjustmentKind, type ArAdjustment, type ArReceipt } from './arModel';
import { TAKINGS_METHODS } from './takings';

// ---------------------------------------------------------------------------------------------
// Movements in what debtors owe the practice (net of credit on accounts), dated by the day they
// count on. One rule for the day-end summary, the month-end control totals and the daybook:
//
// - an invoice counts on its invoice date, at what it bills now (a cancelled invoice bills
//   nothing; a closed month's invoices cannot be changed, so a closed month never moves);
// - money counts on the day it was received or paid back, reversed later or not;
// - a reversal is its own movement on the day it was made, so reversing a September receipt in
//   October changes October, never a September that is already closed;
// - allocations and shortfall transfers move money between invoices, portions and credit: they
//   change nobody's total, so they are not movements.
//
// Signs: positive = debtors owe more. All amounts are whole cents.
// ---------------------------------------------------------------------------------------------

export type MovementKind =
  | 'invoices'
  | 'credit_notes'
  | 'discounts'
  | 'write_offs'
  | 'journals'
  | 'receipts'
  | 'refunds'
  | 'receipt_reversals'
  | 'refund_reversals'
  | 'adjustment_reversals';

export const MOVEMENT_KINDS: ReadonlyArray<{ key: MovementKind; label: string }> = [
  { key: 'invoices', label: 'Invoices raised' },
  { key: 'credit_notes', label: 'Credit notes' },
  { key: 'discounts', label: 'Discounts given' },
  { key: 'write_offs', label: 'Write-offs' },
  { key: 'journals', label: 'Corrections (journals)' },
  { key: 'receipts', label: 'Payments received' },
  { key: 'refunds', label: 'Refunds paid out' },
  { key: 'receipt_reversals', label: 'Payments reversed' },
  { key: 'refund_reversals', label: 'Refunds reversed' },
  { key: 'adjustment_reversals', label: 'Credit notes, discounts, write-offs and corrections reversed' }
];

export interface Movement {
  dateKey: string;
  kind: MovementKind;
  /** Signed effect on what debtors owe */
  cents: number;
  /** Invoice, receipt or adjustment id */
  sourceId: string;
}

export type MovementTotals = Record<MovementKind, number>;
export const zeroMovements = (): MovementTotals => Object.fromEntries(MOVEMENT_KINDS.map(kind => [kind.key, 0])) as MovementTotals;
export const netOfMovements = (totals: MovementTotals): number => MOVEMENT_KINDS.reduce((sum, kind) => sum + totals[kind.key], 0);

/** What an adjustment does to what debtors owe: credit notes, discounts and write-offs take off, journals add or take off, refunds add back credit */
export function adjustmentEffectCents(adjustment: Pick<ArAdjustment, 'kind' | 'amountCents'>): number {
  switch (adjustment.kind) {
    case 'credit_note':
    case 'discount':
    case 'write_off':
      return -adjustment.amountCents;
    case 'journal':
      return adjustment.amountCents;
    case 'refund':
      return adjustment.amountCents;
    case 'shortfall_transfer':
      return 0;
  }
}

const ADJUSTMENT_MOVEMENT: Record<AdjustmentKind, MovementKind | null> = {
  credit_note: 'credit_notes',
  write_off: 'write_offs',
  journal: 'journals',
  refund: 'refunds',
  shortfall_transfer: null,
  discount: 'discounts'
};

/** The day a receipt counts on: the day it was received, else the day it was recorded */
export const receiptDateKey = (receipt: Pick<ArReceipt, 'receivedOn' | 'createdAt'>): string | null =>
  receipt.receivedOn ?? dateKeyFrom(receipt.createdAt);

/** The day an adjustment counts on: its effective date, else the day it was recorded */
export const adjustmentDateKey = (adjustment: Pick<ArAdjustment, 'effectiveOn' | 'createdAt'>): string | null =>
  adjustment.effectiveOn ?? dateKeyFrom(adjustment.createdAt);

/** The day an entry was reversed (local calendar day of the reversal); null when it stands */
export const reversalDateKey = (entry: { reversal: { at: string } | null }): string | null =>
  entry.reversal ? dateKeyFrom(entry.reversal.at) : null;

export interface MovementSources {
  invoices: readonly LedgerInvoice[];
  receipts: readonly ArReceipt[];
  /** Every kind, refunds included */
  adjustments: readonly ArAdjustment[];
}

/** Every movement the rows imply, each on the day it counts */
export function ledgerMovements(sources: MovementSources): Movement[] {
  const movements: Movement[] = [];
  for (const invoice of sources.invoices) {
    const dateKey = invoiceDateKey(invoice);
    const billed = billedPortions(invoice);
    const cents = billed.medical_aid + billed.patient;
    if (dateKey && cents !== 0) movements.push({ dateKey, kind: 'invoices', cents, sourceId: invoice.id });
  }
  for (const receipt of sources.receipts) {
    const dateKey = receiptDateKey(receipt);
    if (dateKey) movements.push({ dateKey, kind: 'receipts', cents: -receipt.amountCents, sourceId: receipt.id });
    const reversedOn = reversalDateKey(receipt);
    if (reversedOn) movements.push({ dateKey: reversedOn, kind: 'receipt_reversals', cents: receipt.amountCents, sourceId: receipt.id });
  }
  for (const adjustment of sources.adjustments) {
    const kind = ADJUSTMENT_MOVEMENT[adjustment.kind];
    const effect = adjustmentEffectCents(adjustment);
    if (!kind || effect === 0) continue;
    const dateKey = adjustmentDateKey(adjustment);
    if (dateKey) movements.push({ dateKey, kind, cents: effect, sourceId: adjustment.id });
    const reversedOn = reversalDateKey(adjustment);
    if (reversedOn) {
      movements.push({
        dateKey: reversedOn,
        kind: adjustment.kind === 'refund' ? 'refund_reversals' : 'adjustment_reversals',
        cents: -effect,
        sourceId: adjustment.id
      });
    }
  }
  return movements;
}

/** Movements per kind within a range (inclusive) */
export function totalMovements(movements: readonly Movement[], range: DateRange): MovementTotals {
  const totals = zeroMovements();
  for (const movement of movements) if (isInRange(movement.dateKey, range)) totals[movement.kind] += movement.cents;
  return totals;
}

/** Sum of the movements dated after a day (exclusive) */
export const movementsAfter = (movements: readonly Movement[], dateKey: string): number =>
  movements.reduce((sum, movement) => (movement.dateKey > dateKey ? sum + movement.cents : sum), 0);

// ---------------------------------------------------------------------------------------------
// Control summary of a day (day end) or a range (month to date): the control totals with counts
// ---------------------------------------------------------------------------------------------

export type AdjustmentCounts = Record<'credit_note' | 'write_off' | 'journal' | 'shortfall_transfer' | 'discount', { count: number; cents: number }>;

export interface ControlSummary {
  range: DateRange;
  invoices: { count: number; billedCents: number; medicalAidCents: number; patientCents: number };
  /** Every receipt dated in the range, reversed since or not (a reversal counts on its own day) */
  receipts: { count: number; cents: number; byMethod: Record<PaymentMethodKey, number>; fromMedicalAidsCents: number; fromOthersCents: number };
  /** Reversals made in the range, whatever day the receipt was dated */
  receiptReversals: { count: number; cents: number };
  refunds: { count: number; cents: number; cashCents: number };
  refundReversals: { count: number; cents: number };
  /** Credit notes, discounts, write-offs and journals (signed) dated in the range; shortfall transfers for information */
  adjustments: AdjustmentCounts;
  adjustmentReversals: { count: number; cents: number };
  movements: MovementTotals;
  /** Change in what debtors owe over the range */
  netMovementCents: number;
  /** The till: cash received in the range and still standing, less cash refunds still standing */
  cash: { receivedCents: number; refundedCents: number; expectedCents: number };
}

const zeroByMethod = (): Record<PaymentMethodKey, number> =>
  Object.fromEntries(TAKINGS_METHODS.map(method => [method, 0])) as Record<PaymentMethodKey, number>;

/** The control totals of a range, with counts, from the same movements the month end uses */
export function controlSummary(sources: MovementSources, range: DateRange): ControlSummary {
  const summary: ControlSummary = {
    range,
    invoices: { count: 0, billedCents: 0, medicalAidCents: 0, patientCents: 0 },
    receipts: { count: 0, cents: 0, byMethod: zeroByMethod(), fromMedicalAidsCents: 0, fromOthersCents: 0 },
    receiptReversals: { count: 0, cents: 0 },
    refunds: { count: 0, cents: 0, cashCents: 0 },
    refundReversals: { count: 0, cents: 0 },
    adjustments: {
      credit_note: { count: 0, cents: 0 },
      write_off: { count: 0, cents: 0 },
      journal: { count: 0, cents: 0 },
      shortfall_transfer: { count: 0, cents: 0 },
      discount: { count: 0, cents: 0 }
    },
    adjustmentReversals: { count: 0, cents: 0 },
    movements: totalMovements(ledgerMovements(sources), range),
    netMovementCents: 0,
    cash: { receivedCents: 0, refundedCents: 0, expectedCents: 0 }
  };

  for (const invoice of sources.invoices) {
    if (!isInRange(invoiceDateKey(invoice), range)) continue;
    const billed = billedPortions(invoice);
    if (billed.medical_aid + billed.patient === 0) continue;
    summary.invoices.count += 1;
    summary.invoices.billedCents += billed.medical_aid + billed.patient;
    summary.invoices.medicalAidCents += billed.medical_aid;
    summary.invoices.patientCents += billed.patient;
  }

  for (const receipt of sources.receipts) {
    if (isInRange(receiptDateKey(receipt), range)) {
      summary.receipts.count += 1;
      summary.receipts.cents += receipt.amountCents;
      summary.receipts.byMethod[normalizePaymentMethod(receipt.method)] += receipt.amountCents;
      if (receipt.payerType === 'medical_aid') summary.receipts.fromMedicalAidsCents += receipt.amountCents;
      else summary.receipts.fromOthersCents += receipt.amountCents;
      if (receipt.method === 'cash' && isEffective(receipt)) summary.cash.receivedCents += receipt.amountCents;
    }
    if (isInRange(reversalDateKey(receipt), range)) {
      summary.receiptReversals.count += 1;
      summary.receiptReversals.cents += receipt.amountCents;
    }
  }

  for (const adjustment of sources.adjustments) {
    const dated = isInRange(adjustmentDateKey(adjustment), range);
    const reversed = isInRange(reversalDateKey(adjustment), range);
    if (adjustment.kind === 'refund') {
      if (dated) {
        summary.refunds.count += 1;
        summary.refunds.cents += adjustment.amountCents;
        if (adjustment.method === 'cash') {
          summary.refunds.cashCents += adjustment.amountCents;
          if (isEffective(adjustment)) summary.cash.refundedCents += adjustment.amountCents;
        }
      }
      if (reversed) {
        summary.refundReversals.count += 1;
        summary.refundReversals.cents += adjustment.amountCents;
      }
      continue;
    }
    if (dated) {
      summary.adjustments[adjustment.kind].count += 1;
      summary.adjustments[adjustment.kind].cents += adjustment.amountCents;
    }
    if (reversed && adjustment.kind !== 'shortfall_transfer') {
      summary.adjustmentReversals.count += 1;
      summary.adjustmentReversals.cents += -adjustmentEffectCents(adjustment);
    }
  }

  summary.netMovementCents = netOfMovements(summary.movements);
  summary.cash.expectedCents = summary.cash.receivedCents - summary.cash.refundedCents;
  return summary;
}
