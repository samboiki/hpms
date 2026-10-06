import React from 'react';
import { sumAmounts, type MethodCollections, type MonthlyRevenueRow } from '../../../services/ledgerService';
import type { FinanceDerived } from '../deriveFinance';
import type { PeriodLabels } from '../financeNav';
import { PAYMENT_METHOD_META } from '../financeTheme';
import { formatCount, formatMonthKey, formatNad, formatPercent } from '../financeFormat';
import { downloadCsv, exportFileName, toCsv } from '../financeExport';
import { ActionButton, EmptyState, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';

/** Cash received (paid invoices) by payment method for the period, and by month */
export const CollectionsLedger: React.FC<{ derived: FinanceDerived; labels: PeriodLabels }> = ({ derived, labels }) => {
  const { methods, collections } = derived;
  const months = [...derived.monthly].reverse();

  const methodColumns: TableColumn<MethodCollections>[] = [
    {
      key: 'method',
      header: 'Payment method',
      render: row => (
        <span className="inline-flex items-center gap-2 font-medium text-gray-900">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PAYMENT_METHOD_META[row.method].color }} aria-hidden="true" />
          {PAYMENT_METHOD_META[row.method].label}
        </span>
      )
    },
    { key: 'count', header: 'Invoices', align: 'right', render: row => formatCount(row.count) },
    { key: 'amount', header: 'Amount', align: 'right', render: row => <span className="font-semibold text-gray-900">{formatNad(row.amount)}</span> },
    { key: 'share', header: 'Share', align: 'right', render: row => formatPercent(row.share) }
  ];

  const monthColumns: TableColumn<MonthlyRevenueRow>[] = [
    { key: 'month', header: 'Month', render: row => <span className="font-medium text-gray-900">{formatMonthKey(row.monthKey, 'MMMM yyyy')}</span> },
    { key: 'billed', header: 'Billed', align: 'right', render: row => formatNad(row.billed) },
    { key: 'collected', header: 'Collected', align: 'right', render: row => <span className="font-semibold text-gray-900">{formatNad(row.collected)}</span> },
    { key: 'rate', header: 'Paid share', align: 'right', render: row => formatPercent(row.billed > 0 ? row.collected / row.billed : null) }
  ];

  const exportMethods = () => downloadCsv(
    exportFileName(`collections by method ${labels.ranges.current.startKey} to ${labels.ranges.current.endKey}`),
    toCsv(
      [{ header: 'Payment method', type: 'text' }, { header: 'Invoices', type: 'count' }, { header: 'Amount', type: 'money' }, { header: 'Share %', type: 'percent' }],
      methods.map(row => [PAYMENT_METHOD_META[row.method].label, row.count, row.amount, row.share])
    )
  );

  return (
    <div className="space-y-6">
      <SectionCard
        title="Collections by payment method"
        subtitle={`Paid invoices issued ${labels.current}`}
        icon="solar:card-bold-duotone"
        tone="violet"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportMethods} disabled={methods.length === 0} />}
      >
        <DataTable
          rows={methods}
          columns={methodColumns}
          rowKey={row => row.method}
          pageSize={0}
          totals={['Total', formatCount(collections.count), formatNad(collections.collected), methods.length > 0 ? '100%' : '—']}
          empty={<EmptyState compact icon="solar:wallet-bold-duotone" title={`No paid invoices issued ${labels.current}`} />}
        />
      </SectionCard>

      <SectionCard title="Collections by month" subtitle="Paid share of each month's invoices, last 12 months" icon="solar:calendar-bold-duotone">
        <DataTable
          rows={months}
          columns={monthColumns}
          rowKey={row => row.monthKey}
          pageSize={0}
          totals={['Total', formatNad(sumAmounts(months.map(r => r.billed))), formatNad(sumAmounts(months.map(r => r.collected))), '']}
        />
      </SectionCard>
    </div>
  );
};
