import React from 'react';
import { Icon } from '@iconify/react';
import type { ReminderStatus, ReminderTone } from '../../../utils/diary/reminderStatus';

const TONE_CLASSES: Record<ReminderTone, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
  reschedule: 'bg-amber-50 text-amber-800 ring-amber-200',
  delivered: 'bg-sky-50 text-sky-700 ring-sky-200',
  sent: 'bg-gray-50 text-gray-600 ring-gray-200',
  pending: 'bg-gray-50 text-gray-500 ring-gray-200',
  failed: 'bg-red-50 text-red-700 ring-red-200'
};

interface ReminderStatusIconProps {
  status: ReminderStatus | null | undefined;
  /** Show the short words next to the icon (cards with room for them) */
  showLabel?: boolean;
  className?: string;
}

/**
 * Reminder / SMS confirmation status of a booking: who confirmed, who cancelled, whose reminder
 * failed. The full story is the tooltip and the accessible name; nothing shows when no SMS was sent.
 */
export const ReminderStatusIcon: React.FC<ReminderStatusIconProps> = ({ status, showLabel = false, className = '' }) => {
  if (!status) return null;
  return (
    <span
      role="img"
      aria-label={status.detail}
      title={status.detail}
      className={`inline-flex flex-none items-center gap-1 rounded-lg ring-1 ${showLabel ? 'px-2 py-1' : 'p-0.5'} ${TONE_CLASSES[status.tone]} ${className}`}
    >
      <Icon icon={status.icon} className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
      {showLabel && <span className="text-xs font-semibold whitespace-nowrap">{status.label}</span>}
    </span>
  );
};

export default ReminderStatusIcon;
