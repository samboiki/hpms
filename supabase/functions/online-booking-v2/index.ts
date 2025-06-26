import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const { formData, practiceSlug, captchaToken } = await req.json();
    console.log('Received booking request for practice:', practiceSlug);
    
    // Initialize Supabase client with service role key for elevated permissions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Get practice details
    const { data: practice, error: practiceError } = await supabaseAdmin
      .from('practices')
      .select('*')
      .eq('slug', practiceSlug)
      .single();
      
    console.log('Practice query result:', {
      practice: practice?.id,
      error: practiceError
    });
    
    if (practiceError || !practice) {
      console.error('Practice not found:', practiceError);
      throw new Error('Practice not found');
    }
    
    // Check if online booking is enabled
    if (!practice.features?.online_booking) {
      console.error('Online booking not enabled for practice:', practice.slug);
      throw new Error('Online booking is not available for this practice');
    }
    
    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone || !formData.date || !formData.time) {
      throw new Error('Missing required fields');
    }
    
    // Check if patient exists by email
    console.log('Checking for existing patient with email:', formData.email);
    let { data: existingPatients, error: patientCheckError } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('email', formData.email.toLowerCase())
      .eq('practice_id', practice.id)
      .limit(1);
      
    console.log('Patient check result:', {
      found: existingPatients?.length,
      error: patientCheckError
    });
    
    let patient;
    if (existingPatients && existingPatients.length > 0) {
      patient = existingPatients[0];
      console.log('Using existing patient:', patient.id);
    } else {
      // Create new patient with temporary ID number
      const tempIdNumber = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('Creating new patient with temp ID:', tempIdNumber);
      
      const { data: newPatient, error: patientError } = await supabaseAdmin
        .from('patients')
        .insert({
          first_name: formData.name.split(' ')[0] || 'Guest',
          last_name: formData.name.split(' ').slice(1).join(' ') || '',
          email: formData.email.toLowerCase(),
          cell_number: formData.phone,
          id_number: tempIdNumber,
          date_of_birth: '1990-01-01', // Default DOB for online bookings
          gender: 'other', // Default gender
          practice_id: practice.id
        })
        .select()
        .single();
        
      if (patientError) {
        console.error('Patient creation error:', patientError);
        throw patientError;
      }
      
      patient = newPatient;
      console.log('Created new patient:', patient.id);
    }
    
    // Create visit with new structure
    console.log('Creating visit for patient:', patient.id);
    
    const visitData = {
      patient_id: patient.id,
      doctor_id: null, // Will be assigned later
      practice_id: practice.id,
      
      // New scheduling fields
      scheduled_date: formData.date,
      scheduled_time: formData.time,
      is_scheduled: true, // Mark as a scheduled booking from website
      is_confirmed: false, // Needs confirmation from practice
      
      // Visit details
      visit_type: formData.categoryId || 'consultation',
      duration: parseInt(formData.duration) || 30,
      status: 'scheduled',
      
      // Additional booking information
      notes: `Online Booking Request
Service: ${formData.service}
Price: ${formData.price || 'Standard rates apply'}
Duration: ${formData.duration || '30'} minutes
Location: ${formData.location || 'Main office'}
Additional Notes: ${formData.notes || 'None'}
Booking Source: Website`,
      
      // Set flags
      is_ready: false,
      is_checked_in: false,
      is_cancelled: false,
      is_no_show: false,
      is_handoff: false,
      
      // Timestamps
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Visit data:', visitData);
    
    const { data: visit, error: visitError } = await supabaseAdmin
      .from('visits')
      .insert(visitData)
      .select()
      .single();
      
    if (visitError) {
      console.error('Visit creation error:', visitError);
      throw visitError;
    }
    
    console.log('Successfully created visit:', visit.id);
    
    // Optional: Create a notification for the practice
    try {
      await supabaseAdmin
        .from('notifications')
        .insert({
          practice_id: practice.id,
          type: 'booking_request',
          title: 'New Online Booking Request',
          message: `${patient.first_name} ${patient.last_name} has requested an appointment for ${formData.date} at ${formData.time}`,
          metadata: {
            visit_id: visit.id,
            patient_id: patient.id,
            service: formData.service,
            date: formData.date,
            time: formData.time
          },
          read: false,
          created_at: new Date().toISOString()
        });
    } catch (notificationError) {
      console.warn('Failed to create notification:', notificationError);
      // Don't fail the booking if notification fails
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Booking request submitted successfully! The practice will confirm your appointment soon.',
        visitId: visit.id,
        requiresConfirmation: true
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      }
    );
    
  } catch (error) {
    console.error('Booking error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to book appointment',
        details: error.toString()
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      }
    );
  }
});