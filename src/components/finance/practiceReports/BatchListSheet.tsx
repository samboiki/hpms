import React, { useEffect, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { fundLabel } from '../../../utils/remittance/funds';
import { claimBatchLink } from '../../billing/invoiceLinks';
import { formatNad, formatTimestamp } from '../financeFormat';
import { EmptyState, ErrorState, LoadingState } from '../FinanceUI';
import { Sheet } from '../receipts/ArUi';
import { loadBatchList, type BatchListItem } from './practiceReportsService';

/** The claim batches behind a report figure, each opening in Finance > Batches */
export const BatchListSheet: React.FC<{ ids: readonly string[]; label: string; onClose: () => void }> = ({ ids, label, onClose }) => {
  const [batches, setBatches] = useState<BatchListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = ids.join(',');
  useEffect(() => {
    let cancelled = false;
    loadBatchList(key ? key.split(',') : [])
      .then(rows => { if (!cancelled) setBatches(rows); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? plainWords(err.message) : 'Could not load the batches.'); });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return (
    <Sheet open onClose={onClose} title={`Claim batches: ${label}`} subtitle="Open a batch to see each line and the fund's answer" icon="solar:box-bold-duotone" size="lg">
      {error ? (
        <ErrorState title="Could not load the batches" message={error} />
      ) : !batches ? (
        <LoadingState label="Loading the batches" rows={3} />
      ) : batches.length === 0 ? (
        <EmptyState compact icon="solar:box-bold-duotone" title="No batches" message="No claim batch is behind this figure." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {batches.map(batch => (
            <li key={batch.id}>
              <Link
                to={claimBatchLink(batch.id)}
                onClick={onClose}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:bg-cyan-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <span>
                  <span className="font-medium text-gray-900">Batch {batch.number ?? '?'}</span>
                  <span className="ml-2 text-gray-700">{fundLabel(batch.fund)}</span>
                  <span className="ml-2 text-xs text-gray-500">{batch.sentAt ? `sent ${formatTimestamp(batch.sentAt)}` : 'not sent'}</span>
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums text-gray-700">
                  {formatNad(batch.totalCents / 100)}
                  <Icon icon="solar:alt-arrow-right-bold-duotone" className="h-4 w-4 text-gray-400" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
};
