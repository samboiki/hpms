import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { ImageAnnotatorClient } from 'npm:@google-cloud/vision@4.0.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Validate image URL
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch image from provided URL' }),
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }

      // Check content type
      const contentType = imageResponse.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        return new Response(
          JSON.stringify({ error: 'Invalid file type. Only images are supported.' }),
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }

      const imageBuffer = await imageResponse.arrayBuffer();

      // Check if Google Cloud credentials are configured
      const clientEmail = Supabase.env.get('GOOGLE_CLIENT_EMAIL');
      const privateKey = Supabase.env.get('GOOGLE_PRIVATE_KEY');

      if (!clientEmail || !privateKey) {
        console.error('Missing Google Cloud credentials');
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { 
            status: 500, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }

      // Initialize the client
      const client = new ImageAnnotatorClient({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
      });

      // Perform text detection
      const [result] = await client.textDetection({
        image: {
          content: new Uint8Array(imageBuffer)
        }
      });

      const detections = result.textAnnotations;

      if (!detections || detections.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No text detected in image' }),
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }

      // Extract and process the detected text
      const fullText = detections[0].description;
      
      // Parse the text to identify lab result components
      const lines = fullText.split('\n');
      const labData = {
        testName: '',
        value: '',
        unit: '',
        referenceRange: '',
        status: 'normal' as 'normal' | 'high' | 'low' | 'critical'
      };

      // Simple parsing logic - enhance this based on your lab result format
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('test name') || lowerLine.includes('test:')) {
          labData.testName = line.split(':')[1]?.trim() || '';
        }
        else if (lowerLine.includes('result') || lowerLine.includes('value:')) {
          labData.value = line.split(':')[1]?.trim() || '';
        }
        else if (lowerLine.includes('unit') || lowerLine.includes('units:')) {
          labData.unit = line.split(':')[1]?.trim() || '';
        }
        else if (lowerLine.includes('reference') || lowerLine.includes('range:')) {
          labData.referenceRange = line.split(':')[1]?.trim() || '';
        }
        else if (lowerLine.includes('status') || lowerLine.includes('flag:')) {
          const status = line.split(':')[1]?.trim().toLowerCase() || '';
          if (status.includes('high')) labData.status = 'high';
          else if (status.includes('low')) labData.status = 'low';
          else if (status.includes('critical')) labData.status = 'critical';
          else labData.status = 'normal';
        }
      }

      // If test name wasn't found in explicit format, try to extract it from context
      if (!labData.testName) {
        // Look for common lab test patterns
        const testPatterns = [
          /\b(CBC|Complete Blood Count)\b/i,
          /\b(HbA1c|Hemoglobin A1c)\b/i,
          /\b(TSH|Thyroid Stimulating Hormone)\b/i,
          /\b(LDL|HDL|Cholesterol)\b/i,
          /\bGlucose\b/i,
          /\bCreatinine\b/i,
        ];

        for (const line of lines) {
          for (const pattern of testPatterns) {
            const match = line.match(pattern);
            if (match) {
              labData.testName = match[0];
              break;
            }
          }
          if (labData.testName) break;
        }
      }

      // If value wasn't found in explicit format, try to extract it
      if (!labData.value) {
        // Look for numeric values with optional decimal points
        const valuePattern = /\b\d+\.?\d*\b/;
        for (const line of lines) {
          const match = line.match(valuePattern);
          if (match) {
            labData.value = match[0];
            
            // Try to extract unit from the same line
            const unitPattern = /[a-zA-Z]+\/[a-zA-Z]+|[a-zA-Z]+/;
            const unitMatch = line.substring(match.index! + match[0].length).match(unitPattern);
            if (unitMatch && !labData.unit) {
              labData.unit = unitMatch[0];
            }
            break;
          }
        }
      }

      // Determine status if not explicitly stated
      if (labData.value && labData.referenceRange && labData.status === 'normal') {
        const value = parseFloat(labData.value);
        const range = labData.referenceRange.match(/\d+\.?\d*/g);
        if (range && range.length >= 2) {
          const [min, max] = range.map(Number);
          if (value < min) labData.status = 'low';
          else if (value > max) labData.status = 'high';
        }
      }

      // Validate extracted data
      if (!labData.testName && !labData.value) {
        return new Response(
          JSON.stringify({ error: 'Could not extract meaningful lab data from image' }),
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }

      return new Response(
        JSON.stringify(labData),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );

    } catch (fetchError) {
      console.error('Error fetching or processing image:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch or process image' }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

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