import { createClient } from '@supabase/supabase-js';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { code, state, practiceId, redirectUri } = await req.json();

    // Initialize Supabase with service role
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      // Fallback to anon key if service key not available
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
      const supabase = createClient(supabaseUrl, supabaseAnonKey!);

      // Get OAuth app credentials
      const { data: oauthApp, error: oauthError } = await supabase
        .from('practice_oauth_apps')
        .select('client_id, client_secret')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();

      if (oauthError || !oauthApp) {
        throw new Error('OAuth app not configured');
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: oauthApp.client_id,
          client_secret: oauthApp.client_secret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokens = await tokenResponse.json();

      // Get user info
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      const userInfo = await userInfoResponse.json();

      // Save credentials
      const credentialData = {
        practice_id: practiceId,
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
      };

      const { data, error } = await supabase
        .from('practice_oauth_credentials')
        .insert(credentialData)
        .select();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        email: userInfo.email,
        data 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If we have service key, use it for direct access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Similar logic as above but with service role access...
    
  } catch (error: any) {
    console.error('OAuth save error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}