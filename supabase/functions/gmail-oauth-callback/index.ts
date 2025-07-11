import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OAuthRequest {
  code: string
  redirect_uri: string
  practice_id: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, redirect_uri, practice_id } = await req.json() as OAuthRequest

    if (!code || !redirect_uri || !practice_id) {
      throw new Error('Missing required parameters')
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

    return new Response(
      JSON.stringify({
        success: true,
        email: userInfo.email,
        name: userInfo.name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})