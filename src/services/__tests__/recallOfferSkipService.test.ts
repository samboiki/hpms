/**
 * Skipped recall offers are kept in the database per visit and code (proposals/2026-10-13-recall-offer-skips.sql).
 * Before that file is applied the offer must work as before (nothing remembered, never an error on screen); any other
 * database problem is a real error the caller sees. Invented ids only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ select: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      db.from(table);
      return { select: () => ({ eq: (column: string, value: string) => db.select(column, value) }) };
    },
    rpc: (...args: unknown[]) => db.rpc(...args)
  }
}));

import { isRecallSkipsNotSetUp, loadSkippedRecallOffers, skipRecallOffers } from '../recallOfferSkipService';

const missingTable = { code: 'PGRST205', message: "Could not find the table 'public.visit_recall_offer_skips' in the schema cache" };
const missingFunction = { code: 'PGRST202', message: 'Could not find the function public.skip_visit_recall_offers(p_codes, p_practice_id, p_visit_id) in the schema cache' };

beforeEach(() => {
  db.select.mockReset();
  db.rpc.mockReset();
  db.from.mockReset();
});

describe('skipped recall offers', () => {
  it("reads the visit's skipped codes, upper case", async () => {
    db.select.mockResolvedValue({ data: [{ code: '8159' }, { code: ' 0190a ' }], error: null });
    expect(await loadSkippedRecallOffers('visit-1')).toEqual(new Set(['8159', '0190A']));
    expect(db.from).toHaveBeenCalledWith('visit_recall_offer_skips');
    expect(db.select).toHaveBeenCalledWith('visit_id', 'visit-1');
  });

  it('remembers a skip through the database function, for the visit and its codes', async () => {
    db.rpc.mockResolvedValue({ data: 1, error: null });
    expect(await skipRecallOffers('practice-1', 'visit-1', ['8159'])).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith('skip_visit_recall_offers', { p_practice_id: 'practice-1', p_visit_id: 'visit-1', p_codes: ['8159'] });
  });

  // Not set up yet: nothing is remembered and the offer simply works as before
  it('reads none and keeps nothing before the database has them', async () => {
    db.select.mockResolvedValue({ data: null, error: missingTable });
    db.rpc.mockResolvedValue({ data: null, error: missingFunction });
    expect(await loadSkippedRecallOffers('visit-1')).toEqual(new Set());
    expect(await skipRecallOffers('practice-1', 'visit-1', ['8159'])).toBe(false);
  });

  // Another practice's visit, or a missing table of something else, is a real error, never read as "not set up"
  it('passes every other error on', async () => {
    db.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'This visit is not one of the practice\'s.' } });
    await expect(skipRecallOffers('practice-1', 'visit-9', ['8159'])).rejects.toThrow("This visit is not one of the practice's.");
    expect(isRecallSkipsNotSetUp({ code: 'PGRST205', message: "Could not find the table 'public.patient_recalls' in the schema cache" })).toBe(false);
    expect(isRecallSkipsNotSetUp({ code: '42P01', message: 'relation "public.visit_recall_offer_skips" does not exist' })).toBe(true);
  });
});
