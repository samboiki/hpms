import { describe, expect, it } from 'vitest';
import {
  amountToSettle,
  invoicesForAmount,
  ledgerEntries,
  openInvoices,
  planPayment,
  statementFor,
  supplierAccount,
  supplierAgeAnalysis,
  vatOnPurchases,
  type LedgerDelivery,
  type LedgerPayable,
  type SupplierAllocation,
  type SupplierLedgerData,
  type SupplierPayment
} from '../supplierLedger';

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

describe('what a supplier invoice still owes', () => {
  it('owes its total less what payments and credits paid of it, as the database works it out', () => {
    const account = supplierAccount('s1', 30, data({ deliveries: [delivery({})], payments: [payment({})], allocations: [allocation({})] }));
    expect(account.invoices[0].owedCents).toBe(1600);
    expect(account.balanceCents).toBe(1600);
  });

  it('owes nothing once its payable is marked paid in Practice Overhead, and the ledger shows that payment, so the two screens agree', () => {
    const payables = new Map<string, LedgerPayable>([['e1', { status: 'paid', paidDate: '2026-09-10', dueDate: '2026-08-31' }]]);
    const ledger = data({ deliveries: [delivery({})], payables });
    const account = supplierAccount('s1', 30, ledger);
    expect(account.invoices[0]).toMatchObject({ owedCents: 0, paidOutsideCents: 4600, paidOn: '2026-09-10' });
    const marked = ledgerEntries(ledger, () => 30).find(entry => entry.kind === 'marked_paid');
    expect(marked).toMatchObject({ date: '2026-09-10', amountCents: -4600 });
  });

  it('owes nothing once its delivery is reversed, and money paid for it becomes credit with the supplier', () => {
    // The database releases the allocation when a delivery is reversed: the payment is unused again
    const ledger = data({
      deliveries: [delivery({ reversedAt: '2026-09-20T10:00:00Z', reversalReason: 'Wrong supplier' })],
      payments: [payment({ amountCents: 4600 })],
      allocations: [allocation({ amountCents: 4600, reversedAt: '2026-09-20T10:00:00Z' })]
    });
    const account = supplierAccount('s1', 30, ledger);
    expect(account.owedCents).toBe(0);
    expect(account.creditCents).toBe(4600);
    expect(account.balanceCents).toBe(-4600);
  });

  it('leaves out a delivery that was not added to payables: it was not bought on account', () => {
    expect(supplierAccount('s1', 30, data({ deliveries: [delivery({ onAccount: false, expenseId: null })] })).invoices).toEqual([]);
  });

  it('counts unused return credits and payments not yet set against an invoice as credit, oldest first', () => {
    const ledger = data({
      deliveries: [delivery({}), delivery({ id: 'r1', number: 'RET2026-0001', kind: 'returned', documentDate: '2026-08-10', inclVatCents: 460, onAccount: false })],
      payments: [payment({ amountCents: 1000, paidOn: '2026-08-20' })]
    });
    const account = supplierAccount('s1', 30, ledger);
    expect(account.credits.map(credit => [credit.number, credit.unusedCents])).toEqual([['RET2026-0001', 460], ['PAY2026-0001', 1000]]);
    expect(account.balanceCents).toBe(4600 - 460 - 1000);
  });
});

describe('paying a supplier', () => {
  const ledger = data({
    deliveries: [
      delivery({}),
      delivery({ id: 'g2', number: 'GRV2026-0002', supplierReference: 'INV-2', documentDate: '2026-09-01', inclVatCents: 2300, expenseId: 'e2', createdAt: '2026-09-01T08:00:00Z' }),
      delivery({ id: 'r1', number: 'RET2026-0001', kind: 'returned', documentDate: '2026-08-10', inclVatCents: 460, onAccount: false })
    ]
  });
  const account = supplierAccount('s1', 30, ledger);

  it('pays the chosen invoices oldest first, credits before the payment, as stock_pay_supplier does', () => {
    const plan = planPayment(account, new Set(['g1', 'g2']), 3000, true);
    expect(plan.lines).toEqual([
      { invoiceId: 'g1', owedCents: 4600, fromCreditsCents: 460, fromPaymentCents: 3000, leftCents: 1140 },
      { invoiceId: 'g2', owedCents: 2300, fromCreditsCents: 0, fromPaymentCents: 0, leftCents: 2300 }
    ]);
    expect(plan).toMatchObject({ creditsUsedCents: 460, allocatedCents: 3000, onAccountCents: 0 });
  });

  it('keeps what the payment does not need as credit on account (a deposit or an overpayment)', () => {
    expect(planPayment(account, new Set(['g2']), 5000, false)).toMatchObject({ allocatedCents: 2300, onAccountCents: 2700 });
  });

  it('suggests the amount that settles the ticked invoices after credits, and ticks the oldest invoices a typed amount covers', () => {
    expect(amountToSettle(account, new Set(['g1', 'g2']), true)).toBe(4600 + 2300 - 460);
    expect([...invoicesForAmount(account, 4000, true)]).toEqual(['g1']);
    expect([...invoicesForAmount(account, 4500, true)]).toEqual(['g1', 'g2']);
    expect(openInvoices(account).map(row => row.delivery.id)).toEqual(['g1', 'g2']);
  });
});

describe('the supplier statement', () => {
  const ledger = data({
    deliveries: [
      delivery({}),
      delivery({ id: 'r1', number: 'RET2026-0001', kind: 'returned', documentDate: '2026-09-02', inclVatCents: 460, onAccount: false, createdAt: '2026-09-02T08:00:00Z' })
    ],
    payments: [payment({}), payment({ id: 'p2', number: 'PAY2026-0002', paidOn: '2026-09-15', amountCents: 500, createdAt: '2026-09-15T09:00:00Z',
      reversedAt: '2026-09-16T07:00:00Z', reversalReason: 'Captured twice' })],
    allocations: [allocation({})]
  });

  it('brings the balance forward, lists every entry with the running balance and ends on what is owed', () => {
    const statement = statementFor(ledgerEntries(ledger, () => 30).filter(entry => entry.supplierId === 's1'), '2026-09-01', '2026-09-30');
    expect(statement.openingCents).toBe(4600);
    expect(statement.lines.map(line => [line.kind, line.amountCents, line.balanceCents])).toEqual([
      ['credit', -460, 4140],
      ['payment', -3000, 1140],
      ['payment', -500, 640],
      // A reversal is its own entry on the day it was made, so a statement already sent never changes
      ['payment_reversed', 500, 1140]
    ]);
    expect(statement).toMatchObject({ closingCents: 1140, invoicedCents: 0, creditedCents: 460, paidCents: 3000 });
    // The closing balance is what the account says is owed
    expect(supplierAccount('s1', 30, ledger).balanceCents).toBe(1140);
  });
});

describe('the supplier age analysis', () => {
  it('ages what each invoice still owes from its date in the debtors\' bands, shows credit apart and what is past its terms', () => {
    const ledger = data({
      deliveries: [
        delivery({ documentDate: '2026-06-01' }),
        delivery({ id: 'g2', number: 'GRV2026-0002', documentDate: '2026-10-01', inclVatCents: 2300, expenseId: 'e2' }),
        delivery({ id: 'g9', supplierId: 's2', number: 'GRV2026-0009', documentDate: '2026-10-10', inclVatCents: 100, expenseId: 'e9' })
      ],
      payments: [payment({ amountCents: 1000, paidOn: '2026-10-05' })]
    });
    const analysis = supplierAgeAnalysis([
      { id: 's1', name: 'Medi Wholesale', paymentTermsDays: 30 },
      { id: 's2', name: 'Frame House', paymentTermsDays: 30 },
      { id: 's3', name: 'Nothing owed', paymentTermsDays: 30 }
    ], ledger, '2026-10-13');
    expect(analysis.rows.map(row => row.name)).toEqual(['Medi Wholesale', 'Frame House']);
    const first = analysis.rows[0];
    expect(first.bands.days_120).toBe(4600);
    expect(first.bands.current).toBe(2300);
    expect(first).toMatchObject({ owedCents: 6900, creditCents: 1000, balanceCents: 5900, overdueCents: 4600, openInvoices: 2 });
    expect(analysis.totals.balanceCents).toBe(5900 + 100);
  });
});

describe('VAT on purchases', () => {
  it('adds VAT on deliveries, takes off VAT on returns, and counts a reversal in the month it was made', () => {
    const vat = vatOnPurchases([
      delivery({ documentDate: '2026-08-01' }),
      delivery({ id: 'g3', onAccount: false, documentDate: '2026-08-20', exclVatCents: 1000, vatCents: 150, inclVatCents: 1150 }),
      delivery({ id: 'r1', kind: 'returned', documentDate: '2026-08-25', exclVatCents: 400, vatCents: 60, inclVatCents: 460, onAccount: false }),
      delivery({ id: 'g4', documentDate: '2026-08-28', exclVatCents: 2000, vatCents: 300, inclVatCents: 2300, reversedAt: '2026-09-02T09:00:00Z' })
    ], '2026-08-01', '2026-09-30');
    expect(vat.months).toEqual([
      { month: '2026-08', purchasesExclCents: 7000, purchasesVatCents: 1050, creditsExclCents: 400, creditsVatCents: 60, netVatCents: 990 },
      { month: '2026-09', purchasesExclCents: -2000, purchasesVatCents: -300, creditsExclCents: 0, creditsVatCents: 0, netVatCents: -300 }
    ]);
    expect(vat.total.netVatCents).toBe(690);
  });
});
