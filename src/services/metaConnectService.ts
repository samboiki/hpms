import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isNotSetUpError } from './invoicingSetup';

// Untyped: these tables and columns are newer than the generated types (src/types/database.types.ts)
const db = supabase as unknown as SupabaseClient;

/**
 * Settings > Social: the practice's own Facebook pages and Instagram business accounts (owner, 13 Oct 2026).
 * The connect flow runs in the meta-oauth edge function (supabase/functions-proposals/meta-oauth, not deployed yet)
 * and the connections are in practice_meta_connections (proposals/2026-10-13-meta-connections.sql). Until both exist
 * and the Meta app's keys are in the Supabase secrets, everything here says "not set up yet". The browser never sees
 * a page token.
 */

export interface MetaConnection {
  id: string;
  platform: 'facebook_page' | 'instagram_business';
  displayName: string;
  connectedAt: string;
}

/** not_set_up: the function or table is not there yet; not_configured: no Meta app keys yet; ready: can connect */
export type MetaSetup = 'not_set_up' | 'not_configured' | 'ready';

const FUNCTION = 'meta-oauth';

/** A function that is not deployed answers 404 (or the relay cannot reach it) */
function isMissingFunction(error: unknown): boolean {
  const context = error && typeof error === 'object' ? (error as { context?: { status?: number }; name?: string }) : null;
  return context?.context?.status === 404 || context?.name === 'FunctionsRelayError' || context?.name === 'FunctionsFetchError';
}

export async function loadMetaSetup(): Promise<MetaSetup> {
  let answer: { data: unknown; error: unknown };
  try {
    answer = await supabase.functions.invoke(FUNCTION, { body: { action: 'status' } });
  } catch (caught) {
    console.error('Facebook connection status could not be read', caught);
    return 'not_set_up';
  }
  const { data, error } = answer;
  if (error) {
    if (!isMissingFunction(error)) console.error('Facebook connection status could not be read', error);
    return 'not_set_up';
  }
  return (data as { configured?: boolean } | null)?.configured ? 'ready' : 'not_configured';
}

export async function loadMetaConnections(practiceId: string): Promise<{ ok: true; value: MetaConnection[] } | { ok: false; notSetUp: boolean; message: string }> {
  const { data, error } = await db
    .from('practice_meta_connections')
    .select('id, platform, display_name, connected_at')
    .eq('practice_id', practiceId)
    .order('connected_at', { ascending: true });
  if (error) {
    if (isNotSetUpError(error)) return { ok: false, notSetUp: true, message: 'Facebook and Instagram connections are not set up yet.' };
    console.error('Facebook and Instagram connections could not be loaded', error);
    return { ok: false, notSetUp: false, message: 'The connected Facebook and Instagram accounts could not be loaded.' };
  }
  return {
    ok: true,
    value: (data ?? []).map(row => ({
      id: row.id as string,
      platform: row.platform as MetaConnection['platform'],
      displayName: row.display_name as string,
      connectedAt: row.connected_at as string
    }))
  };
}

/** The Facebook sign-in address for this practice (the person is sent there), or why it cannot start */
export async function startMetaConnect(practiceId: string): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.functions.invoke(FUNCTION, { body: { action: 'start', practiceId } });
  const answer = (data ?? null) as { url?: string; configured?: boolean; error?: string } | null;
  if (error) {
    if (isMissingFunction(error)) return { ok: false, message: 'Connecting Facebook and Instagram is not set up yet.' };
    const detail = await readFunctionError(error);
    return { ok: false, message: detail ?? 'Facebook could not be opened just now. Please try again.' };
  }
  if (answer?.configured === false) return { ok: false, message: 'Connecting Facebook and Instagram is not set up yet: OneHealth\'s Meta app is still being registered.' };
  if (!answer?.url || !answer.url.startsWith('https://www.facebook.com/')) return { ok: false, message: 'Facebook could not be opened just now. Please try again.' };
  return { ok: true, url: answer.url };
}

export async function disconnectMeta(practiceId: string, connectionId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.functions.invoke(FUNCTION, { body: { action: 'disconnect', practiceId, connectionId } });
  if (error) {
    const detail = isMissingFunction(error) ? null : await readFunctionError(error);
    return { ok: false, message: detail ?? 'The account could not be disconnected just now. Please try again.' };
  }
  return { ok: true };
}

/** The function's own plain sentence from a refused call ({ error: '...' }), when there is one */
async function readFunctionError(error: unknown): Promise<string | null> {
  const response = error && typeof error === 'object' ? (error as { context?: { json?: () => Promise<unknown> } }).context : undefined;
  try {
    const body = response?.json ? await response.json() : null;
    const message = body && typeof body === 'object' ? (body as { error?: unknown }).error : null;
    return typeof message === 'string' && message ? message : null;
  } catch {
    return null;
  }
}

/** What Facebook's return to Settings says (?meta=connected&count=2, cancelled or error), in plain words */
export function metaReturnMessage(params: URLSearchParams): { tone: 'success' | 'error'; text: string } | null {
  const outcome = params.get('meta');
  if (outcome === 'connected') {
    const count = Number(params.get('count') ?? '0');
    return count > 0
      ? { tone: 'success', text: `Connected ${count === 1 ? '1 Facebook page or Instagram account' : `${count} Facebook pages and Instagram accounts`}.` }
      : { tone: 'error', text: 'Facebook did not share any page. Choose at least one page you manage when Facebook asks.' };
  }
  if (outcome === 'cancelled') return { tone: 'error', text: 'Connecting Facebook was cancelled.' };
  if (outcome === 'error') return { tone: 'error', text: 'Facebook and Instagram could not be connected. Please try again.' };
  return null;
}
