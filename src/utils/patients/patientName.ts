/**
 * The patient's formal name: title, initials and surname ("Mrs N M Shilongo"), the way a practice addresses a patient
 * on a letter or statement and Eminance shows the account. Title and initials are optional columns on patients
 * (proposals/2026-10-08-patient-title-initials.sql); a file without them has no formal name and shows its full name.
 */
import { initialsOf, normalizeInitials } from './medicalAidMember';

/** The titles reception picks from; blank means no title. */
export const PATIENT_TITLES: readonly string[] = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev'];

/** The title choices for one file: the list, plus a title already on the file that is not in it, so saving never wipes it. */
export function titleOptions(saved: string | null | undefined): string[] {
  const own = (saved ?? '').trim();
  return own && !PATIENT_TITLES.includes(own) ? [...PATIENT_TITLES, own] : [...PATIENT_TITLES];
}

export interface FormalNameParts {
  title?: string | null;
  initials?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

/**
 * "Mrs N M Shilongo". Initials left blank come from the first names. null when the file has neither a title nor
 * initials (or no surname): the full name is shown instead.
 */
export function formalPatientName(parts: FormalNameParts): string | null {
  const title = (parts.title ?? '').trim();
  const savedInitials = normalizeInitials(parts.initials);
  const surname = (parts.last_name ?? '').replace(/\s+/g, ' ').trim();
  if ((!title && !savedInitials) || !surname) return null;
  const initials = (savedInitials || normalizeInitials(initialsOf(parts.first_name))).split('').join(' ');
  return [title, initials, surname].filter(Boolean).join(' ');
}

/**
 * The initials once the first names change: they follow the names while they are blank or still the initials of the
 * names before the change; initials reception typed themselves stay. null means leave the field as it is.
 */
export function followInitials(
  currentInitials: string | null | undefined,
  previousFirstNames: string | null | undefined,
  nextFirstNames: string | null | undefined
): string | null {
  const current = normalizeInitials(currentInitials);
  if (current && current !== normalizeInitials(initialsOf(previousFirstNames))) return null;
  const next = normalizeInitials(initialsOf(nextFirstNames));
  return next === current ? null : next;
}
