import type { AgingBucket, PeriodRanges } from '../../services/ledgerService';
import type { FinanceTab } from './FinanceTabBar';

export type LedgerView = 'summary' | 'receivables' | 'revenue' | 'collections' | 'payroll' | 'expenses' | 'inventory';

/** Where a drill-down should take the user (e.g. an aging bar opens the receivables ledger) */
export interface FinanceNavigation {
  tab: FinanceTab;
  ledger?: LedgerView;
  agingBucket?: AgingBucket | null;
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
