/**
 * Reads and writes for the creditors ledger (L12, R24; proposals/2026-10-13-stock-stores-and-suppliers.sql): the
 * deliveries (supplier invoices, consignment invoices and credits), their payables' statuses, payments to suppliers and what each paid. The
 * rules are in src/utils/stock/supplierLedger.ts. Before that file is applied every call throws
 * SupplierLedgerNotSetUpError and the Suppliers tab says the ledger is not set up yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { isMissingColumnError } from '../../utils/diary/dbErrors';
import {
  LEDGER_DELIVERY_BASE_COLUMNS,
  LEDGER_DELIVERY_COLUMNS,
  SUPPLIER_ALLOCATION_COLUMNS,
  SUPPLIER_PAYMENT_COLUMNS,
  normalizeLedgerDelivery,
  normalizeSupplierAllocation,
  normalizeSupplierPayment,
  type LedgerDeliveryRow,
  type LedgerPayable,
  type PaymentMethod,
  type SupplierAllocationRow,
  type SupplierLedgerData,
  type SupplierPaymentRow
} from '../../utils/stock/supplierLedger';

const db = supabase as unknown as SupabaseClient;

export class SupplierLedgerNotSetUpError extends Error {
  constructor() {
    super('The supplier ledger is not set up yet.');
    this.name = 'SupplierLedgerNotSetUpError';
  }
}

interface DbError {
  code?: string;
  message?: string;
}

const OWN = /stock_supplier_payments|stock_supplier_allocations|on_account|postal_address|stock_pay_supplier|stock_reverse_supplier_payment/i;

export function isSupplierLedgerNotSetUp(error: unknown): boolean {
  if (error instanceof SupplierLedgerNotSetUpError) return true;
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  if (!OWN.test(message ?? '')) return false;
  return ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code ?? '') || /could not find|does not exist/i.test(message ?? '');
}

const fail = (error: DbError, fallback: string): never => {
  if (isSupplierLedgerNotSetUp(error)) throw new SupplierLedgerNotSetUpError();
  throw new Error(error.message || fallback);
};

/**
 * stock_deliveries.consignment is not there yet (before proposals/2026-10-13-consignment-supplier-ledger.sql):
 * deliveries are then read without it, as before, and none of them is a consignment invoice.
 */
export function isConsignmentColumnMissing(error: unknown): boolean {
  if (!isMissingColumnError(error)) return false;
  return /consignment/i.test(String((error as DbError).message ?? ''));
}

async function every<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: DbError | null }>, fallback: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) fail(error, fallback);
    const batch = Array.isArray(data) ? (data as T[]) : [];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

/** The whole ledger of a practice (every supplier): small enough to read at once, and the balances need all of it */
export async function loadSupplierLedger(practiceId: string): Promise<SupplierLedgerData> {
  // Consignment invoices are supplier invoices too; before the column exists every row is read without it
  let deliveryColumns = LEDGER_DELIVERY_COLUMNS;
  const deliveryPage = async (from: number, to: number) => {
    const read = () => db.from('stock_deliveries').select(deliveryColumns).eq('practice_id', practiceId).order('document_date').range(from, to);
    const result = await read();
    if (!result.error || deliveryColumns === LEDGER_DELIVERY_BASE_COLUMNS || !isConsignmentColumnMissing(result.error)) return result;
    deliveryColumns = LEDGER_DELIVERY_BASE_COLUMNS;
    return read();
  };
  const [deliveryRows, paymentRows, allocationRows] = await Promise.all([
    every<LedgerDeliveryRow>(deliveryPage, 'Could not load the supplier invoices'),
    every<SupplierPaymentRow>((from, to) => db.from('stock_supplier_payments').select(SUPPLIER_PAYMENT_COLUMNS).eq('practice_id', practiceId)
      .order('paid_on').range(from, to), 'Could not load the payments to suppliers'),
    every<SupplierAllocationRow>((from, to) => db.from('stock_supplier_allocations').select(SUPPLIER_ALLOCATION_COLUMNS).eq('practice_id', practiceId)
      .range(from, to), 'Could not load what the payments paid')
  ]);
  const deliveries = deliveryRows.map(normalizeLedgerDelivery);
  const payables = new Map<string, LedgerPayable>();
  const expenseIds = [...new Set(deliveries.flatMap(row => (row.expenseId ? [row.expenseId] : [])))];
  for (let start = 0; start < expenseIds.length; start += 200) {
    const { data, error } = await db.from('practice_expenses').select('id, status, paid_date, due_date').in('id', expenseIds.slice(start, start + 200));
    if (error) throw new Error(error.message || 'Could not read the payables');
    for (const row of (data ?? []) as Array<{ id: string; status: string | null; paid_date: string | null; due_date: string | null }>) {
      payables.set(row.id, { status: (row.status ?? 'pending').toLowerCase(), paidDate: row.paid_date?.slice(0, 10) ?? null, dueDate: row.due_date?.slice(0, 10) ?? null });
    }
  }
  return {
    deliveries,
    payables,
    payments: paymentRows.map(normalizeSupplierPayment),
    allocations: allocationRows.map(normalizeSupplierAllocation)
  };
}

export interface PayResult {
  id: string | null;
  number: string | null;
  allocated: number;
  credits_used: number;
  on_account: number;
}

export async function paySupplier(payload: {
  practice_id: string;
  supplier_id: string;
  paid_on: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  invoice_ids: string[];
  use_credits: boolean;
}): Promise<PayResult> {
  const { data, error } = await db.rpc('stock_pay_supplier', { p_payload: payload });
  if (error) fail(error, 'Could not record the payment');
  return data as PayResult;
}

export async function reverseSupplierPayment(paymentId: string, reason: string): Promise<{ number: string }> {
  const { data, error } = await db.rpc('stock_reverse_supplier_payment', { p_payment_id: paymentId, p_reason: reason });
  if (error) fail(error, 'Could not reverse the payment');
  return data as { number: string };
}

/**
 * A supplier's postal address as kept now (null: none). Throws SupplierLedgerNotSetUpError before the database update
 * (no column yet). The supplier form sends the address back with every save, so it only shows the field once this read.
 */
export async function loadSupplierAddress(supplierId: string): Promise<string | null> {
  const { data, error } = await db.from('stock_suppliers').select('postal_address').eq('id', supplierId).maybeSingle();
  if (error) fail(error, 'Could not read the supplier\'s address');
  return (data as { postal_address: string | null } | null)?.postal_address ?? null;
}
