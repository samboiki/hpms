import React, { useEffect, useState } from 'react';
import { formatNad, fromCents } from '../../utils/billing/money';
import { formatLetterDate } from '../../utils/clinical/letters';
import type { DocumentEmailFacts } from '../../utils/messages/documentEmail';
import { emailDocument, type DocumentEmailResult } from '../../services/documentEmailService';
import { makeInvoicePdf } from '../../services/invoiceDocumentService';
import { loadLetterhead } from '../quotes/quoteService';
import type { PracticeLetterhead } from '../quotes/quotePdf';
import { Sheet } from '../finance/receipts/ArUi';
import { pdfBase64, renderFinanceDocumentPdf } from '../finance/receipts/documentPdf';
import { receiptPdfModel } from '../finance/receipts/receiptPdf';
import type { ReceiptDocument } from '../finance/receipts/receiptDocuments';
import { statementPdfModel } from '../finance/debtors/statementPdf';
import type { AccountStatement, StatementAccount, StatementMeta } from '../finance/debtors/statementDocument';
import { EmailDocumentForm, type EmailDraft } from './EmailDocumentForm';

/**
 * "Email" on an invoice, a receipt and a statement: the document as a PDF attachment through the centralized email
 * gateway, to the account holder or the patient, with a message staff can change. Each sheet reads the practice's
 * letterhead when it opens (the message names the practice and its phone number; the PDF carries the letterhead).
 * Finance's sheet, so it looks like the receipt and statement screens it opens from.
 */

interface SheetBase {
  open: boolean;
  onClose: () => void;
  practiceId: string;
  /** The patient the document belongs to (the email is kept with their messages) */
  patientId: string;
  onSent?: (to: string) => void;
}

interface DocumentSheetProps extends SheetBase {
  /** "invoice INV-0042" */
  title: string;
  attachmentName: string;
  facts: (letterhead: PracticeLetterhead) => DocumentEmailFacts;
  send: (draft: EmailDraft, letterhead: PracticeLetterhead) => Promise<DocumentEmailResult>;
}

const DocumentEmailSheet: React.FC<DocumentSheetProps> = ({ open, onClose, practiceId, patientId, onSent, title, attachmentName, facts, send }) => {
  const [letterhead, setLetterhead] = useState<PracticeLetterhead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);
    loadLetterhead(practiceId)
      .then(result => {
        if (active) setLetterhead(result);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not read the practice details.');
      });
    return () => {
      active = false;
    };
  }, [practiceId, open]);

  return (
    // Opened on purpose over whatever is showing (the full-screen patient file, the visit, a receipt sheet): always on top
    <Sheet open={open} onClose={onClose} title={`Email ${title}`} subtitle="Sent as a PDF attachment" icon="solar:letter-bold-duotone" size="md" overFullScreen>
      {letterhead ? (
        <EmailDocumentForm
          practiceId={practiceId}
          patientId={patientId}
          facts={facts(letterhead)}
          attachmentName={attachmentName}
          send={draft => send(draft, letterhead)}
          onCancel={onClose}
          onSent={to => {
            onSent?.(to);
            onClose();
          }}
        />
      ) : error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-sm text-gray-500" role="status">
          Preparing the email...
        </p>
      )}
    </Sheet>
  );
};

const amountOf = (rands: number | null | undefined): string | null => (typeof rands === 'number' && Number.isFinite(rands) && rands > 0 ? formatNad(rands) : null);

/** Email an invoice: the one invoice PDF of the app (invoiceDocumentService), as Print makes it. */
export const InvoiceEmailSheet: React.FC<SheetBase & { invoice: { id: string; number: string; total: number | null; visitId: string | null } }> = ({ invoice, ...base }) => (
  <DocumentEmailSheet
    {...base}
    title={`invoice ${invoice.number}`}
    attachmentName={`invoice-${invoice.number.replace(/[^A-Za-z0-9-]/g, '')}.pdf`}
    facts={letterhead => ({ kind: 'invoice', number: invoice.number, practiceName: letterhead.name, practicePhone: letterhead.contactPhone, amount: amountOf(invoice.total), date: null })}
    send={async draft => {
      const { doc, pdf } = await makeInvoicePdf(invoice.id);
      return emailDocument({
        ...draft,
        practiceId: base.practiceId,
        patientId: base.patientId,
        kind: 'invoice',
        emailType: 'invoice',
        attachment: { fileName: doc.fileName, base64: pdfBase64(pdf) },
        invoiceId: invoice.id,
        visitId: invoice.visitId,
        metadata: { invoiceNumber: invoice.number }
      });
    }}
  />
);

/** Email a receipt: the printed receipt's facts as a PDF on the letterhead. */
export const ReceiptEmailSheet: React.FC<SheetBase & { receiptId: string; document: ReceiptDocument; invoiceId?: string | null }> = ({
  receiptId,
  document,
  invoiceId,
  ...base
}) => (
  <DocumentEmailSheet
    {...base}
    title={`receipt ${document.receiptNumber}`}
    attachmentName={`receipt-${document.receiptNumber.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`}
    facts={letterhead => ({
      kind: 'receipt',
      number: document.receiptNumber,
      practiceName: document.practiceName || letterhead.name,
      practicePhone: letterhead.contactPhone,
      amount: formatNad(fromCents(document.amountCents)),
      date: null
    })}
    send={async (draft, letterhead) => {
      const model = receiptPdfModel(document, letterhead);
      return emailDocument({
        ...draft,
        practiceId: base.practiceId,
        patientId: base.patientId,
        kind: 'receipt',
        emailType: 'invoice',
        attachment: { fileName: model.fileName, base64: pdfBase64(renderFinanceDocumentPdf(model)) },
        invoiceId: invoiceId ?? null,
        metadata: { receiptId, receiptNumber: document.receiptNumber }
      });
    }}
  />
);

/** Email an account's statement: the printed statement's lines and words as a PDF on the letterhead. */
export const StatementEmailSheet: React.FC<SheetBase & { account: StatementAccount; built: AccountStatement; meta: StatementMeta }> = ({
  account,
  built,
  meta,
  ...base
}) => (
  <DocumentEmailSheet
    {...base}
    title="statement"
    attachmentName={`statement-${meta.asAtKey}.pdf`}
    facts={letterhead => ({
      kind: 'statement',
      number: null,
      practiceName: meta.practiceName || letterhead.name,
      practicePhone: meta.contactPhone ?? letterhead.contactPhone,
      amount: formatNad(fromCents(built.statement.closing.total)),
      date: formatLetterDate(meta.asAtKey) || null
    })}
    send={async (draft, letterhead) => {
      const model = statementPdfModel(account, built, meta, letterhead);
      return emailDocument({
        ...draft,
        practiceId: base.practiceId,
        patientId: base.patientId,
        kind: 'statement',
        emailType: 'invoice',
        attachment: { fileName: model.fileName, base64: pdfBase64(renderFinanceDocumentPdf(model)) },
        metadata: { asAt: meta.asAtKey }
      });
    }}
  />
);
