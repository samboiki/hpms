import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { TemplateProcessor } from './template-processor.ts';

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
    const smsPortalClientId = Deno.env.get('SMS_PORTAL_CLIENT_ID');
    const smsPortalApiSecret = Deno.env.get('SMS_PORTAL_API_SECRET');

    if (!smsPortalClientId || !smsPortalApiSecret) {
      console.error('SMS Portal credentials missing');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SMS Portal credentials not configured. Please set SMS_PORTAL_CLIENT_ID and SMS_PORTAL_API_SECRET in Edge Function secrets.'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      practiceId,
      recipientPhone,
      senderPhone = 'HPMS',
      messageContent,
      messageType = 'custom',
      patientId,
      appointmentId,
      visitId,
      metadata = {},
      tags = [],
      templateId,
      templateVariables = {}
    } = await req.json();

    console.log('SMS Request:', { practiceId, recipientPhone, messageType, templateId });

    // Process template if templateId is provided
    let finalMessageContent = messageContent;
    
    if (templateId) {
      const templateProcessor = new TemplateProcessor(supabaseUrl, supabaseServiceKey);
      const processedTemplate = await templateProcessor.processTemplate(templateId, templateVariables);
      
      if (processedTemplate) {
        finalMessageContent = processedTemplate.content;
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

    if (!practiceId || !recipientPhone || !finalMessageContent) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: practiceId, recipientPhone, and either messageContent or valid templateId'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check subscription status
    console.log('Checking subscription for practice:', practiceId);
    const { data: subscriptions, error: subError } = await supabase
      .from('practice_sms_subscriptions')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('is_active', true)
      .gte('billing_cycle_end', new Date().toISOString().split('T')[0]) // Use date format YYYY-MM-DD
      .order('created_at', { ascending: false })
      .limit(1);

    if (subError) {
      console.error('Subscription query error:', subError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Subscription check failed: ${subError.message}`
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.error('No active subscription found');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active SMS subscription found for this practice'
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const subscription = subscriptions[0];

    console.log('Subscription found:', subscription.id);

    // Check usage limits
    const remaining = (subscription.monthly_limit || 0) - (subscription.current_usage || 0);
    if (remaining <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SMS subscription limit reached for this billing period'
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create log entry
    console.log('Creating log entry');
    const logData = {
      practice_id: practiceId,
      recipient_phone: recipientPhone,
      sender_phone: senderPhone,
      message_content: finalMessageContent,
      message_type: messageType,
      provider: 'smsportal',
      status: 'pending',
      patient_id: patientId || null,
      appointment_id: appointmentId || null,
      visit_id: visitId || null,
      metadata: { ...metadata, template_id: templateId },
      tags: tags || []
    };

    const { data: logEntry, error: logError } = await supabase
      .from('practice_sms_logs')
      .insert(logData)
      .select()
      .single();

    if (logError) {
      console.error('Log entry creation error:', logError);
      console.error('Log data that failed:', logData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create log entry: ${logError.message}`
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!logEntry) {
      console.error('Log entry not returned');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create log entry - no data returned'
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Log entry created:', logEntry.id);

    // Send SMS via SMS Portal v3 API - Using the working format
    try {
      // Format phone number
      let cleanPhone = recipientPhone.replace(/\D/g, '');
      
      // Handle Namibian numbers
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '264' + cleanPhone.substring(1);
      }
      
      // Add + if not present
      if (!cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone;
      }
      
      // Create Basic Auth credentials
      const credentials = `${smsPortalClientId}:${smsPortalApiSecret}`;
      const encodedCredentials = btoa(credentials);
      
      // SMS Portal v3 payload format with sendOptions
      const payload = {
        sendOptions: {
          allowContentTrimming: true,
          senderId: senderPhone,
          checkOptOuts: true,
          shortenUrls: false,
          testMode: false, // Set to false for real sending
          validityPeriod: 1440 // 24 hours in minutes
        },
        messages: [
          {
            content: finalMessageContent,
            destination: cleanPhone,
            customerId: metadata.reference || `msg-${Date.now()}`
          }
        ]
      };

      console.log('Sending SMS to SMS Portal v3 API with payload:', { 
        ...payload,
        messages: payload.messages.map(m => ({ ...m, destination: m.destination }))
      });

      // Use the v3 endpoint
      const smsResponse = await fetch('https://rest.smsportal.com/v3/BulkMessages', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${encodedCredentials}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      const responseText = await smsResponse.text();
      console.log('SMS Portal response status:', smsResponse.status);
      console.log('SMS Portal response text:', responseText);

      let smsResult;
      try {
        smsResult = JSON.parse(responseText);
      } catch (_e) {
        console.error('Failed to parse SMS Portal response as JSON:', responseText);
        throw new Error(`Invalid response from SMS Portal: ${responseText.substring(0, 200)}`);
      }

      // Check if SMS was accepted
      if (smsResponse.ok) {
        console.log('SMS sent successfully, updating log entry');
        
        // Extract message ID from response - SMS Portal v3 format
        const messageId = smsResult.results?.[0]?.messageId || 
                         smsResult.messageId || 
                         `sent-${Date.now()}`;
        
        console.log('Extracted message ID:', messageId);
                         
        // Update log entry as sent
        const updateData = {
          status: 'sent',
          provider_message_id: messageId,
          sent_at: new Date().toISOString(),
          cost_units: smsResult.cost || 1,
          cost_amount: smsResult.cost || 0.05, // Actual cost from response
          provider_response: smsResult
        };

        console.log('Updating log entry with:', updateData);

        const { data: updatedLog, error: updateError } = await supabase
          .from('practice_sms_logs')
          .update(updateData)
          .eq('id', logEntry.id)
          .select()
          .single();

        if (updateError) {
          console.error('Failed to update log entry:', updateError);
          console.error('Update error details:', { 
            error: updateError, 
            logId: logEntry.id,
            updateData 
          });
        } else {
          console.log('Log entry updated successfully:', updatedLog);
        }

        // Update subscription usage
        const { error: subUpdateError } = await supabase
          .from('practice_sms_subscriptions')
          .update({
            current_usage: (subscription.current_usage || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id);

        if (subUpdateError) {
          console.error('Failed to update subscription usage:', subUpdateError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            logId: logEntry.id,
            messageId: messageId,
            status: 'sent',
            remainingCredits: remaining - 1
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      } else {
        // SMS sending failed - handle different error formats
        const failureReason = smsResult.error || 
                            smsResult.message || 
                            smsResult.errors || 
                            smsResult.title ||
                            smsResult.detail ||
                            JSON.stringify(smsResult);

        const failureData = {
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: failureReason,
          provider_response: smsResult
        };

        await supabase
          .from('practice_sms_logs')
          .update(failureData)
          .eq('id', logEntry.id);

        return new Response(
          JSON.stringify({
            success: false,
            logId: logEntry.id,
            status: 'failed',
            error: failureReason,
            details: smsResult
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    } catch (error) {
      console.error('SMS sending error:', error);
      // Update log entry as failed
      await supabase
        .from('practice_sms_logs')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: error.message
        })
        .eq('id', logEntry.id);

      throw error;
    }
  } catch (error) {
    console.error('Error in centralized-sms-gateway:', error);
    console.error('Error stack:', error.stack);
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