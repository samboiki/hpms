/**
 * Draws an invoice (buildInvoiceDocument) as a TEXT PDF: real text that can be searched, copied, read aloud by a
 * screen reader and read by a fund's systems (the earlier invoice PDFs were screenshots). A4, one column, nothing
 * smaller than 7.5 pt, so it stays readable when opened on a phone; the table repeats its header on every page and
 * every page carries the practice, the invoice number and "page x of y".
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InvoiceDocument } from './invoiceDocument';

type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [1, 185, 212];
};

/** A darker shade for text on white (the practice colour can be light). */
const darken = ([r, g, b]: Rgb, factor = 0.55): Rgb => [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];

const INK: Rgb = [31, 41, 55];
const MUTED: Rgb = [107, 114, 128];
const LINE: Rgb = [229, 231, 235];
const CARD: Rgb = [248, 250, 252];

/** Draws the document on A4 pages. */
export function renderInvoicePdf(doc: InvoiceDocument): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  // "Invoice INV-..." or, for a credit note drawn the same way (creditNoteDocument.ts), "Credit note CN-..."
  const kind = `${doc.title.charAt(0)}${doc.title.slice(1).toLowerCase()}`;
  pdf.setProperties({ title: `${kind} ${doc.number}`, subject: `${kind} ${doc.number} from ${doc.practiceName}`, creator: 'OneHealth' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const brand = hexToRgb(doc.primaryColor);
  const brandInk = darken(brand);
  const firstHeader = 36;
  const nextHeader = 18;
  const footerTop = pageHeight - 18;

  const fit = (value: string, width: number): string => {
    const lines = pdf.splitTextToSize(value, width) as string[];
    return lines.length > 1 ? `${lines[0].replace(/\s+\S*$/, '')}...` : lines[0] ?? '';
  };

  // ---- First page header: the practice on the left, the invoice on the right
  pdf.setFillColor(...brand);
  pdf.rect(0, 0, pageWidth, firstHeader, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(fit(doc.practiceName, contentWidth * 0.62), margin, 13);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  doc.practiceLines.slice(0, 5).forEach((line, index) => pdf.text(fit(line, contentWidth * 0.62), margin, 19 + index * 3.6));
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(doc.title, pageWidth - margin, 13, { align: 'right' });
  pdf.setFontSize(10);
  pdf.text(doc.number, pageWidth - margin, 19.5, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  doc.meta.forEach((line, index) => pdf.text(line, pageWidth - margin, 25 + index * 4, { align: 'right' }));

  // ---- Patient, medical aid and practitioner cards
  let y = firstHeader + 6;
  if (doc.statusLabel) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    const width = pdf.getTextWidth(doc.statusLabel) + 6;
    pdf.setFillColor(...brandInk);
    pdf.roundedRect(pageWidth - margin - width, y - 4, width, 6, 1.5, 1.5, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text(doc.statusLabel, pageWidth - margin - width / 2, y, { align: 'center' });
    y += 5;
  }
  const gap = 4;
  const cardWidth = (contentWidth - gap * (doc.blocks.length - 1)) / doc.blocks.length;
  const wrapped = doc.blocks.map(block => block.lines.flatMap(line => pdf.splitTextToSize(line, cardWidth - 6) as string[]));
  const cardHeight = 9 + Math.max(...wrapped.map(lines => lines.length)) * 4 + 2;
  doc.blocks.forEach((block, index) => {
    const x = margin + index * (cardWidth + gap);
    pdf.setFillColor(...CARD);
    pdf.setDrawColor(...LINE);
    pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...brandInk);
    pdf.text(block.heading.toUpperCase(), x + 3, y + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...INK);
    wrapped[index].forEach((line, lineIndex) => pdf.text(line, x + 3, y + 10 + lineIndex * 4));
  });
  y += cardHeight + 6;

  // ---- Services: one row per line, with the columns rule 008 asks for
  const columns: Array<{ key: keyof InvoiceDocument['rows'][number]; title: string; width?: number; right?: boolean }> = [
    { key: 'date', title: 'Date', width: 18 },
    { key: 'code', title: 'Code', width: 12 },
    { key: 'icd10', title: 'ICD-10', width: 17 },
    ...(doc.columns.tooth ? [{ key: 'tooth' as const, title: 'Tooth', width: 11 }] : []),
    { key: 'description', title: 'Service' },
    { key: 'quantity', title: 'Qty', width: 9, right: true },
    { key: 'unitPrice', title: 'Unit price', width: 20, right: true },
    ...(doc.columns.discount ? [{ key: 'discount' as const, title: 'Discount', width: 18, right: true }] : []),
    { key: 'total', title: 'Amount', width: 20, right: true },
    ...(doc.columns.portions
      ? [
          { key: 'medicalAid' as const, title: 'Medical aid', width: 20, right: true },
          { key: 'patient' as const, title: 'Patient', width: 18, right: true }
        ]
      : [])
  ];
  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin, top: nextHeader + 6, bottom: pageHeight - footerTop + 4 },
    head: [columns.map(column => column.title)],
    body: doc.rows.map(row => columns.map(column => row[column.key])),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 }, textColor: INK, lineColor: LINE, overflow: 'linebreak' },
    headStyles: { fillColor: brandInk, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: CARD },
    columnStyles: Object.fromEntries(
      columns.map((column, index) => [index, { ...(column.width ? { cellWidth: column.width } : { cellWidth: 'auto' as const }), halign: column.right ? ('right' as const) : ('left' as const) }])
    ),
    didParseCell: data => {
      if (data.section === 'head' && columns[data.column.index]?.right) data.cell.styles.halign = 'right';
    }
  });
  y = ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6;

  // ---- Totals card on the right
  const totalsWidth = 78;
  const totalsHeight = 6 + doc.totals.length * 6;
  if (y + totalsHeight > footerTop - 4) {
    pdf.addPage();
    y = nextHeader + 8;
  }
  const totalsX = pageWidth - margin - totalsWidth;
  pdf.setFillColor(...CARD);
  pdf.setDrawColor(...LINE);
  pdf.roundedRect(totalsX, y, totalsWidth, totalsHeight, 2, 2, 'FD');
  doc.totals.forEach((total, index) => {
    const rowY = y + 6.5 + index * 6;
    pdf.setFont('helvetica', total.bold ? 'bold' : 'normal');
    pdf.setFontSize(total.bold ? 9.5 : 8.5);
    pdf.setTextColor(...(total.bold ? INK : MUTED));
    pdf.text(total.label, totalsX + 4, rowY);
    pdf.text(total.value, totalsX + totalsWidth - 4, rowY, { align: 'right' });
  });
  y += totalsHeight + 7;

  // ---- Statements (benchmark tariff, currency, practice message), wrapped
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  doc.statements.forEach(statement => {
    const lines = pdf.splitTextToSize(statement, contentWidth) as string[];
    if (y + lines.length * 3.8 > footerTop - 3) {
      pdf.addPage();
      y = nextHeader + 8;
    }
    pdf.text(lines, margin, y);
    y += lines.length * 3.8 + 1.5;
  });

  // ---- Running header (pages 2+) and the footer on every page, now that the page count is known
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    if (page > 1) {
      pdf.setFillColor(...brand);
      pdf.rect(0, 0, pageWidth, nextHeader, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(fit(doc.practiceName, contentWidth * 0.6), margin, 11);
      pdf.text(`${doc.title} ${doc.number}`, pageWidth - margin, 11, { align: 'right' });
    }
    pdf.setDrawColor(...LINE);
    pdf.line(margin, footerTop, pageWidth - margin, footerTop);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    doc.footerLeft.forEach((line, index) => pdf.text(fit(line, contentWidth * 0.45), margin, footerTop + 5 + index * 3.6));
    doc.footerRight.forEach((line, index) => pdf.text(fit(line, contentWidth * 0.55), pageWidth - margin, footerTop + 5 + index * 3.6, { align: 'right' }));
    pdf.text(`Page ${page} of ${pages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }
  return pdf;
}

/** The PDF as a Blob, for upload or download. */
export const invoicePdfBlob = (doc: InvoiceDocument): Blob => renderInvoicePdf(doc).output('blob');
