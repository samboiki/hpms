import type { BatchHeaderRow } from './types';

/** Batch statuses that mean "not sent yet": only these can be changed or submitted. */
export const OPEN_BATCH_STATUSES: readonly string[] = ['active', 'open', 'draft', 'ready'];

/** True while a batch has not been sent: no sent_at and an open status (a missing status counts as 'active'). */
export const isOpenBatch = (batch: Pick<BatchHeaderRow, 'status' | 'sent_at'>): boolean =>
  !batch.sent_at && OPEN_BATCH_STATUSES.includes((batch.status ?? 'active').toLowerCase());

/** How each batch status is shown. Open batches can still be changed and submitted. */
export const BATCH_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: 'Open', className: 'bg-cyan-100 text-cyan-800' },
  open: { label: 'Open', className: 'bg-cyan-100 text-cyan-800' },
  draft: { label: 'Open', className: 'bg-cyan-100 text-cyan-800' },
  ready: { label: 'Ready to send', className: 'bg-blue-100 text-blue-800' },
  sending: { label: 'Sending', className: 'bg-blue-100 text-blue-800' },
  sent: { label: 'Submitted', className: 'bg-indigo-100 text-indigo-800' },
  confirmed: { label: 'Acknowledged', className: 'bg-purple-100 text-purple-800' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800' },
  unpaid: { label: 'Unpaid', className: 'bg-amber-100 text-amber-800' },
  partially_paid: { label: 'Partly paid', className: 'bg-amber-100 text-amber-800' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' }
};

export const batchStatus = (batch: Pick<BatchHeaderRow, 'status' | 'sent_at'>): { label: string; className: string } => {
  const key = (batch.status ?? (batch.sent_at ? 'sent' : 'active')).toLowerCase();
  return BATCH_STATUS_LABELS[key] ?? { label: batch.status ?? 'Unknown', className: 'bg-gray-100 text-gray-700' };
};
