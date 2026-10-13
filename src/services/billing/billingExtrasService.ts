/**
 * Reads and writes for payment plans, prepaid packages and promotions (parity D16, D17, D18). The rules live in
 * src/utils/billing (paymentPlans.ts, packages.ts, promotions.ts; tested); every write goes through a billing_ function
 * that checks the practice and the person's role (proposals/2026-10-13-billing-extras.sql). Before that file is applied
 * every load says 'not_set_up' and the screens say these are not set up yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { toCents } from '../../utils/billing/money';
import { normalizePackageType, normalizePatientPackage, type PackageType, type PackageTypePayload, type PatientPackage, type PatientPackageRow, type PackageTypeRow } from '../../utils/billing/packages';
import { normalizePlan, type PaymentPlan, type PlanPayload, type PlanRow } from '../../utils/billing/paymentPlans';
import { normalizePromotion, type Promotion, type PromotionPayload, type PromotionRow } from '../../utils/billing/promotions';

// The generated database types do not know these tables and functions
const db = supabase as unknown as SupabaseClient;

export type ExtrasLoad<T> = { status: 'ready'; data: T } | { status: 'not_set_up' } | { status: 'error'; message: string };

interface DbError {
  code?: string;
  message?: string;
}

const OWN_OBJECTS = /\b(billing_[a-z_]+|payment_plan[a-z_]*|patient_packages|promotion_id|package_id)\b/i;

/** True when this file's tables, columns or functions are not in the database yet (any other error is a real one) */
export function isExtrasNotSetUp(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!OWN_OBJECTS.test(message ?? '')) return false;
  return ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code ?? '') || /could not find the|does not exist|schema cache/i.test(message ?? '');
}

const messageOf = (error: unknown, fallback: string): string => {
  const text = error && typeof error === 'object' ? (error as DbError).message : null;
  return text?.trim() ? text.trim() : fallback;
};

async function load<T>(run: () => PromiseLike<{ data: unknown; error: DbError | null }>, shape: (data: unknown) => T, fallback: string): Promise<ExtrasLoad<T>> {
  try {
    const { data, error } = await run();
    if (error) return isExtrasNotSetUp(error) ? { status: 'not_set_up' } : { status: 'error', message: messageOf(error, fallback) };
    return { status: 'ready', data: shape(data) };
  } catch (error) {
    return isExtrasNotSetUp(error) ? { status: 'not_set_up' } : { status: 'error', message: messageOf(error, fallback) };
  }
}

/** A write: the database's own words when it refuses (they are written for staff), a plain sentence otherwise */
async function rpc<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) {
    if (isExtrasNotSetUp(error)) throw new Error('Payment plans, packages and promotions are not set up in this database yet.');
    throw new Error(messageOf(error, fallback));
  }
  return data as T;
}

// ---------------------------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------------------------

const PROMOTION_COLUMNS = 'id, name, kind, value, codes, starts_on, ends_on, ended_at';

export const loadPromotions = (practiceId: string): Promise<ExtrasLoad<Promotion[]>> =>
  load(
    () => db.from('billing_promotions').select(PROMOTION_COLUMNS).eq('practice_id', practiceId).order('starts_on', { ascending: false }).limit(500),
    data => ((data ?? []) as PromotionRow[]).map(normalizePromotion).filter((row): row is Promotion => row !== null),
    'The promotions could not be loaded'
  );

export const savePromotion = (payload: PromotionPayload): Promise<{ id: string }> =>
  rpc('billing_save_promotion', { p_payload: payload }, 'The promotion could not be saved');

export const endPromotion = (promotionId: string): Promise<void> =>
  rpc('billing_end_promotion', { p_promotion_id: promotionId }, 'The promotion could not be ended');

/** Names of promotions by id, for Discounts given (the practice's own; ids from its invoice lines) */
export async function loadPromotionNames(practiceId: string, ids: readonly string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data, error } = await db.from('billing_promotions').select('id, name').eq('practice_id', practiceId).in('id', [...ids]);
  if (error) return {};
  return Object.fromEntries(((data ?? []) as Array<{ id: string; name: string }>).map(row => [row.id, row.name]));
}

// ---------------------------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------------------------

const PACKAGE_TYPE_COLUMNS = 'id, name, codes, sessions, price, valid_months, is_active';

export const loadPackageTypes = (practiceId: string): Promise<ExtrasLoad<PackageType[]>> =>
  load(
    () => db.from('billing_package_types').select(PACKAGE_TYPE_COLUMNS).eq('practice_id', practiceId).order('name').limit(500),
    data => ((data ?? []) as PackageTypeRow[]).map(normalizePackageType),
    'The packages could not be loaded'
  );

export const savePackageType = (payload: PackageTypePayload): Promise<{ id: string }> =>
  rpc('billing_save_package_type', { p_payload: payload }, 'The package could not be saved');

/** A patient's packages with the sessions used; `excludeInvoiceId`: the visit being billed (its lines are on the screen) */
export const loadPatientPackages = (patientId: string, excludeInvoiceId: string | null = null): Promise<ExtrasLoad<PatientPackage[]>> =>
  load(
    () => db.rpc('billing_patient_packages', { p_patient_id: patientId, p_exclude_invoice_id: excludeInvoiceId }),
    data => ((data ?? []) as PatientPackageRow[]).map(normalizePatientPackage),
    "The patient's packages could not be loaded"
  );

export interface SoldPackage {
  packageId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  expiresOn: string;
}

export async function sellPackage(patientId: string, packageTypeId: string, practitionerId: string | null): Promise<SoldPackage> {
  const result = await rpc<{ package_id: string; invoice_id: string; invoice_number: string | null; expires_on: string }>(
    'billing_sell_package',
    { p_patient_id: patientId, p_package_type_id: packageTypeId, p_practitioner_id: practitionerId },
    'The package could not be sold'
  );
  return { packageId: result.package_id, invoiceId: result.invoice_id, invoiceNumber: result.invoice_number, expiresOn: result.expires_on };
}

export const cancelPackage = (packageId: string, reason: string): Promise<void> =>
  rpc('billing_cancel_package', { p_package_id: packageId, p_reason: reason }, 'The package could not be cancelled');

// ---------------------------------------------------------------------------------------------
// Payment plans
// ---------------------------------------------------------------------------------------------

const PLAN_COLUMNS =
  'id, patient_id, title, total, practitioner_id, notes, created_at, stopped_at, stop_reason, ' +
  'payment_plan_instalments (id, number, due_on, amount, invoice_id, posted_on)';

export interface PatientPlans {
  plans: PaymentPlan[];
  /** invoice id -> its number, for the posted instalments */
  invoiceNumbers: Record<string, string>;
}

export async function loadPatientPlans(patientId: string): Promise<ExtrasLoad<PatientPlans>> {
  const plans = await load(
    () => db.from('payment_plans').select(PLAN_COLUMNS).eq('patient_id', patientId).order('created_at', { ascending: false }).limit(100),
    data => ((data ?? []) as PlanRow[]).map(normalizePlan),
    "The patient's payment plans could not be loaded"
  );
  if (plans.status !== 'ready') return plans;
  const invoiceIds = [...new Set(plans.data.flatMap(plan => plan.instalments.map(item => item.invoiceId)).filter((id): id is string => !!id))];
  let invoiceNumbers: Record<string, string> = {};
  if (invoiceIds.length > 0) {
    const { data } = await db.from('invoices_enhanced').select('id, invoice_number').in('id', invoiceIds);
    invoiceNumbers = Object.fromEntries(((data ?? []) as Array<{ id: string; invoice_number: string | null }>).map(row => [row.id, row.invoice_number ?? '']));
  }
  return { status: 'ready', data: { plans: plans.data, invoiceNumbers } };
}

export const savePaymentPlan = (payload: PlanPayload): Promise<{ id: string }> =>
  rpc('billing_save_payment_plan', { p_payload: payload }, 'The payment plan could not be saved');

export const stopPaymentPlan = (planId: string, reason: string): Promise<void> =>
  rpc('billing_stop_payment_plan', { p_plan_id: planId, p_reason: reason }, 'The payment plan could not be stopped');

export interface PostingResult {
  posted: number;
  totalCents: number;
  waiting: number;
}

/** Posts every due instalment of the practice, or of one patient's plans, as invoices (billing_post_due_instalments) */
export async function postDueInstalments(practiceId: string, patientId: string | null): Promise<PostingResult> {
  const result = await rpc<{ posted: number; total: number | string; waiting: number }>(
    'billing_post_due_instalments',
    { p_practice_id: practiceId, p_patient_id: patientId },
    'The due instalments could not be posted'
  );
  return { posted: Number(result?.posted ?? 0), totalCents: toCents(Number(result?.total ?? 0)), waiting: Number(result?.waiting ?? 0) };
}

/** How many instalments of the practice's running plans are due today or earlier and not posted yet */
export const countDueInstalments = (practiceId: string, todayKey: string): Promise<ExtrasLoad<number>> =>
  load(
    () => db
      .from('payment_plan_instalments')
      .select('id, payment_plans!inner(stopped_at)', { count: 'exact', head: true })
      .eq('practice_id', practiceId)
      .is('posted_at', null)
      .lte('due_on', todayKey)
      .is('payment_plans.stopped_at', null)
      .then(result => ({ data: result.count ?? 0, error: result.error })),
    data => Number(data ?? 0),
    'The payment plan instalments could not be counted'
  );
