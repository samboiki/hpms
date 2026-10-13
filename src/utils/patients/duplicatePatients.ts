/**
 * The duplicate-patient check run before a new patient is saved.
 *
 * Two files for one person split the history: allergies on one file are missing from the other, and
 * the fund sees two "patients" with one membership number. A new registration is compared with the
 * practice's patients on three facts reception always has:
 *   - the same ID number;
 *   - the same name and date of birth (first and last name, either way round: they are often swapped);
 *   - the same cell number and date of birth (a parent's number on a child's file).
 * It only warns: twins share a birthday and a parent's cell number, so reception may save anyway.
 * Two more facts are compared when reception typed them: the medical aid membership (fund, number and dependant code)
 * and the old file number (the paper file's number or the account number in the practice's previous system).
 * A caller booked with a name and cell number only has no ID number or birthday yet, so findCallerDuplicates compares
 * the name and the cell number on their own. Such a temporary file carries a placeholder birthday, so at registration
 * findTemporaryFilesByCell finds it by the cell number alone.
 */
import { normalizePhoneNumber } from '../../components/patients/patientContact';
import { sameFund } from '../remittance/funds';
import { numberKey } from '../remittance/text';
import { normalizeDependantCode } from './medicalAidMember';
import { normalizeIdNumber } from './namibianId';
import { isTemporaryIdNumber, patientFileStatus } from './temporaryPatient';

export type DuplicateReason =
  | 'id_number'
  | 'name_and_birth_date'
  | 'cell_and_birth_date'
  | 'name'
  | 'cell_number'
  | 'temporary_file'
  | 'membership'
  | 'old_file_number'
  | 'name_and_cell';

/** A medical aid membership as typed at registration or saved on a file (medical_aid_details) */
export interface MembershipIdentity {
  /** medical_aid_providers.id */
  fundId?: string | null;
  /** The fund's name or code ("PSEMAS", "MAG1") */
  fundName?: string | null;
  number: string | null | undefined;
  dependantCode?: string | null;
}

export interface PatientIdentity {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  idNumber: string | null | undefined;
  dateOfBirth: string | null | undefined;
  cellNumber: string | null | undefined;
  /** The number on the paper file or in the practice's previous system (patients.legacy_account_number) */
  oldFileNumber?: string | null;
  membership?: MembershipIdentity | null;
}

/** A saved medical aid as the duplicate checks read it */
export interface ExistingMembership {
  medical_aid_provider_id?: string | null;
  provider?: string | null;
  membership_number?: string | null;
  dependant_code?: string | null;
}

export interface ExistingPatient {
  id: string;
  first_name: string | null;
  last_name: string | null;
  id_number: string | null;
  date_of_birth: string | null;
  cell_number: string | null;
  legacy_account_number?: string | null;
  medical_aid_details?: ReadonlyArray<ExistingMembership> | null;
}

export interface DuplicateMatch {
  patient: ExistingPatient;
  reasons: DuplicateReason[];
}

export const DUPLICATE_REASON_LABELS: Readonly<Record<DuplicateReason, string>> = {
  id_number: 'Same ID number',
  name_and_birth_date: 'Same name and date of birth',
  cell_and_birth_date: 'Same cell number and date of birth',
  name: 'Same name',
  cell_number: 'Same cell number',
  temporary_file: 'Booked earlier with this cell number; the file is not complete',
  membership: 'Same medical aid and membership number',
  old_file_number: 'Same old file number',
  name_and_cell: 'Same name and cell number'
};

/** "  Ndapewa-Maria  " -> "ndapewa maria"; accents dropped ("Hélène" -> "helene"). */
export function normalizeName(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const firstWord = (value: string): string => value.split(' ')[0] ?? '';

/** Same person by name: same surname and the same first given name (middle names are often left out). */
export function sameName(a: Pick<PatientIdentity, 'firstName' | 'lastName'>, b: Pick<ExistingPatient, 'first_name' | 'last_name'>): boolean {
  const aFirst = firstWord(normalizeName(a.firstName));
  const aLast = normalizeName(a.lastName);
  const bFirst = firstWord(normalizeName(b.first_name));
  const bLast = normalizeName(b.last_name);
  if (!aFirst || !aLast || !bFirst || !bLast) return false;
  const straight = aLast === bLast && aFirst === bFirst;
  const swapped = aLast === bFirst && aFirst === bLast;
  return straight || swapped;
}

/**
 * A membership or old file number compared without spaces, dashes, slashes or leading zeros ("0012 345" is "12345");
 * '' when it holds fewer than 3 digits, so a placeholder such as "N/A" or "0" never matches every file.
 */
export function referenceNumberKey(value: string | null | undefined): string {
  const key = numberKey(value);
  return (key.match(/\d/g) ?? []).length >= 3 ? key : '';
}

/** The same fund: by its id when both are known, otherwise by name or code (MAG1 is PSEMAS) */
function sameFundOf(a: MembershipIdentity, b: MembershipIdentity): boolean {
  if (a.fundId && b.fundId) return a.fundId === b.fundId;
  return sameFund(a.fundName, b.fundName);
}

/** The facts that tell family members on one membership apart when a dependant code is missing */
export interface MemberFacts {
  firstName: string | null | undefined;
  /** A real date of birth (not a temporary file's placeholder) */
  dateOfBirth: string | null | undefined;
}

/**
 * The same person on the same membership: same fund, same number and same dependant code. A family shares the number,
 * so when either side has no dependant code (most files have none yet) the first given name or the date of birth must
 * agree as well, or every child of a main member would look like a duplicate of the parent.
 */
export function sameMembership(a: MembershipIdentity, aPerson: MemberFacts, b: MembershipIdentity, bPerson: MemberFacts): boolean {
  const number = referenceNumberKey(a.number);
  if (!number || number !== referenceNumberKey(b.number) || !sameFundOf(a, b)) return false;
  const aCode = normalizeDependantCode(a.dependantCode);
  const bCode = normalizeDependantCode(b.dependantCode);
  if (aCode && bCode) return aCode === bCode;
  const aFirst = firstWord(normalizeName(aPerson.firstName));
  const sameFirstName = !!aFirst && aFirst === firstWord(normalizeName(bPerson.firstName));
  const aBirth = (aPerson.dateOfBirth ?? '').slice(0, 10);
  return sameFirstName || (!!aBirth && aBirth === (bPerson.dateOfBirth ?? '').slice(0, 10));
}

/** A saved medical aid row as a membership */
export const membershipOf = (row: ExistingMembership): MembershipIdentity => ({
  fundId: row.medical_aid_provider_id ?? null,
  fundName: row.provider ?? null,
  number: row.membership_number ?? null,
  dependantCode: row.dependant_code ?? null
});

/** The facts of a saved file, without a temporary file's placeholder birthday */
export const memberFactsOf = (patient: ExistingPatient): MemberFacts => ({
  firstName: patient.first_name,
  dateOfBirth: patientFileStatus(patient).dateOfBirth
});

/** The practice's patients that may be the person being registered, best matches first. */
export function findDuplicatePatients(candidate: PatientIdentity, existing: readonly ExistingPatient[]): DuplicateMatch[] {
  const idNumber = normalizeIdNumber(candidate.idNumber);
  const birthDate = (candidate.dateOfBirth ?? '').slice(0, 10);
  const cell = normalizePhoneNumber(candidate.cellNumber);
  const oldFileNumber = referenceNumberKey(candidate.oldFileNumber);
  const membership = candidate.membership && referenceNumberKey(candidate.membership.number) ? candidate.membership : null;
  const candidateFacts: MemberFacts = { firstName: candidate.firstName, dateOfBirth: candidate.dateOfBirth };
  const seen = new Set<string>();
  const matches: DuplicateMatch[] = [];

  for (const patient of existing) {
    if (seen.has(patient.id)) continue;
    seen.add(patient.id);
    const reasons: DuplicateReason[] = [];
    if (idNumber && normalizeIdNumber(patient.id_number) === idNumber) reasons.push('id_number');
    const sameBirthDate = !!birthDate && (patient.date_of_birth ?? '').slice(0, 10) === birthDate;
    if (sameBirthDate && sameName(candidate, patient)) reasons.push('name_and_birth_date');
    if (sameBirthDate && cell && normalizePhoneNumber(patient.cell_number) === cell) reasons.push('cell_and_birth_date');
    if (membership && (patient.medical_aid_details ?? []).some(row => sameMembership(membership, candidateFacts, membershipOf(row), memberFactsOf(patient)))) {
      reasons.push('membership');
    }
    if (oldFileNumber && referenceNumberKey(patient.legacy_account_number) === oldFileNumber) reasons.push('old_file_number');
    if (reasons.length > 0) matches.push({ patient, reasons });
  }

  // The same ID number first: it is almost certainly the same person
  return matches.sort((a, b) => Number(b.reasons.includes('id_number')) - Number(a.reasons.includes('id_number')) || b.reasons.length - a.reasons.length);
}

/** A caller booked by phone: only a name and a cell number are known. */
export interface CallerIdentity {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  cellNumber: string | null | undefined;
}

/**
 * The practice's patients that may be the caller: the same name (first given name and surname, either way round) or
 * the same cell number in any format. Families share a cell number and names repeat, so the files are only offered;
 * files with both the name and the number come first.
 */
export function findCallerDuplicates(caller: CallerIdentity, existing: readonly ExistingPatient[]): DuplicateMatch[] {
  const identity: PatientIdentity = { ...caller, idNumber: null, dateOfBirth: null };
  const cell = normalizePhoneNumber(caller.cellNumber);
  const seen = new Set<string>();
  const matches: DuplicateMatch[] = [];

  for (const patient of existing) {
    if (seen.has(patient.id)) continue;
    seen.add(patient.id);
    const reasons: DuplicateReason[] = [];
    if (sameName(identity, patient)) reasons.push('name');
    if (cell && normalizePhoneNumber(patient.cell_number) === cell) reasons.push('cell_number');
    if (reasons.length > 0) matches.push({ patient, reasons });
  }

  return matches.sort((a, b) => b.reasons.length - a.reasons.length);
}

/**
 * Temporary files (booked by phone or on the website with a name and cell number only) with the same cell number as the
 * person being registered, in any format and whatever their birthday: theirs is a placeholder, so the name-and-birthday
 * rule misses them, and the caller would end up with two files while the booking stays on the incomplete one.
 */
export function findTemporaryFilesByCell(candidate: PatientIdentity, existing: readonly ExistingPatient[]): DuplicateMatch[] {
  const cell = normalizePhoneNumber(candidate.cellNumber);
  if (!cell) return [];
  const seen = new Set<string>();
  const matches: DuplicateMatch[] = [];
  for (const patient of existing) {
    if (seen.has(patient.id)) continue;
    seen.add(patient.id);
    if (isTemporaryIdNumber(patient.id_number) && normalizePhoneNumber(patient.cell_number) === cell) {
      matches.push({ patient, reasons: ['temporary_file'] });
    }
  }
  return matches;
}

/**
 * Matches of several checks as one list, one entry per file with all its reasons: the same ID number first, then
 * temporary files (most likely the person being registered), then the files with the most reasons.
 */
export function combineDuplicateMatches(...lists: ReadonlyArray<readonly DuplicateMatch[]>): DuplicateMatch[] {
  const byId = new Map<string, DuplicateMatch>();
  for (const match of lists.flat()) {
    const known = byId.get(match.patient.id);
    if (!known) byId.set(match.patient.id, { patient: match.patient, reasons: [...match.reasons] });
    else match.reasons.forEach(reason => { if (!known.reasons.includes(reason)) known.reasons.push(reason); });
  }
  const rank = (match: DuplicateMatch): number => (match.reasons.includes('id_number') ? 0 : match.reasons.includes('temporary_file') ? 1 : 2);
  return [...byId.values()].sort((a, b) => rank(a) - rank(b) || b.reasons.length - a.reasons.length);
}
