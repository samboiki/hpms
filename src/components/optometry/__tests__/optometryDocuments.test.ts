import { describe, expect, it } from 'vitest';
import { toCsv } from '../../finance/financeExport';
import { consignmentTable, frameSalesTable, jobCostingTable } from '../optometryDocuments';
import { owedBySupplier, type ConsignmentLine } from '../../../utils/optometry/consignment';
import { jobCosting } from '../../../utils/optometry/jobCosting';
import type { FrameSaleLine } from '../../../utils/optometry/frameReports';

const sale = (values: Partial<FrameSaleLine>): FrameSaleLine => ({
  invoiceLineId: 'line-1', invoiceId: 'inv-1', invoiceNumber: 'INV-0001', patientId: 'p1', soldOn: '2026-10-05', itemId: 'frame-1',
  frame: 'Test Brand TB1 Black 52-18-140', brand: 'Test Brand', units: 1, costCents: 45000, priceCents: 138000, priceExclCents: 120000,
  profitCents: 75000, barcodes: ['FR000001'], sellerId: 'u1', consignment: false, ...values
});

const owedLine = (values: Partial<ConsignmentLine>): ConsignmentLine => ({
  id: 'c1', itemId: 'frame-2', supplierId: 's1', kind: 'sold', quantity: 1, costEachCents: 40000, vatRate: 15, invoiceId: 'inv-2',
  invoiceLineId: 'line-2', patientId: 'p2', happenedOn: '2026-10-06', settledAt: null, expenseId: null, supplierReference: null, ...values
});

// Business rule: the printed and downloaded frame reports are what the practice checks its sales, its salespeople
// and its suppliers' accounts against, so every frame sold names its barcode and who sold it, and the totals are
// the sums of the rows
describe('the optometry reports for print and CSV', () => {
  it('lists each frame sold with its barcode and salesperson, totals adding up', () => {
    const table = frameSalesTable(
      [sale({}), sale({ invoiceLineId: 'line-3', barcodes: ['6001234567890'], sellerId: null, consignment: true, costCents: 40000, profitCents: 80000 })],
      '2026-10-01',
      '2026-10-13',
      { patients: new Map([['p1', 'Test Patient']]), staff: new Map([['u1', 'Test Optometrist']]) }
    );
    expect(table.rows.map(row => [row[4], row[10], row[11]])).toEqual([['FR000001', 'Test Optometrist', null], ['6001234567890', 'Not known', 'Yes']]);
    expect(table.totals?.slice(5, 10)).toEqual([2, 2760, 2400, 850, 1550]);
    expect(toCsv(table.columns, table.rows).split('\r\n')[1]).toContain('FR000001');
  });

  it('owes each supplier the rows it shows, with VAT on the agreed cost', () => {
    const owed = owedBySupplier([owedLine({}), owedLine({ id: 'c2', quantity: 2, happenedOn: '2026-10-07' }), owedLine({ id: 'c3', settledAt: '2026-10-08T10:00:00Z' })]);
    const table = consignmentTable(owed, '2026-10-13', { suppliers: new Map([['s1', 'Test Optical Supplier']]), frames: new Map([['frame-2', 'Consigned frame']]) });
    // The settled line is not owed any more
    expect(table.rows).toHaveLength(2);
    expect(table.totals?.slice(4)).toEqual([3, null, 1200, 180, 1380]);
    expect(table.rows[0].slice(0, 4)).toEqual(['Test Optical Supplier', '2026-10-06', 'Consigned frame', 'Sold']);
  });

  it('says which jobs are still missing a cost', () => {
    const costing = jobCosting([
      { orderId: 'o1', orderNo: 7, patientId: 'p1', orderedOn: '2026-10-02', status: 'collected', lensCostCents: null, labourCostCents: 10000, labInvoiceRef: null,
        invoice: { id: 'inv-1', number: 'INV-0001', lines: [{ totalCents: 115000, vatRate: 15 }, { totalCents: 50000, vatRate: null }] }, frameCostCents: 45000 }
    ]);
    const table = jobCostingTable(costing, '2026-10-01', '2026-10-13', new Map([['p1', 'Test Patient']]));
    expect(table.rows[0]).toEqual(['#7', '2026-10-02', 'Test Patient', 'INV-0001', 1500, 450, null, 100, 950, 950 / 1500, 'lab cost not entered']);
    expect(table.totals?.[10]).toBe('1 incomplete');
  });
});
