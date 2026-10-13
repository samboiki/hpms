import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { isExpenseCost, isInRange, sumAmounts, type ExpenseMonthRow, type LedgerExpense } from '../../../services/ledgerService';
import type { FinanceDerived } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { CHART, expenseTypeLabel } from '../financeTheme';
import { formatCount, formatDateKey, formatMonthKey, formatNad, formatPercent, pluralize } from '../financeFormat';
import { downloadCsv, exportFileName, toCsv } from '../financeExport';
import { ActionButton, EmptyState, ErrorState, MiniStat, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';
import { MonthlyBarChart } from '../charts/MonthlyBarChart';
import { practiceOverheadLink } from '../../billing/invoiceLinks';

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  scheduled: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800'
};

/** Practice overhead (Settings > Practice Overhead) by type and month, with payables */
export const ExpensesLedger: React.FC<{ derived: FinanceDerived; workspace: FinanceWorkspace; labels: PeriodLabels; onRetry: () => void }> = ({ derived, workspace, labels, onRetry }) => {
  const navigate = useNavigate();
  const range = labels.ranges.current;
  const expenses = useMemo(
    () => workspace.expenses.rows
      .filter(e => isExpenseCost(e) && isInRange(e.expenseDate, range))
      .sort((a, b) => (b.expenseDate ?? '').localeCompare(a.expenseDate ?? '')),
    [workspace.expenses.rows, range]
  );

  if (workspace.expenses.error || !derived.expenses || !derived.expensesMonthly || !derived.payables) {
    return <ErrorState title="Practice expenses could not be loaded" message={`${workspace.expenses.error ?? 'Unknown error'}. No expense figures are shown rather than zeros.`} onRetry={onRetry} />;
  }

  const summary = derived.expenses;
  const payables = derived.payables;
  const months = [...derived.expensesMonthly].reverse();
  const largestType = Math.max(...summary.byType.map(t => t.amount), 1);
  const manage = <ActionButton icon="solar:settings-bold-duotone" label="Manage expenses" title="Settings > Practice > Practice Overhead" onClick={() => navigate(practiceOverheadLink())} />;

  const monthColumns: TableColumn<ExpenseMonthRow>[] = [
    { key: 'month', header: 'Month', render: row => <span className="font-medium text-gray-900">{formatMonthKey(row.monthKey, 'MMMM yyyy')}</span> },
    { key: 'count', header: 'Expenses', align: 'right', render: row => formatCount(row.count) },
    { key: 'paid', header: 'Paid', align: 'right', hideBelow: 'sm', render: row => formatNad(row.paid) },
    { key: 'total', header: 'Total', align: 'right', render: row => <span className="font-semibold text-gray-900">{formatNad(row.total)}</span> }
  ];

  const expenseColumns: TableColumn<LedgerExpense>[] = [
    { key: 'date', header: 'Date', render: e => formatDateKey(e.expenseDate) },
    {
      key: 'name',
      header: 'Expense',
      render: e => (
        <div>
          <p className="font-medium text-gray-900 truncate max-w-[240px]">{e.name}</p>
          <p className="text-xs text-gray-500">{expenseTypeLabel(e.type)}{e.isRecurring ? ' · recurring' : ''}</p>
        </div>
      )
    },
    { key: 'vendor', header: 'Supplier', hideBelow: 'md', render: e => e.vendor ?? '—' },
    { key: 'due', header: 'Due', hideBelow: 'lg', render: e => formatDateKey(e.dueDate) },
    { key: 'status', header: 'Status', render: e => <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_BADGE[e.status] ?? 'bg-gray-100 text-gray-700'}`}>{e.status}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: e => <span className="font-semibold text-gray-900">{formatNad(e.amount)}</span> }
  ];

  const exportExpenses = () => downloadCsv(
    exportFileName(`practice expenses ${range.startKey} to ${range.endKey}`),
    toCsv(
      [
        { header: 'Date', type: 'date' },
        { header: 'Expense', type: 'text' },
        { header: 'Type', type: 'text' },
        { header: 'Supplier', type: 'text' },
        { header: 'Due', type: 'date' },
        { header: 'Status', type: 'text' },
        { header: 'Amount', type: 'money' }
      ],
      expenses.map(e => [e.expenseDate, e.name, expenseTypeLabel(e.type), e.vendor, e.dueDate, e.status, e.amount])
    )
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat icon="solar:card-transfer-bold-duotone" label={`Expenses, ${labels.current}`} value={formatNad(summary.total)} tone="red" />
        <MiniStat icon="solar:check-circle-bold-duotone" label="Paid" value={formatNad(summary.paid)} tone="green" />
        <MiniStat icon="solar:clock-circle-bold-duotone" label="Unpaid (this period)" value={formatNad(summary.unpaid)} tone="amber" />
        <MiniStat icon="solar:danger-circle-bold-duotone" label={`Payables, ${formatNad(payables.overdue)} overdue`} value={formatNad(payables.total)} tone="orange" />
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <SectionCard title="By expense type" subtitle={`Incurred ${labels.current}`} icon="solar:pie-chart-2-bold-duotone" tone="red" actions={manage}>
          {summary.byType.length === 0 ? (
            <EmptyState compact icon="solar:card-transfer-bold-duotone" title={`No expenses recorded ${labels.current}`} message="Expenses are recorded in Settings > Practice > Practice Overhead." />
          ) : (
            <ul className="space-y-3">
              {summary.byType.map(type => (
                <li key={type.type}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-gray-700">{expenseTypeLabel(type.type)} <span className="text-xs text-gray-400">({formatCount(type.count)})</span></span>
                    <span className="font-semibold text-gray-900 whitespace-nowrap">{formatNad(type.amount)} <span className="text-xs font-normal text-gray-500">{formatPercent(summary.total > 0 ? type.amount / summary.total : null)}</span></span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                    <div className="h-2 rounded-full" style={{ width: `${(type.amount / largestType) * 100}%`, backgroundColor: CHART.accent }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Expenses by month" subtitle="By expense date; cancelled excluded" icon="solar:calendar-bold-duotone">
          <MonthlyBarChart seriesLabel="Expenses" highlight={range} data={derived.expensesMonthly.map(row => ({ monthKey: row.monthKey, value: row.total, details: [{ label: 'Paid', value: formatNad(row.paid) }] }))} />
          <div className="mt-4">
            <DataTable rows={months} columns={monthColumns} rowKey={row => row.monthKey} pageSize={6} itemLabel="months"
              totals={['Total', formatCount(months.reduce((n, r) => n + r.count, 0)), formatNad(sumAmounts(months.map(r => r.paid))), formatNad(sumAmounts(months.map(r => r.total)))]} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Expense records"
        subtitle={`${pluralize(expenses.length, 'expense')} ${labels.current}. Each record counts once, on its expense date.`}
        icon="solar:bill-list-bold-duotone"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportExpenses} disabled={expenses.length === 0} />}
      >
        <DataTable
          rows={expenses}
          columns={expenseColumns}
          rowKey={e => e.id}
          itemLabel="expenses"
          resetKey={`${range.startKey}|${range.endKey}`}
          empty={<EmptyState compact icon="solar:bill-list-bold-duotone" title={`No expenses recorded ${labels.current}`} />}
        />
      </SectionCard>
    </div>
  );
};
