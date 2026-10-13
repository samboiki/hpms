/**
 * Claim history from Eminance's claim files: the .Dat files it writes for every claim run into its History folder
 * ("<practice number>_<run>_<fund code>.Dat", the Methealth HP EDI / QEDI layout 1.1). They are the only export that
 * holds visit and invoice history, and only for medical aid claims: Eminance exports no history of private invoices
 * or payments. Each detail record ("D") is one claim line:
 *   field 3  the practice system's transaction number     field 4  the patient reference: the Eminance account number
 *   field 6  fund code (MAG1, NMC1, NHPM, NAMM, PROS)      field 8  membership number
 *   field 11 the patient's first names (or "01 FRED")      field 12 date of birth (CCYYMMDD)
 *   field 13 tariff code      field 14 amount (VAT incl.)  field 15 description (30 characters)
 *   field 17 service date     field 18 quantity            field 24 invoice number
 *   field 33 diagnosis codes  field 37 tooth numbers       field 48 the patient's ID number (often empty)
 * Header ("1") and trailer ("Z") records are skipped; Eminance splits trailer totals of 1,000 and more with an
 * unquoted comma, so they are never read as amounts.
 */
import { toDateKey } from '../billing/dates';
import { normalizeIdNumber } from '../patients/namibianId';
import { canonicalAccountNumber, parseMoneyCents } from './importValues';

export interface ClaimHistoryLine {
  fileName: string;
  line: number;
  accountNumber: string;
  fundCode: string;
  membershipNumber: string;
  /** The first names as the claim names the patient (a leading dependant number removed) */
  firstName: string;
  dateOfBirth: string | null;
  idNumber: string | null;
  tariffCode: string;
  amountCents: number;
  description: string;
  serviceDate: string;
  quantity: number;
  invoiceNumber: string;
  diagnosis: string;
  tooth: string;
  transactionNumber: string;
}

const unquote = (field: string | undefined): string => (field ?? '').trim().replace(/^"(.*)"$/, '$1').trim();

/** True for a claim file: a header record "1,<practice number>,..." followed by detail records "D,..." */
export function isClaimFile(text: string): boolean {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).filter(line => line.trim() !== '');
  return lines.length > 0 && /^"?1"?,/.test(lines[0]) && lines.every(line => /^"?[1DZ]"?,/i.test(line));
}

/** The claim lines of one file; lines without a valid service date, tariff code or amount are counted as ignored */
export function parseClaimFile(text: string, fileName: string): { lines: ClaimHistoryLine[]; ignored: number } {
  const lines: ClaimHistoryLine[] = [];
  let ignored = 0;
  text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).forEach((raw, index) => {
    if (!/^"?D"?,/i.test(raw)) return;
    const fields = raw.split(',');
    // Field n of the layout (1-based), as text; missing fields are empty
    const field = (n: number): string => unquote(fields[n - 1]);
    const serviceDate = toDateKey(field(17));
    const amountCents = parseMoneyCents(field(14));
    const tariffCode = field(13).toUpperCase();
    const accountNumber = canonicalAccountNumber(field(4));
    if (!serviceDate || amountCents === null || !tariffCode || !accountNumber) {
      ignored += 1;
      return;
    }
    const quantity = Number(field(18));
    const idNumber = normalizeIdNumber(field(48));
    lines.push({
      fileName,
      line: index + 1,
      accountNumber,
      fundCode: field(6).toUpperCase(),
      membershipNumber: field(8),
      firstName: field(11).replace(/^\d{1,3}\s+/, '').trim(),
      dateOfBirth: toDateKey(field(12)),
      idNumber: /^[A-Z0-9]{5,20}$/.test(idNumber) ? idNumber : null,
      tariffCode,
      amountCents,
      description: field(15).replace(/^TOOTH:\s*\d+\s*/i, '').trim(),
      serviceDate,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      invoiceNumber: field(24),
      diagnosis: field(33),
      tooth: field(37) || (/^TOOTH:\s*(\d+)/i.exec(field(15))?.[1] ?? ''),
      transactionNumber: field(3)
    });
  });
  return { lines, ignored };
}

/**
 * Claim lines without repeats: Eminance writes each run once per fund, practices keep copies of the History folder,
 * and a line resubmitted in a later run is the same service. One service = account, date, code, amount and the
 * practice system's transaction number (or the invoice number when that is missing).
 */
export function uniqueClaimLines(lines: readonly ClaimHistoryLine[]): ClaimHistoryLine[] {
  const seen = new Set<string>();
  return lines.filter(line => {
    const key = [line.accountNumber, line.serviceDate, line.tariffCode, line.amountCents, line.transactionNumber || line.invoiceNumber, line.tooth].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
