import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  filterInvoices,
  normalizePaymentMethod,
  percentChange,
  splitByFunder,
  sumAmounts,
  type Funder,
  type LedgerInvoice,
  type PaymentMethodKey
} from '../../services/ledgerService';
import type { FinanceDerived } from './deriveFinance';
import type { FinanceWorkspace } from './financeData';
import type { NavigateFn, PeriodLabels } from './financeNav';
import { FUNDER_META, PAYMENT_METHOD_META } from './financeTheme';
import { formatDateKey, formatNad, formatPercent, formatTimestamp, pluralize } from './financeFormat';
import { downloadCsv, exportFileName, toCsv } from './financeExport';
import { ActionButton, EmptyState, FilterPill, Notice, SectionCard, StatTile, SummaryStrip } from './FinanceUI';
import { DataTable, type TableColumn } from './DataTable';
import { MethodDonut } from './charts/MethodDonut';
import { MonthlyBarChart } from './charts/MonthlyBarChart';

interface PaymentsTabProps {
  workspace: FinanceWorkspace;
  derived: FinanceDerived;
  labels: PeriodLabels;
  onOpenInvoice: (invoice: LedgerInvoice) => void;
  onNavigate: NavigateFn;
}

/** Collections: invoices marked paid in the selected period, by method and funder */
export const PaymentsTab: React.FC<PaymentsTabProps> = ({ workspace, derived, labels, onOpenInvoice, onNavigate }) => {
  const [method, setMethod] = useState<'all' | PaymentMethodKey>('all');
  const [funder, setFunder] = useState<'all' | Funder>('all');
  const { collections, previousCollections, methods, aging } = derived;
  const range = labels.ranges.current;

  const paid = useMemo(
    () => filterInvoices(workspace.invoices.rows, { status: 'paid', funder, search: '', range }, workspace.patientNames)
      .filter(invoice => method === 'all' || normalizePaymentMethod(invoice.paymentMethod) === method)
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [workspace.invoices.rows, workspace.patientNames, funder, method, range]
  );

  const nameOf = (invoice: LedgerInvoice) => (invoice.patientId && workspace.patientNames[invoice.patientId]) || 'Unknown patient';

  const columns: TableColumn<LedgerInvoice>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: invoice => (
        <div>
          <p className="font-mono text-sm font-medium text-cyan-700">{invoice.invoiceNumber}</p>
          <p className="text-xs text-gray-500 truncate max-w-[220px]">{nameOf(invoice)}</p>
        </div>
      )
    },
    { key: 'issued', header: 'Issued', render: invoice => formatDateKey(invoice.issueDate) },
    {
      key: 'method',
      header: 'Method',
      render: invoice => {
        const meta = PAYMENT_METHOD_META[normalizePaymentMethod(invoice.paymentMethod)];
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
            <Icon icon={meta.icon} className="w-4 h-4" style={{ color: meta.color }} aria-hidden="true" />
            {meta.label}
          </span>
        );
      }
    },
    { key: 'medicalAid', header: 'Medical aid', align: 'right', hideBelow: 'md', render: invoice => formatNad(splitByFunder(invoice).medicalAid) },
    { key: 'patient', header: 'Patient', align: 'right', hideBelow: 'md', render: invoice => formatNad(splitByFunder(invoice).patient) },
    { key: 'amount', header: 'Amount', align: 'right', render: invoice => <span className="font-semibold text-gray-900">{formatNad(invoice.total)}</span> },
    { key: 'updated', header: 'Last updated', hideBelow: 'lg', render: invoice => <span className="text-xs text-gray-500">{formatTimestamp(invoice.updatedAt)}</span> }
  ];

  const exportRows = () => {
    const csv = toCsv(
      [
        { header: 'Invoice', type: 'text' },
        { header: 'Issued', type: 'date' },
        { header: 'Patient', type: 'text' },
        { header: 'Payment method', type: 'text' },
        { header: 'Medical aid', type: 'money' },
        { header: 'Patient portion', type: 'money' },
        { header: 'Amount', type: 'money' },
        { header: 'Last updated', type: 'text' }
      ],
      paid.map(invoice => {
        const split = splitByFunder(invoice);
        return [invoice.invoiceNumber, invoice.issueDate, nameOf(invoice), PAYMENT_METHOD_META[normalizePaymentMethod(invoice.paymentMethod)].label, split.medicalAid, split.patient, invoice.total, invoice.updatedAt];
      })
    );
    downloadCsv(exportFileName(`collections ${range.startKey} to ${range.endKey}`), csv);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Collected (paid invoices)"
          value={formatNad(collections.collected)}
          icon="solar:hand-money-bold-duotone"
          tone="green"
          caption={pluralize(collections.count, 'invoice')}
          change={{ percent: percentChange(collections.collected, previousCollections.collected), comparisonLabel: labels.previous }}
        />
        <StatTile label="From medical aids" value={formatNad(collections.medicalAid)} icon={FUNDER_META.medical_aid.icon} tone="cyan" caption={labels.current} />
        <StatTile label="From patients" value={formatNad(collections.patient)} icon={FUNDER_META.patient.icon} tone="amber" caption={labels.current} />
        <StatTile
          label="Awaiting payment (all unpaid)"
          value={formatNad(aging.total)}
          icon="solar:clock-circle-bold-duotone"
          tone="orange"
          caption={`As at ${labels.today}`}
          footnote={`${formatNad(aging.pastDue)} past due · open the receivables ledger`}
          onClick={() => onNavigate({ tab: 'ledgers', ledger: 'receivables' })}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <SectionCard title="Collections by payment method" subtitle={`Paid invoices issued ${labels.current}`} icon="solar:card-bold-duotone" tone="violet">
          {methods.length === 0 ? (
            <EmptyState compact icon="solar:wallet-bold-duotone" title="No paid invoices in this period" message="Paid invoices appear here once they are marked paid on the patient's Billing tab." />
          ) : (
            <>
              <MethodDonut methods={methods} total={collections.collected} />
              <SummaryStrip tone="violet">
                <strong>Collection rate {formatPercent(collections.collectionRate)}:</strong> {formatNad(collections.collected)} of {formatNad(derived.revenue.billed)} billed {labels.current} is marked paid.
              </SummaryStrip>
            </>
          )}
        </SectionCard>

        <SectionCard title="Collections by month" subtitle="Paid invoices by invoice month, last 12 months" icon="solar:chart-2-bold-duotone">
          <MonthlyBarChart
            seriesLabel="Collected"
            highlight={range}
            height={300}
            data={derived.monthly.map(row => ({
              monthKey: row.monthKey,
              value: row.collected,
              details: [
                { label: 'Billed', value: formatNad(row.billed) },
                { label: 'Paid share', value: formatPercent(row.billed > 0 ? row.collected / row.billed : null) }
              ]
            }))}
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Paid invoices"
        subtitle={`Issued ${labels.current}, most recently updated first`}
        icon="solar:checklist-minimalistic-bold-duotone"
        tone="green"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportRows} disabled={paid.length === 0} />}
      >
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-gray-500">Method</span>
          <FilterPill active={method === 'all'} onClick={() => setMethod('all')}>All</FilterPill>
          {methods.map(row => (
            <FilterPill key={row.method} active={method === row.method} onClick={() => setMethod(row.method)} icon={PAYMENT_METHOD_META[row.method].icon} count={row.count}>
              {PAYMENT_METHOD_META[row.method].label}
            </FilterPill>
          ))}
          <span className="text-xs text-gray-500 ml-2">Funder</span>
          <FilterPill active={funder === 'all'} onClick={() => setFunder('all')}>All</FilterPill>
          <FilterPill active={funder === 'medical_aid'} onClick={() => setFunder('medical_aid')}>Medical aid</FilterPill>
          <FilterPill active={funder === 'patient'} onClick={() => setFunder('patient')}>Patient</FilterPill>
        </div>
        <DataTable
          rows={paid}
          columns={columns}
          rowKey={invoice => invoice.id}
          onRowClick={onOpenInvoice}
          rowLabel={invoice => `Open invoice ${invoice.invoiceNumber}`}
          resetKey={`${method}|${funder}|${range.startKey}|${range.endKey}`}
          itemLabel="payments"
          totals={['Total', '', '', formatNad(sumAmounts(paid.map(i => splitByFunder(i).medicalAid))), formatNad(sumAmounts(paid.map(i => splitByFunder(i).patient))), formatNad(sumAmounts(paid.map(i => i.total))), '']}
          empty={<EmptyState compact icon="solar:wallet-bold-duotone" title="No paid invoices match" message="Try another method or funder, or a longer period." />}
        />
        <div className="mt-4">
          <Notice tone="info">
            A payment is recorded by marking the invoice paid on the patient's Billing tab. HPMS does not store payment dates or
            part-payments yet, so collections are grouped by invoice date and "last updated" is shown as a guide to when it was paid.
          </Notice>
        </div>
      </SectionCard>
    </div>
  );
};
