/**
 * The people in an Eminance patient list, and the family accounts they form.
 *
 * Eminance keys a person by account and dependant number: ACCOUNT_KEY is the family (guarantor) account and
 * PATIENT_KEY 0 its main member, who pays for everyone on it. The medical aid plan sits on the account
 * (MEDICALAID_KEY), so a dependant's row in an export often leaves it out: it is taken from the main member.
 */
import { normalizeDependantCode } from '../patients/medicalAidMember';
import { birthDateMismatch, checkIdNumber } from '../patients/namibianId';
import type { Cell } from '../billing/tariffImport';
import type { ColumnMapping, FieldKey } from './eminanceFields';
import {
  canonicalAccountNumber,
  cleanText,
  isMobileNumber,
  isPlausibleEmail,
  parseImportDate,
  readLanguage,
  readRelationship,
  readSex,
  sexFromTitle,
  splitFullName,
  valueKey,
  type Relationship,
  type Sex
} from './importValues';
import type { ImportTable } from './tableFile';

export interface RowProblem {
  message: string;
  /** True when the row cannot be brought over */
  blocking: boolean;
}

/** What staff chose for values the import cannot read by itself (for example sex written as 0, 1 and 2) */
export interface ValueChoices {
  /** valueKey(raw) -> the sex it means, or 'skip' to leave those people out */
  sex: Readonly<Record<string, Sex | 'skip'>>;
  /** valueKey(raw) -> the relationship it means */
  relationship: Readonly<Record<string, Relationship>>;
}

export const NO_CHOICES: ValueChoices = { sex: {}, relationship: {} };

export interface PersonRow {
  /** 'p:<file>:<line>': how family, balance, recall and claim rows name this person */
  key: string;
  fileName: string;
  line: number;
  accountNumber: string;
  /** Eminance's own dependant number (PATIENT_KEY): 0 is the main member */
  dependantNumber: string | null;
  /** The code on the medical aid card, two digits ("00", "01") */
  dependantCode: string | null;
  firstName: string;
  surname: string;
  initials: string;
  /** As OneHealth saves it (spaces and dashes removed); null when there is none */
  idNumber: string | null;
  dateOfBirth: string | null;
  sex: Sex | null;
  /** The sex as written, when it could not be read (shown in the wizard so staff can say what it means) */
  sexRaw: string;
  /** True while staff have not said what sexRaw means */
  needsSexChoice: boolean;
  cellNumber: string | null;
  email: string | null;
  homeLanguage: 'English' | 'Afrikaans' | 'Oshiwambo' | 'Other' | null;
  occupation: string | null;
  employer: string | null;
  homeAddress: string | null;
  postalAddress: string | null;
  postalCode: string | null;
  medicalAidRaw: string | null;
  option: string | null;
  membershipNumber: string | null;
  relationship: Relationship | null;
  relationshipRaw: string;
  alert: string | null;
  recallDate: string | null;
  recallReason: string | null;
  problems: RowProblem[];
}

export interface ReadOptions {
  fileName: string;
  fileIndex: number;
  /** yyyy-MM-dd */
  today: string;
  choices: ValueChoices;
}

const cellOf = (cells: readonly Cell[], mapping: ColumnMapping, key: FieldKey): Cell =>
  mapping[key] === undefined ? null : cells[mapping[key] as number];

const textOf = (cells: readonly Cell[], mapping: ColumnMapping, key: FieldKey, max = 200): string =>
  cleanText(cellOf(cells, mapping, key), max);

const orNull = (value: string): string | null => (value === '' ? null : value);

/** Several address columns as one line: "12 Main Street, Klein Windhoek, Windhoek" */
const joinParts = (...parts: string[]): string | null => orNull(parts.filter(Boolean).join(', ').slice(0, 300));

/** Eminance keeps a code number in *_KEY columns (OCCUPATION_KEY, EMPLOYER_KEY): a number is not an occupation */
const wordsOnly = (value: string): string | null => (value === '' || /^\d+$/.test(value) ? null : value);

/** One person from one row of a patient list, with everything that stops or limits the import of that row */
export function readPerson(cells: readonly Cell[], line: number, mapping: ColumnMapping, options: ReadOptions): PersonRow {
  const problems: RowProblem[] = [];
  const block = (message: string) => problems.push({ message, blocking: true });
  const warn = (message: string) => problems.push({ message, blocking: false });

  const accountNumber = canonicalAccountNumber(cellOf(cells, mapping, 'accountNumber'));
  if (!accountNumber) block('No account number');
  else if (accountNumber.length > 20) block('The account number is longer than 20 characters');

  let firstName = textOf(cells, mapping, 'firstName', 100);
  let surname = textOf(cells, mapping, 'surname', 100);
  if ((!firstName || !surname) && mapping.fullName !== undefined) {
    const split = splitFullName(textOf(cells, mapping, 'fullName', 200));
    firstName = firstName || split.firstName;
    surname = surname || split.surname;
  }
  const initials = textOf(cells, mapping, 'initials', 10).replace(/[^\p{L}]/gu, '').toUpperCase();
  // Eminance often has only initials where the first names should be
  if (!firstName && initials) firstName = initials;
  if (!firstName || !surname) block('No first name or surname');

  const idCheck = checkIdNumber(textOf(cells, mapping, 'idNumber', 40), options.today);
  let idNumber: string | null = null;
  if (idCheck.kind !== 'empty') {
    if (!/^[A-Z0-9]{5,20}$/.test(idCheck.normalized)) {
      warn(`The ID number "${idCheck.normalized}" is not a valid ID or passport number: it was left out`);
    } else {
      idNumber = idCheck.normalized;
    }
  }

  let dateOfBirth = parseImportDate(cellOf(cells, mapping, 'dateOfBirth'), options.today, 'past');
  if (!dateOfBirth && idNumber && idCheck.dateOfBirth) {
    dateOfBirth = idCheck.dateOfBirth;
    warn('The date of birth was read from the ID number');
  }
  if (!dateOfBirth) {
    block(textOf(cells, mapping, 'dateOfBirth') ? 'The date of birth is not a date' : 'No date of birth (and no Namibian ID number to read it from)');
  } else if (dateOfBirth > options.today) {
    block('The date of birth is in the future');
  } else if (idNumber) {
    const mismatch = birthDateMismatch(idCheck, dateOfBirth);
    if (mismatch) warn(mismatch);
  }
  if (!idNumber) warn('No ID number: the file gets a placeholder (NOID-...) until you add the number');

  const sexRaw = textOf(cells, mapping, 'sex', 40);
  const chosenSex = options.choices.sex[valueKey(sexRaw)];
  let sex: Sex | null = readSex(sexRaw) ?? (chosenSex && chosenSex !== 'skip' ? chosenSex : null);
  if (!sex && chosenSex !== 'skip') sex = sexFromTitle(cellOf(cells, mapping, 'title'));
  if (chosenSex === 'skip' && !readSex(sexRaw)) block(`Left out: sex written as "${sexRaw}"`);
  else if (!sex) block(sexRaw ? `The sex "${sexRaw}" is not known: say what it means above` : 'No sex recorded');

  const cell = textOf(cells, mapping, 'cell', 40);
  const phone = textOf(cells, mapping, 'phone', 40);
  let cellNumber = orNull(cell);
  if (!cellNumber && phone && isMobileNumber(phone)) {
    cellNumber = phone;
    warn('The cell number was taken from the phone column');
  }

  let email = orNull(textOf(cells, mapping, 'email', 200));
  if (email && !isPlausibleEmail(email)) {
    warn(`"${email}" is not an email address: it was left out`);
    email = null;
  }

  const dependantNumber = orNull(textOf(cells, mapping, 'dependantNumber', 10));
  const dependantCode = orNull(normalizeDependantCode(textOf(cells, mapping, 'dependantCode', 10)));
  const relationshipRaw = textOf(cells, mapping, 'relationship', 40);
  const relationship = readRelationship(relationshipRaw) ?? options.choices.relationship[valueKey(relationshipRaw)] ?? null;

  const alert = textOf(cells, mapping, 'alert', 280);
  const recallText = textOf(cells, mapping, 'recallDate');
  const recallDate = parseImportDate(cellOf(cells, mapping, 'recallDate'), options.today, 'near');
  if (recallText && !recallDate) warn(`The recall date "${recallText}" is not a date: it was left out`);

  return {
    key: `p:${options.fileIndex}:${line}`,
    fileName: options.fileName,
    line,
    accountNumber,
    dependantNumber,
    dependantCode,
    firstName,
    surname,
    initials,
    idNumber,
    dateOfBirth,
    sex,
    sexRaw: sex ? '' : sexRaw,
    needsSexChoice: !sex && sexRaw !== '' && chosenSex === undefined,
    cellNumber,
    email,
    homeLanguage: readLanguage(cellOf(cells, mapping, 'language')),
    occupation: wordsOnly(textOf(cells, mapping, 'occupation', 100)),
    employer: wordsOnly(textOf(cells, mapping, 'employer', 150)),
    homeAddress: joinParts(textOf(cells, mapping, 'address1'), textOf(cells, mapping, 'address2'), textOf(cells, mapping, 'town')),
    postalAddress: joinParts(textOf(cells, mapping, 'postal1'), textOf(cells, mapping, 'postal2'), textOf(cells, mapping, 'postalTown')),
    postalCode: orNull(textOf(cells, mapping, 'postalCode', 20)),
    medicalAidRaw: orNull(textOf(cells, mapping, 'medicalAid', 100)),
    option: orNull(textOf(cells, mapping, 'option', 100)),
    membershipNumber: orNull(textOf(cells, mapping, 'membershipNumber', 30).replace(/\s+/g, '')),
    relationship,
    relationshipRaw: relationship ? '' : relationshipRaw,
    alert: alert.length >= 3 ? alert : null,
    recallDate,
    recallReason: orNull(textOf(cells, mapping, 'recallReason', 100)),
    problems
  };
}

export function readPeople(table: ImportTable, mapping: ColumnMapping, options: ReadOptions): PersonRow[] {
  return table.rows.map(row => readPerson(row.cells, row.line, mapping, options));
}

export const isBlocked = (person: PersonRow): boolean => person.problems.some(problem => problem.blocking);

/** Values staff must explain (sex or relationship written as codes), with how many people have each */
export function unreadValues(people: readonly PersonRow[], field: 'sexRaw' | 'relationshipRaw'): Array<{ key: string; raw: string; count: number }> {
  const found = new Map<string, { key: string; raw: string; count: number }>();
  for (const person of people) {
    const raw = person[field];
    if (!raw) continue;
    const key = valueKey(raw);
    const entry = found.get(key) ?? { key, raw, count: 0 };
    entry.count += 1;
    found.set(key, entry);
  }
  return [...found.values()].sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw));
}

export interface Family {
  accountNumber: string;
  members: PersonRow[];
  /** The main member, who pays for the family; null when the list does not say who it is */
  holder: PersonRow | null;
  problem: string | null;
}

const isMainMemberNumber = (value: string | null): boolean => value !== null && /^0+$/.test(value);

/**
 * People grouped by account. The account holder is the person marked as main member (relationship), else
 * Eminance's dependant number 0, else dependant code 00, else the only person on the account.
 */
export function groupFamilies(people: readonly PersonRow[]): Family[] {
  const byAccount = new Map<string, PersonRow[]>();
  for (const person of people) {
    if (!person.accountNumber) continue;
    byAccount.set(person.accountNumber, [...(byAccount.get(person.accountNumber) ?? []), person]);
  }
  return [...byAccount.entries()].map(([accountNumber, members]) => {
    let candidates = members.filter(member => member.relationship === 'self');
    if (candidates.length === 0) candidates = members.filter(member => isMainMemberNumber(member.dependantNumber));
    if (candidates.length === 0) candidates = members.filter(member => member.dependantNumber === null && isMainMemberNumber(member.dependantCode));
    if (candidates.length === 0 && members.length === 1) candidates = members;
    const holder = candidates[0] ?? null;
    const problem = !holder
      ? 'No main member on this account: its people are brought over without a family account, and its balance is not'
      : candidates.length > 1
        ? 'More than one main member on this account: the first one is the account holder'
        : null;
    return { accountNumber, members, holder, problem };
  });
}
