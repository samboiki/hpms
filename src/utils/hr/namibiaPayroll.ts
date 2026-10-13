import { format } from 'date-fns';
import { fromCents, toCents } from '../billing/money';

/**
 * Individual income tax table (Income Tax Act; NamRA), from the tax year starting 1 March 2024.
 * The same rates apply in 2025/26 and 2026/27. Earlier tables are not included.
 */
export const NAMIBIA_TAX_TABLE_FROM = '2024-03-01';
const TAX_BANDS: Array<{ over: number; base: number; rate: number }> = [
  { over: 1_550_000, base: 429_000, rate: 0.37 },
  { over: 850_000, base: 205_000, rate: 0.32 },
  { over: 550_000, base: 115_000, rate: 0.30 },
  { over: 350_000, base: 59_000, rate: 0.28 },
  { over: 150_000, base: 9_000, rate: 0.25 },
  { over: 100_000, base: 0, rate: 0.18 }
];

/** Pension, provident and retirement annuity contributions reduce taxable income by up to this much a year */
export const MAX_ANNUAL_RETIREMENT_DEDUCTION = 150_000;

/** Social Security (maternity, sick leave and death benefits): 0.9% each for employee and employer, on basic wage up to a ceiling */
export const SSC_RATE = 0.009;
const SSC_CEILINGS: Array<{ from: string; ceiling: number }> = [
  { from: '2025-03-01', ceiling: 11_000 }, // Government Notice 8461
  { from: '0000-01-01', ceiling: 9_000 }
];

const roundCents = (value: number): number => fromCents(toCents(value));

/** Annual income tax on a year's taxable income */
export function annualIncomeTax(taxableIncome: number): number {
  if (!(taxableIncome > 0)) return 0;
  const band = TAX_BANDS.find(item => taxableIncome > item.over);
  if (!band) return 0;
  return roundCents(band.base + (taxableIncome - band.over) * band.rate);
}

export interface PayeResult {
  amount: number;
  annualTaxableIncome: number;
  annualTax: number;
}

/**
 * PAYE for a month by the annual-equivalent method: this month's taxable pay less deductible retirement
 * contributions, times 12, taxed with the annual table, divided by 12. Returns null for periods before the
 * table above applies, so an old period is never taxed with the wrong table.
 */
export function monthlyPaye(params: {
  taxableMonthlyEarnings: number;
  monthlyRetirementContributions: number;
  payPeriodEnd: Date;
}): PayeResult | null {
  if (format(params.payPeriodEnd, 'yyyy-MM-dd') < NAMIBIA_TAX_TABLE_FROM) return null;
  const deductible = Math.min(Math.max(params.monthlyRetirementContributions, 0) * 12, MAX_ANNUAL_RETIREMENT_DEDUCTION);
  const annualTaxableIncome = Math.max(params.taxableMonthlyEarnings * 12 - deductible, 0);
  const annualTax = annualIncomeTax(annualTaxableIncome);
  return { amount: roundCents(annualTax / 12), annualTaxableIncome: roundCents(annualTaxableIncome), annualTax };
}

/** One party's monthly Social Security contribution (employee and employer each pay this) */
export function socialSecurityContribution(basicMonthlyWage: number, payPeriodEnd: Date): number {
  if (!(basicMonthlyWage > 0)) return 0;
  const periodKey = format(payPeriodEnd, 'yyyy-MM-dd');
  const { ceiling } = SSC_CEILINGS.find(item => periodKey >= item.from) ?? SSC_CEILINGS[SSC_CEILINGS.length - 1];
  return roundCents(Math.min(basicMonthlyWage, ceiling) * SSC_RATE);
}

export interface PayLine {
  name: string;
  code?: string;
  amount: number;
  isCompanyContribution?: boolean;
  taxable?: boolean;
}

const PAYE_LINE = /\b(paye|income tax|tax)\b/i;
const SSC_LINE = /social\s*security|\bssc\b/i;
const RETIREMENT_LINE = /pension|provident|retirement/i;
const UNPAID_LEAVE_LINE = /unpaid leave/i;

/**
 * Replaces typed-in PAYE and Social Security lines with amounts worked out from the law, and adds the employer's
 * Social Security contribution. Taxable pay is the basic salary plus every earning that is not a company
 * contribution and not marked non-taxable; employee pension, provident and retirement annuity deductions reduce it.
 */
export function applyNamibianStatutoryDeductions(input: {
  basicSalary: number;
  earnings: PayLine[];
  deductions: PayLine[];
  payPeriodEnd: Date;
}): { earnings: PayLine[]; deductions: PayLine[]; paye: PayeResult | null } {
  const otherDeductions = input.deductions.filter(line => !PAYE_LINE.test(line.name) && !SSC_LINE.test(line.name));
  const otherEarnings = input.earnings.filter(line => !(line.isCompanyContribution && SSC_LINE.test(line.name)));

  // Unpaid leave is pay not earned, so it lowers both taxable pay and the basic wage Social Security is based on
  const unpaidLeave = otherDeductions
    .filter(line => line.code === 'UNPAID_LEAVE' || UNPAID_LEAVE_LINE.test(line.name))
    .reduce((sum, line) => sum + line.amount, 0);
  const taxableMonthlyEarnings = input.basicSalary - unpaidLeave + otherEarnings
    .filter(line => !line.isCompanyContribution && line.taxable !== false)
    .reduce((sum, line) => sum + line.amount, 0);
  const monthlyRetirementContributions = otherDeductions
    .filter(line => RETIREMENT_LINE.test(line.name))
    .reduce((sum, line) => sum + line.amount, 0);

  const paye = monthlyPaye({ taxableMonthlyEarnings, monthlyRetirementContributions, payPeriodEnd: input.payPeriodEnd });
  const ssc = socialSecurityContribution(input.basicSalary - unpaidLeave, input.payPeriodEnd);

  // Without a tax table for the period, keep whatever PAYE line was configured rather than dropping tax altogether
  const configuredPaye = input.deductions.filter(line => PAYE_LINE.test(line.name) && !SSC_LINE.test(line.name));

  return {
    paye,
    deductions: [
      ...otherDeductions,
      ...(paye ? (paye.amount > 0 ? [{ name: 'Tax (PAYE)', code: 'PAYE', amount: paye.amount }] : []) : configuredPaye),
      ...(ssc > 0 ? [{ name: 'Social Security (SSC)', code: 'SSC', amount: ssc }] : [])
    ],
    earnings: [
      ...otherEarnings,
      ...(ssc > 0 ? [{ name: 'Social Security (employer)', code: 'SSC_EMPLOYER', amount: ssc, isCompanyContribution: true }] : [])
    ]
  };
}
