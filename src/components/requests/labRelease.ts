/**
 * "Release to patient": lab results appear in the patient app only after a doctor (or a practice
 * administrator) released them, and a result changed after release goes back to "not released".
 * The database enforces both (proposals/2026-10-07-patient-portal.sql, section 3); this is the staff side.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

// The generated database types do not know the release function yet
const db = supabase as unknown as SupabaseClient;

export interface ReleasableResult {
  id: string;
  released_to_patient?: boolean | null;
}

export type ReleaseState =
  /** The patient app database change is not applied: nothing to show */
  | { kind: 'unavailable' }
  | { kind: 'none'; total: number }
  | { kind: 'partly'; total: number; released: number }
  | { kind: 'all'; total: number };

/** Where a lab request's results stand in the patient app. */
export function releaseState(results: ReleasableResult[]): ReleaseState {
  if (results.length === 0 || !results.some((result) => 'released_to_patient' in result)) return { kind: 'unavailable' };
  const released = results.filter((result) => result.released_to_patient === true).length;
  if (released === 0) return { kind: 'none', total: results.length };
  if (released === results.length) return { kind: 'all', total: results.length };
  return { kind: 'partly', total: results.length, released };
}

export type ReleaseOutcome = { ok: true; changed: number } | { ok: false; message: string };

/** Releases (or takes back) every result of the lab request. */
export async function setLabResultsRelease(labRequestId: string, release: boolean): Promise<ReleaseOutcome> {
  const { data, error } = await db.rpc('release_lab_results_to_patient', { p_lab_request_id: labRequestId, p_release: release });
  if (error) {
    if (error.code === '42501') return { ok: false, message: 'Only a doctor or a practice administrator can release results to the patient.' };
    if (error.code === 'PGRST202' || error.code === '42883') return { ok: false, message: 'The patient app is not switched on yet.' };
    return { ok: false, message: 'Could not change what the patient sees. Please try again.' };
  }
  return { ok: true, changed: typeof data === 'number' ? data : 0 };
}
