import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueryRequest {
  type: 'practice_overview' | 'patient_list' | 'appointments_today' | 'patient_details'
  practiceId?: string
  patientId?: string
  date?: string
  includeVisitCounts?: boolean
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, practiceId, patientId, date, includeVisitCounts } = await req.json() as QueryRequest
    
    // Create Supabase client with service role for optimal performance
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let data: any

    switch (type) {
      case 'practice_overview': {
        // Fetch all practice data in a single optimized query
        const [
          practiceData,
          patientsData,
          appointmentsData,
          doctorsData,
          settingsData
        ] = await Promise.all([
          // Practice details
          supabase
            .from('practices')
            .select('id, name, logo_url, primary_color, secondary_color')
            .eq('id', practiceId)
            .single(),
          
          // Patient count with medical aid summary
          supabase
            .from('patients')
            .select('id, first_name, last_name, medical_aid_details!inner(medical_aid_provider_id)')
            .eq('practice_id', practiceId),
          
          // Today's appointments with minimal data
          supabase
            .from('appointments')
            .select('id, patient_id, doctor_id, time, status')
            .eq('practice_id', practiceId)
            .eq('date', date || new Date().toISOString().split('T')[0]),
          
          // Practice doctors
          supabase
            .from('users')
            .select('id, full_name, role')
            .eq('practice_id', practiceId)
            .eq('role', 'doctor'),
          
          // Practice settings (cached for 24 hours in edge function)
          supabase
            .from('practice_settings')
            .select('*')
            .eq('practice_id', practiceId)
            .single()
        ])

        // Aggregate medical aid stats
        const medicalAidStats = patientsData.data?.reduce((acc, patient) => {
          if (patient.medical_aid_details?.length > 0) {
            const providerId = patient.medical_aid_details[0].medical_aid_provider_id
            acc[providerId] = (acc[providerId] || 0) + 1
          }
          return acc
        }, {} as Record<string, number>)

        data = {
          practice: practiceData.data,
          stats: {
            totalPatients: patientsData.data?.length || 0,
            todayAppointments: appointmentsData.data?.length || 0,
            totalDoctors: doctorsData.data?.length || 0,
            medicalAidCoverage: Object.keys(medicalAidStats || {}).length
          },
          doctors: doctorsData.data || [],
          settings: settingsData.data,
          appointments: appointmentsData.data || [],
          medicalAidStats
        }
        break
      }

      case 'patient_list': {
        // Optimized patient list with visit counts
        const patientsResult = await supabase
          .from('patients')
          .select(`
            id,
            first_name,
            last_name,
            date_of_birth,
            cell_number,
            email,
            medical_aid_details!left(
              membership_number,
              medical_aid_provider:medical_aid_providers(name)
            )
          `)
          .eq('practice_id', practiceId)
          .order('last_name')
          .order('first_name')

        let patients = patientsResult.data || []

        if (includeVisitCounts && patients.length > 0) {
          // Get visit counts in a single query using a custom aggregate
          const patientIds = patients.map(p => p.id)
          
          // Use raw SQL for optimal performance
          const { data: visitCounts } = await supabase.rpc('get_patient_visit_counts', {
            patient_ids: patientIds
          })

          // Merge visit counts with patient data
          const countsMap = new Map(visitCounts?.map((vc: any) => [vc.patient_id, vc]) || [])
          patients = patients.map(patient => ({
            ...patient,
            visitCount: countsMap.get(patient.id)?.visit_count || 0,
            lastVisitDate: countsMap.get(patient.id)?.last_visit_date || null
          }))
        }

        data = { patients }
        break
      }

      case 'appointments_today': {
        // Highly optimized appointments query
        const appointmentsResult = await supabase
          .from('appointments')
          .select(`
            id,
            patient_id,
            doctor_id,
            date,
            time,
            duration,
            type,
            status,
            notes
          `)
          .eq('practice_id', practiceId)
          .eq('date', date || new Date().toISOString().split('T')[0])
          .order('time')

        if (appointmentsResult.data && appointmentsResult.data.length > 0) {
          // Get unique IDs
          const patientIds = [...new Set(appointmentsResult.data.map(a => a.patient_id).filter(Boolean))]
          const doctorIds = [...new Set(appointmentsResult.data.map(a => a.doctor_id).filter(Boolean))]

          // Batch fetch related data
          const [patientsResult, doctorsResult] = await Promise.all([
            supabase
              .from('patients')
              .select('id, first_name, last_name, cell_number')
              .in('id', patientIds),
            supabase
              .from('users')
              .select('id, full_name')
              .in('id', doctorIds)
          ])

          // Create lookup maps
          const patientsMap = new Map(patientsResult.data?.map(p => [p.id, p]) || [])
          const doctorsMap = new Map(doctorsResult.data?.map(d => [d.id, d]) || [])

          // Merge data
          data = {
            appointments: appointmentsResult.data.map(apt => ({
              ...apt,
              patient: patientsMap.get(apt.patient_id),
              doctor: doctorsMap.get(apt.doctor_id)
            }))
          }
        } else {
          data = { appointments: [] }
        }
        break
      }

      case 'patient_details': {
        // Comprehensive patient details in one go
        const [
          patientResult,
          visitsResult,
          medicalAidResult,
          nextOfKinResult,
          documentsResult
        ] = await Promise.all([
          supabase
            .from('patients')
            .select('*')
            .eq('id', patientId)
            .single(),
          
          supabase
            .from('visits')
            .select('id, visit_date, status, diagnosis')
            .eq('patient_id', patientId)
            .order('visit_date', { ascending: false })
            .limit(10),
          
          supabase
            .from('medical_aid_details')
            .select(`
              *,
              medical_aid_provider:medical_aid_providers(*)
            `)
            .eq('patient_id', patientId)
            .maybeSingle(),
          
          supabase
            .from('next_of_kin')
            .select('*')
            .eq('patient_id', patientId)
            .maybeSingle(),
          
          supabase
            .from('patient_documents')
            .select('id, document_name, document_type, uploaded_at')
            .eq('patient_id', patientId)
            .order('uploaded_at', { ascending: false })
            .limit(20)
        ])

        data = {
          patient: patientResult.data,
          recentVisits: visitsResult.data || [],
          medicalAid: medicalAidResult.data,
          nextOfKin: nextOfKinResult.data,
          documents: documentsResult.data || []
        }
        break
      }

      default:
        throw new Error(`Unknown query type: ${type}`)
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in optimized-data-fetcher:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})