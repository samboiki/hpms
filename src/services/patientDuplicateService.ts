/**
 * The duplicate-patient check at registration: the practice's patients with the same ID number or the
 * same date of birth, its temporary files (booked with a name and cell only) whose cell number ends in
 * the same four digits, and, when reception typed them, files whose medical aid membership number or old
 * file number ends in the same digits, are read (up to five small queries);
 * src/utils/patients/duplicatePatients.ts decides which of them may be the same person.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { normalizePhoneNumber } from '../components/patients/patientContact';
import { isMissingColumnError } from '../utils/diary/dbErrors';
import {
  combineDuplicateMatches,
  findCallerDuplicates,
  findDuplicatePatients,
  findTemporaryFilesByCell,
  referenceNumberKey,
  type CallerIdentity,
  type DuplicateMatch,
  type ExistingMembership,
  type ExistingPatient,
  type PatientIdentity
} from '../utils/patients/duplicatePatients';
import { normalizeIdNumber } from '../utils/patients/namibianId';
import { TEMPORARY_ID_PREFIX } from '../utils/patients/temporaryPatient';

const COLUMNS = 'id, first_name, last_name, id_number, date_of_birth, cell_number';
// The registration check also compares old file numbers (patients.legacy_account_number, from the Eminance import);
// the generated types do not know that column yet, so these reads go through the untyped client
const REGISTRATION_COLUMNS = `${COLUMNS}, legacy_account_number`;
const untypedDb = supabase as unknown as SupabaseClient;

/** The last four digits of a dialable cell number ('' otherwise): the stored formats all end in them */
const cellEnding = (cellNumber: string | null | undefined): string => (normalizePhoneNumber(cellNumber) ?? '').replace(/\D/g, '').slice(-4);

/**
 * The last digits of a membership or old file number for a LIKE lookup ('' when it has fewer than 3): saved numbers
 * may carry leading zeros or letters around them, so the rule (referenceNumberKey) decides afterwards.
 */
const digitsEnding = (value: string | null | undefined): string => {
  const key = referenceNumberKey(value);
  return key ? key.replace(/\D/g, '').slice(-4) : '';
};

interface MembershipRow extends ExistingMembership {
  patient: ExistingPatient | null;
}

/**
 * The practice's files with a medical aid membership number ending in these digits, each with that medical aid. Read
 * through the file (patients!inner), so only this practice's current files come back: an archived file has no practice.
 */
async function filesByMembership(practiceId: string, ending: string): Promise<ExistingPatient[]> {
  const lookup = (fields: string) =>
    untypedDb
      .from('medical_aid_details')
      .select(`${fields}, patient:patients!inner(${REGISTRATION_COLUMNS})`)
      .eq('patient.practice_id', practiceId)
      .ilike('membership_number', `%${ending}%`)
      .limit(50);
  let result = await lookup('medical_aid_provider_id, provider, membership_number, dependant_code');
  // Before proposals/2026-10-07-dependant-code.sql the column is missing: the membership is compared without it
  if (result.error && isMissingColumnError(result.error)) result = await lookup('medical_aid_provider_id, provider, membership_number');
  if (result.error) throw new Error(`Could not check for an existing file: ${result.error.message}`);
  return ((result.data ?? []) as unknown as MembershipRow[]).flatMap(({ patient, ...membership }) =>
    patient ? [{ ...patient, medical_aid_details: [membership] }] : []
  );
}

/** One entry per file: what each lookup read about it (old file number, medical aids) together */
function mergeRows(rows: readonly ExistingPatient[]): ExistingPatient[] {
  const byId = new Map<string, ExistingPatient>();
  for (const row of rows) {
    const known = byId.get(row.id);
    byId.set(row.id, known ? {
      ...known,
      legacy_account_number: known.legacy_account_number ?? row.legacy_account_number ?? null,
      medical_aid_details: [...(known.medical_aid_details ?? []), ...(row.medical_aid_details ?? [])]
    } : row);
  }
  return [...byId.values()];
}

export async function findPracticeDuplicates(practiceId: string, candidate: PatientIdentity): Promise<DuplicateMatch[]> {
  const typedId = (candidate.idNumber ?? '').trim();
  const idVariants = [...new Set([typedId, normalizeIdNumber(typedId)].filter(Boolean))];
  const birthDate = (candidate.dateOfBirth ?? '').slice(0, 10);
  const cellEnd = cellEnding(candidate.cellNumber);
  const oldNumberEnd = digitsEnding(candidate.oldFileNumber);
  const membershipEnd = digitsEnding(candidate.membership?.number);

  const [byId, byBirthDate, temporaryByCell, byOldNumber, membershipFiles] = await Promise.all([
    idVariants.length > 0 ? untypedDb.from('patients').select(REGISTRATION_COLUMNS).eq('practice_id', practiceId).in('id_number', idVariants) : null,
    birthDate ? untypedDb.from('patients').select(REGISTRATION_COLUMNS).eq('practice_id', practiceId).eq('date_of_birth', birthDate) : null,
    cellEnd.length === 4
      ? supabase.from('patients').select(COLUMNS).eq('practice_id', practiceId).ilike('id_number', `${TEMPORARY_ID_PREFIX}%`).ilike('cell_number', `%${cellEnd}%`).limit(50)
      : null,
    oldNumberEnd
      ? untypedDb.from('patients').select(REGISTRATION_COLUMNS).eq('practice_id', practiceId).ilike('legacy_account_number', `%${oldNumberEnd}%`).limit(50)
      : null,
    membershipEnd ? filesByMembership(practiceId, membershipEnd) : []
  ]);
  for (const result of [byId, byBirthDate, temporaryByCell, byOldNumber]) {
    if (result?.error) throw new Error(`Could not check for an existing file: ${result.error.message}`);
  }
  const rows = mergeRows([
    ...((byId?.data ?? []) as ExistingPatient[]),
    ...((byBirthDate?.data ?? []) as ExistingPatient[]),
    ...((byOldNumber?.data ?? []) as ExistingPatient[]),
    ...membershipFiles
  ]);
  return combineDuplicateMatches(
    findDuplicatePatients(candidate, rows),
    findTemporaryFilesByCell(candidate, (temporaryByCell?.data ?? []) as ExistingPatient[])
  );
}

/** A typed name for a LIKE pattern: % and _ (and *, PostgREST's wildcard) are dropped, so they never match everyone. */
const likeText = (value: string): string => value.replace(/[\\%_*]/g, '').replace(/\s+/g, ' ').trim();

/**
 * The duplicate check for a caller booked with a name and cell number only (no ID number or birthday yet): the
 * practice's patients with the surname (or the first name as surname: names are often swapped) and those whose cell
 * number ends in the same four digits are read (three small queries), then findCallerDuplicates compares the full
 * name and the number in any format ("081 123 4567", "+264811234567").
 */
export async function findPracticeDuplicatesForCaller(practiceId: string, caller: CallerIdentity): Promise<DuplicateMatch[]> {
  const surname = likeText(caller.lastName ?? '');
  const firstName = likeText(caller.firstName ?? '').split(' ')[0] ?? '';
  const cellEnd = cellEnding(caller.cellNumber);
  const bySurname = (name: string) =>
    supabase.from('patients').select(COLUMNS).eq('practice_id', practiceId).ilike('last_name', `%${name}%`).limit(100);

  const results = await Promise.all([
    surname ? bySurname(surname) : null,
    firstName && firstName.toLowerCase() !== surname.toLowerCase() ? bySurname(firstName) : null,
    cellEnd.length === 4 ? supabase.from('patients').select(COLUMNS).eq('practice_id', practiceId).ilike('cell_number', `%${cellEnd}%`).limit(200) : null
  ]);
  for (const result of results) {
    if (result?.error) throw new Error(`Could not check for an existing file: ${result.error.message}`);
  }
  return findCallerDuplicates(caller, results.flatMap(result => (result?.data ?? []) as ExistingPatient[]));
}

/**
 * True when a save failed because the ID number is already on another file of the practice: patients.id_number is
 * unique per practice (patients_practice_id_number_key, proposals/2026-10-09-patient-merge.sql), so a person may be a
 * patient at several practices. The duplicate check normally finds that file first; this covers a file saved at the
 * same moment.
 */
export function isDuplicateIdNumberError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message, details } = error as { code?: string; message?: string; details?: string };
  return code === '23505' && /id_number/i.test(`${message ?? ''} ${details ?? ''}`);
}
