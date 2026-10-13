/**
 * What the optometry reports read: the practice's frames (names, brands, consignment), the frames sold in a period
 * with their invoice lines and barcodes, the jobs (lab orders) with their invoices and costs, and the consignment
 * account per supplier. The sums are worked out by src/utils/optometry (frameReports.ts, jobCosting.ts,
 * consignment.ts; tested); this file only reads.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { CANCELLED_ALIASES } from '../ledger/invoices';
import { loadMovements, loadStockSettings, loadSuppliers } from '../stock/stockService';
import { toCents } from '../../utils/billing/money';
import { toDateKey } from '../../utils/billing/dates';
import { FRAME_GROUP } from '../../utils/optometry/frames';
import { lineAmounts, type ConsignmentFrame, type ConsignmentLine } from '../../utils/optometry/consignment';
import { frameSaleLines, type FrameInfo, type FrameSaleLine, type SoldLineInfo } from '../../utils/optometry/frameReports';
import type { FrameUnit } from '../../utils/optometry/frameUnits';
import type { JobInput } from '../../utils/optometry/jobCosting';
import { LAB_ORDER_STATUSES, type LabOrderStatus } from '../../utils/optometry/labOrders';
import type { Supplier } from '../../utils/stock/stockRows';
import {
  isFrameUnitsNotSetUp,
  loadConsignmentFrames,
  loadConsignmentLines,
  loadFrameUnits,
  loadPayableStatuses,
  type Loaded
} from './frameUnitsService';

const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;
interface DbError {
  code?: string;
  message?: string;
}

const ID_CHUNK = 200;
const chunks = <T,>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / ID_CHUNK) }, (_, index) => items.slice(index * ID_CHUNK, (index + 1) * ID_CHUNK));

const fail = (error: DbError, fallback: string): never => {
  throw Object.assign(new Error(error.message || fallback), { code: error.code });
};

/** Rows of a table by a list of ids, 200 at a time */
async function rowsWhereIn(table: string, columns: string, column: string, ids: readonly string[], fallback: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (const part of chunks([...new Set(ids)].filter(Boolean))) {
    const { data, error } = await db.from(table).select(columns).in(column, part);
    if (error) fail(error, fallback);
    rows.push(...((data ?? []) as unknown as Row[]));
  }
  return rows;
}

const money = (value: unknown): number => toCents(Number(value ?? 0) || 0);
const isCancelled = (status: unknown): boolean => CANCELLED_ALIASES.includes(String(status ?? '').trim().toLowerCase());

// ---------------------------------------------------------------------------------------------------
// The frames
// ---------------------------------------------------------------------------------------------------

export interface FrameCatalogue {
  frames: Map<string, FrameInfo>;
  /** The item's VAT rate, or the practice's default (prices of stock lines include it) */
  vatRates: Map<string, number>;
  defaultVatRate: number;
}

/** Every frame item of the practice (with frame details, or in the Frames group), its name, brand and owner */
export async function loadFrameCatalogue(practiceId: string): Promise<FrameCatalogue> {
  const [items, details, settings] = await Promise.all([
    db.from('practice_inventory').select('id, name, item_group, vat_rate').eq('practice_id', practiceId),
    db.from('optometry_frames').select('item_id, brand, consignment, consignment_supplier_id').eq('practice_id', practiceId),
    loadStockSettings(practiceId).catch(() => null)
  ]);
  if (items.error) fail(items.error, 'Could not read the frames');
  // Before the consignment columns exist the frames are read without them
  let detailRows = (details.data ?? []) as Row[];
  if (details.error) {
    if (!isFrameUnitsNotSetUp(details.error)) fail(details.error, 'Could not read the frames');
    const plain = await db.from('optometry_frames').select('item_id, brand').eq('practice_id', practiceId);
    if (plain.error) fail(plain.error, 'Could not read the frames');
    detailRows = (plain.data ?? []) as Row[];
  }
  const detailById = new Map(detailRows.map(row => [String(row.item_id), row] as const));
  const defaultVatRate = settings?.defaultVatRate ?? 15;
  const frames = new Map<string, FrameInfo>();
  const vatRates = new Map<string, number>();
  for (const item of (items.data ?? []) as Row[]) {
    const id = String(item.id);
    const detail = detailById.get(id);
    if (!detail && item.item_group !== FRAME_GROUP) continue;
    const name = String(item.name ?? 'Frame');
    frames.set(id, {
      name,
      brand: (typeof detail?.brand === 'string' && detail.brand.trim()) || name,
      consignmentSupplierId: detail?.consignment === true && typeof detail.consignment_supplier_id === 'string' ? detail.consignment_supplier_id : null
    });
    vatRates.set(id, item.vat_rate === null || item.vat_rate === undefined ? defaultVatRate : Number(item.vat_rate));
  }
  return { frames, vatRates, defaultVatRate };
}

// ---------------------------------------------------------------------------------------------------
// Frames sold (month to date, salespeople)
// ---------------------------------------------------------------------------------------------------

export interface FrameSalesData {
  lines: FrameSaleLine[];
  units: FrameUnit[];
  catalogue: FrameCatalogue;
  /** False before the barcodes file is applied: sales still show, without barcodes or consignment amounts */
  barcodes: boolean;
}

/** The frames billed in a period (both days included), one row per invoice line still billing them */
export async function loadFrameSales(practiceId: string, from: string, to: string): Promise<FrameSalesData> {
  const catalogue = await loadFrameCatalogue(practiceId);
  const frameIds = [...catalogue.frames.keys()];
  const [movements, unitsLoad] = await Promise.all([
    frameIds.length > 0 ? loadMovements(practiceId, { from, to, itemIds: frameIds }) : Promise.resolve([]),
    loadFrameUnits(practiceId)
  ]);
  const sales = movements.filter(movement => movement.kind === 'sold' || movement.kind === 'sale_reversed');
  const lineIds = [...new Set(sales.flatMap(movement => (movement.invoiceLineId ? [movement.invoiceLineId] : [])))];
  const invoiceIds = [...new Set(sales.flatMap(movement => (movement.invoiceId ? [movement.invoiceId] : [])))];
  const [lineRows, consignment] = await Promise.all([
    rowsWhereIn('invoice_services', 'id, stock_item_id, total_price', 'id', lineIds, 'Could not read the invoice lines'),
    invoiceIds.length > 0 ? loadConsignmentLines(practiceId, { invoiceIds }) : Promise.resolve<Loaded<ConsignmentLine[]>>({ status: 'ready', data: [] })
  ]);
  const lines = new Map<string, SoldLineInfo>(lineRows.map(row => [
    String(row.id),
    { totalCents: money(row.total_price), vatRate: catalogue.vatRates.get(String(row.stock_item_id)) ?? catalogue.defaultVatRate }
  ]));
  const consignmentCost = new Map<string, number>();
  if (consignment.status === 'ready') {
    for (const line of consignment.data) {
      if (!line.invoiceLineId) continue;
      consignmentCost.set(line.invoiceLineId, (consignmentCost.get(line.invoiceLineId) ?? 0) + lineAmounts(line).exclCents);
    }
  }
  const units = unitsLoad.status === 'ready' ? unitsLoad.data : [];
  return {
    lines: frameSaleLines(sales, catalogue.frames, { lines, units, consignmentCost }),
    units,
    catalogue,
    barcodes: unitsLoad.status === 'ready'
  };
}

// ---------------------------------------------------------------------------------------------------
// Job costing
// ---------------------------------------------------------------------------------------------------

export interface JobCostingData {
  jobs: JobInput[];
}

const statusOf = (value: unknown): LabOrderStatus => (LAB_ORDER_STATUSES.includes(value as LabOrderStatus) ? (value as LabOrderStatus) : 'ordered');
const amountOrNull = (value: unknown): number | null => (value === null || value === undefined || value === '' ? null : money(value));

/** Every lab order placed in a period, with its visit's invoice, the frame's cost on it and the costs entered */
export async function loadJobCosting(practiceId: string, from: string, to: string): Promise<Loaded<JobCostingData>> {
  const { data, error } = await db.from('optometry_lab_orders')
    .select('id, order_no, patient_id, visit_id, ordered_on, status, lens_cost, labour_cost, lab_invoice_ref')
    .eq('practice_id', practiceId).gte('ordered_on', from).lte('ordered_on', to).order('ordered_on').limit(2000);
  if (error) {
    if (isFrameUnitsNotSetUp(error)) return { status: 'not_set_up' };
    fail(error, 'Could not read the lab orders');
  }
  const orders = (data ?? []) as Row[];
  const visitIds = orders.flatMap(order => (typeof order.visit_id === 'string' ? [order.visit_id] : []));
  const invoiceRows = (await rowsWhereIn('invoices_enhanced', 'id, visit_id, invoice_number, payment_status, created_at', 'visit_id', visitIds, 'Could not read the invoices'))
    .filter(row => !isCancelled(row.payment_status))
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  // A visit's invoice: the latest one that is not cancelled
  const invoiceByVisit = new Map<string, Row>();
  for (const row of invoiceRows) if (!invoiceByVisit.has(String(row.visit_id))) invoiceByVisit.set(String(row.visit_id), row);
  const invoiceIds = [...invoiceByVisit.values()].map(row => String(row.id));
  const [catalogue, lineRows, movementRows, consignment] = await Promise.all([
    loadFrameCatalogue(practiceId),
    rowsWhereIn('invoice_services', 'id, invoice_id, stock_item_id, total_price', 'invoice_id', invoiceIds, 'Could not read the invoice lines'),
    rowsWhereIn('stock_movements', 'invoice_id, item_id, kind, value', 'invoice_id', invoiceIds, 'Could not read the stock sold'),
    invoiceIds.length > 0 ? loadConsignmentLines(practiceId, { invoiceIds }) : Promise.resolve<Loaded<ConsignmentLine[]>>({ status: 'ready', data: [] })
  ]);
  const linesByInvoice = new Map<string, Row[]>();
  for (const line of lineRows) linesByInvoice.set(String(line.invoice_id), [...(linesByInvoice.get(String(line.invoice_id)) ?? []), line]);
  // The frames' cost on each invoice: what the ledger took off stock (net of lines taken back), plus what is owed
  // to the supplier for a consignment frame
  const frameCost = new Map<string, number>();
  for (const movement of movementRows) {
    if ((movement.kind !== 'sold' && movement.kind !== 'sale_reversed') || !catalogue.frames.has(String(movement.item_id))) continue;
    frameCost.set(String(movement.invoice_id), (frameCost.get(String(movement.invoice_id)) ?? 0) - money(movement.value));
  }
  if (consignment.status === 'ready') {
    for (const line of consignment.data) {
      if (line.invoiceId) frameCost.set(line.invoiceId, (frameCost.get(line.invoiceId) ?? 0) + lineAmounts(line).exclCents);
    }
  }
  return {
    status: 'ready',
    data: {
      jobs: orders.map((order): JobInput => {
        const invoice = typeof order.visit_id === 'string' ? invoiceByVisit.get(order.visit_id) ?? null : null;
        const invoiceId = invoice ? String(invoice.id) : null;
        return {
          orderId: String(order.id),
          orderNo: Number(order.order_no ?? 0),
          patientId: String(order.patient_id ?? ''),
          orderedOn: toDateKey(String(order.ordered_on ?? '')) ?? '',
          status: statusOf(order.status),
          lensCostCents: amountOrNull(order.lens_cost),
          labourCostCents: amountOrNull(order.labour_cost),
          labInvoiceRef: typeof order.lab_invoice_ref === 'string' ? order.lab_invoice_ref : null,
          invoice: invoice && invoiceId
            ? {
                id: invoiceId,
                number: String(invoice.invoice_number ?? ''),
                lines: (linesByInvoice.get(invoiceId) ?? []).map(line => ({
                  totalCents: money(line.total_price),
                  vatRate: typeof line.stock_item_id === 'string' ? catalogue.vatRates.get(line.stock_item_id) ?? catalogue.defaultVatRate : null
                }))
              }
            : null,
          frameCostCents: invoiceId ? frameCost.get(invoiceId) ?? 0 : 0
        };
      })
    }
  };
}

// ---------------------------------------------------------------------------------------------------
// Consignment
// ---------------------------------------------------------------------------------------------------

export interface ConsignmentData {
  frames: ConsignmentFrame[];
  /** On hand per consignment frame item (the stock ledger) */
  onHand: Map<string, number>;
  lines: ConsignmentLine[];
  suppliers: Supplier[];
  /** practice_expenses.status of each settled line's payable */
  payables: Map<string, string>;
  catalogue: FrameCatalogue;
}

export async function loadConsignment(practiceId: string): Promise<Loaded<ConsignmentData>> {
  const [framesLoad, linesLoad] = await Promise.all([loadConsignmentFrames(practiceId), loadConsignmentLines(practiceId)]);
  if (framesLoad.status === 'not_set_up' || linesLoad.status === 'not_set_up') return { status: 'not_set_up' };
  const itemIds = framesLoad.data.map(frame => frame.itemId);
  const [levels, suppliers, payables, catalogue] = await Promise.all([
    rowsWhereIn('stock_item_levels', 'item_id, on_hand', 'item_id', itemIds, 'Could not read the stock levels'),
    loadSuppliers(practiceId),
    loadPayableStatuses(linesLoad.data.flatMap(line => (line.expenseId ? [line.expenseId] : []))),
    loadFrameCatalogue(practiceId)
  ]);
  return {
    status: 'ready',
    data: {
      frames: framesLoad.data,
      onHand: new Map(levels.map(row => [String(row.item_id), Number(row.on_hand ?? 0) || 0])),
      lines: linesLoad.data,
      suppliers,
      payables,
      catalogue
    }
  };
}
