/** Ledger rules: payroll, practice expenses and inventory valuation */
import { describe, it, expect } from 'vitest';
import {
  accountsPayable,
  expensesByMonth,
  inventoryItemValue,
  isExpired,
  isExpiringSoon,
  isLowStock,
  normalizeExpense,
  normalizeInventoryItem,
  normalizePayslip,
  normalizePayslipStatus,
  payrollByMonth,
  payrollVsRevenue,
  summarizeExpenses,
  summarizePayroll,
  valueInventory,
  type DateRange
} from '../ledgerService';
import { invoice, payslip, expense, item } from './ledgerTestUtils';

// ---------------------------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------------------------

describe('payroll', () => {
  const october: DateRange = { startKey: '2026-10-01', endKey: '2026-10-31' };

  it.each([
    ['paid', 'paid'],
    ['PAID', 'paid'],
    ['unpaid', 'unpaid'],
    ['draft', 'unpaid'],
    ['approved', 'unpaid'],
    [null, 'unpaid'],
    ['cancelled', 'cancelled']
  ])('payslip status "%s" is %s', (raw, expected) => {
    expect(normalizePayslipStatus(raw)).toBe(expected);
  });

  it('normalises payslip rows with the joined user as object or array', () => {
    expect(normalizePayslip({ id: '1', gross_earnings: '1500.50', net_pay: '1200', total_deductions: '300.50', pay_period_start: '2026-10-01', user: { full_name: 'Anna' } }))
      .toMatchObject({ employeeName: 'Anna', gross: 1500.5, net: 1200, deductions: 300.5, status: 'unpaid' });
    expect(normalizePayslip({ id: '2', user: [{ full_name: 'Ben' }] }).employeeName).toBe('Ben');
  });

  it('counts payroll in the month worked (pay period start), excludes cancelled payslips, splits paid and unpaid', () => {
    const result = summarizePayroll([
      payslip({ userId: 'a', gross: 1000, net: 800, status: 'paid' }),
      payslip({ userId: 'b', gross: 500, net: 400 }),
      payslip({ userId: 'c', gross: 9999, net: 9999, status: 'cancelled' }),
      payslip({ userId: 'a', gross: 777, net: 700, periodStart: '2026-09-01', paymentDate: '2026-10-01' }),
      payslip({ userId: 'd', gross: 300, net: 250, periodStart: null, paymentDate: '2026-10-15' })
    ], october);
    expect(result).toEqual({ gross: 1800, deductions: 600, net: 1450, count: 3, employees: 3, paidNet: 800, unpaidNet: 650 });
  });

  it('returns a zero row for months without payslips', () => {
    expect(payrollByMonth([payslip({ gross: 10 })], ['2026-09', '2026-10']).map(r => r.gross)).toEqual([0, 10]);
  });

  it('relates payroll to revenue per month, with no ratio when nothing was billed', () => {
    const rows = payrollVsRevenue(
      [invoice({ issueDate: '2026-10-02', total: 4000 })],
      [payslip({ gross: 1000 }), payslip({ gross: 600, periodStart: '2026-09-01' })],
      ['2026-09', '2026-10']
    );
    expect(rows).toEqual([
      { monthKey: '2026-09', revenue: 0, payroll: 600, ratio: null },
      { monthKey: '2026-10', revenue: 4000, payroll: 1000, ratio: 0.25 }
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Practice expenses
// ---------------------------------------------------------------------------------------------

describe('practice expenses', () => {
  const october: DateRange = { startKey: '2026-10-01', endKey: '2026-10-31' };

  it('normalises statuses (blank is pending, US spelling of cancelled is cancelled)', () => {
    expect(normalizeExpense({ id: '1', status: 'PAID', amount: '120.5' })).toMatchObject({ status: 'paid', amount: 120.5 });
    expect(normalizeExpense({ id: '2', status: null }).status).toBe('pending');
    expect(normalizeExpense({ id: '3', status: 'canceled' }).status).toBe('cancelled');
  });

  it('totals expenses incurred in the period by expense date, excluding cancelled, with paid and unpaid parts', () => {
    const result = summarizeExpenses([
      expense({ type: 'rent', amount: 5000, status: 'paid' }),
      expense({ type: 'utilities', amount: 800 }),
      expense({ type: 'utilities', amount: 200, status: 'overdue' }),
      expense({ type: 'rent', amount: 9999, status: 'cancelled' }),
      expense({ type: 'rent', amount: 5000, expenseDate: '2026-09-30' })
    ], october);
    expect(result).toEqual({
      total: 6000,
      paid: 5000,
      unpaid: 1000,
      count: 3,
      byType: [{ type: 'rent', amount: 5000, count: 1 }, { type: 'utilities', amount: 1000, count: 2 }]
    });
  });

  it('groups expenses by month', () => {
    expect(expensesByMonth([expense({ amount: 10 }), expense({ amount: 5, expenseDate: '2026-09-15', status: 'paid' })], ['2026-09', '2026-10']))
      .toEqual([{ monthKey: '2026-09', total: 5, paid: 5, count: 1 }, { monthKey: '2026-10', total: 10, paid: 0, count: 1 }]);
  });

  it('treats unpaid, already-incurred expenses as payables and flags those past their due date', () => {
    const result = accountsPayable([
      expense({ amount: 100, dueDate: '2026-10-01' }),
      expense({ amount: 50, dueDate: '2026-10-06' }),
      expense({ amount: 25, status: 'overdue' }),
      expense({ amount: 999, status: 'paid' }),
      expense({ amount: 999, status: 'cancelled' }),
      expense({ amount: 999, expenseDate: '2026-11-01', status: 'scheduled' })
    ], '2026-10-06');
    expect(result).toEqual({ total: 175, count: 3, overdue: 125, overdueCount: 2 });
  });
});

// ---------------------------------------------------------------------------------------------
// Inventory and equipment
// ---------------------------------------------------------------------------------------------

describe('inventory valuation', () => {
  it.each([
    ['quantity x unit cost', { quantity: 10, unitCost: 25.5, recordedValue: 0 }, 255],
    ['current stock beats a stale stored total', { quantity: 4, unitCost: 25, recordedValue: 250 }, 100],
    ['stored total when no unit cost is recorded', { quantity: 3, unitCost: 0, recordedValue: 1200 }, 1200],
    ['negative stock counts as none', { quantity: -5, unitCost: 10, recordedValue: 0 }, 0],
    ['negative stored total is ignored', { quantity: 0, unitCost: 0, recordedValue: -40 }, 0],
    ['fractional quantities to the cent', { quantity: 2.5, unitCost: 3.33, recordedValue: 0 }, 8.33]
  ])('%s', (_label, values, expected) => {
    expect(inventoryItemValue(values)).toBe(expected);
  });

  it.each([
    ['2026-10-05', true],
    ['2026-10-06', false],
    ['2026-10-07', false],
    [null, false]
  ])('expiry %s as at 6 Oct: expired = %s (usable on its expiry date)', (expiryDate, expected) => {
    expect(isExpired({ expiryDate }, '2026-10-06')).toBe(expected);
  });

  it.each([
    ['2026-10-06', true],
    ['2026-11-05', true],
    ['2026-11-06', false],
    ['2026-10-01', false],
    [null, false]
  ])('expiry %s is "expiring within 30 days": %s (already expired items are not "soon")', (expiryDate, expected) => {
    expect(isExpiringSoon({ expiryDate }, '2026-10-06')).toBe(expected);
  });

  it.each([
    [5, null, false],
    [5, 5, true],
    [4, 5, true],
    [6, 5, false]
  ])('quantity %s with reorder level %s is low stock: %s', (quantity, reorderLevel, expected) => {
    expect(isLowStock({ quantity, reorderLevel })).toBe(expected);
  });

  it('normalises rows: a reorder level of 0 means "not set"', () => {
    expect(normalizeInventoryItem({ id: '1', reorder_level: 0, quantity: '3', unit_cost: '9.99' })).toMatchObject({ reorderLevel: null, quantity: 3, unitCost: 9.99 });
  });

  it('values stock and equipment by category and highlights expired, expiring and low stock', () => {
    const valuation = valueInventory([
      item({ category: 'equipment', name: 'Laptop', quantity: 2, unitCost: 9000 }),
      item({ category: 'medications', quantity: 10, unitCost: 20, expiryDate: '2026-09-30' }),
      item({ category: 'medications', quantity: 5, unitCost: 10, expiryDate: '2026-10-20', reorderLevel: 5 }),
      item({ category: 'disposables', quantity: 100, unitCost: 1.5 })
    ], '2026-10-06');
    expect(valuation).toMatchObject({
      total: 18400,
      count: 4,
      equipmentValue: 18000,
      stockValue: 400,
      expiredValue: 200,
      expiredCount: 1,
      expiringSoonValue: 50,
      expiringSoonCount: 1,
      lowStockCount: 1
    });
    expect(valuation.byCategory.map(c => [c.category, c.value, c.count])).toEqual([
      ['equipment', 18000, 1],
      ['medications', 250, 2],
      ['disposables', 150, 1]
    ]);
  });
});
