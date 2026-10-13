/**
 * Owner decision 13 Oct 2026: the Settings security block must be real (Supabase Auth's own two-step sign-in and
 * "sign out of all other devices"). These tests pin when a sign-in must ask for the code and what staff are told.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getAuthenticatorAssuranceLevel: vi.fn(),
  signOut: vi.fn()
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { mfa: { getAuthenticatorAssuranceLevel: auth.getAuthenticatorAssuranceLevel }, signOut: auth.signOut } }
}));

import { cleanCode, describeMfaError, qrImageSource, secondStepNeeded, signOutOtherDevices } from '../mfaService';

beforeEach(() => {
  auth.getAuthenticatorAssuranceLevel.mockReset();
  auth.signOut.mockReset();
});

describe('secondStepNeeded', () => {
  it('a password-only session of an account with two-step sign-in must still give the code', async () => {
    auth.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
    expect(await secondStepNeeded()).toBe(true);
  });

  it('no code is asked when the account has no authenticator app, or the code was already given', async () => {
    auth.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null });
    expect(await secondStepNeeded()).toBe(false);
    auth.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null });
    expect(await secondStepNeeded()).toBe(false);
  });
});

describe('signOutOtherDevices', () => {
  it('ends the other sessions only: this device stays signed in (scope others)', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    expect(await signOutOtherDevices()).toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('a failure is said in plain words', async () => {
    auth.signOut.mockResolvedValue({ error: { message: 'network down' } });
    const result = await signOutOtherDevices();
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toMatch(/could not be signed out/);
  });
});

describe('plain words and input', () => {
  it('a wrong or old code tells the person what to do, not the technical code', () => {
    expect(describeMfaError({ code: 'mfa_verification_failed' }, 'x')).toMatch(/newest 6-digit code/);
    expect(describeMfaError({ code: 'mfa_totp_enroll_not_enabled' }, 'x')).toMatch(/not switched on/);
    expect(describeMfaError({ code: 'something_else' }, 'fallback')).toBe('fallback');
  });

  it('keeps only the six digits a person typed or pasted', () => {
    expect(cleanCode(' 123 456 ')).toBe('123456');
    expect(cleanCode('123-4567')).toBe('123456');
  });

  it('shows the QR code as an image whether Supabase gives a data address or bare SVG', () => {
    expect(qrImageSource('data:image/svg+xml;utf-8,<svg/>')).toBe('data:image/svg+xml;utf-8,<svg/>');
    expect(qrImageSource('<svg/>')).toBe('data:image/svg+xml;utf-8,%3Csvg%2F%3E');
  });
});
