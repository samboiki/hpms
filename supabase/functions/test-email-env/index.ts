import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check for environment variables
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL')
    
    const response = {
      hasResendApiKey: !!RESEND_API_KEY,
      resendApiKeyLength: RESEND_API_KEY ? RESEND_API_KEY.length : 0,
      hasSenderEmail: !!SENDER_EMAIL,
      senderEmail: SENDER_EMAIL || 'NOT_SET',
      message: 'Environment variable check complete'
    }

    if (!RESEND_API_KEY) {
      response.message = 'Missing RESEND_API_KEY environment variable'
    }
    
    if (!SENDER_EMAIL) {
      response.message = response.message + ' | Missing SENDER_EMAIL environment variable'
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders },
        status: 500 
      }
    )
  }
})