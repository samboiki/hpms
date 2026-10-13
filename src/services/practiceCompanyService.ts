import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isNotSetUpError } from './invoicingSetup';

// Untyped: these tables and columns are newer than the generated types (src/types/database.types.ts)
const db = supabase as unknown as SupabaseClient;

/**
 * The practice's own company details (Settings > System > Company details), kept on the practices row.
 *
 * Owner decision 13 Oct 2026: the invented company block (a support number, "HQ in South Africa", a "Verified" badge)
 * goes; each practice enters its own details. All are existing practices columns: the name, phone, email, address and
 * website are the ones the practice profile edits, tax_number is the "VAT/Tax no" printed on invoices and quotes, and
 * registration_number is checked by the protected-columns rule. The row is read with select('*'), so a column the
 * database lacks shows "not set up yet" and is never sent.
 */
export const COMPANY_FIELDS = [
  'name',
  'registration_number',
  'tax_number',
  'contact_phone',
  'contact_email',
  'address',
  'city',
  'postal_code',
  'website_url'
] as const;

export type CompanyField = typeof COMPANY_FIELDS[number];
export type CompanyDetails = Record<CompanyField, string>;

export const COMPANY_LABELS: Record<CompanyField, string> = {
  name: 'Company name',
  registration_number: 'Registration number',
  tax_number: 'VAT / tax number',
  contact_phone: 'Phone',
  contact_email: 'Email',
  address: 'Street or postal address',
  city: 'Town',
  postal_code: 'Postal code',
  website_url: 'Website'
};

export interface CompanyLoad {
  details: CompanyDetails;
  /** Columns the practices row has (a field outside this set is not set up yet) */
  available: CompanyField[];
}

const text = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value));

/** The details from a practices row read with select('*'): a key the row lacks is a column the database lacks */
export function companyFromRow(row: Record<string, unknown>): CompanyLoad {
  const available = COMPANY_FIELDS.filter(field => field in row);
  const details = Object.fromEntries(COMPANY_FIELDS.map(field => [field, text(row[field]).trim()])) as CompanyDetails;
  return { details, available };
}

/** What is wrong with the details as typed, or null */
export function companyProblem(details: CompanyDetails): string | null {
  if (!details.name.trim()) return 'Enter the company name.';
  const email = details.contact_email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Check the email address (for example reception@yourpractice.com.na).';
  const phone = details.contact_phone.trim();
  if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) return 'Check the phone number (digits, spaces and a leading + only).';
  const website = details.website_url.trim();
  if (website && /\s/.test(website)) return 'A website address cannot contain spaces.';
  return null;
}

/** Only the fields that changed and whose columns exist; empty text is saved as no value */
export function companyChanges(before: CompanyDetails, after: CompanyDetails, available: CompanyField[]): Partial<Record<CompanyField, string | null>> {
  const changes: Partial<Record<CompanyField, string | null>> = {};
  for (const field of available) {
    const next = after[field].trim();
    if (next !== before[field].trim()) changes[field] = field === 'name' ? next : next || null;
  }
  return changes;
}

export async function loadCompanyDetails(practiceId: string): Promise<{ ok: true; value: CompanyLoad } | { ok: false; message: string }> {
  const { data, error } = await db.from('practices').select('*').eq('id', practiceId).maybeSingle();
  if (error || !data) {
    console.error('Company details could not be loaded', error);
    return { ok: false, message: 'The company details could not be loaded. Please refresh the page.' };
  }
  return { ok: true, value: companyFromRow(data as Record<string, unknown>) };
}

export async function saveCompanyDetails(
  practiceId: string,
  changes: Partial<Record<CompanyField, string | null>>
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (Object.keys(changes).length === 0) return { ok: true };
  const { data, error } = await db
    .from('practices')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', practiceId)
    .select('id');
  if (error) {
    console.error('Company details could not be saved', error);
    // The database explains a refused protected field in plain words (practice-protected-columns)
    if ((error as { hint?: string }).hint === 'practice_protected_columns') return { ok: false, message: error.message };
    if (isNotSetUpError(error)) return { ok: false, message: 'Some company fields are not set up yet. Please refresh the page and try again.' };
    return { ok: false, message: 'The company details could not be saved. Please try again.' };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: 'These changes were not saved: only practice administrators can change the company details.' };
  }
  return { ok: true };
}
