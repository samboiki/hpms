import { fromCents, toAmount, toCents } from './money';
import { isInRange, monthKeyOf, monthKeysInRange, type DateRange } from './dates';
import { isPayrollCost, payslipDateKey, type LedgerPayslip } from './payroll';

// ---------------------------------------------------------------------------------------------
// Statutory payroll totals (PAYE, Social Security, pension) from payslip lines
// ---------------------------------------------------------------------------------------------

export type PayslipLineType = 'earning' | 'deduction' | 'company_contribution';

/** payslip_items columns the Finance page reads */
export interface RawPayslipItemRow {
  payslip_id?: string | null;
  component_name?: string | null;
  type?: string | null;
  amount?: number | string | null;
}

/** The JSON line columns older payslips carry instead of payslip_items: [{ name, amount, isCompanyContribution? }] */
export interface RawPayslipDetailsRow {
  id: string;
  earnings_details?: unknown;
  deductions_details?: unknown;
}

export interface LedgerPayslipLine {
  payslipId: string;
  name: string;
  type: PayslipLineType;
  amount: number;
}

const LINE_TYPES: readonly string[] = ['earning', 'deduction', 'company_contribution'];
const isLineType = (value: string): value is PayslipLineType => LINE_TYPES.includes(value);

interface DetailLine {
  name: string;
  amount: unknown;
  isCompanyContribution: boolean;
}

/** Entries of an earnings_details / deductions_details array; anything that is not a line is ignored */
function detailLines(value: unknown): DetailLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const line = entry as Record<string, unknown>;
    return [{
      name: typeof line.name === 'string' ? line.name.trim() : '',
      amount: line.amount,
      isCompanyContribution: line.isCompanyContribution === true
    }];
  });
}

/**
 * Every payslip's lines as its printed payslip shows them (PayrollService.getPayslipWithItems):
 * the payslip_items rows when the payslip has any, otherwise the JSON details older payslips keep.
 */
export function payslipLinesFrom(items: RawPayslipItemRow[], details: RawPayslipDetailsRow[]): LedgerPayslipLine[] {
  const lines: LedgerPayslipLine[] = [];
  const itemised = new Set<string>();
  for (const item of items) {
    if (!item.payslip_id) continue;
    itemised.add(item.payslip_id);
    const type = (item.type ?? '').trim().toLowerCase();
    if (!isLineType(type)) continue;
    lines.push({ payslipId: item.payslip_id, name: (item.component_name ?? '').trim(), type, amount: toAmount(item.amount) });
  }
  for (const row of details) {
    if (itemised.has(row.id)) continue;
    detailLines(row.earnings_details).forEach(line => lines.push({
      payslipId: row.id,
      name: line.name,
      type: line.isCompanyContribution ? 'company_contribution' : 'earning',
      amount: toAmount(line.amount)
    }));
    detailLines(row.deductions_details).forEach(line => lines.push({ payslipId: row.id, name: line.name, type: 'deduction', amount: toAmount(line.amount) }));
  }
  return lines;
}

export type DeductionCategory = 'paye' | 'ssc' | 'pension' | 'medical_aid' | 'other';

/**
 * Checked in this order, so "Pension (pre-tax)" is pension and "Social Security" is never tax.
 * Payroll writes 'Tax (PAYE)', 'Social Security (SSC)' and the employer's 'Social Security
 * (employer)'; older payslips have free-text names, so common variants are matched too, and
 * medical aid also matches the Namibian fund names staff often use as the deduction name.
 */
const DEDUCTION_PATTERNS: ReadonlyArray<readonly [Exclude<DeductionCategory, 'other'>, RegExp]> = [
  ['ssc', /social\s*security|\bssc\b|\bsocsec\b/i],
  ['pension', /pension|provident|retirement|\bgipf\b/i],
  ['medical_aid', /medical\s*aid|\bmed\s*aid\b|\bmedaid\b|medical\s*(scheme|fund|insurance|cover)|health\s*(insurance|plan|cover)|namibia\s*(health|medical)|\bnhp\b|\bnmc\b|\bpsemas\b|nammed|renaissance/i],
  ['paye', /\bpaye\b|pay[\s-]*as[\s-]*you[\s-]*earn|\btax(es|ation)?\b/i]
];

/** Which statutory or benefit bucket a payslip deduction belongs to, by its name on the payslip. */
export function classifyDeduction(name: string): DeductionCategory {
  const match = DEDUCTION_PATTERNS.find(([, pattern]) => pattern.test(name));
  return match ? match[0] : 'other';
}

export interface StatutoryMonthRow {
  monthKey: string;
  payslips: number;
  employees: number;
  /** Gross pay as on the payslips (gross_earnings) */
  gross: number;
  paye: number;
  sscEmployee: number;
  /** Employer contribution lines named Social Security */
  sscEmployer: number;
  pension: number;
  medicalAid: number;
  /** Other deductions, plus all deductions of payslips that have no deduction lines */
  otherDeductions: number;
  /** Net pay as on the payslips (net_pay) */
  net: number;
  /** Payslips with deductions but no lines at all: their total deductions are in otherDeductions */
  unitemisedPayslips: number;
  /** gross - deductions - net; not zero when payslip lines do not add up to the payslip totals */
  difference: number;
}

type StatutoryCents = Omit<StatutoryMonthRow, 'monthKey' | 'employees'> & { employees: Set<string> };

const emptyMonth = (): StatutoryCents => ({
  payslips: 0, employees: new Set<string>(), gross: 0, paye: 0, sscEmployee: 0, sscEmployer: 0, pension: 0,
  medicalAid: 0, otherDeductions: 0, net: 0, unitemisedPayslips: 0, difference: 0
});

const DEDUCTION_FIELD: Record<DeductionCategory, 'paye' | 'sscEmployee' | 'pension' | 'medicalAid' | 'otherDeductions'> = {
  paye: 'paye',
  ssc: 'sscEmployee',
  pension: 'pension',
  medical_aid: 'medicalAid',
  other: 'otherDeductions'
};

/**
 * Monthly payroll totals for the statutory returns: one row per month the range touches, from
 * uncancelled payslips counted in the month their pay period starts (as all payroll figures are).
 * Deductions are split by name; employer Social Security comes from company contribution lines.
 */
export function statutoryPayrollByMonth(payslips: LedgerPayslip[], lines: LedgerPayslipLine[], range: DateRange): StatutoryMonthRow[] {
  const linesBySlip = new Map<string, LedgerPayslipLine[]>();
  for (const line of lines) {
    const slipLines = linesBySlip.get(line.payslipId);
    if (slipLines) slipLines.push(line);
    else linesBySlip.set(line.payslipId, [line]);
  }
  const months = new Map(monthKeysInRange(range).map(key => [key, emptyMonth()]));

  for (const payslip of payslips) {
    const dateKey = payslipDateKey(payslip);
    if (!isPayrollCost(payslip) || !dateKey || !isInRange(dateKey, range)) continue;
    const month = months.get(monthKeyOf(dateKey));
    if (!month) continue;
    month.payslips += 1;
    month.employees.add(payslip.userId ?? payslip.employeeName);
    month.gross += toCents(payslip.gross);
    month.net += toCents(payslip.net);

    const slipLines = linesBySlip.get(payslip.id) ?? [];
    let deductions = 0;
    if (slipLines.length === 0) {
      deductions = toCents(payslip.deductions);
      month.otherDeductions += deductions;
      if (deductions !== 0) month.unitemisedPayslips += 1;
    }
    for (const line of slipLines) {
      const cents = toCents(line.amount);
      if (line.type === 'deduction') {
        month[DEDUCTION_FIELD[classifyDeduction(line.name)]] += cents;
        deductions += cents;
      } else if (line.type === 'company_contribution' && classifyDeduction(line.name) === 'ssc') {
        month.sscEmployer += cents;
      }
    }
    month.difference += toCents(payslip.gross) - deductions - toCents(payslip.net);
  }

  return [...months.entries()].map(([monthKey, month]) => ({
    monthKey,
    payslips: month.payslips,
    employees: month.employees.size,
    gross: fromCents(month.gross),
    paye: fromCents(month.paye),
    sscEmployee: fromCents(month.sscEmployee),
    sscEmployer: fromCents(month.sscEmployer),
    pension: fromCents(month.pension),
    medicalAid: fromCents(month.medicalAid),
    otherDeductions: fromCents(month.otherDeductions),
    net: fromCents(month.net),
    unitemisedPayslips: month.unitemisedPayslips,
    difference: fromCents(month.difference)
  }));
}
