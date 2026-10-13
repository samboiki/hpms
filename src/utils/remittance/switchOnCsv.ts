/**
 * SwitchOn "Navigator" claim status report (CSV export), seen for PSEMAS claims that travel through
 * the SwitchOn switch. A report, not a payment: one row per claim (invoice), not per line.
 *
 *   ,,SwitchOn Navigator Report,,,,
 *   Message Type:,ALL,,,From Date:,dd/mm/yyyy,      (filter rows)
 *   DATE,ACCOUNT,PATIENT,CLAIM,CODE,STATUS,MEDAID
 *   dd/mm/yyyy,<invoice reference>,<patient>,<claim>,<switch destination>,<status>,<amount>
 *   ,,Total Claims : n,,,Total Amount:,<amount>
 * ACCOUNT is the invoice reference the practice sent in claim field 24, so matching uses
 * claimInvoiceReference(). DATE is the date the claim passed the switch (on or after the service
 * date). Statuses: claim approved for payment, approved for part payment, accepted for processing,
 * rejected.
 */
import { identifyFund } from './funds';
import { parseAmountCents, parseDateKey, splitCsvLine, sumOf, textLines } from './text';
import { emptyDocument, emptyLine, type LineStatus, type RemittanceDocument } from './types';

const HEADING = ['DATE', 'ACCOUNT', 'PATIENT', 'STATUS'];

const findHeading = (rows: string[][]): number =>
  rows.findIndex(fields => {
    const names = fields.map(field => field.trim().toUpperCase());
    return HEADING.every(name => names.includes(name));
  });

export const isSwitchOnCsv = (text: string): boolean => {
  const rows = textLines(text).slice(0, 30).map(splitCsvLine);
  return /SwitchOn/i.test(text) && findHeading(rows) >= 0;
};

export function switchOnStatus(text: string): LineStatus {
  const status = text.trim().toUpperCase();
  if (/REJECT|DECLIN|ERROR/.test(status)) return 'rejected';
  if (/PART/.test(status)) return 'part_paid';
  if (/PEND|HELD|HOLD/.test(status)) return 'pended';
  return 'accepted';
}

export function parseSwitchOnCsv(text: string): RemittanceDocument {
  const doc = emptyDocument('switchon_status_csv', 'claim_status', 'switchon');
  const rows = textLines(text).map(splitCsvLine);
  const headingIndex = findHeading(rows);
  if (headingIndex < 0) {
    doc.warnings.push('The column headings (DATE, ACCOUNT, PATIENT, STATUS) were not found.');
    return doc;
  }
  const heading = rows[headingIndex].map(field => field.trim().toUpperCase());
  const at = (fields: string[], name: string): string => {
    const index = heading.indexOf(name);
    return index >= 0 ? (fields[index] ?? '').trim() : '';
  };

  for (const fields of rows.slice(0, headingIndex)) {
    fields.forEach((field, index) => {
      if (/^To Date:?$/i.test(field.trim())) doc.documentDate = parseDateKey(fields[index + 1] ?? '') ?? doc.documentDate;
    });
  }

  let reportedCount: number | null = null;
  let reportedTotal: number | null = null;
  let destination: string | null = null;
  for (const fields of rows.slice(headingIndex + 1)) {
    const joined = fields.join(' ');
    const count = /Total Claims\s*:\s*(\d+)/i.exec(joined);
    if (count) reportedCount = Number(count[1]);
    const totalIndex = fields.findIndex(field => /^Total Amount:?$/i.test(field.trim()));
    if (totalIndex >= 0) reportedTotal = parseAmountCents(fields.slice(totalIndex + 1).find(field => field.trim() !== '') ?? '');
    const date = parseDateKey(at(fields, 'DATE'));
    if (!date) continue;

    const line = emptyLine(doc.lines.length + 1, null);
    line.serviceDate = date;
    line.invoiceReference = at(fields, 'ACCOUNT') || null;
    line.patientName = at(fields, 'PATIENT').replace(/\s+/g, ' ') || null;
    line.fundClaimRef = [at(fields, 'CLAIM'), at(fields, 'CODE')].filter(Boolean).join('/') || null;
    destination = destination ?? (at(fields, 'CODE') || null);
    const amount = parseAmountCents(at(fields, 'MEDAID') || at(fields, 'AMOUNT'));
    line.claimedCents = amount;
    const status = at(fields, 'STATUS').replace(/\s+/g, ' ');
    line.status = switchOnStatus(status);
    line.paidCents = line.status === 'accepted' ? amount ?? 0 : 0;
    line.reasonTexts = status ? [status] : [];
    doc.lines.push(line);
  }

  // PSMD... is the PSEMAS destination on the switch
  const fund = destination && /^PSM/i.test(destination) ? identifyFund('MAG1') : identifyFund(destination);
  doc.fundCode = fund?.code ?? null;
  doc.fundName = fund?.label ?? destination;
  doc.totalClaimedCents = sumOf(doc.lines.map(line => line.claimedCents));
  if (reportedTotal !== null) {
    doc.checks.push({ label: 'Report total amount', expectedCents: reportedTotal, actualCents: doc.totalClaimedCents, ok: reportedTotal === doc.totalClaimedCents });
  }
  if (reportedCount !== null) {
    doc.checks.push({ label: 'Report claim count', expectedCents: reportedCount, actualCents: doc.lines.length, ok: reportedCount === doc.lines.length, unit: 'count' });
  }
  if (doc.lines.length === 0) doc.warnings.push('No claims were found in this report.');
  return doc;
}
