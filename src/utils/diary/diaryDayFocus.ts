/**
 * A link to a day in the diary that arrives with the booking it was opened for in view (integration review C4). The
 * day alone was not enough: a doctor's diary opens on their own column (diaryDefaultView.ts), so a colleague's booking
 * stayed hidden, and the time grid leaves cancelled bookings out. The link also carries the booking's practitioner
 * (their column is shown beside the user's own; a booking without one, or a figure of everyone's bookings, shows every
 * practitioner) and, for a cancelled booking, the diary's "Cancelled" filter. src/pages/Dashboard.tsx reads it:
 *   /?diaryDate=2026-10-08&diaryPractitioner=<id or all>&diaryShow=cancelled
 */
import { ALL_PRACTITIONERS, toggleDiaryView, type DiaryView } from './diaryDefaultView';

export interface DiaryDayFocus {
  /** The booking's practitioner, whose column is shown; null: every practitioner */
  practitionerId: string | null;
  /** The booking is cancelled: the diary opens on its cancelled bookings (the "Cancelled" filter) */
  showCancelled: boolean;
}

const DATE = 'diaryDate';
const PRACTITIONER = 'diaryPractitioner';
const SHOW = 'diaryShow';
const EVERY_PRACTITIONER = 'all';

/** Every practitioner: for a figure that counts everyone's bookings of a day (Encounters > Analytics). */
export const EVERYONE_ON_THE_DAY: DiaryDayFocus = { practitionerId: null, showCancelled: false };

/** The focus for one booking: its practitioner's column, and the cancelled bookings when it is cancelled. */
export const focusOnBooking = (booking: { practitionerId: string | null | undefined; cancelled: boolean }): DiaryDayFocus => ({
  practitionerId: booking.practitionerId || null,
  showCancelled: booking.cancelled
});

/** The diary's address on a day ('yyyy-MM-dd'); with a focus, the booking it was opened for is in view. */
export function diaryDayParams(date: string, focus?: DiaryDayFocus | null): URLSearchParams {
  const params = new URLSearchParams({ [DATE]: date });
  if (focus) {
    params.set(PRACTITIONER, focus.practitionerId || EVERY_PRACTITIONER);
    if (focus.showCancelled) params.set(SHOW, 'cancelled');
  }
  return params;
}

/** The focus a link carries; null for a link with the day only (the diary then opens as it always does). */
export function readDiaryDayFocus(params: URLSearchParams): DiaryDayFocus | null {
  const practitioner = params.get(PRACTITIONER)?.trim();
  if (!practitioner) return null;
  return { practitionerId: practitioner === EVERY_PRACTITIONER ? null : practitioner, showCancelled: params.get(SHOW) === 'cancelled' };
}

/** The address without the link's day and focus, once read (so Back or a refresh does not jump there again). */
export function withoutDiaryDayLink(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const name of [DATE, PRACTITIONER, SHOW]) next.delete(name);
  return next;
}

/**
 * Whose columns the diary shows on arrival: the user's own choice when it already shows the practitioner (or
 * everyone), else the practitioner's column added to it, in column order; every practitioner for a booking without one.
 */
export function focusedDiaryView(view: DiaryView, focus: DiaryDayFocus, columnOrder: readonly string[]): DiaryView {
  if (!focus.practitionerId) return ALL_PRACTITIONERS;
  if (view.length === 0 || view.includes(focus.practitionerId)) return view;
  return toggleDiaryView(view, focus.practitionerId, columnOrder);
}
