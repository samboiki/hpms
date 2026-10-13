import React from 'react';
import { toast } from 'react-hot-toast';
import type { DateRange } from '../../../services/ledgerService';
import { downloadReportCsv, printReport } from '../financeExport';
import { ActionButton, ErrorState, LoadingState, Notice, SectionCard, type Tone } from '../FinanceUI';
import { ReportPreview } from '../ReportPreview';
import { logReportExport, type ReportExport } from './practiceReportsService';
import { targetLabel, type LinkedReport, type ReportTarget } from './reportTargets';

export type FrameState = { state: 'loading' } | { state: 'ready' } | { state: 'not_set_up'; message: string } | { state: 'error'; error: string };

interface ReportFrameProps {
  title: string;
  subtitle: string;
  icon: string;
  tone?: Tone;
  /** report_exports.report: which report was downloaded or printed */
  exportKey: string;
  practiceId: string;
  practiceName: string;
  range: DateRange | null;
  /** Ids and choices only, recorded with a download or print */
  exportFilters?: ReportExport['filters'];
  status: FrameState;
  onRetry?: () => void;
  report: LinkedReport | null;
  empty: { title: string; hint: string };
  /** Filters and views, above the table */
  controls?: React.ReactNode;
  /** What a row opens (the report's own targets); a summary row may filter instead */
  onRowClick?: (index: number) => void;
  /** Accessible name of a summary row that filters */
  rowLabel?: (index: number) => string;
  onOpen: (target: ReportTarget) => void;
  /** Back to page 1 when the filters change */
  resetKey?: string;
  children?: React.ReactNode;
}

/**
 * One of Finance > Reports' own reports, in the same card, table and buttons as the fixed reports' preview: filters,
 * the table (each row opens what it counts), CSV and Print. Every download and print is recorded (report_exports) for
 * the practice's "who did what"; the download never waits for that record.
 */
export const ReportFrame: React.FC<ReportFrameProps> = ({
  title, subtitle, icon, tone = 'cyan', exportKey, practiceId, practiceName, range, exportFilters, status, onRetry, report, empty,
  controls, onRowClick, rowLabel, onOpen, resetKey, children
}) => {
  const ready = status.state === 'ready' && report !== null;
  const record = (format: 'csv' | 'print') => {
    if (!report) return;
    void logReportExport(practiceId, { report: exportKey, format, range, rows: report.table.rows.length, filters: exportFilters });
  };
  const csv = () => {
    if (!report) return;
    downloadReportCsv(report.table);
    record('csv');
  };
  const print = () => {
    if (!report) return;
    if (!printReport(report.table, practiceName)) {
      toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
      return;
    }
    record('print');
  };
  const rowName = (index: number): string =>
    report?.names?.[index] ?? String(report?.table.rows[index]?.find(cell => typeof cell === 'string' && cell.trim()) ?? `row ${index + 1}`);

  return (
    <SectionCard
      title={title}
      subtitle={report && ready ? report.table.basis : subtitle}
      icon={icon}
      tone={tone}
      actions={
        <>
          <ActionButton icon="solar:download-minimalistic-bold-duotone" label="CSV" onClick={csv} disabled={!ready} />
          <ActionButton icon="solar:printer-minimalistic-bold-duotone" label="Print" variant="primary" onClick={print} disabled={!ready} />
        </>
      }
    >
      <div className="space-y-4">
        {controls}
        {children}
        {status.state === 'loading' && <LoadingState label={`Loading ${title.toLowerCase()}`} rows={5} />}
        {status.state === 'not_set_up' && <Notice tone="warning">{status.message}</Notice>}
        {status.state === 'error' && <ErrorState title={`Could not load ${title.toLowerCase()}`} message={status.error} onRetry={onRetry} />}
        {ready && report && (
          <ReportPreview
            report={report.table}
            empty={empty}
            resetKey={resetKey}
            onRowClick={onRowClick || report.targets.some(Boolean) ? index => {
              if (onRowClick) onRowClick(index);
              else if (report.targets[index]) onOpen(report.targets[index] as ReportTarget);
            } : undefined}
            rowLabel={index => {
              if (rowLabel) return rowLabel(index);
              const target = report.targets[index];
              return target ? targetLabel(target, rowName(index)) : rowName(index);
            }}
          />
        )}
      </div>
    </SectionCard>
  );
};
