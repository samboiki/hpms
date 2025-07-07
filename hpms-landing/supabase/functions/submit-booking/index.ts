import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { formData, practiceSlug } = await req.json()

    // Initialize Supabase client with service role key for elevated permissions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get practice details
    const { data: practice, error: practiceError } = await supabaseAdmin
      .from('practices')
      .select('*')
      .eq('slug', practiceSlug)
      .single()

    if (practiceError || !practice) {
      throw new Error('Practice not found')
    }

    // Check if patient exists by email
    const { data: existingPatients } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('email', formData.email)
      .limit(1)

    let patient
    if (existingPatients && existingPatients.length > 0) {
      patient = existingPatients[0]
    } else {
      // Create new patient with temporary ID number
      const tempIdNumber = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const { data: newPatient, error: patientError } = await supabaseAdmin
        .from('patients')
        .insert({
          first_name: formData.name.split(' ')[0],
          last_name: formData.name.split(' ').slice(1).join(' ') || '',
          email: formData.email,
          cell_number: formData.phone,
          id_number: tempIdNumber,
          date_of_birth: '1990-01-01', // Default date
          gender: 'other', // Default
          practice_id: practice.id
        })
        .select()
        .single()

      if (patientError) throw patientError
      patient = newPatient
    }

    // Create appointment
    const { error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .insert({
        patient_id: patient.id,
        doctor_id: null, // Will be assigned in HPMS portal
        date: formData.date,
        time: formData.time,
        type: formData.categoryId || 'consultation',
        status: 'pending',
        notes: `Service: ${formData.service}\nPrice: ${formData.price}\nDuration: ${formData.duration}\nLocation: ${formData.location}\nAdditional Notes: ${formData.notes}`,
        practice_id: practice.id
      })

    if (appointmentError) throw appointmentError

    return new Response(
      JSON.stringify({ success: true, message: 'Appointment booked successfully!' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Booking error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to book appointment'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})