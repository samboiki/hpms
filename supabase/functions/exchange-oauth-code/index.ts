import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { decidePracticeAccess, deniedResponse, loadCaller, type Caller, type PracticeAccess } from '../_shared/callerAccess.ts'
import {
  OAUTH_STATE_TTL_SECONDS,
  googleAuthorizationUrl,
  mayConnectPracticeAccount,
  parseConnectRequest,
  signOAuthState,
  stateRefusalMessage,
  verifyOAuthState,
} from '../_shared/oauthState.ts'

// Connects a practice's Gmail account. The browser never sees the Google client secret or the account's tokens:
// - action 'start': a signed-in administrator or doctor of the practice (or OneHealth support) gets the Google
//   sign-in address, with a state signed here (practice, person, return address; valid 10 minutes)
// - action 'exchange': when Google sends the browser back, it hands over the one-time code and that state. The state
//   must be signed here, unexpired and issued to the same person; the code is exchanged with the practice's stored
//   client secret and the tokens are saved in practice_oauth_credentials. The answer holds the connected address only.
// The state is signed with the service role key (a server-only secret; the signature cannot reveal it).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const answer = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const refuse = (status: number, error: string) => answer({ success: false, error }, status)

const NOT_SET_UP = 'Gmail is not set up for this practice yet: add the Google Client ID and Client Secret first.'

/** The practice the caller may connect a Gmail account for: staff of the practice who manage its Google app */
function connectAccess(caller: Caller, practiceId: string): PracticeAccess {
  const access = decidePracticeAccess(caller, practiceId)
  if (!access.allowed) return access
  if (!mayConnectPracticeAccount(caller.staff)) {
    return { allowed: false, status: 403, error: 'Only a practice administrator or doctor can connect the practice Gmail.' }
  }
  return access
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Service role: reads the client secret and writes the tokens past row-level security (and column grants)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const request = parseConnectRequest(await req.json().catch(() => null))
    if (request.action === 'invalid') return refuse(400, request.error)

    // A signed-in person only (not the service key): the state is bound to whoever starts the sign-in
    const caller = await loadCaller(supabase, req.headers.get('Authorization'), SUPABASE_SERVICE_ROLE_KEY)
    if (caller.isServiceKey || !caller.user) return refuse(401, 'Sign in as practice staff to connect Gmail.')

    if (request.action === 'start') {
      const access = connectAccess(caller, request.practiceId)
      if (!access.allowed) return deniedResponse(access, corsHeaders)

      const { data: app, error: appError } = await supabase
        .from('practice_oauth_apps')
        .select('client_id')
        .eq('practice_id', request.practiceId)
        .eq('provider', 'google')
        .maybeSingle()
      if (appError) {
        console.error('Reading the practice Google app failed:', appError.message)
        return refuse(500, 'The Gmail settings could not be read. Please try again.')
      }
      if (!app?.client_id) return refuse(400, NOT_SET_UP)

      const state = await signOAuthState(
        {
          practiceId: request.practiceId,
          userId: caller.user.id,
          redirectUri: request.redirectUri,
          expiresAt: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
          nonce: crypto.randomUUID(),
        },
        SUPABASE_SERVICE_ROLE_KEY
      )
      return answer({
        success: true,
        authorization_url: googleAuthorizationUrl({ clientId: app.client_id, redirectUri: request.redirectUri, state }),
      })
    }

    // action 'exchange'
    const check = await verifyOAuthState(request.state, SUPABASE_SERVICE_ROLE_KEY, Math.floor(Date.now() / 1000))
    if (!check.ok) return refuse(400, stateRefusalMessage(check.reason))
    const { practiceId, userId, redirectUri } = check.claims
    if (userId !== caller.user.id) {
      return refuse(403, 'This Google sign-in was started by someone else. Please connect Gmail yourself.')
    }
    const access = connectAccess(caller, practiceId)
    if (!access.allowed) return deniedResponse(access, corsHeaders)

    const { data: app, error: appError } = await supabase
      .from('practice_oauth_apps')
      .select('client_id, client_secret')
      .eq('practice_id', practiceId)
      .eq('provider', 'google')
      .maybeSingle()
    if (appError) {
      console.error('Reading the practice Google app failed:', appError.message)
      return refuse(500, 'The Gmail settings could not be read. Please try again.')
    }
    if (!app?.client_id || !app?.client_secret) return refuse(400, NOT_SET_UP)

    // Exchange the one-time code, with the return address the sign-in started with
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: request.code,
        client_id: app.client_id,
        client_secret: app.client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenResponse.ok) {
      // Google's error names the problem (invalid_grant, redirect_uri_mismatch); it holds no token
      console.error('Google refused the code:', tokenResponse.status, (await tokenResponse.text()).slice(0, 300))
      return refuse(502, 'Google did not accept the sign-in. Please connect Gmail again.')
    }
    const tokens = await tokenResponse.json()
    if (!tokens?.access_token) return refuse(502, 'Google did not accept the sign-in. Please connect Gmail again.')

    // The account's address (and name and picture for the Gmail settings window)
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = userInfoResponse.ok ? await userInfoResponse.json() : null
    if (!userInfo?.email) return refuse(502, 'Could not read the Google account details. Please connect Gmail again.')

    const now = new Date().toISOString()
    const { error: saveError } = await supabase
      .from('practice_oauth_credentials')
      .upsert({
        practice_id: practiceId,
        provider: 'google',
        email: userInfo.email,
        // Google returns a refresh token with every fresh consent (prompt=consent); without one the stored one stays
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString(),
        scopes: typeof tokens.scope === 'string' ? tokens.scope.split(' ') : [],
        metadata: {
          name: userInfo.name,
          picture: userInfo.picture,
          verified_email: userInfo.verified_email,
        },
        connected_at: now,
        updated_at: now,
      }, {
        onConflict: 'practice_id,provider,email',
        ignoreDuplicates: false,
      })
    if (saveError) {
      console.error('Saving the Gmail connection failed:', saveError.message)
      return refuse(500, 'The Gmail connection could not be saved. Please try again.')
    }

    // A practice sends from one Gmail address: connecting another replaces the old one. The email gateway reads the
    // practice's single Google connection, and with two it would quietly send through the fallback provider instead.
    const { error: replaceError } = await supabase
      .from('practice_oauth_credentials')
      .delete()
      .eq('practice_id', practiceId)
      .eq('provider', 'google')
      .neq('email', userInfo.email)
    if (replaceError) {
      console.error('Removing the previous Gmail connection failed:', replaceError.message)
      return refuse(500, 'The new Gmail address is saved, but the previous one could not be removed. Please connect Gmail again.')
    }

    return answer({ success: true, email: userInfo.email })
  } catch (error) {
    console.error('Gmail connection error:', error instanceof Error ? error.message : error)
    return refuse(500, 'Gmail could not be connected. Please try again.')
  }
})
