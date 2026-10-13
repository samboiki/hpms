/**
 * Draws a letter (src/utils/clinical/letters.ts decides every word) on the practice letterhead, in the
 * style of the practice's quotes and invoices: a header band in the practice colour with its name and
 * contacts, the title and page number on the right. Text, not a picture, so it prints sharply and can
 * be searched. Several letters (a list's letters) go into one PDF, each starting on a new page and
 * numbering its own pages.
 */
import { jsPDF } from 'jspdf';
import { closingLine, type LetterDocument } from '../../utils/clinical/letters';

const hexToRgb = (hex: string): [number, number, number] => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [1, 185, 212];
};

const MARGIN = 20;
const HEADER_HEIGHT = 36;
const LINE_HEIGHT = 5.2;
/** A signature drawn on the screen (consent forms): 3 wide to 1 high, as the signature pad draws it */
const SIGNATURE_WIDTH = 60;
const SIGNATURE_HEIGHT = 20;

/** Draws one letter from the current page on; returns the pages it used (first, last). */
function drawLetterBody(pdf: jsPDF, doc: LetterDocument): { first: number; last: number } {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const footerTop = pageHeight - 18;
  const first = pdf.getNumberOfPages();
  let y = HEADER_HEIGHT + 14;

  const newPageIfNeeded = (height: number) => {
    if (y + height > footerTop - 6) {
      pdf.addPage();
      y = HEADER_HEIGHT + 12;
    }
  };

  const writeWrapped = (text: string, options: { bold?: boolean; size?: number; indent?: number; gapAfter?: number } = {}) => {
    pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
    pdf.setFontSize(options.size ?? 10.5);
    pdf.setTextColor(17, 24, 39);
    const indent = options.indent ?? 0;
    const lines = pdf.splitTextToSize(text, contentWidth - indent) as string[];
    for (const line of lines) {
      newPageIfNeeded(LINE_HEIGHT);
      pdf.text(line, MARGIN + indent, y);
      y += LINE_HEIGHT;
    }
    y += options.gapAfter ?? 0;
  };

  // Date on the right, recipient on the left
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(17, 24, 39);
  pdf.text(doc.dateText, pageWidth - MARGIN, y, { align: 'right' });
  if (doc.recipientLines.length > 0) {
    doc.recipientLines.forEach((line, index) => writeWrapped(line, { bold: index === 0 }));
    y += 4;
  } else {
    y += LINE_HEIGHT + 2;
  }

  // A template may leave out the subject line or the greeting
  if (doc.subjectLine.trim()) writeWrapped(doc.subjectLine, { bold: true, gapAfter: 4 });
  if (doc.salutation.trim()) writeWrapped(`${doc.salutation},`, { gapAfter: 2 });
  doc.paragraphs.forEach(paragraph => writeWrapped(paragraph, { gapAfter: 3 }));

  doc.sections.forEach(section => {
    newPageIfNeeded(LINE_HEIGHT * 2);
    writeWrapped(section.heading, { bold: true });
    section.lines.forEach(line => writeWrapped(section.lines.length > 1 ? `- ${line}` : line, { indent: section.lines.length > 1 ? 2 : 0 }));
    y += 3;
  });

  // Signature block: room to sign by hand above the name, or the signature drawn on the screen (consent forms)
  const drawn = doc.signatureImage ? SIGNATURE_HEIGHT + 4 : 0;
  newPageIfNeeded(LINE_HEIGHT * (doc.signatureLines.length + 5) + drawn);
  y += 2;
  writeWrapped(closingLine(doc.closing), { gapAfter: 12 + drawn });
  // Compressed: uncompressed, one signature made the PDF half a megabyte
  if (doc.signatureImage) pdf.addImage(doc.signatureImage, 'PNG', MARGIN, y - 6 - SIGNATURE_HEIGHT, SIGNATURE_WIDTH, SIGNATURE_HEIGHT, undefined, 'FAST');
  pdf.setDrawColor(156, 163, 175);
  pdf.line(MARGIN, y - 4, MARGIN + 60, y - 4);
  doc.signatureLines.forEach((line, index) => writeWrapped(line, { bold: index === 0 }));
  return { first, last: pdf.getNumberOfPages() };
}

/** The letterhead band and footer on each page of one letter, now that its page count is known. */
function drawLetterhead(pdf: jsPDF, doc: LetterDocument, pages: { first: number; last: number }): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerTop = pageHeight - 18;
  const [r, g, b] = hexToRgb(doc.primaryColor);
  const count = pages.last - pages.first + 1;
  for (let page = pages.first; page <= pages.last; page += 1) {
    pdf.setPage(page);
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(doc.practiceName, MARGIN, 13);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    doc.practiceLines.slice(0, 5).forEach((line, index) => pdf.text(line, MARGIN, 19 + index * 3.4));
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(doc.title, pageWidth - MARGIN, 13, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    if (doc.reference) pdf.text(doc.reference, pageWidth - MARGIN, 19, { align: 'right' });
    pdf.text(`Page ${page - pages.first + 1} of ${count}`, pageWidth - MARGIN, doc.reference ? 24 : 19, { align: 'right' });

    pdf.setDrawColor(209, 213, 219);
    pdf.line(MARGIN, footerTop, pageWidth - MARGIN, footerTop);
    pdf.setFontSize(7.5);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`${doc.practiceName} - confidential medical information`, MARGIN, footerTop + 5);
  }
}

/** Draws the letters on A4 pages, each starting on a new page (one letter: renderLetterPdf). */
export function renderLettersPdf(docs: readonly LetterDocument[]): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ranges = docs.map((doc, index) => {
    if (index > 0) pdf.addPage();
    return drawLetterBody(pdf, doc);
  });
  docs.forEach((doc, index) => drawLetterhead(pdf, doc, ranges[index]));
  return pdf;
}

/** Draws the letter on A4 pages. */
export function renderLetterPdf(doc: LetterDocument): jsPDF {
  return renderLettersPdf([doc]);
}

/** The PDF as base64 (no data: prefix), for an email attachment. */
export function letterPdfBase64(pdf: jsPDF): string {
  const uri = pdf.output('datauristring');
  return uri.slice(uri.indexOf(',') + 1);
}

/**
 * Opens the PDF in a new tab, where the browser's PDF viewer prints or saves it. When the browser blocks
 * the new tab, the PDF is downloaded instead.
 */
export function openPdf(pdf: jsPDF, fileName: string): void {
  const url = pdf.output('bloburl') as unknown as string;
  // No 'noopener': with it window.open always returns null, and the PDF would also be downloaded
  const opened = window.open(url, '_blank');
  if (!opened) pdf.save(fileName);
}

/** Opens the letter to print or save (see openPdf). */
export function openLetterPdf(doc: LetterDocument): void {
  openPdf(renderLetterPdf(doc), doc.fileName);
}
