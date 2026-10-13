/**
 * The per-file claim report (Eminance's export report): for one claim file, the practice, fund, batch number, file
 * name, date sent, line count and total, and every line (patient, account number, date, code, amount). Built on
 * demand from the claim file itself, so it always says what the file says: the stored file when the batch kept the
 * one it sent, else the file built from the batch's lines (as the preview shows it). Nothing new is stored.
 * Pure: the screen adds the links, printing goes through receiptDocuments.printDocument.
 */
import { LAB_DETAIL_SERVICE_TYPE, claimFileName, parseClaimFile, type ClaimFile, type ClaimFileHeader } from '../../../utils/billing/claimFile';
import { formatNad, fromCents, sumCents, toCents } from '../../../utils/billing/money';
import { formatServiceDate, toDateKey } from '../../../utils/billing/dates';
import { escapeHtml } from '../financeExport';
import type { BatchDetailRow, BatchHeaderRow } from './types';

/** Where the report's lines come from */
export type ClaimReportSource = 'sent_file' | 'batch_lines';

export interface ClaimReportLine {
  lineNumber: number;
  patientName: string;
  /** The account (patient) reference the funds echo back: claim field 4 */
  accountReference: string;
  membershipNumber: string;
  /** yyyy-MM-dd */
  serviceDate: string | null;
  tariffCode: string;
  amountCents: number;
  invoiceNumber: string;
  /** From the batch line with the same line number, for links (null when the line is not in the batch any more) */
  patientId: string | null;
  invoiceId: string | null;
}

export interface ClaimReport {
  fileName: string;
  practiceName: string;
  practiceNumber: string;
  fundName: string;
  fundCode: string;
  batchNumber: string;
  /** yyyy-MM-dd from the file header */
  batchDate: string | null;
  /** yyyy-MM-dd the batch was sent, null while it is open */
  sentOn: string | null;
  source: ClaimReportSource;
  lines: ClaimReportLine[];
  lineCount: number;
  totalCents: number;
  /** The file's own count and total (its Z record); null when the file has none */
  trailer: { lineCount: number; totalCents: number } | null;
  /** True when the lines add up to the file's own count and total */
  matchesTrailer: boolean;
}

export interface ClaimReportInput {
  file: Pick<ClaimFile, 'fileName' | 'content'>;
  source: ClaimReportSource;
  practiceName: string;
  fundName: string;
  fundCode: string;
  sentAt: string | null;
  details: ReadonlyArray<Pick<BatchDetailRow, 'transaction_number_in_batch' | 'patient_id' | 'invoice_id'>>;
}

const centsOf = (text: string | undefined): number => {
  const value = Number(text);
  return Number.isFinite(value) ? toCents(value) : 0;
};

/** The day a timestamp fell on in the practice's (the browser's) calendar */
const dayOf = (timestamp: string | null): string | null => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? toDateKey(timestamp) : toDateKey(date);
};

/**
 * A dental lab's invoice line under an 8099 line (type of service L, claimFile.labDetailFields): part of the 8099 line
 * the fund is claimed, so it is not a claim line of its own; the file's trailer counts it.
 */
const isLabDetailRecord = (fields: readonly string[]): boolean => (fields[4] ?? '').trim().toUpperCase() === LAB_DETAIL_SERVICE_TYPE;

/** The report for one claim file (detail fields as written by claimFile.detailFields) */
export function buildClaimReport(input: ClaimReportInput): ClaimReport {
  const parsed = parseClaimFile(input.file.content);
  const detailByLine = new Map(input.details.map(detail => [detail.transaction_number_in_batch, detail]));
  const lines = parsed.details.filter(fields => !isLabDetailRecord(fields)).map(fields => {
    const lineNumber = Number(fields[1]);
    const detail = Number.isInteger(lineNumber) ? detailByLine.get(lineNumber) : undefined;
    return {
      lineNumber,
      patientName: (fields[10] ?? '').trim(),
      accountReference: (fields[3] ?? '').trim(),
      membershipNumber: (fields[7] ?? '').trim(),
      serviceDate: toDateKey(fields[16] ?? null),
      tariffCode: (fields[12] ?? '').trim(),
      amountCents: centsOf(fields[13]),
      invoiceNumber: (fields[23] ?? '').trim(),
      patientId: detail?.patient_id ?? null,
      invoiceId: detail?.invoice_id ?? null
    };
  });
  const totalCents = sumCents(lines.map(line => line.amountCents));
  const trailerCount = parsed.trailer ? Number(parsed.trailer[1]) : Number.NaN;
  const trailer = parsed.trailer && Number.isInteger(trailerCount) ? { lineCount: trailerCount, totalCents: centsOf(parsed.trailer[2]) } : null;
  // The trailer counts and totals every D record, a dental lab's lines included
  const recordCents = sumCents(parsed.details.map(fields => centsOf(fields[13])));
  const header = parsed.header ?? [];
  return {
    fileName: input.file.fileName,
    practiceName: input.practiceName,
    practiceNumber: (header[1] ?? '').trim(),
    fundName: input.fundName,
    fundCode: input.fundCode,
    batchNumber: (header[4] ?? '').trim(),
    batchDate: toDateKey(header[5] ?? null),
    sentOn: dayOf(input.sentAt),
    source: input.source,
    lines,
    lineCount: lines.length,
    totalCents,
    trailer,
    matchesTrailer: !!trailer && trailer.lineCount === parsed.details.length && trailer.totalCents === recordCents
  };
}

/** The header a batch's claim file is written with (the batch review builds the same) */
export const claimFileHeaderOf = (batch: BatchHeaderRow): ClaimFileHeader => ({
  practiceNumber: batch.practice_number,
  batchNumber: batch.batch_number,
  batchDate: batch.batch_date,
  fundReference: batch.medical_aid_reference,
  systemIdentification: batch.system_identification,
  transactionType: batch.transaction_type,
  sourceSoftware: batch.source_software,
  sourceSoftwareVersion: batch.source_software_version
});

/** Claim file fields by line number, when the batch keeps the file it sent (the most faithful copy of what the fund received) */
export function sentFileFields(batch: Pick<BatchHeaderRow, 'generated_file_content'>): Map<number, string[]> {
  const fields = new Map<number, string[]>();
  if (!batch.generated_file_content) return fields;
  for (const detail of parseClaimFile(batch.generated_file_content).details) {
    const lineNumber = Number(detail[1]);
    if (Number.isInteger(lineNumber) && !isLabDetailRecord(detail)) fields.set(lineNumber, detail);
  }
  return fields;
}

/** The file exactly as it was sent, when the batch kept it (batch_headers.generated_file_content) */
export function storedClaimFile(batch: BatchHeaderRow): ClaimFile | null {
  if (!batch.generated_file_content) return null;
  const claimed = parseClaimFile(batch.generated_file_content).details.filter(fields => !isLabDetailRecord(fields));
  return {
    fileName: claimFileName({ practiceNumber: batch.practice_number, batchNumber: batch.batch_number, fundReference: batch.medical_aid_reference }),
    content: batch.generated_file_content,
    lineCount: claimed.length,
    totalCents: sumCents(claimed.map(fields => centsOf(fields[13])))
  };
}

const nad = (cents: number): string => formatNad(fromCents(cents));

/** The printed look of the claims screen's papers (claim report, statement of outstanding claims) */
export const PAGE_STYLE = `body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827;margin:32px}
h1{font-size:20px;margin:0 0 4px}.muted{color:#6B7280;font-size:12px}.facts{margin:16px 0;border-collapse:collapse;font-size:13px}
.facts td{padding:2px 16px 2px 0;border:none}table.lines{width:100%;border-collapse:collapse;font-size:12px}
.lines th,.lines td{padding:5px 8px;border-bottom:1px solid #E5E7EB;text-align:left}
.lines th{background:#F9FAFB;color:#4B5563;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
.lines tfoot td{border-top:2px solid #9CA3AF;font-weight:600}.num{text-align:right;font-variant-numeric:tabular-nums}
.note{font-size:11px;color:#6B7280;margin-top:12px}.warn{font-size:12px;color:#92400E;margin-top:12px}`;

/** The report as a printable page (everything escaped; N$ to the cent; dates day first) */
export function claimReportHtml(report: ClaimReport): string {
  const facts: Array<[string, string]> = [
    ['Practice', `${report.practiceName}${report.practiceNumber ? ` (practice number ${report.practiceNumber})` : ''}`],
    ['Fund', `${report.fundName}${report.fundCode && report.fundCode !== report.fundName ? ` (${report.fundCode})` : ''}`],
    ['Batch number', report.batchNumber || '-'],
    ['Claim file', report.fileName],
    ['Batch date', formatServiceDate(report.batchDate)],
    ['Date sent', report.sentOn ? formatServiceDate(report.sentOn) : 'Not sent yet'],
    ['Lines', String(report.lineCount)],
    ['Total claimed', nad(report.totalCents)]
  ];
  const rows = report.lines.map(line => `<tr><td class="num">${line.lineNumber}</td><td>${escapeHtml(line.patientName)}</td>`
    + `<td>${escapeHtml(line.accountReference)}</td><td>${escapeHtml(formatServiceDate(line.serviceDate))}</td>`
    + `<td>${escapeHtml(line.tariffCode)}</td><td>${escapeHtml(line.invoiceNumber)}</td><td class="num">${escapeHtml(nad(line.amountCents))}</td></tr>`).join('');
  const source = report.source === 'sent_file'
    ? 'Built from the file exactly as it was sent to the fund.'
    : report.sentOn
      ? 'The file that was sent was not kept; this report is built from the batch\'s lines as they are now.'
      : 'Built from the batch\'s lines as they are now (the file has not been sent).';
  const check = report.matchesTrailer
    ? '<p class="note">The lines and total agree with the count and total at the end of the file.</p>'
    : `<p class="warn">The lines do not agree with the count and total at the end of the file${report.trailer ? ` (${report.trailer.lineCount} lines, ${escapeHtml(nad(report.trailer.totalCents))})` : ''}. Check the file before sending it again.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Claim report ${escapeHtml(report.fileName)}</title><style>${PAGE_STYLE}</style></head><body>
<h1>Claim file report</h1>
<p class="muted">${escapeHtml(report.fileName)}</p>
<table class="facts">${facts.map(([label, value]) => `<tr><td class="muted">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table>
<table class="lines"><thead><tr><th class="num">Line</th><th>Patient</th><th>Account</th><th>Date</th><th>Code</th><th>Invoice</th><th class="num">Amount</th></tr></thead>
<tbody>${rows}</tbody><tfoot><tr><td colspan="6">${report.lineCount} line(s)</td><td class="num">${escapeHtml(nad(report.totalCents))}</td></tr></tfoot></table>
${check}<p class="note">${escapeHtml(source)}</p>
</body></html>`;
}
