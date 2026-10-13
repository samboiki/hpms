import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { decidePracticeAccess, deniedResponse, loadCaller } from '../_shared/callerAccess.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { practiceId: requestedPracticeId, clientId, clientSecret } = await req.json();

    // The settings page uses this to check a practice's Gmail setup (read with the service role): signed-in,
    // active staff of that practice only (with none named, their own)
    const caller = await loadCaller(supabase, req.headers.get('Authorization'), supabaseServiceKey);
    const access = decidePracticeAccess(caller, requestedPracticeId);
    if (!access.allowed) return deniedResponse(access, corsHeaders);
    const practiceId = access.practiceId;

    console.log('Testing Gmail OAuth connection for practice:', practiceId);

    // Basic validation
    if (!practiceId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Practice ID is required' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Check if we're testing existing OAuth credentials or new ones
    if (clientId && clientSecret) {
      // Testing new credentials before saving
      console.log('Testing new OAuth credentials...');
      
      // Validate OAuth Client ID format
      if (!clientId.endsWith('.apps.googleusercontent.com')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid Client ID format. Should end with .apps.googleusercontent.com' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }

      // Validate Client Secret format (typically starts with GOCSPX-)
      if (!clientSecret.startsWith('GOCSPX-') && clientSecret.length < 20) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid Client Secret format' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }

      // Success - credentials format is valid
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'OAuth credentials format validated! Click "Save OAuth Credentials" to proceed.',
          details: {
            clientIdValid: true,
            clientSecretValid: true,
            ready: true
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } else {
      // Testing existing stored credentials
      console.log('Testing existing OAuth setup...');
      
      // Get OAuth app from database
      const { data: oauthApp, error: oauthError } = await supabase
        .from('practice_oauth_apps')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();

      if (oauthError || !oauthApp) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'No OAuth credentials found. Please add your Client ID and Secret first.' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        );
      }

      // Check if OAuth credentials have been used to connect
      const { data: oauthCreds } = await supabase
        .from('practice_oauth_credentials')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();

      if (oauthCreds) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Gmail is fully connected and ready to send emails!',
            details: {
              hasOAuthApp: true,
              isConnected: true,
              email: oauthCreds.email,
              connectedAt: oauthCreds.connected_at
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'OAuth credentials are saved. Now you need to connect your Gmail account.',
            details: {
              hasOAuthApp: true,
              isConnected: false,
              nextStep: 'Click "Connect Gmail Account" to authorize access'
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }
    }

  } catch (error) {
    console.error('Error in test-gmail-connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});