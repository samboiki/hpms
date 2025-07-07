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
    // Get Claude API key from environment variable
    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY');
    
    if (!CLAUDE_API_KEY) {
      console.error('Claude API key not found in environment variables');
      return new Response(
        JSON.stringify({ error: 'Claude API key not configured' }),
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

    const { imageUrl, fileType, extractionType = 'results' } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'No file URL provided' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Determine file type from both provided type and URL extension
    const urlLower = imageUrl.toLowerCase();
    const isPDFFromUrl = urlLower.includes('.pdf');
    const isPDF = fileType === 'application/pdf' || isPDFFromUrl;
    
    // Map file types to Claude media types
    const getClaudeMediaType = (url: string, providedType: string) => {
      if (fileType === 'application/pdf' || url.includes('.pdf')) return 'application/pdf';
      if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
      if (url.includes('.png')) return 'image/png';
      if (url.includes('.gif')) return 'image/gif';
      if (url.includes('.webp')) return 'image/webp';
      return providedType;
    };
    
    const mediaType = getClaudeMediaType(urlLower, fileType);
    
    console.log('Processing file:', { 
      url: imageUrl.substring(0, 100) + '...', 
      fileType,
      mediaType,
      isPDF,
      extractionType
    });
    
    try {
      // Download the file and convert to base64
      console.log('Downloading file for processing...');
      const fileResponse = await fetch(imageUrl);
      
      if (!fileResponse.ok) {
        throw new Error(`Cannot download file: ${fileResponse.status} ${fileResponse.statusText}`);
      }
      
      const arrayBuffer = await fileResponse.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
      const base64String = btoa(binaryString);
      
      console.log('File converted to base64, size:', base64String.length, 'characters');

      // Simplified prompt focusing only on extracting test results
      const systemPrompt = `You are a medical lab results analyzer. Extract ONLY the test results from the provided ${isPDF ? 'lab results PDF' : 'lab results image'}. 
      
      For each test result found, extract EXACTLY these four fields:
      1. testName - The name of the test/investigation
      2. testValue - The actual result value (numeric or text)
      3. testUnit - The unit of measurement (e.g., mg/dL, mmol/L, %)
      4. referenceRange - The normal/reference range
      
      Format as a JSON array. Example:
      [
        {
          "testName": "Glucose",
          "testValue": "95",
          "testUnit": "mg/dL",
          "referenceRange": "70-100"
        },
        {
          "testName": "Hemoglobin",
          "testValue": "14.5",
          "testUnit": "g/dL",
          "referenceRange": "12.0-16.0"
        }
      ]
      
      IMPORTANT: 
      - Return ONLY the JSON array, no additional text
      - If a field is not found, use empty string ""
      - Focus only on actual test results with values`;
      
      const userPrompt = 'Extract all test results with their values, units, and reference ranges from this document. Return as JSON array only.';

      // Use Claude API for both PDFs and images
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: systemPrompt + '\n\n' + userPrompt
                },
                {
                  type: isPDF ? 'document' : 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64String
                  }
                }
              ]
            }
          ]
        })
      });
      
      if (!claudeResponse.ok) {
        const error = await claudeResponse.json();
        console.error('Claude API error:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Claude API error',
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

      const claudeData = await claudeResponse.json();
      console.log('Claude API response:', JSON.stringify(claudeData, null, 2));
      
      // Extract content from Claude's response format
      const analysis = claudeData.content?.[0]?.text || '';
      console.log('Claude content:', analysis);

      // Parse the JSON response
      let results: any;
      try {
        // First try to parse the entire response as JSON
        try {
          results = JSON.parse(analysis);
          if (Array.isArray(results)) {
            console.log('Direct JSON parse successful');
          } else {
            throw new Error('Response is not an array');
          }
        } catch (directParseError) {
          // If that fails, try to find a JSON array in the response
          const jsonMatch = analysis.match(/\[[\s\S]*\]/);
          if (!jsonMatch) {
            console.error('Claude response does not contain JSON array. Full response:', analysis);
            
            // Check if this might be an empty results case
            if (analysis.includes('[]') || analysis.toLowerCase().includes('no results') || 
                analysis.toLowerCase().includes('no test')) {
              results = [];
              console.log('No results found in document');
            } else {
              throw new Error('No JSON array found in response.');
            }
          } else {
            results = JSON.parse(jsonMatch[0]);
          }
        }
        
        // Ensure proper structure for our simplified format
        results = results.map((result: any) => ({
          testName: result.testName || '',
          testValue: result.testValue || '',
          testUnit: result.testUnit || '',
          referenceRange: result.referenceRange || ''
        }));
        
        console.log(`Parsed ${extractionType}:`, results);
      } catch (error) {
        console.error('Error parsing results:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to parse results',
            details: error.message,
            aiResponse: analysis.substring(0, 500) // Include part of AI response for debugging
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

      // Return results found
      return new Response(
        JSON.stringify({ results }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );

    } catch (processingError) {
      console.error('File processing failed:', processingError);
      return new Response(
        JSON.stringify({ 
          error: 'File processing failed',
          message: `Could not process file: ${processingError.message}`,
          details: 'Please ensure the file is a valid document.'
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