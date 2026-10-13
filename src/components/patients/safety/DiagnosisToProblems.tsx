import React, { useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { addProblem } from '../../../services/patientSafetyService';
import { suggestProblemsFromDiagnosis, type ProblemSuggestion } from '../../../utils/clinical/problemList';
import { usePatientSafety } from './usePatientSafety';

interface DiagnosisToProblemsProps {
  patientId: string;
  practiceId: string | null | undefined;
  /** The visit, once it exists (a new visit gets its id when first saved) */
  visitId: string | null | undefined;
  /** The diagnosis as typed so far */
  diagnosis: string | null | undefined;
}

/**
 * Under the visit diagnosis: "Add to problem list" chips, one per ICD-10 code in the diagnosis (or the
 * diagnosis itself when it has no code). One tap adds it; nothing shows when there is nothing new.
 */
export const DiagnosisToProblems: React.FC<DiagnosisToProblemsProps> = ({ patientId, practiceId, visitId, diagnosis }) => {
  const safety = usePatientSafety(patientId);
  const [busy, setBusy] = useState<string | null>(null);

  if (safety.status !== 'ready' || !safety.data || !practiceId) return null;
  const suggestions = suggestProblemsFromDiagnosis(diagnosis, safety.data.problems);
  if (suggestions.length === 0) return null;

  const add = async (suggestion: ProblemSuggestion) => {
    const key = suggestion.icd10Code ?? suggestion.description;
    setBusy(key);
    try {
      await addProblem(practiceId, patientId, {
        description: suggestion.description,
        icd10Code: suggestion.icd10Code,
        chronic: false,
        onsetDate: null,
        sourceVisitId: visitId ?? null
      });
      await safety.refresh();
      toast.success(`${suggestion.description} added to the problem list.`);
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not add it to the problem list.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-gray-600">Add to problem list:</span>
      {suggestions.map(suggestion => {
        const key = suggestion.icd10Code ?? suggestion.description;
        const label = suggestion.icd10Code ? `${suggestion.description} (${suggestion.icd10Code})` : suggestion.description;
        return (
          <button
            key={key}
            type="button"
            disabled={busy !== null}
            onClick={() => void add(suggestion)}
            aria-label={`Add ${label} to the problem list`}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-100 transition-colors hover:bg-purple-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50"
          >
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{busy === key ? 'Adding...' : label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DiagnosisToProblems;
