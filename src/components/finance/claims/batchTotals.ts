/**
 * Batch header totals after an invoice is removed from an unsent batch.
 *
 * The repo's update_batch_header_totals() trigger on batch_details computes
 *   total_invoices = COUNT(DISTINCT invoice_number), total_amount = SUM(service_amount - discount_amount)
 * The live database may differ, so the totals are only written when the stored totals matched
 * that basis before the change (proof the basis is right) and still show the old values after it
 * (the trigger did not run). Otherwise nothing is written.
 */
import { fromCents, toCents } from '../../../utils/billing/money.ts';

export interface DetailAmountRow {
  invoice_number: string | null;
  service_amount: number | string | null;
  discount_amount: number | string | null;
}

export interface StoredTotals {
  total_invoices: number | null;
  total_amount: number | string | null;
}

export interface BatchTotals {
  totalInvoices: number;
  totalAmountCents: number;
}

const cents = (value: number | string | null): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? toCents(number) : 0;
};

/** Totals on the same basis as the database trigger. */
export function batchTotalsFromLines(lines: readonly DetailAmountRow[]): BatchTotals {
  const invoices = new Set(lines.map(line => (line.invoice_number ?? '').trim()).filter(Boolean));
  const totalAmountCents = lines.reduce((sum, line) => sum + cents(line.service_amount) - cents(line.discount_amount), 0);
  return { totalInvoices: invoices.size, totalAmountCents };
}

const matches = (stored: StoredTotals, totals: BatchTotals): boolean => {
  const amount = Number(stored.total_amount);
  return (
    stored.total_invoices === totals.totalInvoices &&
    stored.total_amount !== null &&
    Number.isFinite(amount) &&
    toCents(amount) === totals.totalAmountCents
  );
};

export type TotalsPlan =
  | { action: 'none' }
  | { action: 'update'; totalInvoices: number; totalAmount: number }
  | { action: 'unknown_basis' };

/** Decides whether the header totals need writing after lines were removed. */
export function planHeaderTotals(params: {
  storedBefore: StoredTotals;
  linesBefore: readonly DetailAmountRow[];
  storedAfter: StoredTotals;
  linesAfter: readonly DetailAmountRow[];
}): TotalsPlan {
  if (!matches(params.storedBefore, batchTotalsFromLines(params.linesBefore))) return { action: 'unknown_basis' };
  const after = batchTotalsFromLines(params.linesAfter);
  if (matches(params.storedAfter, after)) return { action: 'none' };
  return { action: 'update', totalInvoices: after.totalInvoices, totalAmount: fromCents(after.totalAmountCents) };
}
