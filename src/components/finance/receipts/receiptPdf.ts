/**
 * A receipt as a PDF on the practice letterhead, to email as an attachment: the same facts and words as the printed
 * receipt (receiptDocuments.ts receiptHtml), drawn by documentPdf.ts. Pure: no network.
 */
import { formatNad, fromCents } from '../../../utils/billing/money';
import { practiceLinesOf } from '../../../utils/clinical/letters';
import { PORTION_LABELS, RECEIPT_METHOD_LABELS } from '../../../services/ledgerService';
import type { PracticeLetterhead } from '../../quotes/quotePdf';
import { formatDay, type ReceiptDocument } from './receiptDocuments';
import type { FinanceDocumentPdf } from './documentPdf';

const nad = (cents: number): string => formatNad(fromCents(cents));

export function receiptPdfModel(doc: ReceiptDocument, letterhead: PracticeLetterhead): FinanceDocumentPdf {
  const facts: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'Received from', value: doc.payer },
    { label: 'Account of', value: doc.patientName && doc.patientName !== doc.payer ? doc.patientName : null },
    { label: 'Date', value: formatDay(doc.receivedOn) },
    { label: 'Paid by', value: RECEIPT_METHOD_LABELS[doc.method] },
    { label: 'Reference', value: doc.reference },
    { label: 'Received by', value: doc.receivedBy }
  ];
  return {
    practiceName: doc.practiceName || letterhead.name,
    practiceLines: practiceLinesOf(letterhead),
    primaryColor: letterhead.primaryColor,
    title: 'RECEIPT',
    number: doc.receiptNumber,
    meta: [formatDay(doc.receivedOn)],
    intro: [],
    notices: doc.reversed ? [`Reversed on ${formatDay(doc.reversed.on)}: ${doc.reversed.reason}`] : [],
    facts: facts.filter((fact): fact is { label: string; value: string } => Boolean(fact.value)),
    tables: [
      {
        heading: 'Paid on',
        columns: [{ title: 'Invoice', width: 34 }, { title: 'Portion' }, { title: 'Amount', right: true, width: 32 }],
        rows: doc.lines.map(line => [
          line.invoiceNumber,
          [`${PORTION_LABELS[line.portion]} portion`, line.covers && line.covers.length > 0 ? `For ${line.covers.join(' · ')}` : null].filter(Boolean).join('\n'),
          nad(line.amountCents)
        ]),
        emptyText: 'Not allocated to an invoice yet: kept as credit on the account'
      }
    ],
    totals: [
      ...(doc.unallocatedCents > 0 ? [{ label: 'Credit on the account (not allocated)', value: nad(doc.unallocatedCents) }] : []),
      { label: 'Amount received', value: nad(doc.amountCents), bold: true }
    ],
    paragraphs: [],
    footer: 'Thank you. Keep this receipt for your records.',
    fileName: `receipt-${doc.receiptNumber.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`
  };
}
