import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { generateEmailHTML, generateEmailText, EmailTemplateData } from './email-template-generator.ts';
import { TemplateProcessor } from './template-processor.ts';

interface EmailAttachment {
  filename: string;
  content: string;
  type?: string;
}

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
    // Debug logging for environment variables
    console.log('=== Email Gateway Debug Start ===');
    console.log('Environment check:', {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasServiceKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasResendKey: !!Deno.env.get('RESEND_API_KEY'),
      hasSenderEmail: !!Deno.env.get('SENDER_EMAIL')
    });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const defaultSenderEmail = Deno.env.get('SENDER_EMAIL') || 'onboarding@resend.dev';

    console.log('Sender email:', defaultSenderEmail);

    if (!resendApiKey) {
      console.error('Resend API key not found in environment');
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

    const requestData = await req.json();
    console.log('Request data received:', {
      ...requestData,
      htmlContent: requestData.htmlContent ? '[HTML CONTENT EXISTS]' : null,
      textContent: requestData.textContent ? '[TEXT CONTENT EXISTS]' : null
    });

    const {
      practiceId,
      recipientEmail,
      recipientName,
      senderEmail = defaultSenderEmail,
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
      tags = [],
      templateId,
      templateVariables = []
    } = requestData;

    // Process template if templateId is provided
    let finalSubject = subject;
    let finalHtmlContent = htmlContent;
    let finalTextContent = textContent;

    if (templateId) {
      const templateProcessor = new TemplateProcessor(supabaseUrl, supabaseServiceKey);
      const processedTemplate = await templateProcessor.processTemplate(templateId, templateVariables);
      
      if (processedTemplate) {
        finalSubject = processedTemplate.subject;
        finalHtmlContent = processedTemplate.htmlContent;
        // Generate text content from HTML if not provided
        if (!textContent) {
          finalTextContent = processedTemplate.htmlContent.replace(/<[^>]*>/g, '').trim();
        }
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Template not found or inactive'
          }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (!practiceId || !recipientEmail || !finalSubject || (!finalHtmlContent && !finalTextContent)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: practiceId, recipientEmail, subject, and either htmlContent or textContent (or valid templateId)'
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
        subject: finalSubject,
        html_content: finalHtmlContent,
        text_content: finalTextContent,
        email_type: emailType,
        provider: 'resend',
        status: 'pending',
        attachments: attachments,
        patient_id: patientId,
        appointment_id: appointmentId,
        visit_id: visitId,
        invoice_id: invoiceId,
        metadata: { ...metadata, template_id: templateId },
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

    // Get practice details for beautiful template
    const { data: practice } = await supabase
      .from('practices')
      .select('name, contact_phone, contact_email, website_url, physical_address, logo_url, primary_color, secondary_color')
      .eq('id', practiceId)
      .single();

    // Send email via Resend
    try {
      // Generate beautiful HTML if not provided
      if (!finalHtmlContent && finalTextContent) {
        const templateData: EmailTemplateData = {
          subject: finalSubject,
          content: finalTextContent,
          recipientName: recipientName,
          practiceName: practice?.name || 'Healthcare Practice',
          practicePhone: practice?.contact_phone,
          practiceEmail: practice?.contact_email,
          practiceWebsite: practice?.website_url,
          practiceAddress: practice?.physical_address,
          practiceLogo: practice?.logo_url,
          primaryColor: practice?.primary_color || '#4f46e5',
          secondaryColor: practice?.secondary_color || '#6366f1'
        };
        
        finalHtmlContent = generateEmailHTML(templateData);
        // Also generate text version if not provided
        if (!finalTextContent) {
          finalTextContent = generateEmailText(templateData);
        }
      }

      const emailData: Record<string, unknown> = {
        from: `${senderName} <${senderEmail}>`,
        to: recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail,
        subject: finalSubject
      };

      if (finalHtmlContent) emailData.html = finalHtmlContent;
      if (finalTextContent) emailData.text = finalTextContent;
      
      if (attachments && attachments.length > 0) {
        emailData.attachments = attachments.map((att: EmailAttachment) => ({
          filename: att.filename,
          content: att.content,
          type: att.type || 'application/octet-stream'
        }));
      }

      console.log('Sending to Resend API:', {
        url: 'https://api.resend.com/emails',
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        hasHtml: !!emailData.html,
        hasText: !!emailData.text,
        hasAttachments: !!(emailData.attachments && emailData.attachments.length > 0)
      });

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      const responseText = await emailResponse.text();
      console.log('Resend API response:', {
        status: emailResponse.status,
        statusText: emailResponse.statusText,
        response: responseText
      });

      let emailResult;
      try {
        emailResult = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse Resend response:', e);
        emailResult = { error: responseText };
      }

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
            status: 'sent',
            // Return queue_id from metadata if it exists
            queue_id: metadata?.automation_id || null,
            practiceId: practiceId
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
    console.error('Error stack:', error.stack);
    console.log('=== Email Gateway Debug End ===');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});