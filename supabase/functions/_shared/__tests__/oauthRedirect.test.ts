import { describe, it, expect } from 'vitest';
import { DEFAULT_APP_ORIGIN, safeRedirectOrigin } from '../oauthRedirect';

// The Gmail OAuth callbacks redirect to an origin taken from the OAuth state, which anyone can build. Without this
// check a crafted Google sign-in link would end on a look-alike site that asks staff to "sign in again".
describe('safeRedirectOrigin', () => {
  it("keeps the app's own origins, so staff land back where they started", () => {
    expect(safeRedirectOrigin('https://app.onehealthsystems.com')).toBe('https://app.onehealthsystems.com');
    expect(safeRedirectOrigin('https://admin.onehealthsystems.com/')).toBe('https://admin.onehealthsystems.com');
    expect(safeRedirectOrigin('http://localhost:5000')).toBe('http://localhost:5000');
  });

  it('sends a forged state that names another site to the doctors portal instead', () => {
    expect(safeRedirectOrigin('https://evil.example')).toBe(DEFAULT_APP_ORIGIN);
  });

  it('refuses look-alike origins (extra domain, user-info trick, plain http, script URLs)', () => {
    expect(safeRedirectOrigin('https://app.onehealthsystems.com.evil.example')).toBe(DEFAULT_APP_ORIGIN);
    expect(safeRedirectOrigin('https://app.onehealthsystems.com@evil.example')).toBe(DEFAULT_APP_ORIGIN);
    expect(safeRedirectOrigin('http://app.onehealthsystems.com')).toBe(DEFAULT_APP_ORIGIN);
    expect(safeRedirectOrigin('javascript:alert(1)')).toBe(DEFAULT_APP_ORIGIN);
  });

  it('falls back to the doctors portal when the origin is missing or not a URL', () => {
    expect(safeRedirectOrigin(undefined)).toBe(DEFAULT_APP_ORIGIN);
    expect(safeRedirectOrigin(42)).toBe(DEFAULT_APP_ORIGIN);
    expect(safeRedirectOrigin('not a url')).toBe(DEFAULT_APP_ORIGIN);
  });
});
