import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ClipboardList, Loader2, User } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import DatePickerModal from '../ui/DatePickerModal';
import { saveImagingReport } from '../../services/imagingReportService';
import {
  checkImagingReport,
  IMAGING_REPORT_MAX,
  imagingReportFromRow,
  imagingTypeLabel,
  RADIOLOGIST_NAME_MAX
} from '../../utils/clinical/imagingReports';
import { formatDiaryDate, parseDateKey, toDateKey } from '../../utils/diary/diaryTime';

/** An imaging request as the visit's and the patient file's Imaging tabs read it */
export interface ImagingRequestForReport {
  id: string;
  imaging_type: string;
  body_part?: string | null;
  request_date?: string | null;
  status?: string | null;
  completed_date?: string | null;
  report_text?: string | null;
  radiologist_name?: string | null;
  reported_on?: string | null;
  reported_at?: string | null;
}

interface ImagingReportDialogProps {
  request: ImagingRequestForReport;
  onClose: () => void;
  /** After the report was saved (the request is completed now) */
  onSaved: () => void;
}

const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent';

/**
 * The radiologist's report on an imaging request (parity C12), in the look of the imaging request form
 * (ImagingRequestSimple): the report, who reported and the date on the report. Practitioners, nurses and practice
 * administrators only (save_imaging_report checks the same).
 */
export const ImagingReportDialog: React.FC<ImagingReportDialogProps> = ({ request, onClose, onSaved }) => {
  const existing = useMemo(() => imagingReportFromRow(request), [request]);
  const today = useMemo(() => toDateKey(new Date()), []);
  const [report, setReport] = useState(existing?.text ?? '');
  const [radiologist, setRadiologist] = useState(existing?.radiologist ?? '');
  // A Date kept in state: the date picker reloads whenever the date it is given is a new object
  const [reportDate, setReportDate] = useState<Date>(() => parseDateKey(existing?.reportedOn ?? today) ?? new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const earliest = useMemo(() => parseDateKey(request.request_date?.slice(0, 10)) ?? undefined, [request.request_date]);
  const latest = useMemo(() => parseDateKey(today) ?? undefined, [today]);
  const changed = report !== (existing?.text ?? '') || radiologist !== (existing?.radiologist ?? '');

  // Escape never throws a typed report away, nor closes the visit or the patient file underneath
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (showDatePicker) setShowDatePicker(false);
      else if (!changed && !saving) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [changed, saving, showDatePicker, onClose]);

  const close = () => {
    if (changed && !window.confirm('Close without saving the report?')) return;
    onClose();
  };

  const save = async () => {
    const draft = { report, radiologist, reportedOn: toDateKey(reportDate) };
    const found = checkImagingReport(draft, { requestDate: request.request_date ?? null, status: request.status ?? null }, today);
    setProblems(found);
    if (found.length > 0 || saving) return;
    setSaving(true);
    try {
      const result = await saveImagingReport(request.id, draft);
      if (!result.ok) {
        setProblems([result.message]);
        return;
      }
      toast.success(existing ? 'Report changed' : 'Report saved');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const bodyPart = request.body_part && request.body_part !== 'Not specified' ? `: ${request.body_part}` : '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="imaging-report-title" className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-full overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 id="imaging-report-title" className="text-2xl font-bold text-gray-900">
            {existing ? 'Change the Report' : 'Add the Report'}
          </h2>
          <p className="text-gray-600 mt-1">
            {imagingTypeLabel(request.imaging_type)}
            {bodyPart}
            {request.request_date ? `, requested ${formatDiaryDate(request.request_date.slice(0, 10))}` : ''}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="imaging-report-text" className="block text-sm font-medium text-gray-700 mb-1">
              <ClipboardList className="w-4 h-4 inline mr-1" />
              Report
            </label>
            <textarea
              id="imaging-report-text"
              value={report}
              onChange={(event) => setReport(event.target.value)}
              rows={8}
              maxLength={IMAGING_REPORT_MAX}
              placeholder="The radiologist's findings and conclusion"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="imaging-report-radiologist" className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Radiologist (Optional)
            </label>
            <input
              id="imaging-report-radiologist"
              type="text"
              value={radiologist}
              onChange={(event) => setRadiologist(event.target.value)}
              maxLength={RADIOLOGIST_NAME_MAX}
              placeholder="e.g., Dr A Example"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="imaging-report-date" className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date on the Report
            </label>
            <button
              id="imaging-report-date"
              type="button"
              onClick={() => setShowDatePicker(true)}
              className={`${INPUT_CLASS} text-left hover:bg-gray-50 transition-colors`}
            >
              {format(reportDate, 'dd MMM yyyy')}
            </button>
          </div>

          {problems.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Report'
              )}
            </button>
          </div>
        </div>
      </div>

      <DatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(date) => setReportDate(date)}
        selectedDate={reportDate}
        minDate={earliest}
        maxDate={latest}
        title="Select the Date on the Report"
      />
    </div>
  );
};

export default ImagingReportDialog;
