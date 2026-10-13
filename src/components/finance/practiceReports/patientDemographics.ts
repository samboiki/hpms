/**
 * Demographics and new patients (parity R26; Eminance's demographics, marketing and new-accounts reports): the patients
 * on file, or the files opened in a period, by home language, town and where they came from, with new files per month
 * and a list to export (a mailing or marketing list). Files merged into another file are left out (they are the same
 * person). Where a patient came from is worked out from what the file already holds, in this order: a referral letter on
 * the file, a booking made on the practice's website, an old file number (paper or the previous system). What the
 * patient answered to "How did you hear about us?" (registration and the patient form, owner's decision 13 Oct 2026)
 * is reported on its own, per month: it is what the patient said, not what the file shows, so the two are not mixed.
 */
import {
  dateKeyFrom,
  isInRange,
  monthKeyOf,
  monthKeysInRange,
  type DateRange
} from '../../../services/ledgerService';
import type { CsvCell } from '../financeExport';
import { formatMonthKey } from '../financeFormat';
import { REGION_NOT_RECORDED, TOWN_NOT_RECORDED, tidyWords, townReader } from './patientTowns';
import type { LinkedReport } from './reportTargets';
import {
  REFERRAL_SOURCES,
  REFERRAL_SOURCE_LABELS,
  describeReferralAnswer,
  referralAnswerFrom,
  type ReferralSource
} from '../../../utils/patients/referralSource';

export type PatientSource = 'referred' | 'online' | 'previous_file' | 'not_recorded';

export const PATIENT_SOURCES: readonly PatientSource[] = ['referred', 'online', 'previous_file', 'not_recorded'];

export const SOURCE_LABELS: Readonly<Record<PatientSource, string>> = {
  referred: 'Referred by a practitioner',
  online: 'Booked online',
  previous_file: 'Had a file before (paper or previous system)',
  not_recorded: 'Not recorded'
};

export const LANGUAGE_NOT_RECORDED = 'Not recorded';

/** A patient file as the reports read it (patients, with the town and region columns once the database has them) */
export interface PatientRecord {
  id: string;
  firstName: string | null;
  lastName: string | null;
  homeLanguage: string | null;
  homeAddress: string | null;
  postalAddress: string | null;
  town?: string | null;
  /** One of the 14 regions (patients.region, proposals/2026-10-13-patient-town.sql) */
  region?: string | null;
  createdAt: string | null;
  legacyAccountNumber: string | null;
  /** "How did you hear about us?" (patients.referral_source, proposals/2026-10-13-patient-photo-and-referral-source.sql) */
  referralSource?: string | null;
  referralSourceOther?: string | null;
}

/** An answer to "How did you hear about us?", or none */
export type HeardKey = ReferralSource | 'not_answered';
export const HEARD_KEYS: readonly HeardKey[] = [...REFERRAL_SOURCES, 'not_answered'];
export const HEARD_NOT_ANSWERED = 'Not answered';
export const heardLabel = (key: string): string =>
  key === 'not_answered' ? HEARD_NOT_ANSWERED : REFERRAL_SOURCE_LABELS[key as ReferralSource] ?? key;

export interface PatientFacts {
  id: string;
  name: string;
  /** The day the file was opened (local day of created_at); null when unknown */
  openedOn: string | null;
  language: string;
  town: string;
  region: string;
  source: PatientSource;
  heard: HeardKey;
  /** The answer in words, with what was typed for "Other" */
  heardText: string;
}

export const patientName = (record: Pick<PatientRecord, 'firstName' | 'lastName'>): string =>
  [record.firstName, record.lastName].map(part => part?.trim()).filter(Boolean).join(' ') || 'Unnamed patient';

/** Where a patient came from, the strongest sign first */
export function patientSource(signs: { referred: boolean; bookedOnline: boolean; hadFileBefore: boolean }): PatientSource {
  if (signs.referred) return 'referred';
  if (signs.bookedOnline) return 'online';
  if (signs.hadFileBefore) return 'previous_file';
  return 'not_recorded';
}

export function patientFacts(
  records: readonly PatientRecord[],
  signs: { referred: ReadonlySet<string>; bookedOnline: ReadonlySet<string> }
): PatientFacts[] {
  const reader = townReader();
  return records.map(record => {
    const town = reader.town(record);
    const answer = referralAnswerFrom({ referral_source: record.referralSource, referral_source_other: record.referralSourceOther });
    return {
      id: record.id,
      name: patientName(record),
      openedOn: dateKeyFrom(record.createdAt),
      language: record.homeLanguage?.trim() ? tidyWords(record.homeLanguage) : LANGUAGE_NOT_RECORDED,
      town,
      region: reader.region(record, town),
      source: patientSource({
        referred: signs.referred.has(record.id),
        bookedOnline: signs.bookedOnline.has(record.id),
        hadFileBefore: !!record.legacyAccountNumber?.trim()
      }),
      heard: answer.source || 'not_answered',
      heardText: describeReferralAnswer(answer) ?? HEARD_NOT_ANSWERED
    };
  });
}

/** Files opened in the range */
export const openedIn = (facts: readonly PatientFacts[], range: DateRange): PatientFacts[] =>
  facts.filter(fact => isInRange(fact.openedOn, range));

export type Dimension = 'language' | 'town' | 'region' | 'source' | 'heard';

export const dimensionKey = (fact: PatientFacts, dimension: Dimension): string =>
  dimension === 'language' ? fact.language : dimension === 'town' ? fact.town : dimension === 'region' ? fact.region : dimension === 'heard' ? fact.heard : fact.source;

export const dimensionLabel = (key: string, dimension: Dimension): string =>
  dimension === 'source' ? SOURCE_LABELS[key as PatientSource] ?? key : dimension === 'heard' ? heardLabel(key) : key;

export interface DimensionGroup {
  key: string;
  count: number;
}

/** Patients per language, town, region or source, the most first ("not recorded" last) */
export function countBy(facts: readonly PatientFacts[], dimension: Dimension): DimensionGroup[] {
  const counts = new Map<string, number>();
  for (const fact of facts) {
    const key = dimensionKey(fact, dimension);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const last = (key: string) => Number([LANGUAGE_NOT_RECORDED, 'not_recorded', 'not_answered', TOWN_NOT_RECORDED, REGION_NOT_RECORDED].includes(key));
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => last(a.key) - last(b.key) || b.count - a.count || a.key.localeCompare(b.key));
}

export interface MonthOpened {
  monthKey: string;
  count: number;
  bySource: Record<PatientSource, number>;
}

/** Files opened per month of the range (months with none included), by where the patients came from */
export function openedPerMonth(facts: readonly PatientFacts[], range: DateRange): MonthOpened[] {
  const months = new Map<string, MonthOpened>(monthKeysInRange(range).map(monthKey => [
    monthKey, { monthKey, count: 0, bySource: { referred: 0, online: 0, previous_file: 0, not_recorded: 0 } }
  ]));
  for (const fact of openedIn(facts, range)) {
    const month = months.get(monthKeyOf(fact.openedOn as string));
    if (!month) continue;
    month.count += 1;
    month.bySource[fact.source] += 1;
  }
  return [...months.values()];
}

export interface MonthHeard {
  monthKey: string;
  count: number;
  byHeard: Record<HeardKey, number>;
}

const noAnswers = (): Record<HeardKey, number> =>
  Object.fromEntries(HEARD_KEYS.map(key => [key, 0])) as Record<HeardKey, number>;

/** Files opened per month of the range (months with none included), by the answer to "How did you hear about us?" */
export function heardPerMonth(facts: readonly PatientFacts[], range: DateRange): MonthHeard[] {
  const months = new Map<string, MonthHeard>(monthKeysInRange(range).map(monthKey => [monthKey, { monthKey, count: 0, byHeard: noAnswers() }]));
  for (const fact of openedIn(facts, range)) {
    const month = months.get(monthKeyOf(fact.openedOn as string));
    if (!month) continue;
    month.count += 1;
    month.byHeard[fact.heard] += 1;
  }
  return [...months.values()];
}

export const DEMOGRAPHIC_NOTES = {
  opened: 'New patients are the patient files opened in the period: each member of a family has a file of their own. Files merged into another file are left out.',
  source: 'Where a patient came from is read from the file: a referral letter on it (Referred by a practitioner), a booking on the practice\'s website (Booked online), an old file number typed at registration (Had a file before). What the patient answered to "How did you hear about us?" is in its own view.',
  language: 'The home language as recorded on the file; registration records English when none is chosen.',
  heard: 'How they heard about us is what the patient answered at registration or on the patient form (optional). Files opened before the question was asked show as Not answered.'
} as const;

/** One row per language, town, region or source with its share; a row lists those patients */
export function dimensionTable(groups: readonly DimensionGroup[], input: { dimension: Dimension; title: string; basis: string; notes: string[] }): LinkedReport & { keys: string[] } {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const header = input.dimension === 'language' ? 'Home language' : input.dimension === 'town' ? 'Town' : input.dimension === 'region' ? 'Region' : input.dimension === 'heard' ? 'Heard about us through' : 'Came to us through';
  return {
    table: {
      title: input.title,
      basis: input.basis,
      columns: [{ header, type: 'text' }, { header: 'Patients', type: 'count' }, { header: 'Share', type: 'percent' }],
      rows: groups.map(group => [dimensionLabel(group.key, input.dimension), group.count, total > 0 ? group.count / total : null] as CsvCell[]),
      totals: ['Total', total, total > 0 ? 1 : null],
      notes: input.notes
    },
    targets: groups.map(() => null),
    keys: groups.map(group => group.key)
  };
}

/** New files per month, split by where the patients came from; a row lists that month's new patients */
export function monthTable(months: readonly MonthOpened[], basis: string, notes: string[]): LinkedReport & { keys: string[] } {
  const sum = (pick: (month: MonthOpened) => number) => months.reduce((total, month) => total + pick(month), 0);
  return {
    table: {
      title: 'New patients per month',
      basis,
      columns: [
        { header: 'Month', type: 'text' },
        { header: 'New patients', type: 'count' },
        ...PATIENT_SOURCES.map(source => ({ header: SOURCE_LABELS[source], type: 'count' as const }))
      ],
      rows: months.map(month => [formatMonthKey(month.monthKey, 'MMMM yyyy'), month.count, ...PATIENT_SOURCES.map(source => month.bySource[source])] as CsvCell[]),
      totals: ['Total', sum(month => month.count), ...PATIENT_SOURCES.map(source => sum(month => month.bySource[source]))],
      notes
    },
    targets: months.map(() => null),
    keys: months.map(month => month.monthKey)
  };
}

/** New files per month by how the patients heard about the practice; a row lists that month's new patients */
export function heardMonthTable(months: readonly MonthHeard[], basis: string, notes: string[]): LinkedReport & { keys: string[] } {
  const sum = (pick: (month: MonthHeard) => number) => months.reduce((total, month) => total + pick(month), 0);
  return {
    table: {
      title: 'How new patients heard about us, per month',
      basis,
      columns: [
        { header: 'Month', type: 'text' },
        { header: 'New patients', type: 'count' },
        ...HEARD_KEYS.map(key => ({ header: heardLabel(key), type: 'count' as const }))
      ],
      rows: months.map(month => [formatMonthKey(month.monthKey, 'MMMM yyyy'), month.count, ...HEARD_KEYS.map(key => month.byHeard[key])] as CsvCell[]),
      totals: ['Total', sum(month => month.count), ...HEARD_KEYS.map(key => sum(month => month.byHeard[key]))],
      notes
    },
    targets: months.map(() => null),
    keys: months.map(month => month.monthKey)
  };
}

/** The patients themselves (a mailing or marketing list): opened, name, language, town, region, source and how they heard about us; each opens the file */
export function patientListTable(facts: readonly PatientFacts[], input: { title: string; basis: string; notes: string[] }): LinkedReport {
  const sorted = [...facts].sort((a, b) => (a.openedOn ?? '').localeCompare(b.openedOn ?? '') || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return {
    table: {
      title: input.title,
      basis: input.basis,
      columns: [
        { header: 'File opened', type: 'date' },
        { header: 'Patient', type: 'text' },
        { header: 'Home language', type: 'text' },
        { header: 'Town', type: 'text' },
        { header: 'Region', type: 'text' },
        { header: 'Came to us through', type: 'text' },
        { header: 'Heard about us through', type: 'text' }
      ],
      rows: sorted.map(fact => [fact.openedOn, fact.name, fact.language, fact.town, fact.region, SOURCE_LABELS[fact.source], fact.heardText] as CsvCell[]),
      totals: ['Total', `${sorted.length}`, '', '', '', '', ''],
      notes: input.notes
    },
    targets: sorted.map(fact => ({ kind: 'patient' as const, id: fact.id })),
    names: sorted.map(fact => fact.name)
  };
}
