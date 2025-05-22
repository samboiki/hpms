import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': '*'
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

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

    // Validate and fetch image
    try {
      console.log('Fetching image from URL:', imageUrl);
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        console.error('Failed to fetch image:', {
          status: imageResponse.status,
          statusText: imageResponse.statusText
        });
        return new Response(
          JSON.stringify({ 
            error: 'Failed to fetch image from provided URL',
            details: `HTTP ${imageResponse.status}: ${imageResponse.statusText}`
          }),
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
      console.log('Image content type:', contentType);
      
      if (!contentType?.startsWith('image/')) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid file type. Only images are supported.',
            details: `Received content type: ${contentType}`
          }),
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }

      // Check file size
      const contentLength = parseInt(imageResponse.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_IMAGE_SIZE) {
        return new Response(
          JSON.stringify({ 
            error: 'Image file too large',
            details: `Maximum file size is 5MB. Received: ${Math.round(contentLength / 1024 / 1024)}MB`
          }),
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }

      // Convert image to base64 using chunks to avoid stack overflow
      const chunks: Uint8Array[] = [];
      const reader = imageResponse.body?.getReader();
      
      if (!reader) {
        throw new Error('Failed to read image data');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine chunks and convert to base64
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedArray = new Uint8Array(totalLength);
      let position = 0;
      
      for (const chunk of chunks) {
        combinedArray.set(chunk, position);
        position += chunk.length;
      }

      const base64Image = btoa(String.fromCharCode(...combinedArray));
      console.log('Successfully converted image to base64');

      // Call OpenAI Vision API
      console.log('Calling OpenAI API...');
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a medical lab results analyzer. Extract test name, value, unit, reference range, and status from lab result images. Return only the extracted data in a consistent format.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please analyze this lab result image and extract the test name, value, unit, reference range, and determine if the result is normal, high, low, or critical.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${contentType};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 300
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

      // Parse OpenAI's response to extract structured data
      const labData = {
        testName: '',
        value: '',
        unit: '',
        referenceRange: '',
        status: 'normal' as 'normal' | 'high' | 'low' | 'critical'
      };

      // Extract data from OpenAI's response using string operations instead of regex
      const lines = analysis.split('\n');
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        const colonIndex = line.indexOf(':');
        
        if (colonIndex === -1) continue;
        
        const value = line.substring(colonIndex + 1).trim();
        
        if (lowerLine.includes('test name') || lowerLine.includes('test:')) {
          labData.testName = value;
        }
        else if (lowerLine.includes('result') || lowerLine.includes('value:')) {
          labData.value = value;
        }
        else if (lowerLine.includes('unit') || lowerLine.includes('units:')) {
          labData.unit = value;
        }
        else if (lowerLine.includes('reference') || lowerLine.includes('range:')) {
          labData.referenceRange = value;
        }
        else if (lowerLine.includes('status') || lowerLine.includes('assessment:')) {
          const statusValue = value.toLowerCase();
          if (statusValue.includes('high')) labData.status = 'high';
          else if (statusValue.includes('low')) labData.status = 'low';
          else if (statusValue.includes('critical')) labData.status = 'critical';
          else labData.status = 'normal';
        }
      }

      console.log('Extracted lab data:', labData);

      // Validate extracted data
      if (!labData.testName && !labData.value) {
        return new Response(
          JSON.stringify({ 
            error: 'Could not extract meaningful lab data from image',
            details: 'The AI model could not identify test name or value in the image'
          }),
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
      console.error('Error processing image:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to process image',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown error during image processing'
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