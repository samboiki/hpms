import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Email Gateway V2 starting...');
    
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    if (!resendApiKey) {
      throw new Error('Missing Resend API key');
    }
    
    // Parse request
    const requestData = await req.json();
    const {
      practiceId,
      recipientEmail,
      recipientName = 'Valued Patient',
      subject,
      textContent,
      htmlContent,
      emailType = 'custom'
    } = requestData;
    
    if (!practiceId || !recipientEmail || !subject || !textContent) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: practiceId, recipientEmail, subject, textContent'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Log the email attempt
    const { data: logEntry, error: logError } = await supabase
      .from('practice_email_logs')
      .insert({
        practice_id: practiceId,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        sender_email: 'onboarding@resend.dev',
        sender_name: 'HPMS',
        subject: subject,
        html_content: htmlContent || null,
        text_content: textContent,
        email_type: emailType,
        provider: 'resend',
        status: 'pending'
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Failed to create log entry:', logError);
      throw new Error('Failed to create log entry');
    }
    
    // Send email via Resend
    console.log('Sending email via Resend...');
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HPMS <onboarding@resend.dev>',
        to: recipientEmail,
        subject: subject,
        text: textContent,
        html: htmlContent || undefined
      }),
    });
    
    const responseText = await emailResponse.text();
    console.log('Resend response:', responseText);
    
    if (emailResponse.ok) {
      const result = JSON.parse(responseText);
      
      // Update log as sent
      await supabase
        .from('practice_email_logs')
        .update({
          status: 'sent',
          provider_message_id: result.id,
          sent_at: new Date().toISOString()
        })
        .eq('id', logEntry.id);
      
      return new Response(
        JSON.stringify({
          success: true,
          logId: logEntry.id,
          messageId: result.id,
          status: 'sent'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      // Email failed
      const errorData = JSON.parse(responseText);
      
      await supabase
        .from('practice_email_logs')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: errorData.message || errorData.error || 'Unknown error'
        })
        .eq('id', logEntry.id);
      
      return new Response(
        JSON.stringify({
          success: false,
          logId: logEntry.id,
          error: errorData.message || errorData.error || 'Email sending failed'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('Error in email-gateway-v2:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});