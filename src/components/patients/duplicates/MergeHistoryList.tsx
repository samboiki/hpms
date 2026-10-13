import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { format, isValid, parseISO } from 'date-fns';
import { PRIMARY, QUIET, SECONDARY } from '../../stock/stockUi';
import { EmptyState } from '../../finance/FinanceUI';
import type { MergeRecord } from '../../../services/patientMergeService';
import { describeRecordCounts } from '../../../utils/patients/patientMerge';
import { patientReferenceLabel } from '../../../utils/patients/patientNumbers';

const when = (timestamp: string | null): string => {
  const date = timestamp ? parseISO(timestamp) : null;
  return date && isValid(date) ? format(date, 'd MMM yyyy, HH:mm') : '';
};

const withReference = (name: string, reference: number | null): string => {
  const label = patientReferenceLabel(reference);
  return label ? `${name} (ref ${label})` : name;
};

interface Props {
  records: readonly MergeRecord[];
  /** The merge being undone, if any */
  undoingId: string | null;
  canUndo: boolean;
  onUndo: (record: MergeRecord) => void;
  onOpenPatient: (patientId: string) => void;
}

/**
 * Each merge as the record keeps it: which file was archived into which, when and by whom, what moved and what stayed
 * with the archived file, and the undo while it is still possible.
 */
export const MergeHistoryList: React.FC<Props> = ({ records, undoingId, canUndo, onUndo, onOpenPatient }) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (records.length === 0) {
    return <EmptyState icon="solar:history-bold-duotone" title="No merges yet" message="Files you merge are listed here, with an undo." compact />;
  }
  return (
    <ul className="space-y-3">
      {records.map(record => {
        const left = describeRecordCounts(record.leftWithArchived);
        return (
          <li key={record.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
            <p className="text-sm text-gray-900">
              <strong>{withReference(record.mergedName, record.mergedReference)}</strong> merged into{' '}
              <button
                type="button"
                onClick={() => onOpenPatient(record.keptPatientId)}
                className="rounded font-semibold underline-offset-2 hover:text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                {withReference(record.keptName, record.keptReference)}
              </button>
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {when(record.mergedAt)}
              {record.mergedBy ? ` by ${record.mergedBy}` : ''}
            </p>
            <p className="mt-2 text-sm text-gray-700">Moved: {describeRecordCounts(record.moved)}.</p>
            {left !== 'nothing' && (
              <p className="mt-1 text-sm text-gray-600">
                Stayed with the archived file: {left} (claim lines already sent, or what the kept file already had).
              </p>
            )}

            {record.undoneAt ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                <Icon icon="solar:undo-left-round-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
                Undone {when(record.undoneAt)}
                {record.undoneBy ? ` by ${record.undoneBy}` : ''}
              </p>
            ) : confirmingId === record.id ? (
              <div className="mt-3 space-y-2 rounded-xl bg-amber-50 p-3">
                <p className="text-sm text-amber-900">
                  Undo this merge? {record.mergedName} comes back as a file of its own, with everything that was moved to{' '}
                  {record.keptName}.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className={QUIET} onClick={() => setConfirmingId(null)} disabled={undoingId === record.id}>
                    Keep merged
                  </button>
                  <button
                    type="button"
                    className={PRIMARY}
                    disabled={undoingId === record.id || !canUndo}
                    onClick={() => {
                      setConfirmingId(null);
                      onUndo(record);
                    }}
                  >
                    <Icon icon="solar:undo-left-round-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    Undo merge
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex justify-end">
                <button type="button" className={SECONDARY} disabled={!canUndo || undoingId !== null} onClick={() => setConfirmingId(record.id)}>
                  <Icon icon="solar:undo-left-round-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  {undoingId === record.id ? 'Undoing...' : 'Undo merge'}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default MergeHistoryList;
