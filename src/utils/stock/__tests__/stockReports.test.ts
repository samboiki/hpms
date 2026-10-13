import { describe, expect, it } from 'vitest';
import { goodsReceivedTable, monthsIn, priceListTable, salesTable, transfersTable, usageByItem, usageTable, type ReportItem } from '../stockReports';
import type { StockMovement } from '../stockRows';
import type { LedgerDelivery } from '../supplierLedger';
import type { StockTransfer } from '../stores';

const item = (overrides: Partial<ReportItem>): ReportItem => ({
  id: 'i1', name: 'Paracetamol 500 mg', unit: 'tablet', group: 'Analgesics', category: 'medications', code: '700123001', isActive: true, ...overrides
});

let next = 0;
const movement = (overrides: Partial<StockMovement>): StockMovement => ({
  id: `m${++next}`, itemId: 'i1', kind: 'sold', quantity: -1, valueCents: -100, vatCents: null, batchNo: null, expiryDate: null, reasonCode: null,
  reason: null, occurredOn: '2026-10-05', documentRef: null, deliveryId: null, invoiceId: null, invoiceLineId: null, creditNoteId: null,
  patientId: null, practitionerId: null, dispensingId: null, countId: null, createdBy: null, createdAt: '2026-10-05T08:00:00Z', ...overrides
});

describe('stock usage and sales', () => {
  const items = [item({}), item({ id: 'i2', name: 'Gloves', unit: 'box', group: 'Consumables', category: 'disposables' })];
  const movements = [
    movement({ quantity: -10, valueCents: -1000, invoiceId: 'inv1' }),
    movement({ kind: 'sale_reversed', quantity: 2, valueCents: 200, invoiceId: 'inv1' }),
    movement({ quantity: -4, valueCents: -400, invoiceId: 'inv2' }),
    movement({ kind: 'dispensed', quantity: -3, valueCents: -300 }),
    movement({ kind: 'adjusted', reasonCode: 'expired', quantity: -5, valueCents: -500 }),
    movement({ kind: 'counted', quantity: 1, valueCents: 100 }),
    movement({ itemId: 'i2', kind: 'adjusted', reasonCode: 'used_in_practice', quantity: -2, valueCents: -6000 }),
    // Not usage: stock arriving, going back to the supplier, or moving between the practice's stores
    movement({ kind: 'received', quantity: 50, valueCents: 5000 }),
    movement({ kind: 'returned', quantity: -2, valueCents: -200 }),
    movement({ kind: 'transfer_out', quantity: -5, valueCents: -500 }),
    movement({ kind: 'transfer_in', quantity: 5, valueCents: 500 })
  ];

  it('counts what went out by how it went, never deliveries, returns or moves between stores', () => {
    const rows = usageByItem(movements, items);
    const tablets = rows.find(row => row.item.id === 'i1');
    expect(tablets).toMatchObject({ billed: 12, dispensed: 3, usedInPractice: 0, writtenOff: 5, other: -1, total: 19, costCents: 1900, billedCostCents: 1200, invoices: 2 });
    expect(rows.find(row => row.item.id === 'i2')).toMatchObject({ usedInPractice: 2, total: 2, costCents: 6000 });
  });

  it('lists sales as units billed at cost, net of lines taken back', () => {
    const table = salesTable(usageByItem(movements, items), '2026-10-01', '2026-10-31');
    expect(table.rows).toEqual([['Paracetamol 500 mg', 'Analgesics', 'tablet', 12, 2, 12]]);
    expect(table.totals).toEqual(['Total', null, null, 12, null, 12]);
  });

  it('gives usage per month so a practice can set its minimum and order quantities', () => {
    expect(monthsIn('2026-07-01', '2026-09-30')).toBeCloseTo(3, 1);
    const table = usageTable(usageByItem(movements, items), '2026-07-01', '2026-09-30');
    const tablets = table.rows.find(row => row[0] === 'Paracetamol 500 mg');
    expect(tablets?.[7]).toBe(19);
    expect(tablets?.[8]).toBeCloseTo(6.3, 1);
  });
});

describe('price list', () => {
  it('lists only items in use, by group then name, with the price they sell at', () => {
    const table = priceListTable([
      { item: item({ id: 'b', name: 'Bandage', group: 'Dressings', code: null }), sellsAs: 'roll', priceCents: 2500, unitPriceCents: 2500 },
      { item: item({ id: 'a', name: 'Amoxicillin', group: 'Antibiotics' }), sellsAs: 'pack of 20 capsules', priceCents: 9000, unitPriceCents: 450 },
      { item: item({ id: 'c', name: 'Old cream', isActive: false }), sellsAs: 'tube', priceCents: 100, unitPriceCents: 100 },
      { item: item({ id: 'd', name: 'Swab', group: null }), sellsAs: 'each', priceCents: null, unitPriceCents: null }
    ], 'As at 13 Oct 2026');
    expect(table.rows.map(row => row[0])).toEqual(['Amoxicillin', 'Bandage', 'Swab']);
    expect(table.rows[0]).toEqual(['Amoxicillin', 'Antibiotics', '700123001', 'pack of 20 capsules', 90, 4.5]);
    expect(table.rows[2][4]).toBeNull();
  });
});

describe('goods received and transfers', () => {
  const delivery = (overrides: Partial<LedgerDelivery>): LedgerDelivery => ({
    id: 'g1', number: 'GRV2026-0001', kind: 'received', supplierId: 's1', supplierReference: 'INV-1', documentDate: '2026-10-02', exclVatCents: 4000,
    vatCents: 600, inclVatCents: 4600, onAccount: true, expenseId: 'e1', createdAt: '2026-10-02T08:00:00Z', reversedAt: null, reversalReason: null, ...overrides
  });

  it('lists deliveries and returns in the period, returns negative, reversed ones left out of the totals', () => {
    const table = goodsReceivedTable([
      delivery({}),
      delivery({ id: 'r1', number: 'RET2026-0001', kind: 'returned', documentDate: '2026-10-03', exclVatCents: 400, vatCents: 60, inclVatCents: 460 }),
      delivery({ id: 'g2', number: 'GRV2026-0002', documentDate: '2026-10-04', reversedAt: '2026-10-05T09:00:00Z', reversalReason: 'Wrong supplier' }),
      delivery({ id: 'g0', number: 'GRV2026-0000', documentDate: '2026-09-30' })
    ], () => 'Medi Wholesale', '2026-10-01', '2026-10-31');
    expect(table.rows.map(row => row[1])).toEqual(['GRV2026-0001', 'RET2026-0001', 'GRV2026-0002']);
    expect(table.rows[1][7]).toBe(-4.6);
    expect(table.rows[2][8]).toBe('Reversed: Wrong supplier');
    expect(table.totals).toEqual(['Total', null, null, null, null, 36, 5.4, 41.4, null]);
  });

  it('lists transfers sent in the period with who sent and received them, cancelled ones out of the totals', () => {
    const transfer = (overrides: Partial<StockTransfer>): StockTransfer => ({
      id: 't1', number: 'TRF2026-0001', fromLocationId: null, toLocationId: 's1', lines: [{ itemId: 'i1', name: 'Gloves', unit: 'box', quantity: 5, valueCents: 1250 }],
      notes: null, status: 'received', sentBy: 'u1', sentAt: '2026-10-02T08:00:00Z', receivedBy: 'u2', receivedAt: '2026-10-02T12:00:00Z',
      cancelledBy: null, cancelledAt: null, cancelReason: null, ...overrides
    });
    const table = transfersTable(
      [transfer({}), transfer({ id: 't2', number: 'TRF2026-0002', status: 'cancelled', receivedBy: null, receivedAt: null, cancelledAt: '2026-10-03T08:00:00Z', cancelReason: 'Sent by mistake' })],
      id => (id ? 'Branch' : 'Main store'),
      id => (id === 'u1' ? 'Anna' : id === 'u2' ? 'Paulus' : 'Staff member'),
      '2026-10-01', '2026-10-31',
      timestamp => timestamp.slice(0, 10)
    );
    expect(table.rows[0]).toEqual(['2026-10-02', 'TRF2026-0001', 'Main store', 'Branch', 1, 5, 12.5, 'Received', 'Anna', '2 Oct 2026 by Paulus']);
    expect(table.rows[1][9]).toBe('Cancelled 3 Oct 2026: Sent by mistake');
    expect(table.totals?.[5]).toBe(5);
  });
});
