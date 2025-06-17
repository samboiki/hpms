// Individual Email Service - Resend Integration
// Sends individual emails using Resend API for patient communications

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

    console.log('📧 Individual Email Service - Using Resend')

    // Create Supabase client
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    })

    // Get email data from request
    const { to, subject, html, text } = await req.json()
    
    // Validate required fields
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: to, subject, and html are required' 
      }), {
        status: 400,
        headers: corsHeaders
      })
    }

    console.log(`📧 Sending individual email to: ${to}`)
    console.log(`📄 Subject: ${subject}`)

    // Send email via Resend
    const result = await sendWithResend(to, subject, html, text)

    console.log('✅ Individual email sent successfully via Resend')

    return new Response(JSON.stringify({
      message: `Email sent successfully to ${to}`,
      service: 'resend',
      email_id: result.id,
      status: 'sent'
    }), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('❌ Error in Individual Email Service:', error)
    
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
 * Send individual email using Resend API
 */
async function sendWithResend(to: string, subject: string, html: string, text?: string) {
  console.log('📤 Sending individual email via Resend API...')
  
  const emailPayload = {
    from: SENDER_EMAIL,
    to: [to],
    subject: subject,
    html: html,
    ...(text && { text: text })
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

  console.log('✅ Resend individual email sent successfully:', responseData)
  
  return {
    id: responseData.id,
    status: 'sent',
    provider: 'resend'
  }
}