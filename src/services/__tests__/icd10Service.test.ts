/**
 * Reading the medical aids' ICD-10 list (parity E14). Claim review reads the list's entries for every code on a batch in
 * one query, the code search sends the code and words a practitioner typed, and nothing here ever throws: before the
 * list is set up the app works as it did with free entry. The database is a stand-in: nothing leaves the test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Icd10MasterRow } from '../../utils/billing/icd10Master';

const row = (code: string, description: string, overrides: Partial<Icd10MasterRow> = {}): Icd10MasterRow => ({
  code,
  description,
  valid_clinical_use: true,
  valid_primary: true,
  is_asterisk: false,
  age_range: null,
  gender: null,
  status: null,
  sa_end_date: null,
  ...overrides
});

const ROWS = [row('J06.9', 'Acute upper respiratory infection, unspecified'), row('I10', 'Essential (primary) hypertension')];

const db = vi.hoisted(() => ({
  mode: 'ok' as 'ok' | 'missing' | 'throw',
  lookups: [] as string[][],
  searches: [] as unknown[]
}));

vi.mock('../../lib/supabase', () => {
  const answer = (data: unknown) => {
    if (db.mode === 'throw') throw new Error('The network is down');
    if (db.mode === 'missing') return Promise.resolve({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.icd10_codes' in the schema cache" } });
    return Promise.resolve({ data, error: null });
  };
  return {
    supabase: {
      from: () => ({
        select: () => ({
          in: (_column: string, codes: string[]) => {
            db.lookups.push(codes);
            return answer(ROWS.filter(item => codes.includes(item.code)));
          }
        })
      }),
      rpc: (_name: string, args: unknown) => {
        db.searches.push(args);
        return { select: () => answer(ROWS) };
      }
    }
  };
});
vi.mock('../icd10DefaultsService', () => ({
  loadTariffIcd10Defaults: async () => ({
    status: 'ready',
    defaults: new Map([['0190', 'J06.9'], ['0191', 'J06.9'], ['0192', 'I10']]),
    message: null
  })
}));

import { forgetIcd10Lookups, knownIcd10Codes, lookupIcd10Codes, practiceUsualIcd10Codes, searchIcd10Codes } from '../icd10Service';

beforeEach(() => {
  forgetIcd10Lookups();
  db.mode = 'ok';
  db.lookups = [];
  db.searches = [];
});

describe('reading the codes of a claim batch', () => {
  it('reads every code in one query, each once, tidied, leaving out what has no ICD-10 shape', async () => {
    const result = await lookupIcd10Codes(['j069', 'J06.9', 'I10', 'Z99.99', 'M8000/0', '']);
    expect(db.lookups).toEqual([['J06.9', 'I10', 'Z99.99']]);
    expect(result.status).toBe('ready');
    expect([...result.entries.keys()]).toEqual(['J06.9', 'I10']);
  });

  // The list changes once a year: a code read once (found or not) is not asked for again while the app is open
  it('does not ask again for codes it already knows, found or not', async () => {
    await lookupIcd10Codes(['J06.9', 'Z99.99']);
    const again = await lookupIcd10Codes(['Z99.99', 'J06.9']);
    expect(db.lookups).toHaveLength(1);
    expect([...again.entries.keys()]).toEqual(['J06.9']);
    expect([...(knownIcd10Codes(['J06.9', 'Z99.99']) ?? new Map()).keys()]).toEqual(['J06.9']);
    expect(knownIcd10Codes(['I10'])).toBeNull();
  });

  it('says the list is not set up when the table is missing, and stops asking', async () => {
    db.mode = 'missing';
    expect((await lookupIcd10Codes(['J06.9'])).status).toBe('not-set-up');
    expect((await searchIcd10Codes('j06')).status).toBe('not-set-up');
    expect(db.searches).toEqual([]);
  });

  it('never throws: a failed request reads as an error, so claim review checks the codes by shape', async () => {
    db.mode = 'throw';
    await expect(lookupIcd10Codes(['J06.9'])).resolves.toMatchObject({ status: 'error' });
    await expect(searchIcd10Codes('j06')).resolves.toMatchObject({ status: 'error', entries: [] });
  });
});

describe('the code search', () => {
  it('sends the tidied code and the words, and nothing for an empty box', async () => {
    const result = await searchIcd10Codes('a000');
    expect(db.searches).toEqual([{ p_code: 'A00.0', p_words: ['a000'], p_limit: 30 }]);
    expect(result.entries.map(entry => entry.code)).toEqual(['J06.9', 'I10']);
    await searchIcd10Codes('   ');
    expect(db.searches).toHaveLength(1);
  });

  it('remembers what it found, so the chosen code needs no second request', async () => {
    await searchIcd10Codes('hypertension');
    await lookupIcd10Codes(['I10']);
    expect(db.lookups).toEqual([]);
  });

  it("offers the practice's usual codes, the one on most tariff codes first", async () => {
    await expect(practiceUsualIcd10Codes('practice-1')).resolves.toEqual(['J06.9', 'I10']);
    await expect(practiceUsualIcd10Codes(null)).resolves.toEqual([]);
  });
});
