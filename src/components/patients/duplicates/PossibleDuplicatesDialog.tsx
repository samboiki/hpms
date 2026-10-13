import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { EmptyState, ErrorState, LoadingState, SegmentedTabs } from '../../finance/FinanceUI';
import { SECTION_COLORS } from '../../../config/sectionColors';
import { DuplicatePairCard } from './DuplicatePairCard';
import { MergeHistoryList } from './MergeHistoryList';
import {
  MergeHasNewRecordsError,
  MergeNotSetUpError,
  loadMergeHistory,
  loadPracticeFiles,
  loadRecordCounts,
  mergePatients,
  undoMerge,
  type MergeRecord
} from '../../../services/patientMergeService';
import { findDuplicatePairs, withoutFile, type DuplicatePair } from '../../../utils/patients/duplicatePairs';
import { describeRecordCounts, suggestKeptFile, type FileRecordCounts } from '../../../utils/patients/patientMerge';

type View = 'pairs' | 'merges';

const pairKey = (pair: DuplicatePair): string => `${pair.files[0].id}|${pair.files[1].id}`;
const messageOf = (error: unknown, fallback: string): string => (error instanceof Error && error.message ? error.message : fallback);

interface Props {
  practiceId: string;
  onClose: () => void;
  /** A merge or an undo changed which files exist: the patient list reloads */
  onFilesChanged: () => void;
  /** Opens a file (the dialog closes first) */
  onOpenPatient: (patientId: string) => void;
}

/**
 * Patients > More > Possible duplicates, for practice administrators: pairs of files that may be one person (why they
 * matched, each file's visits, invoices and claims), the merge of a pair into the file that stays, and the merges made
 * so far with their undo. The database does the merge in one transaction and checks the administrator again.
 */
export const PossibleDuplicatesDialog: React.FC<Props> = ({ practiceId, onClose, onFilesChanged, onOpenPatient }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('pairs');
  const [pairs, setPairs] = useState<DuplicatePair[] | null>(null);
  const [counts, setCounts] = useState<Map<string, FileRecordCounts>>(new Map());
  const [pairsError, setPairsError] = useState<string | null>(null);
  const [records, setRecords] = useState<MergeRecord[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [mergingKey, setMergingKey] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const busy = mergingKey !== null || undoingId !== null;
  // Escape and the backdrop do nothing while a merge or an undo runs
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const loadPairs = useCallback(async () => {
    setPairsError(null);
    try {
      const found = findDuplicatePairs(await loadPracticeFiles(practiceId));
      setPairs(found);
      const ids = found.flatMap(pair => pair.files.map(file => file.id));
      if (ids.length === 0) return;
      try {
        setCounts(await loadRecordCounts(ids));
      } catch (error) {
        // The counts help to choose; the pairs are still worth showing without them
        if (error instanceof MergeNotSetUpError) setNotSetUp(true);
        else console.warn('Visit, invoice and claim counts not loaded:', messageOf(error, ''));
      }
    } catch (error) {
      setPairsError(messageOf(error, 'The patients could not be read.'));
    }
  }, [practiceId]);

  const loadHistory = useCallback(async () => {
    setHistoryError(null);
    try {
      setRecords(await loadMergeHistory(practiceId));
    } catch (error) {
      if (error instanceof MergeNotSetUpError) {
        setNotSetUp(true);
        setRecords([]);
      } else {
        setHistoryError(messageOf(error, 'The merges could not be read.'));
      }
    }
  }, [practiceId]);

  useEffect(() => {
    void loadPairs();
    void loadHistory();
  }, [loadPairs, loadHistory]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busyRef.current) return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, [onClose]);

  const merge = async (pair: DuplicatePair, keepPatientId: string, mergePatientId: string) => {
    setMergingKey(pairKey(pair));
    try {
      const result = await mergePatients(keepPatientId, mergePatientId);
      toast.success(`Files merged. Moved ${describeRecordCounts(result.moved)}.`);
      // The archived file no longer pairs with anything
      setPairs(current => (current ? withoutFile(current, mergePatientId) : current));
      onFilesChanged();
      void loadHistory();
    } catch (error) {
      if (error instanceof MergeNotSetUpError) setNotSetUp(true);
      toast.error(messageOf(error, 'The files could not be merged.'));
    } finally {
      setMergingKey(null);
    }
  };

  const undo = async (record: MergeRecord) => {
    setUndoingId(record.id);
    try {
      const movedBack = await undoMerge(record.id);
      toast.success(`Merge undone: ${record.mergedName} is a file of its own again. Moved back ${describeRecordCounts(movedBack)}.`);
      onFilesChanged();
      void loadHistory();
      void loadPairs();
    } catch (error) {
      if (error instanceof MergeHasNewRecordsError) {
        toast.error(`${record.keptName} has new records since the merge (${describeRecordCounts(error.added)}), so the merge can no longer be undone.`, { duration: 8000 });
      } else {
        toast.error(messageOf(error, 'The merge could not be undone.'));
      }
    } finally {
      setUndoingId(null);
    }
  };

  const openPatient = (patientId: string) => {
    if (busyRef.current) return;
    onOpenPatient(patientId);
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={() => { if (!busyRef.current) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={event => event.stopPropagation()}
        className="flex max-h-[100dvh] w-full flex-col rounded-t-2xl bg-gray-50 text-gray-900 shadow-xl focus:outline-none sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 rounded-t-2xl border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
          <div className={`flex-none rounded-xl p-2.5 text-white ${SECTION_COLORS.patients.iconBox}`}>
            <Icon icon="solar:users-group-two-rounded-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold leading-snug">Possible duplicates</h2>
            <p className="text-sm text-gray-500">Files that may be one person. Merge them so the history is in one place.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"
            aria-label="Close"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <SegmentedTabs<View>
            value={view}
            onChange={setView}
            ariaLabel="Duplicate finder"
            options={[
              { value: 'pairs', label: pairs ? `Possible duplicates (${pairs.length})` : 'Possible duplicates', icon: 'solar:magnifer-bold-duotone' },
              { value: 'merges', label: 'Merges', icon: 'solar:history-bold-duotone' }
            ]}
          />
        </div>

        <div role="tabpanel" aria-label={view === 'pairs' ? 'Possible duplicates' : 'Merges'} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {notSetUp && (
            <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Merging patient files is not set up yet. Possible duplicates are shown; they can be merged once it is.
            </p>
          )}
          {view === 'pairs' ? (
            pairsError ? (
              <ErrorState title="The patients could not be read" message={pairsError} onRetry={() => void loadPairs()} />
            ) : !pairs ? (
              <LoadingState label="Looking for possible duplicates" rows={3} />
            ) : pairs.length === 0 ? (
              <EmptyState
                icon="solar:check-circle-bold-duotone"
                title="No possible duplicates"
                message="No two files share an ID number, a medical aid membership, or a name with a date of birth or cell number."
              />
            ) : (
              <ul className="space-y-3">
                {pairs.map(pair => (
                  <DuplicatePairCard
                    key={pairKey(pair)}
                    pair={pair}
                    counts={counts}
                    suggestedKeepId={suggestKeptFile(pair.files[0], pair.files[1], counts)}
                    canMerge={!notSetUp && !busy}
                    merging={mergingKey === pairKey(pair)}
                    onMerge={(keepId, mergeId) => void merge(pair, keepId, mergeId)}
                    onOpenPatient={openPatient}
                  />
                ))}
              </ul>
            )
          ) : historyError ? (
            <ErrorState title="The merges could not be read" message={historyError} onRetry={() => void loadHistory()} />
          ) : !records ? (
            <LoadingState label="Loading the merges" rows={2} />
          ) : (
            <MergeHistoryList records={records} undoingId={undoingId} canUndo={!notSetUp && !busy} onUndo={record => void undo(record)} onOpenPatient={openPatient} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PossibleDuplicatesDialog;
