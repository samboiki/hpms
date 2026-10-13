import { useCallback, useMemo, useState } from 'react';
import { getPeriodRanges, monthKeysEndingAt, toDateKey, type PeriodSelection } from '../../services/ledgerService';
import { deriveFinance, type FinanceDerived } from './deriveFinance';
import { financeRequestKey, type FinanceLoadRequest, type FinanceWorkspace } from './financeData';
import { formatDateKey, formatRangeLabel } from './financeFormat';
import type { PeriodLabels } from './financeNav';
import { useFinanceWorkspace } from './useFinanceWorkspace';
import { useAuthStore } from '../../stores/authStore';
import { isStaffAdmin } from '../settings/UserManagement/staffUtils';

const TREND_MONTHS = 12;

export interface FinancePageState {
  practiceId: string | null;
  period: PeriodSelection;
  setPeriod: (selection: PeriodSelection) => void;
  labels: PeriodLabels;
  /** Data for the current practice and period only (null while a different window loads) */
  workspace: FinanceWorkspace | null;
  derived: FinanceDerived | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Period selection, practice-scoped data and every derived figure for the Finance page */
export function useFinancePage(practiceId: string | null): FinancePageState {
  const [period, setPeriod] = useState<PeriodSelection>({ preset: 'this_month' });
  const [now, setNow] = useState(() => new Date());
  // Payslips: administrators see the practice's payroll, everyone else only their own (owner, 13 Oct 2026)
  const includePayroll = isStaffAdmin(useAuthStore(state => state.user));

  const ranges = useMemo(() => getPeriodRanges(period, now), [period, now]);
  const todayKey = toDateKey(now);
  const periodEndKey = ranges.current.endKey;
  const trendMonths = useMemo(() => monthKeysEndingAt(periodEndKey, TREND_MONTHS), [periodEndKey]);

  const request: FinanceLoadRequest | null = useMemo(() => {
    if (!practiceId) return null;
    const trendStartKey = `${trendMonths[0]}-01`;
    return {
      practiceId,
      windowStartKey: ranges.previous.startKey < trendStartKey ? ranges.previous.startKey : trendStartKey,
      lineItemRange: ranges.current,
      includePayroll
    };
  }, [practiceId, ranges, trendMonths, includePayroll]);

  const { data, loading, error, reload } = useFinanceWorkspace(request);
  // Never pair new period ranges with data loaded for another window: that would show wrong totals
  const workspace = data && request && data.requestKey === financeRequestKey(request) ? data : null;

  const derived = useMemo(
    () => (workspace ? deriveFinance(workspace, { ranges, todayKey, trendMonths }) : null),
    [workspace, ranges, todayKey, trendMonths]
  );

  const labels: PeriodLabels = useMemo(() => ({
    ranges,
    current: formatRangeLabel(ranges.current),
    previous: formatRangeLabel(ranges.previous),
    today: formatDateKey(todayKey),
    todayKey
  }), [ranges, todayKey]);

  const refresh = useCallback(() => {
    const next = new Date();
    // After midnight "today" moves on; if that changes the periods, their own load supersedes this one
    if (toDateKey(next) !== todayKey) setNow(next);
    void reload();
  }, [reload, todayKey]);

  return { practiceId, period, setPeriod, labels, workspace, derived, loading, error, refresh };
}
