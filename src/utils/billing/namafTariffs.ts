/**
 * The NAMAF benchmark tariff list (namaf_tariffs, proposals/2026-10-13-namaf-tariffs.sql): NAMAF's codes and amounts
 * for 144 disciplines, the default price list of every practice of a discipline whatever the patient's fund.
 *
 * Business rules (owner, 13 Oct 2026: "NAMAF sets all rates"; the list is for all medical aids):
 * - A practice bills from one discipline's list: the one its administrator chose on the Tariffs page, else the one of
 *   its practice type (medical -> 014 general practitioner, dental -> 054 dentist, orthodontist -> 064, optometry -> 070
 *   ...). The link of a type is practice_types.namaf_discipline_code (proposals/2026-10-14-practice-type-disciplines.sql
 *   and more-practice-types.sql); the built-in map below is a copy used only while that column is not in the database.
 *   A practice of type 'general' (or none) has no list until its type is chosen (practiceType.ts
 *   needsPracticeTypeChoice).
 *   Sub-types (014003, 018001, ...) are offered only when chosen: most repeat their parent's codes and prices.
 * - The list is the bottom of the price order: a fund's own price (fund_tariffs, e.g. PSEMAS dental), then the
 *   practice's own price (practice_own_tariffs), then the shared list of the practice type (practice_tariffs), then
 *   NAMAF. A code the shared list already has gets NAMAF's amount as its newer version from NAMAF's start date (so a
 *   2026 visit is billed the 2026 benchmark), keeping the shared list's rules (tooth, quantity); when NAMAF has no
 *   amount for it the shared price stays.
 * - NAMAF's file does not say which codes need a tooth number, so every NAMAF row reads 'NO'. A dental specialist
 *   (orthodontist, maxillo-facial and oral surgeon, periodontist, prosthodontist, dental therapist) has no shared list of its
 *   own, so its codes take the dentist's rule (owner, 14 Oct 2026: "copy the dentist flags"): a code with the same number as
 *   a dentist code that needs a tooth number asks for one too (withDentistToothFlags). The practice's own version of a code
 *   (Admin > Tariffs) and a shared row of the specialist's own type still win over the copy.
 * - Amount 0 or empty means "no fixed amount" (priced by rule, at cost or by arrangement): the code is still offered,
 *   and staff type the amount when they bill it (noFixedAmount).
 * - Codes are billed as NAMAF numbers them (8101, 0190, 001); the five-digit form funds print on statements (08101,
 *   72001) is kept with the row. When one discipline lists a code twice, the row whose five-digit form is the code
 *   itself is offered (09815, not 98810).
 * - The list stays in force after its end date until the next year's list is loaded (its later start date takes
 *   over), so billing never stops on 1 January because NAMAF published late.
 *
 * No imports outside src/utils/billing, so the module stays pure and testable.
 */
import type { PracticeTariffLike } from './practiceTariffs.ts';
import { parseTariffPrice, parseYesNo } from './pricing.ts';
import { DENTAL_PRACTICE_TYPES, normalisePracticeType } from './practiceTypeNames.ts';

/** practice_settings key: the discipline an administrator chose for the practice's list ("010") */
export const NAMAF_DISCIPLINE_SETTING_KEY = 'namaf_discipline';

/**
 * The NAMAF discipline of each practice type (practice_types.name): a built-in copy of practice_types.namaf_discipline_code,
 * used only while the database has no such column. A test keeps it the same as the proposal's list. 'aesthetic' has none
 * in NAMAF's list. speech_therapy is 082000: 082 itself holds one line (a member refund), 082000 is the speech
 * therapist and audiologist list. The types after day_clinic come from proposals/2026-10-14-more-practice-types.sql: the
 * dental specialists first (orthodontist 064 ...), then every other discipline with a code list of its own.
 */
export const NAMAF_DISCIPLINE_BY_PRACTICE_TYPE: Readonly<Record<string, string>> = {
  medical: '014',
  dental: '054',
  optometry: '070',
  physiotherapy: '072',
  psychology: '086',
  nursing: '088',
  dermatology: '012',
  ent: '030',
  gynecology: '016',
  pediatrics: '032',
  cardiology: '021',
  orthopedics: '028',
  ophthalmology: '026',
  neurology: '020',
  radiology: '038',
  pathology: '052',
  pharmacy: '060',
  anesthesiology: '010',
  internal_medicine: '018',
  psychiatry: '022',
  general_surgery: '042',
  urology: '046',
  occupational_therapy: '066',
  speech_therapy: '082000',
  dietetics: '084',
  biokinetics: '091',
  private_hospital: '057',
  day_clinic: '076',
  // Dental specialists (they work like a dental practice: isDentalPractice) and the dental laboratory
  orthodontist: '064',
  maxillofacial_oral_surgeon: '062',
  periodontist: '092',
  prosthodontist: '094',
  dental_therapist: '095',
  dental_technician: '093',
  // Doctors
  family_medicine: '015',
  pulmonologist: '017',
  gastroenterologist: '019',
  medical_oncologist: '023',
  neurosurgeon: '024',
  nuclear_physician: '025',
  clinical_hematologist: '027',
  rheumatology: '031',
  pediatric_cardiologist: '033',
  physical_medicine: '034',
  emergency_medicine: '035',
  plastic_surgeon: '036',
  radiation_oncologist: '040',
  thoracic_surgeon: '044',
  pediatric_surgeon: '114',
  // Allied health
  medical_technology_lab: '037',
  radiographer: '039',
  sonographer: '039004',
  art_therapist: '067',
  podiatrist: '068',
  medical_scientist: '069',
  orthoptist: '074',
  clinical_technologist: '075',
  hearing_aid_acoustician: '083',
  orthotist_prosthetist: '087',
  social_worker: '089',
  psychological_counsellor: '099',
  // Complementary medicine
  chiropractor: '004',
  chinese_medicine_practitioner: '007',
  homeopath: '008',
  naturopath: '101',
  phytotherapist: '103',
  acupuncturist: '105',
  // Hospitals, clinics and services
  ambulance_service: '009',
  ambulance_intermediate: '011',
  ambulance_basic: '013',
  drug_and_alcohol: '047',
  sub_acute_facility: '049',
  mental_health_institute: '055',
  provincial_hospital: '056',
  private_hospital_b: '058',
  rehabilitation_hospital: '059',
  day_clinic_077: '077',
  blood_transfusion_service: '078',
  hospice: '079',
  nursing_agency: '080',
  clinical_support_services: '090',
  oncology_unit: '120000'
};

/** Practice type name -> discipline as the database holds it; null: the type has no list of its own. */
export type PracticeTypeDisciplines = Readonly<Record<string, string | null>>;

/** Private hospital (A tariff): the ward fees per day a ward's bed-day code is chosen from */
export const HOSPITAL_DISCIPLINE = '057';
/** The per-day ward codes of the private hospital list, in the order the ward setup offers them (five-digit form) */
export const WARD_DAY_TARIFF_CODES: readonly string[] = ['57001', '57002', '57003', '57004', '57201', '57215', '57202', '57007'];

export const isNamafDisciplineCode = (value: unknown): value is string => typeof value === 'string' && /^[0-9]{3}([0-9]{3})?$/.test(value);

/** The links in practice_types rows (name, namaf_discipline_code); a malformed code reads as none. */
export function typeDisciplinesFromRows(rows: ReadonlyArray<{ name?: unknown; namaf_discipline_code?: unknown }>): PracticeTypeDisciplines {
  const links: Record<string, string | null> = {};
  rows.forEach(row => {
    const name = typeof row.name === 'string' ? row.name.trim().toLowerCase() : '';
    if (name) links[name] = isNamafDisciplineCode(row.namaf_discipline_code) ? row.namaf_discipline_code : null;
  });
  return links;
}

/**
 * The discipline of a practice type in `byType` (the database's links, else the built-in copy); null: none. The type text
 * is read as the app reads it everywhere (normalisePracticeType): 'dental_practice' is 'dental', so it bills from 054.
 */
export function typeDiscipline(practiceType: string | null | undefined, byType: PracticeTypeDisciplines = NAMAF_DISCIPLINE_BY_PRACTICE_TYPE): string | null {
  const key = normalisePracticeType(practiceType);
  return Object.prototype.hasOwnProperty.call(byType, key) ? byType[key] : null;
}

/** The discipline whose list the practice bills from: the administrator's choice, else its practice type's; null: none. */
export function practiceDiscipline(
  practiceType: string | null | undefined,
  chosen: unknown,
  byType: PracticeTypeDisciplines = NAMAF_DISCIPLINE_BY_PRACTICE_TYPE
): string | null {
  if (isNamafDisciplineCode(chosen)) return chosen;
  return typeDiscipline(practiceType, byType);
}

/** A namaf_tariffs row as it is read. */
export interface NamafTariffRow {
  id: string;
  discipline_code: string;
  tariff_code: string;
  code: string;
  description: string | null;
  amount: number | string | null;
  units: number | string | null;
  valid_from: string;
  valid_to: string | null;
}

/** A NAMAF row in the shape billing reads (PracticeTariffLike), with where it came from. */
export interface NamafTariff extends PracticeTariffLike {
  namaf: { discipline: string; tariffCode: string; validFrom: string; validTo: string | null };
  /** No fixed amount in the list: staff type the amount when billing */
  no_fixed_amount: boolean;
}

const codeKey = (code: string | null | undefined): string => (code ?? '').trim().toUpperCase();
const withoutLeadingZeros = (code: string): string => code.replace(/^0+/, '');

/**
 * True for a code that is in the practice's price list because the NAMAF list of its discipline is (not the practice's
 * own code). A menu that shows every code of the practice leaves these out, or shows only those that fit: the list holds
 * up to 7,000 codes (optometry), which is a search, not a menu.
 */
export const isNamafListCode = (tariff: { namaf?: unknown; is_own?: boolean }): boolean => 'namaf' in tariff && tariff.is_own !== true;

/** True for a NAMAF tariff whose amount is to be typed in (no fixed amount and no fund or practice price on it). */
export const noFixedAmount = (tariff: { no_fixed_amount?: boolean; price?: unknown; price_problem?: string | null }): boolean =>
  tariff.no_fixed_amount === true && !tariff.price_problem && parseTariffPrice(tariff.price) === 0;

/**
 * The rows of one discipline as billing tariffs: one per code and start date (a code listed twice keeps the row whose
 * five-digit form is the code itself, else the lowest five-digit form), amount empty -> 0 with no_fixed_amount set.
 */
export function namafRowsAsTariffs(rows: readonly NamafTariffRow[]): NamafTariff[] {
  const chosen = new Map<string, NamafTariffRow>();
  const rank = (row: NamafTariffRow): number => (withoutLeadingZeros(row.tariff_code) === withoutLeadingZeros(codeKey(row.code)) ? 0 : 1);
  rows.forEach(row => {
    const code = codeKey(row.code);
    if (!code || !row.valid_from) return;
    const key = `${code}|${row.valid_from}`;
    const known = chosen.get(key);
    if (!known || rank(row) < rank(known) || (rank(row) === rank(known) && row.tariff_code < known.tariff_code)) chosen.set(key, row);
  });
  return [...chosen.values()].map(row => {
    const amount = parseTariffPrice(row.amount);
    return {
      id: row.id,
      code: codeKey(row.code),
      description: row.description?.trim() || null,
      price: amount ?? 0,
      unit: null,
      is_active: true,
      effective_from: row.valid_from,
      // In force until the next list starts (see the file comment); the list's own end date is kept in `namaf`
      effective_to: null,
      can_be_multiplied: 'NO',
      requires_tooth_number: 'NO',
      business_rule_formula: null,
      example_calculation: null,
      notes: null,
      namaf: { discipline: row.discipline_code, tariffCode: row.tariff_code, validFrom: row.valid_from, validTo: row.valid_to },
      no_fixed_amount: !amount
    };
  });
}

/** The fields of a shared (practice_tariffs) row the merge reads */
interface SharedRow {
  code: string | null;
  description?: string | null;
  effective_from?: string | null;
  can_be_multiplied?: string | null;
  requires_tooth_number?: string | null;
  business_rule_formula?: string | null;
  example_calculation?: string | null;
  notes?: string | null;
}

/**
 * The practice type's shared rows with the NAMAF list added beneath them (see the file comment): codes the shared list
 * lacks come from NAMAF; a shared code gets NAMAF's amount as a newer version from NAMAF's start date, with the shared
 * code's description and rules, unless NAMAF has no amount for it or the shared list already starts a version on or
 * after that date.
 */
export function withNamafTariffs<T extends SharedRow>(shared: readonly T[], namaf: readonly NamafTariff[]): Array<T | NamafTariff> {
  const sharedByCode = new Map<string, T[]>();
  shared.forEach(row => {
    const code = codeKey(row.code);
    if (code) sharedByCode.set(code, [...(sharedByCode.get(code) ?? []), row]);
  });
  const added = namaf.flatMap(tariff => {
    const versions = sharedByCode.get(tariff.code);
    if (!versions) return [tariff];
    if (tariff.no_fixed_amount) return [];
    const from = tariff.effective_from ?? '';
    if (versions.some(row => (row.effective_from ?? '') >= from)) return [];
    const latest = [...versions].sort((a, b) => (b.effective_from ?? '').localeCompare(a.effective_from ?? ''))[0];
    return [{
      ...tariff,
      description: latest.description?.trim() || tariff.description,
      // The shared list's rules for the code (tooth, quantity) stay with it
      can_be_multiplied: latest.can_be_multiplied ?? tariff.can_be_multiplied,
      requires_tooth_number: latest.requires_tooth_number ?? tariff.requires_tooth_number,
      business_rule_formula: latest.business_rule_formula ?? null,
      example_calculation: latest.example_calculation ?? null,
      notes: latest.notes ?? null
    }];
  });
  return [...shared, ...added];
}

/** The practice type whose shared list (practice_tariffs) holds the dentist's tooth rules */
export const DENTIST_PRACTICE_TYPE = 'dental';

/**
 * A dental specialist's practice type: a dental practice type that is not the dentist's own. Their lists come from NAMAF
 * alone (practice_tariffs holds rows for the dentist only), so they ask for no tooth until the dentist's rules are copied.
 */
export const isDentalSpecialist = (practiceType: string | null | undefined): boolean => {
  const type = normalisePracticeType(practiceType);
  return type !== DENTIST_PRACTICE_TYPE && DENTAL_PRACTICE_TYPES.includes(type);
};

/** The fields of a dentist's shared row that say whether its code needs a tooth number */
export interface DentistToothRow {
  code: string | null;
  requires_tooth_number?: string | boolean | null;
  effective_from?: string | null;
}

/**
 * The codes (upper case) of the dentist's shared list that need a tooth number. The newest version of a code decides, as
 * withNamafTariffs takes the newest shared version's rules, so a flag the dentist's list has since switched off is not
 * copied; versions that start on the same day count as needing one when any of them does.
 */
export function dentistToothCodes(rows: readonly DentistToothRow[]): Set<string> {
  const newest = new Map<string, { from: string; needs: boolean }>();
  rows.forEach(row => {
    const code = codeKey(row.code);
    if (!code) return;
    const from = row.effective_from ?? '';
    const needs = parseYesNo(row.requires_tooth_number);
    const known = newest.get(code);
    if (!known || from > known.from) newest.set(code, { from, needs });
    else if (from === known.from && needs) known.needs = true;
  });
  return new Set([...newest].filter(([, version]) => version.needs).map(([code]) => code));
}

/**
 * A dental specialist's NAMAF codes with the dentist's tooth rule (owner, 14 Oct 2026: "copy the dentist flags"; NAMAF's
 * file has none). Only a code that reads 'NO' and has the same number as a dentist code that needs a tooth number changes,
 * to 'YES'. It is applied to the NAMAF rows before withNamafTariffs and mergeOwnTariffs, so a shared row of the specialist's
 * own type and the practice's own version of a code (Admin > Tariffs) still win.
 */
export function withDentistToothFlags<T extends { code: string; requires_tooth_number: string | null }>(
  tariffs: readonly T[],
  dentistCodes: ReadonlySet<string>
): T[] {
  if (dentistCodes.size === 0) return [...tariffs];
  return tariffs.map(tariff =>
    dentistCodes.has(codeKey(tariff.code)) && !parseYesNo(tariff.requires_tooth_number) ? { ...tariff, requires_tooth_number: 'YES' } : tariff
  );
}

/** A discipline in the list, as namaf_tariff_disciplines returns it. */
export interface NamafDiscipline {
  discipline_code: string;
  discipline_name: string;
  codes: number;
  priced_codes: number;
  valid_from: string | null;
  valid_to: string | null;
}

/** "General practitioner (014)" from "GENERAL PRACTITIONER". */
export function disciplineLabel(discipline: Pick<NamafDiscipline, 'discipline_code' | 'discipline_name'>): string {
  const name = discipline.discipline_name.trim().toLowerCase();
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} (${discipline.discipline_code})`;
}

/** The disciplines an administrator can choose from: main disciplines first by name, then the sub-types. */
export function disciplineChoices(disciplines: readonly NamafDiscipline[]): NamafDiscipline[] {
  return [...disciplines].sort(
    (a, b) => a.discipline_code.length - b.discipline_code.length || a.discipline_name.localeCompare(b.discipline_name) || a.discipline_code.localeCompare(b.discipline_code)
  );
}

/** The ward codes of the private hospital list (WARD_DAY_TARIFF_CODES order) from its rows. */
export function wardDayTariffs(rows: readonly NamafTariffRow[]): NamafTariff[] {
  const wanted = rows.filter(row => row.discipline_code === HOSPITAL_DISCIPLINE && WARD_DAY_TARIFF_CODES.includes(row.tariff_code));
  return namafRowsAsTariffs(wanted).sort(
    (a, b) => WARD_DAY_TARIFF_CODES.indexOf(a.namaf.tariffCode) - WARD_DAY_TARIFF_CODES.indexOf(b.namaf.tariffCode)
  );
}
