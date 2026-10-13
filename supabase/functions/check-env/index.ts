import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decidePlatformAccess, deniedResponse } from '../_shared/callerAccess.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Debug tool that prints the start of the Resend key: the service role key only (the owner should delete it)
  const access = decidePlatformAccess(req.headers.get('Authorization'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!access.allowed) return deniedResponse(access, corsHeaders);

  try {
    // Check environment variables
    const envCheck = {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasResendKey: !!Deno.env.get('RESEND_API_KEY'),
      hasSenderEmail: !!Deno.env.get('SENDER_EMAIL'),
      senderEmail: Deno.env.get('SENDER_EMAIL') || 'not set',
      resendKeyPrefix: Deno.env.get('RESEND_API_KEY')?.substring(0, 10) + '...',
    };

    return new Response(
      JSON.stringify({
        success: true,
        environment: envCheck,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});