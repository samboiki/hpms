/**
 * The statement of outstanding claims per fund (parity F22). A practice gives it to a fund to chase what the fund has
 * not paid: a line the fund already paid, or the practice credited or wrote off, would be a false claim; a missing
 * line is money never chased; and a total that differs from the Overview's "Claims sent, awaiting payment" would leave
 * staff unsure which figure is right. Invented values only.
 */
import { describe, expect, it } from 'vitest';
import { buildAgingReport, normalizeInvoice, toCents, type ArInvoiceBalance, type LedgerInvoice, type RawInvoiceRow } from '../../../../services/ledgerService';
import { debtorsByFund, type ClaimBatchState } from '../../fundDebtors';
import { batchHeading, buildFundStatements, fundStatementCsv, fundStatementHtml, type FundStatementInput } from '../fundStatement';

const TODAY = '2026-10-13';

const inv = (row: Partial<RawInvoiceRow> & { id: string }): LedgerInvoice => normalizeInvoice({
  invoice_number: `INV-${row.id}`,
  total: 1000,
  medical_aid_total: 1000,
  payment_status: 'pending',
  issue_date: '2026-09-01',
  due_date: '2026-10-01',
  patient_id: 'p-nmc',
  ...row
});

const SCHEMES: Record<string, string> = { 'p-nmc': 'Test Medical Fund', 'p-mag': 'Test Government Fund', 'p-other': 'Test Medical Fund' };
const NAMES: Record<string, string> = { 'p-nmc': 'Anna Testperson', 'p-mag': 'Ben Example', 'p-other': 'Carl Sample' };

const sentBatch = (id: string, batchNumber: number, sentAt: string, fundReference = 'NMC1'): ClaimBatchState =>
  ({ id, status: 'sent', sentAt, fundReference, batchNumber });

const input = (invoices: LedgerInvoice[], overrides: Partial<FundStatementInput> = {}, balances?: Record<string, ArInvoiceBalance>): FundStatementInput => ({
  aging: buildAgingReport(invoices, TODAY, balances),
  schemeByPatient: SCHEMES,
  batches: [
    sentBatch('b-old', 7, '2026-08-20T08:00:00Z'),
    sentBatch('b-new', 9, '2026-09-30T08:00:00Z'),
    sentBatch('b-mag', 3, '2026-09-15T08:00:00Z', 'MAG1'),
    { id: 'b-open', status: 'active', sentAt: null, fundReference: 'NMC1', batchNumber: 10 }
  ],
  serviceDateByVisit: {},
  todayKey: TODAY,
  patientNames: NAMES,
  ...overrides
});

/** What the ledger says is still owed on an invoice once payments, credit notes or write-offs were posted to it */
const owed = (medicalAidCents: number): ArInvoiceBalance => ({ outstanding: { medical_aid: medicalAidCents, patient: 0 }, hasEntries: true } as unknown as ArInvoiceBalance);

describe('statement of outstanding claims per fund', () => {
  it('lists only claims sent to the fund that it still owes on: not paid, credited, written off, unsent or never claimed', () => {
    const invoices = [
      inv({ id: 'sent', batch_id: 'b-old' }),
      inv({ id: 'paid', batch_id: 'b-old', payment_status: 'paid' }),
      inv({ id: 'written-off', batch_id: 'b-old' }),
      inv({ id: 'part-credited', batch_id: 'b-new', total: 800, medical_aid_total: 800 }),
      inv({ id: 'waiting', batch_id: 'b-open' }),
      inv({ id: 'not-batched' }),
      inv({ id: 'cash', medical_aid_total: 0, batch_id: 'b-old' })
    ];
    const statements = buildFundStatements(input(invoices, {}, { 'written-off': owed(0), 'part-credited': owed(30000) }));
    const lines = statements.funds.flatMap(fund => fund.batches.flatMap(batch => batch.lines));
    expect(lines.map(line => [line.invoiceNumber, line.owedCents])).toEqual([['INV-sent', 100000], ['INV-part-credited', 30000]]);
  });

  it('agrees with the Overview\'s "Claims sent, awaiting payment" and with each fund\'s "Sent to fund" in Reports', () => {
    const invoices = [
      inv({ id: 'a', batch_id: 'b-old', total: 0.1, medical_aid_total: 0.1 }),
      inv({ id: 'b', batch_id: 'b-new', total: 1000.05, medical_aid_total: 1000.05, patient_id: 'p-other' }),
      inv({ id: 'c', batch_id: 'b-mag', total: 250, medical_aid_total: 200, patient_id: 'p-mag' }),
      inv({ id: 'd', batch_id: 'b-open' }),
      inv({ id: 'e', batch_id: 'b-gone' })
    ];
    const source = input(invoices);
    const statements = buildFundStatements(source);
    const debtors = debtorsByFund(source);
    expect(statements.totalCents).toBe(toCents(debtors.totals.sent));
    for (const row of debtors.rows) {
      expect(statements.funds.find(fund => fund.fund === row.fund)?.owedCents ?? 0).toBe(toCents(row.sent));
    }
    expect(statements.funds.map(fund => fund.fund)).toEqual(['Test Medical Fund', 'Test Government Fund']);
  });

  it('groups a fund\'s claims by batch, oldest sent first, each named by its number, fund code and how long ago it went', () => {
    const statements = buildFundStatements(input([
      inv({ id: 'new', batch_id: 'b-new' }),
      inv({ id: 'old-2', batch_id: 'b-old', patient_id: 'p-other' }),
      inv({ id: 'old-1', batch_id: 'b-old' })
    ]));
    const [fund] = statements.funds;
    expect(fund.batches.map(batchHeading)).toEqual(['Batch 7 (NMC1), sent 20 Aug 2026, 54 days ago', 'Batch 9 (NMC1), sent 30 Sep 2026, 13 days ago']);
    // Within a batch the patients are in name order, so the fund finds each one quickly
    expect(fund.batches[0].lines.map(line => line.patientName)).toEqual(['Anna Testperson', 'Carl Sample']);
    expect(fund.batches[0].owedCents).toBe(200000);
    expect(fund.fundCodes).toEqual(['NMC1']);
    expect(fund.claimCount).toBe(3);
  });

  // The Overview counts such a claim as sent, so the statement must list it too, or the totals would differ
  it('keeps a claim whose batch could not be read, under a heading that says so', () => {
    const [fund] = buildFundStatements(input([inv({ id: 'ghost', batch_id: 'b-gone' })])).funds;
    expect(fund.batches.map(batchHeading)).toEqual(['A batch that could not be read']);
    expect(fund.owedCents).toBe(100000);
  });

  it('ages each claim in days since the invoice date and totals the fund per age band, as statements do', () => {
    const [fund] = buildFundStatements(input([
      inv({ id: 'recent', batch_id: 'b-new', issue_date: '2026-10-01' }),
      inv({ id: 'older', batch_id: 'b-old', issue_date: '2026-08-10', total: 500, medical_aid_total: 500 }),
      inv({ id: 'oldest', batch_id: 'b-old', issue_date: '2026-03-01', total: 200, medical_aid_total: 200 })
    ])).funds;
    expect(fund.byAgeBand).toMatchObject({ current: 100000, days_60: 50000, days_180_plus: 20000 });
    expect(fund.oldestAgeDays).toBe(226);
    // The visit's date is the date of service; the invoice date stands in when the visit could not be read
    const withVisit = buildFundStatements(input([inv({ id: 'v', batch_id: 'b-old', visit_id: 'visit-1' })], { serviceDateByVisit: { 'visit-1': '2026-08-28' } }));
    expect(withVisit.funds[0].batches[0].lines[0].serviceDate).toBe('2026-08-28');
  });

  it('downloads every line with its batch and the total, and text never runs as a spreadsheet formula', () => {
    const [fund] = buildFundStatements(input([inv({ id: 'x', batch_id: 'b-old', patient_id: 'p-formula' })], { patientNames: { 'p-formula': '=HYPERLINK("x")' }, schemeByPatient: { 'p-formula': 'Test Medical Fund' } })).funds;
    const csv = fundStatementCsv(fund).split('\r\n');
    expect(csv[0]).toBe('Fund,Batch,Fund code,Date sent,Days since sent,Patient,Invoice,Date of service,Age (days),Age,Owed by the fund');
    expect(csv[1]).toBe('Test Medical Fund,7,NMC1,2026-08-20,54,"\'=HYPERLINK(""x"")",INV-x,2026-09-01,42,30 days,1000.00');
    expect(csv[2]).toBe('Total,,,,,1 claim(s),,,,,1000.00');
  });

  it('prints the practice, the fund, the age bands and every line, with names escaped', () => {
    const [fund] = buildFundStatements(input([inv({ id: 'y', batch_id: 'b-old', patient_id: 'p-tag' })], { patientNames: { 'p-tag': '<b>Dee</b> Test' }, schemeByPatient: { 'p-tag': 'Test Medical Fund' } })).funds;
    const html = fundStatementHtml(fund, TODAY, { practiceName: 'Test Practice', practiceNumber: '0123456' });
    expect(html).toContain('Test Practice (practice number 0123456)');
    expect(html).toContain('Test Medical Fund (NMC1)');
    expect(html).toContain('As at</td><td>13 Oct 2026');
    expect(html).toContain('&lt;b&gt;Dee&lt;/b&gt; Test');
    expect(html).not.toContain('<b>Dee</b>');
    expect(html).toContain('Batch 7 (NMC1), sent 20 Aug 2026, 54 days ago');
  });
});
