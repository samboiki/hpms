import React, { useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { addProblem, setProblemStatus, type ProblemRecord } from '../../../services/patientSafetyService';
import { describeIcd10, normalizeIcd10 } from '../../../utils/billing/icd10';
import { validateProblemInput, type ProblemStatus } from '../../../utils/clinical/problemList';
import Icd10SearchInput from '../../billing/Icd10SearchInput';
import { CHIP, INPUT, LABEL, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from '../../patientLists/listStyles';
import { formatSafetyDate } from './safetyFormat';

interface ProblemPanelProps {
  practiceId: string;
  patientId: string;
  problems: readonly ProblemRecord[];
  /** The visit open on the visit screen: a problem added here remembers it */
  visitId?: string | null;
  onChanged: () => Promise<void>;
}

const ProblemLine: React.FC<{ problem: ProblemRecord }> = ({ problem }) => (
  <span className="min-w-0">
    <span className="block text-sm font-medium text-gray-900">{problem.description}</span>
    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
      {problem.icd10Code && <span className={`${CHIP} bg-gray-100 font-mono text-gray-700`}>{problem.icd10Code}</span>}
      {problem.chronic && <span className={`${CHIP} bg-purple-50 text-purple-700`}>Chronic</span>}
      {problem.onsetDate && <span>Since {formatSafetyDate(problem.onsetDate)}</span>}
      {problem.status === 'past' && problem.resolvedDate && <span>Ended {formatSafetyDate(problem.resolvedDate)}</span>}
    </span>
  </span>
);

/** Active and past problems with ICD-10 codes: add, move to past, make active again. */
export const ProblemPanel: React.FC<ProblemPanelProps> = ({ practiceId, patientId, problems, visitId = null, onChanged }) => {
  const [adding, setAdding] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [chronic, setChronic] = useState(false);
  const [onsetDate, setOnsetDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const baseId = useId();

  const active = problems.filter(problem => problem.status === 'active');
  const past = problems.filter(problem => problem.status === 'past');

  const run = async (key: string, action: () => Promise<void>, success: string): Promise<boolean> => {
    setBusy(key);
    try {
      await action();
      await onChanged();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That did not work. Try again.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const startAdding = () => {
    setDescription('');
    setCode('');
    setChronic(false);
    setOnsetDate('');
    setFormError(null);
    setAdding(true);
    setTimeout(() => descriptionRef.current?.focus(), 0);
  };

  const fillFromCode = () => {
    const normalized = normalizeIcd10(code);
    setCode(normalized);
    if (!description.trim()) setDescription(describeIcd10(normalized) ?? '');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateProblemInput({ description, icd10Code: code });
    if (!checked.ok) {
      setFormError(checked.error);
      return;
    }
    setFormError(null);
    const ok = await run(
      'add',
      () =>
        addProblem(practiceId, patientId, {
          description: checked.value.description,
          icd10Code: checked.value.icd10Code,
          chronic,
          onsetDate: onsetDate || null,
          sourceVisitId: visitId
        }),
      `${checked.value.description} added to the problem list.`
    );
    if (ok) setAdding(false);
  };

  const changeStatus = (problem: ProblemRecord, status: ProblemStatus, success: string) =>
    run(`${status}-${problem.id}`, () => setProblemStatus(problem.id, status), success);

  return (
    <section aria-labelledby={`${baseId}-title`} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${baseId}-title`} className="text-sm font-semibold text-gray-900">
          Problems
        </h3>
        {!adding && (
          <button type="button" className={QUIET_BUTTON} onClick={startAdding}>
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Add problem
          </button>
        )}
      </div>

      {active.length === 0 && !adding && <p className="text-sm text-gray-500">No active problems recorded.</p>}

      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map(problem => (
            <li key={problem.id} className="flex items-start justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <ProblemLine problem={problem} />
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className={QUIET_BUTTON}
                  disabled={busy !== null}
                  onClick={() => void changeStatus(problem, 'past', `${problem.description} moved to past problems.`)}
                >
                  Mark past
                </button>
                <button
                  type="button"
                  className={QUIET_BUTTON}
                  disabled={busy !== null}
                  aria-label={`Remove ${problem.description}: added by mistake`}
                  title="Added by mistake"
                  onClick={() => void changeStatus(problem, 'entered_in_error', `${problem.description} removed.`)}
                >
                  <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <div>
          <button type="button" className={QUIET_BUTTON} aria-expanded={showPast} onClick={() => setShowPast(value => !value)}>
            <Icon
              icon="solar:alt-arrow-down-bold-duotone"
              className={`h-4 w-4 motion-safe:transition-transform ${showPast ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            Past problems ({past.length})
          </button>
          {showPast && (
            <ul className="mt-2 space-y-2">
              {past.map(problem => (
                <li key={problem.id} className="flex items-start justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2">
                  <ProblemLine problem={problem} />
                  <button
                    type="button"
                    className={QUIET_BUTTON}
                    disabled={busy !== null}
                    onClick={() => void changeStatus(problem, 'active', `${problem.description} is active again.`)}
                  >
                    Active again
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {adding && (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3" noValidate>
          <div>
            <label htmlFor={`${baseId}-description`} className={LABEL}>
              Problem
            </label>
            <input
              id={`${baseId}-description`}
              ref={descriptionRef}
              className={INPUT}
              value={description}
              maxLength={200}
              placeholder="e.g. Hypertension"
              onChange={event => setDescription(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${baseId}-code`} className={LABEL}>
                ICD-10 code <span className="font-normal text-gray-500">(optional)</span>
              </label>
              {/* The medical aids' full ICD-10 list: by code or by words; choosing a code fills in an empty problem */}
              <Icd10SearchInput
                id={`${baseId}-code`}
                className={`${INPUT} font-mono uppercase`}
                value={code}
                position="other"
                placeholder="e.g. I10 or hypertension"
                onChange={text => setCode(text.toUpperCase())}
                onPick={option => {
                  setCode(option.code);
                  if (!description.trim() && option.entry?.description) setDescription(option.entry.description);
                }}
                onBlur={fillFromCode}
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-onset`} className={LABEL}>
                Since <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input id={`${baseId}-onset`} type="date" className={INPUT} value={onsetDate} onChange={event => setOnsetDate(event.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="h-4 w-4 accent-purple-600" checked={chronic} onChange={event => setChronic(event.target.checked)} />
            Chronic condition
          </label>
          {formError && (
            <p className="text-sm text-red-700" role="alert">
              {formError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setAdding(false)} disabled={busy === 'add'}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY_BUTTON} disabled={busy === 'add'}>
              {busy === 'add' ? 'Saving...' : 'Save problem'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

export default ProblemPanel;
