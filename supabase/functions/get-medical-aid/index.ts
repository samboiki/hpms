import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decideRecordAccess, decideStaffAccess, deniedResponse, loadCaller } from '../_shared/callerAccess.ts'

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
    // Get patient ID from URL parameters
    const url = new URL(req.url)
    const patientId = url.searchParams.get('patient_id')

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: 'Missing patient_id parameter' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Create Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // The service role reads past row-level security, so only active staff of the patient's own practice
    // (or a super admin) may read the medical aid. Patient app logins have no staff row and are refused.
    const caller = await loadCaller(supabase, req.headers.get('Authorization'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    const staffAccess = decideStaffAccess(caller)
    if (!staffAccess.allowed) return deniedResponse(staffAccess, corsHeaders)
    const { data: patient } = await supabase.from('patients').select('practice_id').eq('id', patientId).maybeSingle()
    if (!patient) {
      return new Response(
        JSON.stringify({ error: 'Patient not found.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }
    const access = decideRecordAccess(caller, patient.practice_id)
    if (!access.allowed) return deniedResponse(access, corsHeaders)

    // Fetch medical aid details using service role (bypasses RLS)
    const { data, error } = await supabase
      .from('medical_aid_details')
      .select('*')
      .eq('patient_id', patientId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching medical aid:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch medical aid details' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    return new Response(
      JSON.stringify({ data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})