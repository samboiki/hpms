/**
 * Patient recalls (parity O3, O5): read from public.patient_recall_status, written only through set_patient_recall()
 * and remove_patient_recall() (proposals/2026-10-12-patient-recalls.sql). The rules are in
 * src/utils/patientLists/recalls.ts; whether a booking completes a recall is decided by the database view.
 * Before the proposal is applied, every call throws RecallsNotSetUpError and the screens say "not set up yet".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toPatientRecall, tidyRecallReason, type PatientRecall, type PatientRecallRow } from '../utils/patientLists/recalls';

// The generated database types do not include these yet (same approach as patientListService.ts)
const db = supabase as unknown as SupabaseClient;

const RECALL_COLUMNS = 'id, patient_id, due_on, reason, visit_id, created_at, status, matched_visit_id, matched_on';
const PAGE_SIZE = 1000;
const ID_CHUNK = 200;
// Recalls set together (the diary report's list of patients): a few calls at a time
const SET_AT_ONCE = 5;

export class RecallsNotSetUpError extends Error {
  constructor() {
    super('Recalls are not set up in this database yet.');
    this.name = 'RecallsNotSetUpError';
  }
}

interface DbError {
  code?: string;
  message?: string;
}

/** True when the recall table, view or functions are not in the database yet (only ours: any other error is real). */
export function isRecallsNotSetUpError(error: unknown): boolean {
  if (error instanceof RecallsNotSetUpError) return true;
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!/patient_recall/i.test(message ?? '')) return false;
  if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') return true;
  return /could not find the (table|function)|does not exist/i.test(message ?? '');
}

const fail = (error: DbError, fallback: string): never => {
  if (isRecallsNotSetUpError(error)) throw new RecallsNotSetUpError();
  throw new Error(error.message || fallback);
};

const toRecalls = (rows: unknown): PatientRecall[] =>
  ((rows ?? []) as PatientRecallRow[]).map(toPatientRecall).filter((recall): recall is PatientRecall => recall !== null);

export interface RecallPatient {
  id: string;
  name: string;
  cellNumber: string | null;
}

export const patientRecallService = {
  /** Every recall of one patient, with what the database says about it (open, booked, seen, removed). */
  async loadForPatient(practiceId: string, patientId: string): Promise<PatientRecall[]> {
    const { data, error } = await db
      .from('patient_recall_status')
      .select(RECALL_COLUMNS)
      .eq('practice_id', practiceId)
      .eq('patient_id', patientId)
      .order('due_on', { ascending: true })
      .order('id', { ascending: true });
    if (error) return fail(error, 'Could not load the recalls.');
    return toRecalls(data);
  },

  /** Recalls still open whose date falls from `from` to `to` (the "Recalled but not seen" report). */
  async loadOpenInRange(practiceId: string, from: string, to: string): Promise<PatientRecall[]> {
    const recalls: PatientRecall[] = [];
    for (let start = 0; ; start += PAGE_SIZE) {
      const { data, error } = await db
        .from('patient_recall_status')
        .select(RECALL_COLUMNS)
        .eq('practice_id', practiceId)
        .eq('status', 'open')
        .gte('due_on', from)
        .lte('due_on', to)
        .order('due_on', { ascending: true })
        .order('id', { ascending: true })
        .range(start, start + PAGE_SIZE - 1);
      if (error) return fail(error, 'Could not load the recalls.');
      recalls.push(...toRecalls(data));
      if (!data || data.length < PAGE_SIZE) return recalls;
    }
  },

  /** These patients' recalls still to do (open or booked): the report does not set the same recall twice. */
  async loadInForceForPatients(practiceId: string, patientIds: readonly string[]): Promise<PatientRecall[]> {
    const recalls: PatientRecall[] = [];
    const ids = [...new Set(patientIds)];
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const { data, error } = await db
        .from('patient_recall_status')
        .select(RECALL_COLUMNS)
        .eq('practice_id', practiceId)
        .in('status', ['open', 'booked'])
        .in('patient_id', ids.slice(i, i + ID_CHUNK));
      if (error) return fail(error, 'Could not load the recalls.');
      recalls.push(...toRecalls(data));
    }
    return recalls;
  },

  /** Names and cell numbers of these patients of the practice, by id (the report lists who to call). */
  async loadPatients(practiceId: string, patientIds: readonly string[]): Promise<Map<string, RecallPatient>> {
    const patients = new Map<string, RecallPatient>();
    const ids = [...new Set(patientIds)];
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const { data, error } = await db
        .from('patients')
        .select('id, first_name, last_name, cell_number')
        .eq('practice_id', practiceId)
        .in('id', ids.slice(i, i + ID_CHUNK));
      if (error) throw new Error(error.message || 'Could not load the patients.');
      for (const row of (data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; cell_number: string | null }>) {
        patients.set(row.id, {
          id: row.id,
          name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Patient without a name',
          cellNumber: row.cell_number?.trim() || null
        });
      }
    }
    return patients;
  },

  /** Sets a recall, or changes the date and reason of one (recallId); a visit when it is set from one. */
  async setRecall(input: {
    practiceId: string;
    patientId: string;
    dueOn: string;
    reason: string;
    visitId?: string | null;
    recallId?: string | null;
  }): Promise<string> {
    const { data, error } = await db.rpc('set_patient_recall', {
      p_practice_id: input.practiceId,
      p_patient_id: input.patientId,
      p_due_on: input.dueOn,
      p_reason: tidyRecallReason(input.reason),
      p_visit_id: input.visitId ?? null,
      p_recall_id: input.recallId ?? null
    });
    if (error) return fail(error, 'Could not save the recall.');
    return String(data);
  },

  /** Removes a recall (the practice keeps it as history). */
  async removeRecall(practiceId: string, recallId: string): Promise<void> {
    const { error } = await db.rpc('remove_patient_recall', { p_practice_id: practiceId, p_recall_id: recallId });
    if (error) fail(error, 'Could not remove the recall.');
  },

  /**
   * Sets, or moves (recallId), several recalls at once (the diary report's "Move to a recall list"), a few at a time.
   * Each goes through set_patient_recall and its rules; one refused never stops the others. Throws
   * RecallsNotSetUpError when the database has no recalls yet.
   */
  async setRecalls(
    practiceId: string,
    recalls: ReadonlyArray<{ patientId: string; dueOn: string; reason: string; recallId?: string | null }>
  ): Promise<{ set: number; refused: number; firstRefusal: string | null }> {
    let set = 0;
    let refused = 0;
    let firstRefusal: string | null = null;
    for (let i = 0; i < recalls.length; i += SET_AT_ONCE) {
      const results = await Promise.allSettled(
        recalls.slice(i, i + SET_AT_ONCE).map((recall) => patientRecallService.setRecall({ practiceId, ...recall }))
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          set += 1;
          continue;
        }
        if (result.reason instanceof RecallsNotSetUpError) throw result.reason;
        refused += 1;
        firstRefusal ??= result.reason instanceof Error ? result.reason.message : 'Could not save the recall.';
      }
    }
    return { set, refused, firstRefusal };
  }
};
