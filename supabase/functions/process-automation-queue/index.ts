/**
 * process-automation-queue: the one sender of automatic patient messages (Communications > Automations: the welcome
 * for new patients and the booking confirmation). The scheduler calls it every few minutes with the service role
 * key; nothing else may, because it sends for every practice. Nothing in the database runs on a schedule by itself
 * (no pg_cron or pg_net), so until the scheduler is started the Automations screen says so.
 *
 * Each run, automation_queue_claim() (proposals/2026-10-08-automations.sql):
 *   - records the run (the screen's "last check");
 *   - puts back items a stopped run left in 'processing' (a message the gateway already logged counts as sent, so
 *     nothing goes twice; after 3 tries the item fails);
 *   - closes waiting items whose automation the practice switched off;
 *   - claims the due items (none between 20:00 and 07:00).
 * Each claimed item is sent through centralized-sms-gateway / centralized-email-gateway (logged, counted against the
 * practice's bundle, STOP respected) and finished with automation_queue_finish(): completed, or failed with the
 * reason in plain words (automationRun.ts decides, and finishes every item exactly once).
 *
 * This file only does the I/O. Logs never contain names, numbers or message text.
 * The old version read only welcome items, wrote columns automation_queue does not have (processed_at,
 * retry_count), so every item it sent stayed in 'processing', and it logged phone numbers.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { decidePlatformAccess, deniedResponse } from '../_shared/callerAccess.ts'
import { SMS_REPLIES_FEATURE_KEY } from '../_shared/smsMessagePolicy.ts'
import { isQuietTime } from './automationRules.ts'
import {
  claimedAutomationFromRow,
  classifyGatewayResponse,
  runAutomations,
  type AutomationRepository,
  type ClaimedAutomation
} from './automationRun.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Items per run by default, and at most (each takes a second or two at the gateways); the rest go next run */
const DEFAULT_BATCH = 20
const MAX_BATCH = 50

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only the platform (the scheduler, with the service role key) may run the queue: it sends every practice's messages
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const access = decidePlatformAccess(req.headers.get('Authorization'), serviceKey)
  if (!access.allowed) return deniedResponse(access, corsHeaders)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const db = createClient(supabaseUrl, serviceKey)

  const body = (await req.json().catch(() => ({}))) as { batchSize?: unknown }
  const requested = Number(body?.batchSize)
  const batchSize = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_BATCH) : DEFAULT_BATCH
  const now = new Date()
  // At night the run only does the housekeeping (and records that it ran): nothing is claimed or sent
  const quiet = isQuietTime(now)

  const { data, error } = await db.rpc('automation_queue_claim', { p_limit: quiet ? 0 : batchSize })
  if (error) {
    console.error('process-automation-queue: could not claim the due items:', error.code, error.message)
    return json(500, { success: false, error: 'Could not read the automation queue' })
  }
  const claimed = (Array.isArray(data) ? data : [])
    .map(claimedAutomationFromRow)
    .filter((item): item is ClaimedAutomation => item !== null)

  // An SMS invites a reply only for practices whose replies are collected (support switches practice_features
  // 'sms_replies' on once the reply webhook serves them); if that cannot be read, no reply is invited
  const practiceIds = [...new Set(claimed.map((item) => item.practiceId).filter((id): id is string => !!id))]
  const repliesLive = new Set<string>()
  if (practiceIds.length > 0) {
    const { data: features, error: featureError } = await db
      .from('practice_features')
      .select('practice_id')
      .eq('feature_key', SMS_REPLIES_FEATURE_KEY)
      .eq('is_enabled', true)
      .in('practice_id', practiceIds)
    if (featureError) console.warn('process-automation-queue: could not read which practices collect SMS replies:', featureError.code, featureError.message)
    for (const row of (features ?? []) as Array<{ practice_id: string }>) repliesLive.add(row.practice_id)
  }
  const items = claimed.map((item) => ({ ...item, practice: { ...item.practice, repliesLive: !!item.practiceId && repliesLive.has(item.practiceId) } }))

  const gatewayHeaders = { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
  const repo: AutomationRepository = {
    async send(item, send) {
      // The queue id lets a later run see that the message went (the gateways log it before sending)
      const metadata = { source: 'automation', queue_id: item.queueId, automation_id: item.automationId }
      // A booking confirmation names the visit, so the diary shows it and the patient's reply attaches to that booking
      const visitId = item.visit?.id ?? undefined
      const patientId = item.patient?.id ?? undefined
      const request =
        send.channel === 'sms'
          ? {
              url: `${supabaseUrl}/functions/v1/centralized-sms-gateway`,
              body: { practiceId: item.practiceId, recipientPhone: send.to, messageContent: send.message, messageType: send.messageType, patientId, visitId, metadata },
            }
          : {
              url: `${supabaseUrl}/functions/v1/centralized-email-gateway`,
              body: {
                practiceId: item.practiceId,
                recipientEmail: send.to,
                recipientName: send.recipientName ?? undefined,
                subject: send.subject,
                textContent: send.text ?? undefined,
                htmlContent: send.html ?? undefined,
                emailType: send.emailType,
                patientId,
                visitId,
                metadata,
              },
            }
      const response = await fetch(request.url, { method: 'POST', headers: gatewayHeaders, body: JSON.stringify(request.body) })
      const answer = await response.json().catch(() => null)
      return classifyGatewayResponse(response.status, answer)
    },
    async finish(queueId, sent, note) {
      const { error: finishError } = await db.rpc('automation_queue_finish', { p_queue_id: queueId, p_sent: sent, p_note: note })
      if (finishError) throw new Error(`${finishError.code ?? ''} ${finishError.message ?? ''}`.trim())
    },
  }

  const summary = await runAutomations(items, repo, now)
  // Counts and outcome codes only
  console.log('process-automation-queue:', JSON.stringify({ quiet, ...summary }))
  return json(200, { success: true, quiet, ...summary })
})
