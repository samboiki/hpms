import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TemplateStep {
  step_number: number;
  interval_value: number;
  interval_unit: string;
  visit_type: string;
  notes_template: string;
  services_to_schedule: string[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all practices with automation enabled
    const { data: enabledPractices, error: practicesError } = await supabase
      .from('practices')
      .select('id')
      .eq('is_follow_up_automation_enabled', true)

    if (practicesError) throw practicesError

    if (!enabledPractices || enabledPractices.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No practices have automation enabled',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalProcessed = 0
    let totalCreated = 0

    // Process each enabled practice
    for (const practice of enabledPractices) {
      // Find recently completed visits (within last 24 hours)
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const { data: completedVisits, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          invoices:invoices_enhanced!visit_id(
            invoice_services!inner(
              tariff_code
            )
          )
        `)
        .eq('practice_id', practice.id)
        .eq('status', 'completed')
        .gte('updated_at', twentyFourHoursAgo.toISOString())

      if (visitsError) {
        console.error(`Error fetching visits for practice ${practice.id}:`, visitsError)
        continue
      }

      if (!completedVisits) continue

      // Get active templates for this practice
      const { data: templates, error: templatesError } = await supabase
        .from('follow_up_templates')
        .select('*')
        .eq('practice_id', practice.id)
        .eq('is_active', true)

      if (templatesError || !templates) {
        console.error(`Error fetching templates for practice ${practice.id}:`, templatesError)
        continue
      }

      // Process each completed visit
      for (const visit of completedVisits) {
        totalProcessed++

        // Check if visit already has an applied template (continuing a plan)
        if (visit.applied_template_id && visit.care_plan_step) {
          // Continue existing plan
          const template = templates.find(t => t.id === visit.applied_template_id)
          if (!template) continue

          const steps = template.steps as TemplateStep[]
          const nextStepNumber = visit.care_plan_step + 1
          const nextStep = steps.find(s => s.step_number === nextStepNumber)

          if (nextStep) {
            // Calculate scheduled date
            const scheduledDate = calculateFollowUpDate(
              new Date(),
              nextStep.interval_value,
              nextStep.interval_unit
            )

            // Create next visit in the care plan
            const { error: insertError } = await supabase
              .from('visits')
              .insert({
                patient_id: visit.patient_id,
                practice_id: visit.practice_id,
                branch_id: visit.branch_id,
                doctor_id: visit.doctor_id,
                visit_type: nextStep.visit_type || 'Follow-up',
                scheduled_date: scheduledDate.toISOString().split('T')[0],
                scheduled_time: '09:00:00',
                status: 'scheduled',
                notes: nextStep.notes_template?.replace('{trigger_value}', template.trigger_value) || '',
                preceding_visit_id: visit.id,
                applied_template_id: template.id,
                care_plan_step: nextStepNumber,
                is_scheduled: true,
              })

            if (!insertError) {
              totalCreated++
              console.log(`Created follow-up visit step ${nextStepNumber} for visit ${visit.id}`)
            } else {
              console.error(`Error creating follow-up for visit ${visit.id}:`, insertError)
            }
          }
        } else {
          // Check if this visit should initiate a new plan
          // First check diagnosis triggers
          if (visit.diagnosis) {
            const matchingTemplate = templates.find(t => 
              t.trigger_type === 'DIAGNOSIS' && 
              t.trigger_value.toLowerCase() === visit.diagnosis.toLowerCase()
            )

            if (matchingTemplate) {
              totalCreated = await createFirstFollowUp(supabase, visit, matchingTemplate, totalCreated)
              continue
            }
          }

          // Check tariff code triggers
          if (visit.invoices && visit.invoices.length > 0) {
            const tariffCodes = visit.invoices.flatMap(inv => 
              inv.invoice_services?.map(s => s.tariff_code) || []
            )

            const matchingTemplate = templates.find(t => 
              t.trigger_type === 'TARIFF_CODE' && 
              tariffCodes.includes(t.trigger_value)
            )

            if (matchingTemplate) {
              totalCreated = await createFirstFollowUp(supabase, visit, matchingTemplate, totalCreated)
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Automation engine completed',
        processed: totalProcessed,
        created: totalCreated
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in follow-up automation engine:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

function calculateFollowUpDate(baseDate: Date, intervalValue: number, intervalUnit: string): Date {
  const result = new Date(baseDate)
  
  switch (intervalUnit) {
    case 'Days':
      result.setDate(result.getDate() + intervalValue)
      break
    case 'Weeks':
      result.setDate(result.getDate() + (intervalValue * 7))
      break
    case 'Months':
      result.setMonth(result.getMonth() + intervalValue)
      break
    case 'weeks_gestation':
      // For gestation weeks, this would need special handling with EDD
      // For now, we'll skip these in automated processing
      break
  }
  
  return result
}

async function createFirstFollowUp(
  supabase: ReturnType<typeof createClient>, 
  visit: Record<string, unknown>, 
  template: Record<string, unknown>, 
  totalCreated: number
): Promise<number> {
  const steps = template.steps as TemplateStep[]
  if (!steps || steps.length === 0) return totalCreated

  const firstStep = steps[0]
  
  // Skip gestation-based templates in automation
  if (firstStep.interval_unit === 'weeks_gestation') return totalCreated

  const scheduledDate = calculateFollowUpDate(
    new Date(),
    firstStep.interval_value,
    firstStep.interval_unit
  )

  const { error: insertError } = await supabase
    .from('visits')
    .insert({
      patient_id: visit.patient_id,
      practice_id: visit.practice_id,
      branch_id: visit.branch_id,
      doctor_id: visit.doctor_id,
      visit_type: firstStep.visit_type || 'Follow-up',
      scheduled_date: scheduledDate.toISOString().split('T')[0],
      scheduled_time: '09:00:00',
      status: 'scheduled',
      notes: firstStep.notes_template?.replace('{trigger_value}', template.trigger_value) || '',
      preceding_visit_id: visit.id,
      applied_template_id: template.id,
      care_plan_step: 1,
      is_scheduled: true,
    })

  if (!insertError) {
    console.log(`Created initial follow-up for visit ${visit.id} using template ${template.id}`)
    return totalCreated + 1
  } else {
    console.error(`Error creating initial follow-up for visit ${visit.id}:`, insertError)
    return totalCreated
  }
}