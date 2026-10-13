/**
 * Communications > Automations talks to the database only through here: the practice's switches and messages
 * (practice_automation_settings, read under the practice's own RLS), what the sender did (automation_status) and
 * saving (save_automation_setting: practice administrators only). The functions come with
 * proposals/2026-10-08-automations.sql; until it is applied the screen says "not set up yet" and nothing can be
 * switched on.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  WIRED_AUTOMATION_IDS,
  automationSettingFromRow,
  type AutomationMessages,
  type AutomationSetting,
  type WiredAutomationId
} from '../../../supabase/functions/process-automation-queue/automationRules.ts';
import { automationStatusFromRpc, type AutomationStatus } from '../../utils/automations/processorHealth';

// The generated database types do not know these functions yet
const db = supabase as unknown as SupabaseClient;

export type AutomationSettings = Record<WiredAutomationId, AutomationSetting>;

export type AutomationsLoad =
  | { state: 'ready'; settings: AutomationSettings; status: AutomationStatus }
  /** proposals/2026-10-08-automations.sql is not applied: show the settings, switch nothing */
  | { state: 'not_set_up'; settings: AutomationSettings }
  | { state: 'error'; message: string };

const SETTINGS_COLUMNS = 'automation_id, enabled, sms_enabled, email_enabled, sms_template, email_subject, email_body';

interface DbError {
  code?: string;
  message?: string;
}

/** PostgREST answers PGRST202 (Postgres 42883) when a function does not exist yet. */
export const isMissingFunctionError = (error: DbError | null | undefined): boolean => error?.code === 'PGRST202' || error?.code === '42883';

/** The practice's settings for each automation the sender handles, and what the sender did. */
export async function loadAutomations(practiceId: string): Promise<AutomationsLoad> {
  const [settingsResult, statusResult] = await Promise.all([
    db.from('practice_automation_settings').select(SETTINGS_COLUMNS).eq('practice_id', practiceId).in('automation_id', [...WIRED_AUTOMATION_IDS]),
    db.rpc('automation_status', { p_practice_id: practiceId })
  ]);
  if (settingsResult.error) {
    console.error('Could not load the automation settings:', settingsResult.error.code, settingsResult.error.message);
    return { state: 'error', message: 'The automations could not be loaded. Please try again.' };
  }
  const rows = (settingsResult.data ?? []) as Array<Record<string, unknown>>;
  const settings = Object.fromEntries(
    WIRED_AUTOMATION_IDS.map((id) => [id, automationSettingFromRow(id, rows.find((row) => row.automation_id === id) ?? null)])
  ) as AutomationSettings;

  if (statusResult.error) {
    if (isMissingFunctionError(statusResult.error)) return { state: 'not_set_up', settings };
    console.error('Could not load the automation status:', statusResult.error.code, statusResult.error.message);
    return { state: 'error', message: 'The automations could not be loaded. Please try again.' };
  }
  return { state: 'ready', settings, status: automationStatusFromRpc(statusResult.data) };
}

export type AutomationSave = { ok: true } | { ok: false; message: string };

/** Switches an automation on or off and saves its messages (save_automation_setting checks the role and the text). */
export async function saveAutomationSetting(
  practiceId: string,
  automationId: WiredAutomationId,
  enabled: boolean,
  messages: AutomationMessages
): Promise<AutomationSave> {
  const { error } = await db.rpc('save_automation_setting', {
    p_practice_id: practiceId,
    p_automation_id: automationId,
    p_enabled: enabled,
    p_sms_enabled: messages.smsEnabled,
    p_email_enabled: messages.emailEnabled,
    p_sms_template: messages.smsTemplate,
    p_email_subject: messages.emailSubject,
    p_email_body: messages.emailBody
  });
  if (!error) return { ok: true };
  if (error.code === '42501') return { ok: false, message: 'Only a practice administrator can change automations.' };
  if (isMissingFunctionError(error)) {
    return { ok: false, message: 'Automatic messages are not set up yet: OneHealth support must apply the automations update.' };
  }
  // The save function explains a refused message in plain words (the same checks as the form)
  if (error.code === '22023' && error.message) return { ok: false, message: error.message };
  console.error('Could not save the automation:', error.code, error.message);
  return { ok: false, message: 'The automation could not be saved. Please try again.' };
}
