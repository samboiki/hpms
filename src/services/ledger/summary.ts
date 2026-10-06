import { fromCents, toCents } from './money';

// ---------------------------------------------------------------------------------------------
// Summary ("trial balance" style, derived from HPMS records)
// ---------------------------------------------------------------------------------------------

export interface FinanceSummaryInput {
  income: number;
  /** null when practice expenses could not be loaded */
  practiceExpenses: number | null;
  /** null when payroll could not be loaded */
  payroll: number | null;
  receivables: number;
  payables: number | null;
  inventory: number | null;
}

export interface FinanceSummary extends FinanceSummaryInput {
  /** income - expenses - payroll; null unless every part is known */
  netResult: number | null;
}

export function buildFinanceSummary(input: FinanceSummaryInput): FinanceSummary {
  const netResult = input.practiceExpenses === null || input.payroll === null
    ? null
    : fromCents(toCents(input.income) - toCents(input.practiceExpenses) - toCents(input.payroll));
  return { ...input, netResult };
}
