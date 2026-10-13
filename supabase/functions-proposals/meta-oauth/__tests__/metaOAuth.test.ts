/**
 * Owner decision 13 Oct 2026: practices connect their OWN Facebook pages and Instagram business accounts. The signed
 * state stops anyone from connecting their own page to another practice; page tokens never leave the server.
 */
import { describe, expect, it } from 'vitest';
import {
  connectionsFromPages,
  mayManageMetaConnections,
  metaAppConfig,
  metaAuthorizationUrl,
  parseMetaRequest,
  settingsReturnUrl,
  signMetaState,
  verifyMetaState
} from '../metaOAuth';

const PRACTICE = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const SECRET = 'test-signing-secret';
const claims = { practiceId: PRACTICE, userId: USER, expiresAt: 2_000, nonce: 'n1' };

describe('signed state', () => {
  it('a state this server signed comes back with the practice and person who started it', async () => {
    const state = await signMetaState(claims, SECRET);
    expect(await verifyMetaState(state, SECRET, 1_000)).toEqual({ ok: true, claims });
  });

  it('a changed state (someone swapping in another practice) is refused', async () => {
    const state = await signMetaState(claims, SECRET);
    const other = await signMetaState({ ...claims, practiceId: '33333333-3333-4333-8333-333333333333' }, SECRET);
    const forged = `${other.split('.')[0]}.${state.split('.')[1]}`;
    expect(await verifyMetaState(forged, SECRET, 1_000)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('an old state (over 10 minutes) and a missing secret are refused', async () => {
    const state = await signMetaState(claims, SECRET);
    expect(await verifyMetaState(state, SECRET, 2_001)).toEqual({ ok: false, reason: 'expired' });
    expect(await verifyMetaState(state, '', 1_000)).toEqual({ ok: false, reason: 'no_secret' });
  });
});

describe('app settings', () => {
  it('without the Meta app keys the app says "not set up yet" (no config)', () => {
    expect(metaAppConfig(() => undefined)).toBeNull();
  });

  it('the sign-in address uses the configuration id when there is one, else asks for the page and Instagram scopes', () => {
    const env: Record<string, string> = { META_APP_ID: '123', META_APP_SECRET: 's', META_REDIRECT_URI: 'https://example.supabase.co/functions/v1/meta-oauth' };
    const plain = metaAppConfig((name) => env[name]);
    const withConfig = metaAppConfig((name) => ({ ...env, META_CONFIG_ID: '999' } as Record<string, string>)[name]);
    const url = new URL(metaAuthorizationUrl(plain!, 'state-1'));
    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.searchParams.get('scope')).toContain('pages_manage_posts');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.toString()).not.toContain('META_APP_SECRET');
    expect(new URL(metaAuthorizationUrl(withConfig!, 's')).searchParams.get('config_id')).toBe('999');
  });
});

describe('requests and access', () => {
  it('only administrators, doctors and support connect or remove pages (as for Gmail)', () => {
    expect(mayManageMetaConnections({ role: 'admin' })).toBe(true);
    expect(mayManageMetaConnections({ role: 'doctor' })).toBe(true);
    expect(mayManageMetaConnections({ role: 'receptionist' })).toBe(false);
    expect(mayManageMetaConnections({ role: 'nurse', is_super_admin: true })).toBe(true);
  });

  it('refuses unknown requests before any database read', () => {
    expect(parseMetaRequest({ action: 'status' })).toEqual({ action: 'status' });
    expect(parseMetaRequest({ action: 'start', practiceId: 'not-a-uuid' }).action).toBe('invalid');
    expect(parseMetaRequest({ action: 'disconnect', practiceId: PRACTICE, connectionId: 'x' }).action).toBe('invalid');
    expect(parseMetaRequest({ action: 'drop' , practiceId: PRACTICE }).action).toBe('invalid');
  });
});

describe('connectionsFromPages', () => {
  it('one row per page, and one per Instagram business account linked to a page (posting with the page token)', () => {
    const rows = connectionsFromPages({
      data: [
        { id: 'p1', name: 'Example Practice', access_token: 'tok1', instagram_business_account: { id: 'ig1', username: 'examplepractice' } },
        { id: 'p2', name: 'Second page', access_token: 'tok2' },
        { id: 'p3', name: 'No token' }
      ]
    });
    expect(rows.map((row) => [row.platform, row.external_id, row.display_name, row.page_id])).toEqual([
      ['facebook_page', 'p1', 'Example Practice', 'p1'],
      ['instagram_business', 'ig1', '@examplepractice', 'p1'],
      ['facebook_page', 'p2', 'Second page', 'p2']
    ]);
  });
});

describe('settingsReturnUrl', () => {
  it('sends the browser back to Settings > Social on the app with the outcome', () => {
    expect(settingsReturnUrl('https://app.onehealthsystems.com', 'connected', 2))
      .toBe('https://app.onehealthsystems.com/settings?tab=social&meta=connected&count=2');
  });
});
