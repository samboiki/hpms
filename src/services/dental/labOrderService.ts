/**
 * Reads and writes for dental lab work (proposals/2026-10-13-dental-lab-work.sql): a patient's lab orders with their
 * steps and the lab's invoice lines, the practice's open orders by lab, the orders billed at visits (for the claim's
 * 8099 lines), and the writes. The rules live in src/utils/dental/labOrders.ts and labSlips.ts (tested); this file only
 * talks to the database.
 *
 * - Until the proposal is applied the tables and functions do not exist: the loads say 'not_set_up' and the screens
 *   say lab work is not set up yet; claim review then leaves 8099 lines unchecked.
 * - Every write goes through a dental_lab_ database function that checks the signed-in user is staff of the patient's
 *   practice, that it is a dental practice, and (to order or change an order) a practitioner, nurse or practice admin.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { isMissingFunctionError, isMissingTableError } from '../../utils/diary/dbErrors';
import {
  EVENT_COLUMNS,
  ORDER_COLUMNS,
  SLIP_LINE_COLUMNS,
  toDentalLabEvent,
  toDentalLabOrder,
  toSlipLine,
  type DentalLabEvent,
  type DentalLabOrder
} from '../../utils/dental/labOrderRecords';
import type { DentalLabStatus } from '../../utils/dental/labOrders';
import type { BilledLabOrder, LabSlipLine } from '../../utils/dental/labSlips';

// The generated database types do not know the lab tables and functions yet
const db = supabase as unknown as SupabaseClient;

export const DENTAL_LAB_TABLES = ['dental_lab_orders', 'dental_lab_order_events', 'dental_lab_slip_lines'] as const;
export const DENTAL_LAB_FUNCTIONS = ['dental_lab_order_save', 'dental_lab_order_set_status', 'dental_lab_slip_save', 'dental_lab_order_bill'] as const;

export class DentalLabNotSetUpError extends Error {
  constructor() {
    super('Lab work is not set up yet.');
    this.name = 'DentalLabNotSetUpError';
  }
}

/** True when the lab tables or functions are not in the database yet (only ours: another missing object is a real error). */
export function isDentalLabNotSetUp(error: unknown): boolean {
  return (
    error instanceof DentalLabNotSetUpError ||
    DENTAL_LAB_TABLES.some(table => isMissingTableError(error, table)) ||
    DENTAL_LAB_FUNCTIONS.some(name => isMissingFunctionError(error, name))
  );
}

interface DbError {
  code?: string;
  message?: string;
}

/** The database's own message (its functions say in plain words why something was refused). */
const fail = (error: DbError, fallback: string): never => {
  if (isDentalLabNotSetUp(error)) throw new DentalLabNotSetUpError();
  throw new Error(error.message || fallback);
};

async function rpc<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) fail(error, fallback);
  return data as T;
}

type Row = Record<string, unknown>;

const ID_CHUNK = 200;
const chunks = <T,>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / ID_CHUNK) }, (_, index) => items.slice(index * ID_CHUNK, (index + 1) * ID_CHUNK));

/** The steps and the lab's invoice lines of these orders. */
async function loadOrderDetails(orderIds: readonly string[]): Promise<{ events: Map<string, DentalLabEvent[]>; lines: Map<string, Array<LabSlipLine & { lineNo: number }>> }> {
  const events = new Map<string, DentalLabEvent[]>();
  const lines = new Map<string, Array<LabSlipLine & { lineNo: number }>>();
  for (const ids of chunks(orderIds)) {
    const [eventRows, lineRows] = await Promise.all([
      db.from('dental_lab_order_events').select(EVENT_COLUMNS).in('order_id', ids),
      db.from('dental_lab_slip_lines').select(SLIP_LINE_COLUMNS).in('order_id', ids)
    ]);
    if (eventRows.error) fail(eventRows.error, 'Could not read the lab orders\' steps');
    if (lineRows.error) fail(lineRows.error, 'Could not read the lab\'s invoice lines');
    for (const row of (eventRows.data ?? []) as unknown as Row[]) {
      const id = String(row.order_id);
      events.set(id, [...(events.get(id) ?? []), toDentalLabEvent(row)]);
    }
    for (const row of (lineRows.data ?? []) as unknown as Row[]) {
      const id = String(row.order_id);
      lines.set(id, [...(lines.get(id) ?? []), toSlipLine(row)]);
    }
  }
  return { events, lines };
}

const withDetails = async (rows: readonly Row[]): Promise<DentalLabOrder[]> => {
  const details = await loadOrderDetails(rows.map(row => String(row.id)));
  return rows.map(row => toDentalLabOrder(row, details.events.get(String(row.id)) ?? [], details.lines.get(String(row.id)) ?? []));
};

export type LabOrdersLoad = { status: 'ready'; orders: DentalLabOrder[] } | { status: 'not_set_up' };

/** Every lab order of a patient, newest first; 'not_set_up' before the proposal is applied. */
export async function loadPatientLabOrders(patientId: string): Promise<LabOrdersLoad> {
  try {
    const { data, error } = await db.from('dental_lab_orders').select(ORDER_COLUMNS).eq('patient_id', patientId).order('order_no', { ascending: false });
    if (error) fail(error, 'Could not read the lab orders');
    return { status: 'ready', orders: await withDetails((data ?? []) as unknown as Row[]) };
  } catch (error) {
    if (isDentalLabNotSetUp(error)) return { status: 'not_set_up' };
    throw error;
  }
}

export interface PracticeLabOrder extends DentalLabOrder {
  patientName: string;
  patientDateOfBirth: string | null;
}

export type PracticeLabOrdersLoad = { status: 'ready'; orders: PracticeLabOrder[] } | { status: 'not_set_up' };

/** The practice's open lab orders (at the lab, being remade, or back and waiting to be fitted) with the patients' names. */
export async function loadPracticeOpenLabOrders(practiceId: string): Promise<PracticeLabOrdersLoad> {
  try {
    const { data, error } = await db
      .from('dental_lab_orders')
      .select(ORDER_COLUMNS)
      .eq('practice_id', practiceId)
      .in('status', ['sent', 'received', 'remake'])
      .order('sent_on', { ascending: true })
      .limit(1000);
    if (error) fail(error, 'Could not read the lab orders');
    const rows = (data ?? []) as unknown as Row[];
    const [orders, people] = await Promise.all([withDetails(rows), loadPatients(rows.map(row => String(row.patient_id)))]);
    return {
      status: 'ready',
      orders: orders.map(order => ({
        ...order,
        patientName: people.get(order.patientId)?.name ?? 'Patient',
        patientDateOfBirth: people.get(order.patientId)?.dateOfBirth ?? null
      }))
    };
  } catch (error) {
    if (isDentalLabNotSetUp(error)) return { status: 'not_set_up' };
    throw error;
  }
}

async function loadPatients(patientIds: readonly string[]): Promise<Map<string, { name: string; dateOfBirth: string | null }>> {
  const people = new Map<string, { name: string; dateOfBirth: string | null }>();
  for (const ids of chunks([...new Set(patientIds)])) {
    const { data, error } = await supabase.from('patients').select('id, first_name, last_name, date_of_birth').in('id', ids);
    if (error) throw new Error(`Could not read the patients: ${error.message}`);
    for (const row of data ?? []) {
      people.set(row.id, { name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Patient', dateOfBirth: row.date_of_birth ?? null });
    }
  }
  return people;
}

export type BilledLabOrdersLoad = { status: 'ready'; orders: BilledLabOrder[] } | { status: 'not_set_up' };

/** The orders billed at these visits (not cancelled), with the lab's invoice lines: what the claim's 8099 lines carry. */
export async function loadBilledLabOrders(visitIds: readonly string[]): Promise<BilledLabOrdersLoad> {
  try {
    const rows: Row[] = [];
    for (const ids of chunks([...new Set(visitIds)].filter(Boolean))) {
      const { data, error } = await db
        .from('dental_lab_orders')
        .select('id, order_no, billed_visit_id, slip_number, status, supplier:stock_suppliers!dental_lab_orders_supplier_id_fkey(name)')
        .in('billed_visit_id', ids)
        .neq('status', 'cancelled');
      if (error) fail(error, 'Could not read the lab orders');
      rows.push(...((data ?? []) as unknown as Row[]));
    }
    const { lines } = await loadOrderDetails(rows.map(row => String(row.id)));
    return {
      status: 'ready',
      orders: rows.map(row => {
        const order = toDentalLabOrder(row, [], lines.get(String(row.id)) ?? []);
        return { id: order.id, orderNo: order.orderNo, billedVisitId: String(row.billed_visit_id), slipNumber: order.slipNumber, labName: order.labName, lines: order.slipLines };
      })
    };
  } catch (error) {
    if (isDentalLabNotSetUp(error)) return { status: 'not_set_up' };
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------------

/** dental_lab_order_save: a new order or a change while it is at the lab. */
export const saveDentalLabOrder = (payload: Record<string, unknown>): Promise<{ id: string; order_no: number; created: boolean }> =>
  rpc('dental_lab_order_save', { p_payload: payload }, 'Could not save the lab order');

/** dental_lab_order_set_status: the next step (a remake or a cancellation with why; a remake with the lab's new date). */
export const setDentalLabStatus = (
  orderId: string,
  status: DentalLabStatus,
  options: { reason?: string | null; on?: string | null; dueOn?: string | null } = {}
): Promise<unknown> =>
  rpc(
    'dental_lab_order_set_status',
    { p_order_id: orderId, p_status: status, p_reason: options.reason?.trim() || null, p_on: options.on || null, p_due_on: options.dueOn || null },
    'Could not change the order'
  );

/** dental_lab_slip_save: the lab's invoice number and lines, replacing what was there. */
export const saveLabSlip = (orderId: string, payload: Record<string, unknown>): Promise<{ lines: number; total: number }> =>
  rpc('dental_lab_slip_save', { p_order_id: orderId, p_payload: payload }, 'Could not save the lab\'s invoice');

/** dental_lab_order_bill: the visit whose 8099 line bills the order; null: billed nowhere. */
export const billLabOrder = (orderId: string, visitId: string | null): Promise<unknown> =>
  rpc('dental_lab_order_bill', { p_order_id: orderId, p_visit_id: visitId }, 'Could not change where the order is billed');
