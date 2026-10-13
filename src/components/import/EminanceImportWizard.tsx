import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  isImportNotSetUpError,
  loadExistingFiles,
  loadFundOptions,
  readImportFile,
  stageRows,
  startImport
} from '../../services/import/eminanceImportService';
import { NO_CHOICES, unreadValues, type ValueChoices } from '../../utils/import/eminancePeople';
import { fileNeeds, isUsable, readImportFiles, type ImportFile } from '../../utils/import/importFiles';
import { buildImportPlan, stagedRows, type ExistingFile, type FundOption } from '../../utils/import/importPlan';
import { windhoekClock } from '../../utils/patientLists/listDates';
import { ErrorState, LoadingState } from '../finance/FinanceUI';
import { PrimaryButton, SecondaryButton } from '../finance/receipts/ArUi';
import { ImportCheckStep } from './ImportCheckStep';
import { ImportColumnsStep } from './ImportColumnsStep';
import { ImportFilesStep } from './ImportFilesStep';
import { ImportReviewStep } from './ImportReviewStep';
import { balancesDateProblem } from './importText';

type Step = 'files' | 'columns' | 'check' | 'review';
type Owner = 'medical_aid' | 'patient';

const STEPS: ReadonlyArray<{ key: Step; label: string }> = [
  { key: 'files', label: 'Files' },
  { key: 'columns', label: 'Columns' },
  { key: 'check', label: 'Check' },
  { key: 'review', label: 'Import' }
];

interface EminanceImportWizardProps {
  practiceId: string;
  onCancel: () => void;
  /** The rows are in the database: the import itself runs in ImportRunView */
  onStarted: (runId: string) => void;
  onNotSetUp: () => void;
}

const sameFile = (a: File, b: File): boolean => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/** Files, columns, check, import: nothing is saved before the last step */
export const EminanceImportWizard: React.FC<EminanceImportWizardProps> = ({ practiceId, onCancel, onStarted, onNotSetUp }) => {
  const [today] = useState(() => windhoekClock(new Date()).dateKey);
  const [step, setStep] = useState<Step>('files');
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [reading, setReading] = useState(0);
  const added = useRef<Array<{ file: File; index: number }>>([]);
  const nextIndex = useRef(0);
  const [balancesAsOf, setBalancesAsOf] = useState(today);
  const [choices, setChoices] = useState<ValueChoices>(NO_CHOICES);
  const [fundChoices, setFundChoices] = useState<Record<string, string | null>>({});
  const [ownerOfBoth, setOwnerOfBoth] = useState<Owner | null>(null);
  const [reference, setReference] = useState<{ existing: ExistingFile[]; funds: FundOption[] } | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [sending, setSending] = useState<{ sent: number; total: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const loadReference = useCallback(async () => {
    setReferenceError(null);
    try {
      const [existing, funds] = await Promise.all([loadExistingFiles(practiceId), loadFundOptions()]);
      setReference({ existing, funds });
    } catch (error) {
      if (isImportNotSetUpError(error)) onNotSetUp();
      else setReferenceError(error instanceof Error ? error.message : 'Could not read your patients and medical aid funds');
    }
  }, [practiceId, onNotSetUp]);

  useEffect(() => {
    void loadReference();
  }, [loadReference]);

  // Screen readers hear the new step; keyboard users continue from its heading
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const addFiles = useCallback((dropped: File[]) => {
    const fresh = dropped.filter(file => !added.current.some(item => sameFile(item.file, file)));
    // Numbers are never reused, so a file removed while it was still being read cannot come back as another one
    const items = fresh.map(file => {
      nextIndex.current += 1;
      return { file, index: nextIndex.current };
    });
    added.current = [...added.current, ...items];
    setReading(current => current + items.length);
    for (const item of items) {
      void readImportFile(item.file, item.index)
        .then(read => {
          // A file removed while it was being read stays removed
          if (added.current.some(entry => entry.index === read.index)) setFiles(current => [...current, read].sort((a, b) => a.index - b.index));
        })
        .finally(() => setReading(current => current - 1));
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    added.current = added.current.filter(item => item.index !== index);
    setFiles(current => current.filter(file => file.index !== index));
  }, []);

  const changeFile = useCallback((changed: ImportFile) => {
    setFiles(current => current.map(file => (file.index === changed.index ? changed : file)));
  }, []);

  const hasBalances = files.some(file => !file.problem && file.use === 'balances');
  const planning = step === 'check' || step === 'review';
  const rawRows = useMemo(() => (planning ? readImportFiles(files, today, NO_CHOICES) : null), [planning, files, today]);
  const rows = useMemo(() => {
    if (!rawRows) return null;
    return choices === NO_CHOICES ? rawRows : readImportFiles(files, today, choices);
  }, [rawRows, files, today, choices]);
  const sexValues = useMemo(() => (rawRows ? unreadValues(rawRows.people, 'sexRaw') : []), [rawRows]);
  const relationshipValues = useMemo(() => (rawRows ? unreadValues(rawRows.people, 'relationshipRaw') : []), [rawRows]);
  const plan = useMemo(() => {
    if (!rows || !reference) return null;
    return buildImportPlan({ today, ...rows, existing: reference.existing, funds: reference.funds, fundChoices, ownerOfBoth });
  }, [rows, reference, today, fundChoices, ownerOfBoth]);

  const { counts } = plan ?? { counts: null };
  const somethingToImport = !!counts && counts.newPatients + counts.existingPatients + counts.balanceAccounts + counts.recalls + counts.claimLines > 0;
  const canGoOn: Record<Step, boolean> = {
    files: reading === 0 && files.some(file => !file.problem && file.use !== 'ignore') && (!hasBalances || balancesDateProblem(balancesAsOf, today) === null),
    columns: files.every(file => file.problem || file.use === 'ignore' || fileNeeds(file).length === 0),
    check: !!plan && plan.openQuestions.length === 0 && somethingToImport,
    review: false
  };
  const stepIndex = STEPS.findIndex(item => item.key === step);
  const waitingFor: Record<Step, string | null> = {
    files: reading > 0 ? 'Reading the files...' : files.some(file => !file.problem && file.use !== 'ignore') ? null : 'Add at least one file you can use.',
    columns: 'Choose the columns marked above.',
    check: plan && plan.openQuestions.length > 0 ? 'Answer the questions above first.' : plan && !somethingToImport ? 'There is nothing to import in these files.' : null,
    review: null
  };

  const setFundChoice = useCallback((key: string, providerId: string | null | undefined) => {
    setFundChoices(current => {
      const next = { ...current };
      if (providerId === undefined) delete next[key];
      else next[key] = providerId;
      return next;
    });
  }, []);

  const runImport = async () => {
    if (!plan) return;
    const staged = stagedRows(plan);
    setSendError(null);
    setSending({ sent: 0, total: staged.length });
    try {
      const runId = await startImport(practiceId, {
        balancesAsOf: hasBalances ? balancesAsOf : null,
        files: files.filter(isUsable).map(file => ({
          name: file.name,
          kind: file.use,
          rows: file.table ? file.table.rows.length : file.claimLines.length,
          ...(file.use === 'balances' ? { portion: file.portion } : {})
        }))
      });
      await stageRows(runId, staged, sent => setSending({ sent, total: staged.length }));
      onStarted(runId);
    } catch (error) {
      if (isImportNotSetUpError(error)) {
        onNotSetUp();
        return;
      }
      setSendError(error instanceof Error ? error.message : 'The import could not be started');
      setSending(null);
    }
  };

  const planBody = () => {
    if (referenceError) return <ErrorState title="Could not read your patients and medical aid funds" message={referenceError} onRetry={() => void loadReference()} />;
    if (!plan) return <LoadingState label="Comparing the files with your patients" />;
    if (step === 'check') {
      return (
        <ImportCheckStep
          plan={plan}
          funds={reference?.funds ?? []}
          sexValues={sexValues}
          relationshipValues={relationshipValues}
          choices={choices}
          onChoices={setChoices}
          onFundChoice={setFundChoice}
          ownerOfBoth={ownerOfBoth}
          onOwnerOfBoth={setOwnerOfBoth}
        />
      );
    }
    return <ImportReviewStep plan={plan} balancesAsOf={hasBalances ? balancesAsOf : null} sending={sending} error={sendError} onImport={() => void runImport()} />;
  };

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Steps">
        {STEPS.map((item, index) => {
          const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo';
          return (
            <li key={item.key} className="flex items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
              <span
                className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-semibold ${
                  state === 'done' ? 'bg-cyan-600 text-white' : state === 'current' ? 'bg-cyan-100 text-cyan-800 ring-2 ring-cyan-500' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {state === 'done' ? <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className={`text-sm ${state === 'current' ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                {item.label}
                {state === 'done' && <span className="sr-only"> (done)</span>}
              </span>
              {index < STEPS.length - 1 && <span className="mx-1 hidden h-px w-6 bg-gray-300 sm:block" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Step {stepIndex + 1} of {STEPS.length}: {STEPS[stepIndex].label}
      </h2>

      {step === 'files' && (
        <ImportFilesStep
          files={files}
          reading={reading}
          onAdd={addFiles}
          onChange={changeFile}
          onRemove={removeFile}
          hasBalances={hasBalances}
          balancesAsOf={balancesAsOf}
          onBalancesAsOf={setBalancesAsOf}
          today={today}
        />
      )}
      {step === 'columns' && <ImportColumnsStep files={files} onChange={changeFile} />}
      {planning && planBody()}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={sending !== null}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          Cancel
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!canGoOn[step] && waitingFor[step] && step !== 'review' && <p className="text-xs text-gray-500">{waitingFor[step]}</p>}
          {stepIndex > 0 && (
            <SecondaryButton icon="solar:arrow-left-bold-duotone" onClick={() => setStep(STEPS[stepIndex - 1].key)} disabled={sending !== null}>
              Back
            </SecondaryButton>
          )}
          {step !== 'review' && (
            <PrimaryButton icon="solar:arrow-right-bold-duotone" onClick={() => setStep(STEPS[stepIndex + 1].key)} disabled={!canGoOn[step]}>
              Next
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
};
