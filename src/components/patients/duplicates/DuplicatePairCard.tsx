import React, { useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { format, isValid, parseISO } from 'date-fns';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { StatTile } from '../../ui/StatTile';
import { PRIMARY, QUIET, SECONDARY } from '../../stock/stockUi';
import { DUPLICATE_REASON_LABELS } from '../../../utils/patients/duplicatePatients';
import type { DuplicatePair, PracticeFile } from '../../../utils/patients/duplicatePairs';
import type { FileRecordCounts } from '../../../utils/patients/patientMerge';
import { patientReferenceLabel } from '../../../utils/patients/patientNumbers';
import { isTemporaryIdNumber, patientFileStatus } from '../../../utils/patients/temporaryPatient';

const fullName = (file: PracticeFile): string => [file.first_name, file.last_name].filter(Boolean).join(' ') || 'Unnamed patient';

const birthLabel = (file: PracticeFile): string | null => {
  const birthDate = patientFileStatus(file).dateOfBirth;
  const date = birthDate ? parseISO(birthDate) : null;
  return date && isValid(date) ? `Born ${format(date, 'd MMM yyyy')}` : null;
};

/** One file of a pair: what tells the two apart, and how much history each has */
const FileSummary: React.FC<{ file: PracticeFile; counts: FileRecordCounts | undefined; onOpen: (patientId: string) => void }> = ({ file, counts, onOpen }) => {
  const reference = patientReferenceLabel(file.system_patient_reference_number);
  const details = [
    patientFileStatus(file).incomplete ? 'File not complete' : null,
    birthLabel(file),
    file.id_number && !isTemporaryIdNumber(file.id_number) ? `ID ${file.id_number}` : null,
    file.cell_number ? `Cell ${file.cell_number}` : null,
    reference ? `OneHealth ref ${reference}` : null,
    file.legacy_account_number ? `Old file no. ${file.legacy_account_number}` : null
  ].filter(Boolean);
  const medicalAid = file.medical_aid_details?.[0];
  return (
    <div className="min-w-0 rounded-xl bg-gray-50 p-3">
      <button
        type="button"
        onClick={() => onOpen(file.id)}
        className="max-w-full truncate rounded text-left font-semibold text-gray-900 underline-offset-2 hover:text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        title={`Open ${fullName(file)}'s file`}
      >
        {fullName(file)}
      </button>
      <p className="mt-0.5 break-words text-sm text-gray-600">{details.join(' · ')}</p>
      {medicalAid && (medicalAid.provider || medicalAid.membership_number) && (
        <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-gray-600">
          <MedicalAidLogo name={medicalAid.provider} />
          <span className="truncate">{[medicalAid.provider, medicalAid.membership_number].filter(Boolean).join(' ')}</span>
        </p>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatTile compact label="Visits" value={counts ? String(counts.visits) : '-'} icon="solar:calendar-bold-duotone" tone="violet" />
        <StatTile compact label="Invoices" value={counts ? String(counts.invoices) : '-'} icon="solar:bill-list-bold-duotone" tone="green" />
        <StatTile compact label="Claims" value={counts ? String(counts.claims) : '-'} icon="solar:shield-check-bold-duotone" tone="blue" />
      </div>
    </div>
  );
};

interface Props {
  pair: DuplicatePair;
  counts: ReadonlyMap<string, FileRecordCounts>;
  /** The file the finder suggests keeping (suggestKeptFile) */
  suggestedKeepId: string;
  /** False until the merge is set up in the database, or while another merge runs */
  canMerge: boolean;
  merging: boolean;
  onMerge: (keepPatientId: string, mergePatientId: string) => void;
  onOpenPatient: (patientId: string) => void;
}

/**
 * A pair of files that may be one person: why they matched, each file's details and history, and the merge. The
 * administrator chooses which file stays (the suggested one is the file with more history) and reads what happens
 * before anything moves.
 */
export const DuplicatePairCard: React.FC<Props> = ({ pair, counts, suggestedKeepId, canMerge, merging, onMerge, onOpenPatient }) => {
  const [confirming, setConfirming] = useState(false);
  const [keepId, setKeepId] = useState(suggestedKeepId);
  const choiceName = useId();
  const [first, second] = pair.files;
  const kept = keepId === second.id ? second : first;
  const archived = kept === first ? second : first;

  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <ul className="mb-3 flex flex-wrap gap-2" aria-label="Why these files may be one person">
        {pair.reasons.map(reason => (
          <li key={reason} className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            {DUPLICATE_REASON_LABELS[reason]}
          </li>
        ))}
      </ul>
      <div className="grid gap-3 md:grid-cols-2">
        <FileSummary file={first} counts={counts.get(first.id)} onOpen={onOpenPatient} />
        <FileSummary file={second} counts={counts.get(second.id)} onOpen={onOpenPatient} />
      </div>

      {!confirming ? (
        <div className="mt-4 flex justify-end">
          <button type="button" className={SECONDARY} disabled={!canMerge} onClick={() => { setKeepId(suggestedKeepId); setConfirming(true); }}>
            <Icon icon="solar:users-group-rounded-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Merge these files
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 rounded-xl bg-cyan-50 p-4">
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900">Which file stays?</legend>
            <div className="mt-2 space-y-2">
              {pair.files.map(file => {
                const fileCounts = counts.get(file.id);
                const reference = patientReferenceLabel(file.system_patient_reference_number);
                return (
                  <label key={file.id} className="flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 text-sm ring-1 ring-gray-200 has-[:checked]:ring-2 has-[:checked]:ring-cyan-500">
                    <input
                      type="radio"
                      name={choiceName}
                      value={file.id}
                      checked={keepId === file.id}
                      onChange={() => setKeepId(file.id)}
                      className="mt-0.5 h-4 w-4 flex-none text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-gray-900">{fullName(file)}</span>
                      {reference && <span className="text-gray-600"> · ref {reference}</span>}
                      {fileCounts && <span className="text-gray-600"> · {fileCounts.visits} visits, {fileCounts.invoices} invoices</span>}
                      {file.id === suggestedKeepId && (
                        <span className="ml-2 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-800">Suggested: more history</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="space-y-1 text-sm text-gray-700">
            <p>
              Everything on <strong>{fullName(archived)}</strong> moves to <strong>{fullName(kept)}</strong>: visits, invoices,
              receipts, claims, documents, notes, medical aid, account flags, lists and the rest.
            </p>
            <p>
              The other file is then archived: it no longer shows anywhere and points to the file that stays. Claim lines
              already sent to a fund stay as sent. The details of the file that stays (name, ID number, contact details) do
              not change.
            </p>
            <p>You can undo this under Merges until something new is added to the file that stays.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={QUIET} onClick={() => setConfirming(false)} disabled={merging}>
              Cancel
            </button>
            <button type="button" className={PRIMARY} disabled={merging || !canMerge} onClick={() => onMerge(kept.id, archived.id)}>
              <Icon icon="solar:users-group-rounded-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              {merging ? 'Merging...' : `Merge into ${fullName(kept)}`}
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

export default DuplicatePairCard;
