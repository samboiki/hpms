import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, practiceId, data } = body

    switch (action) {
      case 'updateSMSLimits': {
        const { monthlyLimit, additionalSMS } = data
        
        // Check if subscription exists
        const { data: existing } = await supabaseAdmin
          .from('practice_sms_subscriptions')
          .select('*')
          .eq('practice_id', practiceId)
          .eq('is_active', true)
          .single()

        if (existing) {
          // Update existing subscription
          const { data: result, error } = await supabaseAdmin
            .from('practice_sms_subscriptions')
            .update({
              monthly_limit: monthlyLimit,
              additional_sms_purchased: additionalSMS,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single()

          if (error) throw error
          return NextResponse.json({ success: true, data: result })
        } else {
          // Create new subscription
          const billingStart = new Date()
          const billingEnd = new Date()
          billingEnd.setMonth(billingEnd.getMonth() + 1)

          const { data: result, error } = await supabaseAdmin
            .from('practice_sms_subscriptions')
            .insert({
              practice_id: practiceId,
              monthly_limit: monthlyLimit,
              current_usage: 0,
              additional_sms_purchased: additionalSMS,
              billing_cycle_start: billingStart.toISOString().split('T')[0],
              billing_cycle_end: billingEnd.toISOString().split('T')[0],
              auto_renew: true,
              is_active: true
            })
            .select()
            .single()

          if (error) throw error
          return NextResponse.json({ success: true, data: result })
        }
      }

      case 'updateEmailLimits': {
        const { monthlyLimit, additionalEmails } = data
        
        // Check if subscription exists
        const { data: existing } = await supabaseAdmin
          .from('practice_email_subscriptions')
          .select('*')
          .eq('practice_id', practiceId)
          .eq('is_active', true)
          .single()

        if (existing) {
          // Update existing subscription
          const { data: result, error } = await supabaseAdmin
            .from('practice_email_subscriptions')
            .update({
              monthly_limit: monthlyLimit,
              additional_emails_purchased: additionalEmails,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single()

          if (error) throw error
          return NextResponse.json({ success: true, data: result })
        } else {
          // Create new subscription
          const billingStart = new Date()
          const billingEnd = new Date()
          billingEnd.setMonth(billingEnd.getMonth() + 1)

          const { data: result, error } = await supabaseAdmin
            .from('practice_email_subscriptions')
            .insert({
              practice_id: practiceId,
              monthly_limit: monthlyLimit,
              current_usage: 0,
              additional_emails_purchased: additionalEmails,
              billing_cycle_start: billingStart.toISOString().split('T')[0],
              billing_cycle_end: billingEnd.toISOString().split('T')[0],
              auto_renew: true,
              is_active: true
            })
            .select()
            .single()

          if (error) throw error
          return NextResponse.json({ success: true, data: result })
        }
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Admin API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}