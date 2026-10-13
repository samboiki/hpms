/** Finance > Reports > Claims dashboard (parity G10) and one claim line's story (F10). Invented ids and amounts only. */
import { describe, expect, it } from 'vitest';
import {
  fundTable,
  monthFundRows,
  monthTable,
  reasonTable,
  rejectionsByReason,
  totalOf,
  totalsByFund,
  totalsByMonth,
  type RawMonthFundRow
} from '../claimsDashboard';
import { storyEntries, storyHeadline, type RawStoryEvent } from '../claimLineStory';

const raw = (overrides: Partial<RawMonthFundRow>): RawMonthFundRow => ({
  month: '2026-09-01', fund_reference: 'MAG1', batch_ids: ['b1'], lines: 10, claimed: '1000.00', paid: '800.00', paid_lines: 7,
  part_paid_lines: 1, rejected_lines: 1, waiting_lines: 0, unanswered_lines: 1, resent_lines: 0, days_to_pay_total: 240, days_to_pay_lines: 8,
  ...overrides
});

describe('claims dashboard (G10)', () => {
  const rows = monthFundRows([
    raw({}),
    // The same fund under its other name: one fund on the dashboard
    raw({ fund_reference: 'PSEMAS', batch_ids: ['b2'], lines: 2, claimed: '200.00', paid: '0', paid_lines: 0, part_paid_lines: 0, rejected_lines: 2, unanswered_lines: 0, days_to_pay_total: 0, days_to_pay_lines: 0 }),
    raw({ month: '2026-10-01', fund_reference: 'NHPM', batch_ids: ['b3'], lines: 5, claimed: '500.00', paid: '500.00', paid_lines: 5, part_paid_lines: 0, rejected_lines: 0, unanswered_lines: 0, resent_lines: 1, days_to_pay_total: 50, days_to_pay_lines: 5 }),
    raw({ month: null })
  ]);

  it('merges a fund\'s aliases, so PSEMAS is not claimed twice under MAG1 and PSEMAS', () => {
    expect(rows.map(row => [row.month, row.fundCode, row.lines])).toEqual([['2026-09', 'MAG1', 12], ['2026-10', 'NHPM', 5]]);
    expect(rows[0].batchIds).toEqual(['b1', 'b2']);
  });

  it('compares claimed with paid per month, and the months add up to the whole period', () => {
    const months = totalsByMonth(rows);
    expect(months.map(month => [month.key, month.claimedCents, month.paidCents, month.paidShare])).toEqual([
      ['2026-09', 120000, 80000, 80000 / 120000],
      ['2026-10', 50000, 50000, 1]
    ]);
    expect(months.reduce((sum, month) => sum + month.claimedCents, 0)).toBe(totalOf(rows).claimedCents);
    expect(monthTable(months, 'Sep-Oct 2026').table.totals?.[2]).toBe(1700);
  });

  it('averages the days to pay over the lines a fund paid, not over lines it never answered', () => {
    const funds = totalsByFund(rows);
    expect(funds.find(fund => fund.key === 'MAG1')?.averageDaysToPay).toBe(30);
    expect(funds.find(fund => fund.key === 'NHPM')?.averageDaysToPay).toBe(10);
    expect(fundTable(funds, 'Sep-Oct 2026').table.rows[0][0]).toBe('PSEMAS'); // the fund named as staff know it
  });

  it('opens the batches behind a month or a fund', () => {
    expect(monthTable(totalsByMonth(rows), 'x').targets[0]).toEqual({ kind: 'batches', ids: ['b1', 'b2'], label: 'September 2026' });
  });

  it('groups refusals by reason with what is at stake, most money first, each opening its claim lines', () => {
    const reasons = rejectionsByReason([
      { id: 'r1', claimLineId: 'c1', category: 'fixable', plainReason: 'Membership number not valid', atStakeCents: 5000, open: true },
      { id: 'r2', claimLineId: 'c2', category: 'fixable', plainReason: 'Membership number not valid', atStakeCents: 7000, open: false },
      { id: 'r3', claimLineId: 'c3', category: 'patient_liable', plainReason: 'Benefit exhausted', atStakeCents: 20000, open: true }
    ]);
    expect(reasons.map(reason => [reason.reason, reason.lines, reason.atStakeCents, reason.open])).toEqual([
      ['Benefit exhausted', 1, 20000, 1],
      ['Membership number not valid', 2, 12000, 1]
    ]);
    expect(reasonTable(reasons, 'x').targets[1]).toEqual({ kind: 'claim_lines', ids: ['c1', 'c2'], label: 'Membership number not valid' });
  });
});

const event = (overrides: Partial<RawStoryEvent>): RawStoryEvent => ({
  kind: 'claimed', occurred_at: '2026-09-02T08:00:00+00:00', on_date: '2026-09-02', claim_line_id: 'c1', batch_id: 'b1', batch_number: 7,
  document_id: null, receipt_id: null, rejection_id: null, invoice_id: 'i1', actor: null, amount: '350.00', details: {}, ...overrides
});

describe('one claim line\'s story (F10)', () => {
  const entries = storyEntries([
    event({ kind: 'answer', occurred_at: '2026-09-20T09:00:00+00:00', amount: '0', details: { status: 'rejected', fund: 'MAG1', reason_codes: ['202'], reason_texts: ['Member not on file'] } }),
    event({ details: { sent: true, fund: 'MAG1', line_number: 3, tariff_code: '0190', file_name: 'claims-7.txt' } }),
    event({ kind: 'rejection_step', occurred_at: '2026-09-21T10:00:00+00:00', actor: 'u1', details: { action: 'resubmitted', note: 'Dependant code corrected' } }),
    event({ kind: 'correction', occurred_at: '2026-09-21T10:00:01+00:00', actor: 'u1', details: { id: 9, action: 'claim_resent', line_code: '0190', line_before: { batch_number: 7 }, line_after: { batch_number: 9 } } }),
    event({ occurred_at: '2026-09-22T08:00:00+00:00', claim_line_id: 'c2', batch_id: 'b9', batch_number: 9, details: { sent: true, fund: 'MAG1', flag: 'R' } }),
    event({ kind: 'payment', occurred_at: '2026-10-15T08:00:00+00:00', on_date: '2026-10-14', receipt_id: 'r5', actor: 'u2', amount: '350.00', details: { portion: 'medical_aid', receipt_number: 'RC-5', method: 'medical_aid' } }),
    event({ kind: 'something_new' })
  ], { u1: 'Staff One', u2: 'Staff Two' });

  it('tells the story in the order it happened, from the claim to the payment', () => {
    expect(entries.map(entry => entry.kind)).toEqual(['claimed', 'answer', 'rejection_step', 'correction', 'claimed', 'payment']);
  });

  it('says in plain words what the fund answered and why, naming the fund as staff know it', () => {
    expect(entries[0].title).toBe('Claimed from PSEMAS in batch 7');
    expect(entries[1]).toMatchObject({ title: 'PSEMAS did not pay', tone: 'red' });
    expect(entries[1].detail).toContain('Fund code 202: Member not on file');
  });

  it('words a resend as the invoice history does, and marks the second claim as sent again', () => {
    expect(entries[3].detail).toContain('sent again in batch 9');
    expect(entries[4].title).toBe('Claimed again (resubmission R) from PSEMAS in batch 9');
  });

  it('names who acted and links the payment to its receipt, ending on where the claim stands now', () => {
    expect(entries[2]).toMatchObject({ title: 'Sent again to the fund', by: 'Staff One', detail: 'Dependant code corrected' });
    expect(entries[5]).toMatchObject({ receiptId: 'r5', title: 'Medical aid portion paid: N$ 350.00 from payment RC-5' });
    // The payment counts on the day the money was received, not the day it was allocated
    expect(storyHeadline(entries)).toBe('Latest: Medical aid portion paid: N$ 350.00 from payment RC-5 (14 Oct 2026).');
  });
});
