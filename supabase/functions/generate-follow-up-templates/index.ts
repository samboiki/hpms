import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// SECURITY: This function generates templates ONLY for the specified practice
// It does not access data from other practices

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
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!


    const { practiceId, practiceType, practiceTypeName, tariffs } = await req.json()

    if (!practiceId || !practiceType || !tariffs) {
      throw new Error('Missing required parameters')
    }

    // SECURITY: The practiceId should be validated by the caller
    // This function only generates templates, it doesn't fetch existing data

    // Prepare the prompt for OpenAI
    const prompt = `
You are an expert medical practice consultant specializing in evidence-based follow-up care protocols. Your task is to generate comprehensive, research-backed follow-up templates based on the practice type and available services.

Practice Type: ${practiceTypeName || practiceType}
Available Services/Tariffs:
${tariffs.map((t: Tariff) => `- ${t.code}: ${t.description}`).join('\n')}

CRITICAL REQUIREMENTS:
1. Generate 8-12 high-value follow-up templates that cover the most common and important scenarios for this ${practiceTypeName || practiceType} practice
2. Base your recommendations on current clinical guidelines and best practices
3. Include both preventive care and treatment follow-up protocols
4. Consider patient safety, clinical outcomes, and practice efficiency

TEMPLATE STRUCTURE (JSON):
{
  "template_name": "Clear, professional protocol name",
  "trigger_type": "DIAGNOSIS" or "TARIFF_CODE",
  "trigger_value": "Specific diagnosis name or tariff code from the provided list",
  "steps": [
    {
      "step_number": 1,
      "interval_value": 7,
      "interval_unit": "Days" or "Weeks" or "Months" or "weeks_gestation" (for obstetrics),
      "visit_type": "Specific follow-up type (e.g., 'Post-operative check', 'Healing assessment')",
      "notes_template": "Detailed pre-filled notes with clinical checkpoints. Use {trigger_value} placeholder",
      "services_to_schedule": ["Relevant tariff codes from the provided list"]
    }
  ]
}

PRACTICE-SPECIFIC GUIDELINES:

For MEDICAL practices:
- Chronic disease management (diabetes, hypertension, asthma)
- Post-hospitalization follow-ups
- Preventive care schedules
- Medication monitoring
- Lab result reviews
- Vaccination schedules

For DENTAL practices:
- Post-extraction healing protocols
- Root canal follow-ups
- Periodontal treatment sequences
- Orthodontic adjustments
- Crown/bridge preparations
- Preventive cleaning schedules
- Post-surgical healing

For AESTHETIC practices:
- Post-procedure recovery monitoring
- Treatment series scheduling (e.g., laser, injections)
- Results assessment visits
- Touch-up appointments
- Complication monitoring
- Maintenance schedules

For OBSTETRICS/GYNECOLOGY practices:
- Antenatal care schedules (WHO guidelines)
- Post-partum follow-ups
- High-risk pregnancy monitoring
- Fertility treatment protocols
- Post-surgical recovery
- Routine screening schedules

QUALITY STANDARDS:
1. Each template must have clear clinical justification
2. Timing must align with evidence-based guidelines
3. Multi-step protocols should show logical progression
4. Include appropriate diagnostic codes (ICD-10) for DIAGNOSIS triggers
5. Use actual tariff codes from the provided list for services
6. Notes templates should include specific clinical checkpoints
7. Consider both routine and complex cases

EXAMPLES OF HIGH-VALUE TEMPLATES:
- Diabetes Management Protocol (quarterly HbA1c, annual complications screening)
- Post-Extraction Healing (24hr, 1 week, 2 weeks checkpoints)
- Botox Treatment Series (initial, 2-week assessment, 3-month maintenance)
- Antenatal Care Schedule (booking, 16w, 20w, 28w, 34w, 36w, 38w, 40w)

Generate templates that will genuinely improve patient care and practice efficiency. Focus on protocols that:
- Prevent complications
- Ensure treatment success
- Maintain regulatory compliance
- Optimize patient outcomes
- Generate appropriate revenue through proper follow-up care

Return ONLY a valid JSON array of templates, no additional text or explanation.
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
            content: 'You are an expert medical practice consultant with deep knowledge of clinical protocols, evidence-based medicine, and healthcare workflows. Generate only valid JSON without any markdown formatting or explanation. Your recommendations must be clinically sound, practical, and based on current best practices.'
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