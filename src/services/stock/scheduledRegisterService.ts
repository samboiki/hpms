/**
 * What the register of all scheduled medicines reads for a period: every ledger movement of the scheduled items up to
 * the period's end (the balance brought forward needs the earlier ones), their dispensing records with the first
 * scripts their repeats name, the visit each billed issue belongs to and that visit's branch, and the people's names.
 * The register itself is built by src/utils/stock/scheduledRegister.ts (tested); this file only reads.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { DISPENSING_COLUMNS, normalizeDispensing, type DispensingRow, type StockMovement } from '../../utils/stock/stockRows';
import type { DispensingRecord } from '../../utils/stock/repeats';
import { isStockNotSetUpError, loadDeliveriesByIds, loadMovements, loadPatientNames, StockNotSetUpError } from './stockService';

const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;
const ID_CHUNK = 200;
const chunks = <T,>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / ID_CHUNK) }, (_, index) => items.slice(index * ID_CHUNK, (index + 1) * ID_CHUNK));

async function rowsWhereIn(table: string, columns: string, column: string, ids: readonly string[], fallback: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (const part of chunks([...new Set(ids)].filter(Boolean))) {
    const { data, error } = await db.from(table).select(columns).in(column, part);
    if (error) {
      if (isStockNotSetUpError(error)) throw new StockNotSetUpError();
      throw new Error(error.message || fallback);
    }
    rows.push(...((data ?? []) as unknown as Row[]));
  }
  return rows;
}

export interface ScheduledRegisterData {
  movements: StockMovement[];
  dispensings: DispensingRecord[];
  invoiceVisits: Map<string, string>;
  visitBranches: Map<string, string>;
  patients: Map<string, string>;
  /** Delivery id -> its supplier id (names come from the Stock page's supplier list) */
  deliverySupplierIds: Map<string, string>;
}

/** Everything the register needs for the scheduled items, from the start up to `to` (both days of the period included) */
export async function loadScheduledRegister(practiceId: string, itemIds: readonly string[], from: string, to: string): Promise<ScheduledRegisterData> {
  if (itemIds.length === 0) {
    return { movements: [], dispensings: [], invoiceVisits: new Map(), visitBranches: new Map(), patients: new Map(), deliverySupplierIds: new Map() };
  }
  const movements = await loadMovements(practiceId, { to, itemIds: [...itemIds] });
  const inPeriod = movements.filter(movement => movement.occurredOn >= from);

  // The period's dispensing records of these items (billed ones move stock through their invoice line), and the
  // first scripts their repeats name
  const dispensingRows: Row[] = [];
  for (const part of chunks([...itemIds])) {
    const { data, error } = await db.from('stock_dispensings').select(DISPENSING_COLUMNS).eq('practice_id', practiceId).in('item_id', part)
      .gte('dispensed_on', from).lte('dispensed_on', to).limit(5000);
    if (error) {
      if (isStockNotSetUpError(error)) throw new StockNotSetUpError();
      throw new Error(error.message || 'Could not read the medicines dispensed');
    }
    dispensingRows.push(...((data ?? []) as unknown as Row[]));
  }
  const byMovement = inPeriod.flatMap(movement => (movement.dispensingId ? [movement.dispensingId] : []));
  const known = new Set(dispensingRows.map(row => String(row.id)));
  const missing = byMovement.filter(id => !known.has(id));
  const extra = missing.length > 0 ? await rowsWhereIn('stock_dispensings', DISPENSING_COLUMNS, 'id', missing, 'Could not read the medicines dispensed') : [];
  const dispensings = [...dispensingRows, ...extra].map(row => normalizeDispensing(row as unknown as DispensingRow));
  const firsts = dispensings.flatMap(record => (record.repeatOf && !dispensings.some(other => other.id === record.repeatOf) ? [record.repeatOf] : []));
  if (firsts.length > 0) {
    const firstRows = await rowsWhereIn('stock_dispensings', DISPENSING_COLUMNS, 'id', firsts, 'Could not read the first scripts');
    dispensings.push(...firstRows.map(row => normalizeDispensing(row as unknown as DispensingRow)));
  }

  // Where it was dispensed: the visit's branch (a billed issue's visit is its invoice's)
  const invoiceRows = await rowsWhereIn('invoices_enhanced', 'id, visit_id', 'id',
    inPeriod.flatMap(movement => (movement.invoiceId ? [movement.invoiceId] : [])), 'Could not read the invoices');
  const invoiceVisits = new Map(invoiceRows.flatMap(row => (typeof row.visit_id === 'string' ? [[String(row.id), row.visit_id] as const] : [])));
  const visitIds = [...invoiceVisits.values(), ...dispensings.flatMap(record => (record.visitId ? [record.visitId] : []))];
  const visitRows = await rowsWhereIn('visits', 'id, branch_id', 'id', visitIds, 'Could not read the visits');
  const branchIds = visitRows.flatMap(row => (typeof row.branch_id === 'string' ? [row.branch_id] : []));
  const branchRows = await rowsWhereIn('branches', 'id, name', 'id', branchIds, 'Could not read the branches');
  const branchNames = new Map(branchRows.map(row => [String(row.id), String(row.name ?? '').trim()] as const));
  const visitBranches = new Map(visitRows.flatMap(row => {
    const name = typeof row.branch_id === 'string' ? branchNames.get(row.branch_id) : undefined;
    return name ? [[String(row.id), name] as const] : [];
  }));

  const [patients, deliveries] = await Promise.all([
    loadPatientNames(inPeriod.flatMap(movement => (movement.patientId ? [movement.patientId] : []))),
    loadDeliveriesByIds(inPeriod.flatMap(movement => (movement.deliveryId ? [movement.deliveryId] : [])))
  ]);
  return {
    movements,
    dispensings,
    invoiceVisits,
    visitBranches,
    patients,
    deliverySupplierIds: new Map(deliveries.map(delivery => [delivery.id, delivery.supplierId] as const))
  };
}
