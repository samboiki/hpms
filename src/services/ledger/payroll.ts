import { fromCents, shareOf, toAmount, toCents } from './money';
import { dateKeyFrom, isInRange, monthKeyOf, type DateRange } from './dates';
import { CANCELLED_ALIASES, monthlyRevenue, type LedgerInvoice } from './invoices';

// ---------------------------------------------------------------------------------------------
// Payroll (payslips)
// ---------------------------------------------------------------------------------------------

export interface RawPayslipRow {
  id: string;
  user_id?: string | null;
  pay_period_start?: string | null;
  pay_period_end?: string | null;
  payment_date?: string | null;
  gross_earnings?: number | string | null;
  total_deductions?: number | string | null;
  net_pay?: number | string | null;
  status?: string | null;
  user?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}

export type PayslipStatus = 'paid' | 'unpaid' | 'cancelled';

export interface LedgerPayslip {
  id: string;
  userId: string | null;
  employeeName: string;
  periodStart: string | null;
  periodEnd: string | null;
  paymentDate: string | null;
  gross: number;
  deductions: number;
  net: number;
  status: PayslipStatus;
}

/** Generated payslips start 'unpaid' (older rows 'draft'/'approved'): all of those are unpaid. */
export function normalizePayslipStatus(status: string | null | undefined): PayslipStatus {
  const value = (status ?? '').trim().toLowerCase();
  if (value === 'paid') return 'paid';
  if (CANCELLED_ALIASES.includes(value)) return 'cancelled';
  return 'unpaid';
}

export function normalizePayslip(row: RawPayslipRow): LedgerPayslip {
  const user = Array.isArray(row.user) ? row.user[0] : row.user;
  return {
    id: row.id,
    userId: row.user_id ?? null,
    employeeName: user?.full_name?.trim() || 'Unnamed employee',
    periodStart: dateKeyFrom(row.pay_period_start),
    periodEnd: dateKeyFrom(row.pay_period_end),
    paymentDate: dateKeyFrom(row.payment_date),
    gross: toAmount(row.gross_earnings),
    deductions: toAmount(row.total_deductions),
    net: toAmount(row.net_pay),
    status: normalizePayslipStatus(row.status)
  };
}

/** Payroll is an expense of the period worked: the pay period start (else the payment date). */
export const payslipDateKey = (payslip: Pick<LedgerPayslip, 'periodStart' | 'paymentDate'>): string | null =>
  payslip.periodStart ?? payslip.paymentDate;

export const isPayrollCost = (payslip: Pick<LedgerPayslip, 'status'>): boolean => payslip.status !== 'cancelled';

export interface PayrollSummary {
  gross: number;
  deductions: number;
  net: number;
  count: number;
  employees: number;
  paidNet: number;
  unpaidNet: number;
}

export function summarizePayroll(payslips: LedgerPayslip[], range: DateRange): PayrollSummary {
  let gross = 0, deductions = 0, net = 0, paidNet = 0, count = 0;
  const employees = new Set<string>();
  for (const payslip of payslips) {
    if (!isPayrollCost(payslip) || !isInRange(payslipDateKey(payslip), range)) continue;
    gross += toCents(payslip.gross);
    deductions += toCents(payslip.deductions);
    net += toCents(payslip.net);
    if (payslip.status === 'paid') paidNet += toCents(payslip.net);
    count += 1;
    employees.add(payslip.userId ?? payslip.employeeName);
  }
  return {
    gross: fromCents(gross),
    deductions: fromCents(deductions),
    net: fromCents(net),
    count,
    employees: employees.size,
    paidNet: fromCents(paidNet),
    unpaidNet: fromCents(net - paidNet)
  };
}

export interface PayrollMonthRow {
  monthKey: string;
  gross: number;
  deductions: number;
  net: number;
  count: number;
}

export function payrollByMonth(payslips: LedgerPayslip[], monthKeys: string[]): PayrollMonthRow[] {
  const rows = new Map(monthKeys.map(key => [key, { gross: 0, deductions: 0, net: 0, count: 0 }]));
  for (const payslip of payslips) {
    const dateKey = payslipDateKey(payslip);
    const row = dateKey ? rows.get(monthKeyOf(dateKey)) : undefined;
    if (!row || !isPayrollCost(payslip)) continue;
    row.gross += toCents(payslip.gross);
    row.deductions += toCents(payslip.deductions);
    row.net += toCents(payslip.net);
    row.count += 1;
  }
  return monthKeys.map(monthKey => {
    const row = rows.get(monthKey)!;
    return { monthKey, gross: fromCents(row.gross), deductions: fromCents(row.deductions), net: fromCents(row.net), count: row.count };
  });
}

export interface PayrollVsRevenueRow {
  monthKey: string;
  revenue: number;
  payroll: number;
  /** payroll / revenue; null when nothing was billed that month */
  ratio: number | null;
}

export function payrollVsRevenue(invoices: LedgerInvoice[], payslips: LedgerPayslip[], monthKeys: string[]): PayrollVsRevenueRow[] {
  const payroll = payrollByMonth(payslips, monthKeys);
  return monthlyRevenue(invoices, monthKeys).map((row, i) => ({
    monthKey: row.monthKey,
    revenue: row.billed,
    payroll: payroll[i].gross,
    ratio: shareOf(payroll[i].gross, row.billed)
  }));
}
