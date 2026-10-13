/**
 * Leave carry-over at the start of a year. The database works out the balance as entitled + carried over - used, so
 * carried days belong in carried_over_days only: adding them to entitled_days as well gave staff the carried days
 * twice (15 days a year + 5 carried showed 25 days to take).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
const mocks = vi.hoisted(() => ({
  previous: null as Row | null,
  existing: null as Row | null,
  writes: [] as Array<{ table: string; kind: string; values: Row }>
}));

vi.mock('../../lib/supabase', () => {
  const builder = (table: string) => {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (column: string, value: unknown) => {
      filters[column] = value;
      return chain;
    };
    chain.update = (values: Row) => {
      mocks.writes.push({ table, kind: 'update', values });
      return chain;
    };
    chain.insert = (values: Row) => {
      mocks.writes.push({ table, kind: 'insert', values });
      return Promise.resolve({ error: null });
    };
    chain.single = () => {
      const row = filters.year === 2025 ? mocks.previous : mocks.existing;
      return Promise.resolve(row ? { data: row, error: null } : { data: null, error: { code: 'PGRST116' } });
    };
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      const data =
        table === 'leave_types'
          ? [{ id: 'type-1', name: 'Annual Leave', days_per_year: 15, carryover_allowed: true, max_carryover_days: 5 }]
          : table === 'users'
            ? [{ id: 'staff-1' }]
            : null;
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return chain;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});

import { PayrollService } from '../payrollService';

beforeEach(() => {
  mocks.previous = { entitled_days: 15, used_days: 7 };
  mocks.existing = null;
  mocks.writes = [];
});

describe('leave carry-over', () => {
  it('starts the new year with the yearly days as entitlement and the carried days kept apart', async () => {
    await PayrollService.validateAndProcessCarryover('practice-1', 2025, 2026);
    const balance = mocks.writes.find(write => write.table === 'leave_balances' && write.kind === 'insert');
    // 8 days left, at most 5 carried
    expect(balance?.values).toMatchObject({ year: 2026, entitled_days: 15, carried_over_days: 5, used_days: 0 });
  });

  it('adds the carried days to an existing new-year balance without counting them twice', async () => {
    mocks.existing = { id: 'balance-2026', entitled_days: 15, carried_over_days: 0, used_days: 2 };
    await PayrollService.validateAndProcessCarryover('practice-1', 2025, 2026);
    const balance = mocks.writes.find(write => write.table === 'leave_balances' && write.kind === 'update');
    expect(balance?.values).toMatchObject({ entitled_days: 15, carried_over_days: 5 });
  });
});
