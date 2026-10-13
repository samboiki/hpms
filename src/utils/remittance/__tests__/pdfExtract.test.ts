// @vitest-environment node
/**
 * PDF text extraction with pdf.js, end to end on real (synthetic) PDF files. The Methealth
 * statements are landscape tables printed on portrait pages turned 90 degrees; plain text
 * extraction reads them sideways and puts amounts on the wrong line, so the importer depends on the
 * rotation being undone. Invented values only.
 */
import { describe, expect, it } from 'vitest';
import { extractPdfPages, looksLikePdf } from '../pdfExtract';
import { isParsed, parseRemittancePages, reconciliationStatus } from '../parseRemittance';
import type { PdfPageText } from '../pdfLayout';
import { medschemeAdvice, methealthStatement } from './fixtures';
import { buildPdf } from './syntheticPdf';

const toPdf = (pages: PdfPageText[]): Uint8Array =>
  buildPdf(pages.map(page => ({
    rotate: page.rotation === 90 ? 90 : 0,
    width: page.width,
    height: page.height,
    texts: page.items.map(item => ({ str: item.str, x: item.x, y: item.y, size: item.fontSize }))
  })));

describe('reading PDF files', () => {
  it('reads a statement printed on rotated pages left to right, and it adds up to the cent', async () => {
    const source = methealthStatement({
      fund: 'NMC',
      pages: [[
        { member: '000111222', name: 'MRS A EXAMPLE', ref: '0000101', date: '15-09-26', tariff: '00190', claimed: 52000, paid: 52000 },
        { member: '000111222', name: 'MRS A EXAMPLE', ref: '0000101', date: '15-09-26', tariff: '08109', claimed: 9500, paid: 0, code: '202' }
      ]],
      legend: { '202': 'TARIFF CODES CANNOT BE CHARGED TOGETHER' }
    });
    const bytes = toPdf(source);
    expect(looksLikePdf(bytes)).toBe(true);

    const pages = await extractPdfPages(bytes);
    expect(pages[0]).toMatchObject({ rotation: 90, width: 842, height: 595 });
    const title = pages[0].items.find(item => item.str.startsWith('REMITTANCE STATEMENT'));
    expect(title?.x).toBeCloseTo(326, 0);
    expect(title?.y).toBeCloseTo(35, 0);

    const outcome = parseRemittancePages(pages);
    expect(isParsed(outcome)).toBe(true);
    if (!isParsed(outcome)) return;
    const [doc] = outcome.documents;
    expect(doc.lines.map(line => [line.tariffRaw, line.claimedCents, line.paidCents, line.reasonCodes])).toEqual([
      ['00190', 52000, 52000, []],
      ['08109', 9500, 0, ['202']]
    ]);
    expect(reconciliationStatus(doc).ok).toBe(true);
  });

  it('reads an unrotated Medscheme advice with right-aligned amounts', async () => {
    const source = medschemeAdvice({
      scheme: 'Namibia Health Plan',
      documentDate: '29/09/2026',
      payments: [{ reference: 'NHP0000001-000042', date: '02/10/2026', pages: [[
        { member: '00000111222', memberName: 'MR A EXAMPLE', dependant: '01', ref: '0000101', date: '22/09/2026', tariff: '0190', benefit: 'GEN', charged: 52000, paid: 52000 },
        { date: '22/09/2026', tariff: '0308', benefit: 'GEN', charged: 18000, paid: 18000 }
      ]] }]
    });
    const outcome = parseRemittancePages(await extractPdfPages(toPdf(source)));
    expect(isParsed(outcome)).toBe(true);
    if (!isParsed(outcome)) return;
    expect(outcome.documents[0]).toMatchObject({ paymentReference: 'NHP0000001-000042', totalPaidCents: 70000 });
    expect(reconciliationStatus(outcome.documents[0]).ok).toBe(true);
  });

  it('tells a PDF from other files by its first bytes', () => {
    expect(looksLikePdf(new TextEncoder().encode('HP NO-NAME,REFERENCE'))).toBe(false);
  });
});
