import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OAuthState {
  practice_id: string
  redirect_url: string
  provider: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const error_description = url.searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
      const errorMessage = `OAuth Error: ${error} - ${error_description || 'Unknown error'}`
      console.error(errorMessage)
      
      // Redirect to a generic error page or back to the app with error
      return Response.redirect(`${url.origin}/settings?oauth_error=${encodeURIComponent(error)}`, 302)
    }

    if (!code || !state) {
      throw new Error('Missing required OAuth parameters')
    }

    // Decode the state parameter
    let stateData: OAuthState
    try {
      stateData = JSON.parse(atob(state))
    } catch {
      throw new Error('Invalid state parameter')
    }

    const { practice_id, redirect_url, provider } = stateData

    if (!practice_id || !redirect_url || !provider) {
      throw new Error('Invalid state data')
    }

    // Get environment variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Fetch practice-specific OAuth credentials
    const { data: oauthApp, error: oauthError } = await supabase
      .from('practice_oauth_apps')
      .select('client_id, client_secret')
      .eq('practice_id', practice_id)
      .eq('provider', provider)
      .single()

    if (oauthError || !oauthApp) {
      throw new Error(`OAuth app not configured for practice ${practice_id}`)
    }

    // Exchange authorization code for tokens
    const tokenEndpoint = provider === 'google' 
      ? 'https://oauth2.googleapis.com/token'
      : null // Add other providers as needed

    if (!tokenEndpoint) {
      throw new Error(`Unsupported provider: ${provider}`)
    }

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: oauthApp.client_id,
        client_secret: oauthApp.client_secret,
        redirect_uri: url.origin + url.pathname, // Use the universal callback URL
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('Token exchange failed:', error)
      throw new Error('Failed to exchange authorization code')
    }

    const tokens = await tokenResponse.json()

    // Get user info based on provider
    let userInfo: { email?: string; name?: string; picture?: string; verified_email?: boolean } = {}
    
    if (provider === 'google') {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })

      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info')
      }

      userInfo = await userInfoResponse.json()
    }

    // Store the tokens in the database
    const { error: dbError } = await supabase
      .from('practice_oauth_credentials')
      .upsert({
        practice_id,
        provider,
        email: userInfo.email || 'unknown',
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        scopes: tokens.scope?.split(' ') || [],
        metadata: {
          name: userInfo.name,
          picture: userInfo.picture,
          verified_email: userInfo.verified_email,
          ...userInfo, // Store all user info
        },
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('Failed to store OAuth credentials')
    }

    // Generate a secure temporary token for the redirect
    const { data: tempToken, error: tokenError } = await supabase
      .from('oauth_callback_tokens')
      .insert({
        token: crypto.randomUUID(),
        practice_id,
        provider,
        email: userInfo.email,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      })
      .select('token')
      .single()

    if (tokenError || !tempToken) {
      console.error('Failed to create callback token:', tokenError)
      // Still redirect but without token
      return Response.redirect(`${redirect_url}?oauth_success=true&provider=${provider}`, 302)
    }

    // Redirect back to the practice's domain with success
    const finalRedirectUrl = new URL(redirect_url)
    finalRedirectUrl.searchParams.set('oauth_success', 'true')
    finalRedirectUrl.searchParams.set('provider', provider)
    finalRedirectUrl.searchParams.set('token', tempToken.token)
    finalRedirectUrl.searchParams.set('email', userInfo.email || '')

    return Response.redirect(finalRedirectUrl.toString(), 302)
  } catch (error) {
    console.error('Universal OAuth callback error:', error)
    
    // Redirect to a generic error page
    return Response.redirect(`${req.headers.get('origin') || 'https://app.onehealth.com'}/settings?oauth_error=${encodeURIComponent(error.message)}`, 302)
  }
})