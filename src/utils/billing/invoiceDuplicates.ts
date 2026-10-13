/**
 * Duplicate-invoice warning (parity D10): a service billed twice for the same patient.
 *
 * Business rules:
 * - A new line is a likely duplicate when the same patient already has the same code, on the same service date and
 *   for the same tooth (or both without a tooth), on ANOTHER invoice that is not cancelled. That is how a service
 *   ends up claimed twice: once from the visit and once again from a second visit or a quote.
 * - It is a warning, never a block: two identical services on one day do happen (a second consultation).
 * - Lines of the same invoice are checked at claim review (claimValidation), not here.
 */
import { formatServiceDate } from './dates.ts';

/** A line already on one of the patient's invoices. */
export interface BilledLine {
  invoiceId: string;
  invoiceNumber: string;
  visitId: string | null;
  code: string;
  /** yyyy-MM-dd */
  serviceDate: string | null;
  teeth: readonly string[];
  /** invoices_enhanced.payment_status */
  status?: string | null;
}

/** A line about to be saved. */
export interface CandidateLine {
  key: string;
  code: string;
  serviceDate: string | null;
  teeth: readonly string[];
}

export interface DuplicateWarning {
  key: string;
  invoiceId: string;
  invoiceNumber: string;
  visitId: string | null;
  message: string;
}

const CANCELLED = new Set(['cancelled', 'canceled', 'void', 'voided']);

const codeKey = (code: string): string => code.trim().toUpperCase();
const toothSet = (teeth: readonly string[]): Set<string> => new Set(teeth.map(tooth => tooth.trim()).filter(Boolean));

/** The tooth both lines share, '' when neither has a tooth, null when they are for different teeth. */
function sharedTooth(a: readonly string[], b: readonly string[]): string | null {
  const first = toothSet(a);
  const second = toothSet(b);
  if (first.size === 0 && second.size === 0) return '';
  const shared = [...first].filter(tooth => second.has(tooth)).sort();
  return shared.length > 0 ? shared.join(', ') : null;
}

/** Warnings for the candidate lines that repeat a line on another of the patient's invoices. */
export function findDuplicateLines(
  candidates: readonly CandidateLine[],
  billed: readonly BilledLine[],
  options: { excludeInvoiceId?: string | null } = {}
): DuplicateWarning[] {
  const others = billed.filter(
    line => line.invoiceId !== options.excludeInvoiceId && !CANCELLED.has((line.status ?? '').trim().toLowerCase()) && line.serviceDate
  );
  const warnings: DuplicateWarning[] = [];
  candidates.forEach(candidate => {
    if (!candidate.serviceDate) return;
    const match = others
      .map(line => ({ line, tooth: line.serviceDate === candidate.serviceDate && codeKey(line.code) === codeKey(candidate.code) ? sharedTooth(candidate.teeth, line.teeth) : null }))
      .find(item => item.tooth !== null);
    if (!match) return;
    const tooth = match.tooth ? ` for tooth ${match.tooth}` : '';
    warnings.push({
      key: candidate.key,
      invoiceId: match.line.invoiceId,
      invoiceNumber: match.line.invoiceNumber,
      visitId: match.line.visitId,
      message: `Code ${candidate.code}${tooth} on ${formatServiceDate(candidate.serviceDate)} is already billed to this patient on invoice ${match.line.invoiceNumber}. Check it is not billed twice.`
    });
  });
  return warnings;
}
