import { formatNad, fromCents } from '../../utils/billing/money';
import {
  ADJUSTMENT_LABELS,
  isEffective,
  type ArAdjustment,
  type ArAllocation,
  type ArReceipt,
  type Portion,
  type PortionCents
} from './arModel';

// ---------------------------------------------------------------------------------------------
// Limits and reversal rules for credit notes, write-offs, journals, refunds and shortfall
// transfers. The database enforces the same limits (proposals/2026-10-07-receipts-and-allocations.sql);
// these give the screens the message before anything is sent.
// ---------------------------------------------------------------------------------------------

/** Roles that may approve (and reverse) a write-off */
export const WRITE_OFF_APPROVER_ROLES: readonly string[] = ['admin', 'doctor'];
export const canApproveWriteOffs = (role: string | null | undefined): boolean => WRITE_OFF_APPROVER_ROLES.includes(role ?? '');

/**
 * Roles that may give (and take back) a discount: administrators and practitioners ('doctor' is every practitioner's
 * role), as for write-offs. The owner may widen it to reception; the database checks the same (ar_is_approver in
 * proposals/2026-10-13-discounts-and-statements.sql).
 */
export const DISCOUNT_ROLES: readonly string[] = ['admin', 'doctor'];
export const canGiveDiscounts = (role: string | null | undefined): boolean => DISCOUNT_ROLES.includes(role ?? '');

export type InvoiceAdjustmentKind = 'credit_note' | 'write_off' | 'journal' | 'shortfall_transfer';
export type JournalDirection = 'increase' | 'decrease';

export interface InvoiceAdjustmentDraft {
  kind: InvoiceAdjustmentKind;
  /** The portion it applies to; a shortfall transfer always moves the medical aid portion */
  portion: Portion;
  amountCents: number | null;
  /** Journals: increase adds to what is owed, decrease takes off */
  direction?: JournalDirection;
  reason: string;
  /** Write-offs: why (WRITE_OFF_REASONS) */
  reasonCode?: string | null;
}

export interface RuleResult {
  ok: boolean;
  error: string | null;
}

const ok: RuleResult = { ok: true, error: null };
const fail = (error: string): RuleResult => ({ ok: false, error });
const nad = (cents: number): string => formatNad(fromCents(cents));
const portionWords = (portion: Portion): string => (portion === 'medical_aid' ? 'medical aid' : 'patient');

/** The portion an adjustment draws on: a shortfall transfer always takes from the medical aid portion */
const sourcePortion = (draft: Pick<InvoiceAdjustmentDraft, 'kind' | 'portion'>): Portion =>
  draft.kind === 'shortfall_transfer' ? 'medical_aid' : draft.portion;

/**
 * The most an adjustment may be, from what the invoice still owes: a credit note, write-off or
 * decreasing journal never more than the portion owes; a shortfall transfer never more than the
 * unpaid medical aid portion. An increasing journal has no limit (null).
 */
export function adjustmentLimitCents(
  draft: Pick<InvoiceAdjustmentDraft, 'kind' | 'portion' | 'direction'>,
  outstanding: PortionCents
): number | null {
  if (draft.kind === 'journal' && draft.direction !== 'decrease') return null;
  return Math.max(outstanding[sourcePortion(draft)], 0);
}

/** The signed amount stored for a draft: journals that decrease are negative, everything else positive */
export const signedAdjustmentCents = (draft: Pick<InvoiceAdjustmentDraft, 'kind' | 'direction'>, amountCents: number): number =>
  draft.kind === 'journal' && draft.direction === 'decrease' ? -amountCents : amountCents;

/** Checks a credit note, write-off, journal or shortfall transfer before it is saved */
export function checkInvoiceAdjustment(draft: InvoiceAdjustmentDraft, outstanding: PortionCents, role: string | null | undefined): RuleResult {
  if (draft.kind === 'write_off' && !canApproveWriteOffs(role)) {
    return fail('Only a practice admin or doctor can approve a write-off. Ask one of them to write it off.');
  }
  if (draft.amountCents === null || !Number.isInteger(draft.amountCents) || draft.amountCents <= 0) {
    return fail('Enter an amount in N$ and cents');
  }
  if (draft.kind === 'write_off' && !draft.reasonCode) return fail('Choose why it is written off');
  if (draft.kind === 'journal' && !draft.direction) return fail('Choose whether the correction adds to or takes off what is owed');
  if (!draft.reason.trim()) return fail('Give a reason: it is kept with the entry and shown on the account');
  const limit = adjustmentLimitCents(draft, outstanding);
  if (limit !== null && draft.amountCents > limit) {
    if (draft.kind === 'shortfall_transfer') {
      return fail(`Only ${nad(limit)} of the medical aid portion is unpaid, so no more can be moved to the patient`);
    }
    const label = draft.kind === 'journal' ? 'A correction' : `A ${ADJUSTMENT_LABELS[draft.kind].toLowerCase()}`;
    return fail(`${label} cannot be more than the ${nad(limit)} still owed on the ${portionWords(draft.portion)} portion`);
  }
  return ok;
}

/** What each portion will owe after an adjustment (for the confirmation step) */
export function outstandingAfter(outstanding: PortionCents, draft: Pick<InvoiceAdjustmentDraft, 'kind' | 'portion' | 'direction'>, amountCents: number): PortionCents {
  const next = { ...outstanding };
  if (draft.kind === 'shortfall_transfer') {
    next.medical_aid -= amountCents;
    next.patient += amountCents;
  } else if (draft.kind === 'journal') {
    next[draft.portion] += signedAdjustmentCents(draft, amountCents);
  } else {
    next[draft.portion] -= amountCents;
  }
  return next;
}

/** A refund pays back unallocated credit only, from a receipt that is not reversed */
export function checkRefund(input: { amountCents: number | null; method: string | null; reason: string }, receipt: Pick<ArReceipt, 'unallocatedCents' | 'reversal'>): RuleResult {
  if (receipt.reversal) return fail('This receipt is reversed, so there is nothing to refund');
  if (input.amountCents === null || !Number.isInteger(input.amountCents) || input.amountCents <= 0) return fail('Enter an amount in N$ and cents');
  if (input.amountCents > Math.max(receipt.unallocatedCents, 0)) {
    return fail(`A refund can only pay back unallocated credit: ${nad(Math.max(receipt.unallocatedCents, 0))} on this receipt`);
  }
  if (!input.method) return fail('Choose how the money is paid back');
  if (!input.reason.trim()) return fail('Give a reason for the refund');
  return ok;
}

// ---------------------------------------------------------------------------------------------
// Reversals: nothing is deleted; a reversal undoes an entry's effect from the day it is reversed
// ---------------------------------------------------------------------------------------------

export interface RestoredAmount {
  invoiceId: string;
  portion: Portion;
  amountCents: number;
}

export interface ReversalEffect {
  /** Why it cannot be reversed yet; null when it can */
  blockedBy: string | null;
  /** What goes back onto invoices (they are owed again) */
  restores: RestoredAmount[];
  restoredCents: number;
  /** Unallocated credit that disappears with the receipt (or comes back to it) */
  creditCents: number;
}

/**
 * Reversing a receipt undoes every allocation still standing (the invoices are owed again) and
 * removes its unallocated credit. Money already refunded from it was paid out, so that refund
 * must be reversed first.
 */
export function receiptReversalEffects(
  receipt: Pick<ArReceipt, 'id' | 'unallocatedCents' | 'reversal'>,
  allocations: readonly ArAllocation[],
  refunds: readonly ArAdjustment[]
): ReversalEffect {
  if (receipt.reversal) return { blockedBy: 'This receipt is already reversed', restores: [], restoredCents: 0, creditCents: 0 };
  const standingRefunds = refunds.filter(refund => refund.kind === 'refund' && refund.receiptId === receipt.id && isEffective(refund));
  const grouped = new Map<string, RestoredAmount>();
  for (const allocation of allocations) {
    if (allocation.receiptId !== receipt.id || !isEffective(allocation)) continue;
    const key = `${allocation.invoiceId}:${allocation.portion}`;
    const current = grouped.get(key) ?? { invoiceId: allocation.invoiceId, portion: allocation.portion, amountCents: 0 };
    current.amountCents += allocation.amountCents;
    grouped.set(key, current);
  }
  const restores = [...grouped.values()];
  return {
    blockedBy: standingRefunds.length > 0
      ? `Money was refunded from this receipt (${standingRefunds.map(refund => refund.number).join(', ')}). Reverse the refund first.`
      : null,
    restores,
    restoredCents: restores.reduce((sum, item) => sum + item.amountCents, 0),
    creditCents: Math.max(receipt.unallocatedCents, 0)
  };
}

/** Reversing one allocation: the invoice portion is owed again and the money is back on the receipt as credit */
export function allocationReversalEffect(allocation: ArAllocation): ReversalEffect {
  if (!isEffective(allocation)) return { blockedBy: 'This allocation is already reversed', restores: [], restoredCents: 0, creditCents: 0 };
  return {
    blockedBy: null,
    restores: [{ invoiceId: allocation.invoiceId, portion: allocation.portion, amountCents: allocation.amountCents }],
    restoredCents: allocation.amountCents,
    creditCents: allocation.amountCents
  };
}

/**
 * Whether an adjustment can be reversed now. Reversing a credit note, write-off or decreasing
 * journal makes the invoice owe more again: always possible. Reversing a shortfall transfer moves
 * it back to the medical aid, so the patient must still owe it; reversing an increasing journal
 * likewise needs the amount still unpaid. Write-offs are reversed by an admin or doctor, and a discount is taken back
 * by whoever may give one (the patient owes it again).
 */
export function checkAdjustmentReversal(adjustment: ArAdjustment, outstanding: PortionCents | null, role: string | null | undefined): RuleResult {
  if (!isEffective(adjustment)) return fail('This entry is already reversed');
  if (adjustment.kind === 'write_off' && !canApproveWriteOffs(role)) return fail('Only a practice admin or doctor can reverse a write-off');
  if (adjustment.kind === 'discount' && !canGiveDiscounts(role)) return fail('Only a practice administrator or practitioner can take back a discount');
  if (adjustment.kind === 'shortfall_transfer') {
    if (outstanding === null) return fail('The invoice balance could not be read');
    if (adjustment.amountCents > Math.max(outstanding.patient, 0)) {
      return fail(`The patient has already paid part of the ${nad(adjustment.amountCents)} moved to them. Reverse that payment first.`);
    }
  }
  if (adjustment.kind === 'journal' && adjustment.amountCents > 0 && adjustment.portion) {
    if (outstanding === null) return fail('The invoice balance could not be read');
    if (adjustment.amountCents > Math.max(outstanding[adjustment.portion], 0)) {
      return fail(`Part of the ${nad(adjustment.amountCents)} this correction added has been paid. Reverse that payment first.`);
    }
  }
  return ok;
}

/** What reversing an adjustment does to the invoice it belongs to */
export function adjustmentReversalEffect(adjustment: ArAdjustment): PortionCents {
  const effect = { medical_aid: 0, patient: 0 };
  if (adjustment.kind === 'refund' || !adjustment.portion) return effect;
  if (adjustment.kind === 'shortfall_transfer') {
    effect.medical_aid += adjustment.amountCents;
    effect.patient -= adjustment.amountCents;
  } else if (adjustment.kind === 'journal') {
    effect[adjustment.portion] -= adjustment.amountCents;
  } else {
    effect[adjustment.portion] += adjustment.amountCents;
  }
  return effect;
}
