/**
 * Data for Discounts given (parity R3): the discounts given on the practice's invoices in a period (with their
 * percentage), their invoices, private patients' line discounts on invoices dated in the period, and the patients'
 * names. Every read is scoped to the practice (and its policies). Before proposals/2026-10-13-discounts-and-statements.sql
 * the loader says 'not_set_up'.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { normalizeAdjustment, type ArAdjustment, type DateRange, type RawAdjustmentRow } from '../../../services/ledgerService';
import { DISCOUNT_COLUMNS } from '../../../services/discountService';
import { isArNotSetUp } from '../receipts/arService';
import { errorText, fetchByIds, fetchPages, loadPatientNames, timed } from '../debtors/debtorsService';
import { discountFromAdjustment, discountFromLine, type DiscountInvoice, type DiscountItem, type RawLineDiscountRow } from './discountListing';
import { loadPromotionNames } from '../../../services/billing/billingExtrasService';
import type { ReportLoad } from './practiceReportsService';

// The generated database types do not know the discount columns
const db = supabase as unknown as SupabaseClient;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export interface DiscountData {
  items: DiscountItem[];
  patientNames: Record<string, string>;
  /** The names of the promotions the line discounts came from (id -> name) */
  promotionNames: Record<string, string>;
}

const LINE_COLUMNS = 'id, code, discount_amount, practitioner_id, invoice:invoices_enhanced!inner(id, invoice_number, patient_id, practitioner_id, payment_status, practice_id, issue_date)';

/** "Not there yet": the receipts tables, or the discount column of this file */
const notSetUp = (error: unknown): boolean =>
  isArNotSetUp(error) || (!!error && typeof error === 'object' && (error as { code?: string }).code === '42703');

/** Private patients' line discounts on invoices dated in the period */
const loadLineDiscounts = (practiceId: string, range: DateRange, columns: string): Promise<RawLineDiscountRow[]> =>
  timed(fetchPages<RawLineDiscountRow>('the line discounts', (from, to) => db
    .from('invoice_services')
    .select(columns)
    .eq('invoice.practice_id', practiceId)
    .gte('invoice.issue_date', range.startKey)
    .lte('invoice.issue_date', range.endKey)
    .gt('discount_amount', 0)
    .order('id')
    .range(from, to) as unknown as PromiseLike<{ data: RawLineDiscountRow[] | null; error: { code?: string; message?: string } | null }>), 'the line discounts');

export async function loadDiscounts(practiceId: string, range: DateRange): Promise<ReportLoad<DiscountData>> {
  try {
    if (!DATE_KEY.test(range.startKey) || !DATE_KEY.test(range.endKey)) throw new Error('The selected period is not a valid date range');
    const [adjustmentRows, lineRows] = await Promise.all([
      timed(fetchPages<RawAdjustmentRow>('the discounts', (from, to) => db
        .from('invoice_adjustments').select(DISCOUNT_COLUMNS).eq('practice_id', practiceId).eq('kind', 'discount').is('reversed_at', null)
        .gte('effective_on', range.startKey).lte('effective_on', range.endKey).order('id').range(from, to)), 'the discounts'),
      // The client reads the embedded invoice as a list; PostgREST returns the one invoice of a line as an object. With the
      // promotion a discount came from, once proposals/2026-10-13-billing-extras.sql is applied (without it before)
      loadLineDiscounts(practiceId, range, `${LINE_COLUMNS}, promotion_id`)
        .catch((error: unknown) => {
          if ((error as { code?: string } | null)?.code !== '42703') throw error;
          return loadLineDiscounts(practiceId, range, LINE_COLUMNS);
        })
    ]);
    const adjustments = adjustmentRows.map(normalizeAdjustment).filter((row): row is ArAdjustment => row !== null);
    const invoiceIds = [...new Set(adjustments.map(row => row.invoiceId).filter((id): id is string => !!id))];
    const invoiceRows = await timed(fetchByIds<{ id: string; invoice_number: string | null; patient_id: string | null; practitioner_id: string | null }>(invoiceIds, 'invoices', (ids, from, to) => db
      .from('invoices_enhanced').select('id, invoice_number, patient_id, practitioner_id').eq('practice_id', practiceId).in('id', ids).order('id').range(from, to)), 'invoices');
    const invoices = new Map<string, DiscountInvoice>(invoiceRows.map(row => [row.id, {
      id: row.id, invoiceNumber: row.invoice_number?.trim() || row.id.slice(0, 8), patientId: row.patient_id, practitionerId: row.practitioner_id
    }]));
    const promotionIds = [...new Set(lineRows.map(row => row.promotion_id).filter((id): id is string => !!id))];
    const promotionNames = await loadPromotionNames(practiceId, promotionIds).catch(() => ({} as Record<string, string>));
    const items = [
      ...adjustments.map(adjustment => discountFromAdjustment(adjustment, adjustment.invoiceId ? invoices.get(adjustment.invoiceId) : undefined)),
      ...lineRows.map(row => discountFromLine(row, promotionNames))
    ].filter((item): item is DiscountItem => item !== null);
    const patientIds = [...new Set(items.map(item => item.patientId).filter((id): id is string => !!id))];
    const patientNames = await loadPatientNames(practiceId, patientIds).catch(() => ({} as Record<string, string>));
    return { state: 'ready', data: { items, patientNames, promotionNames } };
  } catch (error) {
    if (notSetUp(error)) return { state: 'not_set_up' };
    return { state: 'error', error: errorText(error, 'Could not load the discounts') };
  }
}
