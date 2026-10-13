/**
 * Cash-up per cashier (owner decision, 13 Oct 2026; parity H11): each receptionist cashes up their own takings with
 * their own float, and the administrator sees every cashier before signing the day off. Invented figures and ids.
 */
import { describe, expect, it } from 'vitest';
import type { CashierLine } from '../ledger/cashUp';
import {
  cashierDay,
  cashierExpected,
  cashiersStillToCount,
  changedSinceCount,
  checkCashierCount,
  handOverCents,
  normalizeCashierCashUp,
  standingCashierCounts,
  type CashierCashUp
} from '../ledger/cashierCashUp';

const line = (userId: string, overrides: Partial<CashierLine> = {}): CashierLine => ({
  userId,
  byMethod: { cash: 50000, card: 30000, eft: 20000, debit_order: 0, medical_aid: 0, other: 0, not_recorded: 0 },
  receivedCents: 100000,
  receiptCount: 4,
  refundCents: 5000,
  cashRefundCents: 5000,
  reversedCount: 0,
  reversedCents: 0,
  expectedCashCents: 45000,
  netCents: 95000,
  ...overrides
});

const count = (cashierId: string, overrides: Partial<CashierCashUp> = {}): CashierCashUp => ({
  id: `c-${cashierId}`,
  dateKey: '2026-10-13',
  cashierId,
  floatInCents: 50000,
  floatOutCents: 50000,
  expected: { cash: 95000, card: 30000, eft: 20000 },
  counted: { cash: 95000, card: 30000, eft: 20000 },
  notes: null,
  countedAt: '2026-10-13T17:00:00+02:00',
  supersededAt: null,
  ...overrides
});

describe("what a cashier's till should hold", () => {
  it('is their float plus their own cash taken less their cash refunds, because each cashier has their own float', () => {
    expect(cashierExpected(line('rec-1'), 50000)).toEqual({ cash: 95000, card: 30000, eft: 20000 });
    // A cashier who took nothing still counts their float back
    expect(cashierExpected(null, 50000)).toEqual({ cash: 50000, card: 0, eft: 0 });
  });

  it('hands over the cash counted less the float kept for tomorrow', () => {
    expect(handOverCents(95000, 50000)).toBe(45000);
  });
});

describe('checking a count before it is saved', () => {
  const draft = { floatInCents: 50000, counted: { cash: 95000, card: 30000, eft: 20000 }, floatOutCents: 50000, notes: '' };

  it('accepts a till that balances without a note', () => {
    expect(checkCashierCount(draft, line('rec-1')).ok).toBe(true);
  });

  it('needs a reason when anything is over or short, because an unexplained difference is what an auditor asks about', () => {
    const short = { ...draft, counted: { ...draft.counted, card: 29000 } };
    expect(checkCashierCount(short, line('rec-1')).error).toBe('Card machine slips is short by N$ 10.00. Say why in the note.');
    expect(checkCashierCount({ ...short, notes: 'Slip lost, machine total checked' }, line('rec-1')).ok).toBe(true);
  });

  it('refuses a float kept back that is more than the cash counted, and missing amounts', () => {
    expect(checkCashierCount({ ...draft, floatOutCents: 100000 }, line('rec-1')).ok).toBe(false);
    expect(checkCashierCount({ ...draft, floatInCents: null }, line('rec-1')).error).toMatch(/float you started with/);
    expect(checkCashierCount({ ...draft, counted: { ...draft.counted, eft: null } }, line('rec-1')).error).toMatch(/EFTs you confirmed/);
  });
});

describe("the administrator's view of the day", () => {
  it('lists every cashier who took money, and names those still to cash up before the day is signed off', () => {
    const rows = cashierDay([line('rec-1'), line('rec-2')], [count('rec-1')]);
    expect(rows.map(row => [row.cashierId, !!row.count, row.differenceCents])).toEqual([['rec-2', false, null], ['rec-1', true, 0]]);
    expect(cashiersStillToCount(rows).map(row => row.cashierId)).toEqual(['rec-2']);
  });

  it('keeps only the latest count of a cashier that was not replaced', () => {
    const older = count('rec-1', { id: 'old', countedAt: '2026-10-13T16:00:00+02:00', supersededAt: '2026-10-13T17:00:00+02:00' });
    const newer = count('rec-1', { id: 'new' });
    expect(standingCashierCounts([older, newer]).get('rec-1')?.id).toBe('new');
  });

  it('flags a count whose receipts changed afterwards (a payment captured later for that day)', () => {
    const [row] = cashierDay([line('rec-1', { byMethod: { ...line('rec-1').byMethod, card: 35000 } })], [count('rec-1')]);
    expect(changedSinceCount(row)).toBe(true);
  });

  it('reads saved rows in cents', () => {
    expect(normalizeCashierCashUp({ id: 'x', business_date: '2026-10-13', cashier_id: 'rec-1', float_in: '500.00', counted_cash: 950, expected_cash: '950.00' }))
      .toMatchObject({ floatInCents: 50000, counted: { cash: 95000 }, expected: { cash: 95000 } });
    expect(normalizeCashierCashUp({ id: 'x', business_date: null, cashier_id: 'rec-1' })).toBeNull();
  });
});
