import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { defaultSMSService } from '@/services/smsPortal'

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
    const { action, data } = body

    switch (action) {
      case 'sendTestSMS': {
        const { to, message, practiceId } = data
        
        console.log('🚀 Sending test SMS from admin portal...')
        console.log('To:', to)
        console.log('Message:', message)
        console.log('Practice ID:', practiceId)
        
        // Send SMS via SMS Portal
        const smsResult = await defaultSMSService.sendSMS(to, message, `admin-test-${Date.now()}`)
        
        if (smsResult.success) {
          // Log SMS to database
          try {
            const { error: logError } = await supabaseAdmin
              .from('sms_logs')
              .insert({
                practice_id: practiceId || null,
                recipient_phone: to,
                message_content: message,
                status: 'sent',
                sent_at: new Date().toISOString(),
                message_id: smsResult.messageId,
                cost: smsResult.cost || 1,
                created_at: new Date().toISOString()
              })

            if (logError) {
              console.error('❌ Failed to log SMS to database:', logError)
            } else {
              console.log('✅ SMS logged to database successfully')
            }
          } catch (dbError) {
            console.error('❌ Database logging error:', dbError)
          }

          // Update practice SMS usage if practice ID provided
          if (practiceId) {
            try {
              const { error: updateError } = await supabaseAdmin
                .from('practice_sms_subscriptions')
                .update({
                  current_usage: supabaseAdmin.raw('current_usage + 1'),
                  updated_at: new Date().toISOString()
                })
                .eq('practice_id', practiceId)
                .eq('is_active', true)

              if (updateError) {
                console.error('❌ Failed to update SMS usage:', updateError)
              } else {
                console.log('✅ SMS usage updated successfully')
              }
            } catch (usageError) {
              console.error('❌ Usage update error:', usageError)
            }
          }
          
          return NextResponse.json({
            success: true,
            messageId: smsResult.messageId,
            cost: smsResult.cost,
            remainingCredits: smsResult.remainingCredits
          })
        } else {
          return NextResponse.json({
            success: false,
            error: smsResult.error
          }, { status: 400 })
        }
      }

      case 'getBalance': {
        console.log('💰 Checking SMS balance from admin portal...')
        
        const balanceResult = await defaultSMSService.getBalance()
        
        return NextResponse.json({
          success: balanceResult.success,
          credits: balanceResult.credits,
          error: balanceResult.error
        })
      }

      case 'getSMSLogs': {
        const { limit = 50, practiceId } = data || {}
        
        let query = supabaseAdmin
          .from('sms_logs')
          .select(`
            *,
            practices!inner(name, city)
          `)
          .order('sent_at', { ascending: false })
          .limit(limit)

        if (practiceId) {
          query = query.eq('practice_id', practiceId)
        }

        const { data: logs, error } = await query

        if (error) {
          console.error('❌ Failed to fetch SMS logs:', error)
          return NextResponse.json({
            success: false,
            error: error.message
          }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          logs: logs || []
        })
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Admin SMS API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}