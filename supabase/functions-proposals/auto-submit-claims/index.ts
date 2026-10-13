/**
 * PROPOSAL - auto-submit-claims (not deployed).
 *
 * This folder is deliberately outside supabase/functions so `supabase functions deploy` cannot
 * pick it up by accident. See proposals/2026-10-claims.md for the setup steps and the database
 * changes it needs (proposals/2026-10-claims.sql: practice_claim_settings and
 * batch_headers.auto_submit_error).
 *
 * What it does when called on a schedule (pg_cron + pg_net, e.g. Fridays 18:00 Namibian time):
 *   1. Finds practices that switched automatic submission on (practice_claim_settings).
 *   2. Takes their open batches ('active', not sent) that have been open long enough, or whose
 *      earliest line is close to the fund deadline.
 *   3. Locks each batch by moving it from 'active' to 'sending' in one conditional update, so a
 *      second run - or a person pressing "Submit" at the same moment - cannot send it twice.
 *   4. Rebuilds the claim lines and validates them with the same code the Finance screen uses
 *      (src/utils/billing, src/components/finance/claims/buildClaimLines.ts). ICD-10 codes are
 *      only taken from batch_details.diagnostic_code: suggestions from visit notes are never
 *      confirmed automatically, so such a batch waits for a doctor.
 *   5. Sends the claim file through the centralized email gateway (never directly to a provider),
 *      records the attempt in batch_submissions and marks the batch 'sent'.
 *   6. A batch with errors is returned to 'active' with the reasons in auto_submit_error, and the
 *      practice is told by email what to fix.
 *
 * Safety: AUTO_SUBMIT_DRY_RUN defaults to "true" (report only, no writes, no email). The request
 * must carry the shared secret in the x-cron-secret header.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { buildClaimFile } from '../../../src/utils/billing/claimFile.ts';
import { validateClaimBatch } from '../../../src/utils/billing/claimValidation.ts';
import { DEADLINE_WARNING_DAYS, getFundRule } from '../../../src/utils/billing/fundRules.ts';
import { daysBetweenKeys } from '../../../src/utils/billing/dates.ts';
import { formatNad } from '../../../src/utils/billing/money.ts';
import type { TariffRow } from '../../../src/utils/billing/pricing.ts';
import { mergeOwnTariffs, type OwnTariffRow } from '../../../src/utils/billing/practiceTariffs.ts';
import { isDentalPractice } from '../../../src/utils/billing/tariffRules.ts';
import { buildClaimLines, initialIcd10Draft } from '../../../src/components/finance/claims/buildClaimLines.ts';
import type {
  BatchDetailRow,
  BatchHeaderRow,
  BatchLineSources,
  DoctorRow,
  Icd10Draft,
  InvoiceServiceRow,
  PatientRow,
  VisitRow
} from '../../../src/components/finance/claims/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('AUTO_SUBMIT_CRON_SECRET') ?? '';
const DRY_RUN = (Deno.env.get('AUTO_SUBMIT_DRY_RUN') ?? 'true').toLowerCase() !== 'false';
const MAX_SEND_ATTEMPTS = 3;

interface PracticeSettings {
  practice_id: string;
  auto_submit_enabled: boolean;
  min_days_open: number;
  notify_email: string | null;
}

interface PracticeRow {
  id: string;
  name: string;
  practice_number: string | null;
  practice_type: string | null;
  contact_email: string | null;
}

interface FundRow {
  name: string;
  email: string | null;
  medical_aid_reference: string | null;
}

interface BatchOutcome {
  practiceId: string;
  batchId: string;
  batchNumber: number;
  fund: string;
  result: 'sent' | 'held' | 'skipped' | 'send_failed' | 'dry_run';
  detail: string;
}

/** Today's date in Namibia (the runtime clock is UTC). */
const namibiaToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Windhoek' }).format(new Date());

/** Base64 without spreading the whole file into one call (large batches exceed the argument limit). */
const toBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
};

async function selectIn<T>(client: SupabaseClient, table: string, columns: string, column: string, ids: string[]): Promise<T[]> {
  const rows: T[] = [];
  const unique = [...new Set(ids.filter(Boolean))];
  for (let start = 0; start < unique.length; start += 100) {
    const { data, error } = await client.from(table).select(columns).in(column, unique.slice(start, start + 100));
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

/** Same sources the Finance screen loads (claimsService.loadBatchLineSources). */
async function loadSources(client: SupabaseClient, batch: BatchHeaderRow, practice: PracticeRow): Promise<BatchLineSources> {
  const { data, error } = await client
    .from('batch_details')
    .select('*')
    .eq('batch_header_id', batch.id)
    .order('transaction_number_in_batch', { ascending: true });
  if (error) throw new Error(`batch_details: ${error.message}`);
  const details = (data ?? []) as BatchDetailRow[];
  const patients = await selectIn<PatientRow>(client, 'patients', 'id, first_name, last_name, date_of_birth, id_number, gender, system_patient_reference_number', 'id', details.map(d => d.patient_id ?? ''));
  const visits = await selectIn<VisitRow>(client, 'visits', 'id, visit_date, doctor_id, diagnosis', 'id', details.map(d => d.visit_id ?? ''));
  const invoiceServices = await selectIn<InvoiceServiceRow>(client, 'invoice_services', 'id, invoice_id, code, unit_price, quantity, total_price, tooth_number, system_transaction_number, practitioner_id', 'invoice_id', details.map(d => d.invoice_id ?? ''));
  // A line is claimed under its own practitioner, else the invoice's (claimedPractitionerOf), as the database builds it
  const invoices = await selectIn<{ id: string; practitioner_id: string | null }>(client, 'invoices_enhanced', 'id, practitioner_id', 'id', details.map(d => d.invoice_id ?? ''));
  const invoicePractitioners = new Map(invoices.flatMap(row => (row.practitioner_id ? [[row.id, row.practitioner_id] as const] : [])));
  const doctors = await selectIn<DoctorRow>(client, 'users', 'id, full_name, hpcsa_number', 'id', [...invoiceServices.map(s => s.practitioner_id ?? ''), ...invoicePractitioners.values()]);

  // Whether a line needs a tooth, as on the Finance screen: the practice's own flag for a code it overrides, else the
  // shared list's (toothRuleFor in buildClaimLines). Before practice_own_tariffs exists its read fails: shared list only
  let tariffRows: TariffRow[] = [];
  const warnings: string[] = [];
  if (isDentalPractice(practice.practice_type)) {
    const [shared, own] = await Promise.all([
      client
        .from('practice_tariffs_with_types')
        .select('id, code, price, is_active, effective_from, effective_to, can_be_multiplied, requires_tooth_number')
        .eq('practice_type_name', practice.practice_type),
      client
        .from('practice_own_tariffs')
        .select('id, practice_id, code, description, price, can_be_multiplied, requires_tooth_number, effective_from, is_active')
        .eq('practice_id', practice.id)
    ]);
    if (own.error) warnings.push(`own tariff codes unavailable: ${own.error.message}`);
    if (shared.error) warnings.push(`tariff list unavailable: ${shared.error.message}`);
    else tariffRows = mergeOwnTariffs((shared.data ?? []) as TariffRow[], own.error ? [] : ((own.data ?? []) as OwnTariffRow[]));
  }
  return {
    details,
    patients: new Map(patients.map(row => [row.id, row])),
    visits: new Map(visits.map(row => [row.id, row])),
    doctors: new Map(doctors.map(row => [row.id, row])),
    invoiceServices,
    invoicePractitioners,
    tariffRows,
    practiceType: practice.practice_type,
    warnings
  };
}

/** Only saved codes count as confirmed when nobody is looking at the screen. */
const savedCodesOnly = (sources: BatchLineSources): Record<string, Icd10Draft> =>
  Object.fromEntries(
    sources.details.map(detail => {
      const draft = initialIcd10Draft(detail, undefined);
      return [detail.id, draft.source === 'saved' ? draft : { primary: '', secondary: [], confirmed: false, source: 'none' as const }];
    })
  );

async function sendThroughGateway(payload: Record<string, unknown>): Promise<{ success: boolean; messageId?: string; logId?: string; error?: string }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/centralized-email-gateway`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) return { success: false, error: body.error ?? `gateway returned ${response.status}` };
  return { success: true, messageId: body.messageId, logId: body.logId };
}

async function processBatch(
  client: SupabaseClient,
  practice: PracticeRow,
  settings: PracticeSettings,
  batch: BatchHeaderRow,
  fund: FundRow | undefined,
  today: string
): Promise<BatchOutcome> {
  const base = { practiceId: practice.id, batchId: batch.id, batchNumber: batch.batch_number, fund: fund?.name ?? batch.medical_aid_reference };
  const fundRule = getFundRule(batch.medical_aid_reference, fund?.name);
  const sources = await loadSources(client, batch, practice);
  const lines = buildClaimLines(sources, savedCodesOnly(sources));
  const validation = validateClaimBatch(lines, { today, fundRule, practiceNumber: practice.practice_number, storedTotal: batch.total_amount });

  const daysOpen = daysBetweenKeys(batch.batch_date, today);
  const nearDeadline = validation.lines.some(line => line.deadline.daysLeft !== null && line.deadline.daysLeft <= DEADLINE_WARNING_DAYS * 2);
  if (daysOpen < settings.min_days_open && !nearDeadline) {
    return { ...base, result: 'skipped', detail: `open ${daysOpen} day(s); waiting until ${settings.min_days_open}` };
  }

  const recipient = (fund?.email ?? '').trim();
  const problems = [
    ...(recipient ? [] : ['the fund has no claims email address']),
    ...validation.batchIssues.filter(issue => issue.severity === 'error').map(issue => issue.message),
    ...validation.lines.flatMap(line => line.errors.map(issue => `line ${lines.find(l => l.key === line.key)?.transactionNumber}: ${issue.message}`))
  ];

  if (DRY_RUN) {
    return { ...base, result: 'dry_run', detail: problems.length > 0 ? `would hold: ${problems.slice(0, 5).join('; ')}` : `would send ${lines.length} line(s) to ${recipient}` };
  }

  // Lock: only one run (or person) can move the batch out of 'active'
  const { data: locked, error: lockError } = await client
    .from('batch_headers')
    .update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', batch.id)
    .eq('status', 'active')
    .is('sent_at', null)
    .select('id');
  if (lockError) throw new Error(`could not lock batch ${batch.batch_number}: ${lockError.message}`);
  if (!locked || locked.length === 0) return { ...base, result: 'skipped', detail: 'already being sent or sent' };

  if (problems.length > 0 || !validation.canSubmit) {
    const reason = problems.slice(0, 20).join('; ');
    await client.from('batch_headers').update({ status: 'active', auto_submit_error: reason }).eq('id', batch.id);
    if (settings.notify_email ?? practice.contact_email) {
      await sendThroughGateway({
        practiceId: practice.id,
        recipientEmail: settings.notify_email ?? practice.contact_email,
        subject: `Claim batch ${batch.batch_number} (${base.fund}) was not sent automatically`,
        textContent: `Batch ${batch.batch_number} for ${base.fund} needs attention before it can be sent:\n\n- ${problems.join('\n- ')}\n\nOpen Finance > Batches to fix it.`,
        emailType: 'system'
      });
    }
    return { ...base, result: 'held', detail: reason };
  }

  const file = buildClaimFile(
    {
      practiceNumber: batch.practice_number,
      batchNumber: batch.batch_number,
      batchDate: batch.batch_date,
      fundReference: batch.medical_aid_reference,
      systemIdentification: batch.system_identification,
      transactionType: batch.transaction_type,
      sourceSoftware: batch.source_software,
      sourceSoftwareVersion: batch.source_software_version
    },
    lines
  );
  const subject = `Medical claims ${file.fileName} - ${practice.name} (practice ${batch.practice_number})`;
  const sent = await sendThroughGateway({
    practiceId: practice.id,
    recipientEmail: recipient,
    recipientName: `${base.fund} claims`,
    subject,
    textContent: `Please find attached the claim file ${file.fileName}: ${file.lineCount} claim line(s), ${formatNad(file.totalCents / 100)}.`,
    emailType: 'custom',
    attachments: [{ filename: file.fileName, content: toBase64(file.content), type: 'application/octet-stream' }],
    metadata: { kind: 'claim_batch', batchId: batch.id, automatic: true },
    tags: ['claims', 'auto-submit', batch.medical_aid_reference]
  });

  const now = new Date().toISOString();
  const { count: previousAttempts } = await client
    .from('batch_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('batch_header_id', batch.id);
  await client.from('batch_submissions').insert({
    batch_header_id: batch.id,
    file_name: file.fileName,
    file_size: file.content.length,
    file_format: 'EDI',
    recipient_email: recipient,
    email_service: 'centralized-email-gateway',
    email_id: sent.messageId ?? sent.logId ?? null,
    email_subject: subject,
    status: sent.success ? 'sent' : 'failed',
    submission_attempt: (previousAttempts ?? 0) + 1,
    submitted_at: now,
    sent_at: sent.success ? now : null,
    practice_id: practice.id,
    medical_aid_reference: batch.medical_aid_reference,
    total_claims: file.lineCount,
    total_amount: file.totalCents / 100,
    error_details: sent.success ? null : { message: sent.error },
    provider_response: { automatic: true, messageId: sent.messageId ?? null, logId: sent.logId ?? null }
  });

  if (!sent.success) {
    // Back to 'active' so the next run (or a person) can retry; give up automatically after 3 tries
    const giveUp = (previousAttempts ?? 0) + 1 >= MAX_SEND_ATTEMPTS;
    await client
      .from('batch_headers')
      .update({ status: 'active', auto_submit_error: giveUp ? `email failed ${MAX_SEND_ATTEMPTS} times: ${sent.error}` : null })
      .eq('id', batch.id);
    return { ...base, result: 'send_failed', detail: sent.error ?? 'unknown error' };
  }

  await client
    .from('batch_headers')
    .update({ status: 'sent', sent_at: now, recipient_email: recipient, generated_file_content: file.content, auto_submit_error: null, updated_at: now })
    .eq('id', batch.id)
    .eq('status', 'sending');
  return { ...base, result: 'sent', detail: `${file.lineCount} line(s), ${formatNad(file.totalCents / 100)} to ${recipient}` };
}

serve(async req => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const today = namibiaToday();
  const outcomes: BatchOutcome[] = [];
  const failures: string[] = [];

  const { data: settingsRows, error: settingsError } = await client
    .from('practice_claim_settings')
    .select('practice_id, auto_submit_enabled, min_days_open, notify_email')
    .eq('auto_submit_enabled', true);
  if (settingsError) {
    return new Response(JSON.stringify({ error: settingsError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const { data: funds } = await client.from('medical_aid_providers').select('name, email, medical_aid_reference');
  const fundByReference = new Map(((funds ?? []) as FundRow[]).map(fund => [(fund.medical_aid_reference ?? '').toUpperCase(), fund]));

  for (const settings of (settingsRows ?? []) as PracticeSettings[]) {
    try {
      const { data: practice, error: practiceError } = await client
        .from('practices')
        .select('id, name, practice_number, practice_type, contact_email')
        .eq('id', settings.practice_id)
        .maybeSingle();
      if (practiceError || !practice) throw new Error(practiceError?.message ?? 'practice not found');
      const { data: batches, error: batchError } = await client
        .from('batch_headers')
        .select('*')
        .eq('practice_id', settings.practice_id)
        .eq('status', 'active')
        .is('sent_at', null);
      if (batchError) throw new Error(batchError.message);
      for (const batch of (batches ?? []) as BatchHeaderRow[]) {
        try {
          outcomes.push(await processBatch(client, practice as PracticeRow, settings, batch, fundByReference.get(batch.medical_aid_reference.toUpperCase()), today));
        } catch (error) {
          failures.push(`practice ${settings.practice_id} batch ${batch.batch_number}: ${error instanceof Error ? error.message : String(error)}`);
          // A batch left in 'sending' by an error is released for the next run
          if (!DRY_RUN) await client.from('batch_headers').update({ status: 'active' }).eq('id', batch.id).eq('status', 'sending');
        }
      }
    } catch (error) {
      failures.push(`practice ${settings.practice_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return new Response(JSON.stringify({ today, dryRun: DRY_RUN, outcomes, failures }), {
    status: failures.length > 0 ? 207 : 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
