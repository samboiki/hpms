import { formatNad, fromCents } from '../../utils/billing/money';
import type { Portion } from './arModel';
import type { LineAmount } from './allocationLines';

// ---------------------------------------------------------------------------------------------
// Allocating a payment to open invoices
// Rules (as Eminence's auto-allocation, written for HPMS): the oldest invoice is paid first; a
// payment goes to the payer's own portion (a patient pays patient portions, a fund pays medical
// aid portions); part payments are fine; whatever is left over stays unallocated on the receipt
// as credit, to refund or allocate later. Nothing here talks to the database.
// ---------------------------------------------------------------------------------------------

export interface OpenItem {
  invoiceId: string;
  invoiceNumber: string;
  /** yyyy-MM-dd invoice date; null when the invoice has no usable date */
  dateKey: string | null;
  portion: Portion;
  /** Still owed on this portion (only positive amounts can be paid) */
  outstandingCents: number;
}

export interface AllocationLine {
  invoiceId: string;
  portion: Portion;
  amountCents: number;
  /** The invoice lines staff chose it to pay (allocationLines.ts); absent = split automatically, oldest line first */
  lines?: readonly LineAmount[];
}

export interface SuggestedAllocation {
  lines: AllocationLine[];
  allocatedCents: number;
  /** Left over: stays on the receipt as unallocated credit */
  unallocatedCents: number;
}

export const openItemKey = (item: { invoiceId: string; portion: Portion }): string => `${item.invoiceId}:${item.portion}`;

/**
 * Oldest first. An undated invoice cannot be shown to be recent, so it counts as oldest (as in the
 * aging report); then by date, then by invoice number, then in the given portion order.
 */
export function sortOldestFirst<T extends Pick<OpenItem, 'dateKey' | 'invoiceNumber' | 'portion'>>(
  items: readonly T[],
  portionOrder: readonly Portion[] = ['patient', 'medical_aid']
): T[] {
  const rank = (portion: Portion) => {
    const index = portionOrder.indexOf(portion);
    return index === -1 ? portionOrder.length : index;
  };
  return [...items].sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      if (a.dateKey === null) return -1;
      if (b.dateKey === null) return 1;
      return a.dateKey.localeCompare(b.dateKey);
    }
    return a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true }) || rank(a.portion) - rank(b.portion);
  });
}

/**
 * The allocation to suggest for a payment: oldest first over the given portions, each line no
 * more than is owed, never more in total than was paid. A payment of zero suggests nothing.
 */
export function suggestAllocation(amountCents: number, items: readonly OpenItem[], portions: readonly Portion[]): SuggestedAllocation {
  const amount = Math.max(Math.trunc(amountCents), 0);
  const candidates = sortOldestFirst(items.filter(item => portions.includes(item.portion) && item.outstandingCents > 0), portions);
  const lines: AllocationLine[] = [];
  let left = amount;
  for (const item of candidates) {
    if (left <= 0) break;
    const amountForItem = Math.min(left, item.outstandingCents);
    lines.push({ invoiceId: item.invoiceId, portion: item.portion, amountCents: amountForItem });
    left -= amountForItem;
  }
  return { lines, allocatedCents: amount - left, unallocatedCents: left };
}

/** The portion a payer pays first: patients and other payers the patient portion, funds the medical aid portion */
export const payerPortions = (payerType: 'patient' | 'medical_aid' | 'other'): Portion[] =>
  payerType === 'medical_aid' ? ['medical_aid'] : ['patient'];

export interface AllocationCheck {
  allocatedCents: number;
  /** Received minus allocated; negative when more is allocated than was received */
  remainingCents: number;
  /** What is wrong with a line, by openItemKey */
  lineErrors: Record<string, string>;
  /** What is wrong with the payment as a whole */
  error: string | null;
  ok: boolean;
}

/**
 * Checks an allocation staff entered or edited: every line within what its portion still owes,
 * and the total within what was received. What is not allocated is fine: it stays as credit.
 */
export function checkAllocation(
  amountCents: number | null,
  lines: ReadonlyArray<AllocationLine & { outstandingCents: number }>
): AllocationCheck {
  const lineErrors: Record<string, string> = {};
  let allocatedCents = 0;
  for (const line of lines) {
    if (line.amountCents === 0) continue;
    if (!Number.isInteger(line.amountCents) || line.amountCents < 0) {
      lineErrors[openItemKey(line)] = 'Enter an amount in N$ and cents';
      continue;
    }
    if (line.amountCents > Math.max(line.outstandingCents, 0)) {
      lineErrors[openItemKey(line)] = `More than the ${formatNad(fromCents(Math.max(line.outstandingCents, 0)))} still owed`;
    }
    allocatedCents += line.amountCents;
  }
  const received = amountCents ?? 0;
  let error: string | null = null;
  if (amountCents === null || amountCents <= 0) {
    error = 'Enter the amount received';
  } else if (allocatedCents > received) {
    error = `${formatNad(fromCents(allocatedCents))} is allocated, ${formatNad(fromCents(allocatedCents - received))} more than the ${formatNad(fromCents(received))} received`;
  }
  return {
    allocatedCents,
    remainingCents: received - allocatedCents,
    lineErrors,
    error,
    ok: error === null && Object.keys(lineErrors).length === 0
  };
}

/**
 * A fund's remittance line: the fund paid `paidCents` of the `outstandingCents` it owed. The rest
 * is the shortfall, which staff may move to the patient (a shortfall transfer) or leave on the fund
 * (for example while a rejected line is fixed and resubmitted).
 */
export const shortfallCents = (outstandingCents: number, paidCents: number): number =>
  Math.max(Math.max(outstandingCents, 0) - Math.max(paidCents, 0), 0);
