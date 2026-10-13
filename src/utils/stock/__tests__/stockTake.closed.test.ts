import { describe, expect, it } from 'vitest';
import { closedCountReport, varianceReport } from '../stockTake';
import { normalizeCount } from '../stockRows';
import { varianceTable } from '../../../components/stock/stockDocuments';

// Invented items. A posted count changed the stock value by its "counted" movements; reading it back later must show
// those values, not today's average cost (prices move), or the printed variance report would not match the books.
const lines = [
  { itemId: 'gloves', name: 'Gloves', unit: 'box', expected: 10, counted: 8 },
  { itemId: 'swabs', name: 'Swabs', unit: 'pack', expected: 5, counted: 6 },
  { itemId: 'tape', name: 'Tape', unit: 'roll', expected: 3, counted: 3 }
];

describe('a posted stock count read back as it was', () => {
  it('values each difference as the count posted it, from its own movements (not at today\'s cost)', () => {
    const report = closedCountReport(lines, [
      { itemId: 'gloves', kind: 'counted', valueCents: -2400 },
      { itemId: 'swabs', kind: 'counted', valueCents: 350 },
      // Another kind on the same item is not the count's doing
      { itemId: 'gloves', kind: 'sold', valueCents: -1200 }
    ]);
    expect(report.rows.map(row => [row.name, row.difference, row.valueCents])).toEqual([['Gloves', -2, -2400], ['Swabs', 1, 350], ['Tape', 0, 0]]);
    expect(report).toMatchObject({ counted: 3, changed: 2, unitsShort: 2, unitsOver: 1, valueCents: -2050 });
  });

  it('shows a cancelled count\'s differences worth nothing: it changed nothing on the shelf', () => {
    const report = closedCountReport(lines, []);
    expect(report.rows.map(row => row.valueCents)).toEqual([0, 0, 0]);
    expect(report.changed).toBe(2);
  });

  it('orders and totals lines exactly like the report shown while counting (biggest losses first, matches last)', () => {
    const level = { onHand: 10, valueCents: 12000, unitCostCents: 1200 };
    const counting = varianceReport(lines.map(line => ({ ...line, level })));
    const posted = closedCountReport(lines, counting.rows.map(row => ({ itemId: row.itemId, kind: 'counted', valueCents: row.valueCents })));
    expect(posted.rows.map(row => row.itemId)).toEqual(counting.rows.map(row => row.itemId));
    expect([posted.counted, posted.changed, posted.unitsShort, posted.unitsOver, posted.valueCents])
      .toEqual([counting.counted, counting.changed, counting.unitsShort, counting.unitsOver, counting.valueCents]);
  });

  it('prints the variance report saying the values are as posted', () => {
    const table = varianceTable('Variance report CNT2026-0001', closedCountReport(lines, []), true);
    expect(table.notes?.join(' ')).toContain('Values as the count was posted.');
    expect(varianceTable('Variance report', varianceReport([]), false).notes?.join(' ')).toContain('Values at the average cost.');
  });
});

describe('who counted and who posted', () => {
  it('keeps who started the count and who posted (or cancelled) it, so the count can say so later', () => {
    const count = normalizeCount({
      id: 'k1', number: 'CNT2026-0001', status: 'posted', started_at: '2026-10-01T07:00:00Z', started_by: 'u-start',
      closed_at: '2026-10-01T15:30:00Z', closed_by: 'u-post', value_change: '-20.50'
    });
    expect(count).toMatchObject({ startedBy: 'u-start', closedBy: 'u-post', closedAt: '2026-10-01T15:30:00Z', valueChangeCents: -2050 });
  });
});
