// meta-oauth: a practice connects its OWN Facebook pages and Instagram business accounts (Settings > Social).
// PROPOSAL: not deployed. To deploy (after the owner registered the Meta app, SP11/meta-app-setup.md):
//   1. apply proposals/2026-10-13-meta-connections.sql (the practice_meta_connections table);
//   2. move this folder to supabase/functions/meta-oauth and change the two imports of '../../functions/_shared/'
//      to '../_shared/';
//   3. set the Supabase secrets META_APP_ID, META_APP_SECRET, META_REDIRECT_URI (this function's address,
//      https://<project>.supabase.co/functions/v1/meta-oauth) and optionally META_CONFIG_ID, META_GRAPH_VERSION, APP_URL;
//   4. deploy with "verify JWT" OFF: Facebook's return (a GET from the browser) carries no Supabase token. Every POST
//      checks the caller itself (loadCaller), and the GET is accepted only with a state this function signed.
//
// POST {action:'status'}                       -> { configured }            (any signed-in staff member)
// POST {action:'start', practiceId}            -> { url } or { configured:false }   (administrators and doctors)
// POST {action:'disconnect', practiceId, connectionId} -> { success }      (administrators and doctors)
// GET  ?code&state (Facebook's return)         -> stores the pages, then sends the browser to Settings > Social
//
// Page tokens are written with the service role into practice_meta_connections, whose token column staff cannot
// read: the browser never sees a token or the app secret. Nothing here logs a token, code or secret.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { decidePracticeAccess, decideStaffAccess, deniedResponse, loadCaller } from '../../functions/_shared/callerAccess.ts';
import {
  META_STATE_TTL_SECONDS,
  connectionsFromPages,
  mayManageMetaConnections,
  metaAppConfig,
  metaAuthorizationUrl,
  parseMetaRequest,
  settingsReturnUrl,
  signMetaState,
  verifyMetaState
} from './metaOAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const redirect = (location: string) => new Response(null, { status: 302, headers: { Location: location } });

const MANAGERS_ONLY = 'Only practice administrators and doctors can connect or remove the practice\'s Facebook and Instagram accounts.';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const config = metaAppConfig((name) => Deno.env.get(name));
  const appUrl = (Deno.env.get('APP_URL') || 'https://app.onehealthsystems.com').replace(/\/+$/, '');

  // Facebook's return: the browser arrives here with ?code&state (or ?error when the person cancelled)
  if (req.method === 'GET') {
    const params = new URL(req.url).searchParams;
    if (params.get('error')) return redirect(settingsReturnUrl(appUrl, 'cancelled'));
    if (!config) return redirect(settingsReturnUrl(appUrl, 'error'));
    const check = await verifyMetaState(params.get('state'), serviceRoleKey, Math.floor(Date.now() / 1000));
    const code = params.get('code');
    if (!check.ok || !code) return redirect(settingsReturnUrl(appUrl, 'error'));
    const { practiceId, userId } = check.claims;

    try {
      // The one who started it must still be an active manager of that practice
      const { data: staff } = await admin.from('users').select('practice_id, role, is_active, is_super_admin').eq('id', userId).maybeSingle();
      const sameStaff = staff && staff.is_active !== false && (staff.practice_id === practiceId || staff.is_super_admin === true);
      if (!sameStaff || !mayManageMetaConnections(staff)) return redirect(settingsReturnUrl(appUrl, 'error'));

      const graph = `https://graph.facebook.com/${config.graphVersion}`;
      // 1. The one-time code for a short-lived user token
      const shortUrl = new URL(`${graph}/oauth/access_token`);
      shortUrl.searchParams.set('client_id', config.appId);
      shortUrl.searchParams.set('client_secret', config.appSecret);
      shortUrl.searchParams.set('redirect_uri', config.redirectUri);
      shortUrl.searchParams.set('code', code);
      const short = await (await fetch(shortUrl)).json();
      if (!short?.access_token) return redirect(settingsReturnUrl(appUrl, 'error'));
      // 2. A long-lived user token, so the page tokens made from it do not expire
      const longUrl = new URL(`${graph}/oauth/access_token`);
      longUrl.searchParams.set('grant_type', 'fb_exchange_token');
      longUrl.searchParams.set('client_id', config.appId);
      longUrl.searchParams.set('client_secret', config.appSecret);
      longUrl.searchParams.set('fb_exchange_token', short.access_token);
      const long = await (await fetch(longUrl)).json();
      const userToken = long?.access_token || short.access_token;
      // 3. The pages the person manages, each with its page token and linked Instagram business account
      const pagesUrl = new URL(`${graph}/me/accounts`);
      pagesUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id,username}');
      pagesUrl.searchParams.set('limit', '100');
      pagesUrl.searchParams.set('access_token', userToken);
      const rows = connectionsFromPages(await (await fetch(pagesUrl)).json());
      if (rows.length === 0) return redirect(settingsReturnUrl(appUrl, 'connected', 0));

      const now = new Date().toISOString();
      const { error } = await admin.from('practice_meta_connections').upsert(
        rows.map((row) => ({ ...row, practice_id: practiceId, connected_by: userId, connected_at: now, updated_at: now })),
        { onConflict: 'practice_id,platform,external_id' }
      );
      if (error) {
        console.error('meta-oauth: connections not stored', error.code);
        return redirect(settingsReturnUrl(appUrl, 'error'));
      }
      return redirect(settingsReturnUrl(appUrl, 'connected', rows.length));
    } catch (error) {
      console.error('meta-oauth: Facebook return failed', error instanceof Error ? error.name : 'unknown');
      return redirect(settingsReturnUrl(appUrl, 'error'));
    }
  }

  if (req.method !== 'POST') return json(405, { success: false, error: 'Use POST.' });

  try {
    const body = await req.json().catch(() => null);
    const request = parseMetaRequest(body);
    const caller = await loadCaller(admin, req.headers.get('Authorization'), serviceRoleKey);

    if (request.action === 'status') {
      const access = decideStaffAccess(caller);
      if (!access.allowed) return deniedResponse(access, corsHeaders);
      return json(200, { success: true, configured: !!config });
    }
    if (request.action === 'invalid') return json(400, { success: false, error: request.error });

    const access = decidePracticeAccess(caller, request.practiceId);
    if (!access.allowed) return deniedResponse(access, corsHeaders);
    if (!caller.isServiceKey && !mayManageMetaConnections(caller.staff)) return json(403, { success: false, error: MANAGERS_ONLY });

    if (request.action === 'start') {
      if (!config) return json(200, { success: true, configured: false });
      if (!caller.user) return json(401, { success: false, error: 'Sign in as practice staff to connect Facebook.' });
      const state = await signMetaState(
        {
          practiceId: request.practiceId,
          userId: caller.user.id,
          expiresAt: Math.floor(Date.now() / 1000) + META_STATE_TTL_SECONDS,
          nonce: crypto.randomUUID()
        },
        serviceRoleKey
      );
      return json(200, { success: true, configured: true, url: metaAuthorizationUrl(config, state) });
    }

    // disconnect: removes the stored connection (and its token) for this practice only
    const { data, error } = await admin
      .from('practice_meta_connections')
      .delete()
      .eq('id', request.connectionId)
      .eq('practice_id', request.practiceId)
      .select('id');
    if (error) return json(500, { success: false, error: 'The connection could not be removed. Please try again.' });
    if (!data || data.length === 0) return json(404, { success: false, error: 'That connection is no longer there.' });
    return json(200, { success: true });
  } catch (error) {
    console.error('meta-oauth: request failed', error instanceof Error ? error.name : 'unknown');
    return json(500, { success: false, error: 'Something went wrong. Please try again.' });
  }
});
