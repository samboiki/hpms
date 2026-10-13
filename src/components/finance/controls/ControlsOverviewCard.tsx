import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { addDays, format, parseISO } from 'date-fns';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  closedMonths,
  formatMonth,
  previousMonthKey,
  promiseStatus,
  toCents,
  toDateKey,
  type PaymentPromise
} from '../../../services/ledgerService';
import type { FinanceDerived } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { DebtorsView, NavigateFn } from '../financeNav';
import { SectionCard } from '../FinanceUI';
import { loadCashedUpDays, loadCloses } from './controlsService';
import { loadCreditControl } from '../debtors/debtorsService';
import { PlanInstalmentsControlLine } from '../../billingExtras/PlanInstalmentsControlLine';

interface Status {
  monthClosed: boolean | null;
  lastClosed: string | null;
  todayCashedUp: boolean | null;
  yesterdayCashedUp: boolean | null;
  promises: PaymentPromise[];
}

/** One status line: done, needs doing (with where to do it), or still checking */
const Line: React.FC<{ ok: boolean | null; text: string; action?: { label: string; onClick: () => void } }> = ({ ok, text, action }) => (
  <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
    <Icon
      icon={ok === null ? 'solar:hourglass-bold-duotone' : ok ? 'solar:check-circle-bold-duotone' : 'solar:danger-triangle-bold-duotone'}
      className={`h-5 w-5 flex-shrink-0 ${ok === null ? 'text-gray-400' : ok ? 'text-green-600' : 'text-amber-600'}`}
      aria-hidden="true"
    />
    <span className="min-w-0 flex-1 text-gray-800">{text}</span>
    {action && (
      <button type="button" onClick={action.onClick} className="rounded-md px-2 py-1 text-sm font-medium text-cyan-700 hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-500">
        {action.label}
      </button>
    )}
  </li>
);

interface ControlsOverviewCardProps {
  workspace: FinanceWorkspace;
  derived: FinanceDerived;
  onNavigate: NavigateFn;
  /** Opens Debtors on a view (the credit control work list for promises, the age analysis), when Finance has that tab */
  onOpenDebtors?: (view: DebtorsView) => void;
  /** Something posted from here (payment plan instalments): Finance reloads its figures */
  onChanged?: () => void;
}

/**
 * Today's controls on the Overview: is last month closed, is today (and yesterday) cashed up, which
 * promises to pay fall due today, and how much is owed for 90 days or more. Each line goes where
 * the work is. Shown once receipts are in use; quiet before the debtors proposal is applied.
 */
export const ControlsOverviewCard: React.FC<ControlsOverviewCardProps> = ({ workspace, derived, onNavigate, onOpenDebtors, onChanged }) => {
  const [todayKey] = useState(() => toDateKey(new Date()));
  const [status, setStatus] = useState<Status | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);
  // The checks could not be read: say so instead of "Checking..." for ever
  const [failed, setFailed] = useState(false);
  const receiptsReady = workspace.ar?.state === 'ready';

  useEffect(() => {
    if (!receiptsReady) return;
    let cancelled = false;
    const yesterdayKey = toDateKey(addDays(parseISO(todayKey), -1));
    (async () => {
      const closes = await loadCloses(workspace.practiceId);
      if (closes.state === 'not_set_up') {
        if (!cancelled) setNotSetUp(true);
        return;
      }
      const [days, credit] = await Promise.all([
        loadCashedUpDays(workspace.practiceId, { startKey: yesterdayKey, endKey: todayKey }),
        loadCreditControl(workspace.practiceId, toDateKey(addDays(parseISO(todayKey), -60)))
      ]);
      if (cancelled) return;
      const inForce = closedMonths(closes.closes);
      const lastMonth = previousMonthKey(todayKey.slice(0, 7));
      setStatus({
        monthClosed: inForce.has(lastMonth),
        lastClosed: [...inForce.keys()].sort().pop() ?? null,
        todayCashedUp: days.has(todayKey),
        yesterdayCashedUp: days.has(yesterdayKey),
        promises: credit.promises
      });
    })().catch(error => {
      console.warn('Finance: controls status unavailable', error);
      if (!cancelled) setFailed(true);
    });
    return () => { cancelled = true; };
  }, [receiptsReady, workspace.practiceId, todayKey]);

  const over90 = useMemo(
    () => derived.aging.items.reduce((sum, item) => (item.ageDays === null || item.ageDays >= 90 ? sum + toCents(item.amount) : sum), 0),
    [derived.aging.items]
  );
  const promisesDue = useMemo(() => {
    if (!status || !receiptsReady || !workspace.ar) return { today: 0, broken: 0 };
    const receipts = workspace.ar.receipts;
    let today = 0, broken = 0;
    for (const promise of status.promises) {
      const state = promiseStatus(promise, receipts, todayKey).state;
      if (state === 'due_today') today += 1;
      if (state === 'broken' && promise.promisedOn >= toDateKey(addDays(parseISO(todayKey), -7))) broken += 1;
    }
    return { today, broken };
  }, [status, receiptsReady, workspace.ar, todayKey]);

  if (!receiptsReady || notSetUp) return null;
  const lastMonth = previousMonthKey(todayKey.slice(0, 7));

  return (
    <SectionCard title="Daily and month-end controls" subtitle={`As at ${format(parseISO(todayKey), 'd MMM yyyy')}`} icon="solar:shield-check-bold-duotone" tone="green">
      <ul className="divide-y divide-gray-100">
        <Line
          ok={status ? status.monthClosed : failed ? false : null}
          text={!status ? (failed ? 'The month end and day end could not be checked: refresh Finance to try again.' : 'Checking the month end...') : status.monthClosed ? `${formatMonth(lastMonth)} is closed` : `${formatMonth(lastMonth)} is not closed yet${status.lastClosed ? ` (last closed: ${formatMonth(status.lastClosed)})` : ''}`}
          action={status && !status.monthClosed ? { label: 'Month end', onClick: () => onNavigate({ tab: 'reports' }) } : undefined}
        />
        <Line
          ok={status ? status.yesterdayCashedUp : null}
          text={!status ? (failed ? "Yesterday's cash-up could not be checked" : 'Checking the day end...') : status.yesterdayCashedUp ? 'Yesterday is cashed up' : 'Yesterday is not cashed up'}
          action={status && !status.yesterdayCashedUp ? { label: 'Day end', onClick: () => onNavigate({ tab: 'payments', paymentsView: 'day_end' }) } : undefined}
        />
        <Line
          ok={status?.todayCashedUp ? true : null}
          text={!status ? '' : status.todayCashedUp ? 'Today is cashed up' : 'Today is not cashed up yet (close it at the end of the day)'}
          action={status && !status.todayCashedUp ? { label: 'Day end', onClick: () => onNavigate({ tab: 'payments', paymentsView: 'day_end' }) } : undefined}
        />
        <Line
          ok={status ? promisesDue.today === 0 && promisesDue.broken === 0 : null}
          text={`Promises to pay: ${promisesDue.today} due today, ${promisesDue.broken} broken this week`}
          action={onOpenDebtors && (promisesDue.today > 0 || promisesDue.broken > 0) ? { label: 'Follow up', onClick: () => onOpenDebtors('credit') } : undefined}
        />
        <Line
          ok={over90 === 0}
          text={`${formatNad(fromCents(over90))} is owed on invoices 90 days or older`}
          action={over90 > 0 ? { label: 'Age analysis', onClick: onOpenDebtors ? () => onOpenDebtors('ages') : () => onNavigate({ tab: 'reports' }) } : undefined}
        />
        {/* Payment plan instalments due and not posted yet, with Post due instalments (parity D16; shown only then) */}
        <PlanInstalmentsControlLine practiceId={workspace.practiceId} onPosted={onChanged} />
      </ul>
    </SectionCard>
  );
};
