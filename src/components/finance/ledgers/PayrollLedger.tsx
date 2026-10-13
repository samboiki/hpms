import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { isInRange, payslipDateKey, sumAmounts, type LedgerPayslip, type PayrollMonthRow } from '../../../services/ledgerService';
import type { FinanceDerived } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { formatCount, formatDateKey, formatMonthKey, formatNad, pluralize } from '../financeFormat';
import { downloadCsv, exportFileName, toCsv } from '../financeExport';
import { ActionButton, EmptyState, ErrorState, MiniStat, Notice, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';
import { MonthlyBarChart } from '../charts/MonthlyBarChart';
import { payrollLink } from '../../billing/invoiceLinks';

const STATUS_BADGE: Record<LedgerPayslip['status'], string> = {
  paid: 'bg-green-100 text-green-800',
  unpaid: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-gray-100 text-gray-700'
};

/** Payroll expense from payslips (gross pay in the month worked) */
export const PayrollLedger: React.FC<{ derived: FinanceDerived; workspace: FinanceWorkspace; labels: PeriodLabels; onRetry: () => void }> = ({ derived, workspace, labels, onRetry }) => {
  const navigate = useNavigate();
  const range = labels.ranges.current;
  const payslips = useMemo(
    () => workspace.payslips.rows
      .filter(p => isInRange(payslipDateKey(p), range))
      .sort((a, b) => (payslipDateKey(b) ?? '').localeCompare(payslipDateKey(a) ?? '') || a.employeeName.localeCompare(b.employeeName)),
    [workspace.payslips.rows, range]
  );

  if (workspace.payslips.error || !derived.payroll || !derived.payrollMonthly) {
    return (
      <ErrorState
        title="Payroll could not be loaded"
        message={`${workspace.payslips.error ?? 'Unknown error'}. Payroll is usually visible to practice administrators only. No payroll figures are shown rather than zeros.`}
        onRetry={onRetry}
      />
    );
  }

  const { payroll } = derived;
  const months = [...derived.payrollMonthly].reverse();

  const monthColumns: TableColumn<PayrollMonthRow>[] = [
    { key: 'month', header: 'Month', render: row => <span className="font-medium text-gray-900">{formatMonthKey(row.monthKey, 'MMMM yyyy')}</span> },
    { key: 'count', header: 'Payslips', align: 'right', render: row => formatCount(row.count) },
    { key: 'gross', header: 'Gross pay', align: 'right', render: row => <span className="font-semibold text-gray-900">{formatNad(row.gross)}</span> },
    { key: 'deductions', header: 'Deductions', align: 'right', hideBelow: 'sm', render: row => formatNad(row.deductions) },
    { key: 'net', header: 'Net pay', align: 'right', render: row => formatNad(row.net) }
  ];

  const slipColumns: TableColumn<LedgerPayslip>[] = [
    { key: 'employee', header: 'Employee', render: p => <span className="font-medium text-gray-900">{p.employeeName}</span> },
    { key: 'period', header: 'Pay period', hideBelow: 'md', render: p => `${formatDateKey(p.periodStart)} – ${formatDateKey(p.periodEnd)}` },
    { key: 'paymentDate', header: 'Pay date', hideBelow: 'lg', render: p => formatDateKey(p.paymentDate) },
    { key: 'gross', header: 'Gross', align: 'right', render: p => formatNad(p.gross) },
    { key: 'deductions', header: 'Deductions', align: 'right', hideBelow: 'sm', render: p => formatNad(p.deductions) },
    { key: 'net', header: 'Net', align: 'right', render: p => <span className="font-semibold text-gray-900">{formatNad(p.net)}</span> },
    { key: 'status', header: 'Status', render: p => <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_BADGE[p.status]}`}>{p.status}</span> }
  ];

  const exportSlips = () => downloadCsv(
    exportFileName(`payroll ${range.startKey} to ${range.endKey}`),
    toCsv(
      [
        { header: 'Employee', type: 'text' },
        { header: 'Period start', type: 'date' },
        { header: 'Period end', type: 'date' },
        { header: 'Pay date', type: 'date' },
        { header: 'Gross', type: 'money' },
        { header: 'Deductions', type: 'money' },
        { header: 'Net', type: 'money' },
        { header: 'Status', type: 'text' }
      ],
      payslips.map(p => [p.employeeName, p.periodStart, p.periodEnd, p.paymentDate, p.gross, p.deductions, p.net, p.status])
    )
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat icon="solar:wallet-money-bold-duotone" label={`Gross pay, ${labels.current}`} value={formatNad(payroll.gross)} tone="violet" />
        <MiniStat icon="solar:bill-list-bold-duotone" label="Deductions" value={formatNad(payroll.deductions)} tone="gray" />
        <MiniStat icon="solar:hand-money-bold-duotone" label="Net pay (paid)" value={formatNad(payroll.paidNet)} tone="green" />
        <MiniStat icon="solar:clock-circle-bold-duotone" label="Net pay (not yet paid)" value={formatNad(payroll.unpaidNet)} tone="amber" />
      </div>

      <SectionCard
        title="Payroll by month"
        subtitle="Gross pay by pay period start; cancelled payslips excluded"
        icon="solar:users-group-two-rounded-bold-duotone"
        tone="violet"
        actions={<ActionButton icon="solar:settings-bold-duotone" label="Manage payroll" title="Settings > Users > Payroll" onClick={() => navigate(payrollLink())} />}
      >
        <MonthlyBarChart
          seriesLabel="Gross pay"
          highlight={range}
          data={derived.payrollMonthly.map(row => ({ monthKey: row.monthKey, value: row.gross, details: [{ label: 'Payslips', value: formatCount(row.count) }, { label: 'Net pay', value: formatNad(row.net) }] }))}
        />
        <div className="mt-4">
          <DataTable
            rows={months}
            columns={monthColumns}
            rowKey={row => row.monthKey}
            pageSize={0}
            totals={['Total', formatCount(months.reduce((n, r) => n + r.count, 0)), formatNad(sumAmounts(months.map(r => r.gross))), formatNad(sumAmounts(months.map(r => r.deductions))), formatNad(sumAmounts(months.map(r => r.net)))]}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Payslips"
        subtitle={`${pluralize(payroll.count, 'payslip')} for ${pluralize(payroll.employees, 'employee')}, ${labels.current}`}
        icon="solar:document-text-bold-duotone"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportSlips} disabled={payslips.length === 0} />}
      >
        <DataTable
          rows={payslips}
          columns={slipColumns}
          rowKey={p => p.id}
          itemLabel="payslips"
          resetKey={`${range.startKey}|${range.endKey}`}
          empty={<EmptyState compact icon="solar:document-text-bold-duotone" title={`No payslips for ${labels.current}`} message="Payslips are generated in Settings > Users > Payroll." />}
        />
        <div className="mt-4">
          <Notice tone="info">Payroll cost is gross pay. Employer contributions are not recorded in HPMS, so they are not included.</Notice>
        </div>
      </SectionCard>
    </div>
  );
};
