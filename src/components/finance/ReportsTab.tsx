import React, { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { FinanceDerived } from './deriveFinance';
import type { FinanceWorkspace } from './financeData';
import type { PeriodLabels } from './financeNav';
import { buildReport, type ReportId, type ReportResult } from './reports';
import { displayValue, downloadReportCsv, printReport, type CsvCell, type ReportTable } from './financeExport';
import { pluralize } from './financeFormat';
import { ActionButton, EmptyState, IconChip, Notice, SectionCard, type Tone } from './FinanceUI';
import { DataTable, type TableColumn } from './DataTable';

interface ReportDefinition {
  id: ReportId;
  title: string;
  /** The question the report answers, in one plain sentence */
  question: string;
  description: string;
  icon: string;
  tone: Tone;
  /** Shown instead of an empty table */
  empty: { title: string; hint: string };
}

/** In the order a practice uses them: money in, money owed, billing, appointments, staff, costs */
const REPORTS: ReportDefinition[] = [
  {
    id: 'daily_takings',
    title: 'Daily takings (cash-up)',
    question: 'How much did we take each day, and how was it paid?',
    description: 'Paid invoices per day by payment method (cash, card, EFT, medical aid), with day totals',
    icon: 'solar:wad-of-money-bold-duotone',
    tone: 'green',
    empty: { title: 'No payments in this period', hint: 'A payment shows here once its invoice is marked paid on the patient\'s Billing tab.' }
  },
  {
    id: 'collections',
    title: 'Collections',
    question: 'How were the invoices issued in this period paid?',
    description: 'Paid invoices by payment method',
    icon: 'solar:hand-money-bold-duotone',
    tone: 'green',
    empty: { title: 'No paid invoices in this period', hint: 'Invoices issued in this period appear here once they are marked paid.' }
  },
  {
    id: 'ar_aging',
    title: 'Accounts receivable aging',
    question: 'Who owes us money, and for how long?',
    description: 'Every unpaid invoice in aging columns (not yet due to 90+ days), with medical aid fund',
    icon: 'solar:clock-circle-bold-duotone',
    tone: 'orange',
    empty: { title: 'Nothing is owed', hint: 'Every invoice is paid or cancelled.' }
  },
  {
    id: 'fund_debtors',
    title: 'Debtors by medical aid fund',
    question: 'What does each medical aid owe us, and has the claim been sent?',
    description: 'Unpaid medical aid portion per fund: not batched, in an unsent batch, sent, and past the claim deadline',
    icon: 'solar:heart-pulse-bold-duotone',
    tone: 'cyan',
    empty: { title: 'No medical aid owes the practice anything', hint: 'Unpaid invoices with a medical aid portion appear here.' }
  },
  {
    id: 'revenue_by_tariff',
    title: 'Revenue by tariff code',
    question: 'Which services bring in the most?',
    description: 'Billed services by tariff code with quantities and the medical aid / patient split',
    icon: 'solar:tag-price-bold-duotone',
    tone: 'cyan',
    empty: { title: 'No billed services in this period', hint: 'The services on invoices issued in this period appear here.' }
  },
  {
    id: 'payer_mix',
    title: 'Payer mix',
    question: 'How much of what we bill do medical aids pay, and how much do patients pay?',
    description: 'Medical aid (per fund) and patient share of billed revenue',
    icon: 'solar:pie-chart-2-bold-duotone',
    tone: 'indigo',
    empty: { title: 'Nothing billed in this period', hint: 'Invoices issued in this period appear here.' }
  },
  {
    id: 'doctor_productivity',
    title: 'Doctor productivity',
    question: 'How many patients did each doctor see, and what did they bill and collect?',
    description: 'Per treating doctor: visits completed, invoices, billed, collected, billed per visit and collection rate',
    icon: 'solar:stethoscope-bold-duotone',
    tone: 'blue',
    empty: { title: 'No completed visits or invoices in this period', hint: 'Doctors appear here once their visits are completed or invoiced.' }
  },
  {
    id: 'attendance',
    title: 'Appointments and attendance',
    question: 'How many patients came, did not show up, or cancelled?',
    description: 'Per month: booked, attended, no-shows and cancellations, with no-show and cancellation rates',
    icon: 'solar:calendar-mark-bold-duotone',
    tone: 'amber',
    empty: { title: 'No appointments in this period', hint: 'Appointments and visits on days in this period appear here.' }
  },
  {
    id: 'payroll_vs_revenue',
    title: 'Payroll vs revenue',
    question: 'Are staff costs in line with what we bill?',
    description: 'Monthly gross payroll and its share of revenue billed, last 12 months',
    icon: 'solar:users-group-two-rounded-bold-duotone',
    tone: 'violet',
    empty: { title: 'No payroll or revenue to compare', hint: 'Payslips and invoices of the last 12 months appear here.' }
  },
  {
    id: 'statutory_payroll',
    title: 'PAYE, Social Security and pension',
    question: 'How much PAYE, Social Security and pension do we pay over for each month?',
    description: 'Monthly payslip totals to help with the NamRA PAYE return and the Social Security return',
    icon: 'solar:bill-check-bold-duotone',
    tone: 'red',
    empty: { title: 'No payslips in this period', hint: 'Payslips generated in Settings > Payroll appear here by pay period.' }
  },
  {
    id: 'expenses_by_category',
    title: 'Expenses by category',
    question: 'What did we spend money on each month?',
    description: 'Practice expenses per category (expense type) and month',
    icon: 'solar:card-transfer-bold-duotone',
    tone: 'red',
    empty: { title: 'No expenses in this period', hint: 'Expenses are recorded in Settings > Practice > Practice Overhead.' }
  },
  {
    id: 'inventory_valuation',
    title: 'Stock and equipment valuation',
    question: 'What are our stock and equipment worth today?',
    description: 'Inventory at cost per category, with expired stock and low-stock items',
    icon: 'solar:box-bold-duotone',
    tone: 'indigo',
    empty: { title: 'No inventory recorded', hint: 'Stock and equipment are recorded in Settings > Practice > Inventory.' }
  }
];

interface PreviewRow {
  key: string;
  cells: CsvCell[];
}

const ReportPreview: React.FC<{ report: ReportTable; empty: ReportDefinition['empty'] }> = ({ report, empty }) => {
  const rows: PreviewRow[] = report.rows.map((cells, index) => ({ key: String(index), cells }));
  const columns: TableColumn<PreviewRow>[] = report.columns.map((column, index) => ({
    key: `${index}`,
    header: column.header,
    align: column.type === 'money' || column.type === 'count' || column.type === 'percent' ? 'right' : 'left',
    render: row => displayValue(row.cells[index], column.type)
  }));
  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={row => row.key}
        resetKey={report.title}
        itemLabel="rows"
        totals={report.totals?.map((cell, index) => (cell === null || cell === undefined || cell === '' ? '' : displayValue(cell, report.columns[index].type)))}
        empty={<EmptyState compact icon="solar:document-text-bold-duotone" title={empty.title} message={empty.hint} />}
      />
      {report.notes && report.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-gray-500 list-disc pl-4">
          {report.notes.map(note => <li key={note}>{note}</li>)}
        </ul>
      )}
    </>
  );
};

interface ReportsTabProps {
  derived: FinanceDerived;
  workspace: FinanceWorkspace;
  labels: PeriodLabels;
  practiceName: string;
}

/** Printable and exportable reports built from the same figures as the dashboard and ledgers */
export const ReportsTab: React.FC<ReportsTabProps> = ({ derived, workspace, labels, practiceName }) => {
  const [previewId, setPreviewId] = useState<ReportId | null>(null);
  const results = useMemo(
    () => Object.fromEntries(REPORTS.map(r => [r.id, buildReport(r.id, derived, workspace, labels)])) as Record<ReportId, ReportResult>,
    [derived, workspace, labels]
  );
  const preview = previewId ? results[previewId].report : undefined;
  const previewDefinition = REPORTS.find(definition => definition.id === previewId);

  const print = (report: ReportTable) => {
    if (!printReport(report, practiceName)) toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map(definition => {
          const result = results[definition.id];
          const report = result.report;
          return (
            <div key={definition.id} className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col ${previewId === definition.id ? 'border-cyan-400 ring-1 ring-cyan-200' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <IconChip icon={definition.icon} tone={definition.tone} />
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900">{definition.title}</h3>
                  <p className="text-sm font-medium text-gray-800 mt-1">{definition.question}</p>
                  <p className="text-xs text-gray-500 mt-1">{definition.description}</p>
                </div>
              </div>
              <p className={`text-xs mt-3 mb-4 ${report ? 'text-gray-500' : 'text-amber-700'}`}>
                {report
                  ? `${report.basis} · ${report.rows.length > 0 ? pluralize(report.rows.length, 'row') : 'nothing to show'}`
                  : `Unavailable: ${result.unavailable}`}
              </p>
              <div className="flex flex-wrap gap-2 pt-4 mt-auto border-t border-gray-100">
                <ActionButton
                  icon="solar:eye-bold-duotone"
                  label={previewId === definition.id ? 'Hide' : 'Preview'}
                  onClick={() => setPreviewId(previewId === definition.id ? null : definition.id)}
                  disabled={!report}
                />
                <ActionButton icon="solar:download-minimalistic-bold-duotone" label="CSV" onClick={() => report && downloadReportCsv(report)} disabled={!report} />
                <ActionButton icon="solar:printer-minimalistic-bold-duotone" label="Print" onClick={() => report && print(report)} disabled={!report} />
              </div>
            </div>
          );
        })}
      </div>

      {preview && previewDefinition ? (
        <SectionCard
          title={preview.title}
          subtitle={preview.basis}
          icon="solar:document-text-bold-duotone"
          actions={
            <>
              <ActionButton icon="solar:download-minimalistic-bold-duotone" label="CSV" onClick={() => downloadReportCsv(preview)} />
              <ActionButton icon="solar:printer-minimalistic-bold-duotone" label="Print" variant="primary" onClick={() => print(preview)} />
            </>
          }
        >
          <ReportPreview report={preview} empty={previewDefinition.empty} />
        </SectionCard>
      ) : (
        <Notice tone="info">
          Choose Preview to read a report here, CSV to open it in Excel, or Print for a paper or PDF copy (use "Save as PDF" in the
          print dialog). Reports use the period selected at the top of the page; receivables, medical aid debtors and stock are as at today.
        </Notice>
      )}
    </div>
  );
};
