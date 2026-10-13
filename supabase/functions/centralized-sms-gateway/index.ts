import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { TemplateProcessor } from './template-processor.ts';
import { maySendToOptedOutPatient, smsContentForLog } from '../_shared/smsMessagePolicy.ts';
import { maskPhone } from '../_shared/logMask.ts';
import { normalizePhoneNumber, storedPhoneSearchPattern } from '../_shared/smsPhone.ts';
import { constantTimeEqual } from '../_shared/smsReplyPayload.ts';
import { bearerToken, decideGatewayAccess, type GatewayCaller } from '../_shared/smsGatewayAccess.ts';

// CORS headers with additional allowed headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Has the recipient replied STOP (patients.sms_opt_out)? Checks the patient the message is for and
 * every patient file of the practice with the same number (a shared family phone).
 * Before the two-way SMS database change the column does not exist, so nobody has opted out.
 * Any other failure counts as opted out: a non-essential message is never worth that risk.
 */
async function recipientHasOptedOut(
  supabase: SupabaseClient,
  practiceId: string,
  patientId: unknown,
  recipientPhone: string
): Promise<boolean> {
  const columnMissing = (error: { code?: string }) => error.code === '42703';

  if (typeof patientId === 'string' && UUID_PATTERN.test(patientId)) {
    const { data, error } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('sms_opt_out', true)
      .maybeSingle();
    if (error) return !columnMissing(error);
    if (data) return true;
  }

  const recipient = normalizePhoneNumber(recipientPhone);
  const pattern = storedPhoneSearchPattern(recipient);
  if (!recipient || !pattern) return false;
  const { data, error } = await supabase
    .from('patients')
    .select('cell_number')
    .eq('practice_id', practiceId)
    .eq('sms_opt_out', true)
    .ilike('cell_number', pattern)
    .limit(50);
  if (error) return !columnMissing(error);
  return ((data ?? []) as Array<{ cell_number: string | null }>).some(
    (patient) => normalizePhoneNumber(patient.cell_number) === recipient
  );
}

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

    // Who may send: the platform's own functions (service role key) or signed-in, active staff of the practice
    // whose SMS bundle pays for the message. The public anon key alone is no longer enough (see smsGatewayAccess.ts).
    const token = bearerToken(req.headers.get('Authorization'));
    const isServiceKey = !!token && !!supabaseServiceKey && constantTimeEqual(token, supabaseServiceKey);
    let caller: GatewayCaller = { isServiceKey, user: null, staff: null, assignedPracticeIds: [] };
    if (!isServiceKey && token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const [{ data: staff }, { data: assignments }] = await Promise.all([
          supabase.from('users').select('practice_id, is_active, is_super_admin').eq('id', user.id).maybeSingle(),
          supabase.from('user_practice_assignments').select('practice_id').eq('user_id', user.id)
        ]);
        caller = {
          isServiceKey,
          user: { id: user.id },
          staff: staff ?? null,
          assignedPracticeIds: (assignments ?? []).map((row: { practice_id: string }) => row.practice_id)
        };
      }
    }
    const access = decideGatewayAccess(caller, String(practiceId ?? ''));
    if (!access.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: access.error }),
        { status: access.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Function logs are kept and read by support: never a patient's full number or message details (_shared/logMask.ts)
    console.log('SMS Request:', {
      practiceId,
      recipient: maskPhone(recipientPhone),
      messageType,
      templateId,
      metadataKeys: Object.keys(metadata ?? {}),
      queue_id: metadata?.queue_id
    });

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

    // A patient who replied STOP gets only essential messages (appointments, results, replies they
    // asked for). The message type lists are in ../_shared/smsMessagePolicy.ts.
    if (
      !maySendToOptedOutPatient(messageType, metadata) &&
      await recipientHasOptedOut(supabase, practiceId, patientId, String(recipientPhone))
    ) {
      console.log('SMS not sent: the recipient opted out of non-essential SMS', { practiceId, messageType });
      return new Response(
        JSON.stringify({
          success: false,
          status: 'blocked',
          code: 'PATIENT_OPTED_OUT',
          error: 'Not sent: this patient replied STOP to opt out of non-essential SMS. Appointment, results and other essential messages can still be sent.'
        }),
        {
          status: 403,
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

    // Create log entry. A sign-in code is stored hidden: staff can read this table (smsMessagePolicy.ts)
    console.log('Creating log entry');
    const logData = {
      practice_id: practiceId,
      recipient_phone: recipientPhone,
      sender_phone: senderPhone,
      message_content: smsContentForLog(messageType, finalMessageContent),
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
      console.error('Log data that failed:', { practice_id: logData.practice_id, message_type: logData.message_type, recipient: maskPhone(logData.recipient_phone) });
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
      // The app's own rules (normalizePhoneNumber; shared copy in _shared/smsPhone.ts): a number saved without its
      // leading 0 ("81 123 4567") is Namibian, never +81 Japan, and a number that cannot be dialled is refused
      // (the log row records why) instead of being sent to a foreign number
      const cleanPhone = normalizePhoneNumber(recipientPhone);
      if (!cleanPhone) {
        throw new Error('Not a dialable phone number: check the patient\'s cell number');
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
            // The log row id by default: SMSPortal returns it with a patient's reply, so the reply
            // finds its message, practice, patient and appointment (see sms-reply-webhook)
            customerId: metadata.reference || logEntry.id
          }
        ]
      };

      console.log('Sending SMS to SMS Portal v3 API with payload:', {
        ...payload,
        messages: payload.messages.map(m => ({ ...m, destination: maskPhone(m.destination), content: smsContentForLog(messageType, m.content) }))
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
      console.log('SMS Portal response length:', responseText.length);

      let smsResult;
      try {
        smsResult = JSON.parse(responseText);
      } catch {
        // A provider error page may repeat the number: long digit runs are hidden
        const shown = responseText.substring(0, 200).replace(/\d{6,}/g, '***');
        console.error('Failed to parse SMS Portal response as JSON:', shown);
        throw new Error(`Invalid response from SMS Portal: ${shown}`);
      }

      // Check if SMS was accepted
      if (smsResponse.ok) {
        console.log('SMS sent successfully, updating log entry');
        console.log('SMS Result fields:', Object.keys(smsResult ?? {}).join(', '));
        
        // Extract message ID from response - SMS Portal v3 format
        const messageId = smsResult.results?.[0]?.messageId || 
                         smsResult.messageId || 
                         `sent-${Date.now()}`;
        
        console.log('Extracted message ID:', messageId);
        console.log('Queue ID from metadata:', metadata.queue_id);
                         
        // Update log entry as sent
        const updateData = {
          status: 'sent',
          provider_message_id: messageId,
          sent_at: new Date().toISOString(),
          cost_units: smsResult.cost || 1,
          cost_amount: smsResult.cost || 0.05, // Actual cost from response
          provider_response: smsResult
        };

        console.log('Updating log entry with:', { status: updateData.status, provider_message_id: updateData.provider_message_id });

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
            status: updateData.status
          });
        } else {
          console.log('Log entry updated successfully:', updatedLog?.id);
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

        const responseData = {
          success: true,
          logId: logEntry.id,
          messageId: messageId,
          status: 'sent',
          remainingCredits: remaining - 1,
          // Return queue_id from metadata if it exists
          queue_id: metadata.queue_id || null,
          practiceId: practiceId
        };
        
        console.log('SMS Gateway Response:', JSON.stringify(responseData));
        
        return new Response(
          JSON.stringify(responseData),
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
            details: smsResult,
            // Return queue_id from metadata if it exists
            queue_id: metadata.queue_id || null,
            practiceId: practiceId
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