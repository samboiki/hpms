import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// CORS headers with additional allowed headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Resend API key not configured'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      practiceId,
      recipientEmail,
      recipientName,
      senderEmail = 'noreply@hpms.com',
      senderName = 'HPMS',
      subject,
      htmlContent,
      textContent,
      emailType = 'custom',
      attachments = [],
      patientId,
      appointmentId,
      visitId,
      invoiceId,
      metadata = {},
      tags = []
    } = await req.json();

    if (!practiceId || !recipientEmail || !subject || (!htmlContent && !textContent)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: practiceId, recipientEmail, subject, and either htmlContent or textContent'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check subscription status
    const { data: subscription, error: subError } = await supabase
      .from('practice_email_subscriptions')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('is_active', true)
      .gte('billing_cycle_end', new Date().toISOString().split('T')[0]) // Use date format YYYY-MM-DD
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active email subscription found for this practice'
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check usage limits
    const remaining = (subscription.monthly_limit || 0) - (subscription.current_usage || 0);
    if (remaining <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email subscription limit reached for this billing period'
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('practice_email_logs')
      .insert({
        practice_id: practiceId,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        sender_email: senderEmail,
        sender_name: senderName,
        subject: subject,
        html_content: htmlContent,
        text_content: textContent,
        email_type: emailType,
        provider: 'resend',
        status: 'pending',
        attachments: attachments,
        patient_id: patientId,
        appointment_id: appointmentId,
        visit_id: visitId,
        invoice_id: invoiceId,
        metadata: metadata,
        tags: tags
      })
      .select()
      .single();

    if (logError || !logEntry) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create log entry'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Send email via Resend
    try {
      const emailData: any = {
        from: recipientName ? `${senderName} <${senderEmail}>` : senderEmail,
        to: recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail,
        subject: subject
      };

      if (htmlContent) emailData.html = htmlContent;
      if (textContent) emailData.text = textContent;
      
      if (attachments && attachments.length > 0) {
        emailData.attachments = attachments.map((att: any) => ({
          filename: att.filename,
          content: att.content,
          type: att.type || 'application/octet-stream'
        }));
      }

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      const emailResult = await emailResponse.json();

      if (emailResponse.ok && emailResult.id) {
        // Update log entry as sent
        await supabase
          .from('practice_email_logs')
          .update({
            status: 'sent',
            provider_message_id: emailResult.id,
            sent_at: new Date().toISOString()
          })
          .eq('id', logEntry.id);

        // Update subscription usage
        await supabase
          .from('practice_email_subscriptions')
          .update({
            current_usage: (subscription.current_usage || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id);

        return new Response(
          JSON.stringify({
            success: true,
            logId: logEntry.id,
            messageId: emailResult.id,
            status: 'sent'
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } else {
        // Email sending failed
        await supabase
          .from('practice_email_logs')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            failure_reason: emailResult.message || emailResult.error || 'Unknown error'
          })
          .eq('id', logEntry.id);

        return new Response(
          JSON.stringify({
            success: false,
            logId: logEntry.id,
            status: 'failed',
            error: emailResult.message || emailResult.error || 'Email sending failed'
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } catch (error) {
      // Update log entry as failed
      await supabase
        .from('practice_email_logs')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: error.message
        })
        .eq('id', logEntry.id);

      throw error;
    }
  } catch (error) {
    console.error('Error in centralized-email-gateway:', error);
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