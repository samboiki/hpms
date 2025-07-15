import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Handle GET request from Google OAuth redirect
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error)
      const errorDescription = url.searchParams.get('error_description') || 'Unknown error'
      
      // Redirect back with error
      const redirectUrl = new URL(`${url.origin}/settings`)
      redirectUrl.searchParams.set('oauth_error', error)
      redirectUrl.searchParams.set('oauth_error_description', errorDescription)
      
      return Response.redirect(redirectUrl.toString(), 302)
    }

    if (!code || !state) {
      throw new Error('Missing required parameters: code or state')
    }

    // Decode state to get practice_id and redirect_origin
    let stateData: { practice_id: string; redirect_origin: string }
    try {
      stateData = JSON.parse(atob(state))
    } catch {
      throw new Error('Invalid state parameter')
    }

    const { practice_id, redirect_origin } = stateData

    if (!practice_id || !redirect_origin) {
      throw new Error('Invalid state data')
    }

    // The redirect_uri must match exactly what was sent in the authorization request
    const redirect_uri = `${url.origin}/functions/v1/gmail-oauth-callback`

    // Get environment variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create Supabase client with service role to bypass RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Fetch practice-specific OAuth credentials
    const { data: oauthApp, error: oauthError } = await supabase
      .from('practice_oauth_apps')
      .select('client_id, client_secret')
      .eq('practice_id', practice_id)
      .eq('provider', 'google')
      .single()

    if (oauthError || !oauthApp) {
      throw new Error('OAuth app not configured for this practice. Please add Google OAuth credentials.')
    }

    const GOOGLE_CLIENT_ID = oauthApp.client_id
    const GOOGLE_CLIENT_SECRET = oauthApp.client_secret

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('Token exchange failed:', error)
      throw new Error('Failed to exchange authorization code')
    }

    const tokens = await tokenResponse.json()

    // Get user info to get the email address
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get user info')
    }

    const userInfo = await userInfoResponse.json()

    // Store the refresh token in the database
    const { error: dbError } = await supabase
      .from('practice_oauth_credentials')
      .upsert({
        practice_id,
        provider: 'google',
        email: userInfo.email,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: tokens.scope?.split(' ') || [],
        metadata: {
          name: userInfo.name,
          picture: userInfo.picture,
          verified_email: userInfo.verified_email,
        },
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'practice_id,provider,email',
        ignoreDuplicates: false
      })

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('Failed to store OAuth credentials')
    }

    // Also update the practice_automation_settings table
    const { data: automationSettings } = await supabase
      .from('practice_automation_settings')
      .select('id')
      .eq('practice_id', practice_id)

    if (automationSettings && automationSettings.length > 0) {
      // Update all automation settings with the Gmail info
      const updatePromises = automationSettings.map(setting =>
        supabase
          .from('practice_automation_settings')
          .update({
            google_refresh_token: tokens.refresh_token,
            google_email: userInfo.email,
            last_token_refresh: new Date().toISOString(),
          })
          .eq('id', setting.id)
      )

      await Promise.all(updatePromises)
    }

    // Redirect back to the practice's settings page with success
    const successUrl = new URL(`${redirect_origin}/settings`)
    successUrl.searchParams.set('oauth_success', 'true')
    successUrl.searchParams.set('oauth_email', userInfo.email)

    return Response.redirect(successUrl.toString(), 302)
  } catch (error) {
    console.error('OAuth callback error:', error)
    
    // Redirect back with error
    const url = new URL(req.url)
    const errorUrl = new URL(`${url.origin}/settings`)
    errorUrl.searchParams.set('oauth_error', 'callback_failed')
    errorUrl.searchParams.set('oauth_error_description', error.message)
    
    return Response.redirect(errorUrl.toString(), 302)
  }
})