import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date().toISOString()

    // Get pending reminders
    const { data: reminders, error: reminderError } = await supabaseClient
      .from('appointment_reminders')
      .select(`
        *,
        appointments!inner(
          id,
          date,
          time,
          patient_id,
          doctor_id,
          practice_id,
          type,
          status
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(50)

    if (reminderError) {
      throw reminderError
    }

    const results = []

    for (const reminder of reminders || []) {
      try {
        const appointment = reminder.appointments

        // Skip if appointment is cancelled
        if (appointment.status === 'cancelled') {
          await supabaseClient
            .from('appointment_reminders')
            .update({ 
              status: 'cancelled',
              error_message: 'Appointment cancelled'
            })
            .eq('id', reminder.id)
          
          results.push({ 
            reminderId: reminder.id, 
            status: 'cancelled', 
            reason: 'appointment_cancelled' 
          })
          continue
        }

        // Get patient and practice info
        const [patientResult, practiceResult, doctorResult] = await Promise.all([
          supabaseClient
            .from('patients')
            .select('*')
            .eq('id', appointment.patient_id)
            .single(),
          supabaseClient
            .from('practices')
            .select('*')
            .eq('id', appointment.practice_id)
            .single(),
          supabaseClient
            .from('users')
            .select('*')
            .eq('id', appointment.doctor_id)
            .single()
        ])

        const patient = patientResult.data
        const practice = practiceResult.data
        const doctor = doctorResult.data

        if (!patient || !practice) {
          throw new Error('Patient or practice not found')
        }

        // Check if patient has a phone number
        if (!patient.cell_number) {
          throw new Error('Patient has no phone number')
        }

        // Check if patient has opted out
        if (!patient.notification_preferences?.reminders) {
          await supabaseClient
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

        // Get reminder template
        const { data: template } = await supabaseClient
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

        // Send SMS using centralized gateway
        const smsResponse = await supabaseClient.functions.invoke('centralized-sms-gateway', {
          body: {
            practiceId: practice.id,
            recipientPhone: patient.cell_number,
            messageContent: messageContent,
            messageType: 'appointment_reminder',
            patientId: patient.id,
            appointmentId: appointment.id,
            metadata: {
              reminderId: reminder.id,
              reminderType: reminder.reminder_type,
              appointmentDate: appointment.date,
              appointmentTime: appointment.time,
              doctorId: appointment.doctor_id,
              source: 'send-appointment-reminders'
            }
          }
        })

        if (smsResponse.error) {
          throw new Error(smsResponse.error.message || 'Failed to send SMS')
        }

        const smsResult = smsResponse.data

        if (smsResult.success) {
          // Update reminder status
          await supabaseClient
            .from('appointment_reminders')
            .update({ 
              status: 'sent',
              sent_at: now,
              message_id: smsResult.messageId || smsResult.logId
            })
            .eq('id', reminder.id)

          results.push({ 
            reminderId: reminder.id, 
            status: 'sent',
            messageId: smsResult.messageId || smsResult.logId
          })
        } else {
          throw new Error(smsResult.error || 'SMS sending failed')
        }

      } catch (error) {
        console.error(`Error processing reminder ${reminder.id}:`, error)
        
        // Update reminder with error
        await supabaseClient
          .from('appointment_reminders')
          .update({ 
            status: 'failed',
            error_message: error.message,
            failed_at: now
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
        success: true, 
        processed: results.length,
        results 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in send-appointment-reminders:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500
      }
    )
  }
})