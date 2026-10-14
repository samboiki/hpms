/**
 * The NAMAF list a dental specialist's practice bills from (owner, 14 Oct 2026: dental specialists are their own practice
 * types). Why: an orthodontist who is given the dentist's list (054) bills codes its funds do not know, and misses its
 * own (064); and the one practice typed 'dental_practice' must not be left without any list because its text matches no
 * practice type. Invented rows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: { code?: string; message: string } | null };
const COLUMN_MISSING: Result = { data: null, error: { code: '42703', message: 'column practice_types.namaf_discipline_code does not exist' } };
const db = vi.hoisted(() => ({
  types: { data: null, error: { code: '42703', message: 'column practice_types.namaf_discipline_code does not exist' } } as Result,
  rows: new Map<string, unknown[]>(),
  asked: [] as string[]
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {};
      ['select', 'order', 'limit', 'in', 'range'].forEach(method => {
        builder[method] = () => builder;
      });
      builder.eq = (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      };
      const respond = (): Result => {
        if (table === 'practice_settings') return { data: [], error: null };
        if (table === 'practice_types') return db.types;
        // A specialist's list also reads the dentist's tooth rules (namafTariffService.toothFlags.test.ts); not asked about here
        if (table === 'practice_tariffs_with_types') return { data: [], error: null };
        db.asked.push(String(filters.discipline_code));
        return { data: db.rows.get(String(filters.discipline_code)) ?? [], error: null };
      };
      builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(respond()).then(resolve);
      return builder;
    }
  }
}));

import { clearNamafCache, loadPracticeNamaf } from '../namafTariffService';

const rows = (discipline: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${discipline}-${index}`,
    discipline_code: discipline,
    tariff_code: String(index).padStart(5, '0'),
    code: String(index).padStart(4, '0'),
    description: `Invented ${index}`,
    amount: 100 + index,
    units: 5,
    valid_from: '2026-01-01',
    valid_to: '2026-12-31'
  }));

beforeEach(() => {
  clearNamafCache();
  db.types = COLUMN_MISSING;
  db.rows = new Map([['054', rows('054', 3)], ['064', rows('064', 2)], ['092', rows('092', 2)], ['095', rows('095', 2)]]);
  db.asked = [];
});

describe('the list of a dental specialist practice', () => {
  it("is the specialist's own list from the practice type's link in the database, not the dentist's", async () => {
    db.types = { data: [{ name: 'orthodontist', namaf_discipline_code: '064' }, { name: 'dental', namaf_discipline_code: '054' }], error: null };
    const load = await loadPracticeNamaf('p1', 'orthodontist');
    expect(load).toMatchObject({ status: 'ready', discipline: '064', chosen: false, typeDiscipline: '064' });
    expect(load.tariffs).toHaveLength(2);
    expect(db.asked).toEqual(['064']);
  });

  it('is the same list from the built-in copy while the database has no link column yet', async () => {
    expect(await loadPracticeNamaf('p1', 'orthodontist')).toMatchObject({ status: 'ready', discipline: '064' });
    expect(await loadPracticeNamaf('p1', 'periodontist')).toMatchObject({ status: 'ready', discipline: '092' });
    expect(await loadPracticeNamaf('p1', 'dental_therapist')).toMatchObject({ status: 'ready', discipline: '095' });
  });

  it("gives the practice typed 'dental_practice' the dentist list, from the database link and from the built-in copy", async () => {
    expect(await loadPracticeNamaf('p1', 'dental_practice')).toMatchObject({ status: 'ready', discipline: '054', typeDiscipline: '054' });
    clearNamafCache();
    db.types = { data: [{ name: 'dental', namaf_discipline_code: '054' }], error: null };
    expect(await loadPracticeNamaf('p1', ' Dental_Practice ')).toMatchObject({ status: 'ready', discipline: '054', typeDiscipline: '054' });
  });
});
