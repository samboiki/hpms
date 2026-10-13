/**
 * Every word and amount on a printed credit note (parity D24). It is built from the invoice it credits
 * (buildInvoiceDocument: the practice letterhead, the patient, the medical aid and the treating practitioners) and
 * drawn by the same text PDF (invoicePdf.ts), so a credit note looks like the invoice it corrects and names it. The
 * lines are the ones credited, as they were when credited; the reason and, for a line the fund was claimed for, what
 * the fund is told are printed under them. Pure.
 */
import { formatNad, fromCents } from '../../utils/billing/money';
import { formatServiceDate } from '../../utils/billing/dates';
import { buildInvoiceDocument, type InvoiceDocument, type InvoiceDocumentInput, type InvoiceDocumentRow } from './invoiceDocument';

export interface CreditNoteDocumentLine {
  /** The invoice line credited (its ICD-10 codes are printed); null when the line was replaced since */
  invoiceLineId: string | null;
  code: string;
  description: string;
  /** yyyy-MM-dd */
  serviceDate: string | null;
  tooth: string | null;
  quantity: number;
  unitPriceCents: number | null;
  amountCents: number;
}

export interface CreditNoteDocumentInput {
  /** The invoice credited, as its own print reads it */
  invoice: InvoiceDocumentInput;
  creditNote: {
    number: string;
    portion: 'medical_aid' | 'patient';
    amountCents: number;
    reason: string;
    /** yyyy-MM-dd */
    issuedOn: string | null;
    reversed: { on: string | null; reason: string } | null;
  };
  /** The lines credited; empty for a credit note on a whole portion (made before credit notes per line) */
  lines: readonly CreditNoteDocumentLine[];
  /** What the medical aid is told about these lines, in sentences (describeReversal); empty when it was not claimed */
  fundNotes: readonly string[];
}

const nad = (cents: number): string => formatNad(fromCents(cents));

/** Builds the credit note document (the same shape the invoice PDF draws). */
export function buildCreditNoteDocument(input: CreditNoteDocumentInput): InvoiceDocument {
  const base = buildInvoiceDocument(input.invoice);
  const { creditNote } = input;
  const invoiceNumber = input.invoice.invoice.invoiceNumber;
  const icd10ByLine = new Map(input.invoice.lines.map(line => [line.id, line.icd10]));
  const portionWords = creditNote.portion === 'medical_aid' ? 'the medical aid' : 'the patient';

  const rows: InvoiceDocumentRow[] = input.lines.map(line => ({
    date: formatServiceDate(line.serviceDate),
    code: line.code,
    icd10: (line.invoiceLineId ? icd10ByLine.get(line.invoiceLineId) ?? [] : []).join(', '),
    tooth: line.tooth ?? '',
    description: line.description,
    quantity: String(line.quantity),
    unitPrice: line.unitPriceCents !== null ? nad(line.unitPriceCents) : '',
    discount: '',
    total: nad(line.amountCents),
    medicalAid: '',
    patient: ''
  }));
  if (rows.length === 0) {
    rows.push({
      date: formatServiceDate(creditNote.issuedOn),
      code: '',
      icd10: '',
      tooth: '',
      description: `Credit on what ${portionWords} owes on invoice ${invoiceNumber}`,
      quantity: '',
      unitPrice: '',
      discount: '',
      total: nad(creditNote.amountCents),
      medicalAid: '',
      patient: ''
    });
  }

  return {
    ...base,
    title: 'CREDIT NOTE',
    number: creditNote.number,
    meta: [`Date: ${formatServiceDate(creditNote.issuedOn)}`, `For invoice ${invoiceNumber}`],
    statusLabel: creditNote.reversed ? 'REVERSED' : null,
    columns: { tooth: base.columns.tooth, discount: false, portions: false },
    rows,
    totals: [{ label: `Credited to ${portionWords}`, value: nad(creditNote.amountCents), bold: true }],
    statements: [
      `Reason: ${creditNote.reason.trim()}`,
      ...input.fundNotes,
      ...(creditNote.reversed
        ? [`This credit note was reversed${creditNote.reversed.on ? ` on ${formatServiceDate(creditNote.reversed.on)}` : ''}: ${creditNote.reversed.reason.trim()}`]
        : []),
      `It takes the amount above off what ${portionWords} owes on invoice ${invoiceNumber}.`,
      'All amounts are in Namibian dollars (N$).'
    ],
    // A credit note is never paid: no bank details or payment reference
    footerRight: [`Credits invoice ${invoiceNumber}`],
    fileName: `credit-note-${creditNote.number.replace(/[^A-Za-z0-9-]/g, '')}.pdf`,
    missing: []
  };
}
