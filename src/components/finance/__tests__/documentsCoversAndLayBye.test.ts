/**
 * What the papers a patient receives say after parity A8 and H2: a lay-bye statement says the account is paid
 * off as agreed instead of listing what is overdue, a statement says which services each payment covered (in
 * Afrikaans too), and a receipt prints what it paid line by line. Invented names and amounts.
 */
import { describe, expect, it } from 'vitest';
import type { AllocationCover, ArAllocation, ArInvoiceBalance, ArReceipt } from '../../../services/ledgerService';
import { invoice } from '../../../services/__tests__/ledgerTestUtils';
import { accountStatement, statementSection, type StatementAccount, type StatementMeta } from '../debtors/statementDocument';
import { receiptHtml, type ReceiptDocument } from '../receipts/receiptDocuments';

const AS_AT = '2026-10-07';
const zero = { medical_aid: 0, patient: 0 };

const covered: AllocationCover[] = [
  { allocationId: 'a1', invoiceLineId: 'l1', code: '0190', description: 'Consultation', dateKey: '2026-09-20', portion: 'patient', amountCents: 15000, chosen: false },
  { allocationId: 'a1', invoiceLineId: 'l2', code: 'GMED', description: 'Medicine', dateKey: '2026-09-20', portion: 'patient', amountCents: 5000, chosen: false }
];

const entries = {
  invoices: [invoice({ id: 'inv', invoiceNumber: 'INV-7', patientId: 'pt', issueDate: '2026-09-20', total: 500, medicalAidTotal: 0, patientTotal: 500 })],
  balances: {
    inv: {
      invoiceId: 'inv', patientId: 'pt', invoiceNumber: 'INV-7', issueDate: '2026-09-20', dueDate: null, paymentStatus: 'partial',
      billed: { medical_aid: 0, patient: 50000 }, allocated: { medical_aid: 0, patient: 20000 }, credited: zero, writtenOff: zero, journals: zero,
      shortfallCents: 0, outstanding: { medical_aid: 0, patient: 30000 }, hasActivity: true, hasEntries: true
    } as ArInvoiceBalance
  },
  receipts: [{
    id: 'r1', number: 'RC-000012', payerType: 'patient', patientId: 'pt', fundName: null, payerName: null, method: 'card', amountCents: 20000,
    receivedOn: '2026-09-25', reference: null, source: 'manual', notes: null, createdBy: 'u1', createdAt: '2026-09-25T10:00:00+02:00', reversal: null,
    allocatedCents: 20000, refundedCents: 0, unallocatedCents: 0
  } as ArReceipt],
  allocations: [{ id: 'a1', receiptId: 'r1', invoiceId: 'inv', portion: 'patient', amountCents: 20000, createdBy: null, createdAt: '2026-09-25T10:00:00+02:00', reversal: null, covers: covered }] as ArAllocation[],
  adjustments: []
};

const meta: StatementMeta = { practiceName: 'Test Practice', contactPhone: null, contactEmail: null, payment: null, asAtKey: AS_AT, message: '' };
const account = (overrides: Partial<StatementAccount> = {}): StatementAccount => ({
  holderId: 'pt', holderName: 'Test Holder', memberIds: [], patientNames: { pt: 'Test Holder' }, reference: null, language: 'en', ...overrides
});

describe('statements', () => {
  it('say which services a payment covered, so a patient can match the money to the visit', () => {
    const html = statementSection(account(), accountStatement(account(), entries, { fromKey: null, asAtKey: AS_AT }), meta);
    expect(html).toContain('Receipt RC-000012 (card), for 0190, GMED');
  });

  it('say it in Afrikaans too (the codes read the same)', () => {
    const af = account({ language: 'af' });
    const html = statementSection(af, accountStatement(af, entries, { fromKey: null, asAtKey: AS_AT }), meta);
    expect(html).toContain('Betaling ontvang RC-000012, vir 0190, GMED');
  });

  it('of a lay-bye say it is paid off as agreed and leave out the age of the debt: nothing on a lay-bye is overdue', () => {
    const layBye = account({ layBye: true });
    const html = statementSection(layBye, accountStatement(layBye, entries, { fromKey: null, asAtKey: AS_AT }), meta);
    expect(html).toContain('Lay-bye: this account is paid off as agreed.');
    expect(html).not.toContain('What is owed, by age');
    // An ordinary account keeps its age table
    expect(statementSection(account(), accountStatement(account(), entries, { fromKey: null, asAtKey: AS_AT }), meta)).toContain('What is owed, by age');
  });
});

describe('receipts', () => {
  const doc: ReceiptDocument = {
    practiceName: 'Test Practice', receiptNumber: 'RC-000012', receivedOn: '2026-09-25', payer: 'Test Holder', method: 'card', amountCents: 20000,
    lines: [{ invoiceNumber: 'INV-7', portion: 'patient', amountCents: 20000, covers: ['0190 Consultation N$ 150.00', 'GMED Medicine N$ 50.00'] }],
    unallocatedCents: 0
  };

  it('print what the payment covered under its invoice, line by line', () => {
    expect(receiptHtml(doc)).toContain('For 0190 Consultation N$ 150.00 · GMED Medicine N$ 50.00');
  });

  it('print as before when what it covered is not known', () => {
    expect(receiptHtml({ ...doc, lines: [{ invoiceNumber: 'INV-7', portion: 'patient', amountCents: 20000 }] })).not.toContain('For ');
  });
});
