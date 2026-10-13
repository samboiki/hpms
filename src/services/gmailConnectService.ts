/**
 * Connecting a practice's Gmail account. The browser never sees the Google client secret or the account's tokens:
 * the exchange-oauth-code edge function gives the Google sign-in address with a state it signed, and when Google
 * sends the browser back it exchanges the one-time code with the stored secret and saves the tokens itself.
 * The browser reads only what people need to see: the connected address, since when, and what Google allowed.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// practice_oauth_credentials is not in the generated database types
const db = supabase as unknown as SupabaseClient;

/** Where Google sends the browser back: one of the "Authorized redirect URIs" of the practice's Google app */
export const GMAIL_RETURN_PATH = '/settings';

/** The practice_oauth_credentials columns the browser may read: never refresh_token or access_token */
export const GMAIL_CONNECTION_COLUMNS = 'email, scopes, connected_at, last_used_at, metadata';

export interface GmailConnection {
  email: string;
  scopes: string[];
  connectedAt: string | null;
  lastUsedAt: string | null;
  /** The Google account's name and picture, if Google shared them */
  name: string | null;
  picture: string | null;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

export function gmailConnectionFromRow(row: unknown): GmailConnection | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const email = text(r.email);
  if (!email) return null;
  const metadata = r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : {};
  return {
    email,
    scopes: Array.isArray(r.scopes) ? r.scopes.filter((scope): scope is string => typeof scope === 'string') : [],
    connectedAt: text(r.connected_at),
    lastUsedAt: text(r.last_used_at),
    name: text(metadata.name),
    picture: text(metadata.picture),
  };
}

/** The practice's connected Gmail account (the latest), or null. Throws when it cannot be read. */
export async function loadGmailConnection(practiceId: string | null | undefined): Promise<GmailConnection | null> {
  if (!practiceId) return null;
  const { data, error } = await db
    .from('practice_oauth_credentials')
    .select(GMAIL_CONNECTION_COLUMNS)
    .eq('practice_id', practiceId)
    .eq('provider', 'google')
    .order('connected_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return gmailConnectionFromRow(Array.isArray(data) ? data[0] : null);
}

/** The Client ID of the practice's Google app, or null when Gmail is not set up (never the client secret). */
export async function loadGoogleClientId(practiceId: string | null | undefined): Promise<string | null> {
  if (!practiceId) return null;
  const { data, error } = await db.from('practice_oauth_apps').select('client_id').eq('practice_id', practiceId).eq('provider', 'google').maybeSingle();
  if (error) throw new Error(error.message);
  return text((data as { client_id?: unknown } | null)?.client_id);
}

/**
 * Saves the practice's Google app (the client ID and secret its administrator types in). Insert or update, never an
 * upsert: signed-in users may write the secret but not read it (proposals/2026-10-08-oauth-secrets-columns.sql), and
 * Postgres refuses an upsert ("ON CONFLICT DO UPDATE") to anyone who may not read the columns it would overwrite.
 */
export async function saveGoogleOAuthApp(
  practiceId: string,
  app: { clientId: string; clientSecret: string; redirectUri: string }
): Promise<void> {
  const fields = { client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: app.redirectUri, updated_at: new Date().toISOString() };
  const existing = await db.from('practice_oauth_apps').select('id').eq('practice_id', practiceId).eq('provider', 'google').maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const id = text((existing.data as { id?: unknown } | null)?.id);
  const { error } = id
    ? await db.from('practice_oauth_apps').update(fields).eq('id', id)
    : await db.from('practice_oauth_apps').insert({ practice_id: practiceId, provider: 'google', ...fields });
  if (error) throw new Error(error.message);
}

export type GmailCallback = { kind: 'code'; code: string; state: string } | { kind: 'error'; error: string };

/** What Google put on the return address: a one-time code with its state, an error, or nothing for us. */
export function readGmailCallback(search: string): GmailCallback | null {
  const params = new URLSearchParams(search);
  const error = params.get('error');
  const state = params.get('state');
  if (error && state) return { kind: 'error', error };
  const code = params.get('code');
  return code && state ? { kind: 'code', code, state } : null;
}

/** Google's error on the return address in plain words. */
export function describeGoogleCallbackError(error: string): string {
  return error === 'access_denied'
    ? 'Google sign-in was cancelled, so Gmail was not connected.'
    : 'Google sign-in did not complete. Please try connecting Gmail again.';
}

const START_FAILED = 'The Google sign-in could not be started. Please try again.';
const FINISH_FAILED = 'Gmail could not be connected. Please try again.';
// The exchange-oauth-code deployed before 2026-10-08 answers the new requests with this
const OLD_FUNCTION_ANSWER = 'Missing required parameters';
const NOT_UPDATED = 'Gmail cannot be connected until OneHealth deploys the updated exchange-oauth-code function.';

/** The function's own words for a refusal (it answers with { error }), else the fallback. */
async function refusalMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    if (context.status === 404) return NOT_UPDATED;
    const body = (await context.json().catch(() => null)) as { error?: unknown } | null;
    if (typeof body?.error === 'string' && body.error) return body.error === OLD_FUNCTION_ANSWER ? NOT_UPDATED : body.error;
  }
  return fallback;
}

export type GmailConnectStart = { ok: true; url: string } | { ok: false; message: string };

/** The Google sign-in address for the practice (the caller sends the browser there). */
export async function startGmailConnect(practiceId: string | null | undefined, origin: string = window.location.origin): Promise<GmailConnectStart> {
  if (!practiceId) return { ok: false, message: "Your practice couldn't be identified. Reload the page and try again." };
  const { data, error } = await supabase.functions.invoke('exchange-oauth-code', {
    body: { action: 'start', provider: 'google', practice_id: practiceId, redirect_uri: `${origin}${GMAIL_RETURN_PATH}` },
  });
  if (error) return { ok: false, message: await refusalMessage(error, START_FAILED) };
  const url = (data as { authorization_url?: unknown } | null)?.authorization_url;
  // The browser only ever goes to Google's own sign-in page from here
  return typeof url === 'string' && url.startsWith('https://accounts.google.com/') ? { ok: true, url } : { ok: false, message: START_FAILED };
}

export type GmailConnectResult = { ok: true; email: string } | { ok: false; message: string };

// A code works once; React runs effects twice in development, so a second call gets the first call's answer
const exchanges = new Map<string, Promise<GmailConnectResult>>();

/** Hands Google's one-time code and the signed state to the server, which connects the account. */
export function completeGmailConnect(callback: { code: string; state: string }): Promise<GmailConnectResult> {
  const running = exchanges.get(callback.code);
  if (running) return running;
  const exchange = (async (): Promise<GmailConnectResult> => {
    const { data, error } = await supabase.functions.invoke('exchange-oauth-code', {
      body: { action: 'exchange', provider: 'google', code: callback.code, state: callback.state },
    });
    if (error) return { ok: false, message: await refusalMessage(error, FINISH_FAILED) };
    const email = text((data as { email?: unknown } | null)?.email);
    return email ? { ok: true, email } : { ok: false, message: FINISH_FAILED };
  })();
  exchanges.set(callback.code, exchange);
  return exchange;
}
