/**
 * Medscheme "Healthcare Professional Remittance Advice" and "Monthly Statement" (NHP, NAMMED).
 *
 * Page 1 (portrait): the Payment Summary - one row per payment: scheme, date, description
 * ("ACB Payment"), reference number, void payments, amount paid - then "Total Amount:" and, on an
 * advice, a Transaction Summary (opening balance, claims processed, ACB payment, closing balance).
 * Claim pages (landscape): "Scheme: <name>" (and "Payment Date:" on a monthly statement), two
 * heading rows, then claim blocks. A block's first row carries the member number, member name,
 * the dependant code (new layout) or patient name and the scheme's claim reference (old layout), the
 * practice reference and the block's credit; the next rows carry only the line values. A block may
 * continue on the next page, where its first row is repeated without a credit. An "ACB Payment" row
 * closes a payment; its reference may wrap onto the next row, so the reference is always taken from
 * the Payment Summary. Remark codes are "/"-separated ("514/5302") and explained on the last pages.
 *
 * Amounts are right-aligned under their heading, so each amount belongs to the heading whose centre
 * is nearest. The two layouts are told apart by their headings ("Patient Name" only in the old one).
 */
import { identifyFund } from './funds';
import { centerOf, groupRows, nearestIndex, type PdfPageText, type PdfRow, type PdfTextItem } from './pdfLayout';
import { looksLikeAmount, parseAmountCents, parseDateKey, sumOf } from './text';
import {
  emptyDocument,
  emptyLine,
  type LineStatus,
  type ReconciliationCheck,
  type RemittanceDocument,
  type RemittanceLine
} from './types';

type AmountColumn = 'charged' | 'tariff' | 'levy' | 'notLiable' | 'paidToMember' | 'paidToHcp' | 'debit' | 'credit';

interface Layout {
  variant: 'new' | 'old';
  amountColumns: AmountColumn[];
  amountAnchors: number[];
  remarksX: number;
  memberNameX: number;
  patientNameX: number | null;
}

const NEW_LAYOUT: Layout = {
  variant: 'new',
  amountColumns: ['charged', 'tariff', 'levy', 'notLiable', 'paidToMember', 'paidToHcp', 'debit', 'credit'],
  amountAnchors: [424, 466.5, 505, 544, 588.5, 630.5, 673, 716],
  remarksX: 740,
  memberNameX: 84,
  patientNameX: null
};

const OLD_LAYOUT: Layout = {
  variant: 'old',
  amountColumns: ['charged', 'tariff', 'levy', 'paidToMember', 'paidToHcp', 'debit', 'credit'],
  amountAnchors: [492, 534.5, 573, 611, 653.5, 696, 738.5],
  remarksX: 762,
  memberNameX: 84,
  patientNameX: 162
};

export const isMedschemeAdvice = (text: string): boolean =>
  /Healthcare Professional\s+(Remittance Advice|Monthly Statement)/i.test(text) && /Payment Summary/i.test(text);

const isTitleRow = (row: PdfRow) => /^Healthcare Professional\s+(Remittance Advice|Monthly Statement)/i.test(row.text);
const isFirstHeadingRow = (row: PdfRow) => /\bCharged\b/.test(row.text) && /\bDebit\b/.test(row.text) && /\bCredit\b/.test(row.text);
const isSecondHeadingRow = (row: PdfRow) => /\bMember Name\b/.test(row.text) && /\bAmount\b/.test(row.text);

/** The amount anchors read from the first heading row; the known positions for anything missing */
function layoutFrom(first: PdfRow, second: PdfRow | null): Layout {
  const old = !!second && /\bPatient Name\b/.test(second.text);
  const base = old ? OLD_LAYOUT : NEW_LAYOUT;
  const anchors = [...base.amountAnchors];
  const set = (column: AmountColumn, item: PdfTextItem | undefined) => {
    const index = base.amountColumns.indexOf(column);
    if (item && index >= 0) anchors[index] = centerOf(item);
  };
  const items = first.items;
  const find = (pattern: RegExp, after = -1) => items.find(item => pattern.test(item.str.trim()) && item.x > after);
  const charged = find(/^Charged$/);
  set('charged', charged);
  set('tariff', find(/^Tariff$/, charged ? charged.x : -1));
  set('levy', find(/^Levy\/?/));
  set('notLiable', find(/^Member Not/));
  const paidTo = items.filter(item => /^Paid To$/i.test(item.str.trim()));
  set('paidToMember', paidTo[0]);
  set('paidToHcp', paidTo[1]);
  set('debit', find(/^Debit$/));
  set('credit', find(/^Credit$/));
  const remarks = [...first.items, ...(second?.items ?? [])].find(item => /^Remark Codes/i.test(item.str.trim()));
  const memberName = second?.items.find(item => /^Member Name$/i.test(item.str.trim()));
  const patientName = second?.items.find(item => /^Patient Name$/i.test(item.str.trim()));
  return {
    ...base,
    amountAnchors: anchors,
    remarksX: remarks ? remarks.x : base.remarksX,
    memberNameX: memberName ? memberName.x : base.memberNameX,
    patientNameX: old ? (patientName ? patientName.x : base.patientNameX) : null
  };
}

interface Block {
  memberNumber: string | null;
  memberName: string | null;
  patientName: string | null;
  dependantCode: string | null;
  practiceReference: string | null;
  schemeReference: string | null;
  creditCents: number | null;
  lines: RemittanceLine[];
}

interface Payment {
  reference: string | null;
  date: string | null;
  amountCents: number | null;
  lines: RemittanceLine[];
  blocks: Block[];
}

interface SummaryRow {
  scheme: string;
  date: string | null;
  description: string;
  reference: string | null;
  voidCents: number | null;
  amountCents: number | null;
}

const DATE_PATTERN = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

/** A Payment Summary row: <scheme> <date> <description> <reference> [void] <amount> */
function summaryRowOf(row: PdfRow): SummaryRow | null {
  const dateIndex = row.items.findIndex(item => DATE_PATTERN.test(item.str.trim()));
  if (dateIndex <= 0) return null;
  const after = row.items.slice(dateIndex + 1).map(item => item.str.trim());
  const amounts = after.filter(looksLikeAmount);
  if (amounts.length === 0) return null;
  const words = after.filter(text => !looksLikeAmount(text));
  const referenceIndex = words.findIndex(text => /\d/.test(text));
  return {
    scheme: row.items.slice(0, dateIndex).map(item => item.str.trim()).join(' '),
    date: parseDateKey(row.items[dateIndex].str.trim()),
    description: (referenceIndex >= 0 ? words.slice(0, referenceIndex) : words).join(' '),
    reference: referenceIndex >= 0 ? words.slice(referenceIndex).join('') : null,
    voidCents: amounts.length > 1 ? parseAmountCents(amounts[0]) : null,
    amountCents: parseAmountCents(amounts[amounts.length - 1])
  };
}

const statusOf = (claimed: number | null, paid: number, toMember: number): LineStatus => {
  const settled = paid + toMember;
  const charged = claimed ?? 0;
  if (paid < 0) return 'part_paid';
  if (charged <= 0) return settled > 0 ? 'paid' : 'info';
  if (settled >= charged) return 'paid';
  if (settled > 0) return 'part_paid';
  return 'rejected';
};

const check = (label: string, expectedCents: number, actualCents: number): ReconciliationCheck =>
  ({ label, expectedCents, actualCents, ok: expectedCents === actualCents });

export function parseMedschemeAdvice(pages: readonly PdfPageText[]): RemittanceDocument[] {
  const monthly = pages.some(page => groupRows(page.items).some(row => /Healthcare Professional\s+Monthly Statement/i.test(row.text)));
  const summary: SummaryRow[] = [];
  const legend: Record<string, string> = {};
  const warnings: string[] = [];
  const payments: Payment[] = [];
  let documentDate: string | null = null;
  let practiceNumber: string | null = null;
  let schemeName: string | null = null;
  let pagePaymentDate: string | null = null;
  let summaryTotal: number | null = null;
  let claimsProcessed: number | null = null;
  let totals: Partial<Record<AmountColumn, number>> | null = null;
  let layout: Layout = NEW_LAYOUT;
  let pending: RemittanceLine[] = [];
  let pendingBlocks: Block[] = [];
  let block: Block | null = null;
  let lastPayment: Payment | null = null;
  let legendMode: 'none' | 'benefit' | 'remark' = 'none';
  let lastLegendCode: string | null = null;
  // The transaction summary on page 1 also has an "ACB Payment" row: only rows after a claim
  // heading close a payment
  let headingSeen = false;
  let seq = 0;

  for (const page of pages) {
    const rows = groupRows(page.items);
    let inSummary = false;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const text = row.text;

      const dateLabel = /(Remittance|Statement) Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(text);
      if (dateLabel) documentDate = documentDate ?? parseDateKey(dateLabel[2]);
      if (isTitleRow(row)) continue;
      const practice = /Practice Number:\s*(\d+)/i.exec(text);
      if (practice) {
        practiceNumber = practiceNumber ?? practice[1];
        continue;
      }
      const scheme = /^Scheme:\s*(.+)$/i.exec(text);
      if (scheme) {
        schemeName = scheme[1].trim();
        continue;
      }
      const paymentDate = /^Payment Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(text);
      if (paymentDate) {
        pagePaymentDate = parseDateKey(paymentDate[1]);
        continue;
      }

      // Page 1: payment summary and transaction summary
      if (/^Payment Summary$/i.test(text)) {
        inSummary = true;
        continue;
      }
      if (inSummary) {
        if (/^Scheme\b.*\bAmount Paid$/i.test(text)) continue;
        const totalRow = /^Total Amount:\s*(-?[\d,]+\.\d{2})$/i.exec(text);
        if (totalRow) {
          summaryTotal = parseAmountCents(totalRow[1]);
          inSummary = false;
          continue;
        }
        const entry = summaryRowOf(row);
        if (entry) summary.push(entry);
        continue;
      }
      const processed = /^Claims Processed\s+(-?[\d,]+\.\d{2})$/i.exec(text);
      if (processed) {
        claimsProcessed = parseAmountCents(processed[1]);
        continue;
      }
      if (/^(Transaction Summary|Transaction Description|Opening Balance|Closing Balance|Balance [bc]\/f)\b/i.test(text)) continue;

      // Legends
      if (/^Benefit Codes/i.test(text)) {
        legendMode = 'benefit';
        continue;
      }
      if (/^Remark Codes/i.test(text)) {
        legendMode = 'remark';
        continue;
      }
      if (legendMode !== 'none') {
        if (/^Code\s+Description$/i.test(text)) continue;
        const entry = /^([A-Z0-9]{1,6})\s+(\S.*)$/.exec(text);
        if (entry && legendMode === 'remark') {
          legend[entry[1]] = entry[2].trim();
          lastLegendCode = entry[1];
        } else if (!entry && legendMode === 'remark' && lastLegendCode) {
          // A long description continues on the next row
          legend[lastLegendCode] = `${legend[lastLegendCode]} ${text}`.trim();
        }
        continue;
      }

      // Claim pages: headings
      if (isFirstHeadingRow(row)) {
        const next = rows[index + 1] && isSecondHeadingRow(rows[index + 1]) ? rows[index + 1] : null;
        layout = layoutFrom(row, next);
        headingSeen = true;
        if (next) index += 1;
        continue;
      }

      // ACB payment row (closes a payment); its reference may wrap onto the next row
      if (/^ACB Payment\b/i.test(text)) {
        if (!headingSeen) continue;
        const values = row.items.map(item => item.str.trim()).filter(value => !/^(ACB|Payment|ACB Payment)$/i.test(value));
        const amounts = values.filter(looksLikeAmount);
        const date = values.find(value => DATE_PATTERN.test(value)) ?? null;
        const reference = values.filter(value => !looksLikeAmount(value) && !DATE_PATTERN.test(value)).join('');
        let wrapped = '';
        const next = rows[index + 1];
        if (next && next.items.length === 1 && /^[A-Z0-9-]+$/i.test(next.items[0].str.trim()) && !looksLikeAmount(next.items[0].str.trim())) {
          wrapped = next.items[0].str.trim();
          index += 1;
        }
        lastPayment = {
          reference: `${reference}${wrapped}` || null,
          date: parseDateKey(date),
          amountCents: amounts.length > 0 ? parseAmountCents(amounts[amounts.length - 1]) : null,
          lines: pending,
          blocks: pendingBlocks
        };
        payments.push(lastPayment);
        pending = [];
        pendingBlocks = [];
        block = null;
        continue;
      }

      if (!headingSeen) continue;
      const dateIndex = row.items.findIndex(item => DATE_PATTERN.test(item.str.trim()));
      if (dateIndex < 0) {
        // The totals row: amounts only
        if (row.items.length > 0 && row.items.every(item => looksLikeAmount(item.str.trim()))) {
          totals = {};
          for (const item of row.items) {
            const column = layout.amountColumns[nearestIndex(centerOf(item), layout.amountAnchors)];
            totals[column] = parseAmountCents(item.str.trim()) ?? 0;
          }
        }
        continue;
      }

      // A claim line
      const left = row.items.slice(0, dateIndex);
      const right = row.items.slice(dateIndex + 1);
      const firstOfBlock = left.find(item => /^\d{6,}$/.test(item.str.trim()) && item.x < layout.memberNameX);
      if (firstOfBlock) {
        const names = left.filter(item => !/\d/.test(item.str));
        const memberName = names.filter(item => layout.patientNameX === null || Math.abs(item.x - layout.memberNameX) < Math.abs(item.x - layout.patientNameX)).map(item => item.str.trim()).join(' ') || null;
        const patientName = layout.patientNameX === null ? null : names.filter(item => Math.abs(item.x - (layout.patientNameX ?? 0)) <= Math.abs(item.x - layout.memberNameX)).map(item => item.str.trim()).join(' ') || null;
        const numbers = left.filter(item => item !== firstOfBlock && /^[A-Z]{0,4}\d+$/.test(item.str.trim()));
        const dependant = numbers.find(item => /^\d{1,2}$/.test(item.str.trim()));
        const schemeReference = numbers.find(item => /^[A-Z]{2,4}\d{6,}$/.test(item.str.trim()));
        const practiceReference = numbers.find(item => item !== dependant && item !== schemeReference && /^\d{3,}$/.test(item.str.trim()));
        block = {
          memberNumber: firstOfBlock.str.trim(),
          memberName,
          patientName,
          dependantCode: dependant ? dependant.str.trim().padStart(2, '0') : null,
          practiceReference: practiceReference ? practiceReference.str.trim() : null,
          schemeReference: schemeReference ? schemeReference.str.trim() : null,
          creditCents: null,
          lines: []
        };
        pendingBlocks.push(block);
      }
      if (!block) {
        warnings.push(`A line on page ${page.pageNumber} has no member row before it and was skipped.`);
        continue;
      }
      const rowDependant = left.find(item => /^\d{1,2}$/.test(item.str.trim()));

      // The tariff code (any NAMAF or fund code) follows the date; it is never an amount
      const tariffItem = right[0] && !looksLikeAmount(right[0].str.trim()) && right[0].x < layout.amountAnchors[0] - 20 ? right[0] : null;
      const values: Partial<Record<AmountColumn, number>> = {};
      const remarkText: string[] = [];
      let benefitCode: string | null = null;
      for (const item of tariffItem ? right.slice(1) : right) {
        const value = item.str.trim();
        if (item.x >= layout.remarksX - 4 && !looksLikeAmount(value)) {
          remarkText.push(value);
        } else if (looksLikeAmount(value)) {
          const column = layout.amountColumns[nearestIndex(centerOf(item), layout.amountAnchors)];
          values[column] = parseAmountCents(value) ?? 0;
        } else if (/^[A-Z]{2,6}$/.test(value)) {
          benefitCode = value;
        }
      }
      if (values.credit !== undefined && firstOfBlock) block.creditCents = values.credit;
      const remarks = remarkText.join('/').split(/[\s/]+/).map(code => code.trim()).filter(Boolean);

      seq += 1;
      const line = emptyLine(seq, page.pageNumber);
      line.memberNumber = block.memberNumber;
      line.memberName = block.memberName;
      line.patientName = block.patientName;
      line.dependantCode = rowDependant ? rowDependant.str.trim().padStart(2, '0') : block.dependantCode;
      line.practiceReference = block.practiceReference;
      line.fundClaimRef = block.schemeReference;
      line.serviceDate = parseDateKey(row.items[dateIndex].str.trim());
      line.tariffRaw = tariffItem ? tariffItem.str.trim() : null;
      line.description = benefitCode ? `Benefit ${benefitCode}` : null;
      line.claimedCents = values.charged ?? null;
      line.tariffCents = values.tariff ?? null;
      line.levyCents = values.levy ?? 0;
      line.memberNotLiableCents = values.notLiable ?? 0;
      line.paidToMemberCents = values.paidToMember ?? 0;
      line.paidCents = values.paidToHcp ?? 0;
      line.reasonCodes = remarks;
      line.status = statusOf(line.claimedCents, line.paidCents, line.paidToMemberCents);
      block.lines.push(line);
      pending.push(line);
    }
  }

  if (pending.length > 0) {
    if (payments.length === 0) {
      payments.push({ reference: null, date: null, amountCents: null, lines: pending, blocks: pendingBlocks });
    } else {
      warnings.push(`${pending.length} line(s) after the last ACB payment row were added to that payment.`);
      payments[payments.length - 1].lines.push(...pending);
      payments[payments.length - 1].blocks.push(...pendingBlocks);
    }
  }

  // Each claim-page payment takes its reference, date and amount from the Payment Summary
  const used = new Set<number>();
  const allLines = payments.flatMap(payment => payment.lines);
  const documents = payments.map((payment, index) => {
    let summaryIndex = summary.findIndex((entry, i) => !used.has(i) && payment.amountCents !== null && entry.amountCents === payment.amountCents && (!payment.date || !entry.date || entry.date === payment.date));
    if (summaryIndex < 0 && summary.length === payments.length && !used.has(index)) summaryIndex = index;
    const entry = summaryIndex >= 0 ? summary[summaryIndex] : null;
    if (summaryIndex >= 0) used.add(summaryIndex);

    const doc = emptyDocument(monthly ? 'medscheme_monthly' : 'medscheme_advice', monthly ? 'month_summary' : 'payment', 'medscheme');
    doc.fundName = schemeName ?? entry?.scheme ?? null;
    doc.practiceNumber = practiceNumber;
    doc.paymentReference = entry?.reference ?? payment.reference;
    doc.documentDate = documentDate;
    doc.paymentDate = entry?.date ?? payment.date ?? pagePaymentDate ?? documentDate;
    doc.reasonLegend = { ...legend };
    doc.fundCode = identifyFund(doc.fundName, entry?.scheme, doc.paymentReference)?.code ?? null;
    doc.warnings = index === 0 ? [...warnings] : [];
    doc.lines = payment.lines.map((line, lineIndex) => ({
      ...line,
      seq: lineIndex + 1,
      reasonTexts: line.reasonCodes.map(code => legend[code]).filter((value): value is string => !!value)
    }));
    const paid = sumOf(doc.lines.map(line => line.paidCents));
    doc.totalPaidCents = entry?.amountCents ?? payment.amountCents ?? paid;
    doc.totalClaimedCents = sumOf(doc.lines.map(line => line.claimedCents));

    const summaryAmount = entry ? entry.amountCents : null;
    if (payment.amountCents !== null) doc.checks.push(check('ACB payment row', payment.amountCents, paid));
    if (summaryAmount !== null) doc.checks.push(check('Payment Summary amount', summaryAmount, payment.amountCents ?? paid));
    if (!entry) doc.warnings.push('This payment was not found in the Payment Summary on page 1; its reference comes from the claim pages.');
    if (payment.reference && entry?.reference && !entry.reference.startsWith(payment.reference.slice(0, 6))) {
      doc.warnings.push('The payment reference on the claim pages differs from the Payment Summary; the summary is used.');
    }

    // Block credits (a block continued on the next page has no credit of its own: merge it back)
    const merged: Block[] = [];
    for (const current of payment.blocks) {
      const previous = merged[merged.length - 1];
      if (current.creditCents === null && previous && previous.memberNumber === current.memberNumber && previous.practiceReference === current.practiceReference) {
        previous.lines.push(...current.lines);
      } else {
        merged.push({ ...current, lines: [...current.lines] });
      }
    }
    merged.forEach((item, blockIndex) => {
      if (item.creditCents !== null) doc.checks.push(check(`Claim ${blockIndex + 1} credit`, item.creditCents, sumOf(item.lines.map(line => line.paidCents))));
    });

    if (payments.length === 1 && totals) {
      if (totals.paidToHcp !== undefined) doc.checks.push(check('Totals row: paid to practice', totals.paidToHcp, paid));
      if (totals.charged !== undefined) doc.checks.push(check('Totals row: charged', totals.charged, doc.totalClaimedCents));
    }
    if (payments.length > 1 && totals?.paidToHcp !== undefined && index === 0) {
      doc.checks.push(check('Totals row: paid to practice (all payments in the file)', totals.paidToHcp, sumOf(allLines.map(line => line.paidCents))));
    }
    if (summaryTotal !== null && index === 0) doc.checks.push(check('Payment Summary total', summaryTotal, sumOf(summary.map(row => row.amountCents))));
    if (claimsProcessed !== null && payments.length === 1) doc.checks.push(check('Claims processed', claimsProcessed, paid));
    if (doc.lines.length === 0) doc.warnings.push('No claim lines were found for this payment.');
    return doc;
  });

  return documents;
}
