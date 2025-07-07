/**
 * @deprecated This edge function is deprecated. Use centralized-email-gateway instead.
 * 
 * DEPRECATED: DO NOT USE THIS EDGE FUNCTION
 * This edge function has been replaced by the centralized email gateway.
 * All email sending should now go through:
 * - centralized-email-gateway edge function with batch support
 * - communicationService.sendEmail() in application code (call multiple times for batch)
 * 
 * This function is kept only for reference and will be removed in a future release.
 */

// Enhanced Batch Email Service - Resend Integration (DEPRECATED)
// This version uses the corrected database structure and Resend for professional email delivery

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || 'onboarding@resend.dev'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase configuration')
    }

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY environment variable. Please set it in Supabase Dashboard > Settings > Edge Functions > Secrets')
    }

    console.log('📧 Enhanced Batch Email Service - Using Resend')

    // Create Supabase client
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    })

    // Get batch_id from request
    const { batch_id } = await req.json()
    if (!batch_id) {
      return new Response(JSON.stringify({ error: 'batch_id is required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    console.log(`📋 Processing batch: ${batch_id}`)

    // Get batch data using corrected database function
    const { data, error } = await supabaseClient.rpc('prepare_batch_for_sending', {
      p_batch_id: batch_id
    }).single()

    if (error) {
      console.error('❌ Database function error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    if (!data) {
      throw new Error(`No data returned for batch ${batch_id}`)
    }

    const { file_content, recipient_email, file_name } = data

    if (!recipient_email) {
      throw new Error(`No recipient email found for batch ${batch_id}. Check medical_aid_providers table.`)
    }

    if (!file_content) {
      throw new Error(`No file content generated for batch ${batch_id}`)
    }

    console.log(`📧 Sending to: ${recipient_email}`)
    console.log(`📄 File: ${file_name}.dat`)
    console.log(`📊 Content size: ${file_content.length} characters`)

    // Send email via Resend
    const result = await sendWithResend(recipient_email, file_name, file_content)

    // Update batch status to 'sent'
    try {
      await supabaseClient
        .from('batch_headers')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString(),
          recipient_email: recipient_email
        })
        .eq('id', batch_id)
      
      console.log('✅ Batch status updated to sent')
    } catch (updateError) {
      console.warn('⚠️ Failed to update batch status:', updateError)
    }

    console.log('✅ Email sent successfully via Resend')

    return new Response(JSON.stringify({
      message: `Batch ${file_name} sent successfully to ${recipient_email}`,
      service: 'resend',
      email_id: result.id,
      batch_id: batch_id,
      file_size: file_content.length
    }), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('❌ Error in Enhanced Batch Email Service:', error)
    
    return new Response(JSON.stringify({
      error: error.message || 'An unexpected error occurred',
      service: 'resend'
    }), {
      status: 500,
      headers: corsHeaders
    })
  }
})

/**
 * Send email using Resend API with professional medical claims formatting
 */
async function sendWithResend(to: string, fileName: string, fileContent: string) {
  console.log('📤 Sending via Resend API...')
  
  // Encode file content as base64 for attachment
  const encoder = new TextEncoder()
  const data = encoder.encode(fileContent)
  const base64Content = btoa(String.fromCharCode(...data))
  
  // Count lines and transactions for email summary
  const lines = fileContent.split('\n').filter(line => line.trim().length > 0)
  const detailLines = lines.filter(line => line.startsWith('D,'))
  const headerLine = lines.find(line => line.match(/^1,/))
  const trailerLine = lines.find(line => line.startsWith('Z,'))
  
  // Extract batch info from header
  let batchInfo = 'N/A'
  if (headerLine) {
    const parts = headerLine.split(',')
    if (parts.length >= 6) {
      batchInfo = `${parts[4]} (${parts[5]})`  // Batch number and date
    }
  }
  
  // Extract total amount from trailer
  let totalAmount = 'N/A'
  if (trailerLine) {
    const parts = trailerLine.split(',')
    if (parts.length >= 4 && parts[3]) {
      // Convert back from no-decimal format (e.g., "123456" -> "1234.56")
      const amount = parseFloat(parts[3]) / 100
      totalAmount = `N$${amount.toFixed(2)}`
    }
  }

  const emailPayload = {
    from: SENDER_EMAIL,
    to: [to],
    subject: `Medical Claims Submission - Batch ${fileName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="border-bottom: 2px solid #01b9d4; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #01b9d4; margin: 0; font-size: 24px;">Medical Claims Submission</h1>
          <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">OneHealth Practice Management System</p>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">Dear Claims Processing Team,</p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          Please find attached the medical claims submission batch file: 
          <strong style="color: #01b9d4;">${fileName}.dat</strong>
        </p>
        
        <div style="background: #f8f9fa; border-left: 4px solid #01b9d4; padding: 20px; margin: 25px 0; border-radius: 0 4px 4px 0;">
          <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Batch Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 3px 0; color: #666;">Batch Reference:</td><td style="padding: 3px 0; font-weight: bold;">${batchInfo}</td></tr>
            <tr><td style="padding: 3px 0; color: #666;">File Name:</td><td style="padding: 3px 0; font-weight: bold;">${fileName}.dat</td></tr>
            <tr><td style="padding: 3px 0; color: #666;">Total Claims:</td><td style="padding: 3px 0; font-weight: bold;">${detailLines.length}</td></tr>
            <tr><td style="padding: 3px 0; color: #666;">Total Amount:</td><td style="padding: 3px 0; font-weight: bold;">${totalAmount}</td></tr>
            <tr><td style="padding: 3px 0; color: #666;">File Size:</td><td style="padding: 3px 0; font-weight: bold;">${Math.round(fileContent.length / 1024)} KB</td></tr>
            <tr><td style="padding: 3px 0; color: #666;">Format:</td><td style="padding: 3px 0; font-weight: bold;">Medical Claims EDI</td></tr>
          </table>
        </div>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          This batch contains medical and dental claims for processing according to Namibian healthcare industry standards. 
          Please process at your earliest convenience and provide confirmation of receipt.
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          Should you have any questions regarding this submission, please contact our practice directly.
        </p>
        
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          Thank you for your continued partnership in providing quality healthcare services.
        </p>
        
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px;">
          <p style="color: #888; font-size: 12px; margin: 0;">
            This email was generated automatically by OneHealth Practice Management System.<br>
            Sent via Resend Professional Email Service for reliable delivery.<br>
            For technical support or queries, please contact your practice administrator.
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
  }

  console.log('🔄 Making Resend API request...')
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload)
  })

  const responseData = await response.json()

  if (!response.ok) {
    console.error('❌ Resend API error:', responseData)
    throw new Error(`Resend API error (${response.status}): ${responseData.message || 'Unknown error'}`)
  }

  console.log('✅ Resend email sent successfully:', responseData)
  
  return {
    id: responseData.id,
    status: 'sent',
    provider: 'resend'
  }
}