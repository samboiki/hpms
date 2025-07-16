import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { practiceId } = await req.json();

    // Get Gmail credentials
    const { data: gmailCredentials } = await supabase
      .from('practice_oauth_credentials')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('provider', 'google')
      .single();

    // Get OAuth app
    const { data: oauthApp } = await supabase
      .from('practice_oauth_apps')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('provider', 'google')
      .single();

    // Check token expiry
    const tokenExpired = gmailCredentials?.token_expires_at ? 
      new Date(gmailCredentials.token_expires_at) < new Date() : true;

    let testResult = {
      hasCredentials: !!gmailCredentials,
      hasOAuthApp: !!oauthApp,
      email: gmailCredentials?.email,
      tokenExpired,
      tokenExpiresAt: gmailCredentials?.token_expires_at,
      currentTime: new Date().toISOString(),
      refreshTokenExists: !!gmailCredentials?.refresh_token,
      accessTokenExists: !!gmailCredentials?.access_token,
    };

    // Try to refresh token if expired
    if (gmailCredentials && oauthApp && tokenExpired && gmailCredentials.refresh_token) {
      try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: oauthApp.client_id,
            client_secret: oauthApp.client_secret,
            refresh_token: gmailCredentials.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        const tokenResult = await tokenResponse.json();
        
        testResult.tokenRefreshAttempted = true;
        testResult.tokenRefreshSuccess = tokenResponse.ok;
        testResult.tokenRefreshError = tokenResult.error || null;
        testResult.tokenRefreshErrorDescription = tokenResult.error_description || null;
        
        if (tokenResponse.ok && tokenResult.access_token) {
          // Update stored tokens
          await supabase
            .from('practice_oauth_credentials')
            .update({
              access_token: tokenResult.access_token,
              token_expires_at: new Date(Date.now() + tokenResult.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', gmailCredentials.id);
          
          testResult.newTokenSaved = true;
        }
      } catch (error) {
        testResult.tokenRefreshError = error.message;
      }
    }

    return new Response(
      JSON.stringify(testResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});