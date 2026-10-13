/**
 * What the invoicing database update (proposals/2026-10-07-invoicing.sql) has switched on. The app works the same
 * before it is applied: lines are saved without the new columns, numbers stay provisional, nothing is audited.
 * Each probe asks for zero rows of the new columns, so it costs one tiny request; a "yes" is remembered for the
 * session (columns do not disappear), a "no" is asked again after a minute, so applying the update needs no reload.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// The generated database types do not know the new columns and tables yet
const db = supabase as unknown as SupabaseClient;

/** invoice_services columns added by the update: the line's own date, treating practitioner and discount. */
export const LINE_DETAIL_COLUMNS = ['service_date', 'practitioner_id', 'discount_amount'] as const;

/**
 * invoice_services columns added by proposals/2026-10-08-invoice-line-codes.sql: the line's ICD-10 codes and a fee
 * changed from the price list (why, the price before, who and when).
 */
export const LINE_CODE_COLUMNS = ['icd10_primary', 'icd10_secondary', 'fee_override_reason', 'fee_override_from', 'fee_override_by', 'fee_override_at'] as const;

/**
 * invoice_services columns added by proposals/2026-10-09-line-portions.sql: who pays the line when one side pays all
 * of it ('patient' lines are never claimed) and the fund's authorisation number.
 */
export const LINE_PORTION_COLUMNS = ['paid_by', 'authorisation_number'] as const;

/**
 * invoice_services columns added by proposals/2026-10-12-line-teeth-and-billing-practitioners.sql: the surfaces of a
 * line's one tooth and the quadrant of a code billed per quadrant (dental practices).
 */
export const LINE_TEETH_COLUMNS = ['tooth_surfaces', 'tooth_quadrant'] as const;

/**
 * invoice_services columns added by proposals/2026-10-12-referrals-and-authorisations.sql: a line's own referral from
 * the patient's register (claim fields 25, 43, 44), its assistant and its anaesthetist (parity D7).
 */
export const LINE_PEOPLE_COLUMNS = ['referral_id', 'assistant_id', 'anaesthetist_id'] as const;

/**
 * invoice_services columns added by proposals/2026-10-13-billing-extras.sql: the promotion a line's discount came from
 * and the prepaid package a line was paid from.
 */
export const LINE_EXTRA_COLUMNS = ['promotion_id', 'package_id'] as const;

interface DbError {
  code?: string;
  message?: string;
}

/** True when PostgREST says a column or table is not there (the update is not applied). */
export function isNotSetUpError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (code === '42703' || code === '42P01' || code === 'PGRST204' || code === 'PGRST205') return true;
  return /does not exist|could not find the .* (column|table)|schema cache/i.test(message ?? '');
}

export interface InvoicingSetup {
  /** invoice_services has service_date, practitioner_id and discount_amount */
  lineDetails: boolean;
  /** invoices_enhanced has created_by (who raised the invoice) */
  createdBy: boolean;
  /** invoice_audit_events exists (who changed a note, practitioner or line, and when) */
  audit: boolean;
  /** invoice_services has the ICD-10 and changed-fee columns (LINE_CODE_COLUMNS) */
  lineCodes: boolean;
  /** invoice_services has paid_by and authorisation_number (LINE_PORTION_COLUMNS); absent means no */
  linePortions?: boolean;
  /** invoice_services has tooth_surfaces and tooth_quadrant (LINE_TEETH_COLUMNS); absent means no */
  lineTeeth?: boolean;
  /** invoice_services has referral_id, assistant_id and anaesthetist_id (LINE_PEOPLE_COLUMNS); absent means no */
  linePeople?: boolean;
  /** invoice_services has promotion_id and package_id (LINE_EXTRA_COLUMNS); absent means no */
  lineExtras?: boolean;
}

const RETRY_MS = 60_000;
type Probe = { value: boolean; at: number };
const probes = new Map<string, Probe>();

async function probe(key: string, run: () => PromiseLike<{ error: unknown }>): Promise<boolean> {
  const known = probes.get(key);
  if (known && (known.value || Date.now() - known.at < RETRY_MS)) return known.value;
  let value = false;
  try {
    const { error } = await run();
    value = !error;
    // A network or permission error says nothing about the columns: ask again next time
    if (error && !isNotSetUpError(error)) return false;
  } catch {
    return false;
  }
  probes.set(key, { value, at: Date.now() });
  return value;
}

/** Which parts of the invoicing update exist in the database. */
export async function loadInvoicingSetup(): Promise<InvoicingSetup> {
  const [lineDetails, createdBy, audit, lineCodes, linePortions, lineTeeth, linePeople, lineExtras] = await Promise.all([
    probe('lineDetails', () => db.from('invoice_services').select(LINE_DETAIL_COLUMNS.join(', ')).limit(0)),
    probe('createdBy', () => db.from('invoices_enhanced').select('created_by').limit(0)),
    probe('audit', () => db.from('invoice_audit_events').select('id').limit(0)),
    probe('lineCodes', () => db.from('invoice_services').select(LINE_CODE_COLUMNS.join(', ')).limit(0)),
    probe('linePortions', () => db.from('invoice_services').select(LINE_PORTION_COLUMNS.join(', ')).limit(0)),
    probe('lineTeeth', () => db.from('invoice_services').select(LINE_TEETH_COLUMNS.join(', ')).limit(0)),
    probe('linePeople', () => db.from('invoice_services').select(LINE_PEOPLE_COLUMNS.join(', ')).limit(0)),
    probe('lineExtras', () => db.from('invoice_services').select(LINE_EXTRA_COLUMNS.join(', ')).limit(0))
  ]);
  return { lineDetails, createdBy, audit, lineCodes, linePortions, lineTeeth, linePeople, lineExtras };
}

/** For tests: forget what was probed. */
export function resetInvoicingSetupCache(): void {
  probes.clear();
}
