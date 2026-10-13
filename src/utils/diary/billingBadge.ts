/**
 * The diary card's billing badge (parity B13): "Invoiced" once the visit has an invoice, "Paid" once every invoice of
 * the visit is paid. The invoice's payment_status follows the receipts (proposals/2026-10-07-receipts-and-allocations.sql
 * section 7) and is read the way Finance reads it (normalizeInvoiceStatus); cancelled invoices do not count. In words,
 * never colour alone. The cards' invoices are read once for every card on screen (loadBookingInvoices), not per card.
 */
import { normalizeInvoiceStatus } from '../../services/ledger/invoices';
import type { BookingInvoice } from './patientBookings';

export type BillingBadge = 'invoiced' | 'paid';

export const BILLING_BADGE_LABELS: Readonly<Record<BillingBadge, string>> = { invoiced: 'Invoiced', paid: 'Paid' };

/** The badge for one visit's invoices; null when it has none (or only cancelled ones). */
export function billingBadgeFor(invoices: readonly Pick<BookingInvoice, 'paymentStatus'>[]): BillingBadge | null {
  const standing = invoices.filter((invoice) => normalizeInvoiceStatus(invoice.paymentStatus) !== 'cancelled');
  if (standing.length === 0) return null;
  return standing.every((invoice) => normalizeInvoiceStatus(invoice.paymentStatus) === 'paid') ? 'paid' : 'invoiced';
}

/** Badges by visit id for the invoices of the visits on screen. */
export function billingBadgesByVisit(invoices: readonly BookingInvoice[]): Map<string, BillingBadge> {
  const byVisit = new Map<string, BookingInvoice[]>();
  for (const invoice of invoices) byVisit.set(invoice.visitId, [...(byVisit.get(invoice.visitId) ?? []), invoice]);
  const badges = new Map<string, BillingBadge>();
  for (const [visitId, visitInvoices] of byVisit) {
    const badge = billingBadgeFor(visitInvoices);
    if (badge) badges.set(visitId, badge);
  }
  return badges;
}
