import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

// No database in unit tests
vi.mock('../../lib/supabase', () => ({ supabase: { from: fromMock, rpc: rpcMock } }));

import { SMS_REPLIES_FEATURE_KEY } from '../../../supabase/functions/_shared/smsMessagePolicy';
import {
  SUPPORT_SWITCHED_FEATURES,
  describeFeatureSwitchError,
  featureStatesFromRows,
  loadPracticeFeatureStates,
  setPracticeFeature,
} from '../practiceFeatureService';

/** A PostgREST query stand-in: every filter returns itself and awaiting it gives the result. */
function query(result: { data?: unknown; error?: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject);
  return { builder, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('support is offered exactly the switches the database accepts', () => {
  // A key the app offers but set_practice_feature refuses would be a switch that never saves; a key the database
  // accepts but the app lacks could only be switched with SQL again
  it('lists the same keys as set_practice_feature', () => {
    const sql = readFileSync('proposals/2026-10-08-practice-features-switch.sql', 'utf8');
    const known = /v_known constant text\[\] := ARRAY\[([^\]]*)\]/.exec(sql);
    expect(known).not.toBeNull();
    const keys = [...(known?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(keys).toEqual([...SUPPORT_SWITCHED_FEATURES]);
  });

  // The reminder sender, the confirmations and the welcome read this exact key before inviting a reply
  it('switches the key the SMS senders read', () => {
    expect(SUPPORT_SWITCHED_FEATURES).toContain(SMS_REPLIES_FEATURE_KEY);
    expect(SMS_REPLIES_FEATURE_KEY).toBe('sms_replies');
  });
});

describe('a practice is only shown as on when the senders would treat it as on', () => {
  // The senders invite replies only for is_enabled === true: anything else must read "Off", never a false "On"
  it('reads only a real true as on, and skips rows without a practice', () => {
    const states = featureStatesFromRows([
      { practice_id: 'p-on', is_enabled: true, updated_at: '2026-10-08T10:00:00Z' },
      { practice_id: 'p-off', is_enabled: false, updated_at: null },
      { practice_id: 'p-text', is_enabled: 'true' },
      { practice_id: null, is_enabled: true },
    ]);
    expect(states['p-on']).toEqual({ enabled: true, updatedAt: '2026-10-08T10:00:00Z' });
    expect(states['p-off']).toEqual({ enabled: false, updatedAt: null });
    expect(states['p-text']?.enabled).toBe(false);
    expect(Object.keys(states)).toHaveLength(3);
  });

  // A practice without a row has never been switched on, so it has no entry (the switch shows "Off")
  it('gives no state for a practice without a row, and survives no rows at all', () => {
    expect(featureStatesFromRows([{ practice_id: 'p-on', is_enabled: true }])['p-none']).toBeUndefined();
    expect(featureStatesFromRows(null)).toEqual({});
  });

  it('reads one feature for every practice in a single query', async () => {
    const read = query({ data: [{ practice_id: 'p-on', is_enabled: true, updated_at: null }] });
    fromMock.mockReturnValue(read.builder);
    const result = await loadPracticeFeatureStates(SMS_REPLIES_FEATURE_KEY);
    expect(fromMock).toHaveBeenCalledWith('practice_features');
    expect(read.calls).toContainEqual(['eq', ['feature_key', 'sms_replies']]);
    expect(result).toEqual({ ok: true, states: { 'p-on': { enabled: true, updatedAt: null } } });
  });

  // Unreadable switches are reported, not shown as "Off" (which would invite switching on what may be on already)
  it('reports a failed read instead of showing every practice as off', async () => {
    fromMock.mockReturnValue(query({ error: { message: 'permission denied' } }).builder);
    expect(await loadPracticeFeatureStates(SMS_REPLIES_FEATURE_KEY)).toEqual({
      ok: false,
      message: 'The switches could not be read: permission denied',
    });
  });
});

describe('switching goes through the database function, which decides who may', () => {
  it('sends the practice, the key and on or off, and returns the saved state', async () => {
    rpcMock.mockResolvedValue({
      data: { practice_id: 'p-1', feature_key: 'sms_replies', is_enabled: true, updated_at: '2026-10-08T12:00:00Z' },
      error: null,
    });
    const result = await setPracticeFeature('p-1', SMS_REPLIES_FEATURE_KEY, true);
    expect(rpcMock).toHaveBeenCalledWith('set_practice_feature', { p_practice_id: 'p-1', p_feature_key: 'sms_replies', p_enabled: true });
    expect(result).toEqual({ ok: true, state: { enabled: true, updatedAt: '2026-10-08T12:00:00Z' } });
  });

  // A practice administrator who reaches the screen is refused by the database: the screen must say why
  it('says that only OneHealth support may switch when the database refuses the caller', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only OneHealth support can switch practice features.' } });
    expect(await setPracticeFeature('p-1', SMS_REPLIES_FEATURE_KEY, true)).toEqual({
      ok: false,
      message: 'Not saved: only OneHealth support can change this.',
    });
  });

  it('never reports a save the database did not confirm', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const result = await setPracticeFeature('p-1', SMS_REPLIES_FEATURE_KEY, false);
    expect(result.ok).toBe(false);
  });
});

describe('refusals are said in words support can act on', () => {
  it('names a missing database update, a refused caller and a removed practice', () => {
    expect(describeFeatureSwitchError({ code: 'PGRST202', message: 'Could not find the function' })).toBe(
      'Not saved: this switch is not set up in the database yet.'
    );
    expect(describeFeatureSwitchError({ code: '42501', message: 'permission denied for function set_practice_feature' })).toBe(
      'Not saved: only OneHealth support can change this.'
    );
    expect(describeFeatureSwitchError({ code: 'P0002', message: 'This practice does not exist.' })).toBe(
      'Not saved: this practice no longer exists.'
    );
    expect(describeFeatureSwitchError({ code: '08006', message: 'connection lost' })).toBe('Not saved: connection lost');
    expect(describeFeatureSwitchError(null)).toBe('Not saved: please try again.');
  });
});
