import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory rate limiting (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const isRateLimited = (ip: string): boolean => {
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxRequests = 3 // Max 3 bookings per 15 minutes per IP

  const current = rateLimitMap.get(ip)
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return false
  }

  if (current.count >= maxRequests) {
    return true
  }

  current.count++
  return false
}

const validateBookingData = (formData: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  // Basic validation
  if (!formData.name || formData.name.length < 2) errors.push('Valid name required')
  if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.push('Valid email required')
  if (!formData.phone || !/^\+?[\d\s\-\(\)]{10,}$/.test(formData.phone)) errors.push('Valid phone required')
  if (!formData.date || new Date(formData.date) <= new Date()) errors.push('Future date required')
  if (!formData.time) errors.push('Time required')
  if (!formData.service) errors.push('Service required')

  // Prevent injection attempts
  const dangerousPatterns = [
    /script/i, /javascript/i, /vbscript/i, /onload/i, /onerror/i,
    /SELECT.*FROM/i, /INSERT.*INTO/i, /DELETE.*FROM/i, /UPDATE.*SET/i,
    /<.*>/i, /\$\{.*\}/i
  ]
  
  const allText = JSON.stringify(formData)
  if (dangerousPatterns.some(pattern => pattern.test(allText))) {
    errors.push('Invalid characters detected')
  }

  return { valid: errors.length === 0, errors }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Rate limiting by IP
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown'
    if (isRateLimited(clientIP)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    const { formData, practiceSlug, captchaToken } = await req.json()

    // Verify CAPTCHA first
    if (captchaToken) {
      const captchaVerifyUrl = `https://www.google.com/recaptcha/api/siteverify`
      const captchaResponse = await fetch(captchaVerifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${Deno.env.get('RECAPTCHA_SECRET_KEY') || '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe'}&response=${captchaToken}`
      })
      
      const captchaResult = await captchaResponse.json()
      if (!captchaResult.success) {
        return new Response(
          JSON.stringify({ success: false, error: 'CAPTCHA verification failed. Please try again.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    // Validate input data
    const validation = validateBookingData(formData)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: validation.errors.join(', ') }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Initialize Supabase with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify practice exists and is active
    const { data: practice, error: practiceError } = await supabaseAdmin
      .from('practices')
      .select('id, name, features')
      .eq('slug', practiceSlug)
      .eq('features->>online_booking', 'true') // Only if online booking enabled
      .single()

    if (practiceError || !practice) {
      return new Response(
        JSON.stringify({ success: false, error: 'Practice not available for online booking' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check for existing patient (limit potential duplicates)
    const { data: existingPatients } = await supabaseAdmin
      .from('patients')
      .select('id, email')
      .eq('email', formData.email)
      .eq('practice_id', practice.id)
      .limit(1)

    let patient
    if (existingPatients && existingPatients.length > 0) {
      patient = existingPatients[0]
    } else {
      // Create patient with additional verification
      const tempIdNumber = `ONLINE-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      const { data: newPatient, error: patientError } = await supabaseAdmin
        .from('patients')
        .insert({
          first_name: formData.name.split(' ')[0].substring(0, 50), // Limit length
          last_name: formData.name.split(' ').slice(1).join(' ').substring(0, 50) || 'N/A',
          email: formData.email.toLowerCase().trim(),
          cell_number: formData.phone.trim(),
          id_number: tempIdNumber,
          date_of_birth: '1990-01-01',
          gender: 'other',
          practice_id: practice.id
        })
        .select('id')
        .single()

      if (patientError) {
        console.error('Patient creation error:', patientError)
        throw new Error('Unable to process booking request')
      }
      patient = newPatient
    }

    // Check for conflicting appointments (prevent double booking)
    const { data: conflictingAppts } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('date', formData.date)
      .eq('time', formData.time)
      .eq('practice_id', practice.id)
      .neq('status', 'cancelled')

    if (conflictingAppts && conflictingAppts.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Time slot no longer available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      )
    }

    // Create appointment
    const { error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .insert({
        patient_id: patient.id,
        doctor_id: null,
        date: formData.date,
        time: formData.time,
        type: 'consultation',
        status: 'pending',
        notes: `Online Booking: ${formData.service}\nRequested by: ${formData.email}${formData.notes ? '\nNotes: ' + formData.notes.substring(0, 500) : ''}`,
        practice_id: practice.id
      })

    if (appointmentError) {
      console.error('Appointment creation error:', appointmentError)
      throw new Error('Unable to create appointment')
    }

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
        error: 'Unable to process booking request. Please try again or contact us directly.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})