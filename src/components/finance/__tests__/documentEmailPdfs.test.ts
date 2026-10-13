/**
 * Receipts and statements emailed as PDF attachments: the PDF says what the printed document says (the same facts,
 * words and language) and is real text, so the patient can search it and a screen reader can read it.
 */
import { describe, expect, it } from 'vitest';
import type { ArAllocation, ArInvoiceBalance, ArReceipt } from '../../../services/ledgerService';
import { invoice } from '../../../services/__tests__/ledgerTestUtils';
import type { PracticeLetterhead } from '../../quotes/quotePdf';
import { renderFinanceDocumentPdf } from '../receipts/documentPdf';
import { receiptPdfModel } from '../receipts/receiptPdf';
import type { ReceiptDocument } from '../receipts/receiptDocuments';
import { accountStatement, type StatementAccount, type StatementMeta } from '../debtors/statementDocument';
import { statementPdfModel } from '../debtors/statementPdf';

// Invented practice and people
const letterhead: PracticeLetterhead = {
  id: 'practice-1',
  name: 'Example Family Practice',
  contactPhone: '061 000 000',
  contactEmail: 'reception@example.test',
  address: '1 Example Street',
  city: 'Windhoek',
  country: 'Namibia',
  postalCode: null,
  practiceNumber: '0000000',
  licenseNumber: null,
  taxNumber: null,
  primaryColor: '#123456',
  bankName: null,
  accountNumber: null,
  branchCode: null
};

const textOf = (pdf: ReturnType<typeof renderFinanceDocumentPdf>): string => new TextDecoder('latin1').decode(pdf.output('arraybuffer'));

const receipt: ReceiptDocument = {
  practiceName: 'Example Family Practice',
  receiptNumber: 'RC-000012',
  receivedOn: '2026-10-12',
  payer: 'Maria Testing',
  patientName: 'Kim Testing',
  method: 'cash',
  amountCents: 35000,
  reference: null,
  lines: [{ invoiceNumber: 'INV-B', portion: 'patient', amountCents: 30000, covers: ['0190 Consultation N$ 300.00'] }],
  unallocatedCents: 5000,
  receivedBy: 'Reception',
  reversed: null
};

describe('the receipt PDF', () => {
  it('carries the printed receipt\'s facts: who paid, for whose account, how, on which invoice, and the credit left', () => {
    const model = receiptPdfModel(receipt, letterhead);
    expect(model.facts).toEqual([
      { label: 'Received from', value: 'Maria Testing' },
      { label: 'Account of', value: 'Kim Testing' },
      { label: 'Date', value: '12 Oct 2026' },
      { label: 'Paid by', value: 'Cash' },
      { label: 'Received by', value: 'Reception' }
    ]);
    expect(model.tables[0].rows).toEqual([['INV-B', 'Patient portion\nFor 0190 Consultation N$ 300.00', 'N$ 300.00']]);
    expect(model.totals).toEqual([
      { label: 'Credit on the account (not allocated)', value: 'N$ 50.00' },
      { label: 'Amount received', value: 'N$ 350.00', bold: true }
    ]);
    expect(model.fileName).toBe('receipt-RC-000012.pdf');
  });

  it('says plainly when a payment was reversed, so a reversed receipt is never mistaken for money received', () => {
    const model = receiptPdfModel({ ...receipt, reversed: { on: '2026-10-13', reason: 'Card payment declined' } }, letterhead);
    expect(model.notices).toEqual(['Reversed on 13 Oct 2026: Card payment declined']);
  });

  it('is a text PDF on the letterhead', () => {
    const raw = textOf(renderFinanceDocumentPdf(receiptPdfModel(receipt, letterhead)));
    expect(raw.startsWith('%PDF-')).toBe(true);
    for (const text of ['RECEIPT', 'RC-000012', 'Example Family Practice', 'N$ 350.00', 'Practice no: 0000000']) expect(raw).toContain(text);
    expect(raw).not.toMatch(/\/Subtype\s*\/Image/);
  });
});

describe('the statement PDF', () => {
  const zero = { medical_aid: 0, patient: 0 };
  const balance = (invoiceId: string, patientId: string, billedCents: number): ArInvoiceBalance => ({
    invoiceId, patientId, invoiceNumber: invoiceId, issueDate: null, dueDate: null, paymentStatus: 'pending',
    billed: { medical_aid: 0, patient: billedCents }, allocated: zero, credited: zero, writtenOff: zero, journals: zero,
    shortfallCents: 0, outstanding: { medical_aid: 0, patient: billedCents }, hasActivity: false, hasEntries: false
  });
  const entries = {
    invoices: [invoice({ id: 'inv-mum', invoiceNumber: 'INV-A', patientId: 'mum', issueDate: '2026-08-01', total: 300, medicalAidTotal: 0, patientTotal: 300 })],
    balances: { 'inv-mum': balance('inv-mum', 'mum', 30000) },
    receipts: [] as ArReceipt[],
    allocations: [] as ArAllocation[],
    adjustments: []
  };
  const account: StatementAccount = { holderId: 'mum', holderName: 'Maria Testing', memberIds: [], patientNames: { mum: 'Maria Testing' }, reference: '1001', language: 'en' };
  const meta: StatementMeta = {
    practiceName: 'Example Family Practice', contactPhone: '061 000 000', contactEmail: null, asAtKey: '2026-10-07', message: 'Our banking details changed.',
    payment: { bankName: 'Test Bank', accountHolder: 'Example Family Practice', accountNumber: '000111', branchCode: '000' }
  };
  const built = accountStatement(account, entries, { fromKey: null, asAtKey: '2026-10-07' });

  it('carries the lines, the age of what is owed, the balance and how to pay, as the printed statement does', () => {
    const model = statementPdfModel(account, built, meta, letterhead);
    expect(model.title).toBe('STATEMENT OF ACCOUNT');
    expect(model.intro[0]).toBe('Statement of account for Maria Testing');
    expect(model.notices).toEqual(['Our banking details changed.']);
    expect(model.tables).toHaveLength(2);
    expect(model.totals[model.totals.length - 1]).toEqual({ label: 'Balance', value: 'N$ 300.00', bold: true });
    expect(model.paragraphs[0].heading).toBe('How to pay');
    expect(model.fileName).toBe('statement-Maria-Testing-2026-10-07.pdf');
  });

  it("speaks the account's language: an Afrikaans account gets an Afrikaans PDF", () => {
    const af = { ...account, language: 'af' as const };
    const raw = textOf(renderFinanceDocumentPdf(statementPdfModel(af, accountStatement(af, entries, { fromKey: null, asAtKey: '2026-10-07' }), meta, letterhead)));
    expect(raw).toContain('REKENINGSTAAT');
    expect(raw).toContain('N$ 300.00');
  });

  it('leaves out the age of what is owed on a lay-bye account, which is paid off as agreed and never overdue', () => {
    const layBye = { ...account, layBye: true };
    const model = statementPdfModel(layBye, built, meta, letterhead);
    expect(model.tables).toHaveLength(1);
    expect(model.notices[1]).toMatch(/^Lay-bye/);
  });
});
