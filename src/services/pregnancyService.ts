/**
 * Pregnancy due dates (patients.pregnancy_due_date, proposals/2026-10-13-patient-file-extras.sql): read and set on the
 * patient file, and the due-dates list (Messages > Lists > Due dates). Staff write the column through their practice's
 * existing patients policies, and the file's change history records each change. Before the column exists both say
 * "not set up yet". The rules (which practices, which dates) are in src/utils/clinical/pregnancy.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingColumnError } from '../utils/diary/dbErrors';
import { toDateKey } from '../utils/billing/dates';
import type { DateRange } from '../utils/clinical/pregnancy';

export const DUE_DATE_COLUMN = 'pregnancy_due_date';
/** More patients due in one period than any practice has; the list says when it stops there */
export const MAX_DUE_LIST = 500;

export class DueDatesNotSetUpError extends Error {
  constructor() {
    super('Pregnancy due dates are not set up in this database yet.');
    this.name = 'DueDatesNotSetUpError';
  }
}

interface DbError {
  code?: string;
  message?: string;
}

/** The column is not there yet (42703 on a read, PGRST204 on a write); another missing column is a real error. */
export function isDueDatesNotSetUp(error: unknown): boolean {
  if (error instanceof DueDatesNotSetUpError) return true;
  const message = ((error && typeof error === 'object' ? (error as DbError).message : '') ?? '').toLowerCase();
  return isMissingColumnError(error) && (message === '' || message.includes(DUE_DATE_COLUMN));
}

// The generated database types do not include the column yet
const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;

/** The patient's due date (yyyy-MM-dd) or null. */
export async function loadDueDate(patientId: string): Promise<string | null> {
  const { data, error } = await db.from('patients').select(DUE_DATE_COLUMN).eq('id', patientId).maybeSingle();
  if (error) {
    if (isDueDatesNotSetUp(error)) throw new DueDatesNotSetUpError();
    throw new Error(`Could not read the due date: ${error.message}`);
  }
  return toDateKey(((data ?? {}) as Row)[DUE_DATE_COLUMN] as string | null);
}

/** Sets (a date) or clears (null) the patient's due date at this practice. */
export async function saveDueDate(practiceId: string, patientId: string, dueDate: string | null): Promise<void> {
  const { data, error } = await db
    .from('patients')
    .update({ [DUE_DATE_COLUMN]: dueDate })
    .eq('id', patientId)
    .eq('practice_id', practiceId)
    .select('id');
  if (error) {
    if (isDueDatesNotSetUp(error)) throw new DueDatesNotSetUpError();
    throw new Error(`Could not save the due date: ${error.message}`);
  }
  // Nothing changed: not a file of this practice (or not one this login may change)
  if (!data || data.length === 0) throw new Error("This patient's file could not be changed from your practice.");
}

export interface DuePatient {
  patientId: string;
  firstName: string;
  lastName: string;
  cellNumber: string | null;
  dueDate: string;
}

/** Everyone at the practice due in the period, soonest first (files merged into another are left out). */
export async function listDueDates(practiceId: string, range: DateRange): Promise<{ patients: DuePatient[]; more: boolean }> {
  const { data, error } = await db
    .from('patients')
    .select(`id, first_name, last_name, cell_number, ${DUE_DATE_COLUMN}`)
    .eq('practice_id', practiceId)
    .is('merged_into_patient_id', null)
    .gte(DUE_DATE_COLUMN, range.from)
    .lte(DUE_DATE_COLUMN, range.to)
    .order(DUE_DATE_COLUMN, { ascending: true })
    .order('last_name', { ascending: true })
    .range(0, MAX_DUE_LIST);
  if (error) {
    if (isDueDatesNotSetUp(error)) throw new DueDatesNotSetUpError();
    throw new Error(`Could not load the due dates: ${error.message}`);
  }
  const rows = (data ?? []) as Row[];
  const patients = rows.slice(0, MAX_DUE_LIST).flatMap(row => {
    const dueDate = toDateKey(row[DUE_DATE_COLUMN] as string | null);
    if (!dueDate) return [];
    return [
      {
        patientId: String(row.id),
        firstName: typeof row.first_name === 'string' ? row.first_name.trim() : '',
        lastName: typeof row.last_name === 'string' ? row.last_name.trim() : '',
        cellNumber: typeof row.cell_number === 'string' && row.cell_number.trim() ? row.cell_number.trim() : null,
        dueDate
      }
    ];
  });
  return { patients, more: rows.length > MAX_DUE_LIST };
}
