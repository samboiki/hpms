import { beforeEach, describe, expect, it, vi } from 'vitest';

// The store restores a session by reading the staff profile (public.users). These tests replace the Supabase
// client so they can play a patient's cell-number login and a staff login.
const auth = vi.hoisted(() => ({
  session: null as unknown,
  profile: { data: null, error: { code: 'PGRST116', message: 'no rows' } } as { data: unknown; error: unknown },
  signOut: vi.fn(async () => ({ error: null })),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: auth.session }, error: null }),
      signOut: auth.signOut,
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => auth.profile }) }) }),
  },
}));

import { useAuthStore } from '../../stores/authStore';

const NO_PROFILE = { data: null, error: { code: 'PGRST116', message: 'no rows' } };

beforeEach(() => {
  useAuthStore.setState({ isAuthenticated: false, user: null, selectedPracticeId: null, sessionKind: null });
  auth.profile = NO_PROFILE;
  auth.signOut.mockClear();
});

describe('restoring a session: staff app or patient app', () => {
  it('a patient\'s cell-number login never becomes a staff user, so the staff app cannot render for it', async () => {
    // Before this change the fallback turned any login without a profile into a "doctor"
    auth.session = {
      user: { id: 'patient-login', email: '', phone: '264811234567', app_metadata: { provider: 'phone' }, user_metadata: {} },
    };
    await expect(useAuthStore.getState().login('', '')).resolves.toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, user: null, sessionKind: 'patient' });
  });

  it('a staff login with a profile is restored exactly as before', async () => {
    auth.session = { user: { id: 'dr-1', email: 'dr@clinic.na', app_metadata: { provider: 'email' }, user_metadata: {} } };
    auth.profile = {
      data: { id: 'dr-1', email: 'dr@clinic.na', full_name: 'Dr N. Amutenya', role: 'doctor', practice_id: 'practice-1', is_active: true },
      error: null,
    };
    await expect(useAuthStore.getState().login('dr@clinic.na', '')).resolves.toBe(true);
    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      sessionKind: 'staff',
      user: { id: 'dr-1', name: 'Dr N. Amutenya', role: 'doctor', practice_id: 'practice-1' },
    });
  });

  it('an email login whose profile cannot be read keeps the existing staff fallback', async () => {
    auth.session = {
      user: { id: 'nurse-1', email: 'nurse@clinic.na', app_metadata: { provider: 'email' }, user_metadata: { role: 'nurse' } },
    };
    await expect(useAuthStore.getState().login('nurse@clinic.na', '')).resolves.toBe(true);
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, sessionKind: 'staff', user: { role: 'nurse' } });
  });

  it('signing out ends a patient session as well', async () => {
    useAuthStore.setState({ sessionKind: 'patient' });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().sessionKind).toBeNull();
    expect(auth.signOut).toHaveBeenCalled();
  });
});
