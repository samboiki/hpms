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
    console.log('=== EMAIL GATEWAY REQUEST DEBUG ===');
    console.log('Request data received:', {
      practiceId: requestData.practiceId,
      recipientEmail: requestData.recipientEmail,
      emailType: requestData.emailType,
      hasHtmlContent: !!requestData.htmlContent,
      hasTextContent: !!requestData.textContent,
      hasSenderName: !!requestData.senderName,
      senderName: requestData.senderName,
      hasAttachments: !!(requestData.attachments && requestData.attachments.length > 0),
      attachmentCount: requestData.attachments?.length || 0,
      attachments: requestData.attachments?.map(att => ({
        filename: att.filename,
        contentLength: att.content?.length || 0,
        type: att.type
      })) || []
    });

    const {
      practiceId,
      recipientEmail,
      recipientName,
      senderEmail = defaultSenderEmail,
      senderName,  // Don't set default here - we'll fetch from practice data
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

    // Get practice details for beautiful template and sender name FIRST
    const { data: practice } = await supabase
      .from('practices')
      .select('name, contact_phone, contact_email, logo_url, primary_color, secondary_color, address, domain')
      .eq('id', practiceId)
      .single();
    
    // Use practice name as sender name if not provided
    const finalSenderName = senderName || practice?.name || 'Healthcare Practice';

    // Check if practice has Gmail connected
    const { data: gmailCredentials } = await supabase
      .from('practice_oauth_credentials')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('provider', 'google')
      .single();

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('practice_email_logs')
      .insert({
        practice_id: practiceId,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        sender_email: senderEmail,
        sender_name: finalSenderName,
        subject: finalSubject,
        html_content: finalHtmlContent,
        text_content: finalTextContent,
        email_type: emailType,
        provider: gmailCredentials ? 'gmail' : 'resend',
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

    let emailProvider = 'resend';
    let providerMessageId = null;

    // Send email via Gmail or Resend
    try {
      // Generate beautiful HTML if not provided
      if (!finalHtmlContent && finalTextContent) {
        const templateData: EmailTemplateData = {
          subject: finalSubject,
          content: finalTextContent,
          recipientName: recipientName,
          practiceName: finalSenderName,  // Use the final sender name which includes fallback logic
          practicePhone: practice?.contact_phone,
          practiceEmail: practice?.contact_email,
          practiceWebsite: practice?.domain ? `https://${practice.domain}` : undefined,
          practiceAddress: practice?.address,
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

      let emailSent = false;
      let emailResult: any = {};

      console.log('Gmail check:', {
        hasGmailCredentials: !!gmailCredentials,
        hasRefreshToken: !!(gmailCredentials && gmailCredentials.refresh_token),
        gmailEmail: gmailCredentials?.email,
        emailType: emailType
      });

      // Try Gmail first if connected
      if (gmailCredentials && gmailCredentials.refresh_token) {
        try {
          console.log('Attempting to send via Gmail...');
          emailProvider = 'gmail';
          
          // Check if using app password or OAuth
          const isAppPassword = gmailCredentials.metadata?.auth_type === 'app_password';
          
          if (isAppPassword) {
            // Use Gmail SMTP with app password
            console.log('Using Gmail App Password method...');
            
            const appPassword = atob(gmailCredentials.refresh_token); // Decode base64
            
            // For app passwords, we'll use nodemailer in a separate function
            // For now, we'll fall back to OAuth method
            const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-gmail-smtp', {
              body: {
                from: gmailCredentials.email,
                to: recipientEmail,
                subject: finalSubject,
                html: finalHtmlContent,
                text: finalTextContent,
                credentials: {
                  email: gmailCredentials.email,
                  appPassword
                }
              }
            });
            
            if (sendError) throw sendError;
            
            if (sendResult.success) {
              emailSent = true;
              emailResult = { id: sendResult.messageId };
              providerMessageId = sendResult.messageId;
              console.log('Email sent successfully via Gmail SMTP');
            } else {
              throw new Error(sendResult.error || 'Failed to send via Gmail SMTP');
            }
          } else {
            // OAuth method
            // Get OAuth app credentials
            const { data: oauthApp } = await supabase
              .from('practice_oauth_apps')
              .select('client_id, client_secret')
              .eq('practice_id', practiceId)
              .eq('provider', 'google')
              .single();

            if (oauthApp && oauthApp.client_id && oauthApp.client_secret) {
              
              // Check if access token is expired
              const tokenExpired = gmailCredentials.token_expires_at ? 
                new Date(gmailCredentials.token_expires_at) < new Date() : true;

              let accessToken = gmailCredentials.access_token;

              if (tokenExpired) {
              // Refresh the access token
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

              if (tokenResponse.ok) {
                const tokens = await tokenResponse.json();
                accessToken = tokens.access_token;

                // Update stored tokens
                await supabase
                  .from('practice_oauth_credentials')
                  .update({
                    access_token: tokens.access_token,
                    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', gmailCredentials.id);
              }
              }

              // Create email message in Gmail format with attachment support
            const boundary = 'boundary_' + Math.random().toString(36).substr(2, 9);
            const attachmentBoundary = 'attachment_' + Math.random().toString(36).substr(2, 9);
            
            const emailLines = [
              `From: ${finalSenderName} <${gmailCredentials.email}>`,
              `To: ${recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail}`,
              `Subject: ${finalSubject}`,
              'MIME-Version: 1.0'
            ];

            // Handle mixed content with attachments
            if (attachments && attachments.length > 0) {
              emailLines.push(`Content-Type: multipart/mixed; boundary="${attachmentBoundary}"`);
              emailLines.push('');
              emailLines.push(`--${attachmentBoundary}`);
              emailLines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
              emailLines.push('');
              
              // Text content
              emailLines.push(`--${boundary}`);
              emailLines.push('Content-Type: text/plain; charset=UTF-8');
              emailLines.push('');
              emailLines.push(finalTextContent || '');
              emailLines.push('');
              
              // HTML content
              emailLines.push(`--${boundary}`);
              emailLines.push('Content-Type: text/html; charset=UTF-8');
              emailLines.push('');
              emailLines.push(finalHtmlContent || '');
              emailLines.push('');
              emailLines.push(`--${boundary}--`);
              
              // Add attachments
              for (const attachment of attachments) {
                emailLines.push('');
                emailLines.push(`--${attachmentBoundary}`);
                emailLines.push(`Content-Type: ${attachment.type || 'application/octet-stream'}`);
                emailLines.push('Content-Transfer-Encoding: base64');
                emailLines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
                emailLines.push('');
                emailLines.push(attachment.content);
              }
              
              emailLines.push('');
              emailLines.push(`--${attachmentBoundary}--`);
            } else {
              // No attachments, use alternative boundary
              emailLines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
              emailLines.push('');
              
              // Text content
              emailLines.push(`--${boundary}`);
              emailLines.push('Content-Type: text/plain; charset=UTF-8');
              emailLines.push('');
              emailLines.push(finalTextContent || '');
              emailLines.push('');
              
              // HTML content
              emailLines.push(`--${boundary}`);
              emailLines.push('Content-Type: text/html; charset=UTF-8');
              emailLines.push('');
              emailLines.push(finalHtmlContent || '');
              emailLines.push('');
              emailLines.push(`--${boundary}--`);
            }

            // Encode to base64 with proper UTF-8 handling
            // First encode the string to UTF-8, then to base64
            const messageString = emailLines.join('\r\n');
            const rawMessage = btoa(unescape(encodeURIComponent(messageString)))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '');

            // Send email via Gmail API
            console.log('=== SENDING VIA GMAIL API ===');
            console.log('Access token length:', accessToken?.length || 0);
            console.log('Message length:', rawMessage.length);
            console.log('Has attachments:', !!(attachments && attachments.length > 0));
            
            const gmailResponse = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                raw: rawMessage
              }),
            });

            console.log('Gmail API response status:', gmailResponse.status);
            
            if (gmailResponse.ok) {
              const gmailResult = await gmailResponse.json();
              emailSent = true;
              emailResult = { id: gmailResult.id };
              providerMessageId = gmailResult.id;
              console.log('✅ Email sent successfully via Gmail:', gmailResult);
            } else {
              const errorText = await gmailResponse.text();
              console.error('❌ Gmail API error:', {
                status: gmailResponse.status,
                statusText: gmailResponse.statusText,
                error: errorText
              });
              throw new Error(`Gmail API error: ${errorText}`);
            }
          } else {
            throw new Error('OAuth app credentials not found');
          }
          }
        } catch (gmailError) {
          console.error('❌ Gmail sending failed, falling back to Resend:', gmailError);
          emailProvider = 'resend';
          emailSent = false; // Ensure we try Resend
        }
      }

      // If Gmail didn't work or isn't connected, use Resend
      if (!emailSent) {
        console.log('=== SENDING VIA RESEND ===');
        console.log('Email provider:', emailProvider);
        console.log('Attachments to send:', attachments?.length || 0);
        
        const emailData: Record<string, unknown> = {
          from: `${finalSenderName} <${senderEmail}>`,
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
          console.log('✅ Attachments added to Resend payload:', emailData.attachments.length);
        } else {
          console.log('⚠️ No attachments to add to Resend payload');
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

        try {
          emailResult = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse Resend response:', e);
          emailResult = { error: responseText };
        }

        if (emailResponse.ok && emailResult.id) {
          emailSent = true;
          providerMessageId = emailResult.id;
          console.log('✅ Email sent successfully via Resend:', emailResult.id);
        } else {
          console.error('❌ Resend API failed:', {
            status: emailResponse.status,
            statusText: emailResponse.statusText,
            emailResult: emailResult
          });
        }
      }

      if (emailSent) {
        // Update log entry as sent
        await supabase
          .from('practice_email_logs')
          .update({
            status: 'sent',
            provider: emailProvider,
            provider_message_id: providerMessageId,
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
            messageId: providerMessageId,
            status: 'sent',
            provider: emailProvider,
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