/**
 * Reading the fund master. Claims must keep working before the table exists or while it cannot be read (the app's own
 * rules apply), the table's rules must reach the claim checks once read, and the screen must show each fund with what
 * is in force, who last changed it, and the practice's own note and wait. Invented values only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: unknown };
interface Chain extends PromiseLike<Result> {
  select: () => Chain;
  eq: () => Chain;
  order: () => Chain;
  limit: () => Chain;
  in: () => Chain;
}

const db = vi.hoisted(() => ({ tables: {} as Record<string, Result>, reads: [] as string[] }));

vi.mock('../../lib/supabase', () => {
  const from = (table: string): Chain => {
    db.reads.push(table);
    const chain: Chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      in: () => chain,
      then: (resolve, reject) => Promise.resolve(db.tables[table] ?? { data: [], error: null }).then(resolve, reject)
    };
    return chain;
  };
  return { supabase: { from, rpc: vi.fn() } };
});

import { FUND_RULES, fundRulesInForce, getFundRule, setFundRulesInForce } from '../../utils/billing/fundRules';
import { loadFundMaster, loadFundRules, reloadFundRules } from '../fundMasterService';

const NOT_THERE = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.medical_aid_fund_rules' in the schema cache" } };
const nammedRow = (overrides: Record<string, unknown> = {}) => ({
  medical_aid_reference: 'NAMM', claim_deadline_days: 90, claim_deadline_months: null, deadline_confirmed: true, claims_portal_url: null,
  membership_digits: [11], membership_hint: null, dependant_code_required: true, payment_terms_days: 30, updated_by: null, updated_at: '2026-10-12T08:00:00Z',
  ...overrides
});

beforeEach(() => {
  db.tables = {
    medical_aid_providers: {
      data: [
        { id: 'p-namm', name: 'Nammed Medical Aid Fund', short_name: 'Nammed', email: null, medical_aid_reference: 'NAMM', logo_url: null },
        { id: 'p-none', name: 'Example Fund', short_name: null, email: null, medical_aid_reference: null, logo_url: null }
      ],
      error: null
    }
  };
  db.reads = [];
});
afterEach(() => {
  setFundRulesInForce(null);
  vi.restoreAllMocks();
});

describe('the fund rules for the claim checks', () => {
  it('keeps the app\'s own rules before the table exists, so claims work as before', async () => {
    db.tables.medical_aid_fund_rules = NOT_THERE;
    expect(await reloadFundRules()).toBe('not_set_up');
    expect(fundRulesInForce()).toBe(FUND_RULES);
  });

  it("puts the table's rules in force once read, and reads them once per session", async () => {
    db.tables.medical_aid_fund_rules = { data: [nammedRow()], error: null };
    expect(await reloadFundRules()).toBe('ready');
    expect(getFundRule('NAMM')).toMatchObject({ deadline: { days: 90 }, confirmed: true });
    const before = db.reads.length;
    expect(await loadFundRules()).toBe('ready');
    expect(db.reads.length).toBe(before);
  });

  // A dropped connection must not leave the session on old rules for good: the next claims screen reads them again
  it('keeps the app\'s rules after a failed read and tries again next time', async () => {
    db.tables.medical_aid_fund_rules = { data: null, error: { code: '08006', message: 'connection reset' } };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await reloadFundRules()).toBe('error');
    expect(fundRulesInForce()).toBe(FUND_RULES);
    db.tables.medical_aid_fund_rules = { data: [nammedRow()], error: null };
    expect(await loadFundRules()).toBe('ready');
    expect(getFundRule('NAMM').confirmed).toBe(true);
  });
});

describe('the Medical aid funds screen', () => {
  it('shows each fund with the rule in force, when a person last changed it, and the practice\'s note and wait', async () => {
    db.tables.medical_aid_fund_rules = { data: [nammedRow({ updated_by: 'support-1', updated_at: '2026-10-12T10:00:00Z' })], error: null };
    db.tables.practice_fund_notes = { data: [{ medical_aid_reference: 'NAMM', note: 'Call the claims desk first.', updated_at: '2026-10-12T11:00:00Z' }], error: null };
    db.tables.practice_settings = { data: [{ setting_value: { default: 45, byFund: {} } }], error: null };
    const data = await loadFundMaster('practice-1');
    expect(data.setUp).toBe(true);
    expect(data.practiceWaits).toEqual({ default: 45, byFund: {} });
    const [nammed, other] = data.funds;
    expect(nammed).toMatchObject({ code: 'NAMM', changedAt: '2026-10-12T10:00:00Z', note: { text: 'Call the claims desk first.' } });
    expect(nammed.rule).toMatchObject({ deadline: { days: 90 }, confirmed: true });
    // A fund without a claim code has no rule of its own
    expect(other).toMatchObject({ code: null, changedAt: null, note: null });
    expect(other.rule.key).toBe('DEFAULT');
  });

  it("shows the app's own rules, never changed, before the table exists", async () => {
    db.tables.medical_aid_fund_rules = NOT_THERE;
    db.tables.practice_fund_notes = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.practice_fund_notes' in the schema cache" } };
    const data = await loadFundMaster('practice-1');
    expect(data.setUp).toBe(false);
    expect(data.problems).toEqual([]);
    expect(data.practiceWaits).toBeNull();
    expect(data.funds[0]).toMatchObject({ code: 'NAMM', changedAt: null, note: null });
    expect(data.funds[0].rule).toMatchObject({ deadline: { days: 120 }, confirmed: false });
  });
});

describe('loadFundMaster when the funds cannot be read', () => {
  // The page puts "The medical aid funds could not be loaded:" in front of the reason: the service must not add its own
  // copy of that sentence, which staff read twice
  it('gives only the reason', async () => {
    db.tables.medical_aid_providers = { data: null, error: { message: 'timeout' } };
    await expect(loadFundMaster('practice-1')).rejects.toThrow(/^timeout$/);
  });
});
