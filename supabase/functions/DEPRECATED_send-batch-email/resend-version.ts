// Resend Email Service Version
// Simple, reliable email delivery with Resend API
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
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
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY environment variable');
    }

    if (!SENDER_EMAIL) {
      throw new Error('Missing SENDER_EMAIL environment variable');
    }

    console.log('📧 Using Resend email service');

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

    console.log(`📧 Sending to: ${recipient_email}, File: ${file_name}.dat, Size: ${file_content.length} chars`);

    // Send email via Resend
    const result = await sendWithResend(recipient_email, file_name, file_content);

    console.log('✅ Email sent successfully via Resend');

    return new Response(JSON.stringify({
      message: `Batch ${file_name} sent successfully to ${recipient_email}`,
      service: 'resend',
      email_id: result.id
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Error in Edge Function:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'An unexpected error occurred',
      service: 'resend'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});

/**
 * Send email using Resend API
 */
async function sendWithResend(to: string, fileName: string, fileContent: string) {
  console.log('📤 Sending via Resend API...');
  
  // Encode file content as base64 for attachment
  const encoder = new TextEncoder();
  const data = encoder.encode(fileContent);
  const base64Content = btoa(String.fromCharCode(...data));
  
  const emailPayload = {
    from: SENDER_EMAIL,
    to: [to],
    subject: `Medical Claim Submission - Batch: ${fileName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="border-bottom: 2px solid #01b9d4; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #01b9d4; margin: 0; font-size: 24px;">Medical Claim Submission</h1>
          <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">OneHealth Practice Management System</p>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">Dear Claims Department,</p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          Please find attached the medical claim submission batch file: 
          <strong style="color: #01b9d4;">${fileName}.dat</strong>
        </p>
        
        <div style="background: #f8f9fa; border-left: 4px solid #01b9d4; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #555; font-size: 14px;">
            <strong>Batch Details:</strong><br>
            File Name: ${fileName}.dat<br>
            File Size: ${Math.round(fileContent.length / 1024)} KB<br>
            Format: Medical Claims Data File
          </p>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          This batch contains medical claims for processing according to industry standards. 
          Please process at your earliest convenience.
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          Thank you for your continued partnership.
        </p>
        
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
          <p style="color: #888; font-size: 12px; margin: 0;">
            This email was sent automatically by OneHealth Practice Management System.<br>
            If you have any questions regarding this submission, please contact the practice directly.
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `${fileName}.dat`,
        content: base64Content,
        content_type: 'text/plain'
      }
    ]
  };

  console.log('🔄 Making Resend API request...');
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload)
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error('❌ Resend API error:', responseData);
    throw new Error(`Resend API error (${response.status}): ${responseData.message || 'Unknown error'}`);
  }

  console.log('✅ Resend email sent successfully:', responseData);
  
  return {
    id: responseData.id,
    status: 'sent',
    provider: 'resend'
  };
}