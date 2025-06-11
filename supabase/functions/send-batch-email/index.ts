// This is the full code for: supabase/functions/send-batch-email/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts';

// Get the required environment variables from Supabase secrets
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const GMAIL_ADDRESS = Deno.env.get('GMAIL_ADDRESS');
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD');

// CORS headers to allow requests from localhost and production
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
    // First, ensure all required secrets are set
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GMAIL_ADDRESS || !GMAIL_APP_PASSWORD) {
      throw new Error('Missing required environment variables. Please set secrets in Supabase dashboard.');
    }

    // Create a Supabase client with the user's authorization
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });

    // Get the batch_id from the request body
    const { batch_id } = await req.json();
    
    if (!batch_id) {
      return new Response(JSON.stringify({
        error: 'batch_id is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log(`📧 Processing batch submission for batch_id: ${batch_id}`);

    // Call the database function to generate the .dat file content
    const { data, error } = await supabaseClient.rpc('prepare_batch_for_sending', {
      p_batch_id: batch_id
    }).single();

    if (error) {
      console.error('❌ Database function error:', error);
      throw error;
    }

    const { file_content, recipient_email, file_name } = data;

    if (!recipient_email) {
      throw new Error(`No recipient email found for batch ${batch_id}. Please check the medical_aid_providers table.`);
    }

    console.log(`📧 Sending email to: ${recipient_email} with file: ${file_name}.dat`);

    // Configure the SMTP client for Gmail
    const client = new SmtpClient();
    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 587,
      username: GMAIL_ADDRESS,
      password: GMAIL_APP_PASSWORD
    });

    // Send the email
    await client.send({
      from: GMAIL_ADDRESS,
      to: recipient_email,
      subject: `Claim Submission - Batch: ${file_name}`,
      content: `<p>Dear Claims Department,</p><p>Please find attached the claim submission batch file: <strong>${file_name}.dat</strong>.</p><p>Thank you,</p><p>OneHealth Practice Management</p>`,
      html: `<p>Dear Claims Department,</p><p>Please find attached the claim submission batch file: <strong>${file_name}.dat</strong>.</p><p>Thank you,</p><p>OneHealth Practice Management</p>`,
      attachments: [
        {
          fileName: `${file_name}.dat`,
          content: file_content,
          contentType: "text/plain; charset=utf-8"
        }
      ]
    });

    await client.close();

    console.log(`✅ Batch ${file_name} sent successfully to ${recipient_email}`);

    // Return a success response with CORS headers
    return new Response(JSON.stringify({
      message: `Batch ${file_name} sent successfully to ${recipient_email}`
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    // Handle any errors
    console.error('❌ Error in Edge Function:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});