/**
 * PROPOSAL - patient-list-automations (not deployed).
 *
 * This folder is deliberately outside supabase/functions so `supabase functions deploy` cannot
 * pick it up by accident. Setup steps and the database changes it needs are in
 * proposals/2026-10-07-patient-lists.sql (section 6).
 *
 * Called every 15 minutes (pg_cron + pg_net). Each call:
 *   1. Finds lists with "Send automatically" on whose send time has passed today (Windhoek time),
 *      that have not run today and are outside their quiet hours (listAutomation.isScheduledRunDue).
 *   2. Marks the list as run today in one conditional update, so two overlapping calls cannot
 *      both run it.
 *   3. Works out today's members and who gets the message with the same code the Lists page uses
 *      (src/utils/patientLists): smart-list rules, exclusions, opt-outs, missing cell numbers,
 *      birthday mornings and the once-per-period guard.
 *   4. Claims each patient for the period (claim_patient_list_sends) and sends through the
 *      centralized SMS gateway as message type 'automation_list' (non-essential, so the gateway
 *      never sends it to a patient who replied STOP). Failed sends are released for a later run.
 *   5. Saves a summary on the list (last_run_summary), shown on the list card.
 *   If a run stops (SMS bundle used up, gateway unreachable, database error) the list is marked
 *   as not run, so the next call retries; patients already messaged are not messaged again.
 *
 * Safety: PATIENT_LISTS_DRY_RUN defaults to "true": the function only reports what it would send
 * (no claims, no SMS, nothing written). Every request must carry the shared secret in the
 * x-cron-secret header (PATIENT_LISTS_CRON_SECRET).
 *
 * deno.json maps date-fns (used by src/components/messages/messageText.ts) to npm.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { isScheduledRunDue, parseAutomation } from '../../../src/utils/patientLists/listAutomation.ts';
import { windhoekClock } from '../../../src/utils/patientLists/listDates.ts';
import type { PracticeDetails } from '../../../src/utils/patientLists/listMessages.ts';
import {
  resolveListMembers,
  toPatientFacts,
  validateRule,
  type ListMemberRow,
  type PatientFacts,
  type PatientFactsRow,
  type SmartRule
} from '../../../src/utils/patientLists/listRules.ts';
import {
  LIST_SMS_MESSAGE_TYPE,
  countSkips,
  isOptedOutSmsError,
  isStopAllSmsError,
  planListSend,
  runListSend,
  summarizeRun,
  type PlannedRecipient,
  type SendAttempt
} from '../../../src/utils/patientLists/listSend.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('PATIENT_LISTS_CRON_SECRET') ?? '';
const DRY_RUN = (Deno.env.get('PATIENT_LISTS_DRY_RUN') ?? 'true').toLowerCase() !== 'false';
const PAGE_SIZE = 1000;

interface ListRow {
  id: string;
  practice_id: string;
  name: string;
  kind: string;
  rule: unknown;
  automation: unknown;
  automation_enabled: boolean;
  last_run_on: string | null;
}

interface ListOutcome {
  listId: string;
  practiceId: string;
  name: string;
  result: 'sent' | 'dry_run' | 'skipped' | 'stopped';
  detail: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function loadFacts(client: SupabaseClient, practiceId: string, todayKey: string): Promise<PatientFacts[]> {
  const facts: PatientFacts[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .rpc('patient_list_facts', { p_practice_id: practiceId, p_today: todayKey, p_patient_ids: null })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`patient facts: ${error.message}`);
    facts.push(...((data ?? []) as PatientFactsRow[]).map(toPatientFacts));
    if (!data || data.length < PAGE_SIZE) return facts;
  }
}

async function loadMemberRows(client: SupabaseClient, practiceId: string): Promise<ListMemberRow[]> {
  const rows: ListMemberRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('patient_list_members')
      .select('list_id, patient_id, source, excluded, added_at, last_sent_at, last_sent_period')
      .eq('practice_id', practiceId)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`list members: ${error.message}`);
    rows.push(...((data ?? []) as ListMemberRow[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function loadPractice(client: SupabaseClient, practiceId: string): Promise<PracticeDetails> {
  const { data } = await client.from('practices').select('name, contact_phone').eq('id', practiceId).maybeSingle();
  const row = (data ?? {}) as { name?: string | null; contact_phone?: string | null };
  return { name: row.name?.trim() || null, phone: row.contact_phone?.trim() || null };
}

/** One SMS through the centralized gateway: logged in practice_sms_logs and counted on the bundle. */
async function sendViaGateway(list: ListRow, rule: SmartRule | null, periodKey: string, recipient: PlannedRecipient): Promise<SendAttempt> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/centralized-sms-gateway`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practiceId: list.practice_id,
        recipientPhone: recipient.phone,
        messageContent: recipient.text,
        messageType: LIST_SMS_MESSAGE_TYPE,
        patientId: recipient.patientId,
        metadata: {
          source: 'patient_list',
          trigger: 'schedule',
          bulkSend: true,
          patient_list_id: list.id,
          patient_list_name: list.name,
          list_rule: rule?.type ?? 'manual',
          period: periodKey
        },
        tags: ['patient-list']
      })
    });
    const body = (await response.json().catch(() => ({}))) as { success?: boolean; logId?: string; error?: string; code?: string };
    if (response.ok && body.success) return { ok: true, logId: body.logId ?? null };
    const error = body.error ?? `SMS gateway answered HTTP ${response.status}`;
    if (body.code === 'PATIENT_OPTED_OUT' || isOptedOutSmsError(error)) return { ok: false, error, stopAll: false, optedOut: true };
    return { ok: false, error, stopAll: isStopAllSmsError(error) };
  } catch (error) {
    // The gateway cannot be reached: every other send would fail the same way
    return { ok: false, error: `Could not reach the SMS gateway: ${errorText(error)}`, stopAll: true };
  }
}

async function runList(
  client: SupabaseClient,
  list: ListRow,
  facts: readonly PatientFacts[],
  rows: readonly ListMemberRow[],
  practice: PracticeDetails,
  todayKey: string
): Promise<ListOutcome> {
  const base = { listId: list.id, practiceId: list.practice_id, name: list.name };
  const settings = parseAutomation(list.automation);
  let rule: SmartRule | null = null;
  if (list.kind === 'smart') {
    const validation = validateRule(list.rule);
    if (!validation.ok) return { ...base, result: 'skipped', detail: `rule cannot be read: ${validation.error}` };
    rule = validation.rule;
  }

  const { members } = resolveListMembers({
    kind: list.kind === 'smart' ? 'smart' : 'manual',
    rule,
    facts,
    rows,
    listId: list.id,
    todayKey
  });
  const plan = planListSend({ members, settings, practice, todayKey });
  const skipText = countSkips(plan.skipped)
    .map(({ reason, count }) => `${count} ${reason}`)
    .join(', ');

  if (DRY_RUN) {
    return {
      ...base,
      result: 'dry_run',
      detail: `would send ${plan.recipients.length} (${plan.totalParts} SMS parts); skipped: ${skipText || 'none'}; not due today: ${plan.notDueToday}`
    };
  }

  // One run per list per day, even when two calls overlap
  const { data: claimedRun, error: runError } = await client
    .from('patient_lists')
    .update({ last_run_on: todayKey })
    .eq('id', list.id)
    .or(`last_run_on.is.null,last_run_on.neq.${todayKey}`)
    .select('id');
  if (runError) throw new Error(`could not mark the run: ${runError.message}`);
  if (!claimedRun || claimedRun.length === 0) return { ...base, result: 'skipped', detail: 'already run today by another call' };

  const result = await runListSend(plan, {
    claim: async (patientIds) => {
      const { data, error } = await client.rpc('claim_patient_list_sends', {
        p_list_id: list.id,
        p_patient_ids: patientIds,
        p_period: plan.periodKey
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown[]).map((value) => String(value));
    },
    send: (recipient) => sendViaGateway(list, rule, plan.periodKey, recipient),
    release: async (patientId) => {
      const { error } = await client.rpc('release_patient_list_send', {
        p_list_id: list.id,
        p_patient_id: patientId,
        p_period: plan.periodKey
      });
      if (error) throw new Error(error.message);
    }
  });

  const summary = summarizeRun(plan, result, 'scheduled', new Date());
  const retry = result.stopped === 'gateway' || result.stopped === 'error';
  await client
    .from('patient_lists')
    .update({
      last_run_at: summary.at,
      last_run_summary: summary,
      // Stopped early: the next call retries; the per-patient claims stop anyone getting it twice
      ...(retry ? { last_run_on: list.last_run_on } : {})
    })
    .eq('id', list.id);

  return {
    ...base,
    result: result.stopped ? 'stopped' : 'sent',
    detail: `sent ${result.sent}, failed ${result.failed.length}, opted out at gateway ${result.optedOut.length}, skipped: ${skipText || 'none'}${
      result.stopReason ? `; stopped: ${result.stopReason}` : ''
    }`
  };
}

serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const clock = windhoekClock(new Date());

  const { data: listRows, error } = await client
    .from('patient_lists')
    .select('id, practice_id, name, kind, rule, automation, automation_enabled, last_run_on')
    .eq('automation_enabled', true);
  if (error) return json({ error: error.message }, 500);

  const due = ((listRows ?? []) as ListRow[]).filter((list) =>
    isScheduledRunDue(parseAutomation(list.automation), list.automation_enabled, list.last_run_on, clock)
  );
  const byPractice = new Map<string, ListRow[]>();
  for (const list of due) byPractice.set(list.practice_id, [...(byPractice.get(list.practice_id) ?? []), list]);

  const outcomes: ListOutcome[] = [];
  const failures: string[] = [];
  for (const [practiceId, lists] of byPractice) {
    try {
      const [facts, rows, practice] = await Promise.all([
        loadFacts(client, practiceId, clock.dateKey),
        loadMemberRows(client, practiceId),
        loadPractice(client, practiceId)
      ]);
      for (const list of lists) {
        try {
          outcomes.push(await runList(client, list, facts, rows, practice, clock.dateKey));
        } catch (listError) {
          failures.push(`list ${list.id}: ${errorText(listError)}`);
        }
      }
    } catch (practiceError) {
      failures.push(`practice ${practiceId}: ${errorText(practiceError)}`);
    }
  }

  return json(
    { today: clock.dateKey, dryRun: DRY_RUN, checked: listRows?.length ?? 0, due: due.length, outcomes, failures },
    failures.length > 0 ? 207 : 200
  );
});
