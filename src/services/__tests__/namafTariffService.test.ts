/**
 * Reading the NAMAF list a practice bills from. Why: billing must keep working before the database change exists
 * ("not set up yet", never an error on the visit), a practice must get the discipline its administrator chose, a
 * 'general' practice reads nothing until its type is chosen, a list longer than one page (GP 2,201 codes,
 * optometry 7,168) must arrive whole, and a practice must get its practice type's list with no setup: the link is
 * practice_types.namaf_discipline_code, with the app's built-in copy only while that column is missing. Invented rows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: { code?: string; message: string } | null };
const COLUMN_MISSING: Result = { data: null, error: { code: '42703', message: 'column practice_types.namaf_discipline_code does not exist' } };
const db = vi.hoisted(() => ({
  setting: { data: [] as unknown[], error: null } as Result,
  types: { data: null, error: { code: '42703', message: 'column practice_types.namaf_discipline_code does not exist' } } as Result,
  rows: new Map<string, unknown[]>(),
  missing: false,
  tables: [] as string[]
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      db.tables.push(table);
      const filters: Record<string, unknown> = {};
      let range: [number, number] = [0, 999];
      const builder: Record<string, unknown> = {};
      ['select', 'order', 'limit', 'in'].forEach(method => {
        builder[method] = () => builder;
      });
      builder.eq = (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      };
      builder.range = (from: number, to: number) => {
        range = [from, to];
        return builder;
      };
      const respond = (): Result => {
        if (table === 'practice_settings') return db.setting;
        if (table === 'practice_types') return db.types;
        if (db.missing) return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.namaf_tariffs' in the schema cache" } };
        const all = db.rows.get(String(filters.discipline_code)) ?? [];
        return { data: all.slice(range[0], range[1] + 1), error: null };
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
    amount: index % 4 === 0 ? 0 : 100 + index,
    units: 5,
    valid_from: '2026-01-01',
    valid_to: '2026-12-31'
  }));

beforeEach(() => {
  clearNamafCache();
  db.setting = { data: [], error: null };
  db.types = COLUMN_MISSING;
  db.rows = new Map();
  db.missing = false;
  db.tables = [];
});

describe('the NAMAF list a practice bills from', () => {
  it("reads the practice type's discipline, every page of it", async () => {
    db.rows.set('070', rows('070', 2500));
    const load = await loadPracticeNamaf('p1', 'optometry');
    expect(load).toMatchObject({ status: 'ready', discipline: '070', chosen: false });
    expect(load.tariffs).toHaveLength(2500);
    expect(load.tariffs.filter(tariff => tariff.no_fixed_amount)).toHaveLength(625);
  });

  it('reads the discipline the administrator chose instead', async () => {
    db.setting = { data: [{ setting_value: '010' }], error: null };
    db.rows.set('010', rows('010', 3));
    const load = await loadPracticeNamaf('p1', 'medical');
    expect(load).toMatchObject({ status: 'ready', discipline: '010', chosen: true });
  });

  it("asks nothing of the list for a 'general' practice", async () => {
    expect(await loadPracticeNamaf('p1', 'general')).toMatchObject({ status: 'none', tariffs: [] });
    expect(db.tables).not.toContain('namaf_tariffs');
  });

  it('says "not set up" before the database change, so billing goes on with the other lists', async () => {
    db.missing = true;
    expect(await loadPracticeNamaf('p1', 'physiotherapy')).toMatchObject({ status: 'not-set-up', discipline: '072', tariffs: [] });
  });
});

// Owner, 14 Oct 2026: "if you open up an optometric practice their codes should be there already. They should be linked
// to practice type." The link lives in the database, so a type added there bills from its list with no release.
describe("a practice type's list from the database", () => {
  it('reads the link in practice_types: a type only the database knows bills from its list with no setup', async () => {
    db.types = { data: [{ name: 'chiropractic', namaf_discipline_code: '004' }], error: null };
    db.rows.set('004', rows('004', 3));
    expect(await loadPracticeNamaf('p1', 'chiropractic')).toMatchObject({ status: 'ready', discipline: '004', chosen: false, typeDiscipline: '004' });
  });

  it("keeps the type's own list known when the administrator chose another (the way back on the Tariffs page)", async () => {
    db.types = { data: [{ name: 'medical', namaf_discipline_code: '014' }], error: null };
    db.setting = { data: [{ setting_value: '010' }], error: null };
    db.rows.set('010', rows('010', 2));
    expect(await loadPracticeNamaf('p1', 'medical')).toMatchObject({ status: 'ready', discipline: '010', chosen: true, typeDiscipline: '014' });
  });

  it("gives a type the database leaves empty no list: the built-in copy is not consulted once the column exists", async () => {
    db.types = { data: [{ name: 'pharmacy', namaf_discipline_code: null }], error: null };
    expect(await loadPracticeNamaf('p1', 'pharmacy')).toMatchObject({ status: 'none', typeDiscipline: null, tariffs: [] });
    expect(db.tables).not.toContain('namaf_tariffs');
  });

  it('uses the built-in copy where the column is not in the database yet, so billing goes on as before', async () => {
    db.rows.set('070', rows('070', 3));
    expect(await loadPracticeNamaf('p1', 'optometry')).toMatchObject({ status: 'ready', discipline: '070', typeDiscipline: '070' });
  });

  it('uses the built-in copy when the types cannot be read, and reads them again next time', async () => {
    db.types = { data: null, error: { message: 'network down' } };
    db.rows.set('054', rows('054', 2));
    expect(await loadPracticeNamaf('p1', 'dental')).toMatchObject({ status: 'ready', discipline: '054' });
    db.types = { data: [{ name: 'dental', namaf_discipline_code: '064' }], error: null };
    db.rows.set('064', rows('064', 2));
    expect(await loadPracticeNamaf('p1', 'dental')).toMatchObject({ status: 'ready', discipline: '064', typeDiscipline: '064' });
  });

  it('reads the practice types once for the session, not at every visit', async () => {
    db.types = { data: [{ name: 'urology', namaf_discipline_code: '046' }], error: null };
    db.rows.set('046', rows('046', 2));
    await loadPracticeNamaf('p1', 'urology');
    await loadPracticeNamaf('p1', 'urology');
    expect(db.tables.filter(table => table === 'practice_types')).toHaveLength(1);
  });
});
