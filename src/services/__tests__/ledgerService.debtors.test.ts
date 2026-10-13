/**
 * Debtors: the age analysis (current to 180+, per account holder, patient, fund, administrator
 * and option, with unallocated credit), account flags, family accounts, credit control (promises,
 * the work list, the hand-over list), interest runs and statement runs. Amounts are cents unless a
 * name says otherwise.
 */
import { describe, it, expect } from 'vitest';
import {
  AGE_BANDS,
  DEFAULT_AGE_FILTER,
  DEFAULT_INTEREST_SETTINGS,
  DEFAULT_STATEMENT_CRITERIA,
  DEFAULT_WORK_LIST_FILTER,
  PATIENT_ACCOUNT_FILTER,
  PRIVATE_FUND,
  accountPatientRows,
  accountPayments,
  ageBandFor,
  buildAgeAnalysis,
  buildAgingReport,
  buildStatement,
  buildWorkList,
  checkAccountLink,
  checkAccountUnlink,
  checkFlagChange,
  checkInterestSettings,
  checkPromise,
  checkStatementCriteria,
  creditByPayer,
  creditLimitStatus,
  effectiveFlags,
  familyAccounts,
  flagKindsByPatient,
  flagTarget,
  handOverRows,
  holderByPatient,
  interestInvoices,
  monthlyInterestCents,
  parseStatementCriteria,
  patientAccountRow,
  planInterestRun,
  planStatementRun,
  promiseStatus,
  rateBasisPoints,
  reminderLevel,
  reminderSmsText,
  statementCriteriaJson,
  statementFromKey,
  statementLanguageOf,
  statementMessageOf,
  statementMessagesByAccount,
  runLeavesSettledOff,
  statementSmsText,
  type AccountFlag,
  type AccountHolderLink,
  type AgeAnalysisContext,
  type AgeAnalysisFilter,
  type AgeAnalysisRow,
  type ArInvoiceBalance,
  type ArReceipt,
  type InterestInvoice,
  type InterestSettings,
  type PaymentPromise
} from '../ledgerService';
import { cents, invoice, randomInvoices } from './ledgerTestUtils';

const TODAY = '2026-10-07';

let seq = 0;
const receipt = (overrides: Partial<ArReceipt> = {}): ArReceipt => {
  seq += 1;
  return {
    id: `r${seq}`,
    number: `RC-${String(seq).padStart(6, '0')}`,
    payerType: 'patient',
    patientId: 'pt1',
    fundName: null,
    payerName: null,
    method: 'cash',
    amountCents: 10000,
    receivedOn: '2026-10-02',
    reference: null,
    source: 'manual',
    notes: null,
    createdBy: 'u1',
    createdAt: '2026-10-02T09:00:00+02:00',
    reversal: null,
    allocatedCents: 10000,
    refundedCents: 0,
    unallocatedCents: 0,
    ...overrides
  };
};

const flag = (overrides: Partial<AccountFlag> & Pick<AccountFlag, 'patientId' | 'flag'>): AccountFlag => ({
  id: `f${++seq}`,
  amountCents: null,
  value: null,
  reason: 'Test reason',
  setBy: 'u1',
  setAt: '2026-09-30T10:00:00+02:00',
  clearedAt: null,
  clearedBy: null,
  clearReason: null,
  ...overrides
});

const link = (patientId: string, holderId: string, overrides: Partial<AccountHolderLink> = {}): AccountHolderLink => ({
  id: `l${++seq}`, patientId, holderId, relationship: 'child', linkedBy: 'u1', linkedAt: '2026-01-01T10:00:00+02:00', unlinkedAt: null, unlinkReason: null, ...overrides
});

const filter = (overrides: Partial<AgeAnalysisFilter> = {}): AgeAnalysisFilter => ({ ...DEFAULT_AGE_FILTER, excludeFlags: [], ...overrides });
const context = (overrides: Partial<AgeAnalysisContext> = {}): AgeAnalysisContext => ({
  patientNames: { a: 'Anna Amupolo', b: 'Ben Basson', c: 'Chris Coetzee' },
  fundByPatient: { a: 'NHP', b: 'PSEMAS', c: 'NHP' },
  ...overrides
});
const rowFor = (rows: AgeAnalysisRow[], key: string) => rows.find(row => row.key === key);

describe('age bands: days since the invoice date', () => {
  it.each([
    [0, 'current'], [29, 'current'], [30, 'days_30'], [59, 'days_30'], [60, 'days_60'], [90, 'days_90'],
    [120, 'days_120'], [150, 'days_150'], [179, 'days_150'], [180, 'days_180_plus'], [900, 'days_180_plus'], [-3, 'current']
  ] as const)('%i days old is in %s, the column a statement and Eminance show it in', (days, band) => {
    expect(ageBandFor(days)).toBe(band);
  });

  it('puts an undated debt in 180+: it cannot be shown to be recent, so it must not hide in "current"', () => {
    expect(ageBandFor(null)).toBe('days_180_plus');
  });

  it('ages from the invoice date, not the due date: a 45-day-old invoice due in 30 days is "30 days" old though only 15 days late', () => {
    const report = buildAgingReport([invoice({ issueDate: '2026-08-23', dueDate: '2026-09-22', patientId: 'a' })], TODAY);
    expect(report.items[0]).toMatchObject({ ageDays: 45, ageBand: 'days_30', daysPastDue: 15, bucket: 'days_0_30' });
  });
});

describe('buildAgeAnalysis', () => {
  const invoices = [
    invoice({ patientId: 'a', issueDate: '2026-10-01', total: 300, medicalAidTotal: 200 }),
    invoice({ patientId: 'a', issueDate: '2026-04-01', total: 50, medicalAidTotal: 0 }),
    invoice({ patientId: 'b', issueDate: '2026-07-01', total: 400, medicalAidTotal: 400, practitionerId: 'dr2' }),
    invoice({ patientId: 'c', issueDate: '2026-08-15', total: 80, medicalAidTotal: 60 })
  ];
  const report = buildAgingReport(invoices, TODAY);

  it('adds up, band by band, to the receivables ledger: the age analysis and the aging report never disagree', () => {
    for (const seed of [3, 17, 42]) {
      const generated = randomInvoices(250, seed);
      const aging = buildAgingReport(generated, TODAY);
      const analysis = buildAgeAnalysis(aging, filter(), { patientNames: {}, fundByPatient: {} });
      expect(analysis.totals.owedCents).toBe(cents(aging.total));
      expect(analysis.totals.medicalAidCents).toBe(cents(aging.medicalAid));
      expect(analysis.totals.patientCents).toBe(cents(aging.patient));
      expect(AGE_BANDS.reduce((sum, band) => sum + analysis.totals.bands[band.key], 0)).toBe(cents(aging.total));
    }
  });

  it('puts each account\'s debt in its age columns and lists the oldest debt first', () => {
    const analysis = buildAgeAnalysis(report, filter(), context());
    expect(analysis.rows.map(row => row.key)).toEqual(['a', 'b', 'c']); // a has a 189-day-old invoice
    expect(rowFor(analysis.rows, 'a')).toMatchObject({ accountId: 'a', owedCents: 35000, medicalAidCents: 20000, patientCents: 15000, invoiceCount: 2, oldestAgeDays: 189 });
    expect(rowFor(analysis.rows, 'a')!.bands).toMatchObject({ current: 30000, days_180_plus: 5000 });
  });

  it('shows a family account as one row under whoever pays, with each patient one tap away', () => {
    const family = context({ holderByPatient: holderByPatient([link('c', 'a')]) });
    const analysis = buildAgeAnalysis(report, filter(), family);
    expect(analysis.rows.map(row => row.key)).toEqual(['a', 'b']);
    expect(rowFor(analysis.rows, 'a')).toMatchObject({ label: 'Anna Amupolo', accountId: 'a', owedCents: 43000, patientIds: ['a', 'c'] });
    const patients = accountPatientRows(report, rowFor(analysis.rows, 'a')!, 'both', family);
    expect(patients.map(row => [row.key, row.owedCents])).toEqual([['a', 35000], ['c', 8000]]);
  });

  it('shows only what patients owe for a patient-liable run, so medical aid claims are not chased from the patient', () => {
    const analysis = buildAgeAnalysis(report, filter({ portion: 'patient' }), context());
    expect(analysis.rows.map(row => [row.key, row.owedCents])).toEqual([['a', 15000], ['c', 2000]]); // b owes nothing himself
    expect(analysis.totals.medicalAidCents).toBe(0);
  });

  it('shows unallocated credit next to the debt and nets it off, so a paid-up account is not chased', () => {
    const credit = creditByPayer([
      receipt({ patientId: 'a', unallocatedCents: 5000 }),
      receipt({ patientId: 'z', unallocatedCents: 2500 }), // owes nothing: still on the list, in credit
      receipt({ patientId: 'c', unallocatedCents: 900, reversal: { at: '2026-10-03T10:00:00+02:00', by: 'u1', reason: 'Captured twice' } }),
      receipt({ payerType: 'medical_aid', patientId: null, fundName: 'NHP', unallocatedCents: 7000 })
    ]);
    const analysis = buildAgeAnalysis(report, filter(), context({ creditByPatient: credit.byPatient, creditByFund: credit.byFund, patientNames: { a: 'Anna', z: 'Zelda' } }));
    expect(rowFor(analysis.rows, 'a')).toMatchObject({ unallocatedCents: 5000, netCents: 30000 });
    expect(rowFor(analysis.rows, 'z')).toMatchObject({ owedCents: 0, unallocatedCents: 2500, netCents: -2500 });
    expect(rowFor(analysis.rows, 'c')!.unallocatedCents).toBe(0); // a reversed receipt holds no credit
    expect(analysis.totals.unallocatedCents).toBe(7500);

    const byFund = buildAgeAnalysis(report, filter({ grouping: 'fund', portion: 'medical_aid' }), context({ creditByFund: credit.byFund }));
    expect(rowFor(byFund.rows, 'NHP')).toMatchObject({ owedCents: 26000, unallocatedCents: 7000, netCents: 19000 });
  });

  it('applies Eminance\'s filters: minimum balance, "older than", practitioner and search', () => {
    expect(buildAgeAnalysis(report, filter({ minBalanceCents: 30000 }), context()).rows.map(row => row.key)).toEqual(['a', 'b']);
    expect(buildAgeAnalysis(report, filter({ minAgeDays: 90 }), context()).rows.map(row => row.key)).toEqual(['a', 'b']);
    expect(buildAgeAnalysis(report, filter({ minAgeDays: 180 }), context()).rows.map(row => row.key)).toEqual(['a']);
    expect(buildAgeAnalysis(report, filter({ practitionerId: 'dr2' }), context()).rows.map(row => row.key)).toEqual(['b']);
    expect(buildAgeAnalysis(report, filter({ search: 'coet' }), context()).rows.map(row => row.key)).toEqual(['c']);
  });

  it('lists one fund\'s patients with their balances (R20), adding up to that fund\'s row, so a fund\'s members can be followed up on their own', () => {
    const credit = creditByPayer([receipt({ patientId: 'z', unallocatedCents: 2500 }), receipt({ patientId: 'b', unallocatedCents: 1000 })]);
    const ctx = context({ creditByPatient: credit.byPatient, fundByPatient: { ...context().fundByPatient, z: 'NHP' } });
    const nhp = buildAgeAnalysis(report, filter({ grouping: 'patient', fund: 'NHP' }), ctx);
    // z owes nothing but holds credit: still one of the fund's patients with a balance
    expect(nhp.rows.map(row => row.key).sort()).toEqual(['a', 'c', 'z']);
    const fundRow = rowFor(buildAgeAnalysis(report, filter({ grouping: 'fund' }), ctx).rows, 'NHP');
    expect(nhp.totals.owedCents).toBe(fundRow!.owedCents);
    expect(nhp.totals.unallocatedCents).toBe(2500); // b's credit belongs to PSEMAS's list, not NHP's
    // Patients without a recorded fund are the private list, and nobody with a fund is on it
    expect(buildAgeAnalysis(report, filter({ grouping: 'patient', fund: PRIVATE_FUND }), ctx).rows).toEqual([]);
  });

  it('leaves handed-over accounts out by default (the collector works them) without dropping the rest of their fund', () => {
    const flagged = context({ flagsByPatient: { a: ['handed_over'] } });
    expect(buildAgeAnalysis(report, DEFAULT_AGE_FILTER, flagged).rows.map(row => row.key)).toEqual(['b', 'c']);
    const byFund = buildAgeAnalysis(report, { ...DEFAULT_AGE_FILTER, grouping: 'fund' }, flagged);
    expect(rowFor(byFund.rows, 'NHP')).toMatchObject({ owedCents: 8000, patientIds: ['c'] });
    expect(buildAgeAnalysis(report, filter({ onlyFlag: 'handed_over' }), flagged).rows.map(row => row.key)).toEqual(['a']);
  });

  it('groups by fund, administrator and option, as the medical aid age analysis does', () => {
    const ctx = context({ administratorOf: fund => (fund === 'PSEMAS' ? 'Methealth' : 'Medscheme'), optionByPatient: { a: 'Gold', c: 'Silver' } });
    expect(buildAgeAnalysis(report, filter({ grouping: 'fund' }), ctx).rows.map(row => [row.key, row.owedCents]).sort()).toEqual([['NHP', 43000], ['PSEMAS', 40000]]);
    expect(buildAgeAnalysis(report, filter({ grouping: 'administrator' }), ctx).rows.map(row => [row.key, row.owedCents]).sort()).toEqual([['Medscheme', 43000], ['Methealth', 40000]]);
    expect(buildAgeAnalysis(report, filter({ grouping: 'option' }), ctx).rows.map(row => row.key).sort()).toEqual(['NHP · Gold', 'NHP · Silver', 'PSEMAS · Option not recorded']);
  });

  it('follows ledger balances once receipts are in use: a part-paid invoice shows only what is still owed', () => {
    const partPaid = invoice({ id: 'inv-pp', patientId: 'a', issueDate: '2026-09-01', total: 1000, medicalAidTotal: 0 });
    const balances: Record<string, ArInvoiceBalance> = {
      'inv-pp': {
        invoiceId: 'inv-pp', patientId: 'a', invoiceNumber: 'X', issueDate: '2026-09-01', dueDate: null, paymentStatus: 'partial',
        billed: { medical_aid: 0, patient: 100000 }, allocated: { medical_aid: 0, patient: 40000 }, credited: { medical_aid: 0, patient: 0 },
        writtenOff: { medical_aid: 0, patient: 0 }, journals: { medical_aid: 0, patient: 0 }, shortfallCents: 0,
        outstanding: { medical_aid: 0, patient: 60000 }, hasActivity: true, hasEntries: true
      }
    };
    const analysis = buildAgeAnalysis(buildAgingReport([partPaid], TODAY, balances), filter(), context());
    expect(analysis.rows[0]).toMatchObject({ owedCents: 60000, bands: expect.objectContaining({ days_30: 60000 }) });
  });
});

// A14, A19: a visit billed to the patient's employer or the compensation fund makes the whole invoice the account's
// debt (patient portion, nothing claimed). The age analysis must show it on the account's own row, or the patient
// would be chased, reminded and charged interest for what their employer owes.
describe('invoices billed to a company or fund account', () => {
  const ownInvoice = invoice({ id: 'inv-own', patientId: 'a', issueDate: '2026-10-01', total: 50, medicalAidTotal: 0 });
  const companyInvoice = invoice({ id: 'inv-co', patientId: 'a', issueDate: '2026-07-01', total: 500, medicalAidTotal: 0 });
  const fundInvoice = invoice({ id: 'inv-fund', patientId: 'c', issueDate: '2026-09-15', total: 80, medicalAidTotal: 60 });
  const report = buildAgingReport([ownInvoice, companyInvoice, fundInvoice], TODAY);
  const payerByInvoice = { 'inv-co': { accountId: 'acc1', name: 'Test Builders' } };

  it("puts the company's invoice on the company's own row in every grouping, never on the patient's", () => {
    for (const grouping of ['account', 'patient', 'fund', 'administrator', 'option'] as const) {
      const rows = buildAgeAnalysis(report, filter({ grouping }), context({ payerByInvoice })).rows;
      expect(rowFor(rows, 'payer:acc1')).toMatchObject({ label: 'Test Builders', accountId: null, owedCents: 50000, patientCents: 50000, flags: [] });
    }
    const accounts = buildAgeAnalysis(report, filter(), context({ payerByInvoice })).rows;
    expect(rowFor(accounts, 'a')?.owedCents).toBe(5000);
    expect(rowFor(buildAgeAnalysis(report, filter({ grouping: 'fund' }), context({ payerByInvoice })).rows, 'NHP')?.owedCents).toBe(5000 + 8000);
  });

  it('still adds up to the receivables ledger, and leaves out nothing', () => {
    const totals = buildAgeAnalysis(report, filter(), context({ payerByInvoice })).totals;
    expect(totals.owedCents).toBe(buildAgeAnalysis(report, filter(), context()).totals.owedCents);
    expect(totals.owedCents).toBe(5000 + 50000 + 8000);
  });

  it('never asks the patient for it: a reminder or promise sees only what the patient owes themselves', () => {
    expect(patientAccountRow(report, 'a', context({ payerByInvoice }))?.netCents).toBe(5000);
    // Without the payer information (before the tables exist) the invoice is the patient's, as before
    expect(patientAccountRow(report, 'a', context())?.netCents).toBe(55000);
  });

  it("keeps the company's invoice out of a fund's patients and of the patients with a flag", () => {
    expect(rowFor(buildAgeAnalysis(report, filter({ fund: 'NHP' }), context({ payerByInvoice })).rows, 'payer:acc1')).toBeUndefined();
    const flagged = context({ payerByInvoice, flagsByPatient: { a: ['dispute'] } });
    expect(rowFor(buildAgeAnalysis(report, filter({ onlyFlag: 'dispute' }), flagged).rows, 'payer:acc1')).toBeUndefined();
    // The patient's account handed over to a collector does not hide what the company owes
    const handedOver = context({ payerByInvoice, flagsByPatient: { a: ['handed_over'] } });
    expect(rowFor(buildAgeAnalysis(report, filter({ excludeFlags: ['handed_over'] }), handedOver).rows, 'payer:acc1')?.owedCents).toBe(50000);
  });
});

// ---------------------------------------------------------------------------------------------
// Family accounts and account flags
// ---------------------------------------------------------------------------------------------

describe('family accounts', () => {
  const links = [link('kid1', 'mum'), link('kid2', 'mum', { relationship: 'child' }), link('old', 'gran', { unlinkedAt: '2026-05-01T10:00:00+02:00', unlinkReason: 'Moved' })];

  it('knows who pays for whom, both ways', () => {
    const family = familyAccounts(links);
    expect(family.holderOf('kid1')).toBe('mum');
    expect(family.accountOf('kid2')).toBe('mum');
    expect(family.accountOf('mum')).toBe('mum'); // the holder pays for themselves too
    expect(family.membersOf('mum').map(member => member.patientId)).toEqual(['kid1', 'kid2']);
    expect(family.everyoneOf('mum')).toEqual(['mum', 'kid1', 'kid2']);
    expect(family.holderOf('old')).toBeNull(); // an ended link is history
  });

  it('keeps one level: an account holder is never someone else\'s dependant, so "who pays" is always one step', () => {
    expect(checkAccountLink({ patientId: 'mum', holderId: 'kid1', relationship: 'other', links }).error).toMatch(/paid for by someone else/);
    expect(checkAccountLink({ patientId: 'mum', holderId: 'dad', relationship: 'spouse', links }).error).toMatch(/pays for others/);
    expect(checkAccountLink({ patientId: 'kid1', holderId: 'dad', relationship: 'child', links }).error).toMatch(/another account/);
    expect(checkAccountLink({ patientId: 'x', holderId: 'x', relationship: 'other', links }).ok).toBe(false);
    expect(checkAccountLink({ patientId: 'old', holderId: 'mum', relationship: 'dependant', links }).ok).toBe(true);
  });

  it('asks why a patient leaves an account, because the account\'s history depends on it', () => {
    expect(checkAccountUnlink({ link: links[0], reason: '' }).ok).toBe(false);
    expect(checkAccountUnlink({ link: links[0], reason: 'Turned 21, pays own account' }).ok).toBe(true);
  });
});

describe('account flags', () => {
  const flags = [
    flag({ patientId: 'mum', flag: 'handed_over' }),
    flag({ patientId: 'mum', flag: 'credit_limit', amountCents: 200000, reason: '' }),
    flag({ patientId: 'mum', flag: 'statement_language', value: 'af', reason: '' }),
    flag({ patientId: 'kid1', flag: 'alert', value: 'Speak to the mother, not the child', reason: '' }),
    flag({ patientId: 'kid1', flag: 'dispute' }), // an account flag on a member's own file: not the account's
    flag({ patientId: 'mum', flag: 'cash_only', clearedAt: '2026-10-01T10:00:00+02:00', clearReason: 'Paid up' })
  ];

  it('shows a family member the account flags of whoever pays, and their own patient flags', () => {
    const kid = effectiveFlags({ patientId: 'kid1', holderId: 'mum', flags, smsOptOut: true });
    expect(kid.map(item => [item.kind, item.inherited])).toEqual([['alert', false], ['handed_over', true], ['credit_limit', true], ['no_sms', false], ['statement_language', true]]);
    expect(kid.find(item => item.kind === 'credit_limit')?.detail).toBe('N$ 2,000.00');
    expect(statementLanguageOf(kid)).toBe('af');
  });

  it('stores account flags on the account holder, so the whole family is covered by one setting', () => {
    expect(flagTarget('handed_over', 'kid1', 'mum')).toBe('mum');
    expect(flagTarget('alert', 'kid1', 'mum')).toBe('kid1');
    expect(flagTarget('credit_limit', 'solo', null)).toBe('solo');
  });

  it('lists the flags in force per patient for filters, inherited ones included', () => {
    const family = familyAccounts([link('kid1', 'mum')]);
    expect(flagKindsByPatient({ patientIds: ['kid1', 'mum'], holderOf: family.holderOf, flags })).toEqual({
      kid1: ['alert', 'handed_over', 'credit_limit', 'statement_language'],
      mum: ['handed_over', 'credit_limit', 'statement_language']
    });
  });

  it('lets only an admin or doctor hand an account over or set a credit limit: credit decisions with consequences', () => {
    expect(checkFlagChange({ kind: 'handed_over', setting: true, reason: 'Three broken promises' }, null, 'receptionist').ok).toBe(false);
    expect(checkFlagChange({ kind: 'handed_over', setting: true, reason: 'Three broken promises' }, null, 'doctor').ok).toBe(true);
    expect(checkFlagChange({ kind: 'credit_limit', setting: true, amountCents: 50000, reason: '' }, null, 'nurse').ok).toBe(false);
  });

  it('needs a reason where a flag has consequences, and a value where it carries one', () => {
    expect(checkFlagChange({ kind: 'dispute', setting: true, reason: ' ' }, null, 'receptionist').error).toMatch(/reason/);
    expect(checkFlagChange({ kind: 'alert', setting: true, value: 'Hard of hearing: speak clearly', reason: '' }, null, 'receptionist').ok).toBe(true);
    expect(checkFlagChange({ kind: 'alert', setting: true, value: 'x', reason: '' }, null, 'receptionist').ok).toBe(false);
    expect(checkFlagChange({ kind: 'credit_limit', setting: true, amountCents: 0, reason: '' }, null, 'admin').ok).toBe(false);
    expect(checkFlagChange({ kind: 'statement_language', setting: true, value: 'de', reason: '' }, null, 'admin').ok).toBe(false);
    expect(checkFlagChange({ kind: 'cash_only', setting: false, reason: 'Paid up' }, null, 'admin').error).toMatch(/has no/);
    expect(checkFlagChange({ kind: 'credit_limit', setting: true, amountCents: 200000, reason: '' }, flags[1], 'admin').error).toBe('Nothing changed');
  });

  it('says when an account is over its credit limit, so staff are warned before giving more credit', () => {
    const kid = effectiveFlags({ patientId: 'kid1', holderId: 'mum', flags, smsOptOut: false });
    expect(creditLimitStatus(kid, 245000)).toEqual({ limitCents: 200000, owedCents: 245000, overCents: 45000, over: true });
    expect(creditLimitStatus(kid, 150000)?.over).toBe(false);
    expect(creditLimitStatus([], 999999)).toBeNull();
  });

  it("keeps the account's statement message on whoever pays, so every family member's statement carries it (parity I8)", () => {
    const withMessage = [
      ...flags,
      flag({ patientId: 'mum', flag: 'statement_message', value: 'Arrangement: N$ 200 a month', reason: '' }),
      flag({ patientId: 'solo', flag: 'statement_message', value: 'An old arrangement', reason: '', clearedAt: '2026-10-02T09:00:00+02:00' })
    ];
    const kid = effectiveFlags({ patientId: 'kid1', holderId: 'mum', flags: withMessage, smsOptOut: false });
    expect(statementMessageOf(kid)).toBe('Arrangement: N$ 200 a month');
    // A cleared message no longer prints
    expect(statementMessagesByAccount(withMessage)).toEqual({ mum: 'Arrangement: N$ 200 a month' });
    expect(flagTarget('statement_message', 'kid1', 'mum')).toBe('mum');
  });

  it('lets any staff member write a statement message that says something and fits on a statement', () => {
    expect(checkFlagChange({ kind: 'statement_message', setting: true, value: 'Arrangement: N$ 200 a month', reason: '' }, null, 'receptionist').ok).toBe(true);
    expect(checkFlagChange({ kind: 'statement_message', setting: true, value: 'ok', reason: '' }, null, 'receptionist').error).toMatch(/message for this account/);
    expect(checkFlagChange({ kind: 'statement_message', setting: true, value: 'x'.repeat(281), reason: '' }, null, 'receptionist').error).toMatch(/280/);
  });
});

// ---------------------------------------------------------------------------------------------
// Credit control
// ---------------------------------------------------------------------------------------------

const promise = (overrides: Partial<PaymentPromise> = {}): PaymentPromise => ({
  id: `p${++seq}`,
  patientId: 'a',
  madeOn: '2026-10-01',
  promisedOn: '2026-10-05',
  amountCents: 20000,
  note: null,
  createdBy: 'u1',
  createdAt: '2026-10-01T09:00:00+02:00',
  cancelledAt: null,
  cancelReason: null,
  ...overrides
});

describe('promises to pay', () => {
  it('is kept when the account was paid at least the promised amount between the promise and the promised day', () => {
    const status = promiseStatus(promise(), [receipt({ patientId: 'a', receivedOn: '2026-10-03', amountCents: 15000 }), receipt({ patientId: 'a', receivedOn: '2026-10-05', amountCents: 5000 })], TODAY);
    expect(status).toEqual({ state: 'kept', paidCents: 20000, paidLateCents: 0, shortCents: 0 });
  });

  it('stays broken when the money came late, because broken promises are what escalation counts', () => {
    const status = promiseStatus(promise(), [receipt({ patientId: 'a', receivedOn: '2026-10-06', amountCents: 20000 })], TODAY);
    expect(status).toEqual({ state: 'broken', paidCents: 0, paidLateCents: 20000, shortCents: 20000 });
  });

  it('counts a payment made on a family member\'s file towards the account holder\'s promise', () => {
    const family = familyAccounts([link('kid', 'a')]);
    const payments = [receipt({ patientId: 'kid', receivedOn: '2026-10-04', amountCents: 20000 })];
    expect(promiseStatus(promise(), payments, TODAY, family.accountOf).state).toBe('kept');
    expect(accountPayments(payments, 'a', family.accountOf)).toHaveLength(1);
    expect(promiseStatus(promise(), payments, TODAY).state).toBe('broken'); // without the family link it is someone else's money
  });

  it('does not count a medical aid payment or a reversed receipt as the account keeping a promise', () => {
    const status = promiseStatus(promise({ promisedOn: '2026-10-10' }), [
      receipt({ patientId: 'a', payerType: 'medical_aid', fundName: 'NHP', receivedOn: '2026-10-02', amountCents: 50000 }),
      receipt({ patientId: 'a', receivedOn: '2026-10-02', amountCents: 20000, reversal: { at: '2026-10-03T10:00:00+02:00', by: 'u1', reason: 'EFT bounced' } })
    ], TODAY);
    expect(status).toMatchObject({ state: 'open', paidCents: 0 });
  });

  it('is due today on the promised day, so the morning follow-up finds it', () => {
    expect(promiseStatus(promise({ promisedOn: TODAY }), [], TODAY).state).toBe('due_today');
    expect(promiseStatus(promise({ cancelledAt: '2026-10-02T10:00:00+02:00' }), [], TODAY).state).toBe('cancelled');
  });

  it('refuses a promise in the past or for more than the account owes', () => {
    expect(checkPromise({ amountCents: 1000, promisedOn: '2026-10-06', todayKey: TODAY, owedCents: 5000 }).ok).toBe(false);
    expect(checkPromise({ amountCents: 6000, promisedOn: '2026-10-09', todayKey: TODAY, owedCents: 5000 }).error).toMatch(/cannot be for more/);
    expect(checkPromise({ amountCents: 5000, promisedOn: TODAY, todayKey: TODAY, owedCents: 5000 }).ok).toBe(true);
  });
});

describe('credit-control work list', () => {
  const accounts = (rows: Array<Partial<AgeAnalysisRow> & { key: string }>): AgeAnalysisRow[] => rows.map(row => ({
    label: row.key.toUpperCase(),
    accountId: row.key,
    bands: { current: 0, days_30: 0, days_60: 0, days_90: 0, days_120: 0, days_150: 0, days_180_plus: 0, ...row.bands },
    medicalAidCents: 0,
    patientCents: row.owedCents ?? 0,
    owedCents: 0,
    unallocatedCents: 0,
    netCents: row.owedCents ?? 0,
    invoiceCount: 1,
    oldestAgeDays: 40,
    patientIds: [row.key],
    flags: [],
    ...row
  }));

  const list = accounts([
    { key: 'old', owedCents: 5000, oldestAgeDays: 200, bands: { days_180_plus: 5000 } as AgeAnalysisRow['bands'] },
    { key: 'broke', owedCents: 3000, oldestAgeDays: 45, bands: { days_30: 3000 } as AgeAnalysisRow['bands'] },
    { key: 'today', owedCents: 9000, oldestAgeDays: 60, bands: { days_60: 9000 } as AgeAnalysisRow['bands'] },
    { key: 'collector', owedCents: 99000, oldestAgeDays: 300, bands: { days_180_plus: 99000 } as AgeAnalysisRow['bands'], flags: ['handed_over'] },
    { key: 'new', owedCents: 7000, oldestAgeDays: 5, bands: { current: 7000 } as AgeAnalysisRow['bands'] }
  ]);
  const promises = [promise({ patientId: 'broke', promisedOn: '2026-10-05' }), promise({ patientId: 'today', promisedOn: TODAY })];

  it('puts broken promises first, then promises due today, then the oldest debt, so the day\'s follow-up is on top', () => {
    const rows = buildWorkList({ accounts: list, notes: [], promises, receipts: [], todayKey: TODAY, filter: DEFAULT_WORK_LIST_FILTER });
    expect(rows.map(row => row.patientId)).toEqual(['broke', 'today', 'old']); // 'new' is under 30 days; 'collector' is handed over
    expect(rows[0]).toMatchObject({ brokenPromises: 1, escalation: 1, memberIds: ['broke'] });
  });

  it('shows handed-over accounts only in their own view, so nobody calls a patient the collector is already handling', () => {
    const rows = buildWorkList({ accounts: list, notes: [], promises, receipts: [], todayKey: TODAY, filter: { ...DEFAULT_WORK_LIST_FILTER, view: 'handed_over' } });
    expect(rows.map(row => row.patientId)).toEqual(['collector']);
  });

  it('finds overdue accounts nobody contacted in 30 days', () => {
    const notes = [{ id: 'n1', patientId: 'old', channel: 'call' as const, note: 'Will pay on Friday', createdBy: 'u1', createdAt: '2026-10-01T10:00:00+02:00' }];
    const rows = buildWorkList({ accounts: list, notes, promises: [], receipts: [], todayKey: TODAY, filter: { ...DEFAULT_WORK_LIST_FILTER, view: 'no_recent_contact' } });
    expect(rows.map(row => row.patientId)).toEqual(['today', 'broke']);
  });

  it('lists the handed-over accounts with what the debt collector needs, largest first', () => {
    const rows = buildWorkList({ accounts: list, notes: [], promises: [], receipts: [], todayKey: TODAY, filter: { ...DEFAULT_WORK_LIST_FILTER, view: 'handed_over', minAgeDays: 0 } });
    const handOver = handOverRows({
      workList: rows,
      flags: [flag({ patientId: 'collector', flag: 'handed_over', reason: 'No contact since May' })],
      contacts: { collector: { name: 'C Ollector', idNumber: '80010100123', cellNumber: '0811234567', email: null, address: 'Windhoek', reference: '1042' } }
    });
    expect(handOver).toHaveLength(1);
    expect(handOver[0]).toMatchObject({ owedCents: 99000, handedOverOn: '2026-09-30', reason: 'No contact since May', contact: { idNumber: '80010100123' } });
  });
});

// ---------------------------------------------------------------------------------------------
// Interest
// ---------------------------------------------------------------------------------------------

describe('interest runs', () => {
  const on: InterestSettings = { ...DEFAULT_INTEREST_SETTINGS, enabled: true, annualRatePercent: 12, minAgeDays: 60, minimumChargeCents: 100 };
  const inv = (overrides: Partial<InterestInvoice> = {}): InterestInvoice => ({
    invoiceId: `i${++seq}`, invoiceNumber: `INV-${seq}`, patientId: 'a', ageDays: 90, patientOwedCents: 100000, medicalAidOwedCents: 0, interestChargedCents: 0, ...overrides
  });

  it('is off by default: no practice charges interest until it chooses to', () => {
    expect(DEFAULT_INTEREST_SETTINGS.enabled).toBe(false);
    const plan = planInterestRun([inv()], DEFAULT_INTEREST_SETTINGS, {});
    expect(plan.lines).toEqual([]);
    expect(plan.excluded[0].reason).toBe('interest_off');
  });

  it('charges a twelfth of the yearly rate, rounded half up to the cent', () => {
    expect(monthlyInterestCents(100000, 1200)).toBe(1000); // N$1,000 at 12% = N$10.00 a month
    expect(monthlyInterestCents(12345, 1050)).toBe(108); // 123.45 x 10.5% / 12 = 1.0802 -> N$1.08
    expect(monthlyInterestCents(-5000, 1200)).toBe(0);
    expect(rateBasisPoints(10.5)).toBe(1050);
    expect(rateBasisPoints(10.555)).toBeNull();
    expect(rateBasisPoints(0)).toBeNull();
  });

  it('never charges on what a medical aid owes unless the practice turned that on, and then the patient pays it', () => {
    const invoiceOwedByFund = inv({ patientOwedCents: 0, medicalAidOwedCents: 100000 });
    expect(planInterestRun([invoiceOwedByFund], on, {}).excluded[0].reason).toBe('nothing_owed');
    const withFund = planInterestRun([invoiceOwedByFund], { ...on, includeMedicalAidPortion: true }, {});
    expect(withFund.lines[0]).toMatchObject({ baseCents: 100000, interestCents: 1000, patientId: 'a' });
  });

  it('never charges interest on interest, and stops when unpaid interest equals the capital (in duplum)', () => {
    // Owes N$1,000: N$600 capital and N$400 interest already charged -> 1% of N$600, not of N$1,000
    expect(planInterestRun([inv({ patientOwedCents: 100000, interestChargedCents: 40000 })], on, {}).lines[0]).toMatchObject({ baseCents: 60000, interestCents: 600, capped: false });
    // Owes N$1,000: N$500 capital and N$500 unpaid interest -> the cap is reached
    expect(planInterestRun([inv({ patientOwedCents: 100000, interestChargedCents: 50000 })], on, {}).excluded[0].reason).toBe('cap_reached');
    // N$100 capital with N$95 unpaid interest: a month at 100% a year (N$8.33) is cut to the N$5 of room
    const capped = planInterestRun([inv({ patientOwedCents: 19500, interestChargedCents: 9500 })], { ...on, annualRatePercent: 100 }, {});
    expect(capped.lines[0]).toMatchObject({ baseCents: 10000, interestCents: 500, capped: true });
  });

  it('skips disputed and handed-over accounts (a family member inherits the holder\'s flags), young debts and charges below the minimum', () => {
    const flags = flagKindsByPatient({ patientIds: ['d', 'h', 'kid'], holderOf: id => (id === 'kid' ? 'h' : null), flags: [flag({ patientId: 'd', flag: 'dispute' }), flag({ patientId: 'h', flag: 'handed_over' })] });
    const plan = planInterestRun([
      inv({ patientId: 'd' }), inv({ patientId: 'h' }), inv({ patientId: 'kid' }), inv({ ageDays: 30 }), inv({ patientOwedCents: 500 }), inv({ patientId: null })
    ], on, flags);
    expect(plan.excluded.map(item => item.reason)).toEqual(['disputed', 'handed_over', 'handed_over', 'too_recent', 'below_minimum', 'no_patient']);
    expect(plan.totalCents).toBe(0);
  });

  it('refuses settings that would charge interest without a sensible rate', () => {
    expect(checkInterestSettings({ ...on, annualRatePercent: 0 }).ok).toBe(false);
    expect(checkInterestSettings({ ...on, minAgeDays: 7 }).ok).toBe(false);
    expect(checkInterestSettings(on).ok).toBe(true);
    expect(checkInterestSettings(DEFAULT_INTEREST_SETTINGS).ok).toBe(true); // off: nothing to check
  });

  it('works on what is still owed after part payments, and carries interest already standing so the cap holds across months', () => {
    // Billed N$1,000, N$400 paid: interest is on the N$600 still owed, never on what was billed
    const partPaid = invoice({ id: 'inv-int', patientId: 'a', issueDate: '2026-07-01', total: 1000, medicalAidTotal: 0 });
    const balances: Record<string, ArInvoiceBalance> = {
      'inv-int': {
        invoiceId: 'inv-int', patientId: 'a', invoiceNumber: 'X', issueDate: '2026-07-01', dueDate: null, paymentStatus: 'partial',
        billed: { medical_aid: 0, patient: 100000 }, allocated: { medical_aid: 0, patient: 40000 }, credited: { medical_aid: 0, patient: 0 },
        writtenOff: { medical_aid: 0, patient: 0 }, journals: { medical_aid: 0, patient: 0 }, shortfallCents: 0,
        outstanding: { medical_aid: 0, patient: 60000 }, hasActivity: true, hasEntries: true
      }
    };
    const invoices = interestInvoices(buildAgingReport([partPaid], TODAY, balances), { 'inv-int': 10000 });
    expect(invoices).toEqual([expect.objectContaining({ invoiceId: 'inv-int', patientId: 'a', patientOwedCents: 60000, medicalAidOwedCents: 0, interestChargedCents: 10000 })]);
    expect(invoices[0].ageDays).toBeGreaterThanOrEqual(60);
    // N$100 of the N$600 is last month's interest: this month is on the N$500 capital only
    expect(planInterestRun(invoices, on, {}).lines[0]).toMatchObject({ baseCents: 50000, interestCents: 500 });
  });
});

// ---------------------------------------------------------------------------------------------
// Statement runs
// ---------------------------------------------------------------------------------------------

describe('statement runs', () => {
  const report = buildAgingReport([
    invoice({ patientId: 'a', issueDate: '2026-08-01', total: 500, medicalAidTotal: 0 }),
    invoice({ patientId: 'b', issueDate: '2026-08-01', total: 50, medicalAidTotal: 0 }),
    invoice({ patientId: 'c', issueDate: '2026-10-01', total: 900, medicalAidTotal: 0 }),
    invoice({ patientId: 'd', issueDate: '2026-07-01', total: 300, medicalAidTotal: 0 }),
    invoice({ patientId: 'e', issueDate: '2026-07-01', total: 300, medicalAidTotal: 0 }),
    invoice({ patientId: 'f', issueDate: '2026-06-01', total: 700, medicalAidTotal: 0 }),
    invoice({ patientId: 'g', issueDate: '2026-06-01', total: 200, medicalAidTotal: 0 })
  ], TODAY);
  const accounts = buildAgeAnalysis(report, { ...DEFAULT_AGE_FILTER, excludeFlags: [], portion: 'patient' }, {
    patientNames: { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F', g: 'G' },
    fundByPatient: {},
    flagsByPatient: { d: ['no_statement'], e: ['dispute'] },
    creditByPatient: { g: 20000 }
  }).rows;

  it('selects as the saved criteria say (over N$100, older than 30 days) and never sends to an account marked "no statements"', () => {
    const plan = planStatementRun({
      accounts,
      criteria: { ...DEFAULT_STATEMENT_CRITERIA, excludeDisputed: true },
      contacts: { a: { email: 'a@example.com', cellNumber: null }, f: { email: null, cellNumber: '0812345678' } },
      fundByPatient: {},
      languageByAccount: { f: 'af' }
    });
    expect(plan.statements.map(s => [s.patientId, s.channel, s.language])).toEqual([['a', 'email', 'en'], ['f', 'print', 'af']]);
    expect(Object.fromEntries(plan.skipped.map(s => [s.patientId, s.reason]))).toEqual({ b: 'below_minimum', c: 'too_recent', d: 'no_statement', e: 'disputed', g: 'in_credit' });
    expect(plan.counts).toEqual({ email: 1, sms: 0, print: 1 });
  });

  it('sends a family one statement, to the account holder, listing every member who owes', () => {
    const family = buildAgeAnalysis(report, { ...DEFAULT_AGE_FILTER, excludeFlags: [], portion: 'patient' }, {
      patientNames: { a: 'A', b: 'B' }, fundByPatient: {}, holderByPatient: { b: 'a' }
    }).rows;
    const plan = planStatementRun({ accounts: family, criteria: DEFAULT_STATEMENT_CRITERIA, contacts: { a: { email: 'a@example.com', cellNumber: null } }, fundByPatient: {} });
    expect(plan.statements.find(s => s.patientId === 'a')).toMatchObject({ memberIds: ['a', 'b'], owedCents: 55000, to: 'a@example.com' });
  });

  it('falls back through the channels in order and skips an account with no way to reach it rather than "sending" nothing', () => {
    const plan = planStatementRun({
      accounts,
      criteria: { ...DEFAULT_STATEMENT_CRITERIA, channels: ['email', 'sms'], minAgeDays: 0, minBalanceCents: 0 },
      contacts: { f: { email: 'not-an-email', cellNumber: '081 234 5678' } },
      fundByPatient: {}
    });
    expect(plan.statements.find(s => s.patientId === 'f')).toMatchObject({ channel: 'sms', to: '081 234 5678' });
    expect(plan.skipped.find(s => s.patientId === 'a')?.reason).toBe('no_channel');
  });

  it('keeps only members of the chosen funds when a run is per fund', () => {
    const plan = planStatementRun({ accounts, criteria: { ...DEFAULT_STATEMENT_CRITERIA, funds: ['NHP'] }, contacts: {}, fundByPatient: { a: 'nhp' } });
    expect(plan.statements.map(s => s.patientId)).toEqual(['a']);
  });

  it('round-trips saved criteria and falls back to safe defaults for anything broken in storage', () => {
    const saved = { ...DEFAULT_STATEMENT_CRITERIA, minBalanceCents: 5000, channels: ['sms', 'print'] as Array<'sms' | 'print'>, message: 'Closed 20 Dec to 3 Jan' };
    expect(parseStatementCriteria(statementCriteriaJson(saved), saved.name)).toEqual(saved);
    expect(parseStatementCriteria({ min_balance_cents: -1, channels: ['fax'], history_months: 99 }, null)).toMatchObject({
      minBalanceCents: DEFAULT_STATEMENT_CRITERIA.minBalanceCents, channels: ['email', 'print'], historyMonths: 36, excludeHandedOver: true
    });
    expect(checkStatementCriteria({ ...DEFAULT_STATEMENT_CRITERIA, channels: [] }).ok).toBe(false);
  });

  it("follows the practice's default for settled items unless the run chose, and runs saved before the choice follow the default (parity D26)", () => {
    expect(parseStatementCriteria({ min_balance_cents: 5000 }, 'Old run').leaveSettledOff).toBeNull();
    expect(runLeavesSettledOff({ leaveSettledOff: null }, true)).toBe(true);
    expect(runLeavesSettledOff({ leaveSettledOff: false }, true)).toBe(false);
    expect(runLeavesSettledOff({ leaveSettledOff: true }, false)).toBe(true);
    const saved = { ...DEFAULT_STATEMENT_CRITERIA, leaveSettledOff: true };
    expect(parseStatementCriteria(statementCriteriaJson(saved), saved.name)).toEqual(saved);
  });

  it('writes an SMS with the balance, a day-first date and how to pay, and no medical details', () => {
    const payment = { bankName: 'FNB Namibia', accountHolder: 'KW Dental', accountNumber: '62000000000', branchCode: '280172' };
    const text = statementSmsText({ practiceName: 'Klein Windhoek Dental', balanceCents: 123450, asAtKey: '2026-10-07', reference: '1042', payment });
    expect(text).toBe('Klein Windhoek Dental: your account balance on 7 Oct 2026 is N$ 1,234.50. Pay to FNB Namibia, account KW Dental, no. 62000000000, branch 280172, reference 1042.');
    const long = statementSmsText({ practiceName: 'P', balanceCents: 100, asAtKey: '2026-10-07', reference: null, payment: null, message: 'x'.repeat(400) });
    expect(long.length).toBeLessThanOrEqual(306);
  });

  it('writes the SMS in the account\'s statement language', () => {
    const text = statementSmsText({ practiceName: 'Dr P', balanceCents: 50000, asAtKey: '2026-10-07', reference: '77', payment: { bankName: 'Bank Windhoek', accountHolder: null, accountNumber: '8000', branchCode: null }, language: 'af' });
    expect(text).toBe('Dr P: u rekeningsaldo op 7 Okt 2026 is N$ 500.00. Betaal aan Bank Windhoek, nr. 8000, verwysing 77.');
  });

  it('starts the statement N months back with a balance brought forward, or shows the whole history', () => {
    expect(statementFromKey('2026-10-07', 3)).toBe('2026-08-01');
    expect(statementFromKey('2026-10-07', 1)).toBe('2026-10-01');
    expect(statementFromKey('2026-10-07', 0)).toBeNull();
  });
});

describe('family statements', () => {
  const invoices = [
    { id: 'i-mum', invoiceNumber: 'INV-1', dateKey: '2026-09-01', billed: { medical_aid: 0, patient: 30000 }, cancelled: false, patientLabel: 'Maria' },
    { id: 'i-kid', invoiceNumber: 'INV-2', dateKey: '2026-09-02', billed: { medical_aid: 0, patient: 20000 }, cancelled: false, patientLabel: 'Kim' }
  ];
  const kidPaid = receipt({ id: 'r-kid', number: 'RC-000050', patientId: 'kid', amountCents: 20000, receivedOn: '2026-09-10', createdAt: '2026-09-10T10:00:00+02:00', allocatedCents: 20000 });
  const allocations = [{ id: 'a1', receiptId: 'r-kid', invoiceId: 'i-kid', portion: 'patient' as const, amountCents: 20000, createdBy: null, createdAt: '2026-09-10T10:00:00+02:00', reversal: null }];

  it("lists every member's invoices with whose they are, and counts a member's payment as the family's", () => {
    const statement = buildStatement({ patientId: 'mum', memberIds: ['kid'], invoices, receipts: [kidPaid], allocations, adjustments: [] });
    expect(statement.lines.map(line => line.description)).toEqual(['Invoice INV-1 (Maria)', 'Invoice INV-2 (Kim)', 'Receipt RC-000050 (cash)']);
    expect(statement.closing).toEqual({ medicalAid: 0, patient: 30000, credit: 0, total: 30000 });
  });

  it("without the family link the member's payment reads as someone else paying, so the holder can see it was not theirs", () => {
    const statement = buildStatement({ patientId: 'mum', invoices, receipts: [kidPaid], allocations, adjustments: [] });
    expect(statement.lines[2].kind).toBe('payment');
  });
});

describe('debt reminders by age', () => {
  it('gets firmer as the debt ages, as the 30/60/90-day reminder letters do', () => {
    expect([reminderLevel(10), reminderLevel(45), reminderLevel(60), reminderLevel(95), reminderLevel(null)]).toEqual(['gentle', 'gentle', 'overdue', 'final', 'final']);
  });

  it('says how much, how to pay and whom to call, with no medical detail, in the account language', () => {
    const payment = { bankName: 'FNB Namibia', accountHolder: null, accountNumber: '62000000000', branchCode: null };
    expect(reminderSmsText({ practiceName: 'Dr P', owedCents: 45000, oldestAgeDays: 70, reference: '1042', payment, contactPhone: '061 000 000' }))
      .toBe('Dr P: your account balance of N$ 450.00 is overdue. Please pay it now. Pay to FNB Namibia, no. 62000000000, reference 1042. Queries: 061 000 000.');
    expect(reminderSmsText({ practiceName: 'Dr P', owedCents: 45000, oldestAgeDays: 120, reference: null, payment: null, language: 'af' }))
      .toBe('Dr P: u rekeningsaldo van N$ 450.00 is meer as 90 dae agterstallig. Betaal dit asseblief of kontak ons vandag.');
  });
});

// The reminder SMS used the whole account's balance, the medical aid's part included, while the work list showed only
// the patient's: a patient was asked to pay what their fund owes, and the promise limit allowed it too
describe('what a reminder asks the patient for', () => {
  it('is only the patient portion, less money paid that is not allocated yet: the same figure as the work list', () => {
    const report = buildAgingReport([
      invoice({ patientId: 'a', issueDate: '2026-08-01', total: 1000, medicalAidTotal: 800 }), // the fund owes N00, Anna N00
      invoice({ patientId: 'a', issueDate: '2026-09-15', total: 500, medicalAidTotal: 500 }) // all the fund's
    ], TODAY);
    const ctx = context({ creditByPatient: { a: 5000 } }); // Anna paid N0 that is not allocated yet
    const own = patientAccountRow(report, 'a', ctx);
    expect(own).toMatchObject({ owedCents: 20000, unallocatedCents: 5000, netCents: 15000, medicalAidCents: 0 });
    expect(buildAgeAnalysis(report, PATIENT_ACCOUNT_FILTER, ctx).rows.find(row => row.accountId === 'a')?.netCents).toBe(own?.netCents);
    // The whole account (both portions) would have asked for N 450.00
    expect(reminderSmsText({ practiceName: 'Dr P', owedCents: own?.netCents ?? 0, oldestAgeDays: own?.oldestAgeDays ?? null, reference: null, payment: null }))
      .toContain('N$ 150.00');
  });

  it("is nothing when only the medical aid's part is open, so no reminder or promise is offered", () => {
    const report = buildAgingReport([invoice({ patientId: 'b', issueDate: '2026-09-01', total: 400, medicalAidTotal: 400 })], TODAY);
    expect(patientAccountRow(report, 'b', context())).toBeNull();
  });
});
