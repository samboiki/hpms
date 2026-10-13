/**
 * Reads (and the co-payment setting writes) what invoicing needs around the lines: the practice's co-payment rules,
 * the staff who can be treating practitioners, and the patient's lines already billed (duplicate warning).
 * The rules themselves live in src/utils/billing (lineSplit.ts, invoiceRights.ts, invoiceDuplicates.ts), tested.
 */
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database.types';
import { COPAY_SETTING_KEY, parseCopayRules, type CopayRule } from '../utils/billing/lineSplit';
import type { StaffMember } from '../utils/billing/invoiceRights';
import type { BilledLine } from '../utils/billing/invoiceDuplicates';
import { toDateKey } from '../utils/billing/dates';
import { parseToothList } from '../utils/billing/pricing';
import { loadInvoicingSetup } from './invoicingSetup';

/** The practice's co-payment rules (practice_settings fund_copayments); none when not set or unreadable. */
export async function loadCopayRules(practiceId: string | null): Promise<{ rules: CopayRule[]; error: string | null }> {
  if (!practiceId) return { rules: [], error: null };
  const { data, error } = await supabase
    .from('practice_settings')
    .select('setting_value')
    .eq('practice_id', practiceId)
    .eq('setting_key', COPAY_SETTING_KEY)
    .limit(1);
  if (error) return { rules: [], error: error.message };
  return { rules: parseCopayRules(data?.[0]?.setting_value ?? null), error: null };
}

/** Saves the co-payment rules (practice admins; RLS decides). */
export async function saveCopayRules(practiceId: string, rules: readonly CopayRule[]): Promise<void> {
  const clean = parseCopayRules(rules);
  const { error } = await supabase.from('practice_settings').upsert(
    {
      practice_id: practiceId,
      setting_key: COPAY_SETTING_KEY,
      setting_value: clean as unknown as Json,
      setting_type: 'json',
      description: 'Co-payments: the share of each medical aid line the patient pays, per fund (and plan option)',
      is_public: false
    },
    { onConflict: 'practice_id,setting_key' }
  );
  if (error) throw new Error(`Could not save the co-payments: ${error.message}`);
}

/** The practice's staff with what the treating-practitioner choice needs. */
export async function loadPracticeStaff(practiceId: string | null): Promise<StaffMember[]> {
  if (!practiceId) return [];
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, role, is_active, hpcsa_number')
    .eq('practice_id', practiceId)
    .order('full_name');
  if (error) throw new Error(`Could not load the practitioners: ${error.message}`);
  return (data ?? []) as StaffMember[];
}

interface BilledRow {
  id: string;
  invoice_id: string;
  code: string;
  tooth_number: string | null;
  service_date?: string | null;
}

/**
 * The patient's lines already on invoices (for the duplicate warning), with each line's service date: its own once
 * the invoicing update is applied, otherwise its visit's date (else the invoice date). Only invoices issued on or
 * after `sinceKey` are read.
 */
export async function loadPatientBilledLines(patientId: string, sinceKey: string): Promise<BilledLine[]> {
  const { data: invoices, error } = await supabase
    .from('invoices_enhanced')
    .select('id, invoice_number, visit_id, issue_date, payment_status')
    .eq('patient_id', patientId)
    .gte('issue_date', sinceKey)
    .limit(200);
  if (error) throw new Error(`Could not check the patient's earlier invoices: ${error.message}`);
  if (!invoices || invoices.length === 0) return [];
  const visitIds = [...new Set(invoices.map(invoice => invoice.visit_id).filter((id): id is string => Boolean(id)))];
  const { lineDetails } = await loadInvoicingSetup();
  const [lines, visits] = await Promise.all([
    supabase
      .from('invoice_services')
      .select(`id, invoice_id, code, tooth_number${lineDetails ? ', service_date' : ''}`)
      .in('invoice_id', invoices.map(invoice => invoice.id)),
    visitIds.length > 0 ? supabase.from('visits').select('id, visit_date').in('id', visitIds) : Promise.resolve({ data: [], error: null })
  ]);
  if (lines.error) throw new Error(`Could not check the patient's earlier invoices: ${lines.error.message}`);
  const visitDate = new Map(((visits.data ?? []) as Array<{ id: string; visit_date: string | null }>).map(visit => [visit.id, toDateKey(visit.visit_date)]));
  const invoiceById = new Map(invoices.map(invoice => [invoice.id, invoice]));
  return ((lines.data ?? []) as unknown as BilledRow[]).flatMap(line => {
    const invoice = invoiceById.get(line.invoice_id);
    if (!invoice) return [];
    return [
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        visitId: invoice.visit_id,
        code: line.code,
        serviceDate: toDateKey(line.service_date ?? null) ?? (invoice.visit_id ? visitDate.get(invoice.visit_id) ?? null : null) ?? toDateKey(invoice.issue_date),
        teeth: line.tooth_number ? parseToothList(line.tooth_number) : [],
        status: invoice.payment_status
      }
    ];
  });
}
