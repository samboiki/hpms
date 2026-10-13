import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentGenerationService } from '../documentGenerationService';

// The invoice document is the one text PDF of the app (invoiceDocumentService); no database or storage is reached
const { makeInvoicePdf, upload, storageFrom, storageUpload } = vi.hoisted(() => {
  const storageUpload = vi.fn();
  return {
    makeInvoicePdf: vi.fn(),
    upload: vi.fn(),
    storageUpload,
    // A visit document is a patient record: making it a public link fails the test
    storageFrom: vi.fn(() => ({ upload: storageUpload, getPublicUrl: () => { throw new Error('public link for a record'); } }))
  };
});
vi.mock('../invoiceDocumentService', () => ({ makeInvoicePdf }));
vi.mock('../../lib/supabase', () => ({ supabase: { storage: { from: storageFrom } } }));

// The two PDF libraries, replaced: they count how often they are loaded and make a one-page PDF
const pdfLibs = vi.hoisted(() => {
  const pdfBlob = new Blob(['%PDF-1.3'], { type: 'application/pdf' });
  const addImage = vi.fn();
  class JsPdf {
    static made: unknown[] = [];
    internal = { pageSize: { getWidth: () => 148, getHeight: () => 210 } };
    addImage = addImage;
    addPage = vi.fn();
    output = () => pdfBlob;
    constructor(options: unknown) {
      JsPdf.made.push(options);
    }
  }
  return {
    loads: { html2canvas: 0, jspdf: 0 },
    pdfBlob,
    addImage,
    JsPdf,
    html2canvas: vi.fn(async () => ({ width: 559, height: 794, toDataURL: () => 'data:image/jpeg;base64,AAAA' }))
  };
});
vi.mock('html2canvas', () => {
  pdfLibs.loads.html2canvas += 1;
  return { default: pdfLibs.html2canvas };
});
vi.mock('jspdf', () => {
  pdfLibs.loads.jspdf += 1;
  return { default: pdfLibs.JsPdf };
});

type InvoiceDocumentMaker = {
  generateInvoice: (invoice: unknown, practiceId?: string) => Promise<{ type: string; documentName: string; filePath: string } | null>;
  uploadToStorage: (blob: Blob, fileName: string, folder: string, practiceId: string) => Promise<string>;
};

// Invented practice id
const PRACTICE = '1a2b3c4d-0000-4000-8000-00000000000a';

describe('DocumentGenerationService: the visit invoice document', () => {
  let service: InvoiceDocumentMaker;

  beforeEach(() => {
    makeInvoicePdf.mockReset();
    upload.mockReset();
    service = new DocumentGenerationService() as unknown as InvoiceDocumentMaker;
    service.uploadToStorage = upload;
  });

  // An invoice without lines has nothing to bill: no document is made, and the visit does not show an empty invoice
  it.each([null, { id: 'inv-1', invoice_number: 'INV-000001', invoice_services: [] }, { id: 'inv-1', invoice_number: 'INV-000001', invoice_services: null }])(
    'makes no invoice document for an invoice without lines (%#)',
    async invoice => {
      await expect(service.generateInvoice(invoice)).resolves.toBeNull();
      expect(makeInvoicePdf).not.toHaveBeenCalled();
    }
  );

  // The stored copy is the same text PDF as "Download PDF": the rule-008 layout, read fresh from the invoice. It is
  // filed under the visit's practice, the only staff the private bucket lets open it, and carries no public link.
  it('stores the text PDF of the invoice, made from the invoice itself, under the practice', async () => {
    const blob = new Blob(['%PDF-1.3'], { type: 'application/pdf' });
    makeInvoicePdf.mockResolvedValue({ doc: { number: 'INV-000123' }, pdf: { output: () => blob } });
    upload.mockResolvedValue(`${PRACTICE}/invoices/invoice_INV-000123.pdf`);

    const result = await service.generateInvoice({ id: 'inv-123', invoice_number: 'INV-000123', invoice_services: [{ code: '0190' }] }, PRACTICE);

    expect(makeInvoicePdf).toHaveBeenCalledWith('inv-123');
    expect(upload).toHaveBeenCalledWith(blob, expect.stringMatching(/^invoice_INV-000123_\d+\.pdf$/), 'invoices', PRACTICE);
    expect(result).toEqual({ type: 'invoice', documentName: 'Invoice - INV-000123', filePath: `${PRACTICE}/invoices/invoice_INV-000123.pdf`, fileSize: blob.size });
  });

  // A failed PDF must not stop the other visit documents (prescription, leave form) from being made
  it('returns nothing when the invoice PDF cannot be made, instead of failing the other documents', async () => {
    makeInvoicePdf.mockRejectedValue(new Error('The invoice could not be found.'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(service.generateInvoice({ id: 'gone', invoice_number: 'INV-9', invoice_services: [{ code: '0190' }] })).resolves.toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });
});

// Prescriptions, sick notes and invoices name the patient: they go to the private bucket, in the practice's own
// folder (the storage rules read the practice there), and are never stored without a practice.
describe('DocumentGenerationService: where visit documents are stored', () => {
  const real = () => new DocumentGenerationService() as unknown as InvoiceDocumentMaker;

  beforeEach(() => {
    storageFrom.mockClear();
    storageUpload.mockReset();
    storageUpload.mockImplementation(async (path: string) => ({ data: { path }, error: null }));
  });

  it('uploads to the private bucket under the practice', async () => {
    const path = await real().uploadToStorage(new Blob(['%PDF']), 'prescription_v_1.pdf', 'prescriptions', PRACTICE);
    expect(storageFrom).toHaveBeenCalledWith('records');
    expect(path).toBe(`${PRACTICE}/prescriptions/prescription_v_1.pdf`);
  });

  it('refuses a document whose practice is not known instead of uploading it', async () => {
    await expect(real().uploadToStorage(new Blob(['%PDF']), 'leave_form_1.pdf', 'leave_forms', '')).rejects.toThrow('practice');
    expect(storageUpload).not.toHaveBeenCalled();
  });
});

// The PDF libraries are large (about 0.8 MB): they load when the first prescription or sick note is made, so the print
// buttons in the Dashboard's visit tracker no longer bring them in with the first screen, and the document still prints
describe('DocumentGenerationService: prescriptions and sick notes as PDF', () => {
  it('loads the PDF libraries when the first document is made, and still makes the PDF', async () => {
    expect(pdfLibs.loads).toEqual({ html2canvas: 0, jspdf: 0 });
    const service = new DocumentGenerationService() as unknown as { htmlToPDF: (html: string, format?: 'a4' | 'a5') => Promise<Blob> };

    const pdf = await service.htmlToPDF('<div class="prescription-container">Invented prescription</div>', 'a5');

    expect(pdf).toBe(pdfLibs.pdfBlob);
    expect(pdfLibs.loads).toEqual({ html2canvas: 1, jspdf: 1 });
    expect(pdfLibs.html2canvas).toHaveBeenCalledWith(expect.objectContaining({ className: 'prescription-container' }), expect.objectContaining({ scale: 2 }));
    expect(pdfLibs.JsPdf.made).toEqual([{ orientation: 'portrait', unit: 'mm', format: 'a5' }]);
    expect(pdfLibs.addImage).toHaveBeenCalledTimes(1);
    // The copy of the page drawn for the picture is taken away again
    expect(document.body.textContent).not.toContain('Invented prescription');
  });
});
