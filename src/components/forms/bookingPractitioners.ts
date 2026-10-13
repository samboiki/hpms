/**
 * The practitioners a booking can be made with: exactly the diary's columns (src/utils/diary/diaryPractitioners.ts:
 * every active doctor and anyone given working hours in Diary settings), plus the practitioner the form was opened for
 * (a diary column, or the booking being edited), who stays listed even without hours. Without this the booking form
 * listed doctors only, so a booking made in a nurse's column was saved to her while the form did not show her name.
 */
import { diaryPractitioners } from '../../utils/diary/diaryPractitioners';
import type { WorkingHoursRow } from '../../utils/diary/workingHours';
import { formatRole } from '../settings/UserManagement/staffUtils';

/** A users row of the practice (any role, active or not) */
export interface PractitionerStaffRow {
  id: string;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
}

export interface PractitionerOption {
  id: string;
  full_name: string;
  role: string | null;
  /** What the list shows: the name, with the role for anyone who is not a doctor ("Maria Nangolo (Nurse)") */
  label: string;
}

/** The columns the users query reads for bookingPractitioners */
export const PRACTITIONER_STAFF_COLUMNS = 'id, full_name, role, is_active';

export function bookingPractitioners(
  staff: readonly PractitionerStaffRow[],
  workingHours: WorkingHoursRow[],
  openedForId: string | null | undefined
): PractitionerOption[] {
  return diaryPractitioners({
    staff: staff.map(row => ({ id: row.id, name: (row.full_name ?? '').trim() || 'Practitioner', role: row.role, isActive: row.is_active !== false })),
    workingHours,
    // A new booking is never offered someone only because of their past bookings (a practitioner who left)
    bookedIds: [],
    chosenIds: openedForId ? [openedForId] : []
  }).map(practitioner => ({
    id: practitioner.id,
    full_name: practitioner.name,
    role: practitioner.role,
    label: practitioner.role && practitioner.role !== 'doctor' ? `${practitioner.name} (${formatRole(practitioner.role)})` : practitioner.name
  }));
}
