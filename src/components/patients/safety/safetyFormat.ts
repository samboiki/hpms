import { format, isValid, parseISO } from 'date-fns';
import type { AllergyRecord, AllergySeverity } from '../../../services/patientSafetyService';

/** "7 Oct 2026" for a date key or timestamp; null when it cannot be read. */
export function formatSafetyDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? format(date, 'd MMM yyyy') : null;
}

/** Practitioners, nurses and practice admins may verify an allergy (the database checks the same). */
export const canVerifyAllergies = (role: string | null | undefined): boolean => role === 'doctor' || role === 'nurse' || role === 'admin';

/** "Penicillin (severe: anaphylaxis)" for letters and summaries */
export function allergyDescription(allergy: Pick<AllergyRecord, 'substance' | 'severity' | 'reaction'>): string {
  const details = [allergy.severity !== 'unknown' ? allergy.severity : null, allergy.reaction].filter(Boolean).join(': ');
  return details ? `${allergy.substance} (${details})` : allergy.substance;
}

export const SEVERITY_CHIP: Readonly<Record<AllergySeverity, string>> = {
  severe: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  moderate: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  mild: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
  unknown: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'
};

/** Common allergies offered while typing (any other substance can be typed) */
export const COMMON_ALLERGY_SUBSTANCES: readonly string[] = [
  'Penicillin',
  'Amoxicillin',
  'Cephalosporins',
  'Sulfa drugs (sulfonamides)',
  'Aspirin',
  'NSAIDs (ibuprofen, diclofenac)',
  'Codeine',
  'Local anaesthetic',
  'Latex',
  'Iodine / contrast',
  'Chlorhexidine',
  'Peanuts',
  'Eggs',
  'Shellfish',
  'Bee stings'
];
