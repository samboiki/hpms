/**
 * Whether a dispensed medicine is on a bill. A dispensing marked "bill" adds a line to the visit's bill on screen;
 * the stock and the charge only happen when the visit is saved. Until then, or if the line is removed, the medicine
 * was handed over but not billed: the screens say so, so it is not forgotten.
 */
import type { DispensingRecord } from './repeats';

export type DispensingBilling =
  | { state: 'cancelled' }
  | { state: 'given' }
  | { state: 'on_bill_unsaved' }
  | { state: 'billed'; invoiceId: string; invoiceNumber: string }
  | { state: 'not_on_bill' };

export interface VisitBill {
  invoiceId: string;
  invoiceNumber: string;
  /** Stock units on the visit's invoice per item */
  units: ReadonlyMap<string, number>;
}

export function dispensingBilling(
  record: Pick<DispensingRecord, 'cancelledAt' | 'billed' | 'visitId' | 'itemId'>,
  bills: ReadonlyMap<string, VisitBill>,
  /** Items on the visit's bill on screen, not saved yet (only for the visit being edited) */
  unsavedItemIds: ReadonlySet<string> = new Set()
): DispensingBilling {
  if (record.cancelledAt) return { state: 'cancelled' };
  if (!record.billed) return { state: 'given' };
  const bill = record.visitId ? bills.get(record.visitId) : undefined;
  if (bill && (bill.units.get(record.itemId) ?? 0) > 0) return { state: 'billed', invoiceId: bill.invoiceId, invoiceNumber: bill.invoiceNumber };
  if (unsavedItemIds.has(record.itemId)) return { state: 'on_bill_unsaved' };
  return { state: 'not_on_bill' };
}

/** "Repeat 1 of 2" on a repeat's label, "2 repeats" on the first, null without repeats */
export function repeatsText(record: Pick<DispensingRecord, 'repeatOf' | 'repeatsAllowed'>, repeatNumber: number | null, ofTotal: number | null): string | null {
  if (record.repeatOf && repeatNumber !== null && ofTotal !== null) return `Repeat ${repeatNumber} of ${ofTotal}`;
  if (!record.repeatOf && record.repeatsAllowed > 0) return `${record.repeatsAllowed} repeat${record.repeatsAllowed === 1 ? '' : 's'}`;
  return null;
}
