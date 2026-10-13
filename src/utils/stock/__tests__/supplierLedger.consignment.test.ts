import { describe, expect, it } from 'vitest';
import {
  CONSIGNMENT_INVOICE_NOTE,
  LEDGER_DELIVERY_BASE_COLUMNS,
  LEDGER_DELIVERY_COLUMNS,
  ledgerEntries,
  normalizeLedgerDelivery,
  planPayment,
  statementFor,
  supplierAccount,
  supplierAgeAnalysis,
  vatOnPurchases,
  type LedgerDelivery,
  type LedgerPayable,
  type SupplierLedgerData
} from '../supplierLedger';

// Invented suppliers and amounts. A consignment invoice (CSG) is the frame supplier's invoice for consignment frames
// sold, recorded on Optometry > Reports > Consignment (proposals/2026-10-13-consignment-supplier-ledger.sql).
const delivery = (overrides: Partial<LedgerDelivery>): LedgerDelivery => ({
  id: 'g1', number: 'GRV2026-0001', kind: 'received', supplierId: 'wholesaler', supplierReference: 'W-100', documentDate: '2026-08-01',
  exclVatCents: 10000, vatCents: 1500, inclVatCents: 11500, onAccount: true, expenseId: 'e1', createdAt: '2026-08-01T08:00:00Z',
  reversedAt: null, reversalReason: null, ...overrides
});
const consignmentInvoice = (overrides: Partial<LedgerDelivery>): LedgerDelivery => delivery({
  id: 'c1', number: 'CSG2026-0001', supplierId: 'frames', supplierReference: 'F-77', documentDate: '2026-09-01', exclVatCents: 40000,
  vatCents: 6000, inclVatCents: 46000, expenseId: 'e9', createdAt: '2026-09-01T10:00:00Z', consignment: true, ...overrides
});
const data = (parts: Partial<SupplierLedgerData>): SupplierLedgerData => ({
  deliveries: [], payables: new Map<string, LedgerPayable>(), payments: [], allocations: [], ...parts
});
const suppliers = [
  { id: 'wholesaler', name: 'Wholesaler', paymentTermsDays: 30 },
  { id: 'frames', name: 'Frame supplier', paymentTermsDays: 60 }
];

describe('what the practice owes a frame supplier is one figure: its consignment invoices are on its account', () => {
  // Before 13 Oct the consignment invoice was only a payable in Finance: the supplier's account, statement and age
  // analysis said less was owed than the practice really owed, and Pay could not pay it
  it('owes a consignment invoice like a delivery\'s invoice, next to the supplier\'s other invoices', () => {
    const ledger = data({ deliveries: [delivery({ id: 'g2', supplierId: 'frames', supplierReference: 'F-1', inclVatCents: 34500 }), consignmentInvoice({})] });
    const account = supplierAccount('frames', 60, ledger);
    expect(account.invoices.map(invoice => [invoice.delivery.number, invoice.owedCents])).toEqual([['GRV2026-0001', 34500], ['CSG2026-0001', 46000]]);
    expect(account.balanceCents).toBe(34500 + 46000);
    expect(account.invoices[1].dueDate).toBe('2026-10-31');
  });

  it('can be paid from the supplier\'s account: the payment plan pays it in full', () => {
    const account = supplierAccount('frames', 60, data({ deliveries: [consignmentInvoice({})] }));
    const plan = planPayment(account, new Set(['c1']), 46000, false);
    expect(plan.lines).toEqual([{ invoiceId: 'c1', owedCents: 46000, fromCreditsCents: 0, fromPaymentCents: 46000, leftCents: 0 }]);
  });

  it('owes nothing once its payable is marked paid or it is reversed, as any supplier invoice', () => {
    const paid = new Map<string, LedgerPayable>([['e9', { status: 'paid', paidDate: '2026-09-20', dueDate: '2026-10-31' }]]);
    expect(supplierAccount('frames', 60, data({ deliveries: [consignmentInvoice({})], payables: paid })).owedCents).toBe(0);
    const reversed = consignmentInvoice({ reversedAt: '2026-09-05T08:00:00Z', reversalReason: 'Typed the wrong frames' });
    expect(supplierAccount('frames', 60, data({ deliveries: [reversed] })).owedCents).toBe(0);
  });

  it('is on the statement, saying it is for consignment frames sold, and in the age analysis by its own date', () => {
    const ledger = data({ deliveries: [consignmentInvoice({})] });
    const entries = ledgerEntries(ledger, () => 60).filter(entry => entry.supplierId === 'frames');
    const statement = statementFor(entries, '2026-09-01', '2026-09-30');
    expect(statement.lines.map(line => [line.kind, line.document, line.reference, line.amountCents, line.note]))
      .toEqual([['invoice', 'CSG2026-0001', 'F-77', 46000, CONSIGNMENT_INVOICE_NOTE]]);
    expect(statement.closingCents).toBe(46000);
    const row = supplierAgeAnalysis(suppliers, ledger, '2026-11-15').rows.find(entry => entry.supplierId === 'frames');
    // 75 days old (the 60 days column), past the supplier's 60 days
    expect(row).toMatchObject({ owedCents: 46000, overdueCents: 46000, bands: expect.objectContaining({ days_60: 46000 }) });
  });

  it('counts its VAT as VAT paid on purchases (the frames were bought when sold)', () => {
    const vat = vatOnPurchases([consignmentInvoice({})], '2026-09-01', '2026-09-30');
    expect(vat.total).toMatchObject({ purchasesExclCents: 40000, purchasesVatCents: 6000, netVatCents: 6000 });
  });
});

describe('a supplier without consignment invoices keeps exactly the same figures', () => {
  // The owner's condition: adding consignment invoices must not change what is owed to any other supplier
  const wholesalerLedger = (withFlag: boolean) => data({
    deliveries: [
      delivery({ ...(withFlag ? { consignment: false } : {}) }),
      delivery({ id: 'g2', number: 'GRV2026-0002', supplierReference: 'W-101', documentDate: '2026-08-15', inclVatCents: 5750, ...(withFlag ? { consignment: false } : {}) }),
      delivery({ id: 'r1', number: 'RET2026-0001', kind: 'returned', supplierReference: 'W-CN-1', documentDate: '2026-08-20', inclVatCents: 460, onAccount: false })
    ]
  });

  // What a screen shows of an account: each invoice's figures, the credits and the totals
  const figures = (ledger: SupplierLedgerData) => {
    const account = supplierAccount('wholesaler', 30, ledger);
    return {
      invoices: account.invoices.map(row => [row.delivery.number, row.owedCents, row.allocatedCents, row.paidOutsideCents, row.dueDate]),
      credits: account.credits,
      totals: [account.owedCents, account.creditCents, account.balanceCents]
    };
  };

  it('has the same account, statement and age row whether or not the rows carry the consignment flag', () => {
    const before = wholesalerLedger(false);
    const after = wholesalerLedger(true);
    expect(figures(after)).toEqual(figures(before));
    expect(statementFor(ledgerEntries(after, () => 30), '2026-08-01', '2026-09-30'))
      .toEqual(statementFor(ledgerEntries(before, () => 30), '2026-08-01', '2026-09-30'));
    expect(supplierAgeAnalysis(suppliers, after, '2026-10-01')).toEqual(supplierAgeAnalysis(suppliers, before, '2026-10-01'));
  });

  it('is not changed by another supplier\'s consignment invoices', () => {
    const alone = wholesalerLedger(true);
    const withFrames = data({ deliveries: [...alone.deliveries, consignmentInvoice({}), consignmentInvoice({ id: 'c2', number: 'CSG2026-0002', supplierReference: 'F-78' })] });
    expect(figures(withFrames)).toEqual(figures(alone));
    expect(figures(alone).totals).toEqual([11500 + 5750, 460, 11500 + 5750 - 460]);
    const wholesalerRow = (ledger: SupplierLedgerData) => supplierAgeAnalysis(suppliers, ledger, '2026-10-01').rows.find(row => row.supplierId === 'wholesaler');
    expect(wholesalerRow(withFrames)).toEqual(wholesalerRow(alone));
    expect(ledgerEntries(withFrames, () => 30).filter(entry => entry.supplierId === 'wholesaler'))
      .toEqual(ledgerEntries(alone, () => 30).filter(entry => entry.supplierId === 'wholesaler'));
  });
});

describe('reading supplier invoices before and after the database update', () => {
  it('asks for the consignment flag, and keeps the earlier columns to read without it', () => {
    expect(LEDGER_DELIVERY_COLUMNS).toBe(`${LEDGER_DELIVERY_BASE_COLUMNS}, consignment`);
    expect(LEDGER_DELIVERY_BASE_COLUMNS).not.toMatch(/consignment/);
  });

  it('reads a row without the column as an ordinary delivery, and a flagged row as a consignment invoice', () => {
    const row = {
      id: 'c1', number: 'CSG2026-0001', kind: 'received', supplier_id: 'frames', supplier_reference: 'F-77', document_date: '2026-09-01',
      total_excl_vat: '400.00', vat_amount: '60.00', total_incl_vat: '460.00', on_account: true, expense_id: 'e9', created_at: '2026-09-01T10:00:00Z'
    };
    expect(normalizeLedgerDelivery(row).consignment).toBe(false);
    expect(normalizeLedgerDelivery({ ...row, consignment: true })).toMatchObject({ consignment: true, inclVatCents: 46000, onAccount: true });
  });
});
