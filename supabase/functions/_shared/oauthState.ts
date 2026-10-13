// Connecting a practice's Gmail account through exchange-oauth-code. The browser never handles the Google client
// secret or the account's tokens: it asks the function for the Google sign-in address and, when Google sends it back,
// hands over the one-time code with the "state" the function signed when the sign-in started.
//
// The state binds the sign-in to the staff member who started it, the practice and the return address, for 10
// minutes. Without it, anyone could send a practice's staff member a link that connects the sender's own Gmail account
// to that practice (and receive the practice's outgoing email). The state Google returns is untrusted until its
// signature checks out. Pure TypeScript (Web Crypto only, as in Deno and Node): unit tested with Vitest.
import { APP_ORIGINS } from './oauthRedirect.ts';
import { constantTimeEqual } from './smsReplyPayload.ts';

export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** What the Gmail connection asks Google for: send and draft email for the practice, and the account's address */
export const GMAIL_SCOPES: readonly string[] = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/userinfo.email'
];

/** The app's pages that finish a Google sign-in (each must be an "Authorized redirect URI" of the practice's app) */
export const OAUTH_RETURN_PATHS: readonly string[] = ['/settings', '/api/oauth/callback', '/oauth/universal-callback'];

export interface OAuthStateClaims {
  practiceId: string;
  /** The staff member who started the sign-in: only they may finish it */
  userId: string;
  /** The return address the sign-in started with: Google only accepts the code with the same one */
  redirectUri: string;
  /** Unix seconds */
  expiresAt: number;
  /** Random, so no two states are alike */
  nonce: string;
}

export type OAuthStateCheck =
  | { ok: true; claims: OAuthStateClaims }
  | { ok: false; reason: 'no_secret' | 'malformed' | 'bad_signature' | 'expired' };

// Signatures are only valid as Gmail connection states, never as anything else signed with the same key
const SIGNING_CONTEXT = 'onehealth.oauth-state.v1.';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STATE_LENGTH = 2048;

/** True for one of the app's own addresses that finish a Google sign-in, written exactly (no query or fragment). */
export function isAllowedOAuthRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return APP_ORIGINS.includes(url.origin) && OAUTH_RETURN_PATHS.includes(url.pathname) && value === `${url.origin}${url.pathname}`;
  } catch {
    return false;
  }
}

/**
 * Who may connect a practice's Gmail account: its administrators and doctors (the roles that manage the practice's
 * Google app and its credentials under row-level security), or OneHealth support.
 */
export function mayConnectPracticeAccount(staff: { role?: string | null; is_super_admin?: boolean | null } | null | undefined): boolean {
  return staff?.is_super_admin === true || staff?.role === 'admin' || staff?.role === 'doctor';
}

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
};

async function signPayload(payload: string, secret: string, subtle: SubtleCrypto): Promise<string> {
  const encoder = new TextEncoder();
  const key = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await subtle.sign('HMAC', key, encoder.encode(SIGNING_CONTEXT + payload))));
}

/** "<payload>.<signature>", both base64url: safe in a URL, readable by nobody but the signer's checks. */
export async function signOAuthState(
  claims: OAuthStateClaims,
  secret: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<string> {
  if (!secret) throw new Error('A signing secret is required');
  const body = { v: 1, p: claims.practiceId, u: claims.userId, r: claims.redirectUri, e: claims.expiresAt, n: claims.nonce };
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
  return `${payload}.${await signPayload(payload, secret, subtle)}`;
}

/** Accepts only a state this server signed, unchanged and unexpired; nothing in it is read before the signature checks. */
export async function verifyOAuthState(
  state: unknown,
  secret: string | null | undefined,
  nowSeconds: number,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<OAuthStateCheck> {
  if (!secret) return { ok: false, reason: 'no_secret' };
  if (typeof state !== 'string' || state.length > MAX_STATE_LENGTH) return { ok: false, reason: 'malformed' };
  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  const [payload, signature] = parts;
  if (!constantTimeEqual(signature, await signPayload(payload, secret, subtle))) return { ok: false, reason: 'bad_signature' };

  const bytes = fromBase64Url(payload);
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = bytes ? JSON.parse(new TextDecoder().decode(bytes)) : null;
    body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  const practiceId = body?.p;
  const userId = body?.u;
  const redirectUri = body?.r;
  const expiresAt = body?.e;
  const nonce = body?.n;
  if (
    body?.v !== 1 ||
    typeof practiceId !== 'string' || !UUID_PATTERN.test(practiceId) ||
    typeof userId !== 'string' || !UUID_PATTERN.test(userId) ||
    !isAllowedOAuthRedirectUri(redirectUri) ||
    typeof expiresAt !== 'number' || !Number.isInteger(expiresAt) ||
    typeof nonce !== 'string' || !nonce
  ) {
    return { ok: false, reason: 'malformed' };
  }
  if (nowSeconds > expiresAt) return { ok: false, reason: 'expired' };
  return { ok: true, claims: { practiceId, userId, redirectUri, expiresAt, nonce } };
}

/** What the person is told when a returned state is refused. */
export function stateRefusalMessage(reason: Exclude<OAuthStateCheck, { ok: true }>['reason']): string {
  if (reason === 'expired') return 'The Google sign-in took longer than 10 minutes. Please connect Gmail again.';
  if (reason === 'no_secret') return 'Gmail cannot be connected right now: the server is not set up. Please contact OneHealth support.';
  return 'This Google sign-in was not started from OneHealth, or was started before an update. Please connect Gmail again.';
}

/** The Google sign-in address: offline access with a fresh consent, so Google always returns a refresh token. */
export function googleAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GMAIL_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', input.state);
  return url.toString();
}

export type ConnectRequest =
  | { action: 'start'; practiceId: string; redirectUri: string }
  | { action: 'exchange'; code: string; state: string }
  | { action: 'invalid'; error: string };

/** The two requests exchange-oauth-code answers; anything else is refused before any database read. */
export function parseConnectRequest(body: unknown): ConnectRequest {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const text = (field: unknown): string => (typeof field === 'string' ? field.trim() : '');
  const provider = text(value.provider) || 'google';
  if (provider !== 'google') return { action: 'invalid', error: 'Only a Google (Gmail) account can be connected.' };
  if (value.action === 'start') {
    const practiceId = text(value.practice_id);
    const redirectUri = text(value.redirect_uri);
    if (!UUID_PATTERN.test(practiceId)) return { action: 'invalid', error: 'Choose the practice to connect Gmail to.' };
    if (!isAllowedOAuthRedirectUri(redirectUri)) {
      return { action: 'invalid', error: 'Google cannot send the sign-in back to this address. Connect Gmail from the OneHealth app.' };
    }
    return { action: 'start', practiceId, redirectUri };
  }
  if (value.action === 'exchange') {
    const code = text(value.code);
    const state = text(value.state);
    if (!code || !state) return { action: 'invalid', error: 'The Google sign-in answer is incomplete. Please connect Gmail again.' };
    return { action: 'exchange', code, state };
  }
  return { action: 'invalid', error: 'Unknown request.' };
}
