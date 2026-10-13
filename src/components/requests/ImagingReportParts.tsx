import React, { useState } from 'react';
import { ClipboardList, FileText, Tag } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  canWriteImagingReport,
  describeImagingReport,
  imagingReportFromRow,
  imagingTypeLabel
} from '../../utils/clinical/imagingReports';
import type { ImagingRequestForReport } from './ImagingReportDialog';

/** The visit's Imaging tab is purple, the patient file's Imaging tab indigo */
type Tone = 'purple' | 'indigo';

const ICON_BUTTON: Record<Tone, string> = {
  purple: 'p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors',
  indigo: 'p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors'
};

const REPORT_EDGE: Record<Tone, string> = { purple: 'border-purple-200', indigo: 'border-indigo-200' };
const REPORT_LINK: Record<Tone, string> = { purple: 'text-purple-600 hover:text-purple-700', indigo: 'text-indigo-600 hover:text-indigo-700' };

interface RequestButtonProps {
  request: ImagingRequestForReport;
  onClick: () => void;
  tone?: Tone;
}

/** Add or change the report: practitioners, nurses and practice administrators, on a request that was not cancelled */
export const ImagingReportButton: React.FC<RequestButtonProps> = ({ request, onClick, tone = 'purple' }) => {
  const role = useAuthStore((state) => state.user?.role);
  if (!canWriteImagingReport(role) || request.status === 'cancelled') return null;
  const reported = imagingReportFromRow(request) !== null;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={ICON_BUTTON[tone]}
      title={reported ? 'Change the report' : 'Add the report'}
      aria-label={`${reported ? 'Change the report on' : 'Add the report to'} the ${imagingTypeLabel(request.imaging_type)} request`}
    >
      <ClipboardList className="w-4 h-4" />
    </button>
  );
};

/** Print the request's label (for the film packet or the envelope) */
export const ImagingLabelButton: React.FC<RequestButtonProps> = ({ request, onClick, tone = 'purple' }) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    className={ICON_BUTTON[tone]}
    title="Print a label"
    aria-label={`Print a label for the ${imagingTypeLabel(request.imaging_type)} request`}
  >
    <Tag className="w-4 h-4" />
  </button>
);

// A longer report shows its start until "Show the whole report"
const SHORT_REPORT = 600;

interface ImagingReportRowProps {
  request: ImagingRequestForReport;
  /** The table's columns: the report spans them all */
  columns: number;
  /** The table's cell padding */
  cellClassName: string;
  tone?: Tone;
}

/** The report in a row under its request (nothing when it has none): who reported and when, then the report */
export const ImagingReportRow: React.FC<ImagingReportRowProps> = ({ request, columns, cellClassName, tone = 'purple' }) => {
  const [whole, setWhole] = useState(false);
  const report = imagingReportFromRow(request);
  if (!report?.text) return null;
  const long = report.text.length > SHORT_REPORT;
  const shown = long && !whole ? `${report.text.slice(0, SHORT_REPORT).trimEnd()}...` : report.text;
  return (
    <tr className="!border-t-0">
      <td colSpan={columns} className={cellClassName}>
        <div className={`border-l-4 pl-4 ${REPORT_EDGE[tone]}`}>
          <p className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <FileText className="w-4 h-4" aria-hidden="true" />
            Radiology report
          </p>
          <p className="mt-1 text-sm text-gray-600">{describeImagingReport(report)}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-900">{shown}</p>
          {long && (
            <button type="button" onClick={() => setWhole((current) => !current)} className={`mt-1 text-sm font-medium ${REPORT_LINK[tone]}`}>
              {whole ? 'Show less' : 'Show the whole report'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
