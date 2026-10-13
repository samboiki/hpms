import { describe, expect, it } from 'vitest';
import { lineAmounts, onConsignment, owedBySupplier, toConsignmentLine, validateSettle, type ConsignmentLine } from '../consignment';

const line = (values: Partial<ConsignmentLine>): ConsignmentLine => ({
  id: 'l1', itemId: 'f1', supplierId: 's1', kind: 'sold', quantity: 1, costEachCents: 40000, vatRate: 15, invoiceId: 'i1', invoiceLineId: 'il1',
  patientId: 'p1', happenedOn: '2026-10-05', settledAt: null, expenseId: null, supplierReference: null, ...values
});

// Business rule: a consignment frame belongs to the supplier until it is sold; once sold (or lost) the practice owes
// the agreed cost plus VAT, and a frame taken off an invoice again is owed no longer
describe('what is owed to consignment suppliers', () => {
  it('works out VAT per line, as the database does, also for a line taken back', () => {
    expect(lineAmounts(line({}))).toEqual({ exclCents: 40000, vatCents: 6000, inclCents: 46000 });
    expect(lineAmounts(line({ quantity: -1, costEachCents: 33333 }))).toEqual({ exclCents: -33333, vatCents: -5000, inclCents: -38333 });
  });

  it('adds up the unsettled lines per supplier, net of frames taken off invoices', () => {
    const owed = owedBySupplier([
      line({ id: 'a', happenedOn: '2026-10-07' }),
      line({ id: 'b', happenedOn: '2026-10-02' }),
      line({ id: 'c', kind: 'sale_reversed', quantity: -1 }),
      line({ id: 'd', settledAt: '2026-10-08T10:00:00Z' }),
      line({ id: 'e', supplierId: 's2', costEachCents: 100000 })
    ]);
    expect(owed.map(entry => [entry.supplierId, entry.frames, entry.inclCents])).toEqual([['s2', 1, 115000], ['s1', 1, 46000]]);
    expect(owed[1].lines.map(entry => entry.id)).toEqual(['b', 'c', 'a']);
  });

  it('shows the supplier\'s frames still on the shelf at the agreed cost', () => {
    const shelf = onConsignment(
      [{ itemId: 'f1', supplierId: 's1', costCents: 40000 }, { itemId: 'f2', supplierId: 's1', costCents: 50000 }, { itemId: 'f3', supplierId: 's2', costCents: 10000 }],
      new Map([['f1', 2], ['f2', 1], ['f3', 0]])
    );
    expect(shelf).toEqual([{ supplierId: 's1', frames: 3, costCents: 130000 }]);
  });

  it('reads a stored line', () => {
    expect(toConsignmentLine({ id: 'x', item_id: 'f1', supplier_id: 's1', kind: 'sold', quantity: 2, cost_each: '450.50', vat_rate: '15', happened_on: '2026-10-05' }))
      .toMatchObject({ quantity: 2, costEachCents: 45050, vatRate: 15, happenedOn: '2026-10-05', settledAt: null });
  });
});

// Business rule: settling records the supplier's invoice as a payable, once; it must name the supplier's document
// and be for something owed (a credit alone is not a bill)
describe('settling with the supplier', () => {
  const options = { practiceId: 'p1', supplierId: 's1', today: '2026-10-13' };

  it('builds the payable from the open lines only', () => {
    const result = validateSettle({ supplierReference: ' INV 900 ', documentDate: '2026-10-12' }, { ...options, lines: [line({ id: 'a' }), line({ id: 'b', settledAt: 'x' })] });
    expect(result).toEqual({
      ok: true,
      inclCents: 46000,
      payload: { practice_id: 'p1', supplier_id: 's1', supplier_reference: 'INV 900', document_date: '2026-10-12', line_ids: ['a'] }
    });
  });

  it('refuses a future date, a missing number and a credit alone', () => {
    const result = validateSettle({ supplierReference: '', documentDate: '2026-10-14' }, { ...options, lines: [line({ quantity: -1 })] });
    expect(result).toMatchObject({ ok: false, errors: { supplierReference: expect.any(String), documentDate: expect.any(String), lines: 'Nothing is owed on these lines.' } });
  });
});
