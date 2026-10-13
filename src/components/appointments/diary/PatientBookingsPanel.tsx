import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { loadPatientBookings, type PatientBookingsLoad } from '../../../services/bookingLinksService';
import { loadPracticeStaff } from '../../../services/invoiceContextService';
import { bookingLinks, formatBookingWhen, type PatientBooking } from '../../../utils/diary/patientBookings';
import { focusOnBooking } from '../../../utils/diary/diaryDayFocus';
import { ReminderStatusIcon } from './ReminderStatusIcon';

interface PatientBookingsPanelProps {
  practiceId: string;
  patientId: string;
  /** Practitioner names by id; without it the panel reads the practice's staff itself */
  practitionerName?: (id: string | null) => string | null | undefined;
  /**
   * Inside the patient file: open the visit and the Billing tab in place. A link back into the same file's address
   * changed nothing the second time it was followed, so Visit and Invoice worked once per open file
   */
  onOpenVisit?: (visitId: string) => void;
  onOpenBilling?: () => void;
}

const PAYMENT_WORDS: Record<string, string> = { paid: 'Paid', pending: 'Not paid yet', overdue: 'Overdue', cancelled: 'Cancelled', partial: 'Part paid' };

const LINK_CLASS =
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500';

/**
 * The patient's bookings for the patient file: upcoming ones with their reminder and SMS
 * confirmation, past ones with their invoice. Each opens its day in the diary, the visit, or the
 * patient's invoices, so the file and the diary link both ways.
 */
export const PatientBookingsPanel: React.FC<PatientBookingsPanelProps> = ({ practiceId, patientId, practitionerName, onOpenVisit, onOpenBilling }) => {
  const [load, setLoad] = useState<PatientBookingsLoad | null>(null);
  // Who each booking is with, when the page does not pass the names (a missing name only leaves it out)
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (practitionerName) return;
    let cancelled = false;
    loadPracticeStaff(practiceId)
      .then((staff) => {
        if (!cancelled) setStaffNames(Object.fromEntries(staff.filter((member) => member.full_name).map((member) => [member.id, member.full_name as string])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [practiceId, practitionerName]);
  const nameOf = practitionerName ?? ((id: string | null) => (id ? staffNames[id] : undefined));

  useEffect(() => {
    let cancelled = false;
    setLoad(null);
    loadPatientBookings(practiceId, patientId).then((loaded) => {
      if (!cancelled) setLoad(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, patientId]);

  if (!load) return <p className="text-sm text-gray-500" role="status">Loading bookings...</p>;
  if (load.state === 'error') return <p className="text-sm text-red-600">Could not load the bookings: {load.message}</p>;

  const { upcoming, past, reminderStatuses } = load.data;

  const row = (booking: PatientBooking) => {
    const practitioner = nameOf(booking.practitionerId);
    return (
      <li key={booking.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-900">{formatBookingWhen(booking)}</span>
          <span className="block text-xs text-gray-500">
            {booking.stageLabel}
            {practitioner ? ` · ${practitioner}` : ''}
            {booking.invoice ? ` · Invoice ${booking.invoice.number} (${PAYMENT_WORDS[booking.invoice.paymentStatus ?? ''] ?? 'Not paid yet'})` : ''}
          </span>
        </span>
        <ReminderStatusIcon status={reminderStatuses.get(booking.id)} />
        <span className="flex flex-wrap gap-1">
          <Link
            // With its practitioner's column, and the cancelled bookings for a cancelled one, so it is in view on arrival
            to={bookingLinks.diaryDay(booking.date, focusOnBooking({ practitionerId: booking.practitionerId, cancelled: booking.stage === 'cancelled' }))}
            className={LINK_CLASS}
            aria-label={`Open ${formatBookingWhen(booking)} in the diary`}
          >
            <Icon icon="solar:calendar-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Diary
          </Link>
          {onOpenVisit ? (
            <button type="button" onClick={() => onOpenVisit(booking.id)} className={LINK_CLASS} aria-label={`Open the visit of ${formatBookingWhen(booking)}`}>
              <Icon icon="solar:document-text-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
              Visit
            </button>
          ) : (
            <Link to={bookingLinks.visit(patientId, booking.id)} className={LINK_CLASS} aria-label={`Open the visit of ${formatBookingWhen(booking)}`}>
              <Icon icon="solar:document-text-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
              Visit
            </Link>
          )}
          {booking.invoice &&
            (onOpenBilling ? (
              <button type="button" onClick={onOpenBilling} className={LINK_CLASS} aria-label={`Open invoice ${booking.invoice.number}`}>
                <Icon icon="solar:bill-list-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
                Invoice
              </button>
            ) : (
              <Link to={bookingLinks.invoices(patientId)} className={LINK_CLASS} aria-label={`Open invoice ${booking.invoice.number}`}>
                <Icon icon="solar:bill-list-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
                Invoice
              </Link>
            ))}
        </span>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <section aria-labelledby="patient-bookings-upcoming">
        <h3 id="patient-bookings-upcoming" className="text-sm font-semibold text-gray-900">
          Upcoming bookings ({upcoming.length})
        </h3>
        {upcoming.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">None booked.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">{upcoming.map(row)}</ul>
        )}
      </section>
      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer select-none text-sm font-semibold text-gray-900">Past bookings ({past.length})</summary>
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">{past.map(row)}</ul>
        </details>
      )}
    </div>
  );
};

export default PatientBookingsPanel;
