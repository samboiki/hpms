/**
 * A dental specialist's list asks for a tooth where the dentist's does (owner, 14 Oct 2026: "Yes, copy the dentist flags").
 * Why it matters: NAMAF's file does not say which codes need a tooth number, so an orthodontist's visit never asked for the
 * tooth of a filling, and the fund pended the line. The dentist's shared list does know, so a specialist's code with the same
 * number is flagged from it, and the practice's own version of a code (Admin > Tariffs) still wins. Invented rows; no
 * practice of another type is asked anything new.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: { code?: string; message: string } | null };

const db = vi.hoisted(() => ({
  /** practice_tariffs_with_types rows, by practice type name */
  shared: new Map<string, unknown[]>(),
  /** The dentist list cannot be read */
  dentistError: null as { message: string } | null,
  namaf: new Map<string, unknown[]>(),
  /** The discipline an administrator chose for the practice (practice_settings 'namaf_discipline'), if any */
  chosen: null as string | null,
  own: [] as unknown[],
  /** practice_tariffs_with_types reads, by the type name asked for */
  sharedReads: [] as string[]
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
        if (table === 'practice_types') return { data: null, error: { code: '42703', message: 'column practice_types.namaf_discipline_code does not exist' } };
        if (table === 'namaf_tariffs') return { data: db.namaf.get(String(filters.discipline_code)) ?? [], error: null };
        if (table === 'practice_own_tariffs') return { data: db.own, error: null };
        if (table === 'practice_settings') {
          return { data: filters.setting_key === 'namaf_discipline' && db.chosen ? [{ setting_value: db.chosen }] : [], error: null };
        }
        if (table === 'practice_tariffs_with_types') {
          const type = String(filters.practice_type_name);
          db.sharedReads.push(type);
          if (type === 'dental' && db.dentistError) return { data: null, error: db.dentistError };
          return { data: db.shared.get(type) ?? [], error: null };
        }
        return { data: [], error: null };
      };
      builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(respond()).then(resolve);
      return builder;
    },
    rpc: () => Promise.resolve({ data: [], error: null })
  }
}));

import { clearNamafCache, loadDentistToothCodes, loadPracticeNamaf } from '../namafTariffService';
import { loadPracticeTariffRows } from '../practiceTariffService';

const FILLING = '8341';
const EXTRACTION = '8501';
const CONSULTATION = '8101';
const SPECIALIST_ONLY = '9001';

const namafRow = (discipline: string, code: string) => ({
  id: `${discipline}-${code}`,
  discipline_code: discipline,
  tariff_code: code.padStart(5, '0'),
  code,
  description: `Invented ${code}`,
  amount: 250,
  units: 10,
  valid_from: '2026-01-01',
  valid_to: '2026-12-31'
});

const dentistRow = (code: string, flag: string) => ({
  id: `dental-${code}`,
  code,
  description: `Invented dentist ${code}`,
  price: 200,
  unit: null,
  is_active: true,
  effective_from: '2025-01-01',
  effective_to: null,
  can_be_multiplied: 'NO',
  requires_tooth_number: flag,
  business_rule_formula: null,
  example_calculation: null,
  notes: null
});

const toothOf = (load: { tariffs: Array<{ code: string; requires_tooth_number: string | null }> }) =>
  Object.fromEntries(load.tariffs.map(tariff => [tariff.code, tariff.requires_tooth_number]));

beforeEach(() => {
  clearNamafCache();
  db.shared = new Map([['dental', [dentistRow(FILLING, 'YES'), dentistRow(EXTRACTION, 'YES'), dentistRow(CONSULTATION, 'NO')]]]);
  db.dentistError = null;
  db.namaf = new Map([
    ['064', [FILLING, EXTRACTION, CONSULTATION, SPECIALIST_ONLY].map(code => namafRow('064', code))],
    ['054', [FILLING, CONSULTATION].map(code => namafRow('054', code))],
    ['014', ['0190'].map(code => namafRow('014', code))]
  ]);
  db.chosen = null;
  db.own = [];
  db.sharedReads = [];
});

describe("a dental specialist's NAMAF list", () => {
  it("asks for a tooth on the codes the dentist's list marks, and on no other", async () => {
    const load = await loadPracticeNamaf('practice-1', 'orthodontist');
    expect(load.status).toBe('ready');
    expect(toothOf(load)).toEqual({ [FILLING]: 'YES', [EXTRACTION]: 'YES', [CONSULTATION]: 'NO', [SPECIALIST_ONLY]: 'NO' });
    expect(load).not.toHaveProperty('notice');
  });

  it("reads the dentist's list by the dentist's type name, never the specialist's own", async () => {
    await loadPracticeNamaf('practice-1', 'periodontist');
    expect(db.sharedReads).toEqual(['dental']);
  });

  // The flags follow the code number, not the list: an orthodontist who bills from the dentist's list (054) is asked too
  it("follows the code number whichever NAMAF list the practice chose: an orthodontist on the dentist's list is asked for the filling's tooth", async () => {
    db.chosen = '054';
    const load = await loadPracticeNamaf('practice-1', 'orthodontist');
    expect(load).toMatchObject({ status: 'ready', discipline: '054', chosen: true });
    expect(toothOf(load)).toEqual({ [FILLING]: 'YES', [CONSULTATION]: 'NO' });
  });

  it('reads the dentist list once however many lists are opened (a session keeps it for half an hour)', async () => {
    await loadPracticeNamaf('practice-1', 'orthodontist');
    await loadPracticeNamaf('practice-1', 'orthodontist');
    await loadPracticeNamaf('practice-2', 'periodontist');
    expect(db.sharedReads).toEqual(['dental']);
  });

  // Billing must not stop because the dentist's list could not be read: the list is as it was before the rules were copied,
  // and the practice is told in words (not a database error), and the next load tries again
  it('is offered without the tooth rules, with a notice, when the dentist list cannot be read, and asks again next time', async () => {
    db.dentistError = { message: 'network down' };
    const failed = await loadPracticeNamaf('practice-1', 'orthodontist');
    expect(failed.status).toBe('ready');
    expect(failed.tariffs).toHaveLength(4);
    expect(Object.values(toothOf(failed))).toEqual(['NO', 'NO', 'NO', 'NO']);
    expect(failed).toMatchObject({ notice: expect.stringContaining("dentist's tooth rules") });

    db.dentistError = null;
    const again = await loadPracticeNamaf('practice-1', 'orthodontist');
    expect(toothOf(again)[FILLING]).toBe('YES');
    expect(again).not.toHaveProperty('notice');
  });
});

describe('every other practice', () => {
  // The dentist's shared list carries the flags on its own rows; reading it again for the dentist would be a second copy
  it("the dentist's list is read as before, with no second read of it for the tooth rules", async () => {
    const load = await loadPracticeNamaf('practice-1', 'dental');
    expect(toothOf(load)).toEqual({ [FILLING]: 'NO', [CONSULTATION]: 'NO' });
    expect(db.sharedReads).toEqual([]);
  });

  it("the practice typed 'dental_practice' is the dentist: no second read", async () => {
    await loadPracticeNamaf('practice-1', 'dental_practice');
    expect(db.sharedReads).toEqual([]);
  });

  it('a general practitioner is never asked for a tooth and reads nothing new', async () => {
    const load = await loadPracticeNamaf('practice-1', 'medical');
    expect(toothOf(load)).toEqual({ '0190': 'NO' });
    expect(db.sharedReads).toEqual([]);
  });
});

describe('loadDentistToothCodes', () => {
  it('is the codes of the dentist list marked YES', async () => {
    expect([...(await loadDentistToothCodes())].sort()).toEqual([FILLING, EXTRACTION]);
  });

  it('rejects, in words, when the dentist list cannot be read, and is not kept', async () => {
    db.dentistError = { message: 'network down' };
    await expect(loadDentistToothCodes()).rejects.toThrow("Could not read the dentist's tooth rules: network down");
    db.dentistError = null;
    expect((await loadDentistToothCodes()).has(FILLING)).toBe(true);
  });
});

// What the visit screens, quotes and the Tariffs page bill from is loadPracticeTariffRows: the flags must arrive there, and
// the practice's own version of a code must still win
describe("the rows a specialist's visit bills from", () => {
  const flags = (rows: Array<{ code: string; requires_tooth_number: string | null; is_own?: boolean }>) =>
    Object.fromEntries(rows.map(row => [`${row.code}${row.is_own ? ' (own)' : ''}`, row.requires_tooth_number]));

  it('ask for a tooth on the codes the dentist list marks', async () => {
    const { rows, problems } = await loadPracticeTariffRows('practice-1', 'orthodontist');
    expect(flags(rows)).toEqual({ [FILLING]: 'YES', [EXTRACTION]: 'YES', [CONSULTATION]: 'NO', [SPECIALIST_ONLY]: 'NO' });
    expect(problems).toEqual([]);
  });

  it("let the practice's own version of a code say otherwise (Admin > Tariffs: needs a tooth unticked)", async () => {
    db.own = [
      {
        id: 'own-1',
        practice_id: 'practice-1',
        code: FILLING,
        description: 'Own filling',
        price: 300,
        can_be_multiplied: 'NO',
        requires_tooth_number: 'NO',
        effective_from: '2026-06-01',
        is_active: true
      }
    ];
    const { rows } = await loadPracticeTariffRows('practice-1', 'orthodontist');
    const own = rows.filter(row => row.is_own);
    expect(own.map(row => [row.code, row.requires_tooth_number])).toEqual([[FILLING, 'NO']]);
    // The copied rule of that code ends the day before the practice's own version starts; the other code is untouched
    const copiedFilling = rows.find(row => row.code === FILLING && !row.is_own);
    expect(copiedFilling?.requires_tooth_number).toBe('YES');
    expect(copiedFilling?.effective_to).toBe('2026-05-31');
    expect(rows.find(row => row.code === EXTRACTION)?.requires_tooth_number).toBe('YES');
  });

  it("say, in the problems list, when the dentist's tooth rules could not be read, and still offer every code", async () => {
    db.dentistError = { message: 'network down' };
    const { rows, problems } = await loadPracticeTariffRows('practice-1', 'orthodontist');
    expect(rows).toHaveLength(4);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("dentist's tooth rules");
    expect(problems[0]).toContain('no tooth number');
  });

  it("are the dentist's own shared rows for a dentist, as before (no copy)", async () => {
    const { rows } = await loadPracticeTariffRows('practice-1', 'dental');
    // The shared rows carry their own flags; NAMAF's 054 rows add the amount as a newer version of the same code
    expect(rows.filter(row => row.code === FILLING).map(row => row.requires_tooth_number)).toEqual(['YES', 'YES']);
    expect(rows.find(row => row.code === CONSULTATION)?.requires_tooth_number).toBe('NO');
  });
});
