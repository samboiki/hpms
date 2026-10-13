/**
 * Methealth Namibia "Remittance Statement" (NMC and PSEMAS payments).
 *
 * Layout (landscape, printed on portrait pages turned 90 degrees; pdfExtract undoes the rotation):
 *   REMITTANCE STATEMENT: <fund>
 *   Practice Number / Practice Name / Statement Date / Statement Number / Reference Number
 *   MEMBER NO | PATIENT NAME | REFERENCE NUMBER | SERVICE DATE | TARIFF CODE | CLAIMED AMOUNT |
 *   TARIFF AMOUNT | REJECT CODE | PAID TO SUPPLIER | MEMBER PORTION        (repeated on every page)
 *   one row per claimed line; a long patient name wraps onto a row of its own
 *   TOTAL FOR MEMBER <member> : claimed, tariff, paid, member portion      (after each member)
 *   TOTAL AMOUNTS : paid, member portion / AMOUNT PAYABLE TO PRACTICE: paid
 *   ** TAKE NOTE ** ... AMOUNT OF <paid> ... NUMBER <bank account>
 *   EXPLANATION OF REJECTION CODES : one "<code> <wording>" row per code used
 *   CLIENT SERVICE OFFICES (a static contact page, skipped)
 * Values sit left-aligned under their column heading, so each value belongs to the heading whose
 * left edge is nearest. One line has at most one reject code. Rejected lines carry the full amount
 * as "member portion" (even code 202, which the patient may not be charged): the posting rules, not
 * this column, decide what a patient owes.
 */
import { identifyFund } from './funds';
import { groupRows, nearestIndex, type PdfPageText, type PdfRow } from './pdfLayout';
import { last4, parseAmountCents, parseDateKey, sumOf } from './text';
import { emptyDocument, emptyLine, type LineStatus, type RemittanceDocument, type RemittanceLine } from './types';

type Column = 'member' | 'name' | 'reference' | 'date' | 'tariff' | 'claimed' | 'tariffAmount' | 'reject' | 'paid' | 'memberPortion';

const COLUMNS: readonly Column[] = ['member', 'name', 'reference', 'date', 'tariff', 'claimed', 'tariffAmount', 'reject', 'paid', 'memberPortion'];

/** Left edges of the columns on every statement seen (used when a page has no heading row) */
const DEFAULT_ANCHORS: readonly number[] = [17, 98, 179, 261, 342, 423, 504, 585, 667, 748];

const HEADING: Array<{ column: Column; pattern: RegExp }> = [
  { column: 'member', pattern: /^MEMBER NO\b/ },
  { column: 'name', pattern: /^PATIENT NAME$/ },
  { column: 'reference', pattern: /^REFERENCE$/ },
  { column: 'date', pattern: /^SERVICE DATE$/ },
  { column: 'tariff', pattern: /^TARIFF CODE$/ },
  { column: 'claimed', pattern: /^CLAIMED$/ },
  { column: 'tariffAmount', pattern: /^TARIFF$/ },
  { column: 'reject', pattern: /^REJECT CODE$/ },
  { column: 'paid', pattern: /^PAID TO$/ },
  { column: 'memberPortion', pattern: /^MEMBER$/ }
];

export const isMethealthStatement = (text: string): boolean => /REMITTANCE STATEMENT\s*:/i.test(text) && /PAID TO/i.test(text) && /MEMBER PORTION|PORTION/i.test(text);

const isHeadingRow = (row: PdfRow): boolean => /\bMEMBER NO\b/.test(row.text) && /\bPATIENT NAME\b/.test(row.text);

/** Column anchors from a heading row; the defaults for any heading not found */
function anchorsFrom(row: PdfRow): number[] {
  const anchors = [...DEFAULT_ANCHORS];
  for (const item of row.items) {
    const text = item.str.trim().toUpperCase();
    const heading = HEADING.find(entry => entry.pattern.test(text));
    if (heading) anchors[COLUMNS.indexOf(heading.column)] = item.x;
  }
  return anchors;
}

/** The row's values by column (several items in one column are joined) */
function cellsOf(row: PdfRow, anchors: readonly number[]): Partial<Record<Column, string>> {
  const cells: Partial<Record<Column, string>> = {};
  for (const item of row.items) {
    const column = COLUMNS[nearestIndex(item.x, anchors)];
    const text = item.str.trim();
    if (!text) continue;
    cells[column] = cells[column] ? `${cells[column]} ${text}` : text;
  }
  return cells;
}

const amountIn = (cells: Partial<Record<Column, string>>, column: Column): number | null => parseAmountCents(cells[column] ?? null);

export function lineStatusFromAmounts(claimedCents: number | null, paidCents: number): LineStatus {
  const claimed = claimedCents ?? 0;
  if (paidCents < 0) return 'part_paid';
  if (claimed <= 0) return paidCents > 0 ? 'paid' : 'info';
  if (paidCents >= claimed) return 'paid';
  if (paidCents > 0) return 'part_paid';
  return 'rejected';
}

interface MemberTotal {
  label: string;
  claimed: number | null;
  paid: number | null;
  memberPortion: number | null;
  lines: RemittanceLine[];
}

export function parseMethealthStatement(pages: readonly PdfPageText[]): RemittanceDocument {
  const doc = emptyDocument('methealth_statement', 'payment', 'methealth');
  const lines: RemittanceLine[] = [];
  const memberTotals: MemberTotal[] = [];
  let blockLines: RemittanceLine[] = [];
  let totalPaid: number | null = null;
  let totalMemberPortion: number | null = null;
  let payable: number | null = null;
  let deposit: number | null = null;
  let anchors: number[] = [...DEFAULT_ANCHORS];
  let inLegend = false;

  for (const page of pages) {
    const rows = groupRows(page.items);
    if (rows.some(row => /^CLIENT SERVICE OFFICES/i.test(row.text)) && !rows.some(row => isHeadingRow(row))) continue;
    for (const row of rows) {
      const text = row.text;
      const upper = text.toUpperCase();

      const title = /REMITTANCE STATEMENT\s*:\s*(.+)$/i.exec(text);
      if (title) {
        doc.fundName = title[1].trim();
        continue;
      }
      if (/^PAGE\s*:\s*\d+\s+OF\s+\d+/i.test(text)) continue;
      if (/^CLIENT SERVICE OFFICES/i.test(text)) break;

      const header = /^(Practice Number|Practice Name|Statement Date|Statement Number|Reference Number)\s+(.+)$/i.exec(text);
      if (header && (row.items[0]?.x ?? 0) < 100) {
        const value = header[2].trim().split(/\s+/)[0];
        const label = header[1].toLowerCase();
        if (label === 'practice number') doc.practiceNumber = value;
        if (label === 'statement date') doc.documentDate = parseDateKey(value);
        if (label === 'statement number') doc.statementNumber = value;
        if (label === 'reference number') doc.paymentReference = value;
        continue;
      }
      if (isHeadingRow(row)) {
        anchors = anchorsFrom(row);
        inLegend = false;
        continue;
      }
      if (/^EXPLANATION OF REJECTION CODES/i.test(text)) {
        inLegend = true;
        continue;
      }
      if (inLegend) {
        const legend = /^(\d{1,4})\s*(\S.*)$/.exec(text);
        if (legend) doc.reasonLegend[legend[1]] = legend[2].trim();
        continue;
      }
      if (/^\*\*\s*TAKE NOTE/i.test(text)) {
        const amount = /AMOUNT OF\s+([\d,]+\.\d{2})/i.exec(text);
        const account = /NUMBER\s*:?\s*([\d\s-]{4,})\s*$/i.exec(text);
        deposit = amount ? parseAmountCents(amount[1]) : deposit;
        doc.bankAccountLast4 = account ? last4(account[1]) : doc.bankAccountLast4;
        continue;
      }

      const cells = cellsOf(row, anchors);
      if (/^TOTAL FOR MEMBER/i.test(upper)) {
        memberTotals.push({
          label: text.replace(/[:\s]+$/, '').replace(/\d/g, '9'),
          claimed: amountIn(cells, 'claimed'),
          paid: amountIn(cells, 'paid'),
          memberPortion: amountIn(cells, 'memberPortion'),
          lines: blockLines
        });
        blockLines = [];
        continue;
      }
      if (/^TOTAL AMOUNTS/i.test(upper)) {
        totalPaid = amountIn(cells, 'paid');
        totalMemberPortion = amountIn(cells, 'memberPortion');
        continue;
      }
      if (/^AMOUNT PAYABLE TO PRACTICE/i.test(upper)) {
        payable = amountIn(cells, 'paid');
        continue;
      }

      const serviceDate = parseDateKey(cells.date ?? null);
      const claimed = amountIn(cells, 'claimed');
      const paid = amountIn(cells, 'paid');
      if (serviceDate && claimed !== null && paid !== null) {
        const line = emptyLine(lines.length + 1, page.pageNumber);
        line.memberNumber = (cells.member ?? '').replace(/\s/g, '') || null;
        line.patientName = cells.name ?? null;
        line.practiceReference = (cells.reference ?? '').replace(/\s/g, '') || null;
        line.serviceDate = serviceDate;
        line.tariffRaw = cells.tariff ?? null;
        line.claimedCents = claimed;
        line.tariffCents = amountIn(cells, 'tariffAmount');
        line.paidCents = paid;
        line.memberPortionCents = amountIn(cells, 'memberPortion');
        const code = (cells.reject ?? '').trim();
        line.reasonCodes = /^\d{1,4}$/.test(code) ? [code] : [];
        line.status = lineStatusFromAmounts(claimed, paid);
        lines.push(line);
        blockLines.push(line);
        continue;
      }

      // A long patient name continues on a row of its own, in the name column only
      const onlyName = Object.keys(cells).length === 1 && cells.name && lines.length > 0;
      if (onlyName) {
        const previous = lines[lines.length - 1];
        previous.patientName = `${previous.patientName ?? ''} ${cells.name}`.trim();
      }
    }
  }

  for (const line of lines) {
    line.reasonTexts = line.reasonCodes.map(code => doc.reasonLegend[code]).filter((value): value is string => !!value);
  }
  doc.lines = lines;
  doc.paymentDate = doc.documentDate;
  doc.fundCode = identifyFund(doc.fundName)?.code ?? null;
  const linePaid = sumOf(lines.map(line => line.paidCents));
  const lineMemberPortion = sumOf(lines.map(line => line.memberPortionCents));
  doc.totalPaidCents = totalPaid ?? payable ?? deposit ?? linePaid;
  doc.totalMemberPortionCents = totalMemberPortion ?? lineMemberPortion;
  doc.totalClaimedCents = sumOf(lines.map(line => line.claimedCents));

  memberTotals.forEach((total, index) => {
    const label = `Member ${index + 1} subtotal`;
    if (total.claimed !== null) doc.checks.push(check(`${label}: claimed`, total.claimed, sumOf(total.lines.map(line => line.claimedCents))));
    if (total.paid !== null) doc.checks.push(check(`${label}: paid`, total.paid, sumOf(total.lines.map(line => line.paidCents))));
    if (total.memberPortion !== null) doc.checks.push(check(`${label}: member portion`, total.memberPortion, sumOf(total.lines.map(line => line.memberPortionCents))));
  });
  if (blockLines.length > 0) doc.warnings.push(`${blockLines.length} line(s) after the last member total were read without a subtotal to check them against.`);
  if (totalPaid !== null) doc.checks.push(check('Statement total paid', totalPaid, linePaid));
  else doc.warnings.push('The statement total (TOTAL AMOUNTS) was not found.');
  if (totalMemberPortion !== null) doc.checks.push(check('Statement total member portion', totalMemberPortion, lineMemberPortion));
  if (payable !== null) doc.checks.push(check('Amount payable to the practice', payable, linePaid));
  if (deposit !== null) doc.checks.push(check('Amount paid into the bank', deposit, linePaid));
  if (lines.length === 0) doc.warnings.push('No claim lines were found on this statement.');
  return doc;
}

const check = (label: string, expectedCents: number, actualCents: number) => ({ label, expectedCents, actualCents, ok: expectedCents === actualCents });
