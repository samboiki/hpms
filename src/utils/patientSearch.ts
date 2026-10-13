/**
 * Patient search, shared by the patient pickers (Patients page, the patient file's list, the booking form, receipts).
 *
 * Every word typed must appear in one of the patient's fields, so staff can type a full name in any order ("Smith
 * John"), which a whole-query match against first_name or last_name alone can never find. Matches are ranked without
 * a mode switch: an exact word or number first, then one that starts with what was typed, then one that only contains
 * it, so a full ID number or surname puts that patient at the top. Numbers also match whatever spaces they were saved
 * with ("0811234567" finds "081 123 4567").
 */
import { isTemporaryIdNumber } from './patients/temporaryPatient';

/** 0 exact, 1 starts with, 2 contains */
export type PatientSearchRank = 0 | 1 | 2;

const EXACT: PatientSearchRank = 0;
const STARTS_WITH: PatientSearchRank = 1;
const CONTAINS: PatientSearchRank = 2;

const better = (a: PatientSearchRank | null, b: PatientSearchRank | null): PatientSearchRank | null =>
  a === null ? b : b === null ? a : a < b ? a : b;

function rankIn(word: string, text: string): PatientSearchRank | null {
  if (!text) return null;
  const parts = text.split(/[\s,;/-]+/).filter(Boolean);
  if (text === word || parts.includes(word)) return EXACT;
  if (text.startsWith(word) || parts.some(part => part.startsWith(word))) return STARTS_WITH;
  return text.includes(word) ? CONTAINS : null;
}

/** How well one typed word matches one field, or null. */
function wordRank(word: string, field: string): PatientSearchRank | null {
  const text = field.toLowerCase().trim();
  const asText = rankIn(word, text);
  if (asText === EXACT || !/^\d+$/.test(word)) return asText;
  // A number typed without the spaces or dashes it was saved with, and a Namibian cell saved as +264 81... typed 081...
  const digits = text.replace(/\D/g, '');
  const national = /^264\d{8,9}$/.test(digits) ? `0${digits.slice(3)}` : '';
  return better(better(asText, rankIn(word, digits)), rankIn(word, national));
}

/**
 * How well the patient matches the query: the rank of their weakest word, or null when a word matches nothing.
 * A blank query matches everyone.
 */
export function patientSearchRank(fields: ReadonlyArray<string | null | undefined>, query: string): PatientSearchRank | null {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const texts = fields.filter((field): field is string => typeof field === 'string' && field.trim() !== '');
  let weakest: PatientSearchRank = EXACT;
  for (const word of words) {
    let best: PatientSearchRank | null = null;
    for (const text of texts) {
      best = better(best, wordRank(word, text));
      if (best === EXACT) break;
    }
    if (best === null) return null;
    if (best > weakest) weakest = best;
  }
  return weakest;
}

/** True when every word of the query appears in at least one of the patient's searchable fields. */
export function matchesPatientSearch(fields: ReadonlyArray<string | null | undefined>, query: string): boolean {
  return patientSearchRank(fields, query) !== null;
}

export interface SearchablePatient {
  first_name?: string | null;
  last_name?: string | null;
  id_number?: string | null;
  cell_number?: string | null;
  email?: string | null;
  /** The OneHealth reference: shown as typed on statements (1234) and as 7 digits on claims (0001234) */
  system_patient_reference_number?: number | string | null;
  /** The account number in Eminance, for patients brought over from it */
  legacy_account_number?: string | null;
  medical_aid_details?: ReadonlyArray<{ membership_number?: string | null }> | null;
}

/**
 * What a patient is found by: names, ID number, OneHealth reference (1234 or 0001234), cell number, email, Eminance
 * account number and medical aid membership numbers. The placeholder ID number of a file opened with a name and cell
 * only is left out: it is not the patient's number.
 */
export function patientSearchFields(patient: SearchablePatient): Array<string | null | undefined> {
  const reference = patient.system_patient_reference_number;
  const referenceText = reference === null || reference === undefined ? '' : String(reference).trim();
  return [
    patient.first_name,
    patient.last_name,
    isTemporaryIdNumber(patient.id_number) ? null : patient.id_number,
    referenceText || null,
    referenceText ? referenceText.padStart(7, '0') : null,
    patient.cell_number,
    patient.email,
    patient.legacy_account_number,
    ...(patient.medical_aid_details ?? []).map(aid => aid.membership_number)
  ];
}
