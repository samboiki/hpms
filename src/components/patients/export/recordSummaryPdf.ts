/**
 * Draws a patient's record summary (src/utils/export/patientRecord.ts decides every word) on A4 pages in the style of
 * the practice's letters: a band in the practice colour with its name and "PATIENT RECORD", the patient's name and the
 * page number on every page, and a confidentiality footer. Text, not a picture, so it can be searched and read aloud.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RecordSection } from '../../../utils/export/patientRecord';

export interface RecordSummaryHeader {
  practiceName: string;
  practiceLines: string[];
  primaryColor: string;
  patientName: string;
  /** "Made 13 October 2026 at 10:42 by Dr A Example" */
  madeLine: string;
}

const MARGIN = 16;
const HEADER_HEIGHT = 28;
const LINE = 4.6;
const LABEL_WIDTH = 42;
const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [107, 114, 128];

const hexToRgb = (hex: string): [number, number, number] => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [1, 185, 212];
};

export function renderRecordSummaryPdf(header: RecordSummaryHeader, sections: readonly RecordSection[]): jsPDF {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const footerTop = pageHeight - 14;
  const top = HEADER_HEIGHT + 10;
  const brand = hexToRgb(header.primaryColor);
  let y = top;

  const room = (height: number) => {
    if (y + height > footerTop - 4) {
      pdf.addPage();
      y = top;
    }
  };

  const write = (text: string, options: { bold?: boolean; size?: number; color?: [number, number, number]; x?: number; width?: number; italic?: boolean } = {}) => {
    pdf.setFont('helvetica', options.bold ? 'bold' : options.italic ? 'italic' : 'normal');
    pdf.setFontSize(options.size ?? 9.5);
    pdf.setTextColor(...(options.color ?? INK));
    const lines = pdf.splitTextToSize(text, options.width ?? contentWidth) as string[];
    for (const line of lines) {
      room(LINE);
      pdf.text(line, options.x ?? MARGIN, y);
      y += LINE;
    }
  };

  // The opening lines under the first band: whose record, made when and by whom
  write(header.patientName, { bold: true, size: 14 });
  y += 1;
  write(header.madeLine, { size: 9, color: MUTED });
  y += 4;

  for (const section of sections) {
    room(LINE * 4);
    pdf.setDrawColor(...brand);
    pdf.setLineWidth(0.4);
    pdf.line(MARGIN, y - 3.6, MARGIN + 12, y - 3.6);
    write(section.heading, { bold: true, size: 12 });
    if (section.note) write(section.note, { size: 8.5, color: MUTED });
    y += 1.5;

    const blocks = section.blocks?.filter(block => block.facts.length > 0 || block.title) ?? [];
    const rows = section.table?.rows ?? [];
    if (blocks.length === 0 && rows.length === 0 && section.empty) {
      write(section.empty, { italic: true, color: MUTED });
    }

    blocks.forEach(block => {
      if (block.title) {
        room(LINE * 3);
        write(block.title, { bold: true, size: 9.5 });
      }
      block.facts.forEach(item => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        const valueLines = pdf.splitTextToSize(item.value, contentWidth - LABEL_WIDTH) as string[];
        valueLines.forEach((line, index) => {
          room(LINE);
          if (index === 0) {
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...MUTED);
            pdf.text(item.label, MARGIN, y);
          }
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...INK);
          pdf.text(line, MARGIN + LABEL_WIDTH, y);
          y += LINE;
        });
      });
      y += 2.5;
    });

    if (section.table && rows.length > 0) {
      autoTable(pdf, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN, top: top, bottom: pageHeight - footerTop + 4 },
        head: [section.table.columns],
        body: rows,
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.4, bottom: 1.4, left: 1.4, right: 1.4 }, textColor: INK, overflow: 'linebreak' },
        headStyles: { fillColor: brand, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      y = ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 4;
    }
    y += 4;
  }

  // The band and the footer on every page, now that the page count is known
  const count = pdf.getNumberOfPages();
  for (let page = 1; page <= count; page += 1) {
    pdf.setPage(page);
    pdf.setFillColor(...brand);
    pdf.rect(0, 0, pageWidth, HEADER_HEIGHT, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(header.practiceName, MARGIN, 11);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    header.practiceLines.slice(0, 3).forEach((line, index) => pdf.text(line, MARGIN, 16 + index * 3.3));
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('PATIENT RECORD', pageWidth - MARGIN, 11, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(header.patientName, pageWidth - MARGIN, 16, { align: 'right' });
    pdf.text(`Page ${page} of ${count}`, pageWidth - MARGIN, 20.5, { align: 'right' });

    pdf.setDrawColor(209, 213, 219);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, footerTop, pageWidth - MARGIN, footerTop);
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(`${header.practiceName} - confidential medical information`, MARGIN, footerTop + 4.5);
  }
  return pdf;
}
