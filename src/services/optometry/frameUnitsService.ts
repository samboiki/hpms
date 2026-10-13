/**
 * Reads and writes for frame barcodes, consignment frames and job costs (proposals/2026-10-13-optometry-frames-and-exam.sql).
 * The rules live in src/utils/optometry (frameUnits.ts, consignment.ts, jobCosting.ts; tested); this file only talks
 * to the database.
 *
 * - Until the file is applied its tables and functions do not exist: the loads say 'not_set_up' and the screens say
 *   frame barcodes are not set up yet (the frames and the eye records keep working).
 * - Every write goes through an optometry_ function that checks the signed-in user is staff of the practice and, for
 *   writing a frame off or changing who sold it, a practice admin or practitioner (the stock module's rule).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { isMissingColumnError, isMissingFunctionError, isMissingTableError } from '../../utils/diary/dbErrors';
import { toCents } from '../../utils/billing/money';
import { CONSIGNMENT_LINE_COLUMNS, toConsignmentLine, type ConsignmentFrame, type ConsignmentLine } from '../../utils/optometry/consignment';
import { FRAME_EVENT_COLUMNS, FRAME_UNIT_COLUMNS, toFrameUnit, toFrameUnitEvent, type FrameUnit, type FrameUnitEvent, type UnitAction } from '../../utils/optometry/frameUnits';

// The generated database types do not know these tables and functions yet
const db = supabase as unknown as SupabaseClient;

const OWN_TABLES = ['optometry_frame_units', 'optometry_frame_unit_events', 'optometry_consignment_lines'] as const;
const OWN_FUNCTIONS = [
  'optometry_frames_receive',
  'optometry_frame_units_add',
  'optometry_frame_unit_act',
  'optometry_frame_units_return',
  'optometry_consignment_settle',
  'optometry_lab_order_costs'
] as const;
/** Columns this file added to tables that existed before it */
const OWN_COLUMNS = /\b(consignment|consignment_supplier_id|consignment_cost|lens_cost|labour_cost|lab_invoice_ref)\b/;

export class FrameUnitsNotSetUpError extends Error {
  constructor() {
    super('Frame barcodes are not set up yet.');
    this.name = 'FrameUnitsNotSetUpError';
  }
}

interface DbError {
  code?: string;
  message?: string;
}

/** True when this file's tables, functions or columns are not in the database yet (another missing object is a real error) */
export function isFrameUnitsNotSetUp(error: unknown): boolean {
  if (error instanceof FrameUnitsNotSetUpError) return true;
  if (OWN_TABLES.some(table => isMissingTableError(error, table)) || OWN_FUNCTIONS.some(name => isMissingFunctionError(error, name))) return true;
  const message = error && typeof error === 'object' ? String((error as DbError).message ?? '') : '';
  return isMissingColumnError(error) && OWN_COLUMNS.test(message);
}

const fail = (error: DbError, fallback: string): never => {
  if (isFrameUnitsNotSetUp(error)) throw new FrameUnitsNotSetUpError();
  throw new Error(error.message || fallback);
};

async function rpc<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) fail(error, fallback);
  return data as T;
}

type Row = Record<string, unknown>;
const PAGE = 1000;
const ID_CHUNK = 200;

/** Every row of a query, a page at a time (the API returns at most 1000 at once) */
async function fetchAll(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: DbError | null }>, fallback: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) fail(error, fallback);
    const pageRows = Array.isArray(data) ? (data as Row[]) : [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE) return rows;
  }
}

const chunks = <T,>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / ID_CHUNK) }, (_, index) => items.slice(index * ID_CHUNK, (index + 1) * ID_CHUNK));

export type Loaded<T> = { status: 'ready'; data: T } | { status: 'not_set_up' };

async function loaded<T>(load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { status: 'ready', data: await load() };
  } catch (error) {
    if (isFrameUnitsNotSetUp(error)) return { status: 'not_set_up' };
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------
// Frames by barcode
// ---------------------------------------------------------------------------------------------------

/** Every barcode of the practice (any status) */
export const loadFrameUnits = (practiceId: string): Promise<Loaded<FrameUnit[]>> =>
  loaded(async () => {
    const rows = await fetchAll((from, to) => db.from('optometry_frame_units').select(FRAME_UNIT_COLUMNS).eq('practice_id', practiceId)
      .order('created_at').range(from, to), 'Could not read the frame barcodes');
    return rows.map(toFrameUnit);
  });

/** One frame's history, oldest first */
export async function loadFrameUnitEvents(unitId: string): Promise<FrameUnitEvent[]> {
  const { data, error } = await db.from('optometry_frame_unit_events').select(FRAME_EVENT_COLUMNS).eq('unit_id', unitId).order('changed_at');
  if (error) fail(error, 'Could not read the frame\'s history');
  return ((data ?? []) as unknown as Row[]).map(toFrameUnitEvent);
}

export interface NewUnit {
  id: string;
  itemId: string;
  barcode: string;
}

const toNewUnits = (value: unknown): NewUnit[] =>
  (Array.isArray(value) ? (value as Row[]) : []).map(row => ({ id: String(row.id), itemId: String(row.item_id), barcode: String(row.barcode) }));

/** optometry_frames_receive: a delivery of frames with their barcodes. Returns the delivery and the new frames. */
export async function receiveFrames(payload: Record<string, unknown>): Promise<{ deliveryId: string; number: string; units: NewUnit[]; expenseId: string | null }> {
  const result = await rpc<Row>('optometry_frames_receive', { p_payload: payload }, 'Could not record the delivery');
  return { deliveryId: String(result.id), number: String(result.number ?? ''), units: toNewUnits(result.units), expenseId: typeof result.expense_id === 'string' ? result.expense_id : null };
}

/** optometry_frame_units_add: barcodes for frames already on the shelf (the scanned ones, or the practice's next numbers) */
export async function addFrameUnits(itemId: string, count: number | null, barcodes: string[]): Promise<NewUnit[]> {
  const result = await rpc<unknown>('optometry_frame_units_add', { p_item_id: itemId, p_count: count, p_barcodes: barcodes }, 'Could not add the barcodes');
  return toNewUnits(result);
}

export const actOnFrameUnit = (unitId: string, action: Exclude<UnitAction, 'return'>, payload: Record<string, unknown> = {}): Promise<unknown> =>
  rpc('optometry_frame_unit_act', { p_unit_id: unitId, p_action: action, p_payload: payload }, 'Could not change the frame');

/** optometry_frame_units_return: the frames go back to the supplier on one return note */
export async function returnFrameUnits(payload: Record<string, unknown>): Promise<{ deliveryId: string; number: string }> {
  const result = await rpc<Row>('optometry_frame_units_return', { p_payload: payload }, 'Could not record the return');
  return { deliveryId: String(result.id), number: String(result.number ?? '') };
}

// ---------------------------------------------------------------------------------------------------
// Consignment
// ---------------------------------------------------------------------------------------------------

/** The practice's consignment frames: the supplier who owns each and what is owed per frame sold */
export const loadConsignmentFrames = (practiceId: string): Promise<Loaded<ConsignmentFrame[]>> =>
  loaded(async () => {
    const { data, error } = await db.from('optometry_frames').select('item_id, consignment, consignment_supplier_id, consignment_cost')
      .eq('practice_id', practiceId).eq('consignment', true);
    if (error) fail(error, 'Could not read the consignment frames');
    return ((data ?? []) as Row[]).map(row => ({
      itemId: String(row.item_id),
      supplierId: typeof row.consignment_supplier_id === 'string' ? row.consignment_supplier_id : null,
      costCents: toCents(Number(row.consignment_cost ?? 0) || 0)
    }));
  });

/** What is owed (or was settled) for consignment frames sold, lost or taken back */
export const loadConsignmentLines = (practiceId: string, filter: { invoiceIds?: string[] } = {}): Promise<Loaded<ConsignmentLine[]>> =>
  loaded(async () => {
    if (filter.invoiceIds) {
      const rows: Row[] = [];
      for (const ids of chunks([...new Set(filter.invoiceIds)])) {
        const { data, error } = await db.from('optometry_consignment_lines').select(CONSIGNMENT_LINE_COLUMNS).in('invoice_id', ids);
        if (error) fail(error, 'Could not read what is owed for consignment frames');
        rows.push(...((data ?? []) as unknown as Row[]));
      }
      return rows.map(toConsignmentLine);
    }
    const rows = await fetchAll((from, to) => db.from('optometry_consignment_lines').select(CONSIGNMENT_LINE_COLUMNS).eq('practice_id', practiceId)
      .order('happened_on').range(from, to), 'Could not read what is owed for consignment frames');
    return rows.map(toConsignmentLine);
  });

/**
 * optometry_consignment_settle: the supplier's invoice becomes its payable (Finance > Ledgers > Expenses) and, since
 * proposals/2026-10-13-consignment-supplier-ledger.sql, a CSG invoice on the supplier's account (deliveryId, number;
 * null before that file)
 */
export async function settleConsignment(payload: Record<string, unknown>): Promise<{ expenseId: string; totalCents: number; deliveryId: string | null; number: string | null }> {
  const result = await rpc<Row>('optometry_consignment_settle', { p_payload: payload }, 'Could not record the supplier\'s invoice');
  return {
    expenseId: String(result.expense_id),
    totalCents: toCents(Number(result.total_incl_vat ?? 0) || 0),
    deliveryId: typeof result.id === 'string' ? result.id : null,
    number: typeof result.number === 'string' ? result.number : null
  };
}

/** Whether the payables made for settled consignment lines are paid (practice_expenses.status) */
export async function loadPayableStatuses(expenseIds: string[]): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  for (const ids of chunks([...new Set(expenseIds)].filter(Boolean))) {
    const { data, error } = await db.from('practice_expenses').select('id, status').in('id', ids);
    if (error) throw new Error(error.message || 'Could not read the payables');
    for (const row of (data ?? []) as Array<{ id: string; status: string | null }>) statuses.set(row.id, (row.status ?? 'pending').toLowerCase());
  }
  return statuses;
}

// ---------------------------------------------------------------------------------------------------
// Job costs on lab orders
// ---------------------------------------------------------------------------------------------------

/** optometry_lab_order_costs: what the lab charged for the lenses, the labour and the lab's invoice number */
export const saveJobCosts = (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
  rpc('optometry_lab_order_costs', { p_order_id: orderId, p_payload: payload }, 'Could not save the costs');
