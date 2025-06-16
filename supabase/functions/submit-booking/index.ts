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
    const { formData, practiceSlug, captchaToken } = await req.json()
    
    console.log('Received booking request for practice:', practiceSlug)

    // Initialize Supabase client with service role key for elevated permissions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get practice details - simplified query first
    const { data: practice, error: practiceError } = await supabaseAdmin
      .from('practices')
      .select('*')
      .eq('slug', practiceSlug)
      .single()

    console.log('Practice query result:', { practice: practice?.id, error: practiceError })

    if (practiceError || !practice) {
      console.error('Practice not found:', practiceError)
      throw new Error('Practice not found')
    }

    // Check if online booking is enabled
    if (!practice.features?.online_booking) {
      console.error('Online booking not enabled for practice:', practice.slug)
      throw new Error('Online booking is not available for this practice')
    }

    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone || !formData.date || !formData.time) {
      throw new Error('Missing required fields')
    }

    // Check if patient exists by email
    console.log('Checking for existing patient with email:', formData.email)
    
    const { data: existingPatients, error: patientCheckError } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('email', formData.email.toLowerCase())
      .eq('practice_id', practice.id)
      .limit(1)

    console.log('Patient check result:', { found: existingPatients?.length, error: patientCheckError })

    let patient
    if (existingPatients && existingPatients.length > 0) {
      patient = existingPatients[0]
      console.log('Using existing patient:', patient.id)
    } else {
      // Create new patient with temporary ID number
      const tempIdNumber = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      console.log('Creating new patient with temp ID:', tempIdNumber)
      
      const { data: newPatient, error: patientError } = await supabaseAdmin
        .from('patients')
        .insert({
          first_name: formData.name.split(' ')[0] || 'Guest',
          last_name: formData.name.split(' ').slice(1).join(' ') || '',
          email: formData.email.toLowerCase(),
          cell_number: formData.phone,
          id_number: tempIdNumber,
          date_of_birth: '1990-01-01', // Default date
          gender: 'other', // Default
          practice_id: practice.id
        })
        .select()
        .single()

      if (patientError) {
        console.error('Patient creation error:', patientError)
        throw patientError
      }
      patient = newPatient
      console.log('Created new patient:', patient.id)
    }

    // Create appointment
    console.log('Creating appointment for patient:', patient.id)
    
    const appointmentData = {
      patient_id: patient.id,
      doctor_id: null, // Will be assigned in HPMS portal
      date: formData.date,
      time: formData.time,
      duration: parseInt(formData.duration) || 30,
      type: formData.categoryId || 'consultation',
      status: 'pending', // Online bookings start as pending and need confirmation
      notes: `Service: ${formData.service}
Price: ${formData.price || ''}
Duration: ${formData.duration || ''}
Location: ${formData.location || ''}
Additional Notes: ${formData.notes || ''}`,
      practice_id: practice.id
    }

    console.log('Appointment data:', appointmentData)

    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single()

    if (appointmentError) {
      console.error('Appointment creation error:', appointmentError)
      throw appointmentError
    }

    console.log('Successfully created appointment:', appointment.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Appointment booked successfully!',
        appointmentId: appointment.id
      }),
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
        error: error.message || 'Failed to book appointment',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})