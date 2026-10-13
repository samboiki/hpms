import { describe, expect, it } from 'vitest';
import {
  accountAges,
  accountIdOfRowKey,
  describeAccount,
  emptyPayerAccountDraft,
  hasEmployees,
  invoicesOfAccount,
  normalizePayerAccount,
  normalizeVisitPayer,
  payerRowKey,
  payersByInvoice,
  planAccountPayment,
  referenceNumberProblem,
  sortAccounts,
  validatePayerAccountDraft,
  withoutAccountInvoices
} from '../payerAccounts';
import { buildAgingReport, type AgingItem } from '../../../services/ledger/receivables';
import { invoice } from '../../../services/__tests__/ledgerTestUtils';

const ACCOUNT = 'acc-1';
const OTHER = 'acc-2';

describe('reading an account', () => {
  it('keeps only rows a practice can bill, so a broken row never shows as a nameless account', () => {
    expect(normalizePayerAccount({ id: 'x', kind: 'employer', name: '  ' })).toBeNull();
    expect(normalizePayerAccount({ id: 'x', kind: 'bank', name: 'Test Bank' })).toBeNull();
    const account = normalizePayerAccount({ id: 'x', kind: 'employer', name: ' Kalahari Builders ', account_number: 'AC-0001', region: 'oshana' });
    expect(account?.name).toBe('Kalahari Builders');
    expect(account?.region).toBe('Oshana');
    expect(account && describeAccount(account)).toBe('Kalahari Builders (AC-0001)');
  });

  it('lists open accounts before closed ones, so staff pick a live account first', () => {
    const sorted = sortAccounts([
      { name: 'Alpha Mining', closedAt: '2026-01-01' },
      { name: 'Zeta Farms', closedAt: null },
      { name: 'Beta Fisheries', closedAt: null }
    ]);
    expect(sorted.map(account => account.name)).toEqual(['Beta Fisheries', 'Zeta Farms', 'Alpha Mining']);
  });

  it('bills the funds only through a case: their claims need the case details', () => {
    expect(hasEmployees('employer')).toBe(true);
    expect(hasEmployees('other')).toBe(true);
    expect(hasEmployees('compensation_fund')).toBe(false);
    expect(hasEmployees('mva_fund')).toBe(false);
  });
});

describe('checking an account before it is saved', () => {
  it('needs a name, as the database does, and tidies the spaces the way it is stored', () => {
    const empty = validatePayerAccountDraft(emptyPayerAccountDraft());
    expect(empty.ok).toBe(false);
    const named = validatePayerAccountDraft({ ...emptyPayerAccountDraft(), name: '  Kalahari   Builders  ', email: ' Accounts@Example.COM ' });
    expect(named.ok && named.value.name).toBe('Kalahari Builders');
    expect(named.ok && named.value.email).toBe('accounts@example.com');
  });

  it('keeps the postal address on its lines, because PO Box and town go on separate lines of a statement', () => {
    const checked = validatePayerAccountDraft({ ...emptyPayerAccountDraft(), name: 'Test Co', postalAddress: ' PO Box 1\nOshakati ' });
    expect(checked.ok && checked.value.postal_address).toBe('PO Box 1\nOshakati');
  });

  it('refuses an email or region the database would refuse, saying which field', () => {
    const checked = validatePayerAccountDraft({ ...emptyPayerAccountDraft(), name: 'Test Co', email: 'not-an-email', region: 'Kavango' });
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.errors.email).toMatch(/not valid/);
      expect(checked.errors.region).toMatch(/region/);
    }
  });

  it('stores an old region name as today\'s region', () => {
    const checked = validatePayerAccountDraft({ ...emptyPayerAccountDraft(), name: 'Test Co', region: 'Caprivi' });
    expect(checked.ok && checked.value.region).toBe('Zambezi');
  });

  it('refuses employee and claim numbers with characters the fund forms do not take', () => {
    expect(referenceNumberProblem('E-1002', 'The employee number')).toBeNull();
    expect(referenceNumberProblem('ECF/2026/0001', 'The claim number')).toBeNull();
    expect(referenceNumberProblem('bad;number', 'The claim number')).toMatch(/letters, digits/);
    expect(referenceNumberProblem('x'.repeat(31), 'The claim number')).toMatch(/too long/);
  });
});

describe('which invoices an account owes', () => {
  const visitPayers = [
    normalizeVisitPayer({ visit_id: 'v1', payer_account_id: ACCOUNT, injury_case_id: null }),
    normalizeVisitPayer({ visit_id: 'v2', payer_account_id: null, injury_case_id: 'case-1' }),
    normalizeVisitPayer({ visit_id: 'v3', payer_account_id: OTHER, injury_case_id: 'case-2' })
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  it('follows each invoice to its visit, so every invoice of a company visit is the company\'s', () => {
    const payers = payersByInvoice(
      [{ id: 'i1', visitId: 'v1' }, { id: 'i1b', visitId: 'v1' }, { id: 'i2', visitId: 'v2' }, { id: 'i3', visitId: 'v3' }, { id: 'i4', visitId: null }],
      visitPayers,
      [{ id: ACCOUNT, name: 'Kalahari Builders' }]
    );
    expect(payers.i1).toEqual({ accountId: ACCOUNT, name: 'Kalahari Builders' });
    expect(payers.i1b?.accountId).toBe(ACCOUNT);
    // A case the patient pays bills nobody else
    expect(payers.i2).toBeUndefined();
    // An account not loaded still owns its invoice, so it never falls back on the patient
    expect(payers.i3).toEqual({ accountId: OTHER, name: 'Payer account' });
    expect(payers.i4).toBeUndefined();
    expect([...invoicesOfAccount(payers, ACCOUNT)].sort()).toEqual(['i1', 'i1b']);
  });

  it('keys account rows apart from patients, so an account can never be mistaken for a patient file', () => {
    expect(payerRowKey(ACCOUNT)).toBe('payer:acc-1');
    expect(accountIdOfRowKey('payer:acc-1')).toBe(ACCOUNT);
    expect(accountIdOfRowKey('acc-1')).toBeNull();
  });
});

describe("an account's age analysis", () => {
  const item = (id: string, ageDays: number | null, patient: number, ageBand: AgingItem['ageBand']): AgingItem =>
    ({ invoice: { id } as AgingItem['invoice'], bucket: 'not_due', daysPastDue: 0, ageDays, ageBand, amount: patient, medicalAid: 0, patient });

  it('adds what its own invoices owe by the age of each, leaving other invoices out', () => {
    const ages = accountAges({ items: [item('i1', 10, 250, 'current'), item('i2', 95, 100.5, 'days_90'), item('other', 200, 999, 'days_180_plus')] }, new Set(['i1', 'i2']));
    expect(ages.bands.current).toBe(25000);
    expect(ages.bands.days_90).toBe(10050);
    expect(ages.bands.days_180_plus).toBe(0);
    expect(ages.owedCents).toBe(35050);
    expect(ages.invoiceCount).toBe(2);
    expect(ages.oldestAgeDays).toBe(95);
  });

  it('cannot call an account recent when one of its invoices has no date', () => {
    expect(accountAges({ items: [item('i1', 10, 50, 'current'), item('i2', null, 20, 'days_180_plus')] }, new Set(['i1', 'i2'])).oldestAgeDays).toBeNull();
  });
});

describe("allocating a company's payment", () => {
  const owing = [
    { invoiceId: 'new', invoiceNumber: 'INV-0003', dateKey: '2026-10-01', outstandingCents: 30000 },
    { invoiceId: 'old', invoiceNumber: 'INV-0001', dateKey: '2026-08-01', outstandingCents: 20000 },
    { invoiceId: 'mid', invoiceNumber: 'INV-0002', dateKey: '2026-09-01', outstandingCents: 10000 }
  ];

  it('pays the oldest invoice first, as every receipt is allocated', () => {
    const plan = planAccountPayment(25000, owing);
    expect(plan.lines.map(line => [line.invoiceId, line.amountCents])).toEqual([['old', 20000], ['mid', 5000]]);
    expect(plan.lines.every(line => line.portion === 'patient')).toBe(true);
    expect(plan.unallocatedCents).toBe(0);
  });

  it('keeps an overpayment as the account\'s credit instead of inventing a debt', () => {
    const plan = planAccountPayment(70000, owing);
    expect(plan.allocatedCents).toBe(60000);
    expect(plan.unallocatedCents).toBe(10000);
  });
});

// The patients' own debtors screens (work list, statement runs, interest, small balances) act on the receivables
// without the invoices accounts pay: a patient must never be reminded, charged interest or written off for them.
describe('the receivables without what accounts pay', () => {
  const report = buildAgingReport(
    [
      invoice({ id: 'own', patientId: 'p1', issueDate: '2026-09-01', dueDate: '2026-10-01', total: 120, medicalAidTotal: 100 }),
      invoice({ id: 'company', patientId: 'p1', issueDate: '2026-07-01', dueDate: '2026-07-31', total: 450, medicalAidTotal: 0 }),
      invoice({ id: 'undated', patientId: 'p2', issueDate: null, dueDate: null, createdAt: null, total: 30, medicalAidTotal: 0 })
    ],
    '2026-10-13'
  );

  it("leaves the account's invoices out and works the totals out again, so every total still adds up", () => {
    const own = withoutAccountInvoices(report, { company: { accountId: ACCOUNT, name: 'Test Builders' } });
    expect(own.items.map(item => item.invoice.id).sort()).toEqual(['own', 'undated']);
    expect(own.total).toBe(150);
    expect(own.medicalAid).toBe(100);
    expect(own.patient).toBe(50);
    expect(own.count).toBe(2);
    expect(own.undatedCount).toBe(1);
    const bucketTotal = Object.values(own.byBucket).reduce((sum, bucket) => sum + bucket.amount, 0);
    expect(bucketTotal).toBeCloseTo(own.total, 2);
    expect(own.pastDue).toBeCloseTo(own.total - own.byBucket.not_due.amount, 2);
  });

  it('returns the report itself when no account pays any of its invoices (nothing to work out again)', () => {
    expect(withoutAccountInvoices(report, {})).toBe(report);
  });
});
