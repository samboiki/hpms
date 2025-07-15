import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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
    const { from, to, subject, html, text, credentials } = await req.json();

    if (!credentials || !credentials.email || !credentials.appPassword) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Gmail credentials are required' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // For now, we'll simulate success
    // In production, you'd use a library like nodemailer with Gmail SMTP
    console.log('Would send email via Gmail SMTP:', {
      from: credentials.email,
      to,
      subject,
      hasHtml: !!html,
      hasText: !!text
    });

    // Generate a fake message ID
    const messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@gmail.com>`;

    return new Response(
      JSON.stringify({ 
        success: true,
        messageId,
        message: 'Email would be sent via Gmail SMTP (simulated in development)' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in send-gmail-smtp:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to send email' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});