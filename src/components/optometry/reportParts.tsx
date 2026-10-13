import React from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { SECONDARY } from '../stock/stockUi';
import { downloadReportCsv, printReport, type ReportTable } from '../finance/financeExport';
import { logReportExport } from '../finance/practiceReports/practiceReportsService';

/** Table cells of the optometry reports (as the report's summary tables; an amount stays on one line) */
export const TH = 'px-2 py-1.5 text-left text-xs font-medium text-gray-500';
export const TD = 'px-2 py-1.5 text-sm text-gray-800';
export const NUM = 'whitespace-nowrap px-2 py-1.5 text-right text-sm tabular-nums text-gray-800';
// relative: a screen-reader-only header inside stays in the box instead of widening the page on a phone
export const TABLE_BOX = 'relative overflow-x-auto rounded-xl border border-gray-100';

/** A report with patients' names in it: each print or download is recorded (who, when, which report, how many rows) */
export interface ExportLog {
  /** report_exports.report: lower case, digits and underscores */
  report: string;
  from?: string | null;
  to?: string | null;
}

/**
 * Print and CSV for one report table, as on the Stock reports. `table` is built when pressed, so the export always
 * matches what is on screen.
 */
export const ExportButtons: React.FC<{ practiceId: string; table: () => ReportTable | null; log?: ExportLog; disabled?: boolean }> = ({ practiceId, table, log, disabled }) => {
  const practiceName = useAuthStore(state => state.user?.practices?.name) || 'Practice';
  const record = (format: 'csv' | 'print', rows: number) => {
    if (!log) return;
    const range = log.from && log.to ? { startKey: log.from, endKey: log.to } : null;
    void logReportExport(practiceId, { report: log.report, format, range, rows });
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={SECONDARY}
        disabled={disabled}
        onClick={() => {
          const report = table();
          if (!report) return;
          if (!printReport(report, practiceName)) {
            toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
            return;
          }
          record('print', report.rows.length);
        }}
      >
        <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        Print
      </button>
      <button
        type="button"
        className={SECONDARY}
        disabled={disabled}
        onClick={() => {
          const report = table();
          if (!report) return;
          downloadReportCsv(report);
          record('csv', report.rows.length);
        }}
      >
        <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        CSV
      </button>
    </div>
  );
};

/** Loading, error with Try again, or "not set up" for one report */
export const ReportStatus: React.FC<{ status: 'loading' | 'error' | 'not_set_up'; message?: string; onRetry?: () => void; notSetUp?: React.ReactNode }> = ({
  status,
  message,
  onRetry,
  notSetUp
}) => {
  if (status === 'loading') return <p className="py-6 text-center text-sm text-gray-500" role="status">Building the report...</p>;
  if (status === 'not_set_up') return <>{notSetUp}</>;
  return (
    <div className="space-y-2 py-4 text-center" role="alert">
      <p className="text-sm text-red-700">{message ?? 'Could not build the report.'}</p>
      {onRetry && <button type="button" className={SECONDARY} onClick={onRetry}>Try again</button>}
    </div>
  );
};

/** "Frame barcodes are not set up yet" for the reports that need them */
export const BarcodesNotSetUp: React.FC = () => (
  <p className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-sm text-gray-600" role="status">
    This report needs the frame barcodes and consignment update to the practice&apos;s database. Until it is applied, frames sold
    and the presbyopic patients are in the Summary.
  </p>
);
