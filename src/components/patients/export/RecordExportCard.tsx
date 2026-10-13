import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../../stores/authStore';
import { exportRecordSummary, exportRecordZip, type ExportProgress, type RecordExportResult } from '../../../services/patientRecordExportService';
import { ClinicalDialog } from '../safety/ClinicalDialog';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../patientLists/listStyles';

interface RecordExportCardProps {
  practiceId: string;
  patientId: string;
}

type Format = 'zip' | 'pdf';

const progressText = (progress: ExportProgress | null): string => {
  if (!progress || progress.stage === 'reading') return 'Reading the record...';
  if (progress.stage === 'packing') return 'Putting the ZIP together...';
  return progress.total === 0 ? 'No documents to add.' : `Adding documents: ${progress.done} of ${progress.total}...`;
};

/**
 * "Patient record" on the patient file's Overview: everything on the file in one download, as a summary PDF
 * (details, alerts, visits with notes and diagnoses, medicines, results, letters, notes, invoices and payments) with
 * the stored documents in a ZIP, or the summary alone. It holds what the person exporting may see; other
 * practitioners' private notes are never in it.
 */
export const RecordExportCard: React.FC<RecordExportCardProps> = ({ practiceId, patientId }) => {
  const user = useAuthStore(store => store.user);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>('zip');
  const [includePrivate, setIncludePrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<RecordExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setFormat('zip');
    setIncludePrivate(false);
    setProgress(null);
    setResult(null);
    setError(null);
    setOpen(true);
  };

  const run = async () => {
    if (!user?.id) {
      setError('Sign in again to export the record.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const options = { practiceId, patientId, userId: user.id, includeMyPrivateNotes: includePrivate };
      setResult(format === 'zip' ? await exportRecordZip({ ...options, onProgress: setProgress }) : await exportRecordSummary(options));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'The record could not be exported. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby={`record-export-${patientId}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
            <Icon icon="solar:folder-with-files-bold-duotone" className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 id={`record-export-${patientId}`} className="text-base font-semibold text-gray-900">
            Patient record
          </h3>
        </div>
        <button type="button" className={SECONDARY_BUTTON} onClick={start}>
          <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4 text-purple-600" aria-hidden="true" />
          Export the record
        </button>
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Everything on this file in one download: a summary PDF of the details, alerts, visits, medicines, results, letters, notes,
        invoices and payments, with the stored documents.
      </p>

      <ClinicalDialog
        open={open}
        onClose={() => setOpen(false)}
        title={result ? 'Record exported' : 'Export the record'}
        dismissible={!busy}
        footer={
          result ? (
            <div className="flex justify-end">
              <button type="button" className={PRIMARY_BUTTON} onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className={PRIMARY_BUTTON} onClick={() => void run()} disabled={busy}>
                {busy ? 'Exporting...' : 'Export'}
              </button>
            </div>
          )
        }
      >
        {result ? (
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900" role="status">
            <Icon icon="solar:check-circle-bold-duotone" className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="font-semibold">{result.fileName}</p>
              <p>
                Saved to your downloads.
                {format === 'zip' &&
                  ` ${result.documentsAdded} ${result.documentsAdded === 1 ? 'document' : 'documents'} added${
                    result.documentsMissing > 0 ? `; ${result.documentsMissing} could not be added (the summary says which)` : ''
                  }.`}
              </p>
              <p className="mt-1 text-emerald-800">It holds confidential medical information: keep it safe and share it only with people entitled to it.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-gray-700">What to export</legend>
              <div className="space-y-2 text-sm text-gray-700">
                <label className="flex items-start gap-2">
                  <input type="radio" name={`record-format-${patientId}`} className="mt-0.5 h-4 w-4 accent-purple-600" checked={format === 'zip'} onChange={() => setFormat('zip')} disabled={busy} />
                  <span>
                    <span className="font-medium text-gray-900">Summary and documents (ZIP)</span>
                    <span className="block text-gray-500">The summary PDF with every stored scan, photo, result, letter and signed form.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="radio" name={`record-format-${patientId}`} className="mt-0.5 h-4 w-4 accent-purple-600" checked={format === 'pdf'} onChange={() => setFormat('pdf')} disabled={busy} />
                  <span>
                    <span className="font-medium text-gray-900">Summary only (PDF)</span>
                    <span className="block text-gray-500">To print, or to send when the documents are not needed.</span>
                  </span>
                </label>
              </div>
            </fieldset>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-purple-600" checked={includePrivate} onChange={event => setIncludePrivate(event.target.checked)} disabled={busy} />
              <span>
                Include my private notes
                <span className="block text-gray-500">Only your own. Other practitioners&apos; private notes are never exported.</span>
              </span>
            </label>
            <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
              The export holds what you may see on this file. It is confidential medical information: keep it safe and share it only
              with people entitled to it.
            </p>
            {busy && (
              <p className="flex items-center gap-2 text-sm text-gray-700" role="status" aria-live="polite">
                <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 text-purple-600 motion-safe:animate-spin" aria-hidden="true" />
                {progressText(progress)}
              </p>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </ClinicalDialog>
    </section>
  );
};

export default RecordExportCard;
