import { describe, expect, it } from 'vitest';
import { batchesOnHand, expiryState, gainValueCents, issueValueCents, withRunningBalance, type LedgerEntry } from '../ledger';
import { buildRegister, type RegisterEntry } from '../register';
import { varianceReport } from '../stockTake';
import { deliveryTotals, supplierTotalDifference, unitCostOf } from '../deliveries';

describe('stock values at the average cost (the same rule the database uses)', () => {
  const level = { onHand: 30, valueCents: 8_500, unitCostCents: 283 };

  it('values an issue at the average cost of what is on hand', () => {
    // 85.00 for 30: 2 units are worth 5.67
    expect(issueValueCents(level, 2)).toBe(567);
  });

  it('takes all of the value with the last units, so an empty shelf is worth exactly N$ 0.00', () => {
    expect(issueValueCents(level, 30)).toBe(8_500);
  });

  it('values units beyond what is on hand at the recorded cost (the count will correct the shelf)', () => {
    expect(issueValueCents(level, 32)).toBe(8_500 + 2 * 283);
    expect(issueValueCents({ onHand: 0, valueCents: 0, unitCostCents: 250 }, 4)).toBe(1_000);
  });

  it('values units found or put back at the average cost', () => {
    expect(gainValueCents(level, 3)).toBe(850);
  });
});

describe('running balances and batches', () => {
  const entry = (id: string, quantity: number, occurredOn: string, createdAt = `${occurredOn}T08:00:00Z`): LedgerEntry =>
    ({ id, kind: quantity > 0 ? 'received' : 'sold', quantity, valueCents: 0, occurredOn, createdAt });

  it('orders movements by day, then by when they were recorded, so the balance reads like the shelf', () => {
    const rows = withRunningBalance([entry('b', -2, '2026-10-02'), entry('a', 10, '2026-10-01'), entry('c', 5, '2026-10-02', '2026-10-02T07:00:00Z')]);
    expect(rows.map(row => [row.id, row.balance])).toEqual([['a', 10], ['c', 15], ['b', 13]]);
  });

  it('assumes the earliest expiry is used first, so the stock left is the latest batch', () => {
    const left = batchesOnHand([
      { batchNo: 'A', expiryDate: '2026-11-30', quantity: 20 },
      { batchNo: 'B', expiryDate: '2027-06-30', quantity: 20 }
    ], 25);
    expect(left).toEqual([
      { batchNo: 'A', expiryDate: '2026-11-30', quantity: 20, left: 5 },
      { batchNo: 'B', expiryDate: '2027-06-30', quantity: 20, left: 20 }
    ]);
  });

  it('shows no batches when nothing is on hand', () => {
    expect(batchesOnHand([{ batchNo: 'A', expiryDate: '2026-11-30', quantity: 20 }], 0)).toEqual([]);
  });

  it('flags stock expiring within 90 days, a quarter\'s notice to use it or send it back', () => {
    expect(expiryState('2026-10-07', '2026-10-08')).toBe('expired');
    expect(expiryState('2026-12-31', '2026-10-08')).toBe('soon');
    expect(expiryState('2027-06-30', '2026-10-08')).toBe('ok');
    expect(expiryState(null, '2026-10-08')).toBeNull();
  });
});

describe('scheduled-medicine register', () => {
  const row = (id: string, quantity: number, occurredOn: string): RegisterEntry => ({
    id, kind: quantity > 0 ? 'received' : 'dispensed', quantity, valueCents: 0, occurredOn, createdAt: `${occurredOn}T09:00:00Z`,
    documentRef: id, party: null, by: null, note: null
  });

  it('opens with what was on hand before the period and closes on the ledger\'s figure', () => {
    const register = buildRegister([row('GRV1', 100, '2026-09-01'), row('RX1', -10, '2026-09-20'), row('RX2', -5, '2026-10-02'), row('GRV2', 50, '2026-10-05')],
      '2026-10-01', '2026-10-31');
    expect(register.opening).toBe(90);
    expect(register.rows.map(r => [r.documentRef, r.received, r.issued, r.balance])).toEqual([['RX2', 0, 5, 85], ['GRV2', 50, 0, 135]]);
    expect(register.closing).toBe(135);
  });
});

describe('stock take variance', () => {
  it('values a shortage at the average cost and lists losses first', () => {
    const report = varianceReport([
      { itemId: 'a', name: 'Gloves', unit: 'box', expected: 10, counted: 10, level: { onHand: 10, valueCents: 10_000, unitCostCents: 1_000 } },
      { itemId: 'b', name: 'Capsules', unit: 'capsule', expected: 16, counted: 14, level: { onHand: 16, valueCents: 4_534, unitCostCents: 283 } },
      { itemId: 'c', name: 'Syringes', unit: 'each', expected: 5, counted: 7, level: { onHand: 5, valueCents: 500, unitCostCents: 100 } }
    ]);
    expect(report.rows.map(r => [r.itemId, r.difference, r.valueCents])).toEqual([['b', -2, -567], ['c', 2, 200], ['a', 0, 0]]);
    expect(report.changed).toBe(2);
    expect(report.unitsShort).toBe(2);
    expect(report.unitsOver).toBe(2);
    expect(report.valueCents).toBe(-367);
  });
});

describe('delivery totals: as the supplier invoice shows them', () => {
  it('works out VAT once per rate on the total, as the supplier invoice does (not rounded line by line)', () => {
    // Three lines of N$ 0.10 at 15%: on the total 0.30 x 15% = 0.045 -> 0.05; line by line it would be 3 x 0.02 = 0.06
    const totals = deliveryTotals([
      { quantity: 1, lineCostCents: 10, vatRate: 15 },
      { quantity: 1, lineCostCents: 10, vatRate: 15 },
      { quantity: 1, lineCostCents: 10, vatRate: 15 },
      { quantity: 1, lineCostCents: 10_000, vatRate: 0 }
    ]);
    expect(totals).toEqual({ exclVatCents: 10_030, vatCents: 5, inclVatCents: 10_035 });
  });

  it('says by how much the lines differ from the supplier invoice, so a typing slip is found before saving', () => {
    const totals = deliveryTotals([{ quantity: 20, lineCostCents: 6_000, vatRate: 15 }]);
    expect(supplierTotalDifference(totals, 6_900)).toBe(0);
    expect(supplierTotalDifference(totals, 7_000)).toBe(100);
    expect(supplierTotalDifference(totals, null)).toBeNull();
  });

  it('shows the cost per unit of a line to the cent', () => {
    expect(unitCostOf({ quantity: 30, lineCostCents: 1_300 })).toBe(43);
    expect(unitCostOf({ quantity: 0, lineCostCents: 1_300 })).toBeNull();
  });
});
