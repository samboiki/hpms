import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decidePlatformAccess, deniedResponse } from '../_shared/callerAccess.ts'

// SECURITY: This function processes EACH practice separately
// It ensures complete data isolation between practices
// Uses service role for automation but maintains practice boundaries

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface TemplateStep {
  step_number: number;
  interval_value: number;
  interval_unit: string;
  visit_type: string;
  notes_template: string;
  services_to_schedule: string[];
}

interface Visit {
  id: string;
  patient_id: string;
  practice_id: string;
  branch_id: string;
  doctor_id: string;
  diagnosis?: string;
  preceding_visit_id?: string;
  applied_template_id?: string;
  care_plan_step?: number;
  follow_up_loop_count?: number;
  updated_at?: string;
  status?: string;
  invoices?: Array<{
    invoice_services?: Array<{
      tariff_code: string;
    }>;
  }>;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only the platform (a scheduled job or n8n, with the service role key) may run it: it creates follow-up
  // visits for every practice that switched automation on
  const access = decidePlatformAccess(req.headers.get('Authorization'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  if (!access.allowed) return deniedResponse(access, corsHeaders)

  console.log('🚀 Follow-up automation engine started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all practices with automation enabled
    console.log('📋 Fetching practices with automation enabled...');
    const { data: enabledPractices, error: practicesError } = await supabase
      .from('practices')
      .select('id, name, is_follow_up_automation_enabled')
      .eq('is_follow_up_automation_enabled', true)

    if (practicesError) {
      console.error('❌ Error fetching practices:', practicesError);
      throw practicesError
    }

    console.log(`✅ Found ${enabledPractices?.length || 0} practices with automation enabled`);
    enabledPractices?.forEach(p => console.log(`  - Practice: ${p.id} (${p.name})`));

    if (!enabledPractices || enabledPractices.length === 0) {
      console.log('⚠️ No practices have automation enabled, exiting...');
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
    let loopsPrevented = 0

    // SECURITY: Process each practice in isolation
    // Each iteration only accesses data from ONE practice at a time
    for (const practice of enabledPractices) {
      console.log(`\n🏥 Processing practice: ${practice.id} (${practice.name})`);
      
      // Find recently completed visits (within last 24 hours)
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)
      
      console.log(`⏰ Looking for visits completed after: ${twentyFourHoursAgo.toISOString()}`);

      // SECURITY: Filter by practice_id to ensure data isolation
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
        .eq('practice_id', practice.id) // CRITICAL: Only this practice's visits
        .eq('status', 'completed')
        .gte('updated_at', twentyFourHoursAgo.toISOString())

      if (visitsError) {
        console.error(`❌ Error fetching visits for practice ${practice.id}:`, visitsError)
        continue
      }

      console.log(`📊 Found ${completedVisits?.length || 0} completed visits for practice ${practice.id}`);
      
      if (completedVisits && completedVisits.length > 0) {
        completedVisits.forEach((v: any) => {
          const tariffCodes = v.invoices?.flatMap((inv: any) => 
            inv.invoice_services?.map((s: any) => s.tariff_code) || []
          ) || [];
          console.log(`  - Visit ${v.id}: status=${v.status}, updated=${v.updated_at}, diagnosis="${v.diagnosis || 'none'}", tariffs=[${tariffCodes.join(', ')}]`);
        });
      }

      if (!completedVisits || completedVisits.length === 0) {
        console.log(`⚠️ No completed visits found for practice ${practice.id}`);
        continue
      }

      // SECURITY: Get templates ONLY for this specific practice
      console.log(`📋 Fetching active templates for practice ${practice.id}...`);
      const { data: templates, error: templatesError } = await supabase
        .from('follow_up_templates')
        .select('*')
        .eq('practice_id', practice.id) // CRITICAL: Only this practice's templates
        .eq('is_active', true)

      if (templatesError || !templates) {
        console.error(`❌ Error fetching templates for practice ${practice.id}:`, templatesError)
        continue
      }

      console.log(`✅ Found ${templates?.length || 0} active templates`);
      templates?.forEach(t => {
        console.log(`  - Template: ${t.template_name} (${t.trigger_type}=${t.trigger_value})`);
      });

      // Process each completed visit
      for (const visit of completedVisits as Visit[]) {
        console.log(`\n🔍 Processing visit ${visit.id}...`);
        totalProcessed++

        // Check if visit already has an applied template (continuing a plan)
        if (visit.applied_template_id && visit.care_plan_step) {
          console.log(`  📋 Visit is part of care plan (template: ${visit.applied_template_id}, step: ${visit.care_plan_step})`);
          
          // Continue existing plan
          const template = templates.find(t => t.id === visit.applied_template_id)
          if (!template) {
            console.log(`  ⚠️ Template ${visit.applied_template_id} not found or inactive`);
            continue
          }

          const steps = template.steps as TemplateStep[]
          const nextStepNumber = visit.care_plan_step + 1
          const nextStep = steps.find(s => s.step_number === nextStepNumber)

          if (nextStep) {
            console.log(`  ➡️ Creating next step ${nextStepNumber} of care plan`);
            
            // Calculate scheduled date
            const scheduledDate = calculateFollowUpDate(
              new Date(),
              nextStep.interval_value,
              nextStep.interval_unit
            )

            // Find available slot for the doctor
            const { data: availableSlot } = await supabase
              .rpc('find_next_available_slot', {
                p_doctor_id: visit.doctor_id,
                p_start_date: scheduledDate.toISOString().split('T')[0],
                p_duration: 30, // Default 30 minutes
                p_preferred_time: '09:00:00'
              })
              .single()

            const appointmentDate = availableSlot?.available_date || scheduledDate.toISOString().split('T')[0]
            const appointmentTime = availableSlot?.available_time || '09:00:00'

            console.log(`  📅 Scheduling for ${appointmentDate} at ${appointmentTime}`);

            // SECURITY: New visit inherits practice_id from original visit
            const { error: insertError } = await supabase
              .from('visits')
              .insert({
                patient_id: visit.patient_id,
                practice_id: visit.practice_id, // CRITICAL: Maintains practice isolation
                branch_id: visit.branch_id,
                doctor_id: visit.doctor_id,
                visit_type: getGeneralVisitType(nextStep.visit_type),
                visit_subtype: nextStep.visit_type, // Store specific type
                scheduled_date: appointmentDate,
                scheduled_time: appointmentTime,
                scheduled_duration: 30, // Default duration
                status: 'scheduled',
                notes: nextStep.notes_template?.replace('{trigger_value}', template.trigger_value) || '',
                preceding_visit_id: visit.id,
                applied_template_id: template.id,
                care_plan_step: nextStepNumber,
                follow_up_loop_count: (visit.follow_up_loop_count || 0),
                is_scheduled: true,
              })

            if (!insertError) {
              totalCreated++
              console.log(`  ✅ Created follow-up visit step ${nextStepNumber} for visit ${visit.id}`)
            } else {
              console.error(`  ❌ Error creating follow-up for visit ${visit.id}:`, insertError)
            }
          } else {
            console.log(`  ✅ Care plan completed (no more steps)`);
          }
        } else {
          console.log(`  🔍 Checking if visit triggers any templates...`);
          
          // Check for loop prevention
          const loopCount = await checkFollowUpLoopCount(supabase, visit.id, visit.preceding_visit_id)
          console.log(`  🔄 Current loop count: ${loopCount}`);
          
          if (loopCount >= 3) {
            console.log(`  ⛔ Loop prevention: Visit ${visit.id} has reached max follow-up count`)
            loopsPrevented++
            continue
          }

          // Check if this visit should initiate a new plan
          // First check diagnosis triggers
          if (visit.diagnosis) {
            console.log(`  🏷️ Checking diagnosis: "${visit.diagnosis}"`);
            const matchingTemplate = templates.find(t => 
              t.trigger_type === 'DIAGNOSIS' && 
              t.trigger_value.toLowerCase() === visit.diagnosis!.toLowerCase()
            )

            if (matchingTemplate) {
              console.log(`  ✅ Found matching template: ${matchingTemplate.template_name}`);
              const created = await createFirstFollowUp(
                supabase, 
                visit, 
                matchingTemplate, 
                loopCount + 1
              )
              if (created) {
                totalCreated++
                console.log(`  ✅ Created follow-up from diagnosis trigger`);
              }
              continue
            } else {
              console.log(`  ❌ No template matches diagnosis "${visit.diagnosis}"`);
            }
          }

          // Check tariff code triggers
          if (visit.invoices && visit.invoices.length > 0) {
            const tariffCodes = visit.invoices.flatMap(inv => 
              inv.invoice_services?.map(s => s.tariff_code) || []
            )
            console.log(`  💰 Checking tariff codes: [${tariffCodes.join(', ')}]`);

            // IMPORTANT: Check if we've already created a follow-up for these codes
            const hasExistingFollowUp = await checkExistingFollowUp(
              supabase, 
              visit.id, 
              tariffCodes
            )

            if (hasExistingFollowUp) {
              console.log(`  ⚠️ Follow-up already exists for this visit`);
            } else {
              const matchingTemplate = templates.find(t => 
                t.trigger_type === 'TARIFF_CODE' && 
                tariffCodes.includes(t.trigger_value)
              )

              if (matchingTemplate) {
                console.log(`  ✅ Found matching template: ${matchingTemplate.template_name} for tariff ${matchingTemplate.trigger_value}`);
                const created = await createFirstFollowUp(
                  supabase, 
                  visit, 
                  matchingTemplate, 
                  loopCount + 1
                )
                if (created) {
                  totalCreated++
                  console.log(`  ✅ Created follow-up from tariff code trigger`);
                }
              } else {
                console.log(`  ❌ No template matches tariff codes [${tariffCodes.join(', ')}]`);
              }
            }
          } else {
            console.log(`  ⚠️ Visit has no invoice services`);
          }
        }
      }
    }

    console.log('\n📊 Automation Summary:');
    console.log(`  - Total visits processed: ${totalProcessed}`);
    console.log(`  - Follow-ups created: ${totalCreated}`);
    console.log(`  - Loops prevented: ${loopsPrevented}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Automation engine completed',
        processed: totalProcessed,
        created: totalCreated,
        loopsPrevented
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error in follow-up automation engine:', error)
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

// Map specific visit types to general categories
function getGeneralVisitType(specificType: string): string {
  const typeMap: Record<string, string> = {
    'Periodontal Maintenance': 'follow-up',
    'Root Canal Follow-up': 'follow-up',
    'Post-Extraction Check': 'follow-up',
    'Healing Assessment': 'follow-up',
    'Routine Cleaning': 'routine-checkup',
    'Initial Consultation': 'consultation',
    'Emergency Visit': 'emergency',
    'Surgical Procedure': 'procedure',
  }
  
  return typeMap[specificType] || 'follow-up'
}

// Check how many times this follow-up chain has been triggered
async function checkFollowUpLoopCount(
  supabase: ReturnType<typeof createClient>,
  currentVisitId: string,
  precedingVisitId?: string
): Promise<number> {
  if (!precedingVisitId) return 0
  
  console.log(`    🔄 Checking loop count for chain...`);
  
  // Trace back through the chain to count loops
  const { data: chainData } = await supabase
    .from('visits')
    .select('id, preceding_visit_id, follow_up_loop_count, applied_template_id')
    .or(`id.eq.${currentVisitId},id.eq.${precedingVisitId}`)
  
  if (!chainData || chainData.length === 0) return 0
  
  // Find the highest loop count in the chain
  const maxLoopCount = Math.max(...chainData.map(v => v.follow_up_loop_count || 0))
  console.log(`    🔄 Max loop count in chain: ${maxLoopCount}`);
  return maxLoopCount
}

// Check if a follow-up already exists for this visit
async function checkExistingFollowUp(
  supabase: ReturnType<typeof createClient>,
  visitId: string,
  _tariffCodes: string[] // Currently unused but may be needed for future filtering
): Promise<boolean> {
  console.log(`    🔍 Checking for existing follow-ups...`);
  
  const { data: existingFollowUps } = await supabase
    .from('visits')
    .select('id')
    .eq('preceding_visit_id', visitId)
    .eq('status', 'scheduled')
    .limit(1)
  
  const exists = !!(existingFollowUps && existingFollowUps.length > 0)
  console.log(`    ${exists ? '⚠️ Follow-up already exists' : '✅ No existing follow-up found'}`);
  return exists
}

interface Template {
  id: string;
  trigger_value: string;
  steps: TemplateStep[];
}

async function createFirstFollowUp(
  supabase: ReturnType<typeof createClient>, 
  visit: Visit, 
  template: Template, 
  loopCount: number
): Promise<boolean> {
  console.log(`    🏗️ Creating first follow-up from template ${template.id}...`);
  
  const steps = template.steps as TemplateStep[]
  if (!steps || steps.length === 0) {
    console.log(`    ❌ Template has no steps`);
    return false
  }

  const firstStep = steps[0]
  
  // Skip gestation-based templates in automation
  if (firstStep.interval_unit === 'weeks_gestation') {
    console.log(`    ⚠️ Skipping gestation-based template (requires manual scheduling)`);
    return false
  }

  const scheduledDate = calculateFollowUpDate(
    new Date(),
    firstStep.interval_value,
    firstStep.interval_unit
  )

  console.log(`    📅 Calculated date: ${scheduledDate.toISOString().split('T')[0]}`);

  // Find available slot for the doctor
  const { data: availableSlot, error: slotError } = await supabase
    .rpc('find_next_available_slot', {
      p_doctor_id: visit.doctor_id,
      p_start_date: scheduledDate.toISOString().split('T')[0],
      p_duration: 30,
      p_preferred_time: '09:00:00'
    })
    .single()

  if (slotError) {
    console.log(`    ⚠️ Could not find available slot: ${slotError.message}`);
  }

  const appointmentDate = availableSlot?.available_date || scheduledDate.toISOString().split('T')[0]
  const appointmentTime = availableSlot?.available_time || '09:00:00'

  console.log(`    📅 Final schedule: ${appointmentDate} at ${appointmentTime}`);

  const visitData = {
    patient_id: visit.patient_id,
    practice_id: visit.practice_id,
    branch_id: visit.branch_id,
    doctor_id: visit.doctor_id,
    visit_type: getGeneralVisitType(firstStep.visit_type),
    visit_subtype: firstStep.visit_type,
    scheduled_date: appointmentDate,
    scheduled_time: appointmentTime,
    scheduled_duration: 30,
    status: 'scheduled',
    notes: firstStep.notes_template?.replace('{trigger_value}', template.trigger_value) || '',
    preceding_visit_id: visit.id,
    applied_template_id: template.id,
    care_plan_step: 1,
    follow_up_loop_count: loopCount,
    is_scheduled: true,
  }

  console.log(`    📝 Creating visit with data:`, JSON.stringify(visitData, null, 2));

  const { error: insertError } = await supabase
    .from('visits')
    .insert(visitData)

  if (!insertError) {
    console.log(`    ✅ Successfully created follow-up for visit ${visit.id}`)
    return true
  } else {
    console.error(`    ❌ Error creating follow-up:`, insertError)
    return false
  }
}