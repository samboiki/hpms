/**
 * Synthetic remittance documents for the tests. They copy the layouts of the funds' real documents
 * (positions, headings, wrapping, totals) with INVENTED values only: no real patient, member,
 * practice, bank or amount appears here.
 */
import type { PdfPageText, PdfTextItem } from '../pdfLayout';

type Align = 'left' | 'right';

/** A text item at x (its left edge, or its right edge when right-aligned) on baseline y */
export function textAt(str: string, x: number, y: number, size = 8, align: Align = 'left'): PdfTextItem {
  const width = str.length * size * 0.5;
  return { str, x: align === 'right' ? x - width : x, y, width, fontSize: size };
}

export const page = (pageNumber: number, items: PdfTextItem[], rotation = 90, width = 842, height = 595): PdfPageText => ({ pageNumber, width, height, rotation, items });

/** "1234.5" -> "1,234.50" (Methealth prints thousands separators) */
export const money = (cents: number, thousands = true): string => {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = String(Math.floor(absolute / 100));
  return `${sign}${thousands ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole}.${String(absolute % 100).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------------------------
// Methealth remittance statement (NMC, PSEMAS)
// ---------------------------------------------------------------------------------------------

export interface MethealthLine {
  member: string;
  name: string;
  /** The rest of a long name, printed on a row of its own */
  nameWrap?: string;
  ref: string;
  /** dd-mm-yy */
  date: string;
  tariff: string;
  claimed: number;
  tariffAmount?: number;
  code?: string;
  paid: number;
  portion?: number;
}

export interface MethealthSpec {
  fund: string;
  statementDate?: string;
  statementNumber?: string;
  referenceNumber?: string;
  /** Lines per page; a member's lines may continue on the next page */
  pages: MethealthLine[][];
  legend?: Record<string, string>;
  account?: string;
  /** Change a printed total (to test that a misread does not reconcile) */
  totalPaidOverride?: number;
}

const M_COLS = { member: 17, name: 98, ref: 179, date: 261, tariff: 342, claimed: 423, tariffAmount: 504, code: 585, paid: 667, portion: 748 };

export function methealthStatement(spec: MethealthSpec): PdfPageText[] {
  const pages: PdfPageText[] = [];
  const all = spec.pages.flat();
  const totalPaid = all.reduce((sum, line) => sum + line.paid, 0);
  const totalPortion = all.reduce((sum, line) => sum + (line.portion ?? line.claimed - line.paid), 0);
  const pageCount = spec.pages.length + 1;
  let previousMember: string | null = null;
  let memberLines: MethealthLine[] = [];

  const memberTotalRow = (y: number, member: string, lines: MethealthLine[]): PdfTextItem[] => [
    textAt(`TOTAL FOR MEMBER ${member} :`, 17, y, 12),
    textAt(money(lines.reduce((sum, line) => sum + line.claimed, 0)), M_COLS.claimed, y, 12),
    textAt(money(lines.reduce((sum, line) => sum + (line.tariffAmount ?? line.claimed), 0)), M_COLS.tariffAmount, y, 12),
    textAt(money(lines.reduce((sum, line) => sum + line.paid, 0)), M_COLS.paid, y, 12),
    textAt(money(lines.reduce((sum, line) => sum + (line.portion ?? line.claimed - line.paid), 0)), M_COLS.portion, y, 12)
  ];

  spec.pages.forEach((lines, index) => {
    const items: PdfTextItem[] = [];
    let y = 27;
    if (index === 0) {
      items.push(textAt(`REMITTANCE STATEMENT: ${spec.fund}`, 326, 35, 12));
      items.push(textAt('HEALTH PROFESSIONAL DETAILS', 117, 57, 12), textAt('ADMINISTRATOR', 574, 57, 12));
      items.push(textAt('Practice Number', 17, 73, 12), textAt('1110000222333', 139, 73, 12));
      items.push(textAt('Practice Name', 17, 85, 12), textAt('EXAMPLE CLINIC', 140, 85, 12));
      items.push(textAt('Statement Date', 17, 97, 12), textAt(spec.statementDate ?? '06/10/2026', 141, 97, 12));
      items.push(textAt('Statement Number', 17, 109, 12), textAt(spec.statementNumber ?? '0000123457', 137, 109, 12));
      items.push(textAt('PLEASE REFER TO LAST PAGE FOR CLIENT SERVICE OFFICES CONTACT DETAILS.', 423, 114.8, 8));
      items.push(textAt('Reference Number', 17, 121, 12), textAt(spec.referenceNumber ?? '0000123456', 137, 121, 12));
      y = 135;
    }
    items.push(
      textAt('MEMBER NO', 17, y, 10), textAt('PATIENT NAME', 98, y, 10), textAt('REFERENCE', 179, y, 10), textAt('SERVICE DATE', 261, y, 10),
      textAt('TARIFF CODE', 342, y, 10), textAt('CLAIMED', 423, y, 10), textAt('TARIFF', 504, y, 10), textAt('REJECT CODE', 585, y, 10),
      textAt('PAID TO', 667, y, 10), textAt('MEMBER', 748, y, 10)
    );
    items.push(textAt('NUMBER', 179, y + 10, 10), textAt('AMOUNT', 423, y + 10, 10), textAt('AMOUNT', 504, y + 10, 10), textAt('SUPPLIER', 667, y + 10, 10), textAt('PORTION', 748, y + 10, 10));
    y += 22;
    for (const line of lines) {
      if (previousMember !== null && previousMember !== line.member) {
        items.push(...memberTotalRow(y, previousMember, memberLines));
        memberLines = [];
        y += 16;
      }
      previousMember = line.member;
      memberLines.push(line);
      items.push(
        textAt(line.member, M_COLS.member, y), textAt(line.name, M_COLS.name, y), textAt(line.ref, M_COLS.ref, y), textAt(line.date, M_COLS.date, y),
        textAt(line.tariff, M_COLS.tariff, y), textAt(money(line.claimed), M_COLS.claimed, y), textAt(money(line.tariffAmount ?? line.claimed), M_COLS.tariffAmount, y),
        textAt(money(line.paid), M_COLS.paid, y), textAt(money(line.portion ?? line.claimed - line.paid), M_COLS.portion, y)
      );
      if (line.code) items.push(textAt(line.code, M_COLS.code, y));
      if (line.nameWrap) {
        items.push(textAt(line.nameWrap, M_COLS.name, y + 8));
        y += 20;
      } else {
        y += 12;
      }
    }
    if (index === spec.pages.length - 1) {
      if (previousMember !== null) items.push(...memberTotalRow(y, previousMember, memberLines));
      y += 16;
      items.push(textAt('TOTAL AMOUNTS :', 17, y, 12), textAt(money(spec.totalPaidOverride ?? totalPaid), M_COLS.paid, y, 12), textAt(money(totalPortion), M_COLS.portion, y, 12));
      y += 16;
      items.push(textAt('AMOUNT PAYABLE TO PRACTICE:', 17, y, 12), textAt(money(totalPaid), M_COLS.paid, y, 12));
      y += 20;
      items.push(textAt(`** TAKE NOTE **THE AMOUNT OF ${money(totalPaid)} WILL BE DEPOSITED INTO YOUR ACCOUNT NUMBER ${spec.account ?? '9876543210'}`, 15, y, 12));
      y += 18;
      items.push(textAt('EXPLANATION OF REJECTION CODES :', 15, y, 12));
      for (const [code, text] of Object.entries(spec.legend ?? {})) {
        y += 18;
        items.push(textAt(`${code} ${text}`, 15, y, 12));
      }
    }
    items.push(textAt(`PAGE: ${index + 1} OF ${pageCount}`, 5, 590, 8));
    pages.push(page(index + 1, items));
  });
  pages.push(page(pageCount, [
    textAt('CLIENT SERVICE OFFICES', 17, 83, 12),
    textAt('HEAD OFFICE CLIENT SERVICE CENTRE', 17, 99, 12),
    textAt('Tel : (000) 000 0000', 17, 127, 7),
    textAt(`PAGE: ${pageCount} OF ${pageCount}`, 5, 590, 8)
  ]));
  return pages;
}

// ---------------------------------------------------------------------------------------------
// Medscheme remittance advice / monthly statement (NHP, NAMMED)
// ---------------------------------------------------------------------------------------------

export interface MedschemeLine {
  /** Only on the first line of a claim block */
  member?: string;
  memberName?: string;
  /** New layout: dependant code; old layout: the patient's name */
  dependant?: string;
  patientName?: string;
  ref?: string;
  schemeRef?: string;
  date: string;
  tariff: string;
  benefit?: string;
  charged: number;
  tariffAmount?: number;
  paidToMember?: number;
  paid: number;
  remarks?: string;
  /** Leave the block credit off (a block continued from the previous page) */
  noCredit?: boolean;
  /** The block credit as printed (the whole block's, when it continues on the next page) */
  credit?: number;
}

export interface MedschemePayment {
  reference: string;
  /** dd/mm/yyyy */
  date: string;
  /** Claim pages, each a list of lines (a page break may split a block) */
  pages: MedschemeLine[][];
  /** Wrap the reference on the claim pages' ACB row (it wraps on the real documents) */
  wrapReference?: boolean;
}

export interface MedschemeSpec {
  title?: 'Remittance Advice' | 'Monthly Statement';
  layout?: 'new' | 'old';
  scheme: string;
  /** dd/mm/yyyy */
  documentDate: string;
  payments: MedschemePayment[];
  remarkLegend?: Record<string, string>;
  /** Change the Payment Summary amount (to test that a misread does not reconcile) */
  summaryAmountOverride?: number;
}

const NEW_RIGHT = { charged: 442, tariff: 484, levy: 518, notLiable: 564, paidToMember: 606, paidToHcp: 649, debit: 691, credit: 734 };
const OLD_RIGHT = { charged: 510, tariff: 552, levy: 586, paidToMember: 629, paidToHcp: 671, debit: 714, credit: 756 };

export function medschemeAdvice(spec: MedschemeSpec): PdfPageText[] {
  const title = spec.title ?? 'Remittance Advice';
  const old = spec.layout === 'old';
  const right = old ? OLD_RIGHT : NEW_RIGHT;
  const remarksX = old ? 763 : 740;
  const dateX = old ? 361 : 293;
  const tariffX = old ? 413 : 345;
  const benefitX = old ? 449 : 381;
  const pages: PdfPageText[] = [];
  const paidOf = (payment: MedschemePayment) => payment.pages.flat().reduce((sum, line) => sum + line.paid, 0);

  // Page 1: payment summary
  const first: PdfTextItem[] = [
    textAt('0000001', 74, 153, 10),
    textAt('EXAMPLE CLINIC', 74, 170, 10),
    textAt(`Healthcare Professional ${title}`, 112, 300, 18),
    textAt(`${title === 'Monthly Statement' ? 'Statement' : 'Remittance'} Date: ${spec.documentDate}`, 207, 321.7, 14),
    textAt('Payment Summary', 31, 357.3, 10),
    textAt('Scheme', 31, 372, 7), textAt('Date', 255, 372, 7), textAt('Description', 286, 372, 7), textAt('Reference Number', 357, 372, 7), textAt('Void Payments', 457, 372, 7), textAt('Amount Paid', 521, 372, 7)
  ];
  let y = 385.3;
  for (const payment of spec.payments) {
    first.push(textAt(spec.scheme, 32, y, 7), textAt(payment.date, 245, y, 7), textAt('ACB Payment', 287, y, 7), textAt(payment.reference, 358, y, 7),
      textAt(money(spec.summaryAmountOverride ?? paidOf(payment), false), 564, y, 7, 'right'));
    y += 12.2;
  }
  const total = spec.payments.reduce((sum, payment) => sum + paidOf(payment), 0);
  first.push(textAt('Total Amount:', 357, y, 7), textAt(money(spec.summaryAmountOverride ?? total, false), 564, y, 7, 'right'));
  if (title === 'Remittance Advice') {
    first.push(
      textAt('Transaction Summary', 31, 431, 10),
      textAt('Transaction Description', 31, 445.7, 7), textAt('Amount', 564, 445.7, 7, 'right'),
      textAt('Opening Balance', 32, 458.5, 7), textAt('0.00', 564, 458.5, 7, 'right'),
      textAt('Claims Processed', 32, 469.8, 7), textAt(money(total, false), 564, 469.8, 7, 'right'),
      textAt('ACB Payment', 32, 481.2, 7), textAt(money(-total, false), 564, 481.2, 7, 'right'),
      textAt('Closing Balance', 32, 492.5, 7), textAt('0.00', 564, 492.5, 7, 'right')
    );
  }
  first.push(textAt('IMPORTANT: claims must reach the fund within four months of treatment.', 32, 540, 8));
  pages.push(page(1, first, 0, 595, 842));

  let pageNumber = 1;
  const titleRows = (items: PdfTextItem[]) => {
    items.push(textAt(`Healthcare Professional ${title}`, 17, 28.5, 14), textAt(`${title === 'Monthly Statement' ? 'Statement' : 'Remittance'} Date: ${spec.documentDate}`, 686, 28.5, 10));
    items.push(textAt('Practice Number: 0000001', 28, 54, 10), textAt('Practice Name: EXAMPLE CLINIC', 194, 54, 10), textAt(`Page: ${pageNumber}`, 775, 54, 10));
  };
  const header = (items: PdfTextItem[]) => {
    titleRows(items);
    items.push(textAt(`Scheme: ${spec.scheme}`, 17, 76.7, 10));
    if (old) {
      items.push(textAt('Member', 26, 104.4, 7), textAt('Treatment', 362, 104.4, 7), textAt('Tariff', 412, 104.4, 7), textAt('Benefit', 445, 104.4, 7), textAt('Charged', 478, 104.4, 7),
        textAt('Tariff', 526, 104.4, 7), textAt('Levy/', 564, 104.4, 7), textAt('Paid To', 598, 104.4, 7), textAt('Paid To', 641, 104.4, 7), textAt('Debit', 687, 104.4, 7), textAt('Credit', 728, 104.4, 7));
      items.push(textAt('Number', 26, 116.3, 7), textAt('Member Name', 84, 116.3, 7), textAt('Patient Name', 162, 116.3, 7), textAt('Practice Reference', 225, 116.3, 7), textAt('Reference', 309, 116.3, 7),
        textAt('Date', 371, 116.3, 7), textAt('Code', 412, 116.3, 7), textAt('Code*', 446, 116.3, 7), textAt('Amount', 479, 116.3, 7), textAt('Amount', 521, 116.3, 7), textAt('Copay', 562, 116.3, 7),
        textAt('Member', 597, 116.3, 7), textAt('HCP', 646, 116.3, 7), textAt('Amount', 683, 116.3, 7), textAt('Amount', 725, 116.3, 7), textAt('Remark Codes**', 762, 116.3, 7));
    } else {
      items.push(textAt('Member', 26, 90.3, 7), textAt('Dependant', 170, 90.3, 7), textAt('Practice', 244, 90.3, 7), textAt('Treatment', 293, 90.3, 7), textAt('Tariff', 344, 90.3, 7),
        textAt('Benefit', 376, 90.3, 7), textAt('Charged', 410, 90.3, 7), textAt('Tariff', 458, 90.3, 7), textAt('Levy/', 496, 90.3, 7), textAt('Member Not', 524, 90.3, 7),
        textAt('Paid To', 576, 90.3, 7), textAt('Paid To', 618, 90.3, 7), textAt('Debit', 664, 90.3, 7), textAt('Credit', 706, 90.3, 7));
      items.push(textAt('Number', 26, 102.2, 7), textAt('Member Name', 84, 102.2, 7), textAt('Code', 180, 102.2, 7), textAt('Reference', 241, 102.2, 7), textAt('Date', 303, 102.2, 7),
        textAt('Code', 344, 102.2, 7), textAt('Code*', 378, 102.2, 7), textAt('Amount', 411, 102.2, 7), textAt('Amount', 453, 102.2, 7), textAt('Copay', 494, 102.2, 7),
        textAt('Liable', 534, 102.2, 7), textAt('Member', 575, 102.2, 7), textAt('HCP', 623, 102.2, 7), textAt('Amount', 660, 102.2, 7), textAt('Amount', 703, 102.2, 7), textAt('Remark Codes**', 740, 102.2, 7));
    }
    return old ? 128.5 : 114.3;
  };

  // Continuation rows of the new layout repeat the block's dependant code
  let blockDependant = '00';
  const lineItems = (line: MedschemeLine, y: number, credit: number | null): PdfTextItem[] => {
    const items: PdfTextItem[] = [];
    if (line.member) blockDependant = line.dependant ?? '00';
    if (line.member) {
      items.push(textAt(line.member, 18, y, 7), textAt(line.memberName ?? 'MR A EXAMPLE', 69, y, 7));
      if (old) {
        items.push(textAt(line.patientName ?? 'Anna', 154, y, 7), textAt(line.ref ?? '0000001', 222, y, 7), textAt(line.schemeRef ?? 'EDI0000000001', 298, y, 7));
      } else {
        items.push(textAt(line.dependant ?? '00', 154, y, 7), textAt(line.ref ?? '0000001', 230, y, 7));
      }
      if (credit !== null && !line.noCredit) items.push(textAt(money(line.credit ?? credit, false), right.credit, y, 7, 'right'));
    } else if (!old) {
      items.push(textAt(line.dependant ?? blockDependant, 154, y, 7));
    }
    items.push(textAt(line.date, dateX, y, 7), textAt(line.tariff, tariffX, y, 7));
    if (line.benefit !== undefined && line.benefit !== '') items.push(textAt(line.benefit, benefitX, y, 7));
    items.push(
      textAt(money(line.charged, false), right.charged, y, 7, 'right'),
      textAt(money(line.tariffAmount ?? (line.paid > 0 ? line.charged : 0), false), right.tariff, y, 7, 'right'),
      textAt('0.00', right.levy, y, 7, 'right'),
      textAt(money(line.paidToMember ?? 0, false), right.paidToMember, y, 7, 'right'),
      textAt(money(line.paid, false), right.paidToHcp, y, 7, 'right')
    );
    if (line.remarks) items.push(textAt(line.remarks, remarksX, y, 7));
    return items;
  };

  for (const payment of spec.payments) {
    payment.pages.forEach((lines, pageIndex) => {
      pageNumber += 1;
      const items: PdfTextItem[] = [];
      let rowY = header(items);
      if (pageIndex === 0 && payment === spec.payments[0]) {
        items.push(textAt('Opening Balance', 69, rowY, 7), textAt('0.00', right.paidToHcp, rowY, 7, 'right'), textAt('0.00', right.credit, rowY, 7, 'right'));
      }
      rowY += 11.4;
      // Block credits: the sum of Paid To HCP of the block's lines on this page
      lines.forEach((line, index) => {
        let credit: number | null = null;
        if (line.member) {
          credit = 0;
          for (let next = index; next < lines.length && (next === index || !lines[next].member); next += 1) credit += lines[next].paid;
        }
        items.push(...lineItems(line, rowY, credit));
        rowY += 11.3;
      });
      if (pageIndex === payment.pages.length - 1) {
        const paid = paidOf(payment);
        const [head, tail] = payment.wrapReference ? [payment.reference.slice(0, -4), payment.reference.slice(-4)] : [payment.reference, ''];
        items.push(textAt('ACB Payment', 69, rowY, 7), textAt(head, old ? 222 : 230, rowY, 7), textAt(payment.date, dateX, rowY, 7), textAt(money(paid, false), right.debit, rowY, 7, 'right'));
        if (tail) items.push(textAt(tail, old ? 222 : 230, rowY + 11.4, 7));
        rowY += tail ? 22.8 : 11.4;
        items.push(textAt('Balance b/f', 69, rowY, 7), textAt('0.00', right.debit, rowY, 7, 'right'));
        rowY += 12.2;
        if (payment === spec.payments[spec.payments.length - 1]) {
          const all = spec.payments.flatMap(item => item.pages.flat());
          const sum = (pick: (line: MedschemeLine) => number) => money(all.reduce((acc, line) => acc + pick(line), 0), false);
          items.push(
            textAt(sum(line => line.charged), right.charged, rowY, 7, 'right'),
            textAt(sum(line => line.tariffAmount ?? (line.paid > 0 ? line.charged : 0)), right.tariff, rowY, 7, 'right'),
            textAt('0.00', right.levy, rowY, 7, 'right'),
            textAt(sum(line => line.paidToMember ?? 0), right.paidToMember, rowY, 7, 'right'),
            textAt(sum(line => line.paid), right.paidToHcp, rowY, 7, 'right'),
            textAt(sum(line => line.paid), right.debit, rowY, 7, 'right'),
            textAt(sum(line => line.paid), right.credit, rowY, 7, 'right')
          );
          rowY += 12.7;
          items.push(textAt('Balance c/f', 405, rowY, 7), textAt('0.00', right.credit, rowY, 7, 'right'));
        }
      }
      pages.push(page(pageNumber, items, 0, 842, 595));
    });
  }

  pageNumber += 1;
  const legend: PdfTextItem[] = [];
  titleRows(legend);
  let ly = 76.7;
  legend.push(textAt('Benefit Codes*', 17, ly, 10));
  legend.push(textAt('Code', 17, ly + 13.3, 7), textAt('Description', 74, ly + 13.3, 7));
  legend.push(textAt('GEN', 18, ly + 24.6, 7), textAt('GENERAL BENEFIT', 74, ly + 24.6, 7));
  ly += 45;
  legend.push(textAt('Remark Codes**', 17, ly, 10));
  legend.push(textAt('Code', 17, ly + 13.2, 7), textAt('Description', 74, ly + 13.2, 7));
  Object.entries(spec.remarkLegend ?? {}).forEach(([code, text], index) => {
    legend.push(textAt(code, 18, ly + 24.6 + index * 11.3, 7), textAt(text, 74, ly + 24.6 + index * 11.3, 7));
  });
  pages.push(page(pageNumber, legend, 0, 842, 595));
  return pages;
}

// ---------------------------------------------------------------------------------------------
// NHP batch claim acknowledgement
// ---------------------------------------------------------------------------------------------

export interface AckLine {
  rx: string;
  date: string;
  adminRef: string;
  member: string;
  dep: string;
  item: string;
  code?: string;
  claimed?: number;
  processed?: number;
  /** Messages as printed: each string is one printed row of the notes column */
  notes?: string[];
}

export function nhpAcknowledgement(fileName: string, claims: AckLine[][]): PdfPageText[] {
  const items: PdfTextItem[] = [
    textAt('BATCH CLAIM ACKNOWLEDGEMENT', 135, 169.1, 18),
    textAt('Healthcare Professional', 95, 199.5, 10), textAt('EXAMPLE CLINIC', 218, 199.5, 10),
    textAt('Practice Number', 131, 215.5, 10), textAt('0000001', 218, 215.5, 10),
    textAt('File Name', 163, 230.5, 10), textAt(fileName, 218, 230.5, 10),
    textAt('Date Received', 142, 246.5, 10), textAt('03/10/2026 10:15', 218, 246.5, 10),
    textAt('Claim Counts', 258, 268.4, 12),
    textAt('Claims Submitted', 35, 287.5, 10), textAt(String(claims.length), 299, 287.5, 10), textAt('Claims created', 313, 287.5, 10), textAt(String(claims.length), 476, 287.5, 10)
  ];
  const total = claims.flat().reduce((sum, line) => sum + (line.claimed ?? 0), 0);
  items.push(textAt('Total amount claimed', 35, 335.5, 10), textAt(`R${money(total, false)}`, 256, 335.5, 10));
  items.push(textAt('Feedback from Interpharm/Administrator', 207, 356.7, 10));
  items.push(textAt('Rx No.', 41, 370.6, 7), textAt('Rx Date', 80, 370.6, 7), textAt('Admin Ref', 124, 370.6, 7), textAt('Member No.', 170, 370.6, 7), textAt('Dep', 238, 370.6, 7),
    textAt('Alt Claim No', 269, 370.6, 7), textAt('Item', 322, 370.6, 7), textAt('Code', 345, 370.6, 7), textAt('Claimed', 373, 370.6, 7), textAt('Processed', 408, 370.6, 7), textAt('Errors and Notes', 475, 370.6, 7));
  let y = 380.6;
  for (const claim of claims) {
    for (const line of claim) {
      items.push(textAt(line.rx, 31, y, 7), textAt(line.date, 77, y, 7), textAt(line.adminRef, 122, y, 7), textAt(line.member, 170, y, 7), textAt(line.dep, 220, y, 7), textAt(line.item, 327, y, 7));
      if (line.code) items.push(textAt(line.code, 346, y, 7));
      if (line.claimed !== undefined) items.push(textAt(money(line.claimed, false), 405, y, 7, 'right'));
      if (line.processed !== undefined) items.push(textAt(money(line.processed, false), 442, y, 7, 'right'));
      const notes = line.notes ?? [];
      if (notes[0]) items.push(textAt(notes[0], 444, y, 7));
      for (const note of notes.slice(1)) {
        y += 8.2;
        items.push(textAt(note, 444, y, 7));
      }
      y += 10.8;
    }
    const claimed = claim.reduce((sum, line) => sum + (line.claimed ?? 0), 0);
    const processed = claim.reduce((sum, line) => sum + (line.processed ?? 0), 0);
    items.push(textAt(money(claimed, false), 405, y, 7, 'right'), textAt(money(processed, false), 442, y, 7, 'right'), textAt('Script Total', 484, y, 7));
    y += 12;
  }
  items.push(textAt('Page 1 of 1', 47, 814.6, 8), textAt('Please note that the above information, is not a guarantee of payment, and is subject to scheme rules', 155, 814.6, 8));
  return [page(1, items, 0, 595, 842)];
}

// ---------------------------------------------------------------------------------------------
// CSV responses
// ---------------------------------------------------------------------------------------------

export const NMC_HEADER = "HP NO-NAME,REFERENCE,MEMBER,MAIN MEMBER,DEP NO,BENEFICIARY,SERV DATE,PAY INDICATOR,PAYMENT DATE,RECEIVED DATE,TARIFF,DESCRIPTION,UNITS ,CLAIMEDAMOUNT,TARIFFAMOUNT,BENEFITAMOUNT,AHB,DISCOUNT,NOT PAID,MEMBER'S LEVY,EXCESS OF TARIFF,CLAIMSTATUS,CODE,NOTE,BATCH,CLAIM NO,ITEM,NAME,NAPPI,QTY,CLAIMED,BENEFIT,STATUS,REJECT CODE,REJECT MESSAGE";

export interface NmcRow {
  ref: string;
  member: string;
  dep?: string;
  beneficiary?: string;
  date: string;
  tariff: string;
  description?: string;
  claimed: number;
  benefit: number;
  status: 'ASSESSED' | 'PENDED' | 'REJECTED';
  code?: string;
  note?: string;
  claim: string;
  item: string;
}

/** Rows as the fund writes them: padded values, 27 fields (no medicine columns) */
export function nmcCsv(rows: NmcRow[]): string {
  const lines = rows.map(row => [
    '1110000222333-EXAMPLE CLINIC', row.ref, row.member, 'A EXAMPLE', row.dep ?? '00', row.beneficiary ?? 'ANNA EXAMPLE', row.date, 'D', '          ', '01/10/2026',
    row.tariff, ` ${row.description ?? 'CONSULTATION'}`, '        0.00', ` ${money(row.claimed, false)}`, ` ${money(row.claimed, false)}`, ` ${money(row.benefit, false)}`, '               ',
    ' 0.00', ` ${money(row.claimed - row.benefit, false)}`, ' 0.00', ` ${money(row.claimed - row.benefit, false)}`, row.status, row.code ?? '   ', row.note ?? '', '0000000777', row.claim, row.item
  ].join(','));
  return [NMC_HEADER, ...lines].join('\n') + '\n';
}

export function switchOnCsv(rows: Array<{ date: string; account: string; patient: string; claim: string; status: string; amount: string }>, totalOverride?: string): string {
  const total = rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
  return [
    ',,SwitchOn Navigator Report,,,,',
    'Message Type:,ALL,,,From Date:,01/09/2026,',
    ',,,,,,',
    'SwitchOn Type:,ALL,,,To Date:,30/09/2026,',
    'Account:,ALL,,,Claim No:,ALL,',
    ',,,,,,',
    'DATE,ACCOUNT,PATIENT,CLAIM,CODE,STATUS,MEDAID',
    ...rows.map(row => [row.date, row.account, `${row.patient}      `, row.claim, 'PSMD0001', row.status, row.amount].join(',')),
    `,,Total Claims : ${rows.length},,,Total Amount:,${totalOverride ?? money(total, false)}`
  ].join('\r\n') + '\r\n';
}
