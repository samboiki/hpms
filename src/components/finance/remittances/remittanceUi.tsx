import React from 'react';
import { Icon } from '@iconify/react';
import { formatNad, fromCents } from '../../../utils/billing/money';
import type { MatchConfidence, RejectionStatus } from '../../../utils/remittance/matching';
import type { ReasonCategory, SuggestedAction } from '../../../utils/remittance/reasonCodes';

/** Shared labels and small pieces of the remittance screens */

export const nad = (cents: number): string => formatNad(fromCents(cents));

/** "2026-10-07" -> "7 Oct 2026" */
export function formatDateKey(key: string | null | undefined): string {
  if (!key) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  if (!match) return key;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(match[3])} ${months[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

type ChipTone = 'green' | 'amber' | 'red' | 'gray' | 'cyan' | 'violet';

const CHIP: Record<ChipTone, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-700',
  cyan: 'bg-cyan-100 text-cyan-800',
  violet: 'bg-violet-100 text-violet-800'
};

export const Chip: React.FC<{ tone: ChipTone; icon?: string; children: React.ReactNode; title?: string }> = ({ tone, icon, children, title }) => (
  <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[tone]}`}>
    {icon && <Icon icon={icon} className="h-3.5 w-3.5" aria-hidden="true" />}
    {children}
  </span>
);

export const CONFIDENCE_META: Record<MatchConfidence | 'confirmed', { label: string; tone: ChipTone; icon: string }> = {
  exact: { label: 'Matched', tone: 'green', icon: 'solar:check-circle-bold-duotone' },
  confirmed: { label: 'Confirmed', tone: 'green', icon: 'solar:user-check-bold-duotone' },
  likely: { label: 'Check', tone: 'amber', icon: 'solar:question-circle-bold-duotone' },
  none: { label: 'Unmatched', tone: 'red', icon: 'solar:close-circle-bold-duotone' }
};

export const ConfidenceChip: React.FC<{ confidence: MatchConfidence; confirmed?: boolean }> = ({ confidence, confirmed }) => {
  const meta = CONFIDENCE_META[confidence === 'likely' && confirmed ? 'confirmed' : confidence];
  return <Chip tone={meta.tone} icon={meta.icon}>{meta.label}</Chip>;
};

export const CATEGORY_TONE: Record<ReasonCategory, ChipTone> = {
  info: 'gray',
  duplicate: 'gray',
  fixable: 'cyan',
  hold: 'violet',
  patient_liable: 'amber',
  write_off: 'red',
  rate_shortfall: 'amber',
  review: 'red'
};

export const ACTION_LABELS: Record<SuggestedAction, string> = {
  none: 'Nothing to do',
  resubmit: 'Fix and resubmit',
  wait: 'Wait for the fund',
  bill_patient: 'Bill the patient',
  write_off: 'Write off',
  review: 'Decide'
};

export const ACTION_ICONS: Record<SuggestedAction, string> = {
  none: 'solar:check-circle-bold-duotone',
  resubmit: 'solar:restart-bold-duotone',
  wait: 'solar:hourglass-bold-duotone',
  bill_patient: 'solar:user-hand-up-bold-duotone',
  write_off: 'solar:eraser-bold-duotone',
  review: 'solar:question-square-bold-duotone'
};

export const REJECTION_STATUS_LABELS: Record<RejectionStatus, string> = {
  open: 'Open',
  waiting: 'Waiting',
  resubmitted: 'Resubmitted',
  billed_patient: 'Billed to patient',
  written_off: 'Written off',
  resolved_by_payment: 'Paid later',
  closed: 'Closed'
};

export const REJECTION_STATUS_TONE: Record<RejectionStatus, ChipTone> = {
  open: 'amber',
  waiting: 'violet',
  resubmitted: 'cyan',
  billed_patient: 'gray',
  written_off: 'gray',
  resolved_by_payment: 'green',
  closed: 'gray'
};

export const POSTING_STATUS_LABELS: Record<string, string> = {
  pending: 'Not posted',
  allocated: 'Paid to invoice',
  shortfall: 'Rest to patient',
  written_off: 'Rest written off',
  queued: 'In the queue',
  held: 'Waiting for the fund',
  suspense: 'Unallocated credit',
  duplicate: 'Already paid',
  recorded: 'Recorded',
  no_action: 'Nothing to do'
};
