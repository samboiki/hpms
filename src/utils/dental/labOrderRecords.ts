/**
 * Dental lab orders as the screens use them, read from the database rows (proposals/2026-10-13-dental-lab-work.sql).
 * Pure; tested in __tests__/labOrderRecords.test.ts.
 */
import { toDateKey } from '../billing/dates';
import { toCents } from '../billing/money';
import { DENTAL_LAB_STATUSES, DENTAL_LAB_WORKS, JAWS, sortedTeeth, type DentalLabStatus, type DentalLabWork, type Jaw } from './labOrders';
import type { LabSlipLine } from './labSlips';

type Row = Record<string, unknown>;

export interface DentalLabEvent {
  status: DentalLabStatus;
  fromStatus: DentalLabStatus | null;
  reason: string | null;
  /** The day it happened (yyyy-MM-dd) */
  on: string;
  changedAt: string;
  changedBy: string | null;
}

export interface DentalLabOrder {
  id: string;
  orderNo: number;
  patientId: string;
  /** The visit it was started at, and that visit's date */
  visitId: string | null;
  visitDate: string | null;
  /** The visit whose 8099 line bills the lab's invoice, and that visit's date */
  billedVisitId: string | null;
  billedVisitDate: string | null;
  status: DentalLabStatus;
  statusOn: string;
  sentOn: string;
  dueOn: string | null;
  supplierId: string | null;
  labName: string | null;
  workType: DentalLabWork;
  teeth: string[];
  jaw: Jaw | null;
  shade: string | null;
  notes: string | null;
  /** The lab's invoice number and lines (empty until entered) */
  slipNumber: string | null;
  slipLines: LabSlipLine[];
  createdBy: string | null;
  events: DentalLabEvent[];
}

export const ORDER_COLUMNS =
  'id, order_no, patient_id, visit_id, billed_visit_id, status, status_on, sent_on, due_on, supplier_id, work_type, teeth, jaw, shade, notes, ' +
  'slip_number, creator:users!dental_lab_orders_created_by_fkey(full_name), supplier:stock_suppliers!dental_lab_orders_supplier_id_fkey(name), ' +
  'started:visits!dental_lab_orders_visit_id_fkey(visit_date, scheduled_date), billed:visits!dental_lab_orders_billed_visit_id_fkey(visit_date, scheduled_date)';

export const EVENT_COLUMNS = 'order_id, status, from_status, reason, happened_on, changed_at, changer:users!dental_lab_order_events_changed_by_fkey(full_name)';

export const SLIP_LINE_COLUMNS = 'order_id, line_no, lab_code, description, amount';

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const day = (value: unknown): string | null => (typeof value === 'string' ? toDateKey(value) : null);
const one = (value: unknown): Row | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? (row as Row) : null;
};
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const visitDay = (value: unknown): string | null => {
  const visit = one(value);
  return visit ? day(visit.visit_date) ?? day(visit.scheduled_date) : null;
};

export function toDentalLabEvent(row: Row): DentalLabEvent {
  return {
    status: oneOf(row.status, DENTAL_LAB_STATUSES, 'sent'),
    fromStatus: DENTAL_LAB_STATUSES.includes(row.from_status as DentalLabStatus) ? (row.from_status as DentalLabStatus) : null,
    reason: text(row.reason),
    on: day(row.happened_on) ?? '',
    changedAt: String(row.changed_at ?? ''),
    changedBy: text(one(row.changer)?.full_name)
  };
}

/** A line of the lab's invoice; the amount in whole cents (a stored "1850.00" is 185000). */
export function toSlipLine(row: Row): LabSlipLine & { lineNo: number } {
  const amount = typeof row.amount === 'number' ? row.amount : Number(row.amount);
  return {
    lineNo: Number(row.line_no) || 0,
    code: text(row.lab_code),
    description: text(row.description) ?? '',
    amountCents: Number.isFinite(amount) ? toCents(amount) : 0
  };
}

export function toDentalLabOrder(row: Row, events: readonly DentalLabEvent[] = [], lines: readonly (LabSlipLine & { lineNo?: number })[] = []): DentalLabOrder {
  const orderNo = Number(row.order_no);
  return {
    id: String(row.id),
    orderNo: Number.isFinite(orderNo) ? orderNo : 0,
    patientId: String(row.patient_id ?? ''),
    visitId: text(row.visit_id),
    visitDate: visitDay(row.started),
    billedVisitId: text(row.billed_visit_id),
    billedVisitDate: visitDay(row.billed),
    status: oneOf(row.status, DENTAL_LAB_STATUSES, 'sent'),
    statusOn: day(row.status_on) ?? '',
    sentOn: day(row.sent_on) ?? '',
    dueOn: day(row.due_on),
    supplierId: text(row.supplier_id),
    labName: text(one(row.supplier)?.name),
    workType: oneOf<DentalLabWork>(row.work_type, DENTAL_LAB_WORKS, 'other'),
    teeth: sortedTeeth(Array.isArray(row.teeth) ? (row.teeth as unknown[]).filter((tooth): tooth is string => typeof tooth === 'string') : []),
    jaw: JAWS.includes(row.jaw as Jaw) ? (row.jaw as Jaw) : null,
    shade: text(row.shade),
    notes: text(row.notes),
    slipNumber: text(row.slip_number),
    slipLines: [...lines]
      .sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0))
      .map(line => ({ code: line.code, description: line.description, amountCents: line.amountCents })),
    createdBy: text(one(row.creator)?.full_name),
    events: [...events].sort((a, b) => a.changedAt.localeCompare(b.changedAt))
  };
}
