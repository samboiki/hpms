/**
 * Reads what the billing line's ICD-10 suggestions are made from (src/utils/billing/tariffIcd10Suggestions.ts,
 * proposals/2026-10-14-tariff-icd10-suggestions.sql): the practice's usual codes (tariff_icd10_defaults), the codes it
 * billed most per tariff code in the last 24 months (learned_tariff_icd10) and OneHealth's starter codes for the
 * practice's NAMAF discipline (namaf_tariff_icd10_suggestions). Each part is read on its own: one that is not set up yet
 * or fails is simply empty, so suggestions never block billing and never show a database error. A practice's data is
 * kept for 5 minutes (a part that failed is read again next time).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllPages } from '../lib/pagedRows';
import { supabase } from '../lib/supabase';
import { loadTariffIcd10Defaults } from './icd10DefaultsService';
import { isNotSetUpError } from './invoicingSetup';
import { loadChosenDiscipline, loadTypeDisciplines } from './namafTariffService';
import { practiceDiscipline } from '../utils/billing/namafTariffs';
import {
  EMPTY_TARIFF_ICD10_DATA,
  toLearnedMap,
  toStarterMap,
  type LearnedRow,
  type StarterRow,
  type TariffIcd10Data
} from '../utils/billing/tariffIcd10Suggestions';

// The generated database types do not know the new table and function yet
const db = supabase as unknown as SupabaseClient;

const STARTER_COLUMNS = 'code, icd10_code, sort_order, rationale, source';
/** PostgREST returns at most 1,000 rows per request: a busy practice has more learned rows than that */
const PAGE = 1000;
const CACHE_MS = 5 * 60 * 1000;

/** not-set-up: the database update is not applied yet */
export type SuggestionPartStatus = 'ready' | 'not-set-up' | 'error';

export interface TariffIcd10Load {
  data: TariffIcd10Data;
  parts: { usual: SuggestionPartStatus; learned: SuggestionPartStatus; starter: SuggestionPartStatus };
}

interface DbError {
  code?: string;
  message?: string;
}

/** True when the function or table is not in the database yet (PostgREST: PGRST202, PGRST205; Postgres: 42883, 42P01). */
function isMissing(error: unknown): boolean {
  if (isNotSetUpError(error)) return true;
  const code = (error as DbError | null)?.code;
  return code === '42883' || code === 'PGRST202';
}

const statusOf = (error: unknown): SuggestionPartStatus => (isMissing(error) ? 'not-set-up' : 'error');

async function readLearned(practiceId: string): Promise<{ status: SuggestionPartStatus; rows: LearnedRow[] }> {
  try {
    const rows = await readAllPages<LearnedRow, DbError>(
      PAGE,
      // The function orders by tariff code and place, so pages neither overlap nor skip rows
      (from, to) =>
        db.rpc('learned_tariff_icd10', { p_practice_id: practiceId }).range(from, to) as unknown as PromiseLike<{ data: LearnedRow[] | null; error: DbError | null }>,
      error => Object.assign(new Error(error.message ?? 'The practice\'s billed codes could not be read.'), { cause: error })
    );
    return { status: 'ready', rows };
  } catch (error) {
    return { status: statusOf((error as { cause?: unknown } | null)?.cause ?? error), rows: [] };
  }
}

/** practices.practice_type of the practice (the discipline of its type is looked up from it); throws when it cannot be read. */
async function readPracticeType(practiceId: string): Promise<string | null> {
  const { data, error } = await db.from('practices').select('practice_type').eq('id', practiceId).maybeSingle();
  if (error) throw new Error(error.message);
  const type = (data as { practice_type?: unknown } | null)?.practice_type;
  return typeof type === 'string' ? type : null;
}

async function readStarter(practiceId: string): Promise<{ status: SuggestionPartStatus; rows: StarterRow[] }> {
  try {
    // The same discipline the practice's price list comes from: its administrator's choice, else its practice type's
    const [chosen, links, practiceType] = await Promise.all([
      loadChosenDiscipline(practiceId).catch(() => null),
      loadTypeDisciplines(),
      readPracticeType(practiceId)
    ]);
    const discipline = practiceDiscipline(practiceType, chosen, links.byType);
    if (!discipline) return { status: 'ready', rows: [] };
    const { data, error } = await db.from('namaf_tariff_icd10_suggestions').select(STARTER_COLUMNS).eq('discipline_code', discipline);
    if (error) return { status: statusOf(error), rows: [] };
    return { status: 'ready', rows: (data ?? []) as StarterRow[] };
  } catch {
    return { status: 'error', rows: [] };
  }
}

async function readAll(practiceId: string): Promise<TariffIcd10Load> {
  const [usual, learned, starter] = await Promise.all([loadTariffIcd10Defaults(practiceId), readLearned(practiceId), readStarter(practiceId)]);
  return {
    data: { usual: usual.defaults, learned: toLearnedMap(learned.rows), starter: toStarterMap(starter.rows) },
    parts: { usual: usual.status, learned: learned.status, starter: starter.status }
  };
}

const cache = new Map<string, { at: number; load: Promise<TariffIcd10Load> }>();

/** The practice's suggestion data, from the last 5 minutes when it was read then. Never throws. */
export function loadTariffIcd10Suggestions(practiceId: string | null): Promise<TariffIcd10Load> {
  if (!practiceId) return Promise.resolve({ data: EMPTY_TARIFF_ICD10_DATA, parts: { usual: 'ready', learned: 'ready', starter: 'ready' } });
  const cached = cache.get(practiceId);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.load;
  const load = readAll(practiceId).then(result => {
    // A part that failed (not one that is not set up yet) is tried again the next time the code box opens
    if (Object.values(result.parts).includes('error') && cache.get(practiceId)?.load === load) cache.delete(practiceId);
    return result;
  });
  cache.set(practiceId, { at: Date.now(), load });
  return load;
}

/** For tests: forget what was read. (A code set under Admin > Tariffs shows up in the code box after at most 5 minutes.) */
export function forgetTariffIcd10Suggestions(): void {
  cache.clear();
}
