import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  continueImport,
  loadRunRows,
  undoImport,
  type ImportProgress,
  type ImportRowResult,
  type ImportRun,
  type KindCounts
} from '../../services/import/eminanceImportService';
import { formatServiceDate } from '../../utils/billing/dates';
import type { StagedKind } from '../../utils/import/importPlan';
import { MiniStat, Notice, SectionCard } from '../finance/FinanceUI';
import { ErrorBox, inputClass, PrimaryButton, SecondaryButton } from '../finance/receipts/ArUi';
import { count, nad, plural, type ListedRow } from './importText';
import { patientListsLink } from '../billing/invoiceLinks';
import { RowList } from './importUi';

export type RunMode = 'continue' | 'continue-undo' | 'view';

interface ImportRunViewProps {
  run: ImportRun;
  mode: RunMode;
  onBack: () => void;
  /** The run changed (finished, undone): the list of imports is loaded again */
  onChanged: () => void;
}

const KIND_LABELS: Readonly<Record<StagedKind, string>> = {
  patient: 'Patients',
  family: 'Family accounts',
  balance: 'Opening balances',
  recall: 'Recalls',
  claim_line: 'Claim history'
};
const KINDS = Object.keys(KIND_LABELS) as StagedKind[];

const EMPTY: KindCounts = { pending: 0, created: 0, matched: 0, skipped: 0 };
const countsOf = (progress: ImportProgress, kind: StagedKind): KindCounts => ({ ...EMPTY, ...progress.counts[kind] });
const totalOf = (counts: KindCounts): number => counts.pending + counts.created + counts.matched + counts.skipped;
const pendingOf = (progress: ImportProgress): number => KINDS.reduce((total, kind) => total + countsOf(progress, kind).pending, 0);

const progressOf = (run: ImportRun): ImportProgress => ({
  runId: run.id,
  status: run.status,
  done: run.status === 'imported' || run.status === 'undone',
  balancesAsOf: run.balancesAsOf,
  counts: run.counts,
  openingBalanceCents: run.openingBalanceCents,
  claimLines: run.claimLines,
  undoLeft: 0
});

const message = (error: unknown, fallback: string): string => (error instanceof Error && error.message ? plainWords(error.message) : fallback);

/** The rows of a finished import that staff may want to look at, per list */
function resultRows(rows: readonly ImportRowResult[]) {
  const listed = (row: ImportRowResult): ListedRow => ({ key: row.key, line: row.line, account: row.accountNumber, label: row.label, reason: row.reason });
  const pick = (kind: StagedKind, status: ImportRowResult['status']) => rows.filter(row => row.kind === kind && row.status === status).map(listed);
  return {
    skippedPeople: pick('patient', 'skipped'),
    matchedPeople: pick('patient', 'matched'),
    balances: pick('balance', 'created'),
    skippedOther: rows.filter(row => row.kind !== 'patient' && row.status === 'skipped').map(row => ({ ...listed(row), reason: `${KIND_LABELS[row.kind]}: ${row.reason ?? 'not brought over'}` }))
  };
}

/** Importing (step by step, so no request runs long), the result, and undoing the whole import */
export const ImportRunView: React.FC<ImportRunViewProps> = ({ run, mode, onBack, onChanged }) => {
  const reasonId = useId();
  const [progress, setProgress] = useState<ImportProgress>(() => progressOf(run));
  const [working, setWorking] = useState<'import' | 'undo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRowResult[] | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmUndo, setConfirmUndo] = useState(false);
  const alive = useRef(true);
  const started = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const drive = useCallback(async (kind: 'import' | 'undo', undoReason: string) => {
    setWorking(kind);
    setError(null);
    let lastLeft = Number.POSITIVE_INFINITY;
    let stalled = 0;
    try {
      for (;;) {
        const next = kind === 'import' ? await continueImport(run.id) : await undoImport(run.id, undoReason);
        if (!alive.current) return;
        setProgress(next);
        const finished = kind === 'import' ? !['staging', 'importing'].includes(next.status) : ['undone', 'discarded'].includes(next.status);
        if (finished) break;
        const left = kind === 'import' ? pendingOf(next) : next.undoLeft;
        stalled = left >= lastLeft ? stalled + 1 : 0;
        lastLeft = left;
        if (stalled >= 3) throw new Error('The import is not moving forward. Try again in a moment; if it stays stuck, contact OneHealth support.');
      }
      onChanged();
    } catch (caught) {
      if (alive.current) setError(message(caught, kind === 'import' ? 'The import stopped' : 'The import could not be undone'));
    } finally {
      if (alive.current) setWorking(null);
    }
  }, [run.id, onChanged]);

  // Continue an import (or an undo) that is not finished, once
  useEffect(() => {
    if (started.current || mode === 'view') return;
    started.current = true;
    void drive(mode === 'continue' ? 'import' : 'undo', run.undoReason ?? 'Continuing the undo');
  }, [mode, drive, run.undoReason]);

  // Ask before leaving the page while it works
  useEffect(() => {
    if (!working) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [working]);

  useEffect(() => {
    if (progress.status !== 'imported' || working) return;
    let cancelled = false;
    setRowsError(null);
    loadRunRows(run.id)
      .then(result => { if (!cancelled) setRows(result); })
      .catch(caught => { if (!cancelled) setRowsError(message(caught, 'Could not read the rows of this import')); });
    return () => {
      cancelled = true;
    };
  }, [progress.status, run.id, working]);

  const lists = useMemo(() => (rows ? resultRows(rows) : null), [rows]);
  const patient = countsOf(progress, 'patient');
  const family = countsOf(progress, 'family');
  const balance = countsOf(progress, 'balance');
  const recall = countsOf(progress, 'recall');
  const total = KINDS.reduce((sum, kind) => sum + totalOf(countsOf(progress, kind)), 0);
  const done = total - pendingOf(progress);

  const title = {
    staging: 'Starting the import',
    importing: 'Importing',
    imported: 'Imported from Eminance',
    undoing: 'Undoing the import',
    undone: 'This import was undone',
    discarded: 'This import was discarded'
  }[progress.status];

  return (
    <div className="space-y-5">
      <div>
        <SecondaryButton icon="solar:arrow-left-bold-duotone" onClick={onBack} disabled={working !== null}>All imports</SecondaryButton>
      </div>

      <SectionCard title={title} subtitle={progress.balancesAsOf ? `Balances as at ${formatServiceDate(progress.balancesAsOf)}` : undefined} icon="solar:import-bold-duotone">
        <div className="space-y-5">
          <div role="status" aria-live="polite">
            {working === 'import' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  {count(done)} of {count(total)} rows done. Keep this page open.
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-cyan-500 motion-safe:transition-[width]" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
                </div>
              </div>
            )}
            {working === 'undo' && <p className="text-sm text-gray-700">Undoing: {plural(progress.undoLeft, 'record', 'records')} left to remove. Keep this page open.</p>}
          </div>

          {error && progress.status !== 'imported' && (
            <div className="space-y-3">
              <ErrorBox>{error}</ErrorBox>
              {['staging', 'importing', 'undoing'].includes(progress.status) && !working && (
                <PrimaryButton icon="solar:restart-bold-duotone" onClick={() => void drive(progress.status === 'undoing' ? 'undo' : 'import', run.undoReason ?? reason.trim())}>
                  Try again
                </PrimaryButton>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat icon="solar:user-plus-bold-duotone" label="New patient files" value={count(patient.created)} tone="green" />
            <MiniStat icon="solar:user-check-bold-duotone" label="Already in OneHealth" value={count(patient.matched)} tone="cyan" />
            <MiniStat icon="solar:user-cross-bold-duotone" label="Left out" value={count(patient.skipped)} tone={patient.skipped ? 'red' : 'gray'} />
            <MiniStat icon="solar:users-group-rounded-bold-duotone" label="Dependants linked" value={count(family.created)} tone="violet" />
            <MiniStat icon="solar:wallet-money-bold-duotone" label={`Opening balances on ${plural(balance.created, 'account', 'accounts')}`} value={nad(progress.openingBalanceCents)} tone="amber" />
            <MiniStat icon="solar:calendar-mark-bold-duotone" label="Recalls on patient lists" value={count(recall.created)} tone="indigo" />
            <MiniStat icon="solar:history-bold-duotone" label="Claim history lines" value={count(progress.claimLines)} tone="blue" />
          </div>

          {progress.status === 'undone' && (run.undoReason || reason.trim()) && (
            <Notice tone="info" title="Why it was undone">{run.undoReason || reason.trim()}</Notice>
          )}
        </div>
      </SectionCard>

      {progress.status === 'imported' && !working && (
        <>
          <SectionCard title="Where to find it" icon="solar:folder-open-bold-duotone">
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/patients" className="font-medium text-cyan-700 hover:underline">Patients</Link>: search by name, ID number or the Eminance account number.
              </li>
              <li>
                <Link to="/finance?tab=debtors" className="font-medium text-cyan-700 hover:underline">Finance &gt; Debtors</Link>: the opening balances in the age analysis.
              </li>
              <li>
                <Link to={patientListsLink()} className="font-medium text-cyan-700 hover:underline">Messages &gt; Lists</Link>: the &quot;Eminance recalls&quot; lists, to contact patients when they are due. Each patient&apos;s file
                also has the recall, which comes due on its day and closes when they book.
              </li>
            </ul>
          </SectionCard>

          {rowsError && <ErrorBox>{rowsError}</ErrorBox>}
          {!lists && !rowsError && (
            <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
              <Icon icon="solar:hourglass-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Reading the rows of this import...
            </p>
          )}
          {lists && (
            <div className="space-y-3">
              <RowList title="Not brought over" hint="Grouped by reason" rows={lists.skippedPeople} icon="solar:user-cross-bold-duotone" tone="red" byReason />
              <RowList title="Already in OneHealth: the existing file was used" rows={lists.matchedPeople} icon="solar:user-check-bold-duotone" tone="green" byReason />
              <RowList title="Opening balances" rows={lists.balances} icon="solar:wallet-money-bold-duotone" tone="gray" />
              <RowList title="Family accounts, balances, recalls and claim lines not brought over" rows={lists.skippedOther} icon="solar:danger-triangle-bold-duotone" tone="amber" byReason />
            </div>
          )}

          <SectionCard title="Undo the whole import" subtitle="Removes every file, balance, list entry and claim line it created" icon="solar:undo-left-round-bold-duotone" tone="red">
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Possible until someone works with the imported files: a visit, invoice, payment, note, document or message on any of them, a changed
                opening balance, or a month closed. Files that were already in OneHealth keep everything; only the Eminance account number the import added is removed.
              </p>
              <div>
                <label htmlFor={reasonId} className="mb-1 block text-sm font-medium text-gray-700">Why are you undoing it?</label>
                <input id={reasonId} className={inputClass} value={reason} maxLength={300} onChange={event => setReason(event.target.value)} placeholder="For example: the wrong age analysis was used" />
              </div>
              {error && <ErrorBox>{error}</ErrorBox>}
              {confirmUndo ? (
                <Notice tone="warning" title="Undo the whole import?">
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SecondaryButton onClick={() => setConfirmUndo(false)}>Keep it</SecondaryButton>
                    <PrimaryButton tone="red" icon="solar:undo-left-round-bold-duotone" onClick={() => { setConfirmUndo(false); void drive('undo', reason.trim()); }}>
                      Yes, undo it
                    </PrimaryButton>
                  </div>
                </Notice>
              ) : (
                <PrimaryButton tone="red" icon="solar:undo-left-round-bold-duotone" disabled={reason.trim().length < 3} onClick={() => setConfirmUndo(true)}>
                  Undo the import
                </PrimaryButton>
              )}
            </div>
          </SectionCard>
        </>
      )}

    </div>
  );
};
