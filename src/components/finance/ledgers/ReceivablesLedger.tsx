import React, { useMemo, useState } from 'react';
import { AGING_BUCKETS, type AgingBucket, type AgingItem, type Funder, type LedgerInvoice } from '../../../services/ledgerService';
import type { FinanceDerived } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { AGING_COLORS, FUNDER_META } from '../financeTheme';
import { describeInvoiceAge, formatCount, formatDateKey, formatNad, pluralize } from '../financeFormat';
import { downloadCsv, exportFileName, toCsv } from '../financeExport';
import { ActionButton, EmptyState, FilterPill, LegendItem, Notice, SectionCard, SummaryStrip } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';
import { AgingChart } from '../charts/AgingChart';

interface ReceivablesLedgerProps {
  derived: FinanceDerived;
  workspace: FinanceWorkspace;
  labels: PeriodLabels;
  initialBucket: AgingBucket | null;
  onOpenInvoice: (invoice: LedgerInvoice) => void;
}

const BUCKET_LABEL = Object.fromEntries(AGING_BUCKETS.map(b => [b.key, b.label])) as Record<AgingBucket, string>;

/** Accounts receivable as at today: aging by funder, by medical aid fund, and the invoices behind it */
export const ReceivablesLedger: React.FC<ReceivablesLedgerProps> = ({ derived, workspace, labels, initialBucket, onOpenInvoice }) => {
  const { aging, schemeReceivables } = derived;
  const [bucket, setBucket] = useState<'all' | AgingBucket>(initialBucket ?? 'all');
  const [funder, setFunder] = useState<'all' | Funder>('all');

  const items = useMemo(() => aging.items.filter(item =>
    (bucket === 'all' || item.bucket === bucket) &&
    (funder === 'all' || (funder === 'medical_aid' ? item.medicalAid > 0 : item.patient > 0))
  ), [aging.items, bucket, funder]);

  const nameOf = (invoice: LedgerInvoice) => (invoice.patientId && workspace.patientNames[invoice.patientId]) || 'Unknown patient';
  const fundOf = (invoice: LedgerInvoice) => (invoice.patientId && workspace.schemeByPatient[invoice.patientId]) || '';
  const select = (nextBucket: 'all' | AgingBucket, nextFunder: 'all' | Funder) => {
    setBucket(nextBucket);
    setFunder(nextFunder);
  };

  if (aging.count === 0) {
    return <EmptyState icon="solar:check-circle-bold-duotone" title="No receivables" message={`Nothing is owed to the practice as at ${labels.today}: every invoice is paid or cancelled.`} />;
  }

  const funderRows: { key: 'all' | Funder; label: string; value: (b: AgingBucket) => number; total: number }[] = [
    { key: 'medical_aid', label: 'Medical aid', value: b => aging.byBucket[b].medicalAid, total: aging.medicalAid },
    { key: 'patient', label: 'Patient', value: b => aging.byBucket[b].patient, total: aging.patient },
    { key: 'all', label: 'Total', value: b => aging.byBucket[b].amount, total: aging.total }
  ];

  const columns: TableColumn<AgingItem>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: item => (
        <div>
          <p className="font-mono text-sm font-medium text-cyan-700">{item.invoice.invoiceNumber}</p>
          <p className="text-xs text-gray-500 truncate max-w-[220px]">{nameOf(item.invoice)}{fundOf(item.invoice) ? ` · ${fundOf(item.invoice)}` : ''}</p>
        </div>
      )
    },
    { key: 'due', header: 'Due', render: item => formatDateKey(item.invoice.dueDate ?? item.invoice.issueDate) },
    { key: 'age', header: 'Age', hideBelow: 'sm', render: item => <span className="text-xs text-gray-600">{describeInvoiceAge(item.invoice, labels.todayKey)}</span> },
    {
      key: 'bucket',
      header: 'Bucket',
      hideBelow: 'md',
      render: item => (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AGING_COLORS[item.bucket] }} aria-hidden="true" />
          {BUCKET_LABEL[item.bucket]}
        </span>
      )
    },
    { key: 'medicalAid', header: 'Medical aid', align: 'right', hideBelow: 'md', render: item => formatNad(item.medicalAid) },
    { key: 'patient', header: 'Patient', align: 'right', hideBelow: 'md', render: item => formatNad(item.patient) },
    { key: 'owed', header: 'Owed', align: 'right', render: item => <span className="font-semibold text-gray-900">{formatNad(item.amount)}</span> }
  ];

  const exportItems = () => {
    const csv = toCsv(
      [
        { header: 'Invoice', type: 'text' },
        { header: 'Patient', type: 'text' },
        { header: 'Medical aid fund', type: 'text' },
        { header: 'Issued', type: 'date' },
        { header: 'Due', type: 'date' },
        { header: 'Days past due', type: 'count' },
        { header: 'Bucket', type: 'text' },
        { header: 'Medical aid owes', type: 'money' },
        { header: 'Patient owes', type: 'money' },
        { header: 'Owed', type: 'money' }
      ],
      items.map(item => [item.invoice.invoiceNumber, nameOf(item.invoice), fundOf(item.invoice), item.invoice.issueDate, item.invoice.dueDate, item.daysPastDue, BUCKET_LABEL[item.bucket], item.medicalAid, item.patient, item.amount])
    );
    downloadCsv(exportFileName(`receivables as at ${labels.todayKey}`), csv);
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Aging by funder" subtitle={`As at ${labels.today}. Click an amount to list its invoices.`} icon="solar:clock-circle-bold-duotone" tone="orange">
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium">Funder</th>
                {AGING_BUCKETS.map(b => (
                  <th key={b.key} scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap" title={b.description}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: AGING_COLORS[b.key] }} aria-hidden="true" />
                      {b.label}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {funderRows.map(row => (
                <tr key={row.key} className={row.key === 'all' ? 'bg-gray-50 font-semibold text-gray-900' : 'text-gray-700'}>
                  <th scope="row" className="px-4 py-3 text-left font-medium whitespace-nowrap">{row.label}</th>
                  {AGING_BUCKETS.map(b => (
                    <td key={b.key} className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => select(b.key, row.key)}
                        className={`w-full text-right tabular-nums px-2 py-2 rounded-md hover:bg-orange-50 whitespace-nowrap ${bucket === b.key && funder === row.key ? 'ring-2 ring-orange-300 bg-orange-50' : ''}`}
                      >
                        {formatNad(row.value(b.key))}
                      </button>
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right">
                    <button type="button" onClick={() => select('all', row.key)} className="w-full text-right tabular-nums px-2 py-2 rounded-md hover:bg-orange-50 whitespace-nowrap">
                      {formatNad(row.total)}
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="text-xs text-gray-500">
                <th scope="row" className="px-4 py-2 text-left font-normal">Invoices</th>
                {AGING_BUCKETS.map(b => <td key={b.key} className="px-4 py-2 text-right tabular-nums">{formatCount(aging.byBucket[b.key].count)}</td>)}
                <td className="px-4 py-2 text-right tabular-nums">{formatCount(aging.count)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-2">
            <LegendItem color={FUNDER_META.medical_aid.color} label="Medical aid" tint="bg-transparent" />
            <LegendItem color={FUNDER_META.patient.color} label="Patient" tint="bg-transparent" />
          </div>
          <AgingChart aging={aging} mode="funder" onSelectBucket={b => select(b, 'all')} height={240} />
        </div>
        <SummaryStrip tone="orange">
          <strong>{formatNad(aging.pastDue)}</strong> of {formatNad(aging.total)} is past its due date. Invoices are due 30 days after issue unless a different due date was set.
          {aging.undatedCount > 0 && ` ${pluralize(aging.undatedCount, 'invoice has', 'invoices have')} no usable date and ${aging.undatedCount === 1 ? 'is' : 'are'} shown as 90+ days.`}
        </SummaryStrip>
      </SectionCard>

      {schemeReceivables.length > 0 && (
        <SectionCard title="Medical aid receivables by fund" subtitle="The medical aid portion of unpaid invoices, largest first" icon="solar:heart-pulse-bold-duotone">
          <DataTable
            rows={schemeReceivables}
            columns={[
              { key: 'fund', header: 'Fund', render: row => <span className="font-medium text-gray-900">{row.scheme}</span> },
              { key: 'count', header: 'Invoices', align: 'right', render: row => formatCount(row.count) },
              { key: 'oldest', header: 'Oldest', align: 'right', render: row => (row.oldestDaysPastDue === null ? '—' : row.oldestDaysPastDue < 0 ? 'Not yet due' : `${formatCount(row.oldestDaysPastDue)} days past due`) },
              { key: 'owed', header: 'Owed', align: 'right', render: row => <span className="font-semibold text-gray-900">{formatNad(row.amount)}</span> }
            ]}
            rowKey={row => row.scheme}
            pageSize={10}
            itemLabel="funds"
          />
          {Object.keys(workspace.schemeByPatient).length === 0 && (
            <div className="mt-3"><Notice tone="info">Medical aid details could not be matched to patients, so funds show as "Scheme not recorded".</Notice></div>
          )}
        </SectionCard>
      )}

      <SectionCard
        title="Outstanding invoices"
        subtitle={`${pluralize(items.length, 'invoice')} · oldest first`}
        icon="solar:document-text-bold-duotone"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportItems} disabled={items.length === 0} />}
      >
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <FilterPill active={bucket === 'all'} onClick={() => setBucket('all')} count={aging.count}>All ages</FilterPill>
          {AGING_BUCKETS.map(b => (
            <FilterPill key={b.key} active={bucket === b.key} onClick={() => setBucket(b.key)} count={aging.byBucket[b.key].count}>{b.label}</FilterPill>
          ))}
          <span className="text-xs text-gray-500 ml-2">Funder</span>
          <FilterPill active={funder === 'all'} onClick={() => setFunder('all')}>All</FilterPill>
          <FilterPill active={funder === 'medical_aid'} onClick={() => setFunder('medical_aid')}>Medical aid</FilterPill>
          <FilterPill active={funder === 'patient'} onClick={() => setFunder('patient')}>Patient</FilterPill>
        </div>
        <DataTable
          rows={items}
          columns={columns}
          rowKey={item => item.invoice.id}
          onRowClick={item => onOpenInvoice(item.invoice)}
          rowLabel={item => `Open invoice ${item.invoice.invoiceNumber}`}
          resetKey={`${bucket}|${funder}`}
          itemLabel="invoices"
          empty={<EmptyState compact icon="solar:magnifer-bold-duotone" title="No invoices in this selection" />}
        />
      </SectionCard>
    </div>
  );
};
