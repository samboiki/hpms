import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  select: { data: null as unknown, error: null as null | { code?: string; message: string } },
  rpc: { error: null as null | { code?: string; message: string } },
  rpcCalls: [] as Array<[string, Record<string, unknown>]>
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => Promise.resolve(db.select) }) }),
    rpc: (name: string, args: Record<string, unknown>) => {
      db.rpcCalls.push([name, args]);
      return Promise.resolve(db.rpc);
    }
  }
}));

import { loadTariffIcd10Defaults, saveTariffIcd10Default } from '../icd10DefaultsService';

beforeEach(() => {
  db.select = { data: [], error: null };
  db.rpc = { error: null };
  db.rpcCalls = [];
});

// Parity E8: billing reads the practice's usual codes on every visit; it must keep working before the database update
// and when they cannot be read, falling back to the built-in suggestions
describe("loading a practice's usual ICD-10 codes", () => {
  it('reads them into a map by tariff code', async () => {
    db.select = { data: [{ tariff_code: '0190', icd10_code: 'J06.9' }], error: null };
    const result = await loadTariffIcd10Defaults('practice-1');
    expect(result.status).toBe('ready');
    expect([...result.defaults.entries()]).toEqual([['0190', 'J06.9']]);
  });

  it('says "not set up" when the table does not exist yet, instead of failing', async () => {
    db.select = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.tariff_icd10_defaults' in the schema cache" } };
    await expect(loadTariffIcd10Defaults('practice-1')).resolves.toMatchObject({ status: 'not-set-up', defaults: new Map() });
  });

  it('reports other errors in plain words without throwing', async () => {
    db.select = { data: null, error: { message: 'network down' } };
    const result = await loadTariffIcd10Defaults('practice-1');
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/could not be read: network down/);
  });
});

// Only the database function may change the codes (it checks the administrator's role); the app sends them tidied
describe("saving a practice's usual ICD-10 code", () => {
  it('sends the tariff code and the ICD-10 code tidied, or null to clear it', async () => {
    await saveTariffIcd10Default('practice-1', ' 0190 ', 'j069');
    await saveTariffIcd10Default('practice-1', '0190', '  ');
    expect(db.rpcCalls).toEqual([
      ['set_tariff_icd10_default', { p_practice_id: 'practice-1', p_tariff_code: '0190', p_icd10_code: 'J06.9' }],
      ['set_tariff_icd10_default', { p_practice_id: 'practice-1', p_tariff_code: '0190', p_icd10_code: null }]
    ]);
  });

  it("passes on the database's refusal in its own words", async () => {
    db.rpc = { error: { code: '42501', message: 'Only the practice administrator can change the usual ICD-10 codes.' } };
    await expect(saveTariffIcd10Default('practice-1', '0190', 'J06.9')).rejects.toThrow('Only the practice administrator');
  });
});
