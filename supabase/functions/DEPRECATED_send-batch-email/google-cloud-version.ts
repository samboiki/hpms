// Google Cloud Email Service Version
// This version supports both SendGrid and Gmail API through Google Cloud
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const EMAIL_SERVICE = Deno.env.get('EMAIL_SERVICE') || 'sendgrid'; // 'gmail' or 'sendgrid'
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const GOOGLE_SERVICE_ACCOUNT = Deno.env.get('GOOGLE_SERVICE_ACCOUNT'); // JSON string
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate basic environment variables
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SENDER_EMAIL) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, or SENDER_EMAIL');
    }

    // Validate service-specific environment variables
    if (EMAIL_SERVICE === 'sendgrid' && !SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY is required when EMAIL_SERVICE=sendgrid');
    }

    if (EMAIL_SERVICE === 'gmail' && !GOOGLE_SERVICE_ACCOUNT) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT is required when EMAIL_SERVICE=gmail');
    }

    console.log(`📧 Using email service: ${EMAIL_SERVICE}`);

    // Create Supabase client
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });

    // Get batch_id from request
    const { batch_id } = await req.json();
    if (!batch_id) {
      return new Response(JSON.stringify({ error: 'batch_id is required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log(`📋 Processing batch: ${batch_id}`);

    // Get batch data from database function
    const { data, error } = await supabaseClient.rpc('prepare_batch_for_sending', {
      p_batch_id: batch_id
    }).single();

    if (error) {
      console.error('❌ Database function error:', error);
      throw error;
    }

    const { file_content, recipient_email, file_name } = data;

    if (!recipient_email) {
      throw new Error(`No recipient email found for batch ${batch_id}. Check medical_aid_providers table.`);
    }

    if (!file_content) {
      throw new Error(`No file content generated for batch ${batch_id}`);
    }

    console.log(`📧 Sending to: ${recipient_email}, File: ${file_name}.dat`);

    // Send email using the configured service
    let result;
    if (EMAIL_SERVICE === 'sendgrid') {
      result = await sendWithSendGrid(recipient_email, file_name, file_content);
    } else if (EMAIL_SERVICE === 'gmail') {
      result = await sendWithGmailAPI(recipient_email, file_name, file_content);
    } else {
      throw new Error(`Unsupported email service: ${EMAIL_SERVICE}. Use 'sendgrid' or 'gmail'.`);
    }

    console.log(`✅ Email sent successfully via ${EMAIL_SERVICE}`);

    return new Response(JSON.stringify({
      message: `Batch ${file_name} sent successfully to ${recipient_email} via ${EMAIL_SERVICE}`,
      service_used: EMAIL_SERVICE,
      result
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Error in Edge Function:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'An unexpected error occurred',
      service: EMAIL_SERVICE
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});

/**
 * Send email using SendGrid API
 */
async function sendWithSendGrid(to: string, fileName: string, fileContent: string) {
  console.log('📤 Sending via SendGrid...');
  
  // Encode file content as base64 for attachment
  const encoder = new TextEncoder();
  const data = encoder.encode(fileContent);
  const base64Content = btoa(String.fromCharCode(...data));
  
  const emailPayload = {
    personalizations: [{
      to: [{ email: to }],
      subject: `Medical Claim Submission - Batch: ${fileName}`
    }],
    from: { 
      email: SENDER_EMAIL,
      name: 'OneHealth Practice Management'
    },
    content: [{
      type: 'text/html',
      value: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Medical Claim Submission</h2>
          <p>Dear Claims Department,</p>
          <p>Please find attached the medical claim submission batch file: <strong>${fileName}.dat</strong></p>
          <p>This batch contains medical claims for processing according to industry standards.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This email was sent automatically by OneHealth Practice Management System.<br>
            If you have any questions, please contact the practice directly.
          </p>
        </div>
      `
    }],
    attachments: [{
      content: base64Content,
      filename: `${fileName}.dat`,
      type: 'text/plain',
      disposition: 'attachment'
    }]
  };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ SendGrid error response:', errorText);
    throw new Error(`SendGrid API error (${response.status}): ${errorText}`);
  }

  // SendGrid returns 202 for successful submission
  console.log('✅ SendGrid email queued successfully');
  return {
    status: 'sent',
    provider: 'sendgrid',
    response_code: response.status
  };
}

/**
 * Send email using Gmail API (requires additional setup)
 */
async function sendWithGmailAPI(to: string, fileName: string, fileContent: string) {
  console.log('📤 Sending via Gmail API...');
  
  // Parse service account credentials
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT!);
  } catch (error) {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT JSON format');
  }

  // For now, throw an error as Gmail API requires JWT token generation
  // which is more complex to implement in Deno edge functions
  throw new Error(`
    Gmail API implementation requires additional JWT token generation.
    
    For immediate deployment, please use SendGrid by setting:
    EMAIL_SERVICE=sendgrid
    SENDGRID_API_KEY=your-sendgrid-key
    
    Gmail API implementation can be added later if needed.
  `);

  // TODO: Implement Gmail API with JWT token generation
  // This would involve:
  // 1. Generate JWT token using service account
  // 2. Exchange JWT for access token
  // 3. Use Gmail API to send email with attachment
  // 4. Handle token refresh logic
}