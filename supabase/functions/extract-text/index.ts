import { createClient } from 'npm:@supabase/supabase-js@2.39.8';
import { ImageAnnotatorClient } from 'npm:@google-cloud/vision@4.0.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    // Initialize Vision client
    const vision = new ImageAnnotatorClient({
      credentials: {
        client_email: Deno.env.get('GOOGLE_CLIENT_EMAIL'),
        private_key: Deno.env.get('GOOGLE_PRIVATE_KEY'),
      },
    });

    // Perform text detection
    const [result] = await vision.textDetection(image);
    const detections = result.textAnnotations;
    
    // Extract text
    const extractedText = detections?.[0]?.description || '';

    // Parse lab results
    // This is a simple example - you'd want to add more sophisticated parsing
    const labResults = extractedText.split('\n').map(line => {
      const [name, value, unit] = line.split(/\s+/);
      return { name, value, unit };
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: extractedText,
        labResults 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      },
    );
  }
});