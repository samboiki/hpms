import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutomationQueueItem {
  id: string
  practice_id: string
  trigger_type: string
  payload: any
  status: string
  scheduled_for: string
}

interface PracticeSettings {
  automation_id: string
  enabled: boolean
  sms_enabled: boolean
  email_enabled: boolean
  sms_template: string
  email_subject: string
  email_body: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get batch size from request body (default to 10)
    const { batchSize = 10 } = await req.json()

    console.log(`Processing automation queue with batch size: ${batchSize}`)

    // Call RPC function to get pending automations
    const { data: pendingAutomations, error: rpcError } = await supabase
      .rpc('get_pending_welcome_automations', { batch_size: batchSize })

    if (rpcError) {
      console.error('Error fetching pending automations:', rpcError)
      throw new Error(`Failed to fetch pending automations: ${rpcError.message}`)
    }

    if (!pendingAutomations || pendingAutomations.length === 0) {
      console.log('No pending automations found')
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: 'No pending automations to process'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log(`Found ${pendingAutomations.length} automations to process`)

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as any[]
    }

    // Process each automation
    for (const automation of pendingAutomations) {
      try {
        console.log(`Processing automation ${automation.queue_id} for practice ${automation.practice_id}`)

        // Parse payload
        const payload = automation.payload

        // Replace template variables
        const replacePlaceholders = (template: string, data: any) => {
          return template
            .replace(/{{patientName}}/g, data.patientName || '')
            .replace(/{{practiceName}}/g, data.practiceName || '')
            .replace(/{{practicePhone}}/g, data.practicePhone || '')
            .replace(/{{practiceEmail}}/g, data.practiceEmail || '')
        }

        // Send SMS if enabled
        if (automation.sms_enabled && payload.patientPhone) {
          try {
            const smsContent = replacePlaceholders(automation.sms_template, payload)
            
            console.log(`Sending SMS to ${payload.patientPhone}`)
            
            const smsResponse = await fetch(`${SUPABASE_URL}/functions/v1/centralized-sms-gateway`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                practiceId: automation.practice_id,
                recipientPhone: payload.patientPhone,
                messageContent: smsContent,
                messageType: 'general',
                patientId: payload.patient_id,
                metadata: {
                  automation_id: automation.automation_id,
                  queue_id: automation.queue_id,
                  trigger_type: automation.trigger_type
                }
              })
            })

            if (!smsResponse.ok) {
              const errorText = await smsResponse.text()
              console.error('SMS send failed:', errorText)
              throw new Error(`SMS send failed: ${errorText}`)
            }

            const smsResult = await smsResponse.json()
            console.log('SMS sent successfully:', smsResult)
          } catch (smsError) {
            console.error('SMS error:', smsError)
            // Continue processing even if SMS fails
          }
        }

        // Send Email if enabled
        if (automation.email_enabled && payload.patientEmail) {
          try {
            // Check if practice has Gmail connected
            const { data: oauthCreds } = await supabase
              .from('practice_oauth_credentials')
              .select('refresh_token, email')
              .eq('practice_id', automation.practice_id)
              .eq('provider', 'google')
              .single()

            if (oauthCreds && oauthCreds.refresh_token) {
              // Send via Gmail
              console.log(`Sending email via Gmail to ${payload.patientEmail}`)
              
              const emailSubject = replacePlaceholders(automation.email_subject, payload)
              const emailBody = replacePlaceholders(automation.email_body, payload)
              
              // TODO: Implement Gmail sending using refresh token
              // For now, we'll use the centralized email gateway
            }

            // Fallback to centralized email gateway
            const emailSubject = replacePlaceholders(automation.email_subject, payload)
            const emailBody = replacePlaceholders(automation.email_body, payload)
            
            console.log(`Sending email to ${payload.patientEmail}`)
            
            const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/centralized-email-gateway`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                practiceId: automation.practice_id,
                recipientEmail: payload.patientEmail,
                subject: emailSubject,
                htmlContent: emailBody,
                emailType: 'general',
                patientId: payload.patient_id,
                metadata: {
                  automation_id: automation.automation_id,
                  queue_id: automation.queue_id,
                  trigger_type: automation.trigger_type
                }
              })
            })

            if (!emailResponse.ok) {
              const errorText = await emailResponse.text()
              console.error('Email send failed:', errorText)
              throw new Error(`Email send failed: ${errorText}`)
            }

            const emailResult = await emailResponse.json()
            console.log('Email sent successfully:', emailResult)
          } catch (emailError) {
            console.error('Email error:', emailError)
            // Continue processing even if email fails
          }
        }

        // Mark automation as completed
        const { error: updateError } = await supabase
          .from('automation_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', automation.queue_id)

        if (updateError) {
          console.error('Failed to update automation status:', updateError)
        }

        results.processed++
        results.succeeded++
      } catch (error) {
        console.error(`Error processing automation ${automation.queue_id}:`, error)
        
        // Mark automation as failed
        await supabase
          .from('automation_queue')
          .update({
            status: 'failed',
            error_message: error.message,
            retry_count: automation.retry_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', automation.queue_id)

        results.processed++
        results.failed++
        results.errors.push({
          queue_id: automation.queue_id,
          error: error.message
        })
      }
    }

    console.log('Automation processing complete:', results)

    return new Response(
      JSON.stringify({
        success: true,
        ...results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Process automation queue error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})