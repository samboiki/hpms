import { describe, expect, it } from 'vitest';
import type { StockMovement } from '../../stock/stockRows';
import { frameSaleLines, frameStatusRows, salesBySeller, type FrameInfo } from '../frameReports';
import { toFrameUnit } from '../frameUnits';
import { presbyopicPatients } from '../report';

type Sale = Pick<StockMovement, 'itemId' | 'kind' | 'quantity' | 'valueCents' | 'invoiceLineId' | 'invoiceId' | 'documentRef' | 'patientId' | 'occurredOn' | 'createdBy' | 'createdAt'>;
const sale = (values: Partial<Sale>): Sale => ({
  itemId: 'f1', kind: 'sold', quantity: -1, valueCents: -45000, invoiceLineId: 'l1', invoiceId: 'i1', documentRef: 'INV-1', patientId: 'p1',
  occurredOn: '2026-10-05', createdBy: 'cashier', createdAt: '2026-10-05T09:00:00Z', ...values
});

const frames = new Map<string, FrameInfo>([
  ['f1', { name: 'Kenzo A Black', brand: 'Kenzo', consignmentSupplierId: null }],
  ['f2', { name: 'Vogue B Red', brand: 'Vogue', consignmentSupplierId: 's9' }]
]);

// Business rule: "frames month to date" must agree with the stock figures and the invoices: a bill saved again (its
// line removed and added back) is one sale, a frame credited back is no sale, and lens cleaner is not a frame
describe('frames sold, line by line', () => {
  const lines = frameSaleLines(
    [
      sale({}),
      // The visit's bill saved again: the old line taken off, a new line billing the same frame
      sale({ kind: 'sale_reversed', quantity: 1, valueCents: 45000, createdAt: '2026-10-06T09:00:00Z', occurredOn: '2026-10-06' }),
      sale({ invoiceLineId: 'l2', createdAt: '2026-10-06T09:00:01Z', occurredOn: '2026-10-06', createdBy: 'reception' }),
      // A consignment frame: no ledger value, the amount owed to the supplier is its cost
      sale({ itemId: 'f2', invoiceLineId: 'l3', valueCents: 0, invoiceId: 'i2', documentRef: 'INV-2', createdAt: '2026-10-07T09:00:00Z', occurredOn: '2026-10-07' }),
      sale({ itemId: 'cleaner', invoiceLineId: 'l4' })
    ],
    frames,
    {
      lines: new Map([['l2', { totalCents: 115000, vatRate: 15 }], ['l3', { totalCents: 92000, vatRate: 15 }]]),
      units: [
        { barcode: 'FR000002', invoiceLineId: 'l2', soldById: 'optician', status: 'sold' },
        { barcode: 'FR000003', invoiceLineId: 'l3', soldById: null, status: 'sold' }
      ],
      consignmentCost: new Map([['l3', 40000]])
    }
  );

  it('counts each frame once, with its price without VAT, its cost and profit', () => {
    expect(lines.map(line => [line.invoiceLineId, line.units, line.priceExclCents, line.costCents, line.profitCents, line.barcodes])).toEqual([
      ['l2', 1, 100000, 45000, 55000, ['FR000002']],
      ['l3', 1, 80000, 40000, 40000, ['FR000003']]
    ]);
    expect(lines[1].consignment).toBe(true);
  });

  it('names who sold it: the frame\'s salesperson, else who billed it', () => {
    expect(lines.map(line => line.sellerId)).toEqual(['optician', 'cashier']);
    expect(salesBySeller(lines)).toEqual([
      { sellerId: 'optician', frames: 1, salesCents: 100000, costCents: 45000, profitCents: 55000 },
      { sellerId: 'cashier', frames: 1, salesCents: 80000, costCents: 40000, profitCents: 40000 }
    ]);
  });
});

// Business rule: the barcode report shows where every frame is and, for frames still in the practice, how long they
// have been waiting (slow sellers go back to the supplier)
describe('frames by barcode', () => {
  it('lists every barcode with its status and days in stock', () => {
    const rows = frameStatusRows(
      [
        toFrameUnit({ id: 'u2', item_id: 'f1', barcode: 'FR000002', status: 'sold', status_on: '2026-10-06', created_at: '2026-09-01T08:00:00Z' }),
        toFrameUnit({ id: 'u1', item_id: 'f1', barcode: 'FR000001', status: 'in_stock', status_on: '2026-09-01', created_at: '2026-09-01T08:00:00Z' }),
        toFrameUnit({ id: 'u3', item_id: 'f2', barcode: 'C-1', status: 'reserved', status_on: '2026-10-10', created_at: '2026-10-01T08:00:00Z' })
      ],
      frames,
      '2026-10-13'
    );
    expect(rows.map(row => [row.barcode, row.status, row.daysInStock, row.consignmentSupplierId])).toEqual([
      ['FR000001', 'in_stock', 42, null],
      ['FR000002', 'sold', null, null],
      ['C-1', 'reserved', 12, 's9']
    ]);
  });
});

// Business rule: the presbyopic list is for calling patients (progressive lenses, reading glasses): the people
// behind the counts, youngest first, without a reading addition left out
describe('the presbyopic patient list', () => {
  it('lists patients with a reading addition by age, youngest first', () => {
    const list = presbyopicPatients([
      { patientId: 'old', dateOfBirth: '1950-01-01', add: 2.5, prescribedOn: '2026-01-10' },
      { patientId: 'young', dateOfBirth: '1984-03-01', add: 1, prescribedOn: '2026-05-02' },
      { patientId: 'none', dateOfBirth: '1990-01-01', add: null },
      { patientId: 'unknown', dateOfBirth: null, add: 2 }
    ], '2026-10-13');
    expect(list.map(entry => [entry.patientId, entry.age, entry.band])).toEqual([
      ['young', 42, '40 to 44'],
      ['old', 76, '65 and over'],
      ['unknown', null, 'No date of birth']
    ]);
  });
});
