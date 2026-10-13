/**
 * The duplicate finder (Patients > More > Possible duplicates): pairs of files of one practice that may be the same
 * person, for an administrator to merge. A pair shares an ID number, a medical aid membership (fund, number and
 * dependant code: sameMembership), or a name together with a date of birth or a cell number. The rules are the
 * registration check's (duplicatePatients.ts), applied to every file of the practice: files are grouped by each fact,
 * so thousands of files are compared in one pass instead of each with every other.
 */
import { normalizePhoneNumber } from '../../components/patients/patientContact';
import {
  memberFactsOf,
  membershipOf,
  normalizeName,
  referenceNumberKey,
  sameMembership,
  sameName,
  type DuplicateReason,
  type ExistingMembership,
  type ExistingPatient
} from './duplicatePatients';
import { normalizeIdNumber } from './namibianId';
import { isTemporaryIdNumber, patientFileStatus } from './temporaryPatient';

export type PairReason = Extract<DuplicateReason, 'id_number' | 'membership' | 'name_and_birth_date' | 'name_and_cell'>;

/** A current file of the practice with what the finder compares and shows */
export interface PracticeFile extends ExistingPatient {
  gender?: string | null;
  system_patient_reference_number?: number | null;
}

export interface DuplicatePair {
  /** The two files, the older one (lower OneHealth reference) first */
  files: [PracticeFile, PracticeFile];
  reasons: PairReason[];
}

/**
 * More files than this sharing one fact are not offered as pairs: a number typed on many files (the practice's own
 * phone, a placeholder) says nothing about who is the same person, and would bury the real pairs.
 */
export const LARGEST_GROUP = 6;

/** The first given name and the surname in a fixed order, so a name typed the wrong way round gives the same key */
function nameKey(file: PracticeFile): string {
  const first = normalizeName(file.first_name).split(' ')[0] ?? '';
  const last = normalizeName(file.last_name);
  return first && last ? [first, last].sort().join('|') : '';
}

const sameNameFiles = (a: PracticeFile, b: PracticeFile): boolean => sameName({ firstName: a.first_name, lastName: a.last_name }, b);

const referenceOf = (file: PracticeFile): number => file.system_patient_reference_number ?? Number.MAX_SAFE_INTEGER;

function groupBy<T>(items: readonly T[], keysOf: (item: T) => readonly string[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    for (const key of new Set(keysOf(item))) {
      if (!key) continue;
      const group = groups.get(key);
      if (group) group.push(item);
      else groups.set(key, [item]);
    }
  }
  return groups;
}

/** Pairs of files that may be the same person: the same ID number first, then the pairs with the most reasons. */
export function findDuplicatePairs(files: readonly PracticeFile[]): DuplicatePair[] {
  const pairs = new Map<string, DuplicatePair>();
  const add = (a: PracticeFile, b: PracticeFile, reason: PairReason) => {
    if (a.id === b.id) return;
    const ordered: [PracticeFile, PracticeFile] = referenceOf(a) < referenceOf(b) || (referenceOf(a) === referenceOf(b) && a.id < b.id) ? [a, b] : [b, a];
    const key = `${ordered[0].id}|${ordered[1].id}`;
    const pair = pairs.get(key) ?? { files: ordered, reasons: [] };
    if (!pair.reasons.includes(reason)) pair.reasons.push(reason);
    pairs.set(key, pair);
  };
  const pairsIn = <T,>(groups: Map<string, T[]>, visit: (a: T, b: T) => void) => {
    for (const group of groups.values()) {
      if (group.length < 2 || group.length > LARGEST_GROUP) continue;
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) visit(group[i], group[j]);
      }
    }
  };

  // The same ID number (never the placeholder of a file booked with a name and cell only)
  pairsIn(groupBy(files, file => [isTemporaryIdNumber(file.id_number) ? '' : normalizeIdNumber(file.id_number)]), (a, b) => add(a, b, 'id_number'));

  // The same membership: grouped by number, then fund and dependant code (or first name or birthday) decide
  type Member = { file: PracticeFile; row: ExistingMembership };
  const members: Member[] = files.flatMap(file => (file.medical_aid_details ?? []).map(row => ({ file, row })));
  pairsIn(groupBy(members, member => [referenceNumberKey(member.row.membership_number)]), (a, b) => {
    if (a.file.id !== b.file.id && sameMembership(membershipOf(a.row), memberFactsOf(a.file), membershipOf(b.row), memberFactsOf(b.file))) {
      add(a.file, b.file, 'membership');
    }
  });

  // The same name with the same date of birth (a temporary file's placeholder birthday is not one)
  pairsIn(
    groupBy(files, file => {
      const birthDate = (patientFileStatus(file).dateOfBirth ?? '').slice(0, 10);
      const name = nameKey(file);
      return [birthDate && name ? `${name}|${birthDate}` : ''];
    }),
    (a, b) => { if (sameNameFiles(a, b)) add(a, b, 'name_and_birth_date'); }
  );

  // The same name with the same cell number in any format (a caller's temporary file and their full file)
  pairsIn(
    groupBy(files, file => {
      const cell = normalizePhoneNumber(file.cell_number);
      const name = nameKey(file);
      return [cell && name ? `${name}|${cell}` : ''];
    }),
    (a, b) => { if (sameNameFiles(a, b)) add(a, b, 'name_and_cell'); }
  );

  const rank = (pair: DuplicatePair): number => (pair.reasons.includes('id_number') ? 0 : 1);
  const label = (pair: DuplicatePair): string => `${normalizeName(pair.files[0].last_name)} ${normalizeName(pair.files[0].first_name)}`;
  return [...pairs.values()].sort((a, b) => rank(a) - rank(b) || b.reasons.length - a.reasons.length || label(a).localeCompare(label(b)));
}

/** Pairs that no longer apply once a file is archived by a merge */
export function withoutFile(pairs: readonly DuplicatePair[], patientId: string): DuplicatePair[] {
  return pairs.filter(pair => pair.files[0].id !== patientId && pair.files[1].id !== patientId);
}
