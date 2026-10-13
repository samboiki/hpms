import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Scan } from 'lucide-react';
import { loadPatientImagingRequests, type PatientImagingLoad, type PatientImagingRequest } from '../../services/imagingReportService';
import { imagingReportFromRow, imagingTypeLabel } from '../../utils/clinical/imagingReports';
import { formatDiaryDate } from '../../utils/diary/diaryTime';
import { ImagingReportDialog } from './ImagingReportDialog';
import { ImagingLabelButton, ImagingReportButton, ImagingReportRow } from './ImagingReportParts';
import { ImagingReportLabelSheet } from './ImagingReportLabelSheet';

interface ImagingReportsPanelProps {
  patientId: string;
  onOpenVisit: (visitId: string) => void;
}

const COLUMNS = 8;
const HEADING = 'px-4 py-3 text-left text-sm font-semibold text-gray-700';

const STATUS: Record<string, { label: string; chip: string }> = {
  pending: { label: 'Pending', chip: 'bg-yellow-100 text-yellow-800' },
  scheduled: { label: 'Scheduled', chip: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'In progress', chip: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', chip: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', chip: 'bg-gray-100 text-gray-800' }
};

const dateOrNa = (value: string | null | undefined): string => (value ? formatDiaryDate(value.slice(0, 10)) : 'N/A');

/**
 * The patient file's Imaging tab (parity C12): the patient's imaging requests across visits with the radiologist's
 * report under each, adding or changing a report, and a request's label. A row opens its visit.
 */
export const ImagingReportsPanel: React.FC<ImagingReportsPanelProps> = ({ patientId, onOpenVisit }) => {
  const [load, setLoad] = useState<PatientImagingLoad | null>(null);
  const [reporting, setReporting] = useState<PatientImagingRequest | null>(null);
  const [labelling, setLabelling] = useState<PatientImagingRequest | null>(null);

  const reload = useCallback(async () => {
    setLoad(await loadPatientImagingRequests(patientId));
  }, [patientId]);

  useEffect(() => {
    setLoad(null);
    void reload();
  }, [reload]);

  const requests = load?.state === 'ready' ? load.requests : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-indigo-600" />
          <h3 className="text-xl font-bold text-gray-900">Requests and Reports</h3>
          <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Radiology reports and labels</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 overscroll-x-contain">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className={HEADING}>Visit #</th>
                <th className={HEADING}>Visit Date</th>
                <th className={HEADING}>Type</th>
                <th className={HEADING}>Request Date</th>
                <th className={HEADING}>Body Part</th>
                <th className={HEADING}>Status</th>
                <th className={HEADING}>Report</th>
                <th className={HEADING}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {load === null ? (
                Array.from({ length: 2 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="animate-pulse">
                    {Array.from({ length: COLUMNS }).map((__, cell) => (
                      <td key={cell} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : load.state === 'error' ? (
                <tr>
                  <td className="px-4 py-3 text-sm text-red-600" colSpan={COLUMNS} role="alert">
                    {load.message}
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-600" colSpan={COLUMNS}>
                    <div className="text-center py-8">
                      <Scan className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No imaging requests found</p>
                      <p className="text-sm text-gray-400">Requests made on a visit's Imaging tab appear here with their reports</p>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((request) => {
                  const report = imagingReportFromRow(request);
                  const status = STATUS[request.status ?? ''] ?? { label: request.status ?? 'N/A', chip: 'bg-gray-100 text-gray-800' };
                  const visitId = request.visit_id;
                  return (
                    <React.Fragment key={request.id}>
                      <tr
                        className={`hover:bg-blue-50 hover:shadow-sm transition-all duration-200 ${visitId ? 'cursor-pointer' : ''}`}
                        onClick={visitId ? () => onOpenVisit(visitId) : undefined}
                      >
                        <td className="px-4 py-3">
                          {visitId ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenVisit(visitId);
                              }}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              aria-label={`Open the visit${request.visit?.visit_number ? ` ${request.visit.visit_number}` : ''}`}
                            >
                              {request.visit?.visit_number || 'N/A'}
                            </button>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{dateOrNa(request.visit?.visit_date)}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center">
                            <Scan className="w-4 h-4 text-indigo-600 mr-2" />
                            <span className="font-medium text-gray-900">{imagingTypeLabel(request.imaging_type)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{dateOrNa(request.request_date)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{request.body_part || 'Not specified'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${status.chip}`}>{status.label}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{report ? (report.reportedOn ? formatDiaryDate(report.reportedOn) : 'Reported') : 'None yet'}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1">
                            <ImagingReportButton request={request} onClick={() => setReporting(request)} tone="indigo" />
                            <ImagingLabelButton request={request} onClick={() => setLabelling(request)} tone="indigo" />
                          </div>
                        </td>
                      </tr>
                      <ImagingReportRow request={request} columns={COLUMNS} cellClassName="px-4 pb-3 pt-0" tone="indigo" />
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reporting && (
        <ImagingReportDialog
          request={reporting}
          onClose={() => setReporting(null)}
          onSaved={() => {
            setReporting(null);
            void reload();
          }}
        />
      )}
      <ImagingReportLabelSheet patientId={patientId} request={labelling} onClose={() => setLabelling(null)} />
    </div>
  );
};

export default ImagingReportsPanel;
