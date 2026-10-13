import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { formatServiceDate } from '../../utils/billing/dates';
import { describeMonths, recallSuggestions, withoutKnownRecalls, type RecallSuggestion, type RuledTariff } from '../../utils/billing/codeRules';
import { windhoekClock } from '../../utils/patientLists/listDates';
import { isRecallsNotSetUpError, patientRecallService } from '../../services/patientRecallService';
import { loadSkippedRecallOffers, skipRecallOffers } from '../../services/recallOfferSkipService';

/**
 * The offers staff skipped for this visit, by code: the database remembers them (recallOfferSkipService.ts), so saving
 * the visit again, on this computer or another, does not ask again. Unreadable: offered again, never an error.
 */
async function skippedCodes(visitId: string | null | undefined): Promise<Set<string>> {
  if (!visitId) return new Set();
  try {
    return await loadSkippedRecallOffers(visitId);
  } catch (error) {
    console.warn('The skipped recall offers could not be read:', error);
    return new Set();
  }
}

interface RecallOfferProps {
  visible: boolean;
  patientName: string | null;
  suggestions: readonly RecallSuggestion[];
  onSet: () => Promise<string | null>;
  onSkip: () => void;
}

/**
 * The offer itself (a toast, so it stays on screen after the visit screen closes): the recall date from the code's
 * interval and what it is for; one tap sets it, one tap skips it. Styled like the app's other toasts.
 */
export const RecallOffer: React.FC<RecallOfferProps> = ({ visible, patientName, suggestions, onSet, onSkip }) => {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const several = suggestions.length > 1;

  const set = async () => {
    setBusy(true);
    setProblem(null);
    const failed = await onSet();
    setBusy(false);
    if (failed) setProblem(failed);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full max-w-sm rounded-lg bg-[#363636] p-4 text-sm text-white shadow-lg transition-opacity motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <p className="font-semibold">{`Set ${several ? `${suggestions.length} recalls` : 'a recall'} for ${patientName ?? 'this patient'}?`}</p>
      <ul className="mt-1 space-y-0.5 text-white/90">
        {suggestions.map(suggestion => (
          <li key={`${suggestion.code}-${suggestion.dueOn}`}>
            {suggestion.reason} on {formatServiceDate(suggestion.dueOn)} (in {describeMonths(suggestion.months)}, from code {suggestion.code})
          </li>
        ))}
      </ul>
      {problem && (
        <p className="mt-2 text-red-200" role="alert">
          {problem}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void set()}
          disabled={busy}
          className="rounded-lg bg-[#01b9d4] px-3 py-1.5 font-medium text-white hover:bg-[#019bb3] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-60"
        >
          {busy ? 'Setting...' : several ? 'Set recalls' : 'Set recall'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="rounded-lg px-3 py-1.5 font-medium text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-60"
        >
          Skip
        </button>
      </div>
    </div>
  );
};

export interface VisitRecallOfferInput {
  practiceId: string | null | undefined;
  patientId: string | null | undefined;
  visitId: string | null | undefined;
  /** yyyy-MM-dd: the visit's date (a line's own date counts for that line) */
  visitDate: string;
  /** The lines just invoiced */
  lines: readonly { code: string; serviceDate?: string }[];
  /** The billable tariffs with their codes' rules */
  tariffs: readonly RuledTariff[];
}

/**
 * Parity O2: after an invoice is saved, offers a recall for the patient for each invoiced code that has one (the
 * practice's rules per code: the date is the service date plus the code's months). Nothing is offered when the patient
 * has that recall coming already, when staff skipped it for this visit and code (on any computer: the database keeps
 * the skip), or when recalls are not set up; it never stops the save. The recall is set with the visit it came from
 * (patient_recalls, set_patient_recall).
 */
export async function offerVisitRecalls(input: VisitRecallOfferInput): Promise<void> {
  const { practiceId, patientId, visitId } = input;
  if (!practiceId || !patientId) return;
  try {
    // The practice's day, as the recall rules count it (set_patient_recall)
    const today = windhoekClock(new Date()).dateKey;
    let suggestions = recallSuggestions(input.lines, input.tariffs, { visitDate: input.visitDate, today });
    if (suggestions.length === 0) return;
    const skipped = await skippedCodes(visitId);
    suggestions = suggestions.filter(suggestion => !skipped.has(suggestion.code));
    if (suggestions.length === 0) return;
    suggestions = withoutKnownRecalls(suggestions, await patientRecallService.loadForPatient(practiceId, patientId), today);
    if (suggestions.length === 0) return;
    const names = await patientRecallService.loadPatients(practiceId, [patientId]).catch(() => new Map<string, { name: string }>());
    const patientName = names.get(patientId)?.name ?? null;
    const id = `recall-offer-${visitId ?? patientId}`;

    const set = async (): Promise<string | null> => {
      try {
        for (const suggestion of suggestions) {
          await patientRecallService.setRecall({ practiceId, patientId, dueOn: suggestion.dueOn, reason: suggestion.reason, visitId: visitId ?? null });
        }
        toast.dismiss(id);
        const dates = suggestions.map(suggestion => formatServiceDate(suggestion.dueOn)).join(' and ');
        toast.success(`Recall set for ${dates}. Change it on the patient's file under Recall.`, { duration: 6000 });
        return null;
      } catch (error) {
        return isRecallsNotSetUpError(error)
          ? 'Recalls are not set up in this database yet.'
          : error instanceof Error && error.message
            ? error.message
            : 'The recall could not be set.';
      }
    };
    const skip = () => {
      toast.dismiss(id);
      // Remembered for this visit and code; when it cannot be (not set up, offline) the offer may come back next save
      if (visitId) {
        skipRecallOffers(practiceId, visitId, suggestions.map(suggestion => suggestion.code)).catch((error: unknown) =>
          console.warn('The skipped recall offer could not be remembered:', error)
        );
      }
    };

    toast.custom(
      offer => <RecallOffer visible={offer.visible} patientName={patientName} suggestions={suggestions} onSet={set} onSkip={skip} />,
      { id, duration: Infinity }
    );
  } catch (error) {
    // Not set up yet, or the recalls could not be read: no offer, and the invoice is saved as it is
    if (!isRecallsNotSetUpError(error)) console.warn('A recall could not be offered:', error);
  }
}
