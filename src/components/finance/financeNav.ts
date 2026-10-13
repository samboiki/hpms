import type { AgeAnalysisFilter, AgingBucket, PeriodRanges } from '../../services/ledgerService';
import type { FinanceTab } from './FinanceTabBar';

export type LedgerView = 'summary' | 'receivables' | 'revenue' | 'collections' | 'payroll' | 'expenses' | 'inventory';

/** The views of Finance > Payments: receipts, the day end (cash-up and deposit slips) and the daybook */
export type PaymentsView = 'receipts' | 'day_end' | 'daybook';

/** The views of Finance > Debtors */
export type DebtorsView = 'ages' | 'credit' | 'statements' | 'interest' | 'small' | 'companies';

const LEDGER_VIEWS: readonly LedgerView[] = ['summary', 'receivables', 'revenue', 'collections', 'payroll', 'expenses', 'inventory'];
const DEBTORS_VIEWS: readonly DebtorsView[] = ['ages', 'credit', 'statements', 'interest', 'small', 'companies'];

/** A link's ?view= for Ledgers (e.g. expenses, where a supplier's invoice is a payable) */
export const isLedgerView = (value: string | null): value is LedgerView => value !== null && (LEDGER_VIEWS as readonly string[]).includes(value);
/** A link's ?view= for Debtors (e.g. companies, or the credit control work list) */
export const isDebtorsView = (value: string | null): value is DebtorsView => value !== null && (DEBTORS_VIEWS as readonly string[]).includes(value);

/** Where a drill-down should take the user (e.g. an aging bar opens the receivables ledger) */
export interface FinanceNavigation {
  tab: FinanceTab;
  ledger?: LedgerView;
  agingBucket?: AgingBucket | null;
  paymentsView?: PaymentsView;
  debtorsView?: DebtorsView;
  /** Debtors > Age analysis opened on a grouping (e.g. per medical aid fund, what the funds owe) */
  ageFilter?: Partial<AgeAnalysisFilter>;
}

export type NavigateFn = (target: FinanceNavigation) => void;

/** Period labels shown on every tab */
export interface PeriodLabels {
  ranges: PeriodRanges;
  /** e.g. "1-6 Oct 2026" */
  current: string;
  /** e.g. "1-6 Sep 2026" */
  previous: string;
  /** e.g. "6 Oct 2026" */
  today: string;
  todayKey: string;
}
