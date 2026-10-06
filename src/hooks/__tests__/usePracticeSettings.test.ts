import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Stand-in for the Supabase query builder: records filters, answers per table
const db = vi.hoisted(() => {
  type Op = [string, unknown[]];
  type Response = { data: unknown; error: unknown };
  const state = {
    calls: [] as Array<{ table: string; ops: Op[] }>,
    respond: (() => ({ data: null, error: null })) as (table: string) => Response,
  };
  const makeBuilder = (table: string) => {
    const entry = { table, ops: [] as Op[] };
    state.calls.push(entry);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'update']) {
      builder[method] = (...args: unknown[]) => {
        entry.ops.push([method, args]);
        return builder;
      };
    }
    builder.single = () => Promise.resolve(state.respond(table));
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(state.respond(table)).then(resolve, reject);
    return builder;
  };
  return { state, makeBuilder };
});

const auth = vi.hoisted(() => ({
  user: { id: 'user-1', practice_id: 'practice-1' } as { id: string; practice_id?: string } | null,
  selectedPracticeId: null as string | null,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (table: string) => db.makeBuilder(table) },
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => auth,
}));

import { usePracticeSettings } from '../usePracticeSettings';

const tables = (overrides: Record<string, unknown> = {}) => (table: string) => {
  const data: Record<string, unknown> = {
    practices: { id: 'practice-1', max_users: 5, max_patients: 1000 },
    practice_features: [{ feature_key: 'vitals_tracking', is_enabled: true }],
    practice_service_subscriptions: [],
    practice_sms_subscriptions: { id: 'sms-1', monthly_limit: 500, additional_sms_purchased: 0, current_usage: 120 },
    practice_email_subscriptions: null,
    ...overrides,
  };
  return { data: data[table] ?? null, error: data[table] === undefined ? { code: 'PGRST116' } : null };
};

describe('usePracticeSettings', () => {
  beforeEach(() => {
    db.state.calls = [];
    db.state.respond = tables();
    auth.user = { id: 'user-1', practice_id: 'practice-1' };
    auth.selectedPracticeId = null;
  });

  it("loads the signed-in user's practice, so features it enables (recording vitals) are not shown as locked", async () => {
    // Before, the hook read a `currentPractice` field the auth store never had and never loaded anything
    const { result } = renderHook(() => usePracticeSettings());

    await waitFor(() => expect(result.current.settings).not.toBeNull());
    expect(result.current.settings?.practiceId).toBe('practice-1');
    expect(result.current.checkFeatureAccess('vitals_tracking')).toBe(true);
    expect(result.current.settings?.smsRemaining).toBe(380);
    expect(db.state.calls.find((c) => c.table === 'practice_features')?.ops).toContainEqual(['eq', ['practice_id', 'practice-1']]);
  });

  it('uses the practice a super admin switched to', async () => {
    auth.selectedPracticeId = 'practice-2';
    const { result } = renderHook(() => usePracticeSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(db.state.calls.find((c) => c.table === 'practices')?.ops).toContainEqual(['eq', ['id', 'practice-2']]);
  });

  it('keeps a feature locked when the practice has not enabled it', async () => {
    db.state.respond = tables({ practice_features: [] });
    const { result } = renderHook(() => usePracticeSettings());

    await waitFor(() => expect(result.current.settings).not.toBeNull());
    expect(result.current.checkFeatureAccess('vitals_tracking')).toBe(false);
  });

  it('still loads when a subscribed plan has no features list, instead of failing and locking everything', async () => {
    db.state.respond = tables({
      practice_features: [],
      practice_service_subscriptions: [
        { id: 'sub-1', status: 'active', service_plan: { plan_type: 'feature', features: null } },
        { id: 'sub-2', status: 'active', service_plan: { plan_type: 'feature', features: ['lab_requests'] } },
      ],
    });
    const { result } = renderHook(() => usePracticeSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.checkFeatureAccess('lab_integration')).toBe(true);
    expect(result.current.checkFeatureAccess('vitals_tracking')).toBe(false);
  });

  it('loads nothing without a practice', async () => {
    auth.user = null;
    const { result } = renderHook(() => usePracticeSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings).toBeNull();
    expect(db.state.calls).toHaveLength(0);
  });
});
