/** Medical aid debtors per fund: what each fund owes and where each claim stands */
import { describe, it, expect } from 'vitest';
import { buildAgingReport, normalizeInvoice, type LedgerInvoice, type RawInvoiceRow } from '../../../services/ledgerService';
import { debtorsByFund, normalizeClaimBatch, type ClaimBatchState, type FundDebtorsInput } from '../fundDebtors';

const TODAY = '2026-10-06';

const inv = (row: Partial<RawInvoiceRow> & { id: string }): LedgerInvoice => normalizeInvoice({
  total: 1000,
  medical_aid_total: 800,
  payment_status: 'pending',
  issue_date: '2026-09-20',
  due_date: '2026-10-20',
  patient_id: 'nhp-patient',
  ...row
});

const SCHEMES: Record<string, string> = { 'nhp-patient': 'Namibia Health Plan', 'nmc-patient': 'NMC', 'nammed-patient': 'Nammed' };

const batch = (id: string, status: string | null, sentAt: string | null = null, fundReference: string | null = null): ClaimBatchState =>
  ({ id, status, sentAt, fundReference });

const debtors = (invoices: LedgerInvoice[], overrides: Partial<FundDebtorsInput> = {}) => debtorsByFund({
  aging: buildAgingReport(invoices, TODAY),
  schemeByPatient: SCHEMES,
  batches: [],
  serviceDateByVisit: {},
  todayKey: TODAY,
  ...overrides
});

describe('debtors by medical aid fund', () => {
  it('counts only the medical aid portion of unpaid invoices, so the funds add up to what medical aids owe in the aging report', () => {
    const invoices = [
      inv({ id: 'owed', total: 1000, medical_aid_total: 800 }), // the patient's N$200 is not the fund's debt
      inv({ id: 'self-pay', total: 500, medical_aid_total: 0, patient_id: 'nammed-patient' }),
      inv({ id: 'paid', total: 900, medical_aid_total: 900, payment_status: 'paid' }),
      inv({ id: 'void', total: 700, medical_aid_total: 700, payment_status: 'cancelled' }),
      inv({ id: 'over-claimed', total: 300, medical_aid_total: 450, patient_id: 'nmc-patient' }) // a fund never owes more than the invoice
    ];
    const result = debtors(invoices);
    expect(result.rows.map(row => [row.fund, row.invoiceCount, row.total])).toEqual([['Namibia Health Plan', 1, 800], ['NMC', 1, 300]]);
    expect(result.totals.total).toBe(buildAgingReport(invoices, TODAY).medicalAid);
  });

  it('splits each fund by where the claim stands: not in a batch, in a batch not sent yet, or sent to the fund', () => {
    const result = debtors(
      [
        inv({ id: 'loose', total: 100, medical_aid_total: 100 }),
        inv({ id: 'waiting', total: 200, medical_aid_total: 200, batch_id: 'b-open' }),
        inv({ id: 'claimed', total: 300, medical_aid_total: 300, batch_id: 'b-sent' }),
        // the fund paid the batch but nobody marked the invoice paid: still owed, and the claim is with the fund
        inv({ id: 'remitted', total: 400, medical_aid_total: 400, batch_id: 'b-paid' })
      ],
      { batches: [batch('b-open', 'active'), batch('b-sent', 'sent', '2026-09-25T08:00:00Z'), batch('b-paid', 'paid', '2026-09-01T08:00:00Z')] }
    );
    expect(result.rows[0]).toEqual({
      fund: 'Namibia Health Plan', deadline: '4 months', invoiceCount: 4, notBatched: 100, inUnsentBatch: 200, pastDeadline: 0, sent: 700, total: 1000
    });
  });

  it('flags an unsent claim past the fund deadline, counted from the visit date (else the invoice date), as the claims screen does', () => {
    // NHP allows 4 months: a 1 May visit had to be claimed by 1 Sep
    const late = inv({ id: 'late', visit_id: 'v-may', issue_date: '2026-07-01' });
    expect(debtors([late], { serviceDateByVisit: { 'v-may': '2026-05-01' } }).rows[0]).toMatchObject({ pastDeadline: 800, notBatched: 0 });
    // without the visit date the 1 Jul invoice date is used, which is still in time
    expect(debtors([late]).rows[0]).toMatchObject({ pastDeadline: 0, notBatched: 800 });
  });

  it('counts a claim in an unsent batch as past the deadline too: the batch was never submitted', () => {
    const result = debtors([inv({ id: 'stuck', visit_id: 'v-feb', batch_id: 'b-open' })], {
      batches: [batch('b-open', 'ready')],
      serviceDateByVisit: { 'v-feb': '2026-02-10' }
    });
    expect(result.rows[0]).toMatchObject({ pastDeadline: 800, inUnsentBatch: 0 });
  });

  it('never marks a claim already sent to the fund as past the deadline', () => {
    const result = debtors([inv({ id: 'old-claim', visit_id: 'v-jan', batch_id: 'b-sent' })], {
      batches: [batch('b-sent', 'sent', '2026-02-01T08:00:00Z')],
      serviceDateByVisit: { 'v-jan': '2026-01-10' }
    });
    expect(result.rows[0]).toMatchObject({ sent: 800, pastDeadline: 0 });
  });

  it('only judges deadlines that are configured for the fund, and says so', () => {
    const result = debtors([
      inv({ id: 'nammed', patient_id: 'nammed-patient', issue_date: '2025-01-15', due_date: '2025-02-15' }),
      inv({ id: 'unknown', patient_id: 'no-medical-aid-record', issue_date: '2025-01-15', due_date: '2025-02-15' })
    ]);
    expect(result.rows).toEqual([
      expect.objectContaining({ fund: 'Nammed', notBatched: 800, pastDeadline: 0, deadline: null }),
      expect.objectContaining({ fund: 'Scheme not recorded', notBatched: 800, pastDeadline: 0, deadline: null })
    ]);
  });

  it('finds the deadline from the batch fund reference when the patient\'s medical aid name is not recognised', () => {
    // NMC allows 120 days: a 1 Mar invoice had to be claimed by 29 Jun
    const result = debtors([inv({ id: 'x', patient_id: 'no-medical-aid-record', batch_id: 'b-nmc', issue_date: '2026-03-01' })], {
      batches: [batch('b-nmc', 'active', null, 'NMC1')]
    });
    expect(result.rows[0]).toMatchObject({ fund: 'Scheme not recorded', pastDeadline: 800, deadline: '120 days' });
  });

  it('warns about unsent claims that reach their deadline within 14 days, and still counts them as not sent', () => {
    // NMC: a 15 Jun visit must be claimed by 13 Oct, 7 days after today
    const result = debtors([inv({ id: 'soon', patient_id: 'nmc-patient', visit_id: 'v-jun' })], { serviceDateByVisit: { 'v-jun': '2026-06-15' } });
    expect(result.expiringSoon).toEqual({ count: 1, amount: 800 });
    expect(result.rows[0]).toMatchObject({ notBatched: 800, pastDeadline: 0 });
  });

  it('shows an invoice whose batch cannot be read as sent, and counts it so the report can say so', () => {
    const result = debtors([inv({ id: 'ghost', batch_id: 'hidden-batch' })]);
    expect(result.rows[0]).toMatchObject({ sent: 800, notBatched: 0 });
    expect(result.unreadableBatches).toEqual({ count: 1, amount: 800 });
  });

  it('adds up in cents and every row\'s claim states add up to what the fund owes', () => {
    const result = debtors(
      [
        inv({ id: 'a', total: 0.1, medical_aid_total: 0.1 }),
        inv({ id: 'b', total: 0.2, medical_aid_total: 0.2, batch_id: 'b-sent' }),
        inv({ id: 'c', total: 1000.05, medical_aid_total: 1000.05, visit_id: 'v-old' })
      ],
      { batches: [batch('b-sent', 'sent', '2026-10-01T08:00:00Z')], serviceDateByVisit: { 'v-old': '2026-01-01' } }
    );
    const [row] = result.rows;
    expect(row).toMatchObject({ notBatched: 0.1, sent: 0.2, pastDeadline: 1000.05, total: 1000.35 });
    expect(row.notBatched + row.inUnsentBatch + row.pastDeadline + row.sent).toBeCloseTo(row.total, 10);
  });

  // The statement of outstanding claims names each batch by the number the fund knows it by
  it('reads the batch status, fund reference and number from batch_headers rows', () => {
    expect(normalizeClaimBatch({ id: 'b1', status: 'sent', sent_at: '2026-09-02T08:00:00Z', medical_aid_reference: ' NHPM ', batch_number: 12 }))
      .toEqual({ id: 'b1', status: 'sent', sentAt: '2026-09-02T08:00:00Z', fundReference: 'NHPM', batchNumber: 12 });
    expect(normalizeClaimBatch({ id: 'b2' })).toEqual({ id: 'b2', status: null, sentAt: null, fundReference: null, batchNumber: null });
  });
});
