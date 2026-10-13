import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { decidePracticeAccess, deniedResponse, loadCaller } from '../_shared/callerAccess.ts'

// SECURITY: This function generates templates ONLY for the specified practice
// It does not access data from other practices

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Tariff {
  code: string;
  description: string;
}

interface TemplateStep {
  step_number: number;
  interval_value: number;
  interval_unit: string;
  visit_type: string;
  notes_template: string;
  services_to_schedule: string[];
}

interface FollowUpTemplate {
  template_name: string;
  trigger_type: 'DIAGNOSIS' | 'TARIFF_CODE';
  trigger_value: string;
  steps: TemplateStep[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Generating spends the OpenAI key: signed-in, active staff of the practice only (with none named, their own).
  // The body is read before the progress stream starts, so a refusal is a plain 401/403 answer.
  const body = await req.json().catch(() => null)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const caller = await loadCaller(createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey), req.headers.get('Authorization'), serviceRoleKey)
  const access = decidePracticeAccess(caller, body?.practiceId)
  if (!access.allowed) return deniedResponse(access, corsHeaders)

  // Create a text encoder for streaming
  const encoder = new TextEncoder()

  // Create a readable stream for sending progress updates
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!
        const { practiceType, practiceTypeName, tariffs, existingTriggers } = body ?? {}
        const practiceId = access.practiceId

        // Send initial progress
        controller.enqueue(encoder.encode(JSON.stringify({ 
          type: 'progress', 
          stage: 'initialization',
          message: 'Starting template generation...',
          progress: 0 
        }) + '\n'))

        if (!practiceId || !practiceType || !tariffs) {
          throw new Error('Missing required parameters')
        }

        console.log(`Received ${tariffs.length} tariff codes for ${practiceTypeName}`)
        
        // Send tariff analysis progress
        controller.enqueue(encoder.encode(JSON.stringify({ 
          type: 'progress', 
          stage: 'analysis',
          message: `Analyzing ${tariffs.length} tariff codes...`,
          progress: 10 
        }) + '\n'))

        // SECURITY: The practiceId should be validated by the caller
        // This function only generates templates, it doesn't fetch existing data

        // Prioritize surgical/procedural codes that typically need follow-ups
        const surgicalKeywords = ['extraction', 'surgery', 'implant', 'root canal', 'crown', 'bridge', 'graft', 'procedure', 'removal', 'excision', 'biopsy', 'repair', 'suture', 'anesthesia']
        const priorityTariffs = tariffs.filter((t: Tariff) => 
          surgicalKeywords.some(keyword => t.description.toLowerCase().includes(keyword))
        )
        const otherTariffs = tariffs.filter((t: Tariff) => 
          !surgicalKeywords.some(keyword => t.description.toLowerCase().includes(keyword))
        )

        // Send prioritization progress
        controller.enqueue(encoder.encode(JSON.stringify({ 
          type: 'progress', 
          stage: 'prioritization',
          message: `Found ${priorityTariffs.length} priority procedures and ${otherTariffs.length} other services`,
          progress: 20 
        }) + '\n'))

        // Create chunks for processing - smaller chunks to avoid timeouts
        const CHUNK_SIZE = 20
        const priorityChunks = []
        for (let i = 0; i < Math.min(priorityTariffs.length, 40); i += CHUNK_SIZE) {
          priorityChunks.push(priorityTariffs.slice(i, i + CHUNK_SIZE))
        }
        
        // Add one chunk of other tariffs
        if (otherTariffs.length > 0) {
          priorityChunks.push(otherTariffs.slice(0, 10))
        }

        console.log(`Processing ${priorityChunks.length} chunks of tariff codes`)
        
        const allTemplates: FollowUpTemplate[] = []

        // Process each chunk
        for (let chunkIndex = 0; chunkIndex < priorityChunks.length; chunkIndex++) {
          const chunk = priorityChunks[chunkIndex]
          const progressPercent = 20 + Math.floor((chunkIndex / priorityChunks.length) * 60)
          
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'progress', 
            stage: 'ai_generation',
            message: `Processing chunk ${chunkIndex + 1} of ${priorityChunks.length} (${chunk.length} codes)...`,
            progress: progressPercent 
          }) + '\n'))

          // Prepare the prompt for this chunk
          const prompt = `
You are an expert healthcare consultant specializing in evidence-based follow-up care protocols. Your task is to analyze the specific practice type and available services, then generate comprehensive follow-up templates.

Practice Type: ${practiceTypeName || practiceType}
Services/Tariffs for this batch (${chunkIndex + 1} of ${priorityChunks.length}):
${chunk.map((t: Tariff) => `- ${t.code}: ${t.description}`).join('\n')}

IMPORTANT: You must research and understand what a "${practiceTypeName || practiceType}" practice typically handles and generate appropriate follow-up protocols for THAT SPECIFIC type of practice.

YOUR TASK:
1. Analyze the practice type name and the available tariff codes/services
2. Research common conditions, procedures, and care protocols for ${practiceTypeName || practiceType} practices
3. Generate 3-5 follow-up templates for THIS SPECIFIC BATCH that are relevant to ${practiceTypeName || practiceType}
4. Base your recommendations on evidence-based guidelines specific to ${practiceTypeName || practiceType}

TEMPLATE STRUCTURE (JSON):
{
  "template_name": "Clear, professional protocol name relevant to ${practiceTypeName || practiceType}",
  "trigger_type": "DIAGNOSIS" or "TARIFF_CODE",
  "trigger_value": "Specific diagnosis or tariff code from the provided list",
  "steps": [
    {
      "step_number": 1,
      "interval_value": [number],
      "interval_unit": "Days" or "Weeks" or "Months" or "weeks_gestation",
      "visit_type": "Specific follow-up type",
      "notes_template": "Pre-filled notes with clinical checkpoints. Use {trigger_value} placeholder",
      "services_to_schedule": ["Array of tariff codes from provided list"]
    }
  ]
}

RESEARCH AND ANALYSIS REQUIRED:
- What conditions does a ${practiceTypeName || practiceType} practice typically treat?
- What procedures are commonly performed in ${practiceTypeName || practiceType}?
- What are the evidence-based follow-up protocols for ${practiceTypeName || practiceType}?
- What preventive care is relevant to ${practiceTypeName || practiceType}?
- What chronic conditions might ${practiceTypeName || practiceType} manage?
- What post-procedure care is standard in ${practiceTypeName || practiceType}?

Based on the tariff codes provided, focus on generating templates for procedures that TRULY need follow-up care:
- Surgical procedures
- Complex treatments requiring healing checks
- Multi-step procedures
- Conditions requiring monitoring

DO NOT create templates for:
- Simple consultations
- Basic examinations
- Administrative codes
- One-time procedures without follow-up needs

${existingTriggers && existingTriggers.length > 0 ? `
IMPORTANT: The following triggers already have templates, DO NOT duplicate:
${existingTriggers.slice(0, 20).join('\n')}${existingTriggers.length > 20 ? `\n... and ${existingTriggers.length - 20} more` : ''}
` : ''}

QUALITY REQUIREMENTS:
1. Templates must be clinically appropriate for ${practiceTypeName || practiceType}
2. Use actual tariff codes from the provided list
3. Include both single-visit and multi-step care plans
4. Consider preventive care, acute care follow-up, and chronic disease management relevant to ${practiceTypeName || practiceType}
5. Notes should include specific clinical checkpoints
6. Timing must align with best practices for ${practiceTypeName || practiceType}

Generate templates that will improve patient outcomes and practice efficiency for this specific ${practiceTypeName || practiceType} practice.

Return ONLY a valid JSON array of templates.`

          try {

            // Call OpenAI API for this chunk
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: `You are an expert healthcare consultant with deep knowledge of various medical specialties and their specific protocols. Generate 3-5 highly specific follow-up templates for the given procedures. Focus on quality over quantity.`
                  },
                  {
                    role: 'user',
                    content: prompt
                  }
                ],
                temperature: 0.3,  // Lower temperature for more consistent output
                max_tokens: 2000,  // Smaller token limit per chunk
              }),
            })

            if (!response.ok) {
              console.error(`OpenAI API error for chunk ${chunkIndex + 1}: ${response.statusText}`)
              continue  // Skip this chunk and continue with others
            }

            const openaiData = await response.json()
            const generatedContent = openaiData.choices[0]?.message?.content

            if (!generatedContent) {
              console.error(`No content generated for chunk ${chunkIndex + 1}`)
              continue
            }

            // Parse the generated templates
            let templates: FollowUpTemplate[]
            try {
              // Remove any markdown formatting if present
              const cleanContent = generatedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
              templates = JSON.parse(cleanContent)
            } catch {
              console.error(`Failed to parse AI response for chunk ${chunkIndex + 1}:`, generatedContent)
              continue
            }

            // Validate templates
            if (!Array.isArray(templates)) {
              console.error(`AI did not generate a valid array for chunk ${chunkIndex + 1}`)
              continue
            }

            // Basic validation of template structure
            const validatedTemplates = templates.filter(template => {
              return (
                template.template_name &&
                template.trigger_type &&
                template.trigger_value &&
                Array.isArray(template.steps) &&
                template.steps.length > 0 &&
                template.steps.every(step => 
                  step.step_number &&
                  step.interval_value &&
                  step.interval_unit &&
                  step.visit_type
                )
              )
            })

            // Add to all templates
            allTemplates.push(...validatedTemplates)
            
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'progress', 
              stage: 'ai_generation',
              message: `Generated ${validatedTemplates.length} templates from chunk ${chunkIndex + 1}`,
              progress: progressPercent + 10,
              templatesGenerated: allTemplates.length
            }) + '\n'))

          } catch (error) {
            console.error(`Error processing chunk ${chunkIndex + 1}:`, error)
            // Continue with next chunk
          }
        }

        // Send final progress
        controller.enqueue(encoder.encode(JSON.stringify({ 
          type: 'progress', 
          stage: 'completion',
          message: `Generation complete! Created ${allTemplates.length} templates.`,
          progress: 90 
        }) + '\n'))

        // Remove duplicates based on trigger_value
        const uniqueTemplates = allTemplates.reduce((acc, template) => {
          const key = `${template.trigger_type}:${template.trigger_value}`
          if (!acc.some(t => `${t.trigger_type}:${t.trigger_value}` === key)) {
            acc.push(template)
          }
          return acc
        }, [] as FollowUpTemplate[])

        // Send final result
        controller.enqueue(encoder.encode(JSON.stringify({ 
          type: 'result',
          success: true, 
          templates: uniqueTemplates,
          count: uniqueTemplates.length,
          progress: 100 
        }) + '\n'))

        controller.close()
      } catch (error) {
        console.error('Error in generate-follow-up-templates:', error)
        controller.enqueue(encoder.encode(JSON.stringify({ 
          type: 'error',
          success: false, 
          error: error.message || 'An error occurred' 
        }) + '\n'))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    },
    status: 200
  })
})