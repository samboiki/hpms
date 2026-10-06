/**
 * Patient lists: loading, changing and sending. The rules and the send loop live in
 * src/utils/patientLists (tested, shared with the scheduled sender); this file only talks to
 * Supabase and to the centralized SMS gateway (communicationService.sendSMS), so every list SMS
 * is logged in practice_sms_logs and counted against the practice's SMS bundle.
 *
 * The tables come from proposals/2026-10-07-patient-lists.sql. Until that is applied, loads throw
 * ListsNotEnabledError and the screens show "Automation lists are not switched on yet".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { communicationService, getCommunicationErrorMessage, type SendSMSResponse } from './communicationService';
import { parseAutomation, type ListAutomationSettings } from '../utils/patientLists/listAutomation';
import type { PracticeDetails } from '../utils/patientLists/listMessages';
import {
  toPatientFacts,
  validateRule,
  type ListKind,
  type ListMemberRow,
  type PatientFacts,
  type PatientFactsRow,
  type SmartRule
} from '../utils/patientLists/listRules';
import {
  isStopAllSmsError,
  messageTypeForRule,
  runListSend,
  summarizeRun,
  type ListRunSummary,
  type SendAttempt,
  type SendPlan,
  type SendResult
} from '../utils/patientLists/listSend';

// The generated database types do not include these tables yet, so rows are read with the
// untyped client and normalised below (same approach as components/finance/financeData.ts).
const db = supabase as unknown as SupabaseClient;

const PAGE_SIZE = 1000;
const ID_CHUNK = 200;

export class ListsNotEnabledError extends Error {
  constructor() {
    super('Automation lists are not switched on yet.');
    this.name = 'ListsNotEnabledError';
  }
}

interface DbError {
  code?: string;
  message?: string;
}

/** True when the patient-list tables or functions are not in the database yet. */
export function isListsNotEnabledError(error: unknown): boolean {
  if (error instanceof ListsNotEnabledError) return true;
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  // undefined_table, undefined_function, and PostgREST's "not in the schema cache"
  if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') return true;
  return /could not find the (table|function)|relation "?[\w.]*patient_list[\w]*"? does not exist/i.test(message ?? '');
}

const fail = (error: DbError, fallback: string): never => {
  if (isListsNotEnabledError(error)) throw new ListsNotEnabledError();
  throw new Error(error.message || fallback);
};

export interface PatientListRecord {
  id: string;
  practiceId: string;
  name: string;
  description: string | null;
  kind: ListKind;
  rule: SmartRule | null;
  /** A smart list whose stored rule cannot be used: shown with this message, never evaluated */
  ruleError: string | null;
  automation: ListAutomationSettings;
  automationEnabled: boolean;
  lastRunOn: string | null;
  lastRunAt: string | null;
  lastRunSummary: ListRunSummary | null;
  createdAt: string | null;
}

export interface PatientListRow {
  id: string;
  practice_id: string;
  name: string;
  description: string | null;
  kind: string;
  rule: unknown;
  automation: unknown;
  automation_enabled: boolean | null;
  last_run_on: string | null;
  last_run_at: string | null;
  last_run_summary: unknown;
  created_at: string | null;
}

const LIST_COLUMNS =
  'id, practice_id, name, description, kind, rule, automation, automation_enabled, last_run_on, last_run_at, last_run_summary, created_at';
const MEMBER_COLUMNS = 'list_id, patient_id, source, excluded, added_at, last_sent_at, last_sent_period';

const isRunSummary = (value: unknown): value is ListRunSummary =>
  typeof value === 'object' && value !== null && typeof (value as ListRunSummary).sent === 'number';

export function toListRecord(row: PatientListRow): PatientListRecord {
  const kind: ListKind = row.kind === 'smart' ? 'smart' : 'manual';
  const validation = kind === 'smart' ? validateRule(row.rule) : null;
  return {
    id: row.id,
    practiceId: row.practice_id,
    name: row.name,
    description: row.description?.trim() || null,
    kind,
    rule: validation?.ok ? validation.rule : null,
    ruleError: validation && !validation.ok ? validation.error : null,
    automation: parseAutomation(row.automation),
    automationEnabled: row.automation_enabled === true,
    lastRunOn: row.last_run_on,
    lastRunAt: row.last_run_at,
    lastRunSummary: isRunSummary(row.last_run_summary) ? row.last_run_summary : null,
    createdAt: row.created_at
  };
}

/** Maps the gateway's answer for one SMS to the send loop's result. */
export function toSendAttempt(response: Pick<SendSMSResponse, 'success' | 'logId' | 'error' | 'status'>): SendAttempt {
  if (response.success) return { ok: true, logId: response.logId || null };
  return {
    ok: false,
    error: getCommunicationErrorMessage('sms', response.error),
    stopAll: response.status === 'blocked' || isStopAllSmsError(response.error)
  };
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export const patientListService = {
  async loadLists(practiceId: string): Promise<PatientListRecord[]> {
    const { data, error } = await db
      .from('patient_lists')
      .select(LIST_COLUMNS)
      .eq('practice_id', practiceId)
      .order('created_at', { ascending: true });
    if (error) return fail(error, 'Could not load the lists.');
    return ((data ?? []) as PatientListRow[]).map(toListRecord);
  },

  /** Member rows of the practice: people added by hand, exclusions and send records. */
  async loadMemberRows(practiceId: string, patientId?: string): Promise<ListMemberRow[]> {
    const rows: ListMemberRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = db.from('patient_list_members').select(MEMBER_COLUMNS).eq('practice_id', practiceId);
      if (patientId) query = query.eq('patient_id', patientId);
      const { data, error } = await query.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (error) return fail(error, 'Could not load the list members.');
      rows.push(...((data ?? []) as ListMemberRow[]));
      if (!data || data.length < PAGE_SIZE) return rows;
    }
  },

  /** Facts for every patient of the practice (or only `patientIds`), for today in Windhoek. */
  async loadFacts(practiceId: string, todayKey: string, patientIds?: string[]): Promise<PatientFacts[]> {
    const facts: PatientFacts[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .rpc('patient_list_facts', {
          p_practice_id: practiceId,
          p_today: todayKey,
          p_patient_ids: patientIds ?? null
        })
        .range(from, from + PAGE_SIZE - 1);
      if (error) return fail(error, 'Could not load patient details for the lists.');
      facts.push(...((data ?? []) as PatientFactsRow[]).map(toPatientFacts));
      if (!data || data.length < PAGE_SIZE) return facts;
    }
  },

  /** Name and phone number used in messages ({{practice_name}}, {{practice_phone}}). */
  async loadPractice(practiceId: string): Promise<PracticeDetails> {
    const { data, error } = await db.from('practices').select('name, contact_phone').eq('id', practiceId).maybeSingle();
    if (error) throw new Error(error.message || 'Could not load the practice details.');
    const row = (data ?? {}) as { name?: string | null; contact_phone?: string | null };
    return { name: row.name?.trim() || null, phone: row.contact_phone?.trim() || null };
  },

  async createList(input: {
    practiceId: string;
    name: string;
    description: string | null;
    kind: ListKind;
    rule: SmartRule | null;
    automation: ListAutomationSettings;
  }): Promise<PatientListRecord> {
    const { data, error } = await db
      .from('patient_lists')
      .insert({
        practice_id: input.practiceId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        kind: input.kind,
        rule: input.kind === 'smart' ? input.rule : null,
        automation: input.automation,
        automation_enabled: false
      })
      .select(LIST_COLUMNS)
      .single();
    if (error?.code === '23505') throw new Error(`There is already a list called "${input.name.trim()}".`);
    if (error) return fail(error, 'Could not create the list.');
    return toListRecord(data as PatientListRow);
  },

  async updateList(
    listId: string,
    patch: {
      name?: string;
      description?: string | null;
      rule?: SmartRule;
      automation?: ListAutomationSettings;
      automationEnabled?: boolean;
    }
  ): Promise<PatientListRecord> {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.description !== undefined) update.description = patch.description?.trim() || null;
    if (patch.rule !== undefined) update.rule = patch.rule;
    if (patch.automation !== undefined) update.automation = patch.automation;
    if (patch.automationEnabled !== undefined) update.automation_enabled = patch.automationEnabled;
    const { data, error } = await db.from('patient_lists').update(update).eq('id', listId).select(LIST_COLUMNS).single();
    if (error?.code === '23505') throw new Error(`There is already a list called "${patch.name?.trim()}".`);
    if (error) return fail(error, 'Could not save the list.');
    return toListRecord(data as PatientListRow);
  },

  async deleteList(listId: string): Promise<void> {
    const { error } = await db.from('patient_lists').delete().eq('id', listId);
    if (error) fail(error, 'Could not delete the list.');
  },

  /**
   * Adds patients by hand. People already added by hand are counted, not added twice; someone
   * excluded or removed earlier is put back. Send records are kept, so adding a patient again
   * never lets them get a "once only" message twice.
   */
  async addPatients(practiceId: string, listId: string, patientIds: readonly string[]): Promise<{ added: number; alreadyOnList: number }> {
    const unique = [...new Set(patientIds)];
    const alreadyOn = new Set<string>();
    for (const ids of chunk(unique, ID_CHUNK)) {
      const { data, error } = await db
        .from('patient_list_members')
        .select('patient_id, source, excluded')
        .eq('list_id', listId)
        .in('patient_id', ids);
      if (error) return fail(error, 'Could not check the list.');
      for (const row of (data ?? []) as Array<{ patient_id: string; source: string; excluded: boolean }>) {
        if (row.source === 'manual' && !row.excluded) alreadyOn.add(row.patient_id);
      }
    }
    const toAdd = unique.filter((id) => !alreadyOn.has(id));
    const now = new Date().toISOString();
    for (const ids of chunk(toAdd, 500)) {
      const { error } = await db.from('patient_list_members').upsert(
        ids.map((patientId) => ({
          list_id: listId,
          practice_id: practiceId,
          patient_id: patientId,
          source: 'manual',
          excluded: false,
          excluded_at: null,
          excluded_by: null,
          added_at: now
        })),
        { onConflict: 'list_id,patient_id' }
      );
      if (error) return fail(error, 'Could not add the patients to the list.');
    }
    return { added: toAdd.length, alreadyOnList: alreadyOn.size };
  },

  /**
   * Takes a patient off a list (excluded = true) or puts them back. The row is kept rather than
   * deleted so a smart list does not pick them up again and their send record is not lost.
   */
  async setExcluded(practiceId: string, listId: string, patientId: string, excluded: boolean, userId: string | null): Promise<void> {
    const changes = excluded
      ? { excluded: true, excluded_at: new Date().toISOString(), excluded_by: userId }
      : { excluded: false, excluded_at: null, excluded_by: null };
    const { data, error } = await db
      .from('patient_list_members')
      .update(changes)
      .eq('list_id', listId)
      .eq('patient_id', patientId)
      .select('patient_id');
    if (error) return fail(error, 'Could not update the list.');
    if ((data ?? []).length > 0 || !excluded) return;
    // A smart-list member has no row until they are excluded or messaged
    const { error: insertError } = await db
      .from('patient_list_members')
      .insert({ list_id: listId, practice_id: practiceId, patient_id: patientId, source: 'rule', ...changes });
    if (insertError) fail(insertError, 'Could not update the list.');
  },

  /** Claims patients for a period; returns the ids that were not claimed already (see the SQL). */
  async claimSends(listId: string, patientIds: string[], periodKey: string): Promise<string[]> {
    const { data, error } = await db.rpc('claim_patient_list_sends', {
      p_list_id: listId,
      p_patient_ids: patientIds,
      p_period: periodKey
    });
    if (error) return fail(error, 'Could not record who is being messaged.');
    return ((data ?? []) as unknown[]).map((value) =>
      typeof value === 'string' ? value : String((value as Record<string, unknown>).claim_patient_list_sends ?? '')
    );
  },

  async releaseSend(listId: string, patientId: string, periodKey: string): Promise<void> {
    const { error } = await db.rpc('release_patient_list_send', {
      p_list_id: listId,
      p_patient_id: patientId,
      p_period: periodKey
    });
    if (error) fail(error, 'Could not release the send record.');
  },

  /**
   * "Send now": sends the plan the person confirmed, one SMS at a time through the centralized
   * gateway, then records the summary on the list.
   */
  async sendNow(input: {
    list: PatientListRecord;
    plan: SendPlan;
    onProgress?: (progress: { done: number; total: number; sent: number; failed: number }) => void;
    shouldStop?: () => boolean;
  }): Promise<SendResult> {
    const { list, plan } = input;
    const messageType = messageTypeForRule(list.rule);
    const result = await runListSend(plan, {
      claim: (ids) => patientListService.claimSends(list.id, ids, plan.periodKey),
      release: (patientId) => patientListService.releaseSend(list.id, patientId, plan.periodKey),
      send: async (recipient) =>
        toSendAttempt(
          await communicationService.sendSMS({
            practiceId: list.practiceId,
            recipientPhone: recipient.phone,
            messageContent: recipient.text,
            messageType,
            patientId: recipient.patientId,
            metadata: { source: 'patient_list', trigger: 'send_now', patient_list_id: list.id, patient_list_name: list.name, period: plan.periodKey },
            tags: ['patient-list']
          })
        ),
      onProgress: input.onProgress,
      shouldStop: input.shouldStop
    });
    const summary = summarizeRun(plan, result, 'manual', new Date());
    const { error } = await db
      .from('patient_lists')
      .update({ last_run_at: summary.at, last_run_summary: summary })
      .eq('id', list.id);
    if (error) console.error('Could not save the send summary on the list:', error.message);
    return result;
  }
};
