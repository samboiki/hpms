/**
 * Draws a receipt or a statement (receiptPdf.ts and debtors/statementPdf.ts decide every word) as a TEXT PDF on the
 * practice letterhead, in the style of the practice's invoices (billing/invoicePdf.ts): the header band in the
 * practice colour, details in a card, tables that repeat their header on every page, totals on the right and
 * "page x of y" on every page. Used to email the document as an attachment.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type Rgb = [number, number, number];

export interface PdfTable {
  heading: string | null;
  columns: ReadonlyArray<{ title: string; right?: boolean; width?: number }>;
  rows: string[][];
  /** Shown as the only row when there are none */
  emptyText?: string;
}

export interface FinanceDocumentPdf {
  practiceName: string;
  practiceLines: string[];
  primaryColor: string | null;
  /** "RECEIPT" */
  title: string;
  /** "R-0012" */
  number: string | null;
  /** Right of the header, under the number: "12 Oct 2026" */
  meta: string[];
  /** Bold lines under the header: who the document is for */
  intro: string[];
  /** Highlighted lines: the practice's message, a reversed payment */
  notices: string[];
  /** Label and value pairs in a card */
  facts: ReadonlyArray<{ label: string; value: string }>;
  tables: PdfTable[];
  totals: ReadonlyArray<{ label: string; value: string; bold?: boolean }>;
  /** Paragraphs after the totals: how to pay, queries */
  paragraphs: ReadonlyArray<{ heading: string | null; text: string }>;
  footer: string;
  fileName: string;
}

const hexToRgb = (hex: string | null): Rgb => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex ?? '').trim());
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [1, 185, 212];
};
const darken = ([r, g, b]: Rgb, factor = 0.55): Rgb => [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];

const INK: Rgb = [31, 41, 55];
const MUTED: Rgb = [107, 114, 128];
const LINE: Rgb = [229, 231, 235];
const CARD: Rgb = [248, 250, 252];
const NOTICE: Rgb = [236, 254, 255];

export function renderFinanceDocumentPdf(doc: FinanceDocumentPdf): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdf.setProperties({ title: [doc.title, doc.number].filter(Boolean).join(' '), subject: `${doc.title} from ${doc.practiceName}`, creator: 'OneHealth' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const brand = hexToRgb(doc.primaryColor);
  const brandInk = darken(brand);
  const firstHeader = 36;
  const nextHeader = 18;
  const footerTop = pageHeight - 16;
  let y = firstHeader + 8;

  const ensureRoom = (height: number) => {
    if (y + height > footerTop - 4) {
      pdf.addPage();
      y = nextHeader + 8;
    }
  };

  // ---- Header: the practice on the left, the document on the right
  pdf.setFillColor(...brand);
  pdf.rect(0, 0, pageWidth, firstHeader, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(doc.practiceName, margin, 13, { maxWidth: contentWidth * 0.6 });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  doc.practiceLines.slice(0, 5).forEach((line, index) => pdf.text(line, margin, 19 + index * 3.6, { maxWidth: contentWidth * 0.6 }));
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(doc.title, pageWidth - margin, 13, { align: 'right' });
  pdf.setFontSize(10);
  if (doc.number) pdf.text(doc.number, pageWidth - margin, 19.5, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  doc.meta.forEach((line, index) => pdf.text(line, pageWidth - margin, (doc.number ? 25 : 19.5) + index * 4, { align: 'right' }));

  // ---- Who it is for
  pdf.setTextColor(...INK);
  doc.intro.forEach((line, index) => {
    pdf.setFont('helvetica', index === 0 ? 'bold' : 'normal');
    pdf.setFontSize(index === 0 ? 11 : 9);
    const lines = pdf.splitTextToSize(line, contentWidth) as string[];
    ensureRoom(lines.length * 5);
    pdf.text(lines, margin, y);
    y += lines.length * 5;
  });
  if (doc.intro.length > 0) y += 2;

  // ---- Notices in a tinted band
  doc.notices.forEach(notice => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(notice, contentWidth - 8) as string[];
    const height = lines.length * 4.4 + 4;
    ensureRoom(height + 2);
    pdf.setFillColor(...NOTICE);
    pdf.rect(margin, y - 3, contentWidth, height, 'F');
    pdf.setFillColor(...brandInk);
    pdf.rect(margin, y - 3, 1.2, height, 'F');
    pdf.setTextColor(...INK);
    pdf.text(lines, margin + 4, y + 1);
    y += height + 3;
  });

  // ---- Facts card
  if (doc.facts.length > 0) {
    pdf.setFontSize(9);
    const labelWidth = 38;
    const rows = doc.facts.map(fact => ({ label: fact.label, lines: pdf.splitTextToSize(fact.value, contentWidth - labelWidth - 8) as string[] }));
    const height = 4 + rows.reduce((sum, row) => sum + row.lines.length * 4.4, 0) + 2;
    ensureRoom(height + 2);
    pdf.setFillColor(...CARD);
    pdf.setDrawColor(...LINE);
    pdf.roundedRect(margin, y, contentWidth, height, 2, 2, 'FD');
    let rowY = y + 6;
    rows.forEach(row => {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...MUTED);
      pdf.text(row.label, margin + 3, rowY);
      pdf.setTextColor(...INK);
      pdf.text(row.lines, margin + 3 + labelWidth, rowY);
      rowY += row.lines.length * 4.4;
    });
    y += height + 5;
  }

  // ---- Tables
  doc.tables.forEach(table => {
    if (table.heading) {
      ensureRoom(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...brandInk);
      pdf.text(table.heading, margin, y);
      y += 3;
    }
    const empty = table.rows.length === 0 && table.emptyText;
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin, top: nextHeader + 6, bottom: pageHeight - footerTop + 4 },
      head: [table.columns.map(column => column.title)],
      body: empty ? [[{ content: table.emptyText ?? '', colSpan: table.columns.length }]] : table.rows,
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 }, textColor: INK, lineColor: LINE, overflow: 'linebreak' },
      headStyles: { fillColor: brandInk, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: CARD },
      columnStyles: Object.fromEntries(
        table.columns.map((column, index) => [
          index,
          { ...(column.width ? { cellWidth: column.width } : { cellWidth: 'auto' as const }), halign: column.right ? ('right' as const) : ('left' as const) }
        ])
      ),
      didParseCell: data => {
        if (data.section === 'head' && table.columns[data.column.index]?.right) data.cell.styles.halign = 'right';
      }
    });
    y = ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 7;
  });

  // ---- Totals card on the right
  if (doc.totals.length > 0) {
    const totalsWidth = 84;
    const totalsHeight = 6 + doc.totals.length * 6;
    ensureRoom(totalsHeight + 4);
    const totalsX = pageWidth - margin - totalsWidth;
    pdf.setFillColor(...CARD);
    pdf.setDrawColor(...LINE);
    pdf.roundedRect(totalsX, y, totalsWidth, totalsHeight, 2, 2, 'FD');
    doc.totals.forEach((total, index) => {
      const rowY = y + 6.5 + index * 6;
      pdf.setFont('helvetica', total.bold ? 'bold' : 'normal');
      pdf.setFontSize(total.bold ? 10 : 8.5);
      pdf.setTextColor(...(total.bold ? INK : MUTED));
      pdf.text(total.label, totalsX + 4, rowY);
      pdf.text(total.value, totalsX + totalsWidth - 4, rowY, { align: 'right' });
    });
    y += totalsHeight + 7;
  }

  // ---- Paragraphs
  doc.paragraphs.forEach(paragraph => {
    const lines = pdf.splitTextToSize(paragraph.text, contentWidth) as string[];
    ensureRoom(lines.length * 4.4 + (paragraph.heading ? 6 : 0));
    if (paragraph.heading) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...brandInk);
      pdf.text(paragraph.heading, margin, y);
      y += 5;
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    pdf.text(lines, margin, y);
    y += lines.length * 4.4 + 3;
  });

  // ---- Running header (pages 2+) and the footer on every page
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    if (page > 1) {
      pdf.setFillColor(...brand);
      pdf.rect(0, 0, pageWidth, nextHeader, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(doc.practiceName, margin, 11, { maxWidth: contentWidth * 0.6 });
      pdf.text([doc.title, doc.number].filter(Boolean).join(' '), pageWidth - margin, 11, { align: 'right' });
    }
    pdf.setDrawColor(...LINE);
    pdf.line(margin, footerTop, pageWidth - margin, footerTop);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(doc.footer, margin, footerTop + 5, { maxWidth: contentWidth * 0.75 });
    pdf.text(`Page ${page} of ${pages}`, pageWidth - margin, footerTop + 5, { align: 'right' });
  }
  return pdf;
}

/** The PDF as base64 (no data: prefix), for an email attachment. */
export function pdfBase64(pdf: jsPDF): string {
  const uri = pdf.output('datauristring');
  return uri.slice(uri.indexOf(',') + 1);
}
