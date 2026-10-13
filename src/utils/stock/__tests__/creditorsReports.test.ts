import { describe, expect, it } from 'vitest';
import {
  creditorsTransactionsTable,
  paymentAdviceTable,
  supplierAgeTable,
  supplierStatementTable,
  vatOnPurchasesTable
} from '../creditorsReports';
import {
  ledgerEntries,
  statementFor,
  supplierAgeAnalysis,
  vatOnPurchases,
  type LedgerDelivery,
  type LedgerPayable,
  type SupplierAllocation,
  type SupplierLedgerData,
  type SupplierPayment
} from '../supplierLedger';

// Invented suppliers and documents
const delivery = (overrides: Partial<LedgerDelivery>): LedgerDelivery => ({
  id: 'g1', number: 'GRV2026-0001', kind: 'received', supplierId: 's1', supplierReference: 'INV-1', documentDate: '2026-08-01',
  exclVatCents: 4000, vatCents: 600, inclVatCents: 4600, onAccount: true, expenseId: 'e1', createdAt: '2026-08-01T08:00:00Z',
  reversedAt: null, reversalReason: null, ...overrides
});
const payment = (overrides: Partial<SupplierPayment>): SupplierPayment => ({
  id: 'p1', number: 'PAY2026-0001', supplierId: 's1', paidOn: '2026-09-05', amountCents: 3000, method: 'bank_transfer', reference: 'EFT 1',
  notes: null, createdBy: null, createdAt: '2026-09-05T09:00:00Z', reversedAt: null, reversalReason: null, ...overrides
});
const allocation = (overrides: Partial<SupplierAllocation>): SupplierAllocation => ({
  id: 'a1', supplierId: 's1', invoiceId: 'g1', paymentId: 'p1', creditId: null, amountCents: 3000, createdAt: '2026-09-05T09:00:00Z',
  reversedAt: null, ...overrides
});
const data = (parts: Partial<SupplierLedgerData>): SupplierLedgerData => ({
  deliveries: [], payables: new Map<string, LedgerPayable>(), payments: [], allocations: [], ...parts
});
const SUPPLIERS = [
  { id: 's1', name: 'Medi Wholesale', paymentTermsDays: 30 },
  { id: 's2', name: 'Frame House', paymentTermsDays: 30 }
];
const nameOf = (id: string) => SUPPLIERS.find(supplier => supplier.id === id)?.name ?? 'A supplier';

describe('creditors reports as they print and export', () => {
  it('totals the age analysis as the sum of its suppliers, with credit taken off, so the printed total matches what is owed', () => {
    const ledger = data({
      deliveries: [delivery({ documentDate: '2026-06-01' }), delivery({ id: 'g9', supplierId: 's2', documentDate: '2026-10-10', inclVatCents: 100, expenseId: 'e9' })],
      payments: [payment({ amountCents: 1000, paidOn: '2026-10-05' })]
    });
    const table = supplierAgeTable(supplierAgeAnalysis(SUPPLIERS, ledger, '2026-10-13'), '2026-10-13');
    const balance = table.columns.findIndex(column => column.header === 'Balance');
    const credit = table.columns.findIndex(column => column.header === 'Credit');
    const bands = table.columns.flatMap((column, index) => (/^(Current|\d+\+? days)$/.test(column.header) ? [index] : []));
    expect(bands).toHaveLength(7);
    expect(table.rows.map(row => row[0])).toEqual(['Medi Wholesale', 'Frame House']);
    expect(table.rows.map(row => row[balance])).toEqual([36, 1]);
    // Credit is money the supplier holds for the practice: shown negative, so the age columns + credit = the balance
    expect(table.rows[0][credit]).toBe(-10);
    for (const row of table.rows) {
      expect(bands.reduce((sum, index) => sum + Number(row[index]), 0) + Number(row[credit])).toBeCloseTo(Number(row[balance]), 2);
    }
    expect(table.totals?.[balance]).toBe(37);
  });

  it('lists the transactions of the period only, each as owed more or owed less, for one supplier or all', () => {
    const ledger = data({
      deliveries: [delivery({}), delivery({ id: 'g2', supplierId: 's2', documentDate: '2026-09-10', inclVatCents: 2300, createdAt: '2026-09-10T08:00:00Z' })],
      payments: [payment({})],
      allocations: [allocation({})]
    });
    const entries = ledgerEntries(ledger, () => 30);
    const all = creditorsTransactionsTable(entries, nameOf, '2026-09-01', '2026-09-30');
    expect(all.rows.map(row => [row[1], row[2], row[5], row[6]])).toEqual([
      ['Medi Wholesale', 'Payment', null, 30],
      ['Frame House', 'Invoice', 23, null]
    ]);
    const one = creditorsTransactionsTable(entries.filter(entry => entry.supplierId === 's2'), nameOf, '2026-09-01', '2026-09-30');
    expect(one.rows).toHaveLength(1);
  });

  it('prints the supplier and its postal address on one line under the statement title, for posting it', () => {
    const ledger = data({ deliveries: [delivery({})] });
    const statement = statementFor(ledgerEntries(ledger, () => 30), '2026-08-01', '2026-08-31');
    const table = supplierStatementTable(statement, 'Medi Wholesale', 'PO Box 1\n Windhoek ');
    expect(table.basis).toContain('Medi Wholesale, PO Box 1, Windhoek');
    expect(table.rows[0]).toEqual(['2026-08-01', 'Balance brought forward', null, null, null, null, 0]);
    expect(table.totals?.[6]).toBe(46);
    // Without an address the line is just the period
    expect(supplierStatementTable(statement, 'Medi Wholesale').basis).not.toContain('Medi Wholesale');
  });

  it('gives the supplier a payment advice of the invoices the payment paid, and says what stays on account', () => {
    const paid = payment({ amountCents: 5000 });
    const table = paymentAdviceTable(paid, [allocation({}), allocation({ id: 'a2', reversedAt: '2026-09-06T08:00:00Z', amountCents: 1000 })],
      [delivery({})], 'Medi Wholesale');
    // A released allocation (its invoice or payment was reversed) is not paid any more
    expect(table.rows).toEqual([['INV-1', '2026-08-01', 'GRV2026-0001', 30]]);
    expect(table.totals?.[3]).toBe(50);
    expect(table.notes?.join(' ')).toContain('N$ 20.00 is on account');
  });

  it('says that VAT on purchases is not a VAT return, because patient invoices do not record VAT yet (owner decision J4)', () => {
    const vat = vatOnPurchases([delivery({})], '2026-08-01', '2026-08-31');
    const table = vatOnPurchasesTable(vat.months, vat.total, '2026-08-01', '2026-08-31');
    expect(table.rows).toEqual([['Aug 2026', 40, 6, 0, 0, 6]]);
    expect(table.notes?.join(' ')).toMatch(/not a VAT return/);
  });
});
