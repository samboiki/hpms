import React, { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import type { BookingWarning, BookingWarningKind } from '../../../utils/diary/bookingChecks';

const KIND_ICONS: Record<BookingWarningKind, string> = {
  doctor_overlap: 'solar:users-group-two-rounded-bold-duotone',
  patient_same_day: 'solar:user-rounded-bold-duotone',
  blocked_time: 'solar:forbidden-circle-bold-duotone',
  public_holiday: 'solar:flag-bold-duotone',
  closed_day: 'solar:lock-bold-duotone',
  outside_hours: 'solar:clock-circle-bold-duotone',
  type_daily_limit: 'solar:calendar-minimalistic-bold-duotone'
};

interface BookingWarningsPanelProps {
  warnings: BookingWarning[];
  /** "Book anyway", or "Save anyway" when an existing booking is moved */
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onChange: () => void;
}

/**
 * Shown instead of saving when the booking clashes or falls on blocked time, a holiday or a closed
 * day. Nothing is refused: reception reads why and books anyway or changes the booking.
 */
export const BookingWarningsPanel: React.FC<BookingWarningsPanelProps> = ({ warnings, confirmLabel, busy = false, onConfirm, onChange }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Bring the panel into view and give it focus, so it is not missed below the fold or by a screen reader
  useEffect(() => {
    panelRef.current?.scrollIntoView?.({ block: 'nearest' });
    panelRef.current?.focus();
  }, [warnings]);

  if (warnings.length === 0) return null;
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby="booking-warnings-title"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <div className="flex items-start gap-3">
        <Icon icon="solar:danger-triangle-bold-duotone" className="h-5 w-5 flex-none text-amber-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 id="booking-warnings-title" className="text-sm font-semibold text-amber-900">
            Please check before booking
          </h4>
          <ul className="mt-2 space-y-2">
            {warnings.map((warning, index) => (
              <li key={`${warning.kind}-${index}`} className="flex items-start gap-2 text-sm text-amber-900">
                <Icon icon={KIND_ICONS[warning.kind]} className="mt-0.5 h-4 w-4 flex-none text-amber-600" aria-hidden="true" />
                <span className="min-w-0 break-words">{warning.message}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
            >
              {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onChange}
              disabled={busy}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Change the booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingWarningsPanel;
