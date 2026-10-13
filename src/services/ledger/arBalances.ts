import { isEffective, zeroPortions, type ArAdjustment, type ArAllocation, type ArInvoiceBalance, type PortionCents } from './arModel';
import { isOutstandingInvoice, isPaidInvoice, splitCents, type LedgerInvoice } from './invoices';

// ---------------------------------------------------------------------------------------------
// Invoice balances and the payment status they imply
// The formulas are the same as the ar_invoice_balances view and ar_derive_payment_status in
// proposals/2026-10-07-receipts-and-allocations.sql, so a screen can preview what the database
// will do before anything is saved.
// ---------------------------------------------------------------------------------------------

/** What an invoice bills each portion: Finance's split (medical aid capped at the total); nothing when cancelled */
export function billedPortions(invoice: Pick<LedgerInvoice, 'total' | 'medicalAidTotal' | 'status'>): PortionCents {
  if (invoice.status === 'cancelled') return zeroPortions();
  const { medicalAidCents, patientCents } = splitCents(invoice);
  return { medical_aid: medicalAidCents, patient: patientCents };
}

export type InvoiceFigures = Pick<
  ArInvoiceBalance,
  'billed' | 'allocated' | 'credited' | 'writtenOff' | 'journals' | 'shortfallCents' | 'discounted' | 'outstanding' | 'hasActivity' | 'hasEntries'
>;

/**
 * One invoice's balance from its entries. Reversed entries, and allocations of reversed receipts,
 * no longer count. Outstanding per portion = billed + journals +/- shortfall moved - credit notes
 * - write-offs - discounts - money allocated; it is negative when more was settled than is owed.
 */
export function invoiceFigures(
  billed: PortionCents,
  allocations: readonly ArAllocation[],
  adjustments: readonly ArAdjustment[],
  reversedReceiptIds: ReadonlySet<string> = new Set()
): InvoiceFigures {
  const allocated = zeroPortions();
  const credited = zeroPortions();
  const writtenOff = zeroPortions();
  const journals = zeroPortions();
  const discounted = zeroPortions();
  let shortfallCents = 0;
  let standing = 0;
  let entries = 0;

  for (const allocation of allocations) {
    entries += 1;
    if (!isEffective(allocation) || reversedReceiptIds.has(allocation.receiptId)) continue;
    allocated[allocation.portion] += allocation.amountCents;
    standing += 1;
  }
  for (const adjustment of adjustments) {
    if (adjustment.kind === 'refund') continue; // refunds belong to receipts, not invoices
    entries += 1;
    if (!isEffective(adjustment)) continue;
    standing += 1;
    if (adjustment.kind === 'shortfall_transfer') shortfallCents += adjustment.amountCents;
    else if (adjustment.portion && adjustment.kind === 'credit_note') credited[adjustment.portion] += adjustment.amountCents;
    else if (adjustment.portion && adjustment.kind === 'write_off') writtenOff[adjustment.portion] += adjustment.amountCents;
    else if (adjustment.portion && adjustment.kind === 'journal') journals[adjustment.portion] += adjustment.amountCents;
    else if (adjustment.portion && adjustment.kind === 'discount') discounted[adjustment.portion] += adjustment.amountCents;
  }

  return {
    billed,
    allocated,
    credited,
    writtenOff,
    journals,
    shortfallCents,
    discounted,
    outstanding: {
      medical_aid: billed.medical_aid + journals.medical_aid - shortfallCents - credited.medical_aid - writtenOff.medical_aid - discounted.medical_aid - allocated.medical_aid,
      patient: billed.patient + journals.patient + shortfallCents - credited.patient - writtenOff.patient - discounted.patient - allocated.patient
    },
    hasActivity: standing > 0,
    hasEntries: entries > 0
  };
}

/** What is still owed: the positive part of each portion (an overpaid portion owes nothing) */
export const owedCents = (outstanding: PortionCents): number => Math.max(outstanding.medical_aid, 0) + Math.max(outstanding.patient, 0);

const CANCELLED = ['cancelled', 'canceled', 'void', 'voided'];

/**
 * The payment status an invoice gets from its balance. An invoice that never had entries keeps
 * the status staff set (that is how invoices were paid before receipts). Once it has entries,
 * even reversed ones: nothing owed is 'paid', money received with something still owed is
 * 'partial', otherwise it is unpaid: pending or overdue as it was, or (when a reversal makes a
 * paid invoice unpaid again) overdue once past its due date.
 */
export function deriveInvoiceStatus(input: {
  current: string | null;
  dueDate: string | null;
  hasEntries: boolean;
  outstanding: PortionCents;
  allocatedCents: number;
  todayKey: string;
}): string | null {
  const current = (input.current ?? '').trim().toLowerCase();
  if (CANCELLED.includes(current)) return input.current;
  if (!input.hasEntries) return input.current;
  if (owedCents(input.outstanding) <= 0) return 'paid';
  if (input.allocatedCents > 0) return 'partial';
  if (current === 'pending' || current === 'overdue') return input.current;
  return input.dueDate && input.dueDate < input.todayKey ? 'overdue' : 'pending';
}

// ---------------------------------------------------------------------------------------------
// Owed and collected per invoice, for Finance reports
// ---------------------------------------------------------------------------------------------

type LedgerView = Pick<ArInvoiceBalance, 'outstanding' | 'allocated' | 'hasEntries'>;

/**
 * What is still owed on an invoice, per portion. An invoice with entries follows its ledger
 * balance (so part-payments, credit notes, write-offs and reversals count). An invoice without
 * entries follows its status, as before receipts existed: marked paid owes nothing, unpaid owes its split.
 */
export function owedPortions(invoice: LedgerInvoice, balance?: Pick<LedgerView, 'outstanding' | 'hasEntries'>): PortionCents {
  if (invoice.status === 'cancelled') return zeroPortions();
  const owed = balance?.hasEntries ? balance.outstanding : isOutstandingInvoice(invoice) ? billedPortions(invoice) : zeroPortions();
  return { medical_aid: Math.max(owed.medical_aid, 0), patient: Math.max(owed.patient, 0) };
}

/** Money received against an invoice, per portion: allocations once it has entries, else its full split when marked paid */
export function collectedPortions(invoice: LedgerInvoice, balance?: Pick<LedgerView, 'allocated' | 'hasEntries'>): PortionCents {
  if (invoice.status === 'cancelled') return zeroPortions();
  if (balance?.hasEntries) return { ...balance.allocated };
  return isPaidInvoice(invoice) ? billedPortions(invoice) : zeroPortions();
}

/** True when the invoice is still owed money on either portion */
export const isOwed = (invoice: LedgerInvoice, balance?: Pick<LedgerView, 'outstanding' | 'hasEntries'>): boolean =>
  owedCents(owedPortions(invoice, balance)) > 0;
