import { ImageAnnotatorClient } from 'npm:@google-cloud/vision@4.0.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Parse request body with error handling
    let imageUrl: string;
    try {
      const body = await req.json();
      imageUrl = body.imageUrl;
    } catch (e) {
      throw new Error('Invalid request body');
    }

    if (!imageUrl) {
      throw new Error('No image URL provided');
    }

    // Verify environment variables
    const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY');

    if (!clientEmail || !privateKey) {
      throw new Error('Missing Google Cloud credentials');
    }

    // Initialize the client with proper error handling
    let client: ImageAnnotatorClient;
    try {
      client = new ImageAnnotatorClient({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
      });
    } catch (e) {
      console.error('Failed to initialize Vision client:', e);
      throw new Error('Failed to initialize image processing');
    }

    // Perform text detection
    const [result] = await client.textDetection(imageUrl);
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
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Extract and process the detected text
    const fullText = detections[0].description;
    const lines = fullText.split('\n');
    
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
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        testName: 'Unknown Test',
        value: '',
        unit: '',
        referenceRange: '',
        status: 'normal'
      }),
      { 
        status: error.message === 'Method not allowed' ? 405 : 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});