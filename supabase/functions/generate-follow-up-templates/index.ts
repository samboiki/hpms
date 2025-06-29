import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!


    const { practiceId, practiceType, practiceTypeName, tariffs } = await req.json()

    if (!practiceId || !practiceType || !tariffs) {
      throw new Error('Missing required parameters')
    }

    // Prepare the prompt for OpenAI
    const prompt = `
You are a medical practice consultant expert in creating follow-up care protocols. Based on the practice type and available services, generate appropriate follow-up templates.

Practice Type: ${practiceTypeName || practiceType}
Available Services/Tariffs:
${tariffs.map((t: Tariff) => `- ${t.code}: ${t.description}`).join('\n')}

Generate a JSON array of follow-up templates appropriate for this practice type. Each template should follow this exact structure:

{
  "template_name": "Descriptive name for the protocol",
  "trigger_type": "DIAGNOSIS" or "TARIFF_CODE",
  "trigger_value": "The specific diagnosis or tariff code that triggers this protocol",
  "steps": [
    {
      "step_number": 1,
      "interval_value": 7,
      "interval_unit": "Days" or "Weeks" or "Months",
      "visit_type": "Type of follow-up visit",
      "notes_template": "Pre-filled notes for the visit. Use {trigger_value} as placeholder",
      "services_to_schedule": ["Array of tariff codes to schedule"]
    }
  ]
}

Rules:
1. Generate 3-5 relevant templates based on the practice type
2. For ${practiceTypeName === 'medical' ? 'medical' : practiceTypeName === 'dental' ? 'dental' : 'aesthetic'} practices, focus on common conditions and procedures
3. Use actual tariff codes from the provided list for trigger_value when trigger_type is TARIFF_CODE
4. Use common diagnoses for trigger_type DIAGNOSIS
5. Create both single-step and multi-step care plans
6. For multi-step plans, ensure logical progression of care
7. Keep interval units appropriate (Days for short-term, Weeks/Months for longer-term)
8. Include relevant tariff codes in services_to_schedule that match the practice's available services

Return ONLY a valid JSON array, no additional text or explanation.
`

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a medical practice consultant. Generate only valid JSON without any markdown formatting or explanation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const openaiData = await response.json()
    const generatedContent = openaiData.choices[0]?.message?.content

    if (!generatedContent) {
      throw new Error('No content generated from OpenAI')
    }

    // Parse the generated templates
    let templates: FollowUpTemplate[]
    try {
      // Remove any markdown formatting if present
      const cleanContent = generatedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      templates = JSON.parse(cleanContent)
    } catch {
      console.error('Failed to parse AI response:', generatedContent)
      throw new Error('Failed to parse AI-generated templates')
    }

    // Validate templates
    if (!Array.isArray(templates)) {
      throw new Error('AI did not generate a valid array of templates')
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        templates: validatedTemplates,
        count: validatedTemplates.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in generate-follow-up-templates:', error)
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