import React, { useCallback, useEffect, useState } from 'react';
import { EminanceClaimHistoryDialog } from '../import/EminanceClaimHistoryDialog';
import { loadPatientFileNumbers } from '../../services/patientFileService';
import { hasLegacyClaimHistory } from '../../services/import/eminanceImportService';
import { PATIENT_FILE_NUMBERS_CHANGED, patientReferenceLabel } from '../../utils/patients/patientNumbers';

interface ShownNumbers {
  reference: string | null;
  oldFileNumber: string | null;
  hasEminanceHistory: boolean;
}

/**
 * The numbers a patient is known by, small under the name in the patient file header: the OneHealth reference (on
 * claims and statements), the old file number (paper file or previous system) and, for a patient brought over from
 * Eminance, a link to the claim history that came with them. Read when the file opens and again when the edit form
 * saves a new old file number.
 */
export const PatientFileNumbers: React.FC<{ patientId?: string | null; className?: string }> = ({ patientId, className = '' }) => {
  const [numbers, setNumbers] = useState<ShownNumbers | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  useEffect(() => {
    if (!patientId) return;
    const onChanged = (event: Event) => {
      if ((event as CustomEvent<string>).detail === patientId) setVersion(current => current + 1);
    };
    window.addEventListener(PATIENT_FILE_NUMBERS_CHANGED, onChanged);
    return () => window.removeEventListener(PATIENT_FILE_NUMBERS_CHANGED, onChanged);
  }, [patientId]);

  useEffect(() => {
    setNumbers(null);
    setHistoryOpen(false);
    if (!patientId) return;
    let active = true;
    // The header works without them: a failed read only hides the line
    Promise.all([loadPatientFileNumbers(patientId), hasLegacyClaimHistory(patientId).catch(() => false)])
      .then(([file, hasEminanceHistory]) => {
        if (active) setNumbers({ reference: patientReferenceLabel(file.reference), oldFileNumber: file.oldFileNumber, hasEminanceHistory });
      })
      .catch(error => console.warn('Patient file numbers not loaded:', error instanceof Error ? error.message : error));
    return () => {
      active = false;
    };
  }, [patientId, version]);

  if (!patientId || !numbers || (!numbers.reference && !numbers.oldFileNumber && !numbers.hasEminanceHistory)) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs ${className}`}>
      {numbers.reference && (
        <span>
          OneHealth ref <span className="font-semibold tabular-nums">{numbers.reference}</span>
        </span>
      )}
      {numbers.oldFileNumber && (
        <span>
          Old file no. <span className="font-semibold">{numbers.oldFileNumber}</span>
        </span>
      )}
      {numbers.hasEminanceHistory && (
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          aria-haspopup="dialog"
          className="rounded underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Eminance claim history
        </button>
      )}
      {historyOpen && <EminanceClaimHistoryDialog patientId={patientId} accountNumber={numbers.oldFileNumber} onClose={closeHistory} />}
    </p>
  );
};

export default PatientFileNumbers;
