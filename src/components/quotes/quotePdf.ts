/**
 * The printable quote (treatment estimate), drawn like the practice's invoice PDF (components/billing/invoicePdf.ts):
 * a header band in the practice colour with its name and contacts, the document title, number and dates
 * on the right, the patient block, the lines table, totals, then licence, tax number and bank details in
 * the footer of every page. buildQuoteDocument decides every word and amount (tested); renderQuotePdf
 * only draws it.
 */
import jsPDF from 'jspdf';
import { formatNad } from '../../utils/billing/money';
import { practiceMessageFor, type DocumentSettings } from '../../utils/billing/documentSettings';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import { formatDayFirst, type QuoteLineRecord, type QuoteRecord } from './quotes';

export interface PracticeLetterhead {
  id: string;
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  practiceNumber: string | null;
  licenseNumber: string | null;
  taxNumber: string | null;
  primaryColor: string | null;
  bankName: string | null;
  accountNumber: string | null;
  branchCode: string | null;
  /** The practice's message on its invoices, quotes and statements (parity D22); absent when not read */
  documentSettings?: DocumentSettings | null;
  /** practices.practice_type: a dental practice's quote prints a Tooth column; absent when not read */
  practiceType?: string | null;
}

export interface QuotePatientInfo {
  name: string;
  phone: string | null;
  email: string | null;
}

export interface QuoteDocumentRow {
  code: string;
  description: string;
  tooth: string;
  quantity: string;
  unitPrice: string;
  total: string;
  medicalAid: string;
  patient: string;
}

export interface QuoteDocument {
  title: string;
  number: string;
  dateText: string;
  validUntilText: string;
  primaryColor: string;
  practiceName: string;
  practiceLines: string[];
  patientLines: string[];
  rows: QuoteDocumentRow[];
  /** Dental practices only (isDentalPractice): other disciplines never bill a tooth, so their quote has no Tooth column */
  showTooth: boolean;
  totals: { label: string; value: string; bold?: boolean }[];
  notes: string[];
  footerLeft: string[];
  footerRight: string[];
  fileName: string;
}

const DEFAULT_COLOUR = '#01b9d4';
const present = (value: string | null | undefined): value is string => Boolean(value?.trim());

/** Every word and amount on the printed quote. */
export function buildQuoteDocument(
  quote: QuoteRecord,
  lines: readonly QuoteLineRecord[],
  practice: PracticeLetterhead,
  patient: QuotePatientInfo
): QuoteDocument {
  const place = [practice.city, practice.country].filter(present).join(', ');
  const practiceLines = [
    practice.address,
    place ? `${place}${present(practice.postalCode) ? ` ${practice.postalCode}` : ''}` : null,
    present(practice.contactPhone) ? `Tel: ${practice.contactPhone}` : null,
    present(practice.contactEmail) ? `Email: ${practice.contactEmail}` : null,
    present(practice.practiceNumber) ? `Practice no: ${practice.practiceNumber}` : null
  ].filter(present);

  const medicalAid = [quote.medicalAidName, quote.medicalAidScheme].filter(present).join(' - ');
  const patientLines = [
    patient.name,
    present(patient.phone) ? `Phone: ${patient.phone}` : null,
    present(patient.email) ? `Email: ${patient.email}` : null,
    medicalAid
      ? `Medical aid: ${medicalAid}${present(quote.membershipNumber) ? ` (member no ${quote.membershipNumber})` : ''}`
      : 'Medical aid: none on file (private patient)'
  ].filter(present);

  const rows = [...lines]
    .sort((a, b) => a.lineNo - b.lineNo)
    .map(line => ({
      code: line.code,
      description: line.description,
      tooth: line.toothNumbers.join(', '),
      quantity: String(line.quantity),
      unitPrice: formatNad(line.unitPrice),
      total: formatNad(line.totalPrice),
      medicalAid: formatNad(line.medicalAidEstimate),
      patient: formatNad(line.patientEstimate)
    }));

  const notes = [
    quote.estimateNote,
    present(quote.preauthNumber) ? `Pre-authorisation number: ${quote.preauthNumber}` : null,
    present(quote.fundReference) ? `Fund reference: ${quote.fundReference}` : null,
    present(quote.notes) ? `Notes: ${quote.notes}` : null,
    `This is an estimate, not an invoice. It is valid until ${formatDayFirst(quote.validUntil)}. The final account is based on the treatment given and the tariffs in effect on the day of treatment.`,
    // The practice's own message, when it prints on quotes (Finance > Debtors > Statements > Messages and settings)
    practiceMessageFor(practice.documentSettings, 'quote'),
    'I accept this estimate.   Signature: ______________________________   Date: ______________'
  ].filter(present);

  const footerLeft = [
    present(practice.licenseNumber) ? `Licence: ${practice.licenseNumber}` : null,
    present(practice.taxNumber) ? `Tax no: ${practice.taxNumber}` : null
  ].filter(present);
  const footerRight =
    present(practice.bankName) && present(practice.accountNumber)
      ? [practice.bankName, `Acc: ${practice.accountNumber}`, present(practice.branchCode) ? `Branch: ${practice.branchCode}` : null].filter(present)
      : [];

  return {
    title: 'TREATMENT ESTIMATE',
    number: quote.quoteNumber,
    dateText: formatDayFirst(quote.quoteDate),
    validUntilText: formatDayFirst(quote.validUntil),
    primaryColor: present(practice.primaryColor) ? practice.primaryColor : DEFAULT_COLOUR,
    practiceName: practice.name,
    practiceLines,
    patientLines,
    rows,
    showTooth: isDentalPractice(practice.practiceType),
    totals: [
      { label: 'Total', value: formatNad(quote.subtotal), bold: true },
      { label: 'Medical aid (estimated)', value: formatNad(quote.medicalAidEstimate) },
      { label: 'Patient portion (estimated)', value: formatNad(quote.patientEstimate), bold: true }
    ],
    notes,
    footerLeft,
    footerRight,
    fileName: `estimate-${quote.quoteNumber.replace(/[^A-Za-z0-9-]/g, '')}.pdf`
  };
}

const hexToRgb = (hex: string): [number, number, number] => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [1, 185, 212];
};

/** Draws the document on A4 pages. */
export function renderQuotePdf(doc: QuoteDocument): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const headerHeight = 38;
  const footerTop = pageHeight - 22;
  const rowHeight = 7;
  const [r, g, b] = hexToRgb(doc.primaryColor);

  // Code, description, tooth, qty, unit price, total, medical aid, patient (mm, adds up to contentWidth). The tooth
  // column is for dental practices only: elsewhere it is left out and the description takes its width.
  const TOOTH_COLUMN = 2;
  const shown = <T>(cells: readonly T[]): T[] => cells.filter((_cell, index) => doc.showTooth || index !== TOOTH_COLUMN);
  const widths = doc.showTooth ? [15, 54, 12, 9, 21, 21, 24, 24] : [15, 66, 9, 21, 21, 24, 24];
  const columns = widths.reduce<number[]>((xs, _width, index) => [...xs, index === 0 ? margin : xs[index - 1] + widths[index - 1]], []);
  const headings = shown(['Code', 'Description', 'Tooth', 'Qty', 'Unit price', 'Total', 'Medical aid', 'Patient']);
  // The quantity and the amounts are right-aligned
  const rightAligned = new Set(headings.map((_heading, index) => index).filter(index => index >= headings.indexOf('Qty')));

  const drawTableHeader = (y: number): number => {
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, y, contentWidth, rowHeight, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0);
    headings.forEach((heading, index) => {
      const x = rightAligned.has(index) ? columns[index] + widths[index] - 1.5 : columns[index] + 1.5;
      pdf.text(heading, x, y + 4.8, rightAligned.has(index) ? { align: 'right' } : undefined);
    });
    return y + rowHeight;
  };

  const fit = (value: string, width: number): string => {
    const lines = pdf.splitTextToSize(value, width - 3) as string[];
    return lines.length > 1 ? `${lines[0].replace(/\s+\S*$/, '')}...` : lines[0] ?? '';
  };

  // First page: patient block and dates
  let y = headerHeight + 10;
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Prepared for:', margin, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  doc.patientLines.forEach((line, index) => pdf.text(fit(line, contentWidth * 0.6), margin, y + 5 + index * 4.5));
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Date: ${doc.dateText}`, pageWidth - margin, y, { align: 'right' });
  pdf.text(`Valid until: ${doc.validUntilText}`, pageWidth - margin, y + 5, { align: 'right' });
  y += 8 + doc.patientLines.length * 4.5;

  y = drawTableHeader(y);
  pdf.setFont('helvetica', 'normal');
  doc.rows.forEach((row, rowIndex) => {
    if (y + rowHeight > footerTop - 4) {
      pdf.addPage();
      y = drawTableHeader(headerHeight + 8);
      pdf.setFont('helvetica', 'normal');
    }
    if (rowIndex % 2 === 1) {
      pdf.setFillColor(248, 249, 250);
      pdf.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0);
    const values = shown([row.code, row.description, row.tooth, row.quantity, row.unitPrice, row.total, row.medicalAid, row.patient]);
    values.forEach((value, index) => {
      const shown = index === 1 ? fit(value, widths[1]) : value;
      const x = rightAligned.has(index) ? columns[index] + widths[index] - 1.5 : columns[index] + 1.5;
      pdf.text(shown, x, y + 4.8, rightAligned.has(index) ? { align: 'right' } : undefined);
    });
    y += rowHeight;
  });

  // Totals
  const totalsHeight = doc.totals.length * 6 + 6;
  if (y + totalsHeight > footerTop - 4) {
    pdf.addPage();
    y = headerHeight + 8;
  }
  y += 6;
  doc.totals.forEach(total => {
    pdf.setFont('helvetica', total.bold ? 'bold' : 'normal');
    pdf.setFontSize(9);
    pdf.text(total.label, pageWidth - margin - 60, y);
    pdf.text(total.value, pageWidth - margin, y, { align: 'right' });
    y += 6;
  });

  // Notes, wrapped; a new page when they do not fit
  y += 4;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(55, 65, 81);
  doc.notes.forEach(note => {
    const wrapped = pdf.splitTextToSize(note, contentWidth) as string[];
    if (y + wrapped.length * 4.2 > footerTop - 4) {
      pdf.addPage();
      y = headerHeight + 8;
    }
    pdf.text(wrapped, margin, y);
    y += wrapped.length * 4.2 + 2.5;
  });

  // Header and footer on every page, now that the page count is known
  const pages = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(fit(doc.practiceName, contentWidth * 0.6), margin, 14);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    doc.practiceLines.slice(0, 5).forEach((line, index) => pdf.text(fit(line, contentWidth * 0.6), margin, 20 + index * 3.6));
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(doc.title, pageWidth - margin, 14, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`No ${doc.number}`, pageWidth - margin, 21, { align: 'right' });
    pdf.text(`Page ${page} of ${pages}`, pageWidth - margin, 27, { align: 'right' });

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, footerTop, pageWidth - margin, footerTop);
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 100, 100);
    doc.footerLeft.forEach((line, index) => pdf.text(line, margin, footerTop + 6 + index * 4));
    doc.footerRight.forEach((line, index) => pdf.text(line, pageWidth - margin, footerTop + 6 + index * 4, { align: 'right' }));
  }
  return pdf;
}

/** The PDF as base64 (no data: prefix), for an email attachment. */
export function quotePdfBase64(pdf: jsPDF): string {
  const uri = pdf.output('datauristring');
  return uri.slice(uri.indexOf(',') + 1);
}
