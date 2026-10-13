/**
 * Reads and writes for optometry (proposals/2026-10-08-optometry.sql): prescriptions, eye exams, lab orders,
 * contact-lens supplies, frames and the practice's optical benefit notes. The rules live in src/utils/optometry
 * (tested); this file only talks to the database.
 *
 * - Until the proposal is applied the tables and functions do not exist: the loads say 'not_set_up' and the Eyes
 *   tab says eye records are not set up yet.
 * - Every write goes through an optometry_ database function that checks the signed-in user is staff of the
 *   patient's practice (a practitioner, nurse or practice admin for exams and prescriptions) and stamps who and when.
 * - Frames are stock items: their stock, deliveries and sales come from the stock module (stockService).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { isMissingColumnError, isMissingFunctionError, isMissingTableError } from '../../utils/diary/dbErrors';
import { isOptometryPractice } from '../../utils/billing/tariffRules';
import { loadPracticeType } from '../dental/dentalChartService';
import { loadPatientFundKey } from '../fundPricingService';
import { loadMovements, loadStockItems } from '../stock/stockService';
import { EXCLUDE_CARRIER_VISITS } from '../../utils/carrierVisits';
import type { PatientFundRef } from '../../utils/optometry/fundNotes';
import { FRAME_GROUP, frameStatus, soldUnits, type FrameConsignmentPayload, type FrameDetails, type FrameStatus } from '../../utils/optometry/frames';
import { isOpenLabOrder, type LabOrderStatus } from '../../utils/optometry/labOrders';
import {
  EXAM_COLUMNS,
  EXAM_FULL_COLUMNS,
  FUND_NOTE_COLUMNS,
  LAB_EVENT_COLUMNS,
  LAB_ORDER_COLUMNS,
  PRESCRIPTION_COLUMNS,
  SUPPLY_COLUMNS,
  currentPrescriptions,
  toExam,
  toFundNote,
  toLabEvent,
  toLabOrder,
  toPrescription,
  toSupply,
  type ExamRecord,
  type LabOrderRecord,
  type PrescriptionRecord,
  type SupplyRecord
} from '../../utils/optometry/records';
import type { FundNote } from '../../utils/optometry/fundNotes';
import type { LatestSpectacleRx, ReportLabOrder } from '../../utils/optometry/report';
import type { StockItem } from '../../utils/stock/items';
import type { StockMovement } from '../../utils/stock/stockRows';

// The generated database types do not know the optometry tables and functions yet
const db = supabase as unknown as SupabaseClient;

export const OPTOMETRY_TABLES = [
  'optometry_exams',
  'optometry_prescriptions',
  'optometry_lab_orders',
  'optometry_lab_order_events',
  'optometry_cl_supplies',
  'optometry_frames',
  'optometry_fund_notes'
] as const;
export const OPTOMETRY_FUNCTIONS = [
  'optometry_save_exam',
  'optometry_save_prescription',
  'optometry_void_prescription',
  'optometry_lab_order_save',
  'optometry_lab_order_set_status',
  'optometry_cl_supply_save',
  'optometry_cl_supply_set_status',
  'optometry_save_frame',
  'optometry_save_fund_note',
  'optometry_delete_fund_note'
] as const;

export class OptometryNotSetUpError extends Error {
  constructor() {
    super('Eye records are not set up yet.');
    this.name = 'OptometryNotSetUpError';
  }
}

/** True when the optometry tables or functions are not in the database yet (only ours: another missing object is a real error). */
export function isOptometryNotSetUp(error: unknown): boolean {
  return (
    error instanceof OptometryNotSetUpError ||
    OPTOMETRY_TABLES.some(table => isMissingTableError(error, table)) ||
    OPTOMETRY_FUNCTIONS.some(name => isMissingFunctionError(error, name))
  );
}

interface DbError {
  code?: string;
  message?: string;
}

/** The database's own message (its functions say in plain words why something was refused). */
const fail = (error: DbError, fallback: string): never => {
  if (isOptometryNotSetUp(error)) throw new OptometryNotSetUpError();
  throw new Error(error.message || fallback);
};

async function rpc<T>(name: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) fail(error, fallback);
  return data as T;
}

type Row = Record<string, unknown>;

/**
 * Exams with the full exam's parts (case history, keratometry, ocular health, the contact-lens fit); without them
 * (full: false) while the database does not keep them yet (proposals/2026-10-13-optometry-frames-and-exam.sql).
 */
async function selectExams(query: (columns: string) => PromiseLike<{ data: unknown; error: DbError | null }>): Promise<{ data: unknown; error: DbError | null; full: boolean }> {
  const first = await query(EXAM_FULL_COLUMNS);
  if (first.error && isMissingColumnError(first.error)) return { ...(await query(EXAM_COLUMNS)), full: false };
  return { ...first, full: true };
}

const ID_CHUNK = 200;
const chunks = <T,>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / ID_CHUNK) }, (_, index) => items.slice(index * ID_CHUNK, (index + 1) * ID_CHUNK));

// ---------------------------------------------------------------------------------------------------
// The practice (optometry practices only)
// ---------------------------------------------------------------------------------------------------

/** Whether the practice is an optometry practice (isOptometryPractice); false when its type cannot be read. */
export async function loadIsOptometryPractice(practiceId: string): Promise<boolean> {
  try {
    return isOptometryPractice(await loadPracticeType(practiceId));
  } catch {
    return false;
  }
}

export interface SlipHeading {
  name: string;
  phone: string | null;
  address: string | null;
  practiceNumber: string | null;
}

/** What the prescription and lab order slips print at the top. */
export async function loadSlipHeading(practiceId: string): Promise<SlipHeading> {
  const { data } = await db.from('practices').select('name, contact_phone, address, city, practice_number').eq('id', practiceId).maybeSingle();
  const row = (data ?? {}) as Row;
  const textOf = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  const address = [textOf(row.address), textOf(row.city)].filter(Boolean).join(', ');
  return { name: textOf(row.name) ?? 'Practice', phone: textOf(row.contact_phone), address: address || null, practiceNumber: textOf(row.practice_number) };
}

export interface PatientBasics {
  name: string;
  dateOfBirth: string | null;
}

export async function loadPatientBasics(patientId: string): Promise<PatientBasics> {
  const { data, error } = await supabase.from('patients').select('first_name, last_name, date_of_birth').eq('id', patientId).maybeSingle();
  if (error) throw new Error(`Could not read the patient: ${error.message}`);
  return { name: `${data?.first_name ?? ''} ${data?.last_name ?? ''}`.trim() || 'Patient', dateOfBirth: data?.date_of_birth ?? null };
}

/** The patient's fund code and plan options, for the optical benefit note (null without a medical aid). */
export async function loadPatientFundRef(patientId: string): Promise<PatientFundRef | null> {
  const key = await loadPatientFundKey({ patientId });
  return key.fund ? { reference: key.fund.reference, planOptions: key.fund.planOptions } : null;
}

export interface VisitOption {
  id: string;
  date: string | null;
  type: string | null;
}

/**
 * The patient's latest visits (the lab order names the one the lenses are billed at); a row that only carries invoices
 * (utils/carrierVisits.ts) is not one of them.
 */
export async function loadRecentVisits(patientId: string): Promise<VisitOption[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('id, visit_date, scheduled_date, visit_type')
    .eq('patient_id', patientId)
    .or(EXCLUDE_CARRIER_VISITS)
    .order('visit_date', { ascending: false, nullsFirst: false })
    .limit(12);
  if (error) throw new Error(`Could not read the visits: ${error.message}`);
  return (data ?? []).map(row => ({ id: row.id, date: row.visit_date ?? row.scheduled_date ?? null, type: row.visit_type ?? null }));
}

// ---------------------------------------------------------------------------------------------------
// The patient's eye records
// ---------------------------------------------------------------------------------------------------

export interface EyeRecords {
  prescriptions: PrescriptionRecord[];
  exams: ExamRecord[];
  orders: LabOrderRecord[];
  supplies: SupplyRecord[];
}

export type EyeRecordsLoad = ({ status: 'ready' } & EyeRecords) | { status: 'not_set_up' };

async function loadEvents(orderIds: readonly string[]): Promise<Map<string, ReturnType<typeof toLabEvent>[]>> {
  const byOrder = new Map<string, ReturnType<typeof toLabEvent>[]>();
  for (const ids of chunks(orderIds)) {
    const { data, error } = await db.from('optometry_lab_order_events').select(LAB_EVENT_COLUMNS).in('order_id', ids);
    if (error) fail(error, 'Could not read the lab orders\' steps');
    for (const row of (data ?? []) as unknown as Row[]) {
      const id = String(row.order_id);
      byOrder.set(id, [...(byOrder.get(id) ?? []), toLabEvent(row)]);
    }
  }
  return byOrder;
}

/** Everything recorded about the patient's eyes; 'not_set_up' before the proposal is applied. */
export async function loadEyeRecords(patientId: string): Promise<EyeRecordsLoad> {
  try {
    const [prescriptions, exams, orders, supplies] = await Promise.all([
      db.from('optometry_prescriptions').select(PRESCRIPTION_COLUMNS).eq('patient_id', patientId),
      selectExams(columns => db.from('optometry_exams').select(columns).eq('patient_id', patientId).order('examined_on', { ascending: false })),
      db.from('optometry_lab_orders').select(LAB_ORDER_COLUMNS).eq('patient_id', patientId).order('order_no', { ascending: false }),
      db.from('optometry_cl_supplies').select(SUPPLY_COLUMNS).eq('patient_id', patientId).order('created_at', { ascending: false })
    ]);
    for (const result of [prescriptions, exams, orders, supplies]) {
      if (result.error) fail(result.error, 'Could not read the eye records');
    }
    const orderRows = (orders.data ?? []) as unknown as Row[];
    const events = await loadEvents(orderRows.map(row => String(row.id)));
    return {
      status: 'ready',
      prescriptions: ((prescriptions.data ?? []) as unknown as Row[]).map(toPrescription),
      exams: ((exams.data ?? []) as unknown as Row[]).map(toExam),
      orders: orderRows.map(row => toLabOrder(row, events.get(String(row.id)) ?? [])),
      supplies: ((supplies.data ?? []) as unknown as Row[]).map(toSupply)
    };
  } catch (error) {
    if (isOptometryNotSetUp(error)) return { status: 'not_set_up' };
    throw error;
  }
}

export type VisitExamLoad =
  | {
      status: 'ready';
      exam: ExamRecord | null;
      prescriptions: PrescriptionRecord[];
      earlier: PrescriptionRecord[];
      /** The database keeps the full exam's parts (case history, keratometry, ocular health, the contact-lens fit) */
      full: boolean;
    }
  | { status: 'not_set_up' };

/**
 * The visit's eye exam, the prescriptions recorded at it, and the patient's earlier current prescriptions (the
 * refraction is compared with the last one).
 */
export async function loadVisitExam(visitId: string, patientId: string): Promise<VisitExamLoad> {
  try {
    const [exam, prescriptions] = await Promise.all([
      selectExams(columns => db.from('optometry_exams').select(columns).eq('visit_id', visitId).maybeSingle()),
      db.from('optometry_prescriptions').select(PRESCRIPTION_COLUMNS).eq('patient_id', patientId)
    ]);
    if (exam.error) fail(exam.error, 'Could not read the eye exam');
    if (prescriptions.error) fail(prescriptions.error, 'Could not read the prescriptions');
    const examRecord = exam.data ? toExam(exam.data as unknown as Row) : null;
    const all = ((prescriptions.data ?? []) as unknown as Row[]).map(toPrescription);
    const ofExam = examRecord ? all.filter(record => record.examId === examRecord.id && !record.voidedAt) : [];
    const earlier = [...currentPrescriptions(all, 'spectacles'), ...currentPrescriptions(all, 'contact_lenses')].filter(
      record => !ofExam.some(own => own.id === record.id)
    );
    return { status: 'ready', exam: examRecord, prescriptions: ofExam, earlier, full: exam.full };
  } catch (error) {
    if (isOptometryNotSetUp(error)) return { status: 'not_set_up' };
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------------

export interface SavedExam {
  examId: string;
  spectacles: string | null;
  contactLenses: string | null;
}

/** optometry_save_exam: the exam with its refraction and contact-lens prescription (null takes one off). */
export async function saveExam(payload: Record<string, unknown>): Promise<SavedExam> {
  const result = await rpc<Record<string, string | null>>('optometry_save_exam', { p_payload: payload }, 'Could not save the eye exam');
  return { examId: String(result.exam_id), spectacles: result.spectacles ?? null, contactLenses: result.contact_lenses ?? null };
}

export const savePrescription = (payload: Record<string, unknown>): Promise<string> =>
  rpc<string>('optometry_save_prescription', { p_payload: payload }, 'Could not save the prescription');

export const voidPrescription = (prescriptionId: string, reason: string): Promise<unknown> =>
  rpc('optometry_void_prescription', { p_prescription_id: prescriptionId, p_reason: reason.trim() }, 'Could not mark the prescription');

export const saveLabOrder = (payload: Record<string, unknown>): Promise<{ id: string; order_no: number; created: boolean }> =>
  rpc('optometry_lab_order_save', { p_payload: payload }, 'Could not save the lab order');

export const setLabOrderStatus = (orderId: string, status: LabOrderStatus, reason: string | null, on: string | null): Promise<unknown> =>
  rpc('optometry_lab_order_set_status', { p_order_id: orderId, p_status: status, p_reason: reason?.trim() || null, p_on: on || null }, 'Could not change the order');

export const saveSupply = (payload: Record<string, unknown>): Promise<string> =>
  rpc<string>('optometry_cl_supply_save', { p_payload: payload }, 'Could not save the contact lenses');

export const setSupplyStatus = (
  supplyId: string,
  status: 'received' | 'collected' | 'cancelled',
  options: { on?: string | null; runsOutOn?: string | null; reason?: string | null } = {}
): Promise<unknown> =>
  rpc('optometry_cl_supply_set_status', {
    p_supply_id: supplyId,
    p_status: status,
    p_on: options.on || null,
    p_runs_out_on: options.runsOutOn || null,
    p_reason: options.reason?.trim() || null
  }, 'Could not change the contact lenses');

// ---------------------------------------------------------------------------------------------------
// Frames (stock items in the Frames group)
// ---------------------------------------------------------------------------------------------------

/** A frame the supplier owns until it is sold (consignment), and what is owed per frame sold */
export interface FrameConsignment {
  supplierId: string | null;
  costCents: number;
}

export interface FrameRow {
  item: StockItem;
  details: FrameDetails | null;
  onHand: number;
  onOrder: number;
  sold: number;
  status: FrameStatus;
  /** The frame has stock movements: its cost then follows the deliveries (the stock module's rule) */
  inLedger: boolean;
  /** Null for the practice's own frames (and before consignment is set up) */
  consignment: FrameConsignment | null;
}

export type FramesLoad = { status: 'ready'; frames: FrameRow[] } | { status: 'not_set_up' };

const FRAME_DETAIL_COLUMNS = 'item_id, brand, model, colour, size';

/** Frame details with the consignment columns; without them while the database does not have them yet */
async function selectFrameDetails(practiceId: string): Promise<{ data: unknown; error: DbError | null }> {
  const full = await db.from('optometry_frames').select(`${FRAME_DETAIL_COLUMNS}, consignment, consignment_supplier_id, consignment_cost`).eq('practice_id', practiceId);
  if (full.error && isMissingColumnError(full.error)) return db.from('optometry_frames').select(FRAME_DETAIL_COLUMNS).eq('practice_id', practiceId);
  return full;
}

/** The practice's frames with their stock and status: on hand from the ledger, open orders, net sales. */
export async function loadFrames(practiceId: string): Promise<FramesLoad> {
  try {
    const [stock, details, orders] = await Promise.all([
      loadStockItems(practiceId),
      selectFrameDetails(practiceId),
      db.from('optometry_lab_orders').select('frame_item_id, status').eq('practice_id', practiceId).not('frame_item_id', 'is', null)
    ]);
    if (details.error) fail(details.error, 'Could not read the frames');
    if (orders.error) fail(orders.error, 'Could not read the lab orders');
    const detailRows = (details.data ?? []) as Row[];
    const detailById = new Map(detailRows.map(row => [String(row.item_id), {
      brand: String(row.brand ?? ''),
      model: String(row.model ?? ''),
      colour: typeof row.colour === 'string' ? row.colour : null,
      size: typeof row.size === 'string' ? row.size : null
    }] as const));
    const consignmentById = new Map(detailRows.flatMap(row => (row.consignment === true
      ? [[String(row.item_id), {
          supplierId: typeof row.consignment_supplier_id === 'string' ? row.consignment_supplier_id : null,
          costCents: Math.round((Number(row.consignment_cost ?? 0) || 0) * 100)
        }] as const]
      : [])));
    const items = stock.items.filter(item => item.group === FRAME_GROUP || detailById.has(item.id));
    const openOrders = new Map<string, number>();
    for (const row of (orders.data ?? []) as Row[]) {
      if (isOpenLabOrder(row.status as LabOrderStatus)) openOrders.set(String(row.frame_item_id), (openOrders.get(String(row.frame_item_id)) ?? 0) + 1);
    }
    const movements = items.length > 0 ? await loadMovements(practiceId, { itemIds: items.map(item => item.id) }) : [];
    const byItem = new Map<string, StockMovement[]>();
    for (const movement of movements) byItem.set(movement.itemId, [...(byItem.get(movement.itemId) ?? []), movement]);
    return {
      status: 'ready',
      frames: items.map(item => {
        const counts = { onHand: stock.levels.get(item.id)?.onHand ?? 0, onOrder: openOrders.get(item.id) ?? 0, sold: soldUnits(byItem.get(item.id) ?? []) };
        return {
          item,
          details: detailById.get(item.id) ?? null,
          ...counts,
          status: frameStatus(counts),
          inLedger: stock.levels.has(item.id),
          consignment: consignmentById.get(item.id) ?? null
        };
      })
    };
  } catch (error) {
    if (isOptometryNotSetUp(error)) return { status: 'not_set_up' };
    throw error;
  }
}

/**
 * optometry_save_frame: the stock item (stock_save_item's payload) and the frame's details, with whether the supplier
 * owns it (consignment) once the database keeps that. Returns the item id.
 */
export async function saveFrame(item: Record<string, unknown>, frame: FrameDetails & Partial<FrameConsignmentPayload>): Promise<string> {
  const result = await rpc<{ id: string }>('optometry_save_frame', { p_item: item, p_frame: frame }, 'Could not save the frame');
  return result.id;
}

// ---------------------------------------------------------------------------------------------------
// Optical benefit notes
// ---------------------------------------------------------------------------------------------------

export type FundNotesLoad = { status: 'ready'; notes: FundNote[] } | { status: 'not_set_up' };

export async function loadFundNotes(practiceId: string): Promise<FundNotesLoad> {
  const { data, error } = await db.from('optometry_fund_notes').select(FUND_NOTE_COLUMNS).eq('practice_id', practiceId).order('fund_reference');
  if (error) {
    if (isOptometryNotSetUp(error)) return { status: 'not_set_up' };
    throw new Error(`Could not read the benefit notes: ${error.message}`);
  }
  return { status: 'ready', notes: ((data ?? []) as Row[]).map(toFundNote) };
}

export const saveFundNote = (practiceId: string, payload: Record<string, unknown>): Promise<string> =>
  rpc<string>('optometry_save_fund_note', { p_practice_id: practiceId, p_payload: payload }, 'Could not save the note');

export const deleteFundNote = (noteId: string): Promise<unknown> =>
  rpc('optometry_delete_fund_note', { p_note_id: noteId }, 'Could not delete the note');

/** The funds the practice can write notes for: medical_aid_providers with a claim code. */
export async function loadFunds(): Promise<Array<{ reference: string; name: string }>> {
  const { data, error } = await supabase.from('medical_aid_providers').select('name, medical_aid_reference');
  if (error) throw new Error(`Could not read the funds: ${error.message}`);
  const funds = new Map<string, string>();
  for (const row of data ?? []) {
    const reference = (row.medical_aid_reference ?? '').trim().toUpperCase();
    if (/^[A-Z0-9]{2,10}$/.test(reference) && !funds.has(reference)) funds.set(reference, (row.name ?? reference).trim());
  }
  return [...funds.entries()].map(([reference, name]) => ({ reference, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------------------------
// Across the practice: open lab orders and the report
// ---------------------------------------------------------------------------------------------------

export interface PracticeLabOrder extends LabOrderRecord {
  patientName: string;
  /** For the lab slip, as the Eyes tab prints it (the Optometry page's slips had none) */
  patientDateOfBirth?: string | null;
  /** The prescription the lenses are made to (for the lab slip) */
  prescription: PrescriptionRecord | null;
}

export type PracticeOrdersLoad = { status: 'ready'; orders: PracticeLabOrder[] } | { status: 'not_set_up' };

async function loadPatientNames(patientIds: readonly string[]): Promise<Map<string, { name: string; dateOfBirth: string | null }>> {
  const names = new Map<string, { name: string; dateOfBirth: string | null }>();
  for (const ids of chunks([...new Set(patientIds)])) {
    const { data, error } = await supabase.from('patients').select('id, first_name, last_name, date_of_birth').in('id', ids);
    if (error) throw new Error(`Could not read the patients: ${error.message}`);
    for (const row of data ?? []) {
      names.set(row.id, { name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Patient', dateOfBirth: row.date_of_birth ?? null });
    }
  }
  return names;
}

async function loadPrescriptionsById(ids: readonly string[]): Promise<Map<string, PrescriptionRecord>> {
  const byId = new Map<string, PrescriptionRecord>();
  for (const part of chunks([...new Set(ids)].filter(Boolean))) {
    const { data, error } = await db.from('optometry_prescriptions').select(PRESCRIPTION_COLUMNS).in('id', part);
    if (error) fail(error, 'Could not read the prescriptions');
    for (const row of (data ?? []) as unknown as Row[]) byId.set(String(row.id), toPrescription(row));
  }
  return byId;
}

/** The practice's lab orders: the open ones, or every order placed from a day on. */
export async function loadPracticeLabOrders(practiceId: string, filter: { openOnly: boolean; since?: string }): Promise<PracticeOrdersLoad> {
  try {
    let query = db.from('optometry_lab_orders').select(LAB_ORDER_COLUMNS).eq('practice_id', practiceId);
    if (filter.openOnly) query = query.not('status', 'in', '(collected,cancelled)');
    if (filter.since) query = query.gte('ordered_on', filter.since);
    const { data, error } = await query.order('ordered_on', { ascending: true }).limit(1000);
    if (error) fail(error, 'Could not read the lab orders');
    const rows = (data ?? []) as unknown as Row[];
    const [events, names, prescriptions] = await Promise.all([
      loadEvents(rows.map(row => String(row.id))),
      loadPatientNames(rows.map(row => String(row.patient_id))),
      loadPrescriptionsById(rows.map(row => String(row.prescription_id)))
    ]);
    return {
      status: 'ready',
      orders: rows.map(row => ({
        ...toLabOrder(row, events.get(String(row.id)) ?? []),
        patientName: names.get(String(row.patient_id))?.name ?? 'Patient',
        patientDateOfBirth: names.get(String(row.patient_id))?.dateOfBirth ?? null,
        prescription: prescriptions.get(String(row.prescription_id)) ?? null
      }))
    };
  } catch (error) {
    if (isOptometryNotSetUp(error)) return { status: 'not_set_up' };
    throw error;
  }
}

export interface ReportData {
  movements: StockMovement[];
  frames: Map<string, FrameDetails>;
  latestRx: LatestSpectacleRx[];
  orders: ReportLabOrder[];
}

/** What the optometry report needs for a period (both days included). */
export async function loadReportData(practiceId: string, from: string, to: string): Promise<ReportData | 'not_set_up'> {
  const framesLoad = await loadFrames(practiceId);
  if (framesLoad.status === 'not_set_up') return 'not_set_up';
  // A frame added on the Stock page without its details still counts, under its own name
  const frames = new Map(framesLoad.frames.map(frame => [frame.item.id, frame.details ?? { brand: frame.item.name, model: '', colour: null, size: null }] as const));
  const itemIds = framesLoad.frames.map(frame => frame.item.id);
  const [movements, prescriptions, ordersLoad] = await Promise.all([
    itemIds.length > 0 ? loadMovements(practiceId, { from, to, itemIds }) : Promise.resolve([] as StockMovement[]),
    db.from('optometry_prescriptions').select('patient_id, prescribed_on, recorded_at, r_add, l_add')
      .eq('practice_id', practiceId).eq('kind', 'spectacles').is('voided_at', null).limit(20000),
    loadPracticeLabOrders(practiceId, { openOnly: false, since: from })
  ]);
  if (prescriptions.error) fail(prescriptions.error, 'Could not read the prescriptions');
  // The latest spectacle prescription of each patient
  const latest = new Map<string, { on: string; at: string; add: number | null }>();
  for (const row of (prescriptions.data ?? []) as Row[]) {
    const id = String(row.patient_id);
    const on = String(row.prescribed_on ?? '');
    const at = String(row.recorded_at ?? '');
    const adds = [row.r_add, row.l_add].map(value => (value === null || value === undefined ? null : Number(value))).filter((value): value is number => value !== null && Number.isFinite(value));
    const current = latest.get(id);
    if (!current || on > current.on || (on === current.on && at > current.at)) latest.set(id, { on, at, add: adds.length > 0 ? Math.max(...adds) : null });
  }
  const births = new Map<string, string | null>();
  for (const ids of chunks([...latest.keys()])) {
    const { data, error } = await supabase.from('patients').select('id, date_of_birth').in('id', ids);
    if (error) throw new Error(`Could not read the patients: ${error.message}`);
    for (const row of data ?? []) births.set(row.id, row.date_of_birth ?? null);
  }
  const orders = ordersLoad.status === 'ready' ? ordersLoad.orders.filter(order => order.orderedOn <= to) : [];
  return {
    movements,
    frames,
    latestRx: [...latest.entries()].map(([patientId, rx]) => ({ patientId, dateOfBirth: births.get(patientId) ?? null, add: rx.add, prescribedOn: rx.on || null })),
    orders: orders.map(order => ({ orderedOn: order.orderedOn, status: order.status, supplierId: order.supplierId, supplierName: order.supplierName, events: order.events }))
  };
}
