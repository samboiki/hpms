import type { BatchHeaderRow } from './types';

/** Batch statuses that mean "not sent yet": only these can be changed or submitted. */
export const OPEN_BATCH_STATUSES: readonly string[] = ['active', 'open', 'draft', 'ready'];

/** True while a batch has not been sent: no sent_at and an open status (a missing status counts as 'active'). */
export const isOpenBatch = (batch: Pick<BatchHeaderRow, 'status' | 'sent_at'>): boolean =>
  !batch.sent_at && OPEN_BATCH_STATUSES.includes((batch.status ?? 'active').toLowerCase());

/**
 * How each batch status is shown, in words (never colour alone), with what it means. Open batches can still be
 * changed and submitted. A sent batch moves on with the funds' answers (claim_batch_refresh_status in
 * proposals/2026-10-08-claims-follow-up.sql): sent -> confirmed, partially_paid, paid, unpaid or rejected.
 */
export const BATCH_STATUS_LABELS: Record<string, { label: string; className: string; hint?: string }> = {
  active: { label: 'Open', className: 'bg-cyan-100 text-cyan-800', hint: 'Not sent yet: lines can still be added, corrected or removed.' },
  open: { label: 'Open', className: 'bg-cyan-100 text-cyan-800', hint: 'Not sent yet: lines can still be added, corrected or removed.' },
  draft: { label: 'Open', className: 'bg-cyan-100 text-cyan-800', hint: 'Not sent yet: lines can still be added, corrected or removed.' },
  ready: { label: 'Ready to send', className: 'bg-blue-100 text-blue-800' },
  sending: { label: 'Sending', className: 'bg-blue-100 text-blue-800' },
  sent: { label: 'Submitted', className: 'bg-indigo-100 text-indigo-800', hint: 'Sent to the fund; no answer recorded yet.' },
  confirmed: { label: 'Acknowledged', className: 'bg-purple-100 text-purple-800', hint: 'The fund answered but has not paid or refused a line yet.' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800', hint: 'The fund paid every line in full.' },
  unpaid: { label: 'Some not paid', className: 'bg-amber-100 text-amber-800', hint: 'The fund refused some lines and has paid nothing yet; the rest are waiting.' },
  partially_paid: { label: 'Partly paid', className: 'bg-amber-100 text-amber-800', hint: 'The fund paid some lines; others are not paid or still waiting.' },
  rejected: { label: 'Not paid', className: 'bg-red-100 text-red-800', hint: 'The fund refused every line.' }
};

export const batchStatus = (batch: Pick<BatchHeaderRow, 'status' | 'sent_at'>): { label: string; className: string; hint?: string } => {
  const key = (batch.status ?? (batch.sent_at ? 'sent' : 'active')).toLowerCase();
  return BATCH_STATUS_LABELS[key] ?? { label: batch.status ?? 'Unknown', className: 'bg-gray-100 text-gray-700' };
};

/**
 * What the fund answered on one claim line (the claim_line_outcomes view): paid in full, part paid, not paid, or
 * waiting (pended, accepted, a note only). 'none' when nothing came back for the line yet.
 */
export type ClaimLineOutcome = 'paid' | 'part_paid' | 'rejected' | 'waiting';

/** Each outcome as a word with its icon and colour, so a line never relies on colour alone */
export const LINE_OUTCOME_META: Record<ClaimLineOutcome | 'none', { label: string; chip: string; row: string; icon: string }> = {
  paid: { label: 'Paid', chip: 'bg-green-100 text-green-800', row: 'bg-green-50/60', icon: 'solar:check-circle-bold-duotone' },
  part_paid: { label: 'Part paid', chip: 'bg-amber-100 text-amber-800', row: 'bg-amber-50/60', icon: 'solar:pie-chart-2-bold-duotone' },
  rejected: { label: 'Not paid', chip: 'bg-red-100 text-red-800', row: 'bg-red-50/60', icon: 'solar:close-circle-bold-duotone' },
  waiting: { label: 'Waiting', chip: 'bg-violet-100 text-violet-800', row: 'bg-violet-50/50', icon: 'solar:hourglass-bold-duotone' },
  none: { label: 'No answer yet', chip: 'bg-gray-100 text-gray-700', row: '', icon: 'solar:clock-circle-bold-duotone' }
};

export const isClaimLineOutcome = (value: unknown): value is ClaimLineOutcome =>
  value === 'paid' || value === 'part_paid' || value === 'rejected' || value === 'waiting';
