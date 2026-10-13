/**
 * NHP "Batch Claim Acknowledgement" (PDF): the administrator's receipt for an uploaded claim file,
 * with what it did with every line. No money: lines with errors and nothing processed go to the
 * rejection queue, the rest wait for the remittance advice.
 *
 *   BATCH CLAIM ACKNOWLEDGEMENT
 *   Healthcare Professional / Practice Number / File Name (<practice>_<batch>_<FUND>_Dat.processed) / Date Received
 *   Claim Counts ... Total amount claimed R<amount>
 *   Rx No. | Rx Date | Admin Ref | Member No. | Dep | Alt Claim No | Item | Code | Claimed | Processed | Errors and Notes
 *   messages wrap onto rows of their own; several messages are separated by "--"
 *   "Script Total" after each claim and "Total" at the end
 * Rx No. is the reference the practice sent (matched like any practice reference); messages have no
 * codes, so reasonCodes.ts classifies them by their wording.
 */
import { identifyFund } from './funds';
import { centerOf, groupRows, nearestIndex, rightEdge, type PdfPageText, type PdfRow } from './pdfLayout';
import { looksLikeAmount, parseAmountCents, parseDateKey, sumOf } from './text';
import { emptyDocument, emptyLine, type LineStatus, type RemittanceDocument, type RemittanceLine } from './types';

type Column = 'rx' | 'date' | 'adminRef' | 'member' | 'dependant' | 'altClaim' | 'item' | 'code' | 'claimed' | 'processed';

const COLUMNS: readonly Column[] = ['rx', 'date', 'adminRef', 'member', 'dependant', 'altClaim', 'item', 'code', 'claimed', 'processed'];
const DEFAULT_CENTERS: readonly number[] = [52, 93, 141.5, 190, 245, 290, 329, 354, 387, 426];
const DEFAULT_NOTES_LEFT = 443;

const HEADINGS: Array<{ column: Column; pattern: RegExp }> = [
  { column: 'rx', pattern: /^Rx No\.?$/i },
  { column: 'date', pattern: /^Rx Date$/i },
  { column: 'adminRef', pattern: /^Admin Ref$/i },
  { column: 'member', pattern: /^Member No\.?$/i },
  { column: 'dependant', pattern: /^Dep$/i },
  { column: 'altClaim', pattern: /^Alt Claim No$/i },
  { column: 'item', pattern: /^Item$/i },
  { column: 'code', pattern: /^Code$/i },
  { column: 'claimed', pattern: /^Claimed$/i },
  { column: 'processed', pattern: /^Processed$/i }
];

export const isNhpAcknowledgement = (text: string): boolean => /BATCH CLAIM ACKNOWLEDGEMENT/i.test(text) && /Errors and Notes/i.test(text);

const isHeadingRow = (row: PdfRow) => /\bRx No\b/i.test(row.text) && /\bProcessed\b/i.test(row.text);

const statusOf = (claimed: number | null, processed: number | null, notes: string[]): LineStatus => {
  if (notes.some(note => /held for manual|manual intervention/i.test(note))) return 'pended';
  if (claimed === null) return notes.length > 0 ? 'rejected' : 'info';
  const done = processed ?? 0;
  if (done >= claimed) return 'accepted';
  if (done > 0) return 'part_paid';
  return 'rejected';
};

/** "Claim line submitted without -- diagnosis codes -- Tooth number(s) required." -> separate messages */
export function splitMessages(text: string): string[] {
  return text
    .split(/\s*--\s*/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function parseNhpAcknowledgement(pages: readonly PdfPageText[]): RemittanceDocument {
  const doc = emptyDocument('nhp_acknowledgement', 'acknowledgement', 'medscheme');
  let centers = [...DEFAULT_CENTERS];
  let notesLeft = DEFAULT_NOTES_LEFT;
  let fileName: string | null = null;
  let totalClaimed: number | null = null;
  const notesByLine = new Map<RemittanceLine, string[]>();
  let current: RemittanceLine | null = null;
  let scriptLines: RemittanceLine[] = [];
  let scriptIndex = 0;

  for (const page of pages) {
    for (const row of groupRows(page.items)) {
      const text = row.text;
      const label = /^(Practice Number|File Name|Date Received)\s+(.+)$/i.exec(text);
      if (label && (row.items[0]?.x ?? 0) < 215) {
        const name = label[1].toLowerCase();
        if (name === 'practice number') doc.practiceNumber = label[2].trim();
        if (name === 'file name') fileName = label[2].trim();
        if (name === 'date received') doc.documentDate = parseDateKey(label[2].trim().split(/\s+/)[0]);
        continue;
      }
      const total = /^Total amount claimed\s+(\S+)$/i.exec(text);
      if (total) {
        totalClaimed = parseAmountCents(total[1]);
        continue;
      }
      if (isHeadingRow(row)) {
        centers = [...DEFAULT_CENTERS];
        for (const item of row.items) {
          const heading = HEADINGS.find(entry => entry.pattern.test(item.str.trim()));
          if (heading) centers[COLUMNS.indexOf(heading.column)] = centerOf(item);
          if (heading?.column === 'processed') notesLeft = rightEdge(item) - 2;
        }
        continue;
      }
      if (/^Page \d+ of \d+/i.test(text) || /not a guarantee of payment/i.test(text)) continue;

      const noteItems = row.items.filter(item => item.x >= notesLeft && !looksLikeAmount(item.str.trim()));
      const valueItems = row.items.filter(item => !noteItems.includes(item));
      const noteText = noteItems.map(item => item.str.trim()).join(' ');

      if (/Script Total$|^Total$/i.test(noteText.trim()) && valueItems.every(item => looksLikeAmount(item.str.trim()))) {
        const amounts = valueItems.map(item => ({ column: COLUMNS[nearestIndex(centerOf(item), centers)], cents: parseAmountCents(item.str.trim()) ?? 0 }));
        const claimed = amounts.find(amount => amount.column === 'claimed')?.cents;
        if (/Script Total/i.test(noteText) && claimed !== undefined) {
          scriptIndex += 1;
          const actual = sumOf(scriptLines.map(line => line.claimedCents));
          doc.checks.push({ label: `Claim ${scriptIndex} total claimed`, expectedCents: claimed, actualCents: actual, ok: claimed === actual });
          scriptLines = [];
        }
        continue;
      }

      const cells: Partial<Record<Column, string>> = {};
      for (const item of valueItems) {
        const column = COLUMNS[nearestIndex(centerOf(item), centers)];
        cells[column] = cells[column] ? `${cells[column]} ${item.str.trim()}` : item.str.trim();
      }
      const date = parseDateKey(cells.date ?? null);
      if (date && (cells.rx || cells.member)) {
        const line = emptyLine(doc.lines.length + 1, page.pageNumber);
        line.practiceReference = cells.rx ?? null;
        line.serviceDate = date;
        line.fundClaimRef = cells.adminRef ?? null;
        line.memberNumber = cells.member ?? null;
        const dependant = (cells.dependant ?? '').trim();
        if (/^\d{1,2}$/.test(dependant)) line.dependantCode = dependant.padStart(2, '0');
        else if (dependant) line.patientName = dependant;
        line.tariffRaw = cells.code ?? null;
        line.claimedCents = parseAmountCents(cells.claimed ?? null);
        line.paidCents = parseAmountCents(cells.processed ?? null) ?? 0;
        doc.lines.push(line);
        notesByLine.set(line, noteText ? [noteText] : []);
        current = line;
        if (line.claimedCents !== null) scriptLines.push(line);
        continue;
      }
      // A message continued on the next row
      if (current && noteText && valueItems.length === 0) notesByLine.get(current)?.push(noteText);
    }
  }

  for (const line of doc.lines) {
    line.reasonTexts = splitMessages((notesByLine.get(line) ?? []).join(' '));
    line.status = statusOf(line.claimedCents, line.paidCents, line.reasonTexts);
  }
  const fundFromFile = fileName ? /_([A-Z0-9]{4})_Dat/i.exec(fileName)?.[1] ?? null : null;
  const fund = identifyFund(fundFromFile, 'NHPM');
  doc.fundCode = fund?.code ?? null;
  doc.fundName = fund?.label ?? null;
  doc.statementNumber = fileName;
  doc.totalClaimedCents = sumOf(doc.lines.map(line => line.claimedCents));
  doc.totalPaidCents = sumOf(doc.lines.map(line => line.paidCents));
  if (totalClaimed !== null) {
    doc.checks.push({ label: 'Total amount claimed', expectedCents: totalClaimed, actualCents: doc.totalClaimedCents, ok: totalClaimed === doc.totalClaimedCents });
  }
  if (doc.lines.length === 0) doc.warnings.push('No claim lines were found in this acknowledgement.');
  return doc;
}
