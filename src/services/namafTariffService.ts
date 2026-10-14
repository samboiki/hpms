/**
 * Database reads and writes for the NAMAF benchmark list (namaf_tariffs, proposals/2026-10-13-namaf-tariffs.sql), the
 * discipline of each practice type (practice_types.namaf_discipline_code, proposals/2026-10-14-practice-type-disciplines.sql)
 * and the practice's choice of discipline (practice_settings 'namaf_discipline'). The rules live in
 * src/utils/billing/namafTariffs.ts (tested); this file only loads and saves. Before the first proposal is applied the
 * list reads as "not set up yet" and billing works on the shared and own lists as before; before the second, the
 * practice types' disciplines come from the built-in copy.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { readAllPages } from '../lib/pagedRows';
import type { Json } from '../types/database.types';
import {
  DENTIST_PRACTICE_TYPE,
  HOSPITAL_DISCIPLINE,
  NAMAF_DISCIPLINE_BY_PRACTICE_TYPE,
  NAMAF_DISCIPLINE_SETTING_KEY,
  WARD_DAY_TARIFF_CODES,
  dentistToothCodes,
  isDentalSpecialist,
  isNamafDisciplineCode,
  namafRowsAsTariffs,
  practiceDiscipline,
  typeDiscipline,
  typeDisciplinesFromRows,
  wardDayTariffs,
  withDentistToothFlags,
  type DentistToothRow,
  type NamafDiscipline,
  type NamafTariff,
  type NamafTariffRow,
  type PracticeTypeDisciplines
} from '../utils/billing/namafTariffs';

// The generated database types do not know the new tables, view and column yet
const db = supabase as unknown as SupabaseClient;

const ROW_COLUMNS = 'id, discipline_code, tariff_code, code, description, amount, units, valid_from, valid_to';
const DISCIPLINE_COLUMNS = 'discipline_code, discipline_name, codes, priced_codes, valid_from, valid_to';
const TYPE_COLUMNS = 'name, namaf_discipline_code';
const DENTIST_TOOTH_COLUMNS = 'code, requires_tooth_number, effective_from';
const NAMAF_OBJECTS = /\bnamaf_tariff/i;
/** PostgREST returns at most 1,000 rows per request */
const PAGE = 1000;
/** The list changes only when a new year's file is loaded, so a session keeps what it read for half an hour */
const CACHE_MS = 30 * 60 * 1000;

interface DbError {
  code?: string;
  message?: string;
}

/** True when the NAMAF table or view is not in the database yet (the proposal is not applied). */
export function isNamafListMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!NAMAF_OBJECTS.test(message ?? '')) return false;
  if (code === '42P01' || code === 'PGRST205') return true;
  return /could not find the (table|relation)|does not exist|schema cache/i.test(message ?? '');
}

class NamafMissingError extends Error {}

/** True when practice_types has no namaf_discipline_code column yet (the second proposal is not applied). */
export function isTypeLinkMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  return code === '42703' || /namaf_discipline_code/i.test(message ?? '');
}

const cache = new Map<string, { at: number; rows: Promise<NamafTariffRow[]> }>();
let typeCache: { at: number; links: Promise<TypeDisciplines> } | null = null;
let dentistToothCache: { at: number; codes: Promise<ReadonlySet<string>> } | null = null;

/** Forgets what was read (tests, and after a new year's list or the practice types' links were changed). */
export function clearNamafCache(): void {
  cache.clear();
  typeCache = null;
  dentistToothCache = null;
}

/** The discipline of each practice type, and where it was read from. */
export interface TypeDisciplines {
  source: 'database' | 'built-in';
  byType: PracticeTypeDisciplines;
}

const BUILT_IN: TypeDisciplines = { source: 'built-in', byType: NAMAF_DISCIPLINE_BY_PRACTICE_TYPE };

async function fetchTypeDisciplines(): Promise<TypeDisciplines> {
  const { data, error } = await db.from('practice_types').select(TYPE_COLUMNS);
  if (error) {
    if (isTypeLinkMissing(error)) return BUILT_IN;
    throw new Error(`Could not read the practice types' NAMAF lists: ${error.message}`);
  }
  return { source: 'database', byType: typeDisciplinesFromRows((data ?? []) as Array<{ name?: unknown; namaf_discipline_code?: unknown }>) };
}

/**
 * The NAMAF discipline of every practice type, from practice_types.namaf_discipline_code. Where the column is not in the
 * database yet, or the types cannot be read, the built-in copy is used so billing goes on; a failed read is tried again
 * next time. Never throws.
 */
export function loadTypeDisciplines(): Promise<TypeDisciplines> {
  if (typeCache && Date.now() - typeCache.at < CACHE_MS) return typeCache.links;
  const links = fetchTypeDisciplines().catch(() => {
    typeCache = null;
    return BUILT_IN;
  });
  typeCache = { at: Date.now(), links };
  return links;
}

/** Every row of one discipline (all pages, readAllPages); throws NamafMissingError before the proposal. */
function fetchDisciplineRows(discipline: string): Promise<NamafTariffRow[]> {
  return readAllPages<NamafTariffRow, DbError>(
    PAGE,
    (from, to) =>
      db
        .from('namaf_tariffs')
        .select(ROW_COLUMNS)
        .eq('discipline_code', discipline)
        // Unique within a discipline, so pages neither overlap nor skip rows
        .order('tariff_code', { ascending: true })
        .order('valid_from', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: NamafTariffRow[] | null; error: DbError | null }>,
    error => (isNamafListMissing(error) ? new NamafMissingError('not set up') : new Error(`Could not read the NAMAF list: ${error.message ?? 'unknown error'}`))
  );
}

/** One discipline's rows, from the session cache when read in the last half hour. */
export function loadNamafRows(discipline: string): Promise<NamafTariffRow[]> {
  const cached = cache.get(discipline);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.rows;
  const rows = fetchDisciplineRows(discipline);
  cache.set(discipline, { at: Date.now(), rows });
  rows.catch(() => cache.delete(discipline));
  return rows;
}

/**
 * The codes of the dentist's shared list (practice type 'dental') that need a tooth number. A dental specialist's NAMAF list
 * has no such rule of its own (NAMAF's file has none), so these are copied to it: withDentistToothFlags, owner decision of
 * 14 Oct 2026. Read once per half hour like the NAMAF rows; a failed read rejects and is asked again next time.
 */
export function loadDentistToothCodes(): Promise<ReadonlySet<string>> {
  if (dentistToothCache && Date.now() - dentistToothCache.at < CACHE_MS) return dentistToothCache.codes;
  const codes = readAllPages<DentistToothRow, DbError>(
    PAGE,
    (from, to) =>
      db
        .from('practice_tariffs_with_types')
        .select(DENTIST_TOOTH_COLUMNS)
        .eq('practice_type_name', DENTIST_PRACTICE_TYPE)
        // Unique, so pages neither overlap nor skip rows
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: DentistToothRow[] | null; error: DbError | null }>,
    error => new Error(`Could not read the dentist's tooth rules: ${error.message ?? 'unknown error'}`)
  ).then(dentistToothCodes);
  const entry = { at: Date.now(), codes };
  dentistToothCache = entry;
  codes.catch(() => {
    if (dentistToothCache === entry) dentistToothCache = null;
  });
  return codes;
}

/** The discipline an administrator chose for the practice (practice_settings), or null. */
export async function loadChosenDiscipline(practiceId: string | null): Promise<string | null> {
  if (!practiceId) return null;
  const { data, error } = await supabase
    .from('practice_settings')
    .select('setting_value')
    .eq('practice_id', practiceId)
    .eq('setting_key', NAMAF_DISCIPLINE_SETTING_KEY)
    .limit(1);
  if (error) throw new Error(`Could not read which NAMAF list the practice uses: ${error.message}`);
  const value = data?.[0]?.setting_value;
  return isNamafDisciplineCode(value) ? value : null;
}

/** Saves the practice's discipline (practice administrators; RLS decides); null goes back to the practice type's. */
export async function saveChosenDiscipline(practiceId: string, discipline: string | null): Promise<void> {
  if (discipline === null) {
    const { error } = await supabase.from('practice_settings').delete().eq('practice_id', practiceId).eq('setting_key', NAMAF_DISCIPLINE_SETTING_KEY);
    if (error) throw new Error(`Could not save the practice's NAMAF list: ${error.message}`);
    return;
  }
  if (!isNamafDisciplineCode(discipline)) throw new Error('Choose a discipline from the list.');
  const { error } = await supabase.from('practice_settings').upsert(
    {
      practice_id: practiceId,
      setting_key: NAMAF_DISCIPLINE_SETTING_KEY,
      setting_value: discipline as unknown as Json,
      setting_type: 'string',
      description: 'The NAMAF discipline whose benchmark list the practice bills from (instead of its practice type\'s)',
      is_public: false
    },
    { onConflict: 'practice_id,setting_key' }
  );
  if (error) throw new Error(`Could not save the practice's NAMAF list: ${error.message}`);
}

/** `typeDiscipline` is the practice type's own discipline (what "back to the practice type's list" means). */
export type NamafLoad =
  /** `notice`: a part of the list's rules could not be read and billing goes on without it (the dentist's tooth rules) */
  | { status: 'ready'; discipline: string; chosen: boolean; typeDiscipline: string | null; tariffs: NamafTariff[]; notice?: string }
  /** No discipline for the practice type (e.g. 'general' or 'aesthetic') and none chosen */
  | { status: 'none'; discipline: null; chosen: false; typeDiscipline: null; tariffs: [] }
  | { status: 'not-set-up'; discipline: string | null; chosen: boolean; typeDiscipline: string | null; tariffs: [] }
  | { status: 'error'; discipline: string | null; chosen: boolean; typeDiscipline: string | null; tariffs: []; message: string };

/**
 * A dental specialist's list with the dentist's tooth rules copied to it (withDentistToothFlags); any other list as it is.
 * When the dentist's list cannot be read the specialist's list is returned without the rules and `notice` says so.
 */
async function withSpecialistToothRules(
  practiceType: string | null | undefined,
  tariffs: NamafTariff[]
): Promise<{ tariffs: NamafTariff[]; notice?: string }> {
  if (!isDentalSpecialist(practiceType)) return { tariffs };
  try {
    return { tariffs: withDentistToothFlags(tariffs, await loadDentistToothCodes()) };
  } catch (error) {
    return { tariffs, notice: error instanceof Error ? error.message : "The dentist's tooth rules could not be read." };
  }
}

/** The NAMAF list the practice bills from, as billing tariffs (see namafTariffs.ts). Never throws. */
export async function loadPracticeNamaf(practiceId: string | null, practiceType: string | null | undefined): Promise<NamafLoad> {
  // Without the choice the practice type's list applies; the Tariffs page shows the choice it could read
  const [chosen, links] = await Promise.all([loadChosenDiscipline(practiceId).catch(() => null), loadTypeDisciplines()]);
  const typeList = typeDiscipline(practiceType, links.byType);
  const discipline = practiceDiscipline(practiceType, chosen, links.byType);
  if (!discipline) return { status: 'none', discipline: null, chosen: false, typeDiscipline: null, tariffs: [] };
  try {
    const rows = await loadNamafRows(discipline);
    const listed = await withSpecialistToothRules(practiceType, namafRowsAsTariffs(rows));
    return { status: 'ready', discipline, chosen: chosen !== null, typeDiscipline: typeList, ...listed };
  } catch (error) {
    if (error instanceof NamafMissingError) return { status: 'not-set-up', discipline, chosen: chosen !== null, typeDiscipline: typeList, tariffs: [] };
    return {
      status: 'error',
      discipline,
      chosen: chosen !== null,
      typeDiscipline: typeList,
      tariffs: [],
      message: error instanceof Error ? error.message : 'The NAMAF list could not be read.'
    };
  }
}

/** The disciplines in the list (codes, priced codes, dates); not-set-up before the proposal. */
export async function loadNamafDisciplines(): Promise<{ status: 'ready' | 'not-set-up'; disciplines: NamafDiscipline[] }> {
  const { data, error } = await db.from('namaf_tariff_disciplines').select(DISCIPLINE_COLUMNS).order('discipline_code');
  if (error) {
    if (isNamafListMissing(error)) return { status: 'not-set-up', disciplines: [] };
    throw new Error(`Could not read the NAMAF disciplines: ${error.message}`);
  }
  return { status: 'ready', disciplines: (data ?? []) as NamafDiscipline[] };
}

/** The private hospital's per-day ward codes (57001 surgical ... 57007 day admission), for the ward setup and bill. */
export async function loadWardDayTariffs(): Promise<NamafTariff[]> {
  const { data, error } = await db
    .from('namaf_tariffs')
    .select(ROW_COLUMNS)
    .eq('discipline_code', HOSPITAL_DISCIPLINE)
    .in('tariff_code', [...WARD_DAY_TARIFF_CODES]);
  if (error) {
    if (isNamafListMissing(error)) return [];
    throw new Error(`Could not read the NAMAF ward codes: ${error.message}`);
  }
  return wardDayTariffs((data ?? []) as NamafTariffRow[]);
}
