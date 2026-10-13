// @vitest-environment node
// Web Crypto (crypto.subtle) as in Deno; jsdom does not provide it.
import { describe, expect, it } from 'vitest';
import {
  GMAIL_SCOPES,
  OAUTH_STATE_TTL_SECONDS,
  googleAuthorizationUrl,
  isAllowedOAuthRedirectUri,
  mayConnectPracticeAccount,
  parseConnectRequest,
  signOAuthState,
  stateRefusalMessage,
  verifyOAuthState,
  type OAuthStateClaims
} from '../oauthState';

// Invented values only
const SECRET = 'test-signing-secret-for-unit-tests-only-0123456789';
const NOW = 1_791_460_000;
const CLAIMS: OAuthStateClaims = {
  practiceId: '11111111-2222-4333-8444-555555555555',
  userId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  redirectUri: 'https://app.onehealthsystems.com/settings',
  expiresAt: NOW + OAUTH_STATE_TTL_SECONDS,
  nonce: 'nonce-1'
};

const base64Url = (text: string) => Buffer.from(text, 'utf8').toString('base64url');
const decodePayload = (state: string) => JSON.parse(Buffer.from(state.split('.')[0], 'base64url').toString('utf8'));

describe('a Gmail sign-in can only be finished as it was started', () => {
  it('accepts the state it signed, with the practice, person and return address', async () => {
    const state = await signOAuthState(CLAIMS, SECRET);
    expect(state).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(await verifyOAuthState(state, SECRET, NOW)).toEqual({ ok: true, claims: CLAIMS });
  });

  // Whoever changes the practice in a copied state would connect their own Gmail account to another practice
  it('refuses a state whose practice or person was changed', async () => {
    const state = await signOAuthState(CLAIMS, SECRET);
    const signature = state.split('.')[1];
    const otherPractice = { ...decodePayload(state), p: '99999999-2222-4333-8444-555555555555' };
    const otherPerson = { ...decodePayload(state), u: '99999999-bbbb-4ccc-8ddd-eeeeeeeeeeee' };
    for (const body of [otherPractice, otherPerson]) {
      expect(await verifyOAuthState(`${base64Url(JSON.stringify(body))}.${signature}`, SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    }
  });

  it('refuses a state signed with another key', async () => {
    const state = await signOAuthState(CLAIMS, 'a-different-secret-for-unit-tests-only');
    expect(await verifyOAuthState(state, SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  // A sign-in link left in a browser history or an email must stop working
  it('refuses a state after 10 minutes', async () => {
    const state = await signOAuthState(CLAIMS, SECRET);
    expect((await verifyOAuthState(state, SECRET, NOW + OAUTH_STATE_TTL_SECONDS)).ok).toBe(true);
    expect(await verifyOAuthState(state, SECRET, NOW + OAUTH_STATE_TTL_SECONDS + 1)).toEqual({ ok: false, reason: 'expired' });
  });

  // The browser used to send base64 JSON anyone could write ({ practice_id, redirect_origin }): never accepted again
  it('refuses the old unsigned state and anything else that is not a state', async () => {
    const oldState = Buffer.from(JSON.stringify({ practice_id: CLAIMS.practiceId, redirect_origin: 'https://app.onehealthsystems.com' })).toString('base64');
    for (const value of [oldState, '', 'abc', 'a.b.c', '.x', null, 42, 'x'.repeat(5000)]) {
      expect(await verifyOAuthState(value, SECRET, NOW)).toEqual({ ok: false, reason: expect.stringMatching(/malformed|bad_signature/) });
    }
  });

  // A signed state that carries a foreign return address still cannot send Google's code elsewhere
  it('refuses a correctly signed state with a return address outside the app', async () => {
    const state = await signOAuthState({ ...CLAIMS, redirectUri: 'https://evil.example/settings' }, SECRET);
    expect(await verifyOAuthState(state, SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('refuses everything when the server has no signing secret', async () => {
    const state = await signOAuthState(CLAIMS, SECRET);
    expect(await verifyOAuthState(state, '', NOW)).toEqual({ ok: false, reason: 'no_secret' });
    await expect(signOAuthState(CLAIMS, '')).rejects.toThrow();
  });

  it('tells the person what to do in plain words', () => {
    expect(stateRefusalMessage('expired')).toBe('The Google sign-in took longer than 10 minutes. Please connect Gmail again.');
    expect(stateRefusalMessage('bad_signature')).toMatch(/not started from OneHealth/);
  });
});

describe('Google may only send the sign-in back to the app itself', () => {
  it("accepts the app's own pages that finish the sign-in", () => {
    for (const uri of [
      'https://app.onehealthsystems.com/settings',
      'https://admin.onehealthsystems.com/settings',
      'http://localhost:5000/api/oauth/callback',
      'https://app.onehealthsystems.com/oauth/universal-callback'
    ]) {
      expect(isAllowedOAuthRedirectUri(uri)).toBe(true);
    }
  });

  // Another site at the end of the sign-in would receive Google's code for the practice's account
  it('refuses other sites, other pages, look-alikes and extra parts', () => {
    for (const uri of [
      'https://evil.example/settings',
      'https://app.onehealthsystems.com.evil.example/settings',
      'http://app.onehealthsystems.com/settings',
      'https://app.onehealthsystems.com/patients',
      'https://app.onehealthsystems.com/settings/',
      'https://app.onehealthsystems.com/settings?tab=social',
      'https://app.onehealthsystems.com/settings#social',
      ' https://app.onehealthsystems.com/settings',
      'not a url',
      null
    ]) {
      expect(isAllowedOAuthRedirectUri(uri)).toBe(false);
    }
  });
});

describe('who may connect the practice Gmail', () => {
  // Administrators and doctors manage the practice's Google app under row-level security; anyone else could attach
  // their own Gmail account as the address the practice's emails come from
  it('administrators, doctors and OneHealth support, not reception or nurses', () => {
    expect(mayConnectPracticeAccount({ role: 'admin' })).toBe(true);
    expect(mayConnectPracticeAccount({ role: 'doctor' })).toBe(true);
    expect(mayConnectPracticeAccount({ role: 'receptionist', is_super_admin: true })).toBe(true);
    expect(mayConnectPracticeAccount({ role: 'receptionist' })).toBe(false);
    expect(mayConnectPracticeAccount({ role: 'nurse', is_super_admin: false })).toBe(false);
    expect(mayConnectPracticeAccount(null)).toBe(false);
  });
});

describe('the Google sign-in address', () => {
  it('asks for offline access with a fresh consent, so Google returns a refresh token, and only the Gmail scopes', () => {
    const url = new URL(googleAuthorizationUrl({ clientId: 'client-1.apps.example', redirectUri: CLAIMS.redirectUri, state: 'signed.state' }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('scope')).toBe(GMAIL_SCOPES.join(' '));
    expect(url.searchParams.get('redirect_uri')).toBe(CLAIMS.redirectUri);
    expect(url.searchParams.get('state')).toBe('signed.state');
  });

  // The client secret stays in the database and the function: the address the browser follows never holds it
  it('never carries a client secret', () => {
    const url = new URL(googleAuthorizationUrl({ clientId: 'client-1', redirectUri: CLAIMS.redirectUri, state: 's.t' }));
    expect([...url.searchParams.keys()].sort()).toEqual(['access_type', 'client_id', 'prompt', 'redirect_uri', 'response_type', 'scope', 'state']);
  });
});

describe('the requests exchange-oauth-code answers', () => {
  it('reads a start and an exchange request', () => {
    expect(parseConnectRequest({ action: 'start', provider: 'google', practice_id: CLAIMS.practiceId, redirect_uri: CLAIMS.redirectUri })).toEqual({
      action: 'start',
      practiceId: CLAIMS.practiceId,
      redirectUri: CLAIMS.redirectUri
    });
    expect(parseConnectRequest({ action: 'exchange', code: '4/abc', state: 'p.s' })).toEqual({ action: 'exchange', code: '4/abc', state: 'p.s' });
  });

  // The old browser request carried the practice and no signed state: it is refused, not exchanged
  it('refuses the old request, other providers, missing parts and foreign return addresses', () => {
    const refused = [
      { code: '4/abc', practice_id: CLAIMS.practiceId, provider: 'google', redirect_uri: CLAIMS.redirectUri },
      { action: 'start', provider: 'facebook', practice_id: CLAIMS.practiceId, redirect_uri: CLAIMS.redirectUri },
      { action: 'start', practice_id: '', redirect_uri: CLAIMS.redirectUri },
      { action: 'start', practice_id: 'not-a-practice-id', redirect_uri: CLAIMS.redirectUri },
      { action: 'start', practice_id: CLAIMS.practiceId, redirect_uri: 'https://evil.example/settings' },
      { action: 'exchange', code: '4/abc' },
      null
    ];
    for (const body of refused) expect(parseConnectRequest(body).action).toBe('invalid');
  });
});
