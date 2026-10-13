// Where gmail-oauth-callback and universal-oauth-callback send the browser after connecting a Gmail account.
// The origin comes from the OAuth state, which the browser builds and anyone can forge, so only the app's own
// origins are used and anything else goes to the doctors' portal (no open redirect). Pure, unit tested with Vitest.

export const DEFAULT_APP_ORIGIN = 'https://app.onehealthsystems.com';

/** The doctors' portal, the admin portal and their local development ports */
export const APP_ORIGINS: readonly string[] = [
  DEFAULT_APP_ORIGIN,
  'https://admin.onehealthsystems.com',
  'http://localhost:5000',
  'http://localhost:4000'
];

export function safeRedirectOrigin(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_APP_ORIGIN;
  try {
    const origin = new URL(value.trim()).origin;
    return APP_ORIGINS.includes(origin) ? origin : DEFAULT_APP_ORIGIN;
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
}
