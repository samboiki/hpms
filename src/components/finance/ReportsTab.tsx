import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { AgeAnalysisFilter } from '../../services/ledgerService';
import type { FinanceDerived } from './deriveFinance';
import type { FinanceWorkspace } from './financeData';
import type { NavigateFn, PeriodLabels } from './financeNav';
import { buildReport, type ReportExtras, type ReportId, type ReportResult } from './reports';
import { downloadReportCsv, printReport, type ReportTable } from './financeExport';
import { pluralize } from './financeFormat';
import { ActionButton, IconChip, Notice, SectionCard, type Tone } from './FinanceUI';
import { ReportPreview } from './ReportPreview';
import { MonthEndPanel } from './controls/MonthEndPanel';
import { ageContext } from './debtors/debtorsContext';
import { useAccountDirectory } from './debtors/useAccountDirectory';
import { useAuthStore } from '../../stores/authStore';
import { isStaffAdmin } from '../settings/UserManagement/staffUtils';
import { LiveReportPanel } from './practiceReports/LiveReports';
import { LIVE_EXPORT_NAMES, LIVE_REPORTS, isLiveReportId, type LiveReportDefinition, type LiveReportId } from './practiceReports/liveReportDefinitions';
import { logReportExport } from './practiceReports/practiceReportsService';
import { useReportOpener } from './practiceReports/ReportOpener';
import { targetLabel } from './practiceReports/reportTargets';

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
    description: 'Payments per day by method (cash, card, EFT, debit order, medical aid), less refunds, with day totals',
    icon: 'solar:wad-of-money-bold-duotone',
    tone: 'green',
    empty: { title: 'No payments in this period', hint: 'Payments show here once they are received with Receive payment or, before receipts are set up, once their invoice is marked paid on the patient\'s Billing tab.' }
  },
  {
    id: 'collections',
    title: 'Collections',
    question: 'How was the money we collected paid?',
    description: 'Payments by method: receipts of the period, or paid invoices before receipts are set up',
    icon: 'solar:hand-money-bold-duotone',
    tone: 'green',
    empty: { title: 'No payments in this period', hint: 'Payments received in this period appear here.' }
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
    id: 'age_analysis',
    title: 'Age analysis',
    question: 'Who owes us, and how old is each debt?',
    description: 'Every account (a family under its account holder) in current, 30, 60, 90, 120, 150 and 180+ day columns, with credit not yet allocated and the net balance',
    icon: 'solar:sort-by-time-bold-duotone',
    tone: 'orange',
    empty: { title: 'Nothing is owed', hint: 'Accounts that owe money or hold credit appear here.' }
  },
  {
    id: 'fund_age_analysis',
    title: 'Medical aid age analysis',
    question: 'What does each fund owe, and how old are the claims?',
    description: 'The medical aid portion per fund and administrator in 30-day age columns, with fund payments still to match',
    icon: 'solar:shield-check-bold-duotone',
    tone: 'cyan',
    empty: { title: 'No medical aid owes the practice anything', hint: 'Unpaid invoices with a medical aid portion appear here.' }
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
    title: 'Practitioner productivity',
    question: 'How many patients did each practitioner see, and what did they bill and collect?',
    description: 'Per treating practitioner: visits completed, invoices, billed, collected, billed per visit and collection rate',
    icon: 'solar:stethoscope-bold-duotone',
    tone: 'blue',
    empty: { title: 'No completed visits or invoices in this period', hint: 'Practitioners appear here once their visits are completed or invoiced.' }
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
    empty: { title: 'No payslips in this period', hint: 'Payslips generated in Settings > Users > Payroll appear here by pay period.' }
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
    empty: { title: 'No inventory recorded', hint: 'Stock and equipment are recorded in Stock > Items.' }
  }
];

/**
 * The fixed reports and Finance > Reports' own (live) reports on one grid, in the order a practice uses them: a live
 * report sits after the fixed report it belongs with (one Reports place: parity R5, R7, R17, R18, R20, R30, G10).
 */
type GridEntry = { kind: 'fixed'; definition: ReportDefinition } | { kind: 'live'; definition: LiveReportDefinition };

const LIVE_AFTER: Partial<Record<ReportId, LiveReportId[]>> = {
  collections: ['cash_by_practitioner', 'transactions'],
  // Which age of debt the money paid: with the age analysis (parity R1)
  age_analysis: ['payments_by_age'],
  fund_debtors: ['fund_patients', 'invoices_per_fund', 'claims_dashboard'],
  // Discounts take from what is billed: after revenue by tariff code (parity R3)
  revenue_by_tariff: ['discounts'],
  // The year so far per tariff code, fund and practitioner (parity R21)
  payer_mix: ['year_to_date'],
  doctor_productivity: ['diagnoses'],
  // Who the patients are and what they spend (parity R26, R28)
  attendance: ['demographics', 'spend_by_town'],
  statutory_payroll: ['who_did_what'],
  // Stock moved and what it made, then the practice's own reports (parity R8, R9, R22)
  inventory_valuation: ['stock_movement', 'gross_profit', 'report_builder']
};

function gridEntries(isAdmin: boolean): GridEntry[] {
  return REPORTS.flatMap(definition => [
    { kind: 'fixed' as const, definition },
    ...(LIVE_AFTER[definition.id] ?? [])
      .map(id => LIVE_REPORTS[id])
      .filter(live => !live.adminOnly || isAdmin)
      .map(live => ({ kind: 'live' as const, definition: live }))
  ]);
}

/** Every report's name by its download key, for the downloads listed in "who did what" */
const REPORT_NAMES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(REPORTS.map(definition => [definition.id, definition.title])),
  ...LIVE_EXPORT_NAMES
};

/**
 * The two older cards that Debtors > Age analysis now does better (filters, totals, every row opening its account, CSV
 * and print of what is on screen): once Debtors is in use they stay where staff look for them and open it, on the
 * matching grouping, instead of building a second copy of the table.
 */
const OPENS_AGE_ANALYSIS: Partial<Record<ReportId, Partial<AgeAnalysisFilter>>> = {
  age_analysis: { grouping: 'account', portion: 'both' },
  fund_age_analysis: { grouping: 'fund', portion: 'medical_aid', excludeFlags: [] }
};

const doNothing = () => undefined;

interface ReportsTabProps {
  derived: FinanceDerived;
  workspace: FinanceWorkspace;
  labels: PeriodLabels;
  practiceName: string;
  /** A report opened by a link (/finance?tab=reports&report=claims_dashboard) */
  openReport?: string | null;
  /** Opens another part of Finance (the age analysis cards open Debtors > Age analysis) */
  onNavigate?: NavigateFn;
  /** A change made from a record a row opened (a payment refunded or reversed): Finance reloads its figures */
  onChanged?: () => void;
}

/** Printable and exportable reports built from the same figures as the dashboard and ledgers; every row opens what it counts */
export const ReportsTab: React.FC<ReportsTabProps> = ({ derived, workspace, labels, practiceName, openReport, onNavigate, onChanged }) => {
  const [previewId, setPreviewId] = useState<ReportId | null>(null);
  const user = useAuthStore(state => state.user);
  const isAdmin = isStaffAdmin(user);
  const [liveId, setLiveId] = useState<LiveReportId | null>(null);
  const livePanel = useRef<HTMLDivElement>(null);
  // A link names a report: open it (an administrators-only report stays closed for everyone else)
  useEffect(() => {
    if (!isLiveReportId(openReport)) return;
    if (LIVE_REPORTS[openReport].adminOnly && !isAdmin) return;
    setPreviewId(null);
    setLiveId(openReport);
  }, [openReport, isAdmin]);
  // On a phone the opened report is below every card: bring it into view (a jump, not an animation)
  useEffect(() => {
    if (liveId) livePanel.current?.scrollIntoView?.({ block: 'start' });
  }, [liveId]);
  // Family accounts and flags (once receipts and the debtors tables exist) group the age analyses by account holder
  const directory = useAccountDirectory(workspace.practiceId, workspace.ar?.state === 'ready');
  const receipts = workspace.ar?.state === 'ready' ? workspace.ar.receipts : undefined;
  const ages = useMemo(() => ageContext({
    patientNames: { ...directory.holderNames, ...workspace.patientNames },
    schemeByPatient: workspace.schemeByPatient,
    links: directory.links,
    flags: directory.flags,
    receipts,
    payers: workspace.payers
  }), [directory.holderNames, directory.links, directory.flags, workspace.patientNames, workspace.schemeByPatient, receipts, workspace.payers]);
  const extras = useMemo<ReportExtras | undefined>(() => (directory.state === 'ready' ? { ageContext: ages } : undefined), [directory.state, ages]);
  // The cards only need each table; what rows open is worked out for the previewed report alone
  const results = useMemo(
    () => Object.fromEntries(REPORTS.map(r => [r.id, buildReport(r.id, derived, workspace, labels, extras, { targets: false })])) as Record<ReportId, ReportResult>,
    [derived, workspace, labels, extras]
  );
  const preview = previewId ? results[previewId].report : undefined;
  const previewTargets = useMemo(
    () => (previewId ? buildReport(previewId, derived, workspace, labels, extras).targets : undefined),
    [previewId, derived, workspace, labels, extras]
  );
  const previewDefinition = REPORTS.find(definition => definition.id === previewId);
  // A previewed row opens what it counts: an invoice, a payment, the records behind a total (as the newer reports' rows do)
  const { open, element: opened } = useReportOpener({ practiceId: workspace.practiceId, practiceName, patientNames: workspace.patientNames, onChanged: onChanged ?? doNothing });
  const rowName = (index: number): string =>
    String(preview?.rows[index]?.find(cell => typeof cell === 'string' && cell.trim()) ?? `row ${index + 1}`).trim();
  // Debtors > Age analysis is there once receipts (and with them Debtors) are in use
  const ageAnalysisInDebtors = !!onNavigate && workspace.ar?.state === 'ready';

  // Every download and print is recorded for the practice's "who did what" (it never holds the download up)
  const record = (id: ReportId, format: 'csv' | 'print', report: ReportTable) =>
    void logReportExport(workspace.practiceId, { report: id, format, range: labels.ranges.current, rows: report.rows.length });
  const csv = (id: ReportId, report: ReportTable) => {
    downloadReportCsv(report);
    record(id, 'csv', report);
  };
  const print = (id: ReportId, report: ReportTable) => {
    if (!printReport(report, practiceName)) {
      toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
      return;
    }
    record(id, 'print', report);
  };

  // The age analysis cards in the look of the newer cards: one Open, into Debtors > Age analysis on their grouping
  const ageAnalysisCard = (definition: ReportDefinition, ageFilter: Partial<AgeAnalysisFilter>) => (
    <div key={definition.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col">
      <div className="flex items-start gap-3">
        <IconChip icon={definition.icon} tone={definition.tone} />
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">{definition.title}</h3>
          <p className="text-sm font-medium text-gray-800 mt-1">{definition.question}</p>
          <p className="text-xs text-gray-500 mt-1">{definition.description}</p>
        </div>
      </div>
      <p className="text-xs mt-3 mb-4 text-gray-500">In Debtors &gt; Age analysis · filters, totals and a link on every row</p>
      <div className="flex flex-wrap gap-2 pt-4 mt-auto border-t border-gray-100">
        <ActionButton
          icon="solar:eye-bold-duotone"
          label="Open"
          title="Open Debtors > Age analysis"
          onClick={() => onNavigate?.({ tab: 'debtors', debtorsView: 'ages', ageFilter })}
        />
      </div>
    </div>
  );

  const fixedCard = (definition: ReportDefinition) => {
    const ageFilter = OPENS_AGE_ANALYSIS[definition.id];
    if (ageFilter && ageAnalysisInDebtors) return ageAnalysisCard(definition, ageFilter);
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
            onClick={() => {
              setLiveId(null);
              setPreviewId(previewId === definition.id ? null : definition.id);
            }}
            disabled={!report}
          />
          <ActionButton icon="solar:download-minimalistic-bold-duotone" label="CSV" onClick={() => report && csv(definition.id, report)} disabled={!report} />
          <ActionButton icon="solar:printer-minimalistic-bold-duotone" label="Print" onClick={() => report && print(definition.id, report)} disabled={!report} />
        </div>
      </div>
    );
  };

  // A live report reads its rows when opened, so its card offers Open (CSV and Print are on the report)
  const liveCard = (definition: LiveReportDefinition) => (
    <div key={definition.id} className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col ${liveId === definition.id ? 'border-cyan-400 ring-1 ring-cyan-200' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <IconChip icon={definition.icon} tone={definition.tone} />
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">{definition.title}</h3>
          <p className="text-sm font-medium text-gray-800 mt-1">{definition.question}</p>
          <p className="text-xs text-gray-500 mt-1">{definition.description}</p>
        </div>
      </div>
      <p className="text-xs mt-3 mb-4 text-gray-500">{definition.basis(labels)} · filters, totals and a link on every row</p>
      <div className="flex flex-wrap gap-2 pt-4 mt-auto border-t border-gray-100">
        <ActionButton
          icon="solar:eye-bold-duotone"
          label={liveId === definition.id ? 'Hide' : 'Open'}
          onClick={() => {
            setPreviewId(null);
            setLiveId(liveId === definition.id ? null : definition.id);
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <MonthEndPanel workspace={workspace} derived={derived} labels={labels} practiceName={practiceName} ageContext={ages} />
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {gridEntries(isAdmin).map(entry => (entry.kind === 'fixed' ? fixedCard(entry.definition) : liveCard(entry.definition)))}
      </div>

      {liveId ? (
        <div ref={livePanel} className="scroll-mt-4">
          <LiveReportPanel
            id={liveId}
            practiceId={workspace.practiceId}
            practiceName={practiceName}
            labels={labels}
            workspace={workspace}
            derived={derived}
            ageContext={ages}
            reportNames={REPORT_NAMES}
          />
        </div>
      ) : preview && previewDefinition ? (
        <SectionCard
          title={preview.title}
          subtitle={preview.basis}
          icon="solar:document-text-bold-duotone"
          actions={
            <>
              <ActionButton icon="solar:download-minimalistic-bold-duotone" label="CSV" onClick={() => previewId && csv(previewId, preview)} />
              <ActionButton icon="solar:printer-minimalistic-bold-duotone" label="Print" variant="primary" onClick={() => previewId && print(previewId, preview)} />
            </>
          }
        >
          <ReportPreview
            report={preview}
            empty={previewDefinition.empty}
            onRowClick={previewTargets?.some(Boolean) ? index => {
              const target = previewTargets[index];
              if (target) open(target);
            } : undefined}
            rowLabel={previewTargets ? index => {
              const target = previewTargets[index];
              return target ? targetLabel(target, rowName(index)) : rowName(index);
            } : undefined}
          />
        </SectionCard>
      ) : (
        <Notice tone="info">
          Choose Preview to read a report here, CSV to open it in Excel, or Print for a paper or PDF copy (use "Save as PDF" in the
          print dialog). Reports use the period selected at the top of the page; receivables, medical aid debtors and stock are as at today.
        </Notice>
      )}
      {opened}
    </div>
  );
};
