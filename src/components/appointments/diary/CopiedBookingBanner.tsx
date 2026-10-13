import React from 'react';
import { Icon } from '@iconify/react';
import { describeCopied, type BookingPrefill } from '../../../utils/diary/bookingCopy';

interface CopiedBookingBannerProps {
  copied: BookingPrefill;
  /** Forgets the copy (Esc does the same on a keyboard; a tablet has no Esc) */
  onCancel: () => void;
  /** Given when the diary shows cards or the month: switches to the time slots, where a copy is pasted */
  onShowSlots?: () => void;
}

/**
 * After "Copy" in the visit actions: says whose booking is copied and how to paste it. Clicking a free time in the
 * day or week grid opens the booking form filled in from the copy, with the usual booking checks.
 */
export const CopiedBookingBanner: React.FC<CopiedBookingBannerProps> = ({ copied, onCancel, onShowSlots }) => (
  <div
    role="status"
    className="mx-3 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-900 md:mx-4"
  >
    <Icon icon="solar:copy-bold-duotone" className="h-5 w-5 flex-none text-purple-600" aria-hidden="true" />
    <p className="min-w-0 flex-1">
      <span className="font-semibold">Copied: {describeCopied(copied)}.</span> Choose a free time, or press Esc.
    </p>
    <div className="flex flex-none items-center gap-2">
      {onShowSlots && (
        <button
          type="button"
          onClick={onShowSlots}
          className="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          Show time slots
        </button>
      )}
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel the copy"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
      >
        <Icon icon="solar:close-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        Cancel
      </button>
    </div>
  </div>
);

export default CopiedBookingBanner;
