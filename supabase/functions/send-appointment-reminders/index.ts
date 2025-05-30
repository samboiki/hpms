import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SMSPortalMessage {
  to: string
  content: string
  reference?: string
}

interface SMSPortalResponse {
  messages: Array<{
    messageId: string
    status: string
    error?: string
  }>
  cost?: number
  remainingCredits?: number
}

async function sendSMSViaPortal(
  clientId: string,
  apiSecret: string,
  messages: SMSPortalMessage[]
): Promise<SMSPortalResponse> {
  const credentials = btoa(`${clientId}:${apiSecret}`)
  
  const response = await fetch('https://rest.smsportal.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  })

  if (!response.ok) {
    throw new Error(`SMS Portal API Error: ${response.status}`)
  }

  return await response.json()
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current time
    const now = new Date().toISOString()

    // Fetch pending reminders that should be sent now
    const { data: reminders, error: fetchError } = await supabase
      .from('appointment_reminders')
      .select(`
        *,
        appointments(
          *,
          patients(*),
          users!doctor_id(*),
          practices(*)
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .lt('attempts', 3)

    if (fetchError) {
      throw new Error(`Failed to fetch reminders: ${fetchError.message}`)
    }

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No reminders to send', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    // Process each reminder
    for (const reminder of reminders) {
      try {
        const appointment = reminder.appointments
        const patient = appointment.patients
        const doctor = appointment.users
        const practice = appointment.practices

        // Check if patient has opted out
        if (!patient.notification_preferences?.reminders) {
          await supabase
            .from('appointment_reminders')
            .update({ 
              status: 'cancelled',
              error_message: 'Patient opted out of reminders'
            })
            .eq('id', reminder.id)
          
          results.push({ 
            reminderId: reminder.id, 
            status: 'cancelled', 
            reason: 'opted_out' 
          })
          continue
        }

        // Check if practice has SMS enabled
        const smsSettings = practice.notification_settings?.sms
        if (!smsSettings?.enabled || !smsSettings?.credentials) {
          results.push({ 
            reminderId: reminder.id, 
            status: 'skipped', 
            reason: 'sms_not_configured' 
          })
          continue
        }

        // Get reminder template
        const { data: template } = await supabase
          .from('reminder_templates')
          .select('*')
          .eq('practice_id', practice.id)
          .eq('type', 'appointment_reminder')
          .eq('timing', reminder.reminder_type)
          .eq('is_active', true)
          .single()

        if (!template) {
          throw new Error('No active template found')
        }

        // Format appointment time
        const appointmentDate = new Date(`${appointment.date}T${appointment.time}`)
        const formattedDate = appointmentDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        })
        const formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        })

        // Replace template variables
        let messageContent = template.content
        const variables = {
          patient_name: `${patient.first_name} ${patient.last_name}`,
          doctor_name: doctor.user_metadata?.full_name || 'Doctor',
          appointment_date: formattedDate,
          appointment_time: formattedTime,
          practice_name: practice.name || 'the clinic',
        }

        for (const [key, value] of Object.entries(variables)) {
          messageContent = messageContent.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value)
        }

        // Send SMS
        const smsResponse = await sendSMSViaPortal(
          smsSettings.credentials.clientId,
          smsSettings.credentials.apiSecret,
          [{
            to: patient.cell_number,
            content: messageContent,
            reference: `reminder-${reminder.id}`
          }]
        )

        const messageSent = smsResponse.messages[0]

        if (messageSent.status === 'sent') {
          // Create message record
          const { data: message } = await supabase
            .from('messages')
            .insert({
              type: 'sms',
              recipient: patient.cell_number,
              content: messageContent,
              status: 'sent',
              sent_at: now,
              practice_id: practice.id,
              metadata: {
                appointment_id: appointment.id,
                reminder_id: reminder.id,
                sms_message_id: messageSent.messageId,
              }
            })
            .select()
            .single()

          // Update reminder status
          await supabase
            .from('appointment_reminders')
            .update({
              status: 'sent',
              message_id: message?.id,
              updated_at: now
            })
            .eq('id', reminder.id)

          // Update appointment
          await supabase
            .from('appointments')
            .update({ reminder_sent_at: now })
            .eq('id', appointment.id)

          results.push({
            reminderId: reminder.id,
            status: 'sent',
            messageId: messageSent.messageId
          })
        } else {
          throw new Error(messageSent.error || 'Failed to send SMS')
        }
      } catch (error) {
        // Update reminder with error
        await supabase
          .from('appointment_reminders')
          .update({
            status: 'failed',
            error_message: error.message,
            attempts: reminder.attempts + 1,
            last_attempt_at: now
          })
          .eq('id', reminder.id)

        results.push({
          reminderId: reminder.id,
          status: 'failed',
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Reminders processed',
        processed: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})