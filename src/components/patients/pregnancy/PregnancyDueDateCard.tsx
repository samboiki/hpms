import React, { useCallback, useEffect, useId, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useDentalPractice } from '../../dental/useDentalPractice';
import { useOptometryPractice } from '../../optometry/useOptometryPractice';
import { DueDatesNotSetUpError, loadDueDate, saveDueDate } from '../../../services/pregnancyService';
import { canHaveDueDate, dueDateFromLastPeriod, dueDateProblem, gestationText } from '../../../utils/clinical/pregnancy';
import { formatServiceDate } from '../../../utils/billing/dates';
import { windhoekClock } from '../../../utils/patientLists/listDates';
import { INPUT, LABEL, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from '../../patientLists/listStyles';

interface PregnancyDueDateCardProps {
  practiceId: string;
  patientId: string;
  /** The file's gender: a patient recorded as male is not offered a due date */
  gender?: string | null;
}

type State = { status: 'loading' } | { status: 'not_set_up' } | { status: 'error'; message: string } | { status: 'ready'; dueDate: string | null };

/**
 * The pregnancy due date on the patient file's Overview (GP, specialist, nursing and therapy practices; never in dental
 * or optometry practices): how far along the patient is, set or change the date (typed, or worked out from the last
 * period), clear it when the pregnancy ends. The due-dates list is in Messages > Lists > Due dates.
 */
export const PregnancyDueDateCard: React.FC<PregnancyDueDateCardProps> = ({ practiceId, patientId, gender = null }) => {
  const isDental = useDentalPractice(practiceId);
  const isOptometry = useOptometryPractice(practiceId);
  const keeps = isDental === false && isOptometry === false;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [lastPeriod, setLastPeriod] = useState('');
  const [fromPeriod, setFromPeriod] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const todayKey = windhoekClock(new Date()).dateKey;

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', dueDate: await loadDueDate(patientId) });
    } catch (error) {
      setState(error instanceof DueDatesNotSetUpError ? { status: 'not_set_up' } : { status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not read the due date.' });
    }
  }, [patientId]);

  useEffect(() => {
    if (!keeps) return;
    setState({ status: 'loading' });
    setEditing(false);
    void load();
  }, [keeps, load]);

  if (!keeps) return null;
  const dueDate = state.status === 'ready' ? state.dueDate : null;
  // Nothing to show for a patient recorded as male without a due date (one on file still shows, so it can be cleared)
  if (state.status === 'ready' && !dueDate && !canHaveDueDate(gender)) return null;
  if (state.status === 'loading') return null;

  const startEditing = () => {
    setDraft(dueDate ?? '');
    setLastPeriod('');
    setFromPeriod(false);
    setProblem(null);
    setEditing(true);
  };

  const worked = fromPeriod && lastPeriod ? dueDateFromLastPeriod(lastPeriod, todayKey) : null;
  const chosen = fromPeriod ? (worked && 'dueDate' in worked ? worked.dueDate : '') : draft;

  const save = async (value: string | null) => {
    if (value !== null) {
      const issue = fromPeriod && worked && 'problem' in worked ? worked.problem : dueDateProblem(value, todayKey);
      if (issue) {
        setProblem(issue);
        return;
      }
    }
    setSaving(true);
    try {
      await saveDueDate(practiceId, patientId, value);
      toast.success(value ? 'Due date saved.' : 'Due date cleared.');
      setEditing(false);
      setState({ status: 'ready', dueDate: value });
    } catch (error) {
      setProblem(error instanceof Error ? plainWords(error.message) : 'Could not save the due date.');
    } finally {
      setSaving(false);
    }
  };

  const clear = () => {
    if (!window.confirm('Clear the due date? Do this when the pregnancy has ended. The change history keeps the old date.')) return;
    void save(null);
  };

  const headingId = `${id}-heading`;

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg bg-rose-100 p-1.5 text-rose-600">
            <Icon icon="solar:heart-pulse-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Pregnancy
            </h3>
            {state.status === 'not_set_up' && <p className="mt-0.5 text-sm text-gray-500">Pregnancy due dates are not set up in this database yet.</p>}
            {state.status === 'error' && (
              <p className="mt-0.5 text-sm text-red-700" role="alert">
                {state.message}{' '}
                <button type="button" className="font-medium underline" onClick={() => void load()}>
                  Try again
                </button>
              </p>
            )}
            {state.status === 'ready' &&
              (dueDate ? (
                <>
                  <p className="mt-0.5 text-base font-semibold text-gray-900">Due {formatServiceDate(dueDate)}</p>
                  <p className="text-sm text-gray-600">{gestationText(dueDate, todayKey)}</p>
                </>
              ) : (
                <p className="mt-0.5 text-sm text-gray-600">No due date recorded.</p>
              ))}
          </div>
        </div>
        {state.status === 'ready' && !editing && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={QUIET_BUTTON} onClick={startEditing}>
              <Icon icon={dueDate ? 'solar:pen-bold-duotone' : 'solar:add-circle-bold-duotone'} className="h-4 w-4 text-purple-600" aria-hidden="true" />
              {dueDate ? 'Change' : 'Add due date'}
            </button>
            {dueDate && (
              <button type="button" className={QUIET_BUTTON} onClick={clear} disabled={saving}>
                <Icon icon="solar:eraser-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <form
          className="mt-4 space-y-3 border-t border-gray-100 pt-4"
          onSubmit={event => {
            event.preventDefault();
            void save(chosen);
          }}
        >
          {fromPeriod ? (
            <div className="max-w-xs">
              <label htmlFor={`${id}-period`} className={LABEL}>
                First day of the last period
              </label>
              <input
                id={`${id}-period`}
                type="date"
                className={INPUT}
                max={todayKey}
                value={lastPeriod}
                onChange={event => {
                  setLastPeriod(event.target.value);
                  setProblem(null);
                }}
              />
              <p className={`mt-1 text-sm ${worked && 'problem' in worked ? 'text-red-700' : 'text-gray-700'}`} aria-live="polite">
                {worked && 'dueDate' in worked && (
                  <>
                    Due date: <span className="font-semibold">{formatServiceDate(worked.dueDate)}</span> (40 weeks later)
                  </>
                )}
                {worked && 'problem' in worked && worked.problem}
              </p>
            </div>
          ) : (
            <div className="max-w-xs">
              <label htmlFor={`${id}-due`} className={LABEL}>
                Due date
              </label>
              <input
                id={`${id}-due`}
                type="date"
                className={INPUT}
                value={draft}
                onChange={event => {
                  setDraft(event.target.value);
                  setProblem(null);
                }}
              />
            </div>
          )}
          <button
            type="button"
            className="text-sm font-medium text-purple-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            onClick={() => {
              setFromPeriod(value => !value);
              setProblem(null);
            }}
          >
            {fromPeriod ? 'Type the due date instead' : 'Work it out from the last period'}
          </button>
          {problem && (
            <p className="text-sm text-red-700" role="alert">
              {problem}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={PRIMARY_BUTTON} disabled={saving || !chosen}>
              {saving ? 'Saving...' : 'Save due date'}
            </button>
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

export default PregnancyDueDateCard;
