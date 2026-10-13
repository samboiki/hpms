/**
 * Practice features only OneHealth support switches, first "Patients' SMS replies are collected" (practice_features
 * 'sms_replies', which the SMS senders read). Staff read their practice's rows; the one way to write them is
 * set_practice_feature (proposals/2026-10-08-practice-features-switch.sql): active super admins only, known keys
 * only, every change recorded in audit_logs.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
// Shared with the edge functions (pure TypeScript): the one home of the SMS replies feature key
import { SMS_REPLIES_FEATURE_KEY } from '../../supabase/functions/_shared/smsMessagePolicy.ts';

// The generated database types do not know set_practice_feature, so it is called with the untyped client
const db = supabase as unknown as SupabaseClient;

/** The features support may switch: set_practice_feature's v_known list (a unit test compares the two) */
export const SUPPORT_SWITCHED_FEATURES: readonly string[] = [SMS_REPLIES_FEATURE_KEY];

export interface PracticeFeatureState {
  enabled: boolean;
  /** When it was last switched (ISO), if known */
  updatedAt: string | null;
}

/** One feature's state per practice id. A practice without a row has the feature off. */
export type PracticeFeatureStates = Readonly<Record<string, PracticeFeatureState>>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

/** A practice_features row, or set_practice_feature's answer, as a state (null without a practice id). */
export function featureStateFromRow(row: unknown): { practiceId: string; state: PracticeFeatureState } | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const practiceId = text(r.practice_id);
  if (!practiceId) return null;
  return { practiceId, state: { enabled: r.is_enabled === true, updatedAt: text(r.updated_at) } };
}

export function featureStatesFromRows(rows: unknown): PracticeFeatureStates {
  const states: Record<string, PracticeFeatureState> = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const entry = featureStateFromRow(row);
    if (entry) states[entry.practiceId] = entry.state;
  }
  return states;
}

export type PracticeFeatureLoad = { ok: true; states: PracticeFeatureStates } | { ok: false; message: string };

/** Every practice's state of one feature (super admins read every practice's row). */
export async function loadPracticeFeatureStates(featureKey: string): Promise<PracticeFeatureLoad> {
  const { data, error } = await db
    .from('practice_features')
    .select('practice_id, is_enabled, updated_at')
    .eq('feature_key', featureKey);
  if (error) return { ok: false, message: `The switches could not be read: ${error.message}` };
  return { ok: true, states: featureStatesFromRows(data) };
}

/** The database's refusal in words a support person can act on. */
export function describeFeatureSwitchError(error: { code?: string | null; message?: string | null } | null | undefined): string {
  const code = error?.code ?? '';
  // PostgREST: the function is not in its schema cache; Postgres: no such function
  if (code === 'PGRST202' || code === '42883') return 'Not saved: this switch is not set up in the database yet.';
  if (code === '42501') return 'Not saved: only OneHealth support can change this.';
  if (code === 'P0002') return 'Not saved: this practice no longer exists.';
  return `Not saved: ${error?.message || 'please try again.'}`;
}

export type FeatureSwitchResult = { ok: true; state: PracticeFeatureState } | { ok: false; message: string };

/** Switches a feature for a practice. OneHealth support only: the database refuses everyone else. */
export async function setPracticeFeature(practiceId: string, featureKey: string, enabled: boolean): Promise<FeatureSwitchResult> {
  const { data, error } = await db.rpc('set_practice_feature', {
    p_practice_id: practiceId,
    p_feature_key: featureKey,
    p_enabled: enabled,
  });
  if (error) return { ok: false, message: describeFeatureSwitchError(error) };
  const entry = featureStateFromRow(data);
  return entry ? { ok: true, state: entry.state } : { ok: false, message: 'Not saved: the database gave no answer. Please try again.' };
}
