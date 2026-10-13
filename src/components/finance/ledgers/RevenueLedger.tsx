import React from 'react';
import { sumAmounts, type MonthlyRevenueRow, type TariffRevenueRow } from '../../../services/ledgerService';
import type { FinanceDerived } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { formatCount, formatMonthKey, formatNad, formatPercent, pluralize } from '../financeFormat';
import { downloadCsv, exportFileName, toCsv } from '../financeExport';
import { ActionButton, EmptyState, Notice, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';

interface RevenueLedgerProps {
  derived: FinanceDerived;
  workspace: FinanceWorkspace;
  labels: PeriodLabels;
}

/** Sales ledger: revenue by month (invoice totals) and by tariff code (line items) */
export const RevenueLedger: React.FC<RevenueLedgerProps> = ({ derived, workspace, labels }) => {
  const months = [...derived.monthly].reverse();
  const { tariffs, reconciliation } = derived;

  const monthColumns: TableColumn<MonthlyRevenueRow>[] = [
    { key: 'month', header: 'Month', render: row => <span className="font-medium text-gray-900">{formatMonthKey(row.monthKey, 'MMMM yyyy')}</span> },
    { key: 'invoices', header: 'Invoices', align: 'right', render: row => formatCount(row.invoiceCount) },
    { key: 'medicalAid', header: 'Medical aid', align: 'right', hideBelow: 'md', render: row => formatNad(row.medicalAid) },
    { key: 'patient', header: 'Patient', align: 'right', hideBelow: 'md', render: row => formatNad(row.patient) },
    { key: 'billed', header: 'Billed', align: 'right', render: row => <span className="font-semibold text-gray-900">{formatNad(row.billed)}</span> },
    { key: 'collected', header: 'Collected', align: 'right', hideBelow: 'sm', render: row => formatNad(row.collected) }
  ];

  const tariffColumns: TableColumn<TariffRevenueRow>[] = [
    { key: 'code', header: 'Code', render: row => <span className="font-mono text-cyan-700">{row.code || '—'}</span> },
    { key: 'description', header: 'Description', render: row => <span className="block max-w-[280px] truncate" title={row.description}>{row.description}</span> },
    { key: 'quantity', header: 'Qty', align: 'right', hideBelow: 'sm', render: row => formatCount(row.quantity) },
    { key: 'invoices', header: 'Invoices', align: 'right', hideBelow: 'md', render: row => formatCount(row.invoiceCount) },
    { key: 'medicalAid', header: 'Medical aid', align: 'right', hideBelow: 'lg', render: row => formatNad(row.medicalAid) },
    { key: 'patient', header: 'Patient', align: 'right', hideBelow: 'lg', render: row => formatNad(row.patient) },
    { key: 'revenue', header: 'Revenue', align: 'right', render: row => <span className="font-semibold text-gray-900">{formatNad(row.revenue)}</span> },
    { key: 'share', header: 'Share', align: 'right', hideBelow: 'sm', render: row => formatPercent(row.share) }
  ];

  const exportMonths = () => downloadCsv(
    exportFileName('revenue by month'),
    toCsv(
      [
        { header: 'Month', type: 'text' },
        { header: 'Invoices', type: 'count' },
        { header: 'Medical aid', type: 'money' },
        { header: 'Patient', type: 'money' },
        { header: 'Billed', type: 'money' },
        { header: 'Collected', type: 'money' }
      ],
      months.map(row => [row.monthKey, row.invoiceCount, row.medicalAid, row.patient, row.billed, row.collected])
    )
  );

  const exportTariffs = () => {
    if (!tariffs) return;
    downloadCsv(
      exportFileName(`revenue by tariff code ${labels.ranges.current.startKey} to ${labels.ranges.current.endKey}`),
      toCsv(
        [
          { header: 'Tariff code', type: 'text' },
          { header: 'Description', type: 'text' },
          { header: 'Quantity', type: 'count' },
          { header: 'Invoices', type: 'count' },
          { header: 'Medical aid', type: 'money' },
          { header: 'Patient', type: 'money' },
          { header: 'Revenue', type: 'money' },
          { header: 'Share %', type: 'percent' }
        ],
        tariffs.map(row => [row.code, row.description, row.quantity, row.invoiceCount, row.medicalAid, row.patient, row.revenue, row.share])
      )
    );
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Revenue by month"
        subtitle="Invoice totals by invoice date; cancelled invoices excluded"
        icon="solar:calendar-bold-duotone"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportMonths} />}
      >
        <DataTable
          rows={months}
          columns={monthColumns}
          rowKey={row => row.monthKey}
          pageSize={0}
          totals={[
            'Total',
            formatCount(months.reduce((n, r) => n + r.invoiceCount, 0)),
            formatNad(sumAmounts(months.map(r => r.medicalAid))),
            formatNad(sumAmounts(months.map(r => r.patient))),
            formatNad(sumAmounts(months.map(r => r.billed))),
            formatNad(sumAmounts(months.map(r => r.collected)))
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Revenue by tariff code"
        subtitle={`Invoice line items, invoices issued ${labels.current}`}
        icon="solar:tag-price-bold-duotone"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportTariffs} disabled={!tariffs || tariffs.length === 0} />}
      >
        {tariffs === null ? (
          <Notice tone="error" title="Line items could not be loaded">{workspace.lineItems.error}</Notice>
        ) : tariffs.length === 0 ? (
          <EmptyState compact icon="solar:tag-price-bold-duotone" title={`No billed services ${labels.current}`} />
        ) : (
          <>
            <DataTable
              rows={tariffs}
              columns={tariffColumns}
              rowKey={row => `${row.code}|${row.description}`}
              itemLabel="tariff codes"
              totals={[
                'Total', `${pluralize(tariffs.length, 'code')}`,
                formatCount(tariffs.reduce((n, r) => n + r.quantity, 0)), '',
                formatNad(sumAmounts(tariffs.map(r => r.medicalAid))),
                formatNad(sumAmounts(tariffs.map(r => r.patient))),
                formatNad(sumAmounts(tariffs.map(r => r.revenue))), '100%'
              ]}
            />
            {reconciliation && (Math.abs(reconciliation.difference) >= 0.01 || reconciliation.invoicesWithoutLines > 0) && (
              <div className="mt-4">
                <Notice tone="warning" title="Line items do not fully match invoice totals">
                  Invoice totals for this period are {formatNad(reconciliation.invoiceTotal)} and their line items add up to {formatNad(reconciliation.lineTotal)}
                  {' '}(difference {formatNad(reconciliation.difference)}).
                  {reconciliation.invoicesWithoutLines > 0 && ` ${pluralize(reconciliation.invoicesWithoutLines, 'invoice has', 'invoices have')} no line items.`}
                  {' '}Differences usually come from tax or manual edits to an invoice.
                </Notice>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
};
