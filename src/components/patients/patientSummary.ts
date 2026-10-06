import { differenceInYears, isSameMonth, isValid, parseISO } from 'date-fns';

/**
 * Small facts about patients shown in the patient header and analytics, computed from the record
 * itself so nothing on screen is an estimate.
 */

/**
 * Age in whole years on `today`, or null when the date of birth is missing, unreadable or in the
 * future. A date-only value ("1990-05-14") is read as local midnight, so the age changes on the
 * birthday itself rather than a day early or late.
 */
export function ageInYears(dateOfBirth: string | null | undefined, today: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  const born = parseISO(dateOfBirth);
  if (!isValid(born) || born > today) return null;
  return differenceInYears(today, born);
}

/** How many of these patients were registered in the same calendar month as `today`. */
export function countRegisteredInMonth(
  patients: ReadonlyArray<{ created_at?: string | null }>,
  today: Date = new Date()
): number {
  return patients.filter((patient) => {
    if (!patient.created_at) return false;
    const registered = parseISO(patient.created_at);
    return isValid(registered) && isSameMonth(registered, today);
  }).length;
}

// The registration and medical aid forms save the main member as "self", "main_member" or "Main Member"
const MAIN_MEMBER_VALUES = ['self', 'main member', 'main_member', 'principal', 'principal member'];

/** "Main member", "Dependent (spouse)" or "Relationship not recorded" for a medical aid membership. */
export function describeMedicalAidRelationship(relationship: string | null | undefined): string {
  const value = relationship?.trim();
  if (!value) return 'Relationship not recorded';
  if (MAIN_MEMBER_VALUES.includes(value.toLowerCase())) return 'Main member';
  return `Dependent (${value.replace(/_/g, ' ')})`;
}
