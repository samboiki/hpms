/**
 * The documents and sending of the debtors and controls screens: family statements (one statement
 * per account holder, every member's invoices, in English or Afrikaans), statement runs through
 * the communication gateways (one at a time, marked as bulk, failures counted, never sent here for
 * real), and the month-end pack (reprinted exactly from what was kept at the close).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  controlTotals,
  creditLimitStatus,
  effectiveFlags,
  zeroMovements,
  type AccountFlag,
  type ArAllocation,
  type ArInvoiceBalance,
  type ArReceipt,
  type PlannedStatement
} from '../../../services/ledgerService';
import { invoice } from '../../../services/__tests__/ledgerTestUtils';
import { flagChipText } from '../debtors/accountText';
import { accountStatement, statementEmail, statementSection, type StatementAccount, type StatementMeta } from '../debtors/statementDocument';
import { statementPdfModel } from '../debtors/statementPdf';
import type { PracticeLetterhead } from '../../quotes/quotePdf';
import { sendStatementRun, type StatementMessage } from '../debtors/statementSender';
import { controlTotalsTable, packFromSnapshot, packToHtml } from '../controls/controlsDocuments';
import type { ReportTable } from '../financeExport';
import { communicationService } from '../../../services/communicationService';

// Nothing in these tests may reach a real gateway
vi.mock('../../../services/communicationService', () => ({ communicationService: { sendSMS: vi.fn(), sendEmail: vi.fn() } }));

const AS_AT = '2026-10-07';
const zero = { medical_aid: 0, patient: 0 };

const LETTERHEAD: PracticeLetterhead = {
  id: 'pr', name: 'Test Practice', contactPhone: null, contactEmail: null, address: null, city: null, country: null, postalCode: null,
  practiceNumber: null, licenseNumber: null, taxNumber: null, primaryColor: null, bankName: null, accountNumber: null, branchCode: null
};

const balance = (invoiceId: string, patientId: string, billedCents: number, paidCents: number): ArInvoiceBalance => ({
  invoiceId, patientId, invoiceNumber: invoiceId, issueDate: null, dueDate: null, paymentStatus: paidCents >= billedCents ? 'paid' : 'pending',
  billed: { medical_aid: 0, patient: billedCents }, allocated: { medical_aid: 0, patient: paidCents }, credited: zero, writtenOff: zero, journals: zero,
  shortfallCents: 0, outstanding: { medical_aid: 0, patient: billedCents - paidCents }, hasActivity: paidCents > 0, hasEntries: paidCents > 0
});

const receipt = (overrides: Partial<ArReceipt>): ArReceipt => ({
  id: 'r1', number: 'RC-000001', payerType: 'patient', patientId: 'kid', fundName: null, payerName: null, method: 'cash', amountCents: 20000,
  receivedOn: '2026-09-25', reference: null, source: 'manual', notes: null, createdBy: 'u1', createdAt: '2026-09-25T10:00:00+02:00', reversal: null,
  allocatedCents: 20000, refundedCents: 0, unallocatedCents: 0, ...overrides
});

describe('family statements', () => {
  // Invented family: the holder owes N$300 from August; the child's N$200 invoice was paid by the child
  const invoices = [
    invoice({ id: 'inv-mum', invoiceNumber: 'INV-A', patientId: 'mum', issueDate: '2026-08-01', total: 300, medicalAidTotal: 0, patientTotal: 300 }),
    invoice({ id: 'inv-kid', invoiceNumber: 'INV-B', patientId: 'kid', issueDate: '2026-09-20', total: 200, medicalAidTotal: 0, patientTotal: 200, status: 'paid', rawStatus: 'paid' })
  ];
  const entries = {
    invoices,
    balances: { 'inv-mum': balance('inv-mum', 'mum', 30000, 0), 'inv-kid': balance('inv-kid', 'kid', 20000, 20000) },
    receipts: [receipt({})],
    allocations: [{ id: 'a1', receiptId: 'r1', invoiceId: 'inv-kid', portion: 'patient', amountCents: 20000, createdBy: null, createdAt: '2026-09-25T10:00:00+02:00', reversal: null }] as ArAllocation[],
    adjustments: []
  };
  const account: StatementAccount = {
    holderId: 'mum', holderName: 'Maria Testing', memberIds: ['kid'], patientNames: { mum: 'Maria Testing', kid: 'Kim Testing' }, reference: '1001', language: 'en'
  };
  const meta: StatementMeta = {
    practiceName: 'Test Practice', contactPhone: '061 000 000', contactEmail: null, asAtKey: AS_AT, message: '',
    payment: { bankName: 'Test Bank', accountHolder: 'Test Practice', accountNumber: '000111', branchCode: '000' }
  };

  it("is one statement for whoever pays: every member's invoices with whose they are, and a member's payment lowers the family's balance", () => {
    const built = accountStatement(account, entries, { fromKey: null, asAtKey: AS_AT });
    expect(built.statement.lines.map(line => line.kind)).toEqual(['invoice', 'invoice', 'receipt']);
    expect(built.patientOfInvoice).toEqual({ 'INV-A': 'Maria Testing', 'INV-B': 'Kim Testing' });
    expect(built.statement.closing).toEqual({ medicalAid: 0, patient: 30000, credit: 0, total: 30000 });
    // Aged by invoice date as the age analysis does: August's N$300 is 60 days old, the paid invoice owes nothing
    expect(built.ages.days_60).toBe(30000);
    expect(Object.values(built.ages).reduce((sum, cents) => sum + cents, 0)).toBe(30000);
  });

  it("speaks the account's language, so an Afrikaans account gets an Afrikaans statement", () => {
    const af = { ...account, language: 'af' as const };
    const html = statementSection(af, accountStatement(af, entries, { fromKey: null, asAtKey: AS_AT }), meta);
    expect(html).toContain('Rekeningstaat');
    expect(html).toContain('7 Okt 2026');
    expect(html).toContain('Pasiënte op hierdie rekening');
  });

  it('escapes names from the database, because the statement is HTML sent by email', () => {
    const odd = { ...account, holderName: '<img src=x onerror=alert(1)>' };
    const html = statementSection(odd, accountStatement(odd, entries, { fromKey: null, asAtKey: AS_AT }), meta);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('goes by email as the document itself, with the balance in the plain text and no password made from a date of birth', () => {
    const email = statementEmail(account, accountStatement(account, entries, { fromKey: null, asAtKey: AS_AT }), meta);
    expect(email.subject).toBe('Statement of account: Test Practice');
    expect(email.text).toContain('Balance: N$ 300.00');
    expect(email.html).toContain('Maria Testing');
    expect(`${email.html} ${email.text}`.toLowerCase()).not.toContain('password');
  });

  it("prints the account's own message and the practice's message on every statement of the account (parity I8, D22)", () => {
    const withMessage = { ...account, message: 'Arrangement: N$ 200 on the 25th of each month' };
    const built = accountStatement(withMessage, entries, { fromKey: null, asAtKey: AS_AT });
    const html = statementSection(withMessage, built, { ...meta, practiceMessage: 'Accounts are payable within 30 days.' });
    expect(html).toContain('<p class="message">Arrangement: N$ 200 on the 25th of each month</p>');
    expect(html).toContain('<p class="muted">Accounts are payable within 30 days.</p>');
    // The emailed PDF says the same
    const pdf = statementPdfModel(withMessage, built, { ...meta, practiceMessage: 'Accounts are payable within 30 days.' }, LETTERHEAD);
    expect(pdf.notices).toContain('Arrangement: N$ 200 on the 25th of each month');
    expect(pdf.paragraphs.map(paragraph => paragraph.text)).toContain('Accounts are payable within 30 days.');
  });

  it('leaves the paid invoice and its payment off when asked, says so, and the balance is the same (parity D26)', () => {
    const shown = accountStatement(account, entries, { fromKey: null, asAtKey: AS_AT });
    const short = accountStatement(account, entries, { fromKey: null, asAtKey: AS_AT, leaveSettledOff: true });
    expect(short.statement.lines.map(line => line.reference)).toEqual(['INV-A']);
    expect(short.settledLeftOff).toBe(1);
    expect(short.statement.closing).toEqual(shown.statement.closing);
    expect(short.ages).toEqual(shown.ages);
    expect(statementSection(account, short, meta)).toContain('Paid invoices, and the payments that settled them, are left off this statement.');
    expect(statementSection(account, shown, meta)).not.toContain('are left off this statement');
  });

  it("names the fund's authorisation numbers with the invoice, in English and Afrikaans (parity D15)", () => {
    const withNumbers = { ...entries, authorisations: { 'inv-mum': ['AUTH123', 'AUTH456'] } };
    const en = statementSection(account, accountStatement(account, withNumbers, { fromKey: null, asAtKey: AS_AT }), meta);
    expect(en).toContain('Invoice INV-A (Maria Testing), authorisations AUTH123, AUTH456');
    const af = { ...account, language: 'af' as const };
    const afHtml = statementSection(af, accountStatement(af, withNumbers, { fromKey: null, asAtKey: AS_AT }), meta);
    expect(afHtml).toContain('Faktuur INV-A (Maria Testing), magtigings AUTH123, AUTH456');
  });
});

describe('statement runs through the gateways', () => {
  const planned = (overrides: Partial<PlannedStatement>): PlannedStatement => ({
    patientId: 'p1', name: 'Test Holder', memberIds: ['p1'], channel: 'email', language: 'en', to: 'holder@example.com', owedCents: 30000, netCents: 30000, oldestAgeDays: 60, ...overrides
  });
  const context = { practiceId: 'practice-1', runId: 'run-1', bulk: true };
  const sendEmail = vi.mocked(communicationService.sendEmail);
  const sendSMS = vi.mocked(communicationService.sendSMS);

  beforeEach(() => {
    sendEmail.mockReset();
    sendSMS.mockReset();
  });

  it('sends one message at a time, marks each as part of the bulk run, and counts a failure without stopping the run', async () => {
    let release: (value: { success: boolean }) => void = () => undefined;
    sendEmail.mockImplementationOnce(() => new Promise(resolve => { release = resolve as typeof release; }) as never);
    sendSMS.mockResolvedValueOnce({ success: false, error: 'SMS limit reached' } as never);
    const messages: StatementMessage[] = [
      { planned: planned({}), email: { subject: 'Statement', html: '<p>Statement</p>', text: 'Statement' } },
      { planned: planned({ patientId: 'p2', channel: 'sms', to: '+264810000000' }), sms: 'Test Practice: your account balance is N$ 300.00.' },
      { planned: planned({ patientId: 'p3', channel: 'print', to: null }) }
    ];
    const progress: number[] = [];
    const run = sendStatementRun(messages, context, done => progress.push(done));

    // Gateways and bundles count every message: the SMS waits until the email is done
    await Promise.resolve();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendSMS).not.toHaveBeenCalled();
    release({ success: true });
    const totals = await run;

    expect(totals).toEqual({ emailed: 1, sms: 0, printed: 1, failed: 1, failures: [{ patient_id: 'p2', channel: 'sms', error: 'SMS limit reached' }] });
    expect(progress).toEqual([1, 2, 3]);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ practiceId: 'practice-1', recipientEmail: 'holder@example.com', patientId: 'p1', metadata: { kind: 'statement', statementRunId: 'run-1', bulkSend: true } });
    // Bulk: a patient who replied STOP is not texted by a run
    expect(sendSMS.mock.calls[0][0]).toMatchObject({ messageType: 'system', patientId: 'p2', metadata: { bulkSend: true } });
  });

  it('never calls a gateway without an address or a message, and never for statements to print', async () => {
    const totals = await sendStatementRun([
      { planned: planned({ to: null }), email: { subject: 'S', html: 'S', text: 'S' } },
      { planned: planned({ patientId: 'p2', channel: 'sms', to: '+264810000000' }) },
      { planned: planned({ patientId: 'p3', channel: 'print', to: null }) }
    ], context);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
    expect(totals).toMatchObject({ emailed: 0, sms: 0, printed: 1, failed: 2 });
  });
});

describe('flag chips on the patient file', () => {
  const limitFlag: AccountFlag = {
    id: 'f1', patientId: 'p1', flag: 'credit_limit', amountCents: 200000, value: null, reason: 'Agreed with the account holder',
    setBy: 'u1', setAt: '2026-09-01T10:00:00+02:00', clearedAt: null, clearedBy: null, clearReason: null
  };
  const alertFlag: AccountFlag = { ...limitFlag, id: 'f2', flag: 'alert', amountCents: null, value: 'Pays on the 25th of each month' };

  it('tells reception how far over its limit an account is, not only that it has one', () => {
    const flags = effectiveFlags({ patientId: 'p1', holderId: null, flags: [limitFlag], smsOptOut: false });
    expect(flagChipText(flags[0], creditLimitStatus(flags, 245000))).toBe('Over credit limit by N$ 450.00');
    expect(flagChipText(flags[0], creditLimitStatus(flags, 150000))).toBe('Credit limit N$ 2,000.00');
  });

  it("shows the account alert in the staff member's own words", () => {
    const flags = effectiveFlags({ patientId: 'p1', holderId: null, flags: [alertFlag], smsOptOut: false });
    expect(flagChipText(flags[0], null)).toBe('Pays on the 25th of each month');
  });
});

describe('the month-end pack', () => {
  const table: ReportTable = {
    title: 'Receipts by method September 2026',
    basis: 'Received 1-30 Sep 2026',
    columns: [{ header: 'Method', type: 'text' }, { header: 'Amount', type: 'money' }],
    rows: [['Cash <script>', 120.5]],
    totals: ['Total', 120.5]
  };

  it('reprints a closed month from the tables kept at the close, and ignores anything that is not a table', () => {
    expect(packFromSnapshot({ sections: [table, { title: 'half a table' }, null, 'junk'] })).toEqual([table]);
    expect(packFromSnapshot(null)).toEqual([]);
    expect(packFromSnapshot({ sections: 'not a list' })).toEqual([]);
  });

  it('prints every table, escaped, with the reprint banner on copies', () => {
    const html = packToHtml('Month-end pack September 2026', [table], { practiceName: 'Test Practice', banner: 'REPRINT, copy 2', generatedAt: new Date(2026, 9, 7, 9, 30) });
    expect(html).toContain('Receipts by method September 2026');
    expect(html).toContain('Cash &lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('REPRINT, copy 2');
    expect(html).toContain('generated 7 Oct 2026, 09:30');
  });

  it('shows the roll-forward with its difference to the account balances, zero when the entries explain them', () => {
    const before = { ...zeroMovements(), invoices: 100000, receipts: -40000 };
    const during = { ...zeroMovements(), invoices: 50000, receipts: -20000 };
    const totals = controlTotals('2026-09', { before, during, after: zeroMovements(), ledgerNetCents: 90000 });
    const rows = controlTotalsTable(totals, 'September 2026').rows;
    expect(rows[0]).toEqual(['Opening balance', 600]);
    expect(rows.find(row => row[0] === 'Closing balance')).toEqual(['Closing balance', 900]);
    expect(rows.find(row => row[0] === 'Difference')).toEqual(['Difference', 0]);
    // A balance the entries do not explain shows as a difference, never hidden
    const off = controlTotals('2026-09', { before, during, after: zeroMovements(), ledgerNetCents: 95000 });
    expect(controlTotalsTable(off, 'September 2026').rows.find(row => row[0] === 'Difference')).toEqual(['Difference', -50]);
  });
});
