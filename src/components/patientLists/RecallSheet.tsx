import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { isRecallsNotSetUpError, patientRecallService } from '../../services/patientRecallService';
import { addMonthsToKey } from '../../utils/billing/dates';
import { windhoekClock } from '../../utils/patientLists/listDates';
import {
  RECALL_INTERVALS,
  RECALL_LIMITS,
  RECALL_REASON_SUGGESTIONS,
  recallInputProblem,
  sortRecallsForFile,
  type PatientRecall
} from '../../utils/patientLists/recalls';
import { ListSheet } from './ListSheet';
import { formatDateKey, recallStatusText } from './listDisplay';
import { lookFor } from './listPresets';
import { CHIP, INPUT, LABEL, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from './listStyles';

export interface RecallSheetProps {
  open: boolean;
  onClose: () => void;
  practiceId: string | null | undefined;
  patientId: string;
  patientName: string;
  /** Set from this visit (the booking's actions); that visit never counts as the patient coming back */
  visitId?: string | null;
  /** After a recall was saved, changed or removed */
  onChanged?: () => void;
}

type LoadState = 'loading' | 'ready' | 'not_set_up' | 'error';

/** The recall look on the Lists screens ("Recall due"), so a recall reads the same everywhere */
const RECALL_LOOK = lookFor({ type: 'recall_due', months: 6, visitTypes: [] });

/**
 * A patient's recalls (parity O3): when to call them back and why, set on the file or from a visit. A recall is done
 * once a matching booking is made (the database decides: proposals/2026-10-12-patient-recalls.sql), and the
 * "Recall due" list calls the patient on its date.
 */
export const RecallSheet: React.FC<RecallSheetProps> = ({ open, onClose, practiceId, patientId, patientName, visitId = null, onChanged }) => {
  const todayKey = windhoekClock(new Date()).dateKey;
  const [state, setState] = useState<LoadState>('loading');
  const [recalls, setRecalls] = useState<PatientRecall[]>([]);
  const [editing, setEditing] = useState<PatientRecall | null>(null);
  const [dueOn, setDueOn] = useState('');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!practiceId) {
      setState('error');
      return;
    }
    setState((previous) => (previous === 'ready' ? 'ready' : 'loading'));
    try {
      setRecalls(await patientRecallService.loadForPatient(practiceId, patientId));
      setState('ready');
    } catch (error) {
      setState(isRecallsNotSetUpError(error) ? 'not_set_up' : 'error');
    }
  }, [practiceId, patientId]);

  const clearForm = () => {
    setEditing(null);
    setDueOn('');
    setReason('');
    setProblem(null);
  };

  useEffect(() => {
    if (!open) return;
    clearForm();
    void load();
  }, [open, load]);

  const startChange = (recall: PatientRecall) => {
    setEditing(recall);
    setDueOn(recall.dueOn < todayKey ? '' : recall.dueOn);
    setReason(recall.reason);
    setProblem(null);
    dateRef.current?.focus();
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!practiceId) return;
    const found = recallInputProblem({ dueOn, reason }, todayKey);
    setProblem(found);
    if (found) return;
    setBusy('save');
    try {
      await patientRecallService.setRecall({ practiceId, patientId, dueOn, reason, visitId: editing ? null : visitId, recallId: editing?.id ?? null });
      toast.success(editing ? 'Recall changed.' : `Recall set for ${patientName}.`);
      clearForm();
      await load();
      onChanged?.();
    } catch (error) {
      setProblem(isRecallsNotSetUpError(error) ? 'Recalls are not set up in this database yet.' : error instanceof Error ? error.message : 'Could not save the recall.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (recall: PatientRecall) => {
    if (!practiceId) return;
    setBusy(recall.id);
    try {
      await patientRecallService.removeRecall(practiceId, recall.id);
      toast.success('Recall removed.');
      if (editing?.id === recall.id) setEditing(null);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the recall.');
    } finally {
      setBusy(null);
    }
  };

  // Removed recalls are history; seen ones stay a while so staff see the patient came
  const shown = sortRecallsForFile(recalls).filter((recall) => recall.status !== 'removed').slice(0, 6);
  const maxDate = addMonthsToKey(todayKey, RECALL_LIMITS.yearsAhead * 12);

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      title={`Recall for ${patientName}`}
      subtitle="The day to call the patient back, and why. It is done once they book."
      initialFocus={dateRef}
    >
      {state === 'not_set_up' && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="status">
          Recalls are not set up in this database yet.
        </p>
      )}
      {state === 'error' && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          The recalls could not be loaded.{' '}
          <button type="button" onClick={() => void load()} className="font-medium underline">
            Try again
          </button>
        </div>
      )}
      {state === 'loading' && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading recalls">
          <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
        </div>
      )}

      {state === 'ready' && (
        <div className="space-y-5">
          <section aria-labelledby="recall-list">
            <h3 id="recall-list" className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Recalls
            </h3>
            {shown.length === 0 ? (
              <p className="text-sm text-gray-500">No recall set.</p>
            ) : (
              <ul className="space-y-1">
                {shown.map((recall) => (
                  <li key={recall.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${RECALL_LOOK.tile}`}>
                      <Icon icon={RECALL_LOOK.icon} className={`h-4 w-4 ${RECALL_LOOK.iconColor}`} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{recall.reason}</p>
                      <p className={`truncate text-xs ${recall.status === 'open' && recall.dueOn < todayKey ? 'text-amber-700' : 'text-gray-500'}`}>
                        {recallStatusText(recall, todayKey)}
                      </p>
                    </div>
                    {recall.status === 'open' && (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startChange(recall)}
                          disabled={busy !== null}
                          className={QUIET_BUTTON}
                          aria-label={`Change the recall: ${recall.reason}`}
                        >
                          <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          <span className="hidden sm:inline">Change</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(recall)}
                          disabled={busy !== null}
                          className={QUIET_BUTTON}
                          aria-label={`Remove the recall: ${recall.reason}`}
                        >
                          <Icon
                            icon={busy === recall.id ? 'solar:refresh-bold-duotone' : 'solar:trash-bin-minimalistic-bold-duotone'}
                            className={`h-4 w-4 ${busy === recall.id ? 'animate-spin motion-reduce:animate-none' : ''}`}
                            aria-hidden="true"
                          />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      </span>
                    )}
                    {recall.status !== 'open' && (
                      <span className={`${CHIP} shrink-0 ${recall.status === 'seen' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'}`}>
                        {recall.status === 'seen' ? 'Done' : 'Booked'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form onSubmit={(event) => void save(event)} className="space-y-4" aria-labelledby="recall-form-title" noValidate>
            <h3 id="recall-form-title" className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {editing ? 'Change the recall' : 'Set a recall'}
            </h3>
            <div>
              <label htmlFor="recall-date" className={LABEL}>
                When?
              </label>
              <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick dates">
                {RECALL_INTERVALS.map((interval) => {
                  const date = interval.dateFrom(todayKey);
                  return (
                    <button
                      key={interval.id}
                      type="button"
                      onClick={() => setDueOn(date)}
                      aria-pressed={dueOn === date}
                      className={`${CHIP} border px-2.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                        dueOn === date ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {interval.label}
                    </button>
                  );
                })}
              </div>
              <input
                ref={dateRef}
                id="recall-date"
                type="date"
                value={dueOn}
                min={todayKey}
                max={maxDate}
                onChange={(event) => setDueOn(event.target.value)}
                className={INPUT}
                aria-describedby="recall-date-words"
              />
              {/* The day in words, day first, whatever order the browser shows the field in */}
              <p id="recall-date-words" className="mt-1 text-xs text-gray-500" aria-live="polite">
                {dueOn ? `Recall on ${formatDateKey(dueOn)}` : 'Tap a quick date or pick a day.'}
              </p>
            </div>
            <div>
              <label htmlFor="recall-reason" className={LABEL}>
                What for?
              </label>
              <input
                id="recall-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={RECALL_LIMITS.reasonMax}
                placeholder="e.g. 6-monthly check-up"
                className={INPUT}
                autoComplete="off"
              />
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Common reasons">
                {RECALL_REASON_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setReason(suggestion)}
                    className={`${CHIP} border border-gray-200 bg-white px-2.5 py-1 text-gray-600 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
            {problem && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
                {problem}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy !== null || !practiceId} className={PRIMARY_BUTTON}>
                <Icon
                  icon={busy === 'save' ? 'solar:refresh-bold-duotone' : 'solar:calendar-mark-bold-duotone'}
                  className={`h-5 w-5 ${busy === 'save' ? 'animate-spin motion-reduce:animate-none' : ''}`}
                  aria-hidden="true"
                />
                {editing ? 'Save the change' : 'Set recall'}
              </button>
              {editing && (
                <button type="button" onClick={clearForm} disabled={busy !== null} className={SECONDARY_BUTTON}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </ListSheet>
  );
};

export default RecallSheet;
