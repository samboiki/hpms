import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { ImageAnnotatorClient } from 'npm:@google-cloud/vision@4.0.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'No image URL provided',
          testName: 'Unknown Test',
          value: '',
          unit: '',
          referenceRange: '',
          status: 'normal'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify environment variables
    const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY');

    if (!clientEmail || !privateKey) {
      console.error('Missing Google Cloud credentials');
      return new Response(
        JSON.stringify({
          error: 'Configuration error',
          testName: 'Unknown Test',
          value: '',
          unit: '',
          referenceRange: '',
          status: 'normal'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize the client
    const client = new ImageAnnotatorClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
    });

    // Perform text detection with error handling
    const [result] = await client.textDetection(imageUrl).catch(err => {
      console.error('Text detection error:', err);
      throw new Error('Failed to process image');
    });

    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return new Response(
        JSON.stringify({
          testName: 'Unknown Test',
          value: '',
          unit: '',
          referenceRange: '',
          status: 'normal'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract and process the detected text
    const fullText = detections[0].description;
    const lines = fullText.split('\n');
    
    // Initialize with default values
    const labData = {
      testName: 'Unknown Test',
      value: '',
      unit: '',
      referenceRange: '',
      status: 'normal' as 'normal' | 'high' | 'low' | 'critical'
    };

    // Enhanced parsing logic with better error handling
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      try {
        if (lowerLine.includes('test name') || lowerLine.includes('test:')) {
          const parts = line.split(/[:]/);
          if (parts.length > 1) {
            labData.testName = parts[1].trim();
          }
        }
        else if (lowerLine.includes('result') || lowerLine.includes('value:')) {
          const parts = line.split(/[:]/);
          if (parts.length > 1) {
            labData.value = parts[1].trim();
          }
        }
        else if (lowerLine.includes('unit') || lowerLine.includes('units:')) {
          const parts = line.split(/[:]/);
          if (parts.length > 1) {
            labData.unit = parts[1].trim();
          }
        }
        else if (lowerLine.includes('reference') || lowerLine.includes('range:')) {
          const parts = line.split(/[:]/);
          if (parts.length > 1) {
            labData.referenceRange = parts[1].trim();
          }
        }
        else if (lowerLine.includes('status') || lowerLine.includes('flag:')) {
          const status = line.split(/[:]/)[1]?.trim().toLowerCase() || '';
          if (status.includes('high')) labData.status = 'high';
          else if (status.includes('low')) labData.status = 'low';
          else if (status.includes('critical')) labData.status = 'critical';
          else labData.status = 'normal';
        }
      } catch (err) {
        console.error('Error parsing line:', line, err);
        // Continue processing other lines
      }
    }

    return new Response(
      JSON.stringify(labData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing image:', error);
    // Return default values instead of error
    return new Response(
      JSON.stringify({
        testName: 'Unknown Test',
        value: '',
        unit: '',
        referenceRange: '',
        status: 'normal'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});