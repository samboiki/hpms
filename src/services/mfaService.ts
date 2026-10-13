import { supabase } from '../lib/supabase';

/**
 * Two-step sign-in with an authenticator app (Supabase Auth's built-in TOTP), and signing out other devices.
 *
 * Owner decision 13 Oct 2026: the Settings security block must be real. Staff turn on two-step sign-in in
 * Settings > Account > Security (scan a QR code, type a code to confirm); from then on signing in asks for the
 * 6-digit code from their app after the password. Nothing here is logged: the secret and QR code stay on screen.
 */

export interface TotpFactor {
  id: string;
  name: string;
  createdAt: string;
}

export type Outcome<T = undefined> = ({ ok: true } & (T extends undefined ? unknown : { value: T })) | { ok: false; message: string };

const failure = (message: string): { ok: false; message: string } => ({ ok: false, message });

/** The plain sentence for an Auth error (its code when it has one; the technical text goes to the console) */
export function describeMfaError(error: unknown, fallback: string): string {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  switch (code) {
    case 'mfa_verification_failed':
    case 'mfa_verification_rejected':
    case 'mfa_challenge_expired':
      return 'That code is not right or has run out. Type the newest 6-digit code from your authenticator app.';
    case 'mfa_totp_enroll_not_enabled':
    case 'mfa_totp_verify_not_enabled':
      return 'Two-step sign-in is not switched on for OneHealth yet. Please ask OneHealth support.';
    case 'insufficient_aal':
      return 'For your safety, sign out and sign in again with your code before removing two-step sign-in.';
    case 'over_request_rate_limit':
      return 'Too many tries. Please wait a minute and try again.';
    default:
      return fallback;
  }
}

/** Keeps the digits a person typed (spaces and dashes from copying are dropped) */
export function cleanCode(text: string): string {
  return text.replace(/\D/g, '').slice(0, 6);
}

/** A QR code from Supabase as an image address (older versions give bare SVG markup) */
export function qrImageSource(qrCode: string): string {
  return qrCode.startsWith('data:') ? qrCode : `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
}

/** True when this session signed in with a password only and the account has two-step sign-in turned on */
export async function secondStepNeeded(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
  } catch (error) {
    console.error('Two-step sign-in level could not be read', error);
    return false;
  }
}

/** The person's confirmed authenticator apps */
export async function listTotpFactors(): Promise<Outcome<TotpFactor[]>> {
  let listed: Awaited<ReturnType<typeof supabase.auth.mfa.listFactors>> | null = null;
  try {
    listed = await supabase.auth.mfa.listFactors();
  } catch (caught) {
    console.error('Two-step sign-in factors could not be listed', caught);
  }
  const data = listed?.data ?? null;
  const error = listed?.error ?? null;
  if (error || !data) {
    console.error('Two-step sign-in factors could not be listed', error);
    return failure(describeMfaError(error, 'Your two-step sign-in could not be checked just now. Please try again.'));
  }
  return {
    ok: true,
    value: data.totp.map(factor => ({ id: factor.id, name: factor.friendly_name || 'Authenticator app', createdAt: factor.created_at }))
  };
}

/** Starts adding an authenticator app: the QR code to scan and the key to type in by hand */
export async function startTotpEnrolment(): Promise<Outcome<{ factorId: string; qrCode: string; secret: string }>> {
  // An earlier attempt that was never confirmed would block a new one: remove it first
  const listed = await supabase.auth.mfa.listFactors();
  const leftovers = (listed.data?.all ?? []).filter(factor => factor.factor_type === 'totp' && factor.status === 'unverified');
  for (const factor of leftovers) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator app ${new Date().toISOString().slice(0, 16)}` });
  if (error || !data) {
    console.error('Two-step sign-in could not be started', error?.code ?? error);
    return failure(describeMfaError(error, 'Two-step sign-in could not be started just now. Please try again.'));
  }
  return { ok: true, value: { factorId: data.id, qrCode: qrImageSource(data.totp.qr_code), secret: data.totp.secret } };
}

/** Confirms an authenticator app (when adding it) or the second step of a sign-in, with a code from the app */
export async function verifyCode(factorId: string, code: string): Promise<Outcome> {
  const clean = cleanCode(code);
  if (clean.length !== 6) return failure('Type the 6-digit code from your authenticator app.');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
  if (error) {
    console.error('Two-step code was not accepted', error.code ?? error.message);
    return failure(describeMfaError(error, 'The code could not be checked just now. Please try again.'));
  }
  return { ok: true };
}

/** The second step of a sign-in: checks the code against the person's (first) authenticator app */
export async function verifySignInCode(code: string): Promise<Outcome> {
  const factors = await listTotpFactors();
  if (!factors.ok) return factors;
  const [factor] = factors.value;
  if (!factor) return failure('No authenticator app is linked to this account. Please sign in again.');
  return verifyCode(factor.id, code);
}

/** Removes an authenticator app (two-step sign-in is off once none is left) */
export async function removeTotp(factorId: string): Promise<Outcome> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    console.error('Two-step sign-in could not be removed', error.code ?? error.message);
    return failure(describeMfaError(error, 'Two-step sign-in could not be turned off just now. Please try again.'));
  }
  // The session still carries the old level until it is refreshed
  await supabase.auth.refreshSession();
  return { ok: true };
}

/** Ends every other session of this person (other computers and phones); this one stays signed in */
export async function signOutOtherDevices(): Promise<Outcome> {
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) {
    console.error('Other devices could not be signed out', error.message);
    return failure('Your other devices could not be signed out just now. Please try again.');
  }
  return { ok: true };
}
