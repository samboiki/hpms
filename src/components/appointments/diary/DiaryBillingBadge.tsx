import React from 'react';
import { BILLING_BADGE_LABELS, type BillingBadge } from '../../../utils/diary/billingBadge';
import { DIARY_STATUS_COLOUR_STYLES } from '../../../utils/diary/diaryStatuses';

interface DiaryBillingBadgeProps {
  badge: BillingBadge | null | undefined;
  /** 'xs' on the time-grid cards, 'sm' on the card list */
  size?: 'xs' | 'sm';
  className?: string;
}

/** Same chip as the practice's own statuses (DiaryStatusLabel): a dot and the word, so colour is never the only signal */
const BADGE_COLOUR = { invoiced: DIARY_STATUS_COLOUR_STYLES.amber, paid: DIARY_STATUS_COLOUR_STYLES.green } as const;

/** "Invoiced" or "Paid" on a diary card (parity B13); nothing before the visit has an invoice. */
export const DiaryBillingBadge: React.FC<DiaryBillingBadgeProps> = ({ badge, size = 'xs', className = '' }) => {
  if (!badge) return null;
  const style = BADGE_COLOUR[badge];
  return (
    <span
      title={badge === 'paid' ? 'Paid in full' : 'Invoiced, not paid in full yet'}
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full font-medium ring-1 ring-inset ${style.chip} ${
        size === 'xs' ? 'px-1.5 text-[10px] leading-4' : 'px-2 py-0.5 text-xs'
      } ${className}`}
    >
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${style.dot}`} aria-hidden="true" />
      <span className="truncate">{BILLING_BADGE_LABELS[badge]}</span>
    </span>
  );
};

export default DiaryBillingBadge;
