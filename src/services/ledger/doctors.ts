import { fromCents, toCents } from './money';
import { isInRange, type DateRange } from './dates';
import { invoiceDateKey, isPaidInvoice, isRevenueInvoice, type LedgerInvoice } from './invoices';
import type { LedgerVisit } from './visits';

// ---------------------------------------------------------------------------------------------
// Doctor productivity
// ---------------------------------------------------------------------------------------------

export interface DoctorProductivityRow {
  /** users.id of the treating doctor; null when no doctor is recorded */
  doctorId: string | null;
  completedVisits: number;
  invoiceCount: number;
  billed: number;
  collected: number;
  /** billed / completed visits, to the cent; null without completed visits */
  billedPerVisit: number | null;
  /** collected / billed; null when nothing was billed */
  collectionRate: number | null;
}

/**
 * The treating doctor of an invoice: the doctor on its visit when that visit is known and has one,
 * otherwise the doctor who created the invoice (invoices_enhanced.practitioner_id).
 */
export function treatingDoctorId(
  invoice: Pick<LedgerInvoice, 'visitId' | 'practitionerId'>,
  doctorByVisit: ReadonlyMap<string, string>
): string | null {
  return (invoice.visitId ? doctorByVisit.get(invoice.visitId) : undefined) ?? invoice.practitionerId;
}

/**
 * Per treating doctor: visits completed on days in the range, and invoices dated in the range
 * (cancelled excluded) with what was billed and what is marked paid. Billed and collected follow
 * the invoice date, as everywhere else in Finance. Highest billed first; no doctor last.
 */
export function doctorProductivity(invoices: LedgerInvoice[], visits: LedgerVisit[], range: DateRange): DoctorProductivityRow[] {
  const doctorByVisit = new Map<string, string>();
  visits.forEach(visit => {
    if (visit.doctorId) doctorByVisit.set(visit.id, visit.doctorId);
  });
  const groups = new Map<string | null, { visits: number; invoices: number; billed: number; collected: number }>();
  const groupFor = (doctorId: string | null) => {
    const group = groups.get(doctorId) ?? { visits: 0, invoices: 0, billed: 0, collected: 0 };
    groups.set(doctorId, group);
    return group;
  };

  for (const visit of visits) {
    if (visit.stage === 'completed' && isInRange(visit.dateKey, range)) groupFor(visit.doctorId).visits += 1;
  }
  for (const invoice of invoices) {
    if (!isRevenueInvoice(invoice) || !isInRange(invoiceDateKey(invoice), range)) continue;
    const group = groupFor(treatingDoctorId(invoice, doctorByVisit));
    const cents = toCents(invoice.total);
    group.invoices += 1;
    group.billed += cents;
    if (isPaidInvoice(invoice)) group.collected += cents;
  }

  return [...groups.entries()]
    .map(([doctorId, group]) => ({
      doctorId,
      completedVisits: group.visits,
      invoiceCount: group.invoices,
      billed: fromCents(group.billed),
      collected: fromCents(group.collected),
      billedPerVisit: group.visits > 0 ? fromCents(Math.round(group.billed / group.visits)) : null,
      collectionRate: group.billed === 0 ? null : group.collected / group.billed
    }))
    .sort((a, b) =>
      Number(a.doctorId === null) - Number(b.doctorId === null) ||
      b.billed - a.billed ||
      b.completedVisits - a.completedVisits ||
      (a.doctorId ?? '').localeCompare(b.doctorId ?? '')
    );
}
