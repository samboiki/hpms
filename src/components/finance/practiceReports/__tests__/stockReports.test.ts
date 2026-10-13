/**
 * Stock movement per group with fast and slow movers (parity R8) and gross profit (parity R9): a dispensing practice
 * sees what moved, what sits on the shelf tying up money, and what it made on what it billed. Both follow the stock
 * ledger, so they agree with Stock's own figures, and gross profit's sales are Revenue by tariff code's lines.
 * Invented items, ids and amounts only.
 */
import { describe, expect, it } from 'vitest';
import { normalizeLineItem, revenueByTariffCode, toCents } from '../../../../services/ledgerService';
import { invoice } from '../../../../services/__tests__/ledgerTestUtils';
import type { StockItem } from '../../../../utils/stock/items';
import { DEFAULT_PRICE_RULE, priceStockLine } from '../../../../utils/stock/pricing';
import type { StockMovement } from '../../../../utils/stock/stockRows';
import { fastMovers, groupMovements, itemMovements, slowMovers, stockGroupOf } from '../stockMovement';
import { itemGroup, monthGroup, profitBy, profitNotes, soldLines, withoutVat, type RawStockLine } from '../grossProfit';

const RANGE = { startKey: '2026-10-01', endKey: '2026-10-31' };

const stockItem = (overrides: Partial<StockItem> = {}): StockItem => ({
  id: 'amox', practiceId: 'pr', name: 'Amoxicillin 500 mg', description: null, category: 'medications', sku: null, unit: 'capsule',
  nappiCode: null, barcode: null, group: 'Antibiotics', tariffCode: null, vatRate: null, sellingPriceCents: null, unitCostCents: 100,
  minimum: null, maximum: null, packSize: null, preferredSupplierId: null, location: null, notes: null, isScheduled: false,
  scheduleLabel: null, defaultDirections: null, isActive: true, quantity: 0, expiryDate: null, ...overrides
});

let sequence = 0;
const movement = (overrides: Partial<StockMovement>): StockMovement => ({
  id: `m${++sequence}`, itemId: 'amox', kind: 'received', quantity: 0, valueCents: 0, vatCents: null, batchNo: null, expiryDate: null,
  reasonCode: null, reason: null, occurredOn: '2026-10-05', documentRef: null, deliveryId: null, invoiceId: null, invoiceLineId: null,
  creditNoteId: null, patientId: null, practitionerId: null, dispensingId: null, countId: null, createdBy: null, createdAt: '2026-10-05T08:00:00Z',
  ...overrides
});

describe('stock movement per group', () => {
  const items = [
    stockItem(),
    stockItem({ id: 'gloves', name: 'Gloves', category: 'disposables', group: null, unit: 'box' }),
    stockItem({ id: 'syrup', name: 'Cough syrup', group: 'antibiotics', unit: 'bottle' }),
    stockItem({ id: 'old', name: 'Old item', group: null, isActive: false })
  ];
  // Today: amox 60 on hand (N$60), gloves 10 (N$250), syrup 4 (N$80), old nothing
  const levels = new Map([
    ['amox', { onHand: 60, valueCents: 6000 }],
    ['gloves', { onHand: 10, valueCents: 25000 }],
    ['syrup', { onHand: 4, valueCents: 8000 }]
  ]);
  const movements = [
    movement({ itemId: 'amox', kind: 'received', quantity: 100, valueCents: 10000, occurredOn: '2026-10-02' }),
    movement({ itemId: 'amox', kind: 'sold', quantity: -30, valueCents: -3000, occurredOn: '2026-10-10' }),
    movement({ itemId: 'amox', kind: 'sale_reversed', quantity: 5, valueCents: 500, occurredOn: '2026-10-11' }),
    movement({ itemId: 'amox', kind: 'dispensed', quantity: -10, valueCents: -1000, occurredOn: '2026-10-20' }),
    movement({ itemId: 'amox', kind: 'adjusted', quantity: -2, valueCents: -200, occurredOn: '2026-10-25', reasonCode: 'expired' }),
    // Sent to the branch's store: out of one store and onto "On the way" the same day, so the practice's stock is unchanged
    movement({ itemId: 'amox', kind: 'transfer_out', quantity: -20, valueCents: -2000, occurredOn: '2026-10-28' }),
    movement({ itemId: 'amox', kind: 'transfer_in', quantity: 20, valueCents: 2000, occurredOn: '2026-10-28' }),
    // After the period: the end of October is today's level less this
    movement({ itemId: 'amox', kind: 'sold', quantity: -3, valueCents: -300, occurredOn: '2026-11-02' })
  ];

  it('rolls each item forward: start + in - used + adjusted = end, the end being today\'s level less what moved after', () => {
    const rows = itemMovements({ items, levels, movements, range: RANGE });
    const amox = rows.find(row => row.itemId === 'amox');
    expect(amox).toMatchObject({ endUnits: 63, endCents: 6300, inUnits: 100, usedUnits: 35, adjustedUnits: -2, startUnits: 0, startCents: 0, lastUsedOn: '2026-11-02' });
    for (const row of rows) {
      expect(row.startUnits + row.inUnits - row.usedUnits + row.adjustedUnits).toBe(row.endUnits);
      expect(row.startCents + row.inCents - row.usedCents + row.adjustedCents).toBe(row.endCents);
    }
    // An item no longer used, without stock and without movements, is left out
    expect(rows.some(row => row.itemId === 'old')).toBe(false);
  });

  it('groups items by their stock group (ignoring capitals), else by category, saying so', () => {
    expect(stockGroupOf(items[1])).toEqual({ key: 'category:disposables', label: 'Disposables (no stock group)' });
    const groups = groupMovements(itemMovements({ items, levels, movements, range: RANGE }));
    expect(groups.map(group => [group.label, group.items, group.usedCents, group.endCents])).toEqual([
      ['Antibiotics', 2, 3500, 14300],
      ['Disposables (no stock group)', 1, 0, 25000]
    ]);
  });

  it('lists fast movers by units used and slow movers with the unused stock that ties up the most money first', () => {
    const rows = itemMovements({ items, levels, movements, range: RANGE });
    expect(fastMovers(rows).map(row => [row.itemId, row.usedUnits, row.daysLeft])).toEqual([['amox', 35, 55]]);
    expect(slowMovers(rows).map(row => row.itemId)).toEqual(['gloves', 'syrup', 'amox']);
  });
});

describe('gross profit', () => {
  const items = new Map([
    ['amox', stockItem()],
    ['frame', stockItem({ id: 'frame', name: 'Frame Model A', group: 'Frames', vatRate: 0 })]
  ]);
  const invoices = new Map([
    ['i1', invoice({ id: 'i1', invoiceNumber: 'INV-1', issueDate: '2026-10-05', practitionerId: 'dr-a' })],
    ['i2', invoice({ id: 'i2', invoiceNumber: 'INV-2', issueDate: '2026-10-12', practitionerId: 'dr-a' })],
    ['void', invoice({ id: 'void', invoiceNumber: 'INV-3', issueDate: '2026-10-12', status: 'cancelled', rawStatus: 'cancelled' })]
  ]);
  const line = (overrides: Partial<RawStockLine>): RawStockLine => ({
    id: 'l1', invoice_id: 'i1', stock_item_id: 'amox', code: '0201', description: 'Amoxicillin', quantity: 10, unit_price: 23, total_price: 230,
    medical_aid_covered: 0, patient_portion: 230, practitioner_id: null, ...overrides
  });
  const lines = [
    line({}),
    line({ id: 'l2', invoice_id: 'i2', stock_item_id: 'frame', code: 'FRAME', quantity: 1, unit_price: 900, total_price: 900, practitioner_id: 'dr-b' }),
    line({ id: 'l3', invoice_id: 'i2', quantity: 5, total_price: 115 }),
    line({ id: 'l4', invoice_id: 'i2', quantity: 2, total_price: 46 }),
    line({ id: 'l5', invoice_id: 'void', quantity: 2, total_price: 46 })
  ];
  const movements = [
    movement({ kind: 'sold', itemId: 'amox', invoiceLineId: 'l1', quantity: -10, valueCents: -1000 }),
    movement({ kind: 'sold', itemId: 'frame', invoiceLineId: 'l2', quantity: -1, valueCents: -40000 }),
    // l3 was credited in full: its stock came back
    movement({ kind: 'sold', itemId: 'amox', invoiceLineId: 'l3', quantity: -5, valueCents: -500 }),
    movement({ kind: 'sale_reversed', itemId: 'amox', invoiceLineId: 'l3', quantity: 5, valueCents: 500 }),
    movement({ kind: 'sold', itemId: 'amox', invoiceLineId: 'l5', quantity: -2, valueCents: -200 })
  ];
  const sold = soldLines({ lines, invoices, movements, items, defaultVatRate: 15, vatRegistered: true, range: RANGE });

  it('takes VAT off what was billed the way the stock price rule splits a VAT-inclusive price', () => {
    expect(withoutVat(23000, 15)).toBe(priceStockLine({ quantity: 1, lineCostCents: null, vatRate: 15, rule: DEFAULT_PRICE_RULE, fixedUnitPriceCents: 23000 })?.exclVatCents);
    expect(withoutVat(23000, 15)).toBe(20000);
    expect(withoutVat(90000, 0)).toBe(90000);
  });

  it('works out each line\'s profit against what the stock ledger took off for it, for the line\'s practitioner else the invoice\'s', () => {
    expect(sold.find(row => row.lineId === 'l1')).toMatchObject({ billedCents: 23000, vatRate: 15, salesCents: 20000, vatCents: 3000, costCents: 1000, profitCents: 19000, practitionerId: 'dr-a', state: 'counted' });
    // A frame at 0 % VAT (the item's own rate): all of it is sales
    expect(sold.find(row => row.lineId === 'l2')).toMatchObject({ salesCents: 90000, costCents: 40000, profitCents: 50000, practitionerId: 'dr-b', state: 'counted' });
    expect(sold.find(row => row.lineId === 'l3')?.state).toBe('stock_back');
    expect(sold.find(row => row.lineId === 'l4')?.state).toBe('no_movement');
    // A cancelled invoice is not a sale
    expect(sold.some(row => row.lineId === 'l5')).toBe(false);
  });

  // Owner, 13 Oct 2026: VAT follows Settings > Practice > VAT. A practice that is not VAT registered charged no VAT, so
  // taking 15 % off its frame and medicine sales understated its sales and profit
  it('takes no VAT off for a practice that is not VAT registered', () => {
    const unregistered = soldLines({ lines, invoices, movements, items, defaultVatRate: 15, vatRegistered: false, range: RANGE });
    expect(unregistered.find(row => row.lineId === 'l1')).toMatchObject({ billedCents: 23000, vatRate: 0, vatCents: 0, salesCents: 23000, profitCents: 22000 });
    expect(profitNotes(unregistered, { defaultVatRate: 15, vatRegistered: false, dispensedCostCents: 0 })).toContain('No VAT is taken off: the practice is not VAT registered (Settings > Practice), so it charged none.');
  });

  it('keeps lines without a known cost out of the margins but in the notes, so billed still adds up to Revenue by tariff code', () => {
    const byItem = profitBy(sold, itemGroup);
    expect(byItem.map(group => [group.label, group.salesCents, group.costCents, group.profitCents])).toEqual([
      ['Frame Model A', 90000, 40000, 50000],
      ['Amoxicillin 500 mg', 20000, 1000, 19000]
    ]);
    const notes = profitNotes(sold, { defaultVatRate: 15, vatRegistered: true, dispensedCostCents: 1234 });
    expect(notes.some(note => note.includes('1 line (N$ 115.00 billed) whose stock came back'))).toBe(true);
    expect(notes.some(note => note.includes('1 line (N$ 46.00 billed) never taken off stock'))).toBe(true);
    expect(notes.some(note => note.includes('N$ 12.34'))).toBe(true);
    // Counted and left-out lines together are exactly what Revenue by tariff code shows for these lines
    const ledgerLines = lines.map(raw => normalizeLineItem(raw)).filter((row): row is NonNullable<typeof row> => row !== null);
    const revenue = revenueByTariffCode(ledgerLines, [...invoices.values()], RANGE).reduce((sum, row) => sum + toCents(row.revenue), 0);
    expect(sold.reduce((sum, row) => sum + row.billedCents, 0)).toBe(revenue);
    expect(profitBy(sold, monthGroup, true).map(group => group.key)).toEqual(['2026-10']);
  });
});
