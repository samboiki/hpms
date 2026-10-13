import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { staffName } from './practiceReports/reportTargets';
import {
  filterInvoices,
  hasUnrecognisedStatus,
  isPartPaid,
  splitByFunder,
  sumAmounts,
  summarizeByStatus,
  type Funder,
  type InvoiceStatus,
  type LedgerInvoice
} from '../../services/ledgerService';
import type { FinanceWorkspace } from './financeData';
import type { PeriodLabels } from './financeNav';
import { FUNDER_META, INVOICE_STATUS_META } from './financeTheme';
import { describeInvoiceAge, formatCount, formatDateKey, formatNad, pluralize } from './financeFormat';
import { downloadCsv, exportFileName, toCsv } from './financeExport';
import { ActionButton, EmptyState, FilterPill, Notice, SectionCard, StatTile } from './FinanceUI';
import { DataTable, type TableColumn } from './DataTable';
import { MedicalAidLogo } from '../ui/MedicalAidLogo';
import type { TileTone } from '../ui/tileTones';

type StatusFilter = 'all' | InvoiceStatus;

const STATUS_TILES: { key: StatusFilter; label: string; tone: TileTone }[] = [
  { key: 'all', label: 'All invoices', tone: 'cyan' },
  { key: 'pending', label: 'Pending', tone: 'amber' },
  { key: 'overdue', label: 'Overdue', tone: 'red' },
  { key: 'paid', label: 'Paid', tone: 'green' },
  { key: 'cancelled', label: 'Cancelled', tone: 'gray' }
];

interface InvoicingTabProps {
  workspace: FinanceWorkspace;
  labels: PeriodLabels;
  onOpenInvoice: (invoice: LedgerInvoice) => void;
}

/** Invoices issued in the selected period, with status, funder and text filters and a drill-down */
export const InvoicingTab: React.FC<InvoicingTabProps> = ({ workspace, labels, onOpenInvoice }) => {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [funder, setFunder] = useState<'all' | Funder>('all');
  const [search, setSearch] = useState('');
  const { patientNames, doctorNames, schemeByPatient } = workspace;
  const range = labels.ranges.current;

  const periodInvoices = useMemo(
    () => filterInvoices(workspace.invoices.rows, { status: 'all', funder: 'all', search: '', range }, patientNames),
    [workspace.invoices.rows, range, patientNames]
  );
  const statusSummary = useMemo(() => summarizeByStatus(periodInvoices), [periodInvoices]);
  const rows = useMemo(
    () => filterInvoices(workspace.invoices.rows, { status, funder, search, range }, patientNames),
    [workspace.invoices.rows, status, funder, search, range, patientNames]
  );
  const totals = useMemo(() => ({
    medicalAid: sumAmounts(rows.map(row => splitByFunder(row).medicalAid)),
    patient: sumAmounts(rows.map(row => splitByFunder(row).patient)),
    total: sumAmounts(rows.map(row => row.total))
  }), [rows]);

  const nameOf = (invoice: LedgerInvoice) => (invoice.patientId && patientNames[invoice.patientId]) || 'Unknown patient';
  // The practitioner as the staff list names them (no "Dr." added: dentists, optometrists and therapists bill here too)
  const doctorOf = (invoice: LedgerInvoice) => staffName(invoice.practitionerId, doctorNames, 'Not recorded');
  const filtersActive = status !== 'all' || funder !== 'all' || search.trim() !== '';
  const billedExcludingCancelled = sumAmounts(periodInvoices.filter(inv => inv.status !== 'cancelled').map(inv => inv.total));

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
    { key: 'doctor', header: 'Practitioner', hideBelow: 'lg', render: doctorOf },
    {
      key: 'medicalAid',
      header: 'Medical aid',
      align: 'right',
      hideBelow: 'md',
      // The fund's logo (its name on hover and for screen readers) beside what it is billed
      render: invoice => {
        const amount = splitByFunder(invoice).medicalAid;
        const fund = amount > 0 && invoice.patientId ? schemeByPatient[invoice.patientId] : null;
        return (
          <span className="inline-flex items-center justify-end gap-2">
            <MedicalAidLogo name={fund} labelled />
            {formatNad(amount)}
          </span>
        );
      }
    },
    { key: 'patient', header: 'Patient', align: 'right', hideBelow: 'md', render: invoice => formatNad(splitByFunder(invoice).patient) },
    { key: 'total', header: 'Total', align: 'right', render: invoice => <span className="font-semibold text-gray-900">{formatNad(invoice.total)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: invoice => (
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${INVOICE_STATUS_META[invoice.status].badge}`} title={invoice.rawStatus ?? undefined}>
          {/* Part paid (set by receipts) is still owed, so it sits with pending invoices */}
          {isPartPaid(invoice) ? 'Part paid' : INVOICE_STATUS_META[invoice.status].label}{hasUnrecognisedStatus(invoice) ? '*' : ''}
        </span>
      )
    },
    {
      key: 'due',
      header: 'Due',
      hideBelow: 'sm',
      render: invoice => (
        <div>
          <p className="text-sm text-gray-700">{formatDateKey(invoice.dueDate)}</p>
          <p className="text-xs text-gray-500">{describeInvoiceAge(invoice, labels.todayKey)}</p>
        </div>
      )
    }
  ];

  const exportRows = () => {
    const csv = toCsv(
      [
        { header: 'Invoice', type: 'text' },
        { header: 'Issued', type: 'date' },
        { header: 'Due', type: 'date' },
        { header: 'Patient', type: 'text' },
        { header: 'Practitioner', type: 'text' },
        { header: 'Status', type: 'text' },
        { header: 'Payment method', type: 'text' },
        { header: 'Medical aid', type: 'money' },
        { header: 'Patient portion', type: 'money' },
        { header: 'Total', type: 'money' }
      ],
      rows.map(invoice => {
        const split = splitByFunder(invoice);
        return [invoice.invoiceNumber, invoice.issueDate, invoice.dueDate, nameOf(invoice), doctorOf(invoice), isPartPaid(invoice) ? 'Part paid' : INVOICE_STATUS_META[invoice.status].label, invoice.paymentMethod, split.medicalAid, split.patient, invoice.total];
      })
    );
    downloadCsv(exportFileName(`invoices ${range.startKey} to ${range.endKey}`), csv);
  };

  return (
    <div className="space-y-6">
      {/* Finance's number cards; each filters the list below to its invoices */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {STATUS_TILES.map(tile => {
          const summary = tile.key === 'all'
            ? { count: periodInvoices.length, amount: billedExcludingCancelled }
            : statusSummary[tile.key];
          return (
            <StatTile
              key={tile.key}
              dense
              label={tile.label}
              value={formatNad(summary.amount)}
              icon={tile.key === 'all' ? 'solar:bill-list-bold-duotone' : INVOICE_STATUS_META[tile.key].icon}
              tone={tile.tone}
              footnote={`${pluralize(summary.count, 'invoice')}${tile.key === 'all' ? ', excl. cancelled amounts' : ''}`}
              onClick={() => setStatus(tile.key)}
              pressed={status === tile.key}
            />
          );
        })}
      </div>

      <SectionCard
        title="Invoices"
        subtitle={`Issued ${labels.current} · click an invoice for its services and funder split`}
        icon="solar:document-text-bold-duotone"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportRows} disabled={rows.length === 0} />}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Icon icon="solar:magnifer-bold-duotone" className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by invoice number or patient name"
              aria-label="Search invoices"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">Funder</span>
            <FilterPill active={funder === 'all'} onClick={() => setFunder('all')}>All</FilterPill>
            <FilterPill active={funder === 'medical_aid'} onClick={() => setFunder('medical_aid')} icon={FUNDER_META.medical_aid.icon}>Medical aid</FilterPill>
            <FilterPill active={funder === 'patient'} onClick={() => setFunder('patient')} icon={FUNDER_META.patient.icon}>Patient</FilterPill>
            {filtersActive && (
              <button type="button" onClick={() => { setStatus('all'); setFunder('all'); setSearch(''); }} className="text-xs font-medium text-cyan-700 hover:text-cyan-800 px-2">
                Clear filters
              </button>
            )}
          </div>
        </div>

        {periodInvoices.length === 0 ? (
          <EmptyState
            icon="solar:document-text-bold-duotone"
            title={`No invoices issued ${labels.current}`}
            message="Invoices are created when a visit is billed. Choose a longer period at the top of the page to see older invoices."
          />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={invoice => invoice.id}
            onRowClick={onOpenInvoice}
            rowLabel={invoice => `Open invoice ${invoice.invoiceNumber}`}
            resetKey={`${status}|${funder}|${search}|${range.startKey}|${range.endKey}`}
            itemLabel="invoices"
            totals={[`${formatCount(rows.length)} shown`, '', '', formatNad(totals.medicalAid), formatNad(totals.patient), formatNad(totals.total), '', '']}
            empty={
              <EmptyState
                compact
                icon="solar:magnifer-bold-duotone"
                title="No invoices match these filters"
                action={<ActionButton icon="solar:close-circle-bold-duotone" label="Clear filters" onClick={() => { setStatus('all'); setFunder('all'); setSearch(''); }} />}
              />
            }
          />
        )}
        <div className="mt-4">
          <Notice tone="info">
            {workspace.ar?.state === 'ready'
              ? // Once receipts are in use an invoice takes its payments and credit notes right here (no discounts: owner, 13 Oct 2026)
                "Invoices are created from a visit's billing. Open an invoice to receive a payment or credit it; \"Open patient billing\" shows the patient's whole account."
              : 'Invoices are created from a visit\'s billing and marked paid on the patient\'s Billing tab (open an invoice and choose "Open patient billing"). Finance is read-only, so figures here always match those records.'}
          </Notice>
        </div>
      </SectionCard>
    </div>
  );
};
