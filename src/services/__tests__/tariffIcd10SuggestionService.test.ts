/**
 * Reading what the billing line's ICD-10 suggestions are made from. Why: billing must keep working before the database
 * update exists or when a read fails (suggestions are a convenience: never an error on the visit), a practice may only
 * ask for its own data, a practice gets the starter codes of the NAMAF discipline it bills from (its administrator's
 * choice first), and a busy practice's billed codes (more than the 1,000 rows one request returns) arrive whole.
 * Invented rows, no real client.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Failure = { code?: string; message: string } | null;
const db = vi.hoisted(() => ({
  practiceType: 'medical' as string | null,
  starter: [] as unknown[],
  starterError: null as Failure,
  learnedPages: [] as unknown[][],
  learnedError: null as Failure,
  rpcCalls: [] as Array<{ name: string; args: unknown; from: number }>,
  asked: [] as Array<[string, string, unknown]>,
  chosen: null as string | null,
  byType: { medical: '014', optometry: '070', aesthetic: null } as Record<string, string | null>,
  usual: new Map<string, string>(),
  usualStatus: 'ready' as 'ready' | 'not-set-up' | 'error',
  clientBroken: false
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (db.clientBroken) throw new TypeError('db.from is not a function');
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => {
        db.asked.push([table, column, value]);
        return builder;
      };
      builder.maybeSingle = () => Promise.resolve({ data: db.practiceType === null ? null : { practice_type: db.practiceType }, error: null });
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(db.starterError ? { data: null, error: db.starterError } : { data: db.starter, error: null }).then(resolve);
      return builder;
    },
    rpc: (name: string, args: unknown) => {
      if (db.clientBroken) throw new TypeError('db.rpc is not a function');
      return {
        range: (from: number) => {
          db.rpcCalls.push({ name, args, from });
          return Promise.resolve(db.learnedError ? { data: null, error: db.learnedError } : { data: db.learnedPages[from / 1000] ?? [], error: null });
        }
      };
    }
  }
}));
vi.mock('../namafTariffService', () => ({
  loadChosenDiscipline: () => Promise.resolve(db.chosen),
  loadTypeDisciplines: () => Promise.resolve({ source: 'database', byType: db.byType })
}));
vi.mock('../icd10DefaultsService', () => ({
  loadTariffIcd10Defaults: () => Promise.resolve({ status: db.usualStatus, defaults: db.usual, message: null })
}));

import { forgetTariffIcd10Suggestions, loadTariffIcd10Suggestions } from '../tariffIcd10SuggestionService';
import { suggestionsForTariff } from '../../utils/billing/tariffIcd10Suggestions';

const PRACTICE = 'practice-a';

beforeEach(() => {
  forgetTariffIcd10Suggestions();
  db.practiceType = 'medical';
  db.starter = [];
  db.starterError = null;
  db.learnedPages = [];
  db.learnedError = null;
  db.rpcCalls = [];
  db.asked = [];
  db.chosen = null;
  db.usual = new Map();
  db.usualStatus = 'ready';
  db.clientBroken = false;
});

describe('the data behind the ICD-10 suggestions', () => {
  it("reads the practice's usual codes, what it billed and the starter codes, and orders them for a tariff code", async () => {
    db.usual = new Map([['2601', 'Z34.0']]);
    db.learnedPages = [[{ tariff_code: '2601', icd10_code: 'Z34.9', times_used: 12 }]];
    db.starter = [{ code: '2601', icd10_code: 'Z34.9', sort_order: 1, rationale: 'Antenatal visit' }, { code: '2601', icd10_code: 'Z35.9', sort_order: 2, rationale: 'High-risk pregnancy' }];
    const load = await loadTariffIcd10Suggestions(PRACTICE);
    expect(load.parts).toEqual({ usual: 'ready', learned: 'ready', starter: 'ready' });
    expect(suggestionsForTariff('2601', load.data).map(item => [item.code, item.source])).toEqual([
      ['Z34.0', 'practice'],
      ['Z34.9', 'learned'],
      ['Z35.9', 'starter']
    ]);
    // Only the practice's own data is asked for
    expect(db.rpcCalls[0]).toEqual({ name: 'learned_tariff_icd10', args: { p_practice_id: PRACTICE }, from: 0 });
    expect(db.asked).toContainEqual(['practices', 'id', PRACTICE]);
  });

  // The starter list is per NAMAF discipline: a code number means different things in different disciplines
  it('asks for the starter codes of the discipline the practice type bills from', async () => {
    db.practiceType = 'optometry';
    await loadTariffIcd10Suggestions(PRACTICE);
    expect(db.asked).toContainEqual(['namaf_tariff_icd10_suggestions', 'discipline_code', '070']);
  });

  it("prefers the discipline the practice's administrator chose", async () => {
    db.chosen = '010';
    await loadTariffIcd10Suggestions(PRACTICE);
    expect(db.asked).toContainEqual(['namaf_tariff_icd10_suggestions', 'discipline_code', '010']);
  });

  it('reads no starter codes for a practice type that has no NAMAF list of its own', async () => {
    db.practiceType = 'aesthetic';
    const load = await loadTariffIcd10Suggestions(PRACTICE);
    expect(db.asked.some(([table]) => table === 'namaf_tariff_icd10_suggestions')).toBe(false);
    expect(load.parts.starter).toBe('ready');
    expect(load.data.starter.size).toBe(0);
  });

  it('gives a busy practice its billed codes whole, across the 1,000 rows one request returns', async () => {
    const row = (index: number) => ({ tariff_code: String(index).padStart(4, '0'), icd10_code: 'J06.9', times_used: 2 });
    db.learnedPages = [Array.from({ length: 1000 }, (_, index) => row(index)), Array.from({ length: 5 }, (_, index) => row(1000 + index))];
    const load = await loadTariffIcd10Suggestions(PRACTICE);
    expect(load.data.learned.size).toBe(1005);
    expect(db.rpcCalls.map(call => call.from).slice(0, 2)).toEqual([0, 1000]);
  });
});

describe('before the database update, and when a read fails', () => {
  // The visit must never show a database error because a convenience is missing
  it('treats a missing function or table as "no suggestions of that kind", and keeps the rest', async () => {
    db.usual = new Map([['0190', 'J06.9']]);
    db.learnedError = { code: 'PGRST202', message: 'Could not find the function public.learned_tariff_icd10(p_practice_id) in the schema cache' };
    db.starterError = { code: '42P01', message: 'relation "public.namaf_tariff_icd10_suggestions" does not exist' };
    const load = await loadTariffIcd10Suggestions(PRACTICE);
    expect(load.parts).toEqual({ usual: 'ready', learned: 'not-set-up', starter: 'not-set-up' });
    expect(suggestionsForTariff('0190', load.data).map(item => item.code)).toEqual(['J06.9']);
  });

  it('also reads a missing function reported by Postgres itself (42883)', async () => {
    db.learnedError = { code: '42883', message: 'function public.learned_tariff_icd10(uuid) does not exist' };
    expect((await loadTariffIcd10Suggestions(PRACTICE)).parts.learned).toBe('not-set-up');
  });

  it('reads a failed part again next time, and keeps a good result for a while', async () => {
    db.learnedError = { code: '57014', message: 'canceling statement due to statement timeout' };
    expect((await loadTariffIcd10Suggestions(PRACTICE)).parts.learned).toBe('error');
    db.learnedError = null;
    db.learnedPages = [[{ tariff_code: '0101', icd10_code: 'I10', times_used: 3 }]];
    const again = await loadTariffIcd10Suggestions(PRACTICE);
    expect(again.parts.learned).toBe('ready');
    expect(again.data.learned.get('0101')).toEqual([{ code: 'I10', timesUsed: 3 }]);
    const calls = db.rpcCalls.length;
    await loadTariffIcd10Suggestions(PRACTICE);
    expect(db.rpcCalls).toHaveLength(calls);
  });

  it('keeps each practice\'s data apart', async () => {
    db.learnedPages = [[{ tariff_code: '0101', icd10_code: 'I10', times_used: 3 }]];
    await loadTariffIcd10Suggestions('practice-a');
    db.learnedPages = [];
    const other = await loadTariffIcd10Suggestions('practice-b');
    expect(other.data.learned.size).toBe(0);
    expect(db.rpcCalls.map(call => (call.args as { p_practice_id: string }).p_practice_id)).toEqual(['practice-a', 'practice-b']);
  });

  it('never throws, even when there is no usable database client', async () => {
    db.clientBroken = true;
    const load = await loadTariffIcd10Suggestions(PRACTICE);
    expect(load.parts.learned).toBe('error');
    expect(load.parts.starter).toBe('error');
    expect(load.data.learned.size + load.data.starter.size).toBe(0);
  });

  it('reads nothing for no practice', async () => {
    const load = await loadTariffIcd10Suggestions(null);
    expect(db.rpcCalls).toHaveLength(0);
    expect(load.data.usual.size + load.data.learned.size + load.data.starter.size).toBe(0);
  });
});
