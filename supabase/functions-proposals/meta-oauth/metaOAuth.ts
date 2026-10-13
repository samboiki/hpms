// Connecting a practice's OWN Facebook pages and Instagram business accounts (owner decision 13 Oct 2026). Pure
// TypeScript (Web Crypto only, as in Deno and Node): unit tested with Vitest. Used by ./index.ts.
//
// The browser never sees the Meta app secret or any page token. Settings asks meta-oauth for the Facebook sign-in
// address; Facebook sends the person back to meta-oauth itself (the redirect URI registered on the Meta app), which
// checks the signed state, swaps the one-time code for tokens and stores one row per page (and per Instagram business
// account linked to a page) in practice_meta_connections, then sends the browser back to Settings > Social.
//
// The state binds the sign-in to the staff member who started it and their practice, for 10 minutes: without it,
// anyone could send a practice's staff member a link that connects the sender's own page to that practice.
import { constantTimeEqual } from '../../functions/_shared/smsReplyPayload.ts';

export const META_STATE_TTL_SECONDS = 10 * 60;
export const DEFAULT_GRAPH_VERSION = 'v21.0';

/** What the practice is asked to allow: list its pages, post to them, and post to the linked Instagram account */
export const META_SCOPES: readonly string[] = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management'
];

const SIGNING_CONTEXT = 'onehealth.meta-oauth-state.v1.';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STATE_LENGTH = 2048;

export interface MetaStateClaims {
  practiceId: string;
  userId: string;
  /** Unix seconds */
  expiresAt: number;
  nonce: string;
}

export type MetaStateCheck =
  | { ok: true; claims: MetaStateClaims }
  | { ok: false; reason: 'no_secret' | 'malformed' | 'bad_signature' | 'expired' };

/** The Meta app's settings (Supabase secrets); null when any is missing, so the app can say "not set up yet" */
export interface MetaAppConfig {
  appId: string;
  appSecret: string;
  /** This function's own address, registered as a "Valid OAuth Redirect URI" on the Meta app */
  redirectUri: string;
  graphVersion: string;
  /** Facebook Login for Business configuration id; without it the scopes above are asked for */
  configId: string | null;
}

export function metaAppConfig(env: (name: string) => string | undefined): MetaAppConfig | null {
  const appId = (env('META_APP_ID') ?? '').trim();
  const appSecret = (env('META_APP_SECRET') ?? '').trim();
  const redirectUri = (env('META_REDIRECT_URI') ?? '').trim();
  if (!appId || !appSecret || !redirectUri) return null;
  return {
    appId,
    appSecret,
    redirectUri,
    graphVersion: (env('META_GRAPH_VERSION') ?? '').trim() || DEFAULT_GRAPH_VERSION,
    configId: (env('META_CONFIG_ID') ?? '').trim() || null
  };
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
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
};

async function signPayload(payload: string, secret: string, subtle: SubtleCrypto): Promise<string> {
  const encoder = new TextEncoder();
  const key = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await subtle.sign('HMAC', key, encoder.encode(SIGNING_CONTEXT + payload))));
}

/** "<payload>.<signature>", both base64url */
export async function signMetaState(claims: MetaStateClaims, secret: string, subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<string> {
  if (!secret) throw new Error('A signing secret is required');
  const body = { v: 1, p: claims.practiceId, u: claims.userId, e: claims.expiresAt, n: claims.nonce };
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
  return `${payload}.${await signPayload(payload, secret, subtle)}`;
}

/** Accepts only a state this server signed, unchanged and unexpired; nothing in it is read before the signature checks */
export async function verifyMetaState(
  state: unknown,
  secret: string | null | undefined,
  nowSeconds: number,
  subtle: SubtleCrypto = globalThis.crypto.subtle
): Promise<MetaStateCheck> {
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
  const { p: practiceId, u: userId, e: expiresAt, n: nonce } = body ?? {};
  if (
    body?.v !== 1 ||
    typeof practiceId !== 'string' || !UUID_PATTERN.test(practiceId) ||
    typeof userId !== 'string' || !UUID_PATTERN.test(userId) ||
    typeof expiresAt !== 'number' || !Number.isInteger(expiresAt) ||
    typeof nonce !== 'string' || !nonce
  ) {
    return { ok: false, reason: 'malformed' };
  }
  if (nowSeconds > expiresAt) return { ok: false, reason: 'expired' };
  return { ok: true, claims: { practiceId, userId, expiresAt, nonce } };
}

/** The Facebook sign-in address for this practice's connection */
export function metaAuthorizationUrl(config: MetaAppConfig, state: string): string {
  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  if (config.configId) url.searchParams.set('config_id', config.configId);
  else url.searchParams.set('scope', META_SCOPES.join(','));
  return url.toString();
}

export type MetaRequest =
  | { action: 'status' }
  | { action: 'start'; practiceId: string }
  | { action: 'disconnect'; practiceId: string; connectionId: string }
  | { action: 'invalid'; error: string };

/** The requests the app may send (POST, JSON); anything else is refused before any database read */
export function parseMetaRequest(body: unknown): MetaRequest {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const text = (field: unknown): string => (typeof field === 'string' ? field.trim() : '');
  if (value.action === 'status') return { action: 'status' };
  const practiceId = text(value.practiceId);
  if (!UUID_PATTERN.test(practiceId)) return { action: 'invalid', error: 'Choose the practice first.' };
  if (value.action === 'start') return { action: 'start', practiceId };
  if (value.action === 'disconnect') {
    const connectionId = text(value.connectionId);
    if (!UUID_PATTERN.test(connectionId)) return { action: 'invalid', error: 'Choose the connection to remove.' };
    return { action: 'disconnect', practiceId, connectionId };
  }
  return { action: 'invalid', error: 'Unknown request.' };
}

/** Who may connect or remove the practice's pages: its administrators and doctors (as for Gmail), or OneHealth support */
export function mayManageMetaConnections(staff: { role?: string | null; is_super_admin?: boolean | null } | null | undefined): boolean {
  return staff?.is_super_admin === true || staff?.role === 'admin' || staff?.role === 'doctor';
}

export interface MetaConnectionRow {
  platform: 'facebook_page' | 'instagram_business';
  external_id: string;
  display_name: string;
  page_id: string;
  access_token: string;
}

/**
 * The rows to store from Graph's /me/accounts answer (fields id, name, access_token,
 * instagram_business_account{id,username}): one per page, and one per Instagram business account linked to a page
 * (Instagram posts are made with the page's token).
 */
export function connectionsFromPages(answer: unknown): MetaConnectionRow[] {
  const data = answer && typeof answer === 'object' ? (answer as { data?: unknown }).data : null;
  if (!Array.isArray(data)) return [];
  return data.flatMap((page): MetaConnectionRow[] => {
    const value = (page ?? {}) as Record<string, unknown>;
    const id = typeof value.id === 'string' ? value.id : '';
    const token = typeof value.access_token === 'string' ? value.access_token : '';
    if (!id || !token) return [];
    const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Facebook page';
    const rows: MetaConnectionRow[] = [{ platform: 'facebook_page', external_id: id, display_name: name, page_id: id, access_token: token }];
    const instagram = (value.instagram_business_account ?? null) as Record<string, unknown> | null;
    if (instagram && typeof instagram.id === 'string' && instagram.id) {
      const username = typeof instagram.username === 'string' && instagram.username ? `@${instagram.username}` : `Instagram of ${name}`;
      rows.push({ platform: 'instagram_business', external_id: instagram.id, display_name: username, page_id: id, access_token: token });
    }
    return rows;
  });
}

/** Where the browser goes after Facebook: Settings > Social, with a plain outcome the page shows */
export function settingsReturnUrl(appUrl: string, outcome: 'connected' | 'cancelled' | 'error', count = 0): string {
  const url = new URL('/settings', appUrl);
  url.searchParams.set('tab', 'social');
  url.searchParams.set('meta', outcome);
  if (outcome === 'connected') url.searchParams.set('count', String(count));
  return url.toString();
}
