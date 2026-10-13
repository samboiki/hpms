/**
 * Sign-ins and sign-outs in the access log (parity Q8): a staff sign-in and sign-out are recorded, the sign-out while
 * the session still exists (afterwards the call would be anonymous and refused), and neither ever waits on the log for
 * more than a moment. A patient app session records nothing. Invented ids only; nothing reaches Supabase.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mock } = vi.hoisted(() => ({
  mock: {
    order: [] as string[],
    rpcAnswers: true,
    profile: { id: 'staff-1', email: 'staff@example.test', full_name: 'Test Staff', role: 'receptionist', practice_id: 'practice-1', is_active: true }
  }
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: async () => ({ data: { user: { id: 'staff-1', email: 'staff@example.test', user_metadata: {} } }, error: null }),
      signOut: async () => {
        mock.order.push('session ended');
        return { error: null };
      }
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: mock.profile, error: null }) }) }) }),
    rpc: (name: string, args: { p_event: string; p_screen: string }) => {
      mock.order.push(`${name} ${args.p_event} ${args.p_screen}`);
      return mock.rpcAnswers ? Promise.resolve({ data: true, error: null }) : new Promise(() => undefined);
    }
  }
}));

import { useAuthStore } from '../authStore';
import { SIGN_OUT_WAIT_MS } from '../../services/recordAccessLog';

beforeEach(() => {
  mock.order = [];
  mock.rpcAnswers = true;
  useAuthStore.setState({ isAuthenticated: false, user: null, selectedPracticeId: null, sessionKind: null });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('sign-ins and sign-outs in the access log', () => {
  it('records a staff sign-in from the sign-in page', async () => {
    await expect(useAuthStore.getState().login('staff@example.test', 'not-a-real-password')).resolves.toBe(true);
    expect(mock.order).toEqual(['log_record_access signed_in sign_in']);
  });

  it('never makes signing in wait for the log, even when it does not answer', async () => {
    mock.rpcAnswers = false;
    await expect(useAuthStore.getState().login('staff@example.test', 'not-a-real-password')).resolves.toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('records a staff sign-out before the session ends (afterwards it could not be recorded)', async () => {
    useAuthStore.setState({ isAuthenticated: true, sessionKind: 'staff', user: { id: 'staff-1', email: '', name: 'Test Staff', role: 'receptionist' } });
    await useAuthStore.getState().logout();
    expect(mock.order).toEqual(['log_record_access signed_out app', 'session ended']);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('ends the session after a moment at most when the log does not answer, with the screen signed out at once', async () => {
    vi.useFakeTimers();
    mock.rpcAnswers = false;
    useAuthStore.setState({ isAuthenticated: true, sessionKind: 'staff', user: { id: 'staff-1', email: '', name: 'Test Staff', role: 'receptionist' } });
    const done = useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    await vi.advanceTimersByTimeAsync(SIGN_OUT_WAIT_MS);
    await done;
    expect(mock.order).toEqual(['log_record_access signed_out app', 'session ended']);
  });

  it('records nothing when a patient app session signs out (patients are not staff)', async () => {
    useAuthStore.setState({ sessionKind: 'patient' });
    await useAuthStore.getState().logout();
    expect(mock.order).toEqual(['session ended']);
  });
});
