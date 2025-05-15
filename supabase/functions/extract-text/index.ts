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
        JSON.stringify({ error: 'No image URL provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize the client
    const client = new ImageAnnotatorClient({
      credentials: {
        client_email: Deno.env.get('GOOGLE_CLIENT_EMAIL'),
        private_key: Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
      },
    });

    // Perform text detection
    const [result] = await client.textDetection(imageUrl);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No text detected in image' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract and process the detected text
    const fullText = detections[0].description;
    
    // Parse the text to identify lab result components
    // This is a simplified example - you'd need more sophisticated parsing in production
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
      if (line.toLowerCase().includes('test name') || line.toLowerCase().includes('test:')) {
        labData.testName = line.split(':')[1]?.trim() || '';
      }
      else if (line.toLowerCase().includes('result') || line.toLowerCase().includes('value:')) {
        labData.value = line.split(':')[1]?.trim() || '';
      }
      else if (line.toLowerCase().includes('unit') || line.toLowerCase().includes('units:')) {
        labData.unit = line.split(':')[1]?.trim() || '';
      }
      else if (line.toLowerCase().includes('reference') || line.toLowerCase().includes('range:')) {
        labData.referenceRange = line.split(':')[1]?.trim() || '';
      }
      else if (line.toLowerCase().includes('status') || line.toLowerCase().includes('flag:')) {
        const status = line.split(':')[1]?.trim().toLowerCase() || '';
        if (status.includes('high')) labData.status = 'high';
        else if (status.includes('low')) labData.status = 'low';
        else if (status.includes('critical')) labData.status = 'critical';
        else labData.status = 'normal';
      }
    }

    return new Response(
      JSON.stringify(labData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing image:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process image' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});