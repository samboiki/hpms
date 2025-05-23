import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': '*'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    // Get OpenAI API key from environment variable
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // For non-POST requests (like the availability check), return success
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ status: 'available' }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'No image URL provided' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Call OpenAI Vision API with updated prompt for multiple results
    console.log('Calling OpenAI API with image URL:', imageUrl);
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are a medical lab results analyzer. Extract ALL test results from lab result images. 
            For each result, provide:
            - Test name
            - Value
            - Unit
            - Reference range
            - Status (normal/high/low/critical)
            
            Format each result as a separate JSON object in an array. Example:
            [
              {
                "testName": "Glucose",
                "value": "95",
                "unit": "mg/dL",
                "referenceRange": "70-100",
                "status": "normal"
              },
              {
                "testName": "Cholesterol",
                "value": "210",
                "unit": "mg/dL",
                "referenceRange": "125-200",
                "status": "high"
              }
            ]`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this lab result image and extract ALL test results. Return them as a JSON array.'
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 1500 // Increased to handle more results
      })
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.json();
      console.error('OpenAI API error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API error',
          details: error.error?.message || 'Unknown error'
        }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    const openaiData = await openaiResponse.json();
    console.log('OpenAI API response:', openaiData);
    
    const analysis = openaiData.choices[0].message.content;

    // Parse the JSON response
    let labResults;
    try {
      // Find the JSON array in the response
      const jsonMatch = analysis.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      labResults = JSON.parse(jsonMatch[0]);
      
      // Validate the structure of each result
      labResults = labResults.map(result => ({
        testName: result.testName || '',
        value: result.value || '',
        unit: result.unit || '',
        referenceRange: result.referenceRange || '',
        status: result.status || 'normal'
      }));
    } catch (error) {
      console.error('Error parsing lab results:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse lab results',
          details: error.message
        }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Return all results found
    return new Response(
      JSON.stringify({ results: labResults }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in edge function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});