/**
 * Who gets a column in the diary. Eminance users expect every practitioner's diary side by side, and
 * the diary used to show users with the doctor role only, so a nurse or an administrator who treats
 * had no column. There is no "treats patients" role to choose instead: a column goes to every active
 * doctor, to anyone given working hours in Diary settings (giving someone hours is how a practice
 * puts them in the diary), and to whoever has a booking in the days shown, so no booking is hidden.
 * A booking without a practitioner (a website request) gets a column of its own.
 */
import type { WorkingHoursRow } from './workingHours';

export interface DiaryStaffMember {
  id: string;
  name: string;
  /** users.role: 'admin', 'doctor', 'nurse' or 'receptionist' */
  role: string | null;
  isActive: boolean;
}

export interface DiaryPractitioner {
  id: string;
  name: string;
  role: string | null;
}

/** The column of bookings without a practitioner (the diary passes their doctor_id as '') */
export const NO_PRACTITIONER_ID = '';
// The same words as the diary report
export const NO_PRACTITIONER_NAME = 'No practitioner yet';
export const FORMER_PRACTITIONER_NAME = 'Former practitioner';

export interface DiaryPractitionersInput {
  /** Everyone in the practice, any role, active or not */
  staff: DiaryStaffMember[];
  /** Saved working hours (Diary settings) */
  workingHours: WorkingHoursRow[];
  /** The practitioner of each booking in the days shown (empty: none yet) */
  bookedIds: Iterable<string | null | undefined>;
  /** The practitioners chosen in the diary keep their columns on a day without bookings or hours */
  chosenIds?: readonly string[];
}

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

/**
 * The practitioners with a diary column, in column order: active doctors, then the others who
 * treat, then anyone kept only for their bookings (deactivated, or no longer in the practice).
 */
export function diaryPractitioners(input: DiaryPractitionersInput): DiaryPractitioner[] {
  const booked = new Set<string>();
  for (const id of input.bookedIds) if (id) booked.add(id);
  const withHours = new Set(input.workingHours.map((row) => row.doctorId));
  const chosen = new Set(input.chosenIds ?? []);

  const rank = (member: DiaryStaffMember): number => (!member.isActive ? 2 : member.role === 'doctor' ? 0 : 1);
  const members = input.staff
    .filter((member) => booked.has(member.id) || chosen.has(member.id) || (member.isActive && (member.role === 'doctor' || withHours.has(member.id))))
    .sort((a, b) => rank(a) - rank(b) || byName(a, b))
    .map(({ id, name, role }): DiaryPractitioner => ({ id, name, role }));

  const known = new Set(input.staff.map((member) => member.id));
  const former = [...booked]
    .filter((id) => !known.has(id))
    .sort()
    .map((id): DiaryPractitioner => ({ id, name: FORMER_PRACTITIONER_NAME, role: null }));
  return [...members, ...former];
}

/**
 * The day grid's columns: the chosen practitioners' (one or several), else everyone's, plus the "No
 * practitioner yet" column when a booking of the day has no practitioner.
 */
export function diaryDayColumns(
  practitioners: DiaryPractitioner[],
  chosenIds: readonly string[],
  dayBookedIds: Iterable<string | null | undefined>
): DiaryPractitioner[] {
  const chosen = new Set(chosenIds);
  const shown = chosen.size > 0 ? practitioners.filter((practitioner) => chosen.has(practitioner.id)) : practitioners;
  for (const id of dayBookedIds) {
    if (!id) return [...shown, { id: NO_PRACTITIONER_ID, name: NO_PRACTITIONER_NAME, role: null }];
  }
  return shown;
}

/**
 * Whose working hours Diary settings lists, the diary's practitioners first (in column order). An
 * administrator can give anyone hours, which is how a nurse or an administrator who treats is put in
 * the diary, so sees all active staff; everyone else sees the practitioners already in the diary.
 */
export function workingHoursStaff(staff: DiaryStaffMember[], practitioners: DiaryPractitioner[], isAdmin: boolean): DiaryStaffMember[] {
  const position = new Map(practitioners.map((practitioner, index) => [practitioner.id, index]));
  const place = (member: DiaryStaffMember): number => position.get(member.id) ?? practitioners.length;
  return staff
    .filter((member) => member.isActive && (isAdmin || position.has(member.id)))
    .sort((a, b) => place(a) - place(b) || byName(a, b));
}
