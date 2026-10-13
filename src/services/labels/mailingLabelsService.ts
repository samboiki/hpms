/**
 * Mailing labels for a patient list (O9, Messages > Lists): each patient's name and address, read once when the label
 * sheet opens, in batches, with the signed-in person's own rights (row level security keeps it to their practice).
 * Only the fields an address label prints; the label text is built in src/utils/labels/labelContent.ts (mailingRun).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { isMissingColumnError } from '../../utils/diary/dbErrors';
import type { PatientMergeSource } from '../../utils/templates/mergeFields';

const db = supabase as unknown as SupabaseClient;

const MAILING_COLUMNS = 'id, title, initials, first_name, last_name, postal_address, postal_code, home_address';
// patients.town (proposals/2026-10-13-patient-town.sql): read when the database has it, the address alone before
const WITH_TOWN = `${MAILING_COLUMNS}, town`;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

/** Patient id -> name and address, for the patients given (those not readable are simply missing) */
export async function loadMailingSources(patientIds: readonly string[]): Promise<Map<string, PatientMergeSource>> {
  const sources = new Map<string, PatientMergeSource>();
  const ids = [...new Set(patientIds)];
  let columns = WITH_TOWN;
  for (let start = 0; start < ids.length; start += 100) {
    let { data, error } = await db.from('patients').select(columns).in('id', ids.slice(start, start + 100));
    if (error && columns === WITH_TOWN && isMissingColumnError(error)) {
      columns = MAILING_COLUMNS;
      ({ data, error } = await db.from('patients').select(columns).in('id', ids.slice(start, start + 100)));
    }
    if (error) throw new Error(`Could not read the patients' addresses: ${error.message}`);
    // The column list is chosen at run time (with or without the town), so the client cannot type the rows itself
    for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
      sources.set(String(row.id), {
        title: text(row.title),
        initials: text(row.initials),
        firstName: text(row.first_name),
        lastName: text(row.last_name),
        postalAddress: text(row.postal_address),
        postalCode: text(row.postal_code),
        homeAddress: text(row.home_address),
        town: text(row.town)
      });
    }
  }
  return sources;
}
