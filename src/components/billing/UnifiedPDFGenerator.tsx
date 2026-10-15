import React, { useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { makeInvoicePdf } from '../../services/invoiceDocumentService';

/** The invoice fields callers pass; the PDF itself is read fresh from the database by its id. */
interface InvoiceRef {
  id: string;
  invoice_number: string;
}

interface UnifiedPDFGeneratorProps {
  invoice: InvoiceRef;
  /** Kept for callers; the patient, member and fund come from the invoice's own records */
  patient?: unknown;
}

/**
 * Download or print one invoice: the one invoice PDF of the app, in the owner's own design (ownerInvoicePrint.ts).
 * After it is made, anything NAMAF rule 008 asks for that the patient's file lacks for a medical aid claim (a practice
 * number, an HPCNA number, an ICD-10 code) is listed, so it can be fixed; the owner's invoice does not print those.
 */
const UnifiedPDFGenerator: React.FC<UnifiedPDFGeneratorProps> = ({ invoice }) => {
  const [busy, setBusy] = useState<'download' | 'print' | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);

  const run = async (action: 'download' | 'print') => {
    setBusy(action);
    try {
      const { doc, pdf } = await makeInvoicePdf(invoice.id);
      setMissing(doc.missing);
      if (action === 'download') {
        pdf.save(doc.fileName);
      } else {
        // The browser's PDF viewer opens in a new tab, where it can be printed or shared
        const url = URL.createObjectURL(pdf.output('blob'));
        const opened = window.open(url, '_blank');
        if (!opened) {
          pdf.save(doc.fileName);
          toast('The PDF was downloaded because the browser blocked the new tab. Open it to print.', { duration: 6000 });
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) {
      toast.error(`Could not create the invoice PDF: ${error instanceof Error ? plainWords(error.message) : 'unknown error'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-gray-900">Invoice {invoice.invoice_number}</h3>
      <p className="mt-1 text-sm text-gray-600">The practice's invoice as a PDF: download it, or open it to print.</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void run('download')}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-700 disabled:opacity-60"
        >
          <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {busy === 'download' ? 'Making the PDF...' : 'Download PDF'}
        </button>
        <button
          type="button"
          onClick={() => void run('print')}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {busy === 'print' ? 'Opening...' : 'Open to print'}
        </button>
      </div>

      {missing && missing.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <p className="font-medium">The invoice was made. For medical aid claims (NAMAF rule 008) the patient's file still lacks:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {missing.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {missing && missing.length === 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700" role="status">
          <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Everything NAMAF rule 008 asks for is on file.
        </p>
      )}
    </div>
  );
};

export default UnifiedPDFGenerator;
