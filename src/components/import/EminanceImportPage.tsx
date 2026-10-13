import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { usePractice } from '../../contexts/PracticeContext';
import { useAuthStore } from '../../stores/authStore';
import { isImportNotSetUpError, loadRuns, undoImport, type ImportRun, type RunStatus } from '../../services/import/eminanceImportService';
import { formatServiceDate } from '../../utils/billing/dates';
import { windhoekClock } from '../../utils/patientLists/listDates';
import { EmptyState, ErrorState, LoadingState, Notice, SectionCard } from '../finance/FinanceUI';
import { PrimaryButton, SecondaryButton } from '../finance/receipts/ArUi';
import { EminanceImportWizard } from './EminanceImportWizard';
import { ImportRunView, type RunMode } from './ImportRunView';
import { count, nad, NOT_SET_UP_MESSAGE } from './importText';

type View = { kind: 'home' } | { kind: 'wizard' } | { kind: 'run'; run: ImportRun; mode: RunMode };

const STATUS: Readonly<Record<RunStatus, { label: string; tone: string }>> = {
  staging: { label: 'Not sent completely', tone: 'bg-gray-100 text-gray-700' },
  importing: { label: 'Not finished', tone: 'bg-amber-100 text-amber-800' },
  imported: { label: 'Imported', tone: 'bg-green-100 text-green-800' },
  undoing: { label: 'Undo not finished', tone: 'bg-amber-100 text-amber-800' },
  undone: { label: 'Undone', tone: 'bg-gray-100 text-gray-700' },
  discarded: { label: 'Discarded', tone: 'bg-gray-100 text-gray-700' }
};

/** A timestamp as the Windhoek calendar day it fell on: "7 Oct 2026" */
const dayOf = (timestamp: string | null): string => (timestamp ? formatServiceDate(windhoekClock(new Date(timestamp)).dateKey) : '-');

const runSummary = (run: ImportRun): string => {
  const patients = run.counts.patient;
  const parts = [
    patients ? `${count(patients.created)} new files, ${count(patients.matched)} already in OneHealth` : null,
    run.openingBalanceCents ? `${nad(run.openingBalanceCents)} in opening balances` : null,
    run.claimLines ? `${count(run.claimLines)} claim lines` : null
  ];
  return parts.filter(Boolean).join(' · ') || 'Nothing imported yet';
};

const RunItem: React.FC<{ run: ImportRun; busy: boolean; onOpen: (mode: RunMode) => void; onDiscard: () => void }> = ({ run, busy, onOpen, onDiscard }) => {
  const status = STATUS[run.status];
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3 sm:flex-row sm:items-center sm:p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">Started {dayOf(run.createdAt)}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}>{status.label}</span>
        </div>
        <p className="mt-0.5 text-sm text-gray-600">{runSummary(run)}</p>
        {run.status === 'undone' && (
          <p className="mt-0.5 text-xs text-gray-500">Undone {dayOf(run.undoneAt)}{run.undoReason ? `: ${run.undoReason}` : ''}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {run.status === 'importing' && <PrimaryButton icon="solar:restart-bold-duotone" disabled={busy} onClick={() => onOpen('continue')}>Continue</PrimaryButton>}
        {run.status === 'undoing' && <PrimaryButton icon="solar:restart-bold-duotone" disabled={busy} onClick={() => onOpen('continue-undo')}>Continue the undo</PrimaryButton>}
        {run.status === 'imported' && <SecondaryButton icon="solar:document-text-bold-duotone" disabled={busy} onClick={() => onOpen('view')}>Result and undo</SecondaryButton>}
        {run.status === 'undone' && <SecondaryButton icon="solar:document-text-bold-duotone" disabled={busy} onClick={() => onOpen('view')}>Summary</SecondaryButton>}
        {run.status === 'staging' && <SecondaryButton icon="solar:trash-bin-trash-bold-duotone" disabled={busy} onClick={onDiscard}>Discard</SecondaryButton>}
      </div>
    </li>
  );
};

/**
 * Settings > Move over from Eminance: for practice administrators. Shows "not set up yet" until
 * proposals/2026-10-07-eminance-import.sql is applied (the database checks the administrator role too).
 */
export const EminanceImportPage: React.FC = () => {
  const { user } = useAuthStore();
  const { practiceId } = usePractice();
  const isAdmin = user?.role === 'admin';
  const [state, setState] = useState<'loading' | 'ready' | 'not_set_up' | 'error'>('loading');
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>({ kind: 'home' });

  const refresh = useCallback(async () => {
    if (!practiceId || !isAdmin) return;
    try {
      setRuns(await loadRuns(practiceId));
      setState('ready');
    } catch (error) {
      if (isImportNotSetUpError(error)) {
        setState('not_set_up');
      } else {
        setLoadError(error instanceof Error ? error.message : 'Could not read the imports');
        setState('error');
      }
    }
  }, [practiceId, isAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const notSetUp = useCallback(() => {
    setState('not_set_up');
    setView({ kind: 'home' });
  }, []);
  const backHome = useCallback(() => {
    setView({ kind: 'home' });
    void refresh();
  }, [refresh]);
  const changed = useCallback(() => {
    void refresh();
  }, [refresh]);

  const discard = async (run: ImportRun) => {
    setBusy(true);
    setActionError(null);
    try {
      await undoImport(run.id, '');
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not discard it');
    } finally {
      setBusy(false);
    }
  };

  const unfinished = runs.find(run => run.status === 'importing' || run.status === 'undoing');

  const body = (): React.ReactNode => {
    if (!isAdmin) {
      return <Notice tone="info" title="For practice administrators">Only a practice administrator can move patients over from Eminance.</Notice>;
    }
    if (!practiceId || state === 'loading') return <LoadingState label="Loading earlier imports" rows={2} />;
    if (state === 'not_set_up') return <Notice tone="info" title="Moving over from Eminance is not set up yet">{NOT_SET_UP_MESSAGE}</Notice>;
    if (state === 'error') return <ErrorState title="Could not read the imports" message={loadError ?? ''} onRetry={() => void refresh()} />;
    if (view.kind === 'wizard') {
      return (
        <EminanceImportWizard
          practiceId={practiceId}
          onCancel={backHome}
          onNotSetUp={notSetUp}
          onStarted={runId =>
            setView({
              kind: 'run',
              mode: 'continue',
              run: {
                id: runId, status: 'staging', balancesAsOf: null, createdAt: new Date().toISOString(), importedAt: null, undoneAt: null,
                undoReason: null, counts: {}, openingBalanceCents: 0, claimLines: 0
              }
            })
          }
        />
      );
    }
    if (view.kind === 'run') return <ImportRunView key={view.run.id} run={view.run} mode={view.mode} onBack={backHome} onChanged={changed} />;
    return (
      <div className="space-y-5">
        {actionError && <Notice tone="error">{actionError}</Notice>}
        {unfinished && (
          <Notice tone="warning" title={unfinished.status === 'importing' ? 'An import is not finished' : 'An undo is not finished'}>
            Continue it below before starting another import.
          </Notice>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton icon="solar:import-bold-duotone" disabled={!!unfinished || busy} onClick={() => setView({ kind: 'wizard' })}>
            Start moving over
          </PrimaryButton>
          <p className="text-xs text-gray-500">Nothing is saved until the last step.</p>
        </div>
        {runs.length === 0 ? (
          <EmptyState compact icon="solar:history-bold-duotone" title="No imports yet" message="Each import is listed here, with its result and the option to undo it." />
        ) : (
          <ul className="space-y-3" aria-label="Earlier imports">
            {runs.map(run => (
              <RunItem key={run.id} run={run} busy={busy} onOpen={mode => setView({ kind: 'run', run, mode })} onDiscard={() => void discard(run)} />
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Move over from Eminance"
        subtitle="Bring your patients, medical aid details, family accounts, balances and recalls into OneHealth"
        icon="solar:transfer-horizontal-bold-duotone"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-3">
            <p className="flex gap-2">
              <Icon icon="solar:upload-minimalistic-bold-duotone" className="mt-0.5 h-5 w-5 flex-none text-cyan-600" aria-hidden="true" />
              <span><span className="font-semibold">1. Export</span> the patient list, the age analysis and, if you use them, the recall list and claim files from Eminance.</span>
            </p>
            <p className="flex gap-2">
              <Icon icon="solar:checklist-minimalistic-bold-duotone" className="mt-0.5 h-5 w-5 flex-none text-cyan-600" aria-hidden="true" />
              <span><span className="font-semibold">2. Check</span> what comes over: patients already in OneHealth are found, and every row left out says why.</span>
            </p>
            <p className="flex gap-2">
              <Icon icon="solar:undo-left-round-bold-duotone" className="mt-0.5 h-5 w-5 flex-none text-cyan-600" aria-hidden="true" />
              <span><span className="font-semibold">3. Import</span>, and undo the whole import if something is wrong, as long as nobody has worked with the imported files yet.</span>
            </p>
          </div>
        </div>
      </SectionCard>
      {body()}
    </div>
  );
};

export default EminanceImportPage;
