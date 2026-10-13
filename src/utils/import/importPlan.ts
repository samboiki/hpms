/**
 * What an Eminance import will do, worked out before anything is saved: who is new, who is already in OneHealth,
 * which family accounts, medical aid details, opening balances, recall lists and claim history follow, and why
 * anything is left out. The wizard shows this plan (counts and problems per row), and stagedRows() turns it into the
 * rows that proposals/2026-10-07-eminance-import.sql imports (same keys and payload names).
 */
import { zeroBands, type BandCents } from '../../services/ledger/ageAnalysis';
import { AGE_BANDS, type AgeBand } from '../../services/ledger/receivables';
import { findDuplicatePatients, normalizeName, type ExistingPatient } from '../patients/duplicatePatients';
import { composeMainMemberName, initialsOf } from '../patients/medicalAidMember';
import { identifyFund } from '../remittance/funds';
import { combineBalances, sumBands, type BalancePortion, type BalanceRow } from './eminanceBalances';
import { uniqueClaimLines, type ClaimHistoryLine } from './eminanceClaims';
import { groupFamilies, type Family, type PersonRow } from './eminancePeople';
import { recallListDescription, recallListName, type RecallRow } from './eminanceRecalls';
import { accountKey, valueKey, type Relationship } from './importValues';

/** A patient already in OneHealth (the practice's own files only) */
export interface ExistingFile extends ExistingPatient {
  legacy_account_number: string | null;
}

/** A medical aid fund as medical_aid_providers holds it */
export interface FundOption {
  id: string;
  name: string;
  short_name: string | null;
  medical_aid_reference: string | null;
}

export interface PlanInput {
  /** yyyy-MM-dd */
  today: string;
  people: readonly PersonRow[];
  balances: ReadonlyArray<{ fileName: string; rows: readonly BalanceRow[]; portion: BalancePortion }>;
  recalls: readonly RecallRow[];
  claims: readonly ClaimHistoryLine[];
  existing: readonly ExistingFile[];
  funds: readonly FundOption[];
  /** valueKey(raw medical aid) -> provider id, or null for "no medical aid"; values left out use the suggestion */
  fundChoices: Readonly<Record<string, string | null>>;
  /** Who owes the balances of a "both portions" file on an account with a medical aid; null until staff choose */
  ownerOfBoth: 'medical_aid' | 'patient' | null;
}

export type Decision = 'new' | 'existing' | 'skip';

export interface PlannedMedicalAid {
  providerId: string;
  providerName: string;
  option: string | null;
  membershipNumber: string;
  mainMemberName: string;
  mainMemberIdNumber: string;
  relationship: Relationship;
  dependantCode: string | null;
}

export interface PlannedPerson {
  key: string;
  /** The row of the patient list; null for a OneHealth file found only by its Eminance account number */
  person: PersonRow | null;
  existing: ExistingFile | null;
  decision: Decision;
  /** Why the row is skipped or matched, in plain words */
  reason: string | null;
  warnings: string[];
  accountNumber: string;
  label: string;
  medicalAid: PlannedMedicalAid | null;
}

export interface PlannedLink {
  key: string;
  patientKey: string;
  holderKey: string;
  relationship: 'spouse' | 'child' | 'dependant';
  accountNumber: string;
  label: string;
}

export interface PlannedBalance {
  key: string;
  accountNumber: string;
  label: string;
  holderKey: string | null;
  bands: Array<{ band: AgeBand; patientCents: number; medicalAidCents: number }>;
  totalCents: number;
  creditLeftCents: number;
  skipReason: string | null;
  warnings: string[];
}

export interface PlannedRecall {
  key: string;
  line: number | null;
  patientKey: string | null;
  accountNumber: string;
  label: string;
  dueDate: string;
  reason: string | null;
  listName: string;
  skipReason: string | null;
}

export interface PlannedClaims {
  key: string;
  patientKey: string;
  accountNumber: string;
  label: string;
  lines: ClaimHistoryLine[];
}

export interface FundValue {
  key: string;
  raw: string;
  people: number;
  /** provider id, null = no medical aid, undefined = not recognised */
  suggested: string | null | undefined;
  chosen: string | null | undefined;
}

export interface PlanCounts {
  newPatients: number;
  existingPatients: number;
  skippedPatients: number;
  noIdNumber: number;
  withMedicalAid: number;
  familyLinks: number;
  accountsWithoutMainMember: number;
  balanceAccounts: number;
  balanceCents: number;
  medicalAidCents: number;
  patientCents: number;
  byBand: BandCents;
  creditSetOffCents: number;
  creditAccounts: number;
  creditLeftCents: number;
  balancesSkipped: number;
  recalls: number;
  recallsSkipped: number;
  claimLines: number;
  claimPatients: number;
  unmatchedClaimLines: number;
}

export interface ImportPlan {
  people: PlannedPerson[];
  families: Family[];
  links: PlannedLink[];
  balances: PlannedBalance[];
  recalls: PlannedRecall[];
  recallLists: Array<{ name: string; description: string; count: number }>;
  claims: PlannedClaims[];
  unmatchedClaims: Array<{ accountNumber: string; lines: number }>;
  fundValues: FundValue[];
  needsOwnerChoice: boolean;
  /** What staff must still decide before the import can start */
  openQuestions: string[];
  counts: PlanCounts;
}

const PRIVATE_VALUE = /^(priv|private|privaat|cash|kontant|none|geen|no medical aid)/i;

/** What a medical aid value means: a fund's id, null for "no medical aid", undefined when it is not recognised */
export function suggestedFund(raw: string, funds: readonly FundOption[]): string | null | undefined {
  const text = raw.trim();
  if (!text || PRIVATE_VALUE.test(text)) return null;
  const lower = text.toLowerCase();
  const exact = funds.find(fund => [fund.name, fund.short_name, fund.medical_aid_reference].some(value => (value ?? '').trim().toLowerCase() === lower));
  if (exact) return exact.id;
  // "NMC01" is a plan of NMC: try the letters it starts with too
  const identity = identifyFund(text) ?? identifyFund(/^[A-Za-z]+/.exec(text)?.[0] ?? '');
  if (!identity) return undefined;
  return funds.find(fund => identifyFund(fund.medical_aid_reference, fund.short_name, fund.name)?.code === identity.code)?.id;
}

const nameOf = (person: PersonRow): string => `${person.firstName} ${person.surname}`.trim();
const nameOfFile = (file: ExistingFile): string => `${file.first_name ?? ''} ${file.last_name ?? ''}`.trim() || 'OneHealth file';
const firstWord = (value: string): string => normalizeName(value).split(' ')[0] ?? '';
const keepsPlace = (planned: PlannedPerson | null | undefined): planned is PlannedPerson => !!planned && planned.decision !== 'skip';

interface Context {
  input: PlanInput;
  byKey: Map<string, PlannedPerson>;
  families: Map<string, Family>;
  byId: Map<string, ExistingFile[]>;
  byBirthDate: Map<string, ExistingFile[]>;
  byAccount: Map<string, ExistingFile[]>;
  /** OneHealth files standing in for accounts that only the balances, recalls or claims name */
  standIns: Map<string, PlannedPerson>;
  fundValues: Map<string, FundValue>;
}

function indexFiles(files: readonly ExistingFile[], keyOf: (file: ExistingFile) => string | null): Map<string, ExistingFile[]> {
  const map = new Map<string, ExistingFile[]>();
  for (const file of files) {
    const key = keyOf(file);
    if (key) map.set(key, [...(map.get(key) ?? []), file]);
  }
  return map;
}

/** New, already in OneHealth (same ID number, or same name and date of birth), or skipped (a blocking problem, a repeat) */
function decidePeople(people: readonly PersonRow[], context: Pick<Context, 'byId' | 'byBirthDate'>): PlannedPerson[] {
  const usedFiles = new Map<string, string>();
  const seenIds = new Map<string, PersonRow>();
  const seenNames = new Map<string, PersonRow>();
  return people.map(person => {
    const planned: PlannedPerson = {
      key: person.key, person, existing: null, decision: 'new', reason: null,
      warnings: person.problems.filter(problem => !problem.blocking).map(problem => problem.message),
      accountNumber: person.accountNumber, label: nameOf(person) || `Line ${person.line}`, medicalAid: null
    };
    const blocking = person.problems.find(problem => problem.blocking);
    if (blocking) return { ...planned, decision: 'skip', reason: blocking.message };

    const nameKey = `${firstWord(person.firstName)}|${normalizeName(person.surname)}|${person.dateOfBirth}`;
    const twin = (person.idNumber ? seenIds.get(person.idNumber) : undefined) ?? seenNames.get(nameKey);
    if (twin) return { ...planned, decision: 'skip', reason: `Also on line ${twin.line} (account ${twin.accountNumber}): brought over once` };
    if (person.idNumber) seenIds.set(person.idNumber, person);
    seenNames.set(nameKey, person);

    const candidates = [...(person.idNumber ? context.byId.get(person.idNumber) ?? [] : []), ...(context.byBirthDate.get(person.dateOfBirth ?? '') ?? [])];
    const matches = findDuplicatePatients(
      { firstName: person.firstName, lastName: person.surname, idNumber: person.idNumber, dateOfBirth: person.dateOfBirth, cellNumber: person.cellNumber },
      candidates
    );
    const strong = matches.find(match => match.reasons.includes('id_number') || match.reasons.includes('name_and_birth_date'));
    if (!strong) {
      if (matches[0]) planned.warnings.push(`Same cell number and date of birth as ${nameOfFile(matches[0].patient as ExistingFile)} in OneHealth: check it is not the same person`);
      return planned;
    }
    const file = strong.patient as ExistingFile;
    const earlier = usedFiles.get(file.id);
    if (earlier) return { ...planned, decision: 'skip', reason: `The same OneHealth file as ${earlier}` };
    usedFiles.set(file.id, planned.label);
    const why = strong.reasons.includes('id_number') ? 'same ID number' : 'same name and date of birth';
    return { ...planned, decision: 'existing', existing: file, reason: `Already in OneHealth (${why}): the existing file is used` };
  });
}

/** The OneHealth file for an account the patient list does not have: its only file with that Eminance number */
function standInFor(accountNumber: string, context: Context): PlannedPerson | null | 'several' {
  const files = context.byAccount.get(accountKey(accountNumber)) ?? [];
  if (files.length === 0) return null;
  if (files.length > 1) return 'several';
  const file = files[0];
  const key = `x:${file.id}`;
  const planned = context.standIns.get(key) ?? {
    key, person: null, existing: file, decision: 'existing' as const, reason: 'Already in OneHealth with this Eminance account number',
    warnings: [], accountNumber, label: nameOfFile(file), medicalAid: null
  };
  context.standIns.set(key, planned);
  return planned;
}

/** The fund a medical aid value means (provider id), null for none, undefined when staff must still choose */
function fundOf(raw: string | null, context: Context, count: boolean): string | null | undefined {
  if (!raw) return null;
  const key = valueKey(raw);
  const value = context.fundValues.get(key) ?? { key, raw, people: 0, suggested: suggestedFund(raw, context.input.funds), chosen: context.input.fundChoices[key] };
  if (count) value.people += 1;
  context.fundValues.set(key, value);
  return value.chosen !== undefined ? value.chosen : value.suggested;
}

function planMedicalAid(person: PersonRow, holder: PersonRow | null, context: Context): PlannedMedicalAid | null {
  const providerId = fundOf(person.medicalAidRaw ?? holder?.medicalAidRaw ?? null, context, true);
  const fund = providerId ? context.input.funds.find(item => item.id === providerId) : undefined;
  if (!fund) return null;
  const isHolder = holder?.key === person.key;
  return {
    providerId: fund.id,
    providerName: fund.name,
    option: person.option ?? holder?.option ?? null,
    membershipNumber: person.membershipNumber ?? holder?.membershipNumber ?? '',
    mainMemberName: holder ? composeMainMemberName({ surname: holder.surname, initials: holder.initials || initialsOf(holder.firstName) }) : '',
    mainMemberIdNumber: holder?.idNumber ?? '',
    relationship: isHolder ? 'self' : person.relationship === 'self' || person.relationship === null ? 'other' : person.relationship,
    dependantCode: person.dependantCode
  };
}

/** Whether an account's main member has a medical aid (their own value, else anyone's on the account) */
function accountHasMedicalAid(accountNumber: string, context: Context): boolean {
  const family = context.families.get(accountKey(accountNumber));
  const raw = family?.holder?.medicalAidRaw ?? family?.members.find(member => member.medicalAidRaw)?.medicalAidRaw ?? null;
  return fundOf(raw, context, false) !== null;
}

function planLinks(context: Context): PlannedLink[] {
  const links: PlannedLink[] = [];
  for (const family of context.families.values()) {
    for (const member of family.members) {
      const planned = context.byKey.get(member.key);
      if (planned?.decision === 'new') planned.medicalAid = planMedicalAid(member, family.holder, context);
    }
    const holder = family.holder ? context.byKey.get(family.holder.key) : undefined;
    if (!keepsPlace(holder)) continue;
    for (const member of family.members) {
      const planned = context.byKey.get(member.key);
      if (member.key === holder.key || !keepsPlace(planned)) continue;
      if (planned.decision === 'existing' && holder.decision === 'existing') continue;
      const relationship = member.relationship === 'spouse' ? 'spouse' : member.relationship === 'child' ? 'child' : 'dependant';
      links.push({
        key: `f:${member.key}`, patientKey: member.key, holderKey: holder.key, relationship,
        accountNumber: family.accountNumber, label: `${planned.label} (paid for by ${holder.label})`
      });
    }
  }
  return links;
}

function planBalances(context: Context): PlannedBalance[] {
  const { input } = context;
  const accounts = combineBalances(input.balances, accountNumber =>
    accountHasMedicalAid(accountNumber, context) ? input.ownerOfBoth ?? 'medical_aid' : 'patient'
  );
  return accounts.map(account => {
    const bands = AGE_BANDS.map(band => ({ band: band.key, patientCents: account.patient[band.key], medicalAidCents: account.medicalAid[band.key] }))
      .filter(band => band.patientCents + band.medicalAidCents > 0);
    const totalCents = bands.reduce((total, band) => total + band.patientCents + band.medicalAidCents, 0);
    const family = context.families.get(accountKey(account.accountNumber));
    let holder: PlannedPerson | null | 'several' = null;
    let skipReason: string | null = null;
    if (totalCents === 0) {
      skipReason = account.creditLeftCents > 0 ? 'The account is in credit in Eminance: nothing is owed' : 'Nothing owed on this account';
    } else if (!family) {
      holder = standInFor(account.accountNumber, context);
      if (holder === 'several') skipReason = 'Several OneHealth files have this Eminance account number: bring the balance over with the patient list';
      else if (!holder) skipReason = 'This account is not in the patient list';
    } else if (!family.holder) {
      skipReason = 'No main member on this account in the patient list';
    } else {
      holder = context.byKey.get(family.holder.key) ?? null;
      if (!keepsPlace(holder)) skipReason = 'The main member is not brought over';
    }
    const named = holder && holder !== 'several' ? holder.label : account.name;
    return {
      key: `b:${account.accountNumber}`,
      accountNumber: account.accountNumber,
      label: `Account ${account.accountNumber}${named ? ` (${named})` : ''}`,
      holderKey: !skipReason && holder && holder !== 'several' ? holder.key : null,
      bands,
      totalCents,
      creditLeftCents: account.creditLeftCents,
      skipReason,
      warnings: account.warnings
    };
  });
}

/** The person on the account a recall is for: by dependant number, card code, first name, or the only person */
function personForRecall(recall: RecallRow, family: Family): PersonRow | null {
  const { members } = family;
  if (recall.dependantNumber !== null) {
    const byNumber = members.find(member => member.dependantNumber !== null && Number(member.dependantNumber) === Number(recall.dependantNumber));
    if (byNumber) return byNumber;
  }
  if (recall.dependantCode !== null) {
    const byCode = members.find(member => member.dependantCode === recall.dependantCode);
    if (byCode) return byCode;
  }
  const first = firstWord(recall.firstName);
  const byName = first ? members.filter(member => firstWord(member.firstName) === first) : [];
  if (byName.length === 1) return byName[0];
  return members.length === 1 ? members[0] : null;
}

function planRecalls(context: Context): PlannedRecall[] {
  const { input } = context;
  const planned: PlannedRecall[] = [];
  const add = (key: string, line: number | null, accountNumber: string, target: PlannedPerson | null, dueDate: string, reason: string | null, missing: string | null) => {
    const skipReason = missing ?? (keepsPlace(target) ? null : 'The patient is not brought over');
    planned.push({
      key, line, patientKey: skipReason ? null : target?.key ?? null, accountNumber, label: target?.label ?? `Account ${accountNumber}`,
      dueDate, reason, listName: recallListName(dueDate, input.today), skipReason
    });
  };
  for (const person of input.people) {
    if (person.recallDate) add(`r:${person.key}`, person.line, person.accountNumber, context.byKey.get(person.key) ?? null, person.recallDate, person.recallReason, null);
  }
  for (const recall of input.recalls) {
    if (recall.problems.some(problem => problem.blocking) || !recall.dueDate) continue;
    const family = context.families.get(accountKey(recall.accountNumber));
    let target: PlannedPerson | null = null;
    let missing: string | null = null;
    if (family) {
      const person = personForRecall(recall, family);
      if (person) target = context.byKey.get(person.key) ?? null;
      else missing = `Could not tell which person on account ${recall.accountNumber} this recall is for`;
    } else {
      const file = standInFor(recall.accountNumber, context);
      if (file && file !== 'several') target = file;
      else missing = 'This account is not in the patient list';
    }
    add(recall.key, recall.line, recall.accountNumber, target, recall.dueDate, recall.reason, missing);
  }
  const seen = new Set<string>();
  return planned.filter(recall => {
    if (!recall.patientKey) return true;
    const key = `${recall.patientKey}|${recall.listName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Which person a claim line is for: the same ID number, else the account and date of birth (and first name for twins) */
function personForClaim(line: ClaimHistoryLine, context: Context, peopleById: Map<string, PersonRow>): PlannedPerson | null {
  const byId = line.idNumber ? peopleById.get(line.idNumber) : undefined;
  if (byId) return context.byKey.get(byId.key) ?? null;
  const family = context.families.get(accountKey(line.accountNumber));
  if (family) {
    const sameBirthDate = family.members.filter(member => member.dateOfBirth === line.dateOfBirth);
    const person = sameBirthDate.length === 1 ? sameBirthDate[0] : sameBirthDate.find(member => firstWord(member.firstName) === firstWord(line.firstName));
    return person ? context.byKey.get(person.key) ?? null : null;
  }
  const file = standInFor(line.accountNumber, context);
  return file && file !== 'several' && (file.existing?.date_of_birth ?? '').slice(0, 10) === line.dateOfBirth ? file : null;
}

function planClaims(context: Context): { claims: PlannedClaims[]; unmatched: Array<{ accountNumber: string; lines: number }> } {
  const byPatient = new Map<string, PlannedClaims>();
  const unmatched = new Map<string, number>();
  // The person brought over wins over a repeat of them that is skipped
  const peopleById = new Map<string, PersonRow>();
  for (const person of context.input.people) {
    if (!person.idNumber) continue;
    const current = peopleById.get(person.idNumber);
    if (!current || (!keepsPlace(context.byKey.get(current.key)) && keepsPlace(context.byKey.get(person.key)))) peopleById.set(person.idNumber, person);
  }
  for (const line of uniqueClaimLines(context.input.claims)) {
    const target = personForClaim(line, context, peopleById);
    if (!keepsPlace(target)) {
      unmatched.set(line.accountNumber, (unmatched.get(line.accountNumber) ?? 0) + 1);
      continue;
    }
    const entry = byPatient.get(target.key) ?? { key: `c:${target.key}`, patientKey: target.key, accountNumber: target.accountNumber, label: target.label, lines: [] };
    entry.lines.push(line);
    byPatient.set(target.key, entry);
  }
  for (const entry of byPatient.values()) entry.lines.sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
  return { claims: [...byPatient.values()], unmatched: [...unmatched.entries()].map(([accountNumber, lines]) => ({ accountNumber, lines })) };
}

function recallListsOf(recalls: readonly PlannedRecall[], today: string): ImportPlan['recallLists'] {
  const lists = new Map<string, { count: number; reasons: Map<string, number> }>();
  for (const recall of recalls) {
    if (recall.skipReason) continue;
    const list = lists.get(recall.listName) ?? { count: 0, reasons: new Map<string, number>() };
    list.count += 1;
    if (recall.reason) list.reasons.set(recall.reason, (list.reasons.get(recall.reason) ?? 0) + 1);
    lists.set(recall.listName, list);
  }
  return [...lists.entries()]
    .map(([name, list]) => ({ name, description: recallListDescription(name, list.reasons, today), count: list.count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildImportPlan(input: PlanInput): ImportPlan {
  const familyList = groupFamilies(input.people);
  const base = {
    byId: indexFiles(input.existing, file => (file.id_number ?? '').replace(/[\s\-/.]/g, '').toUpperCase() || null),
    byBirthDate: indexFiles(input.existing, file => (file.date_of_birth ?? '').slice(0, 10) || null),
    byAccount: indexFiles(input.existing, file => (file.legacy_account_number ? accountKey(file.legacy_account_number) : null))
  };
  const people = decidePeople(input.people, base);
  const context: Context = {
    ...base,
    input,
    byKey: new Map(people.map(planned => [planned.key, planned])),
    families: new Map(familyList.map(family => [accountKey(family.accountNumber), family])),
    standIns: new Map(),
    fundValues: new Map()
  };
  const links = planLinks(context);
  const balances = planBalances(context);
  const recalls = planRecalls(context);
  const { claims, unmatched } = planClaims(context);
  const allPeople = [...people, ...context.standIns.values()];

  const fundValues = [...context.fundValues.values()].filter(value => value.people > 0).sort((a, b) => b.people - a.people || a.raw.localeCompare(b.raw));
  const needsOwnerChoice = input.balances.some(file =>
    file.portion === 'both' && file.rows.some(row => sumBands(row.bands) > row.creditCents && accountHasMedicalAid(row.accountNumber, context))
  );
  const unreadSex = [...new Set(input.people.filter(person => person.needsSexChoice).map(person => person.sexRaw))];
  const openQuestions = [
    ...fundValues.filter(value => (value.chosen !== undefined ? value.chosen : value.suggested) === undefined)
      .map(value => `Which fund is "${value.raw}"? (${value.people} ${value.people === 1 ? 'person' : 'people'})`),
    ...unreadSex.map(raw => `What does sex "${raw}" mean?`),
    ...(needsOwnerChoice && input.ownerOfBoth === null ? ['Who owes the balances of members with a medical aid: the medical aid or the patient?'] : [])
  ];

  return {
    people: allPeople,
    families: familyList,
    links,
    balances,
    recalls,
    recallLists: recallListsOf(recalls, input.today),
    claims,
    unmatchedClaims: unmatched,
    fundValues,
    needsOwnerChoice,
    openQuestions,
    counts: countPlan(allPeople, familyList, links, balances, recalls, claims, unmatched, input)
  };
}

function countPlan(
  people: readonly PlannedPerson[],
  families: readonly Family[],
  links: readonly PlannedLink[],
  balances: readonly PlannedBalance[],
  recalls: readonly PlannedRecall[],
  claims: readonly PlannedClaims[],
  unmatched: ReadonlyArray<{ lines: number }>,
  input: PlanInput
): PlanCounts {
  const kept = balances.filter(balance => !balance.skipReason);
  const byBand = zeroBands();
  for (const balance of kept) for (const band of balance.bands) byBand[band.band] += band.patientCents + band.medicalAidCents;
  const creditInFiles = input.balances.reduce((total, file) => total + file.rows.reduce((sum, row) => sum + row.creditCents, 0), 0);
  const creditLeftCents = balances.reduce((total, balance) => total + balance.creditLeftCents, 0);
  const sumPortion = (portion: 'patientCents' | 'medicalAidCents') =>
    kept.reduce((total, balance) => total + balance.bands.reduce((sum, band) => sum + band[portion], 0), 0);
  return {
    newPatients: people.filter(person => person.decision === 'new').length,
    existingPatients: people.filter(person => person.decision === 'existing').length,
    skippedPatients: people.filter(person => person.decision === 'skip').length,
    noIdNumber: people.filter(person => person.decision === 'new' && !person.person?.idNumber).length,
    withMedicalAid: people.filter(person => person.decision === 'new' && person.medicalAid).length,
    familyLinks: links.length,
    accountsWithoutMainMember: families.filter(family => !family.holder).length,
    balanceAccounts: kept.length,
    balanceCents: sumBands(byBand),
    medicalAidCents: sumPortion('medicalAidCents'),
    patientCents: sumPortion('patientCents'),
    byBand,
    creditSetOffCents: Math.max(creditInFiles - creditLeftCents, 0),
    creditAccounts: balances.filter(balance => balance.creditLeftCents > 0).length,
    creditLeftCents,
    balancesSkipped: balances.filter(balance => balance.skipReason && balance.totalCents > 0).length,
    recalls: recalls.filter(recall => !recall.skipReason).length,
    recallsSkipped: recalls.filter(recall => recall.skipReason).length,
    claimLines: claims.reduce((total, claim) => total + claim.lines.length, 0),
    claimPatients: claims.length,
    unmatchedClaimLines: unmatched.reduce((total, item) => total + item.lines, 0)
  };
}

// ---------------------------------------------------------------------------------------------
// The rows sent to legacy_import_stage (payload names as in the proposal's section 6)
// ---------------------------------------------------------------------------------------------

export type StagedKind = 'patient' | 'family' | 'balance' | 'recall' | 'claim_line';

export interface StagedRow {
  kind: StagedKind;
  key: string;
  line: number | null;
  account_number: string | null;
  label: string;
  payload: Record<string, unknown>;
}

/** Claim lines per staged row: a long history is sent in parts so no request gets too large */
export const CLAIM_LINES_PER_ROW = 300;

const row = (kind: StagedKind, key: string, line: number | null, accountNumber: string | null, label: string, payload: Record<string, unknown>): StagedRow => ({
  kind, key, line, account_number: accountNumber || null, label: label.slice(0, 200), payload
});

function patientPayload(planned: PlannedPerson): Record<string, unknown> {
  if (planned.decision === 'skip') return { decision: 'skip', reason: planned.reason };
  if (planned.decision === 'existing') return { decision: 'existing', existing_patient_id: planned.existing?.id };
  const person = planned.person as PersonRow;
  const aid = planned.medicalAid;
  return {
    decision: 'new',
    first_name: person.firstName,
    last_name: person.surname,
    id_number: person.idNumber,
    date_of_birth: person.dateOfBirth,
    gender: person.sex,
    cell_number: person.cellNumber,
    email: person.email,
    home_language: person.homeLanguage,
    occupation: person.occupation,
    employer: person.employer,
    home_address: person.homeAddress,
    postal_address: person.postalAddress,
    postal_code: person.postalCode,
    alert: person.alert,
    medical_aid: aid && {
      provider_id: aid.providerId,
      option: aid.option,
      membership_number: aid.membershipNumber,
      main_member_name: aid.mainMemberName,
      main_member_id_number: aid.mainMemberIdNumber,
      relationship: aid.relationship,
      dependant_code: aid.dependantCode
    }
  };
}

/** Everything the import sends, people first (the other rows name them by key) */
export function stagedRows(plan: ImportPlan): StagedRow[] {
  const rows: StagedRow[] = plan.people.map(planned => row('patient', planned.key, planned.person?.line ?? null, planned.accountNumber, planned.label, patientPayload(planned)));
  for (const link of plan.links) {
    rows.push(row('family', link.key, null, link.accountNumber, link.label, { patient_key: link.patientKey, holder_key: link.holderKey, relationship: link.relationship }));
  }
  for (const balance of plan.balances) {
    if (balance.totalCents === 0) continue;
    const payload = balance.skipReason
      ? { skip_reason: balance.skipReason }
      : { holder_key: balance.holderKey, bands: balance.bands.map(band => ({ band: band.band, patient_cents: band.patientCents, medical_aid_cents: band.medicalAidCents })) };
    rows.push(row('balance', balance.key, null, balance.accountNumber, balance.label, payload));
  }
  const descriptions = new Map(plan.recallLists.map(list => [list.name, list.description]));
  for (const recall of plan.recalls) {
    const payload = recall.skipReason
      ? { skip_reason: recall.skipReason }
      : { patient_key: recall.patientKey, due_date: recall.dueDate, reason: recall.reason, list_name: recall.listName, list_description: descriptions.get(recall.listName) ?? null };
    rows.push(row('recall', recall.key, recall.line, recall.accountNumber, recall.label, payload));
  }
  for (const claim of plan.claims) {
    for (let start = 0; start < claim.lines.length; start += CLAIM_LINES_PER_ROW) {
      const part = start / CLAIM_LINES_PER_ROW;
      const lines = claim.lines.slice(start, start + CLAIM_LINES_PER_ROW).map(line => ({
        service_date: line.serviceDate, tariff_code: line.tariffCode, description: line.description, tooth: line.tooth || null,
        diagnosis: line.diagnosis || null, quantity: line.quantity, amount_cents: line.amountCents, fund_code: line.fundCode || null,
        invoice_number: line.invoiceNumber || null
      }));
      rows.push(row('claim_line', part === 0 ? claim.key : `${claim.key}:${part}`, null, claim.accountNumber, claim.label, { patient_key: claim.patientKey, lines }));
    }
  }
  for (const item of plan.unmatchedClaims) {
    rows.push(row('claim_line', `u:${item.accountNumber}`, null, item.accountNumber, `Account ${item.accountNumber}: ${item.lines} claim lines`, {
      skip_reason: 'No patient in the patient list with this account number and date of birth'
    }));
  }
  return rows;
}
