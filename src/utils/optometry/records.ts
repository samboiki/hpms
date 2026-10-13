/**
 * The optometry records as the screens use them, read from the database rows (proposals/2026-10-08-optometry.sql),
 * and a prescription as the database functions take it. Pure; tested in __tests__/records.test.ts.
 */
import { toDateKey } from '../billing/dates';
import { toCents } from '../billing/money';
import { LAB_ORDER_STATUSES, type LabOrderEvent, type LabOrderEyes, type LabOrderStatus, type LensCoating, type LensMaterial, type LensType } from './labOrders';
import type { Replacement, SupplyStatus } from './contactLenses';
import type { EyeRx, PrismBase, Rx, RxKind } from './prescription';
import type { FundNote } from './fundNotes';
import { clFitFromRow, historyFromRow, keratometryFromRow, ocularFromRow, type CaseHistory, type ClFit, type Keratometry, type OcularHealth } from './examParts';

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const day = (value: unknown): string | null => (typeof value === 'string' ? toDateKey(value) : null);
const one = (value: unknown): Row | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? (row as Row) : null;
};
const nameOf = (value: unknown): string | null => text(one(value)?.full_name);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

const PRISM_BASES: readonly PrismBase[] = ['in', 'out', 'up', 'down'];

const eyeFrom = (row: Row, prefix: 'r' | 'l'): EyeRx => ({
  sphere: num(row[`${prefix}_sphere`]) ?? 0,
  cylinder: num(row[`${prefix}_cylinder`]),
  axis: num(row[`${prefix}_axis`]),
  prism: num(row[`${prefix}_prism`]),
  base: PRISM_BASES.includes(row[`${prefix}_prism_base`] as PrismBase) ? (row[`${prefix}_prism_base`] as PrismBase) : null,
  add: num(row[`${prefix}_add`]),
  va: text(row[`${prefix}_va`]),
  baseCurve: num(row[`${prefix}_base_curve`]),
  diameter: num(row[`${prefix}_diameter`])
});

export interface PrescriptionRecord extends Rx {
  id: string;
  patientId: string;
  visitId: string | null;
  examId: string | null;
  kind: RxKind;
  prescribedOn: string;
  validUntil: string | null;
  lensName: string | null;
  outsideSource: string | null;
  notes: string | null;
  recordedBy: string | null;
  /** The recorder's HPCNA number, printed on the prescription */
  recordedByNumber: string | null;
  recordedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export const PRESCRIPTION_COLUMNS =
  'id, patient_id, visit_id, exam_id, kind, prescribed_on, valid_until, r_sphere, r_cylinder, r_axis, r_prism, r_prism_base, r_add, r_va, ' +
  'r_base_curve, r_diameter, l_sphere, l_cylinder, l_axis, l_prism, l_prism_base, l_add, l_va, l_base_curve, l_diameter, lens_name, ' +
  'outside_source, notes, recorded_at, voided_at, void_reason, recorder:users!optometry_prescriptions_recorded_by_fkey(full_name, hpcsa_number)';

export function toPrescription(row: Row): PrescriptionRecord {
  return {
    id: String(row.id),
    patientId: String(row.patient_id ?? ''),
    visitId: text(row.visit_id),
    examId: text(row.exam_id),
    kind: row.kind === 'contact_lenses' ? 'contact_lenses' : 'spectacles',
    prescribedOn: day(row.prescribed_on) ?? '',
    validUntil: day(row.valid_until),
    right: eyeFrom(row, 'r'),
    left: eyeFrom(row, 'l'),
    lensName: text(row.lens_name),
    outsideSource: text(row.outside_source),
    notes: text(row.notes),
    recordedBy: nameOf(row.recorder),
    recordedByNumber: text(one(row.recorder)?.hpcsa_number),
    recordedAt: String(row.recorded_at ?? ''),
    voidedAt: text(row.voided_at),
    voidReason: text(row.void_reason)
  };
}

/** Newest first: by the day prescribed, then by when it was recorded. */
export const byNewest = (a: PrescriptionRecord, b: PrescriptionRecord): number =>
  b.prescribedOn.localeCompare(a.prescribedOn) || b.recordedAt.localeCompare(a.recordedAt);

/** The patient's current prescriptions of a kind, newest first (entered-in-error ones left out). */
export const currentPrescriptions = (records: readonly PrescriptionRecord[], kind: RxKind): PrescriptionRecord[] =>
  records.filter(record => record.kind === kind && !record.voidedAt).sort(byNewest);

/** The prescription a record is compared with: the one of the same kind before it. */
export function previousPrescription(records: readonly PrescriptionRecord[], record: PrescriptionRecord): PrescriptionRecord | null {
  const list = currentPrescriptions(records, record.kind);
  const index = list.findIndex(item => item.id === record.id);
  return index >= 0 ? list[index + 1] ?? null : null;
}

const eyeJson = (eye: EyeRx) => ({
  sphere: eye.sphere,
  cylinder: eye.cylinder,
  axis: eye.cylinder ? eye.axis : null,
  prism: eye.prism,
  base: eye.prism ? eye.base : null,
  add: eye.add,
  va: eye.va,
  base_curve: eye.baseCurve,
  diameter: eye.diameter
});

/** A prescription as the database functions take it (optometry_rx_values). */
export function rxJson(rx: Rx, extra: { validUntil?: string | null; lensName?: string | null; notes?: string | null; outsideSource?: string | null } = {}) {
  return {
    right: eyeJson(rx.right),
    left: eyeJson(rx.left),
    valid_until: extra.validUntil || null,
    lens_name: extra.lensName?.trim() || null,
    notes: extra.notes?.trim() || null,
    outside_source: extra.outsideSource?.trim() || null
  };
}

// ---------------------------------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------------------------------

export type IopMethod = 'non_contact' | 'applanation' | 'rebound' | 'other';
export const IOP_METHODS: readonly IopMethod[] = ['non_contact', 'applanation', 'rebound', 'other'];
export const IOP_METHOD_LABELS: Readonly<Record<IopMethod, string>> = {
  non_contact: 'Air puff (non-contact)',
  applanation: 'Applanation (Goldmann or Perkins)',
  rebound: 'Rebound (iCare)',
  other: 'Other'
};
export type FieldsResult = 'normal' | 'abnormal';

export interface ExamRecord {
  id: string;
  visitId: string;
  examinedOn: string;
  vaUnaided: { right: string | null; left: string | null };
  vaAided: { right: string | null; left: string | null };
  iopRight: number | null;
  iopLeft: number | null;
  iopMethod: IopMethod | null;
  /** "09:30" */
  iopTime: string | null;
  fieldsResult: FieldsResult | null;
  fieldsNote: string | null;
  clFittingNote: string | null;
  notes: string | null;
  recordedBy: string | null;
  updatedAt: string;
  /** The full exam's parts (src/utils/optometry/examParts.ts); empty when the database does not keep them yet */
  history: CaseHistory;
  keratometry: Keratometry;
  ocular: OcularHealth;
  clFit: ClFit;
}

export const EXAM_COLUMNS =
  'id, visit_id, examined_on, va_unaided_r, va_unaided_l, va_aided_r, va_aided_l, iop_r, iop_l, iop_method, iop_time, fields_result, ' +
  'fields_note, cl_fitting_note, notes, updated_at, recorder:users!optometry_exams_recorded_by_fkey(full_name)';

/** EXAM_COLUMNS and the full exam's parts (proposals/2026-10-13-optometry-frames-and-exam.sql) */
export const EXAM_FULL_COLUMNS =
  `${EXAM_COLUMNS}, history_reason, history_last_test, history_symptoms, history_health, history_health_note, history_eye, ` +
  'history_family, history_needs, k_r_flat, k_r_flat_axis, k_r_steep, k_r_steep_axis, k_l_flat, k_l_flat_axis, k_l_steep, ' +
  'k_l_steep_axis, ocular_health, cd_ratio_r, cd_ratio_l, fundus_method, dilated, cl_lens_type, cl_fit, cl_over_r, cl_over_l, ' +
  'cl_va_r, cl_va_l';

export function toExam(row: Row): ExamRecord {
  return {
    id: String(row.id),
    visitId: String(row.visit_id ?? ''),
    examinedOn: day(row.examined_on) ?? '',
    vaUnaided: { right: text(row.va_unaided_r), left: text(row.va_unaided_l) },
    vaAided: { right: text(row.va_aided_r), left: text(row.va_aided_l) },
    iopRight: num(row.iop_r),
    iopLeft: num(row.iop_l),
    iopMethod: IOP_METHODS.includes(row.iop_method as IopMethod) ? (row.iop_method as IopMethod) : null,
    iopTime: text(row.iop_time)?.slice(0, 5) ?? null,
    fieldsResult: row.fields_result === 'normal' || row.fields_result === 'abnormal' ? row.fields_result : null,
    fieldsNote: text(row.fields_note),
    clFittingNote: text(row.cl_fitting_note),
    notes: text(row.notes),
    recordedBy: nameOf(row.recorder),
    updatedAt: String(row.updated_at ?? ''),
    history: historyFromRow(row),
    keratometry: keratometryFromRow(row),
    ocular: ocularFromRow(row),
    clFit: clFitFromRow(row)
  };
}

// ---------------------------------------------------------------------------------------------------
// Lab orders
// ---------------------------------------------------------------------------------------------------

export interface LabOrderRecord {
  id: string;
  orderNo: number;
  patientId: string;
  visitId: string | null;
  prescriptionId: string;
  status: LabOrderStatus;
  statusOn: string;
  orderedOn: string;
  eyes: LabOrderEyes;
  lensType: LensType;
  material: LensMaterial;
  coatings: LensCoating[];
  tintPercent: number | null;
  tintColour: string | null;
  pdRight: number | null;
  pdLeft: number | null;
  heightRight: number | null;
  heightLeft: number | null;
  frameItemId: string | null;
  frameName: string | null;
  frameNote: string | null;
  supplierId: string | null;
  supplierName: string | null;
  labReference: string | null;
  requiredBy: string | null;
  notes: string | null;
  createdBy: string | null;
  events: LabOrderEvent[];
}

export const LAB_ORDER_COLUMNS =
  'id, order_no, patient_id, visit_id, prescription_id, status, status_on, ordered_on, eyes, lens_type, material, coatings, tint_percent, ' +
  'tint_colour, pd_right, pd_left, height_right, height_left, frame_item_id, frame_name, frame_note, supplier_id, lab_reference, ' +
  'required_by, notes, creator:users!optometry_lab_orders_created_by_fkey(full_name), supplier:stock_suppliers!optometry_lab_orders_supplier_id_fkey(name)';

export const LAB_EVENT_COLUMNS = 'order_id, status, from_status, reason, happened_on, changed_at, changer:users!optometry_lab_order_events_changed_by_fkey(full_name)';

export function toLabEvent(row: Row): LabOrderEvent {
  return {
    status: oneOf(row.status, LAB_ORDER_STATUSES, 'ordered'),
    fromStatus: LAB_ORDER_STATUSES.includes(row.from_status as LabOrderStatus) ? (row.from_status as LabOrderStatus) : null,
    reason: text(row.reason),
    on: day(row.happened_on) ?? '',
    changedAt: String(row.changed_at ?? ''),
    changedBy: nameOf(row.changer)
  };
}

const COATINGS: readonly LensCoating[] = ['hard_coat', 'anti_reflective', 'blue_filter', 'photochromic', 'tint', 'polarised', 'uv'];

export function toLabOrder(row: Row, events: readonly LabOrderEvent[] = []): LabOrderRecord {
  return {
    id: String(row.id),
    orderNo: num(row.order_no) ?? 0,
    patientId: String(row.patient_id ?? ''),
    visitId: text(row.visit_id),
    prescriptionId: String(row.prescription_id ?? ''),
    status: oneOf(row.status, LAB_ORDER_STATUSES, 'ordered'),
    statusOn: day(row.status_on) ?? '',
    orderedOn: day(row.ordered_on) ?? '',
    eyes: oneOf<LabOrderEyes>(row.eyes, ['both', 'right', 'left'], 'both'),
    lensType: oneOf<LensType>(row.lens_type, ['single_vision', 'bifocal', 'multifocal', 'office', 'other'], 'other'),
    material: oneOf<LensMaterial>(row.material, ['cr39', 'polycarbonate', 'trivex', 'index_160', 'index_167', 'index_174', 'glass', 'other'], 'other'),
    coatings: Array.isArray(row.coatings) ? (row.coatings as unknown[]).filter((value): value is LensCoating => COATINGS.includes(value as LensCoating)) : [],
    tintPercent: num(row.tint_percent),
    tintColour: text(row.tint_colour),
    pdRight: num(row.pd_right),
    pdLeft: num(row.pd_left),
    heightRight: num(row.height_right),
    heightLeft: num(row.height_left),
    frameItemId: text(row.frame_item_id),
    frameName: text(row.frame_name),
    frameNote: text(row.frame_note),
    supplierId: text(row.supplier_id),
    supplierName: text(one(row.supplier)?.name),
    labReference: text(row.lab_reference),
    requiredBy: day(row.required_by),
    notes: text(row.notes),
    createdBy: nameOf(row.creator),
    events: [...events].sort((a, b) => a.changedAt.localeCompare(b.changedAt))
  };
}

// ---------------------------------------------------------------------------------------------------
// Contact-lens supplies, frames, fund notes
// ---------------------------------------------------------------------------------------------------

export interface SupplyRecord {
  id: string;
  patientId: string;
  prescriptionId: string | null;
  lensName: string;
  replacement: Replacement;
  lensesPerEye: number;
  supplierId: string | null;
  supplierName: string | null;
  status: SupplyStatus;
  orderedOn: string | null;
  receivedOn: string | null;
  collectedOn: string | null;
  runsOutOn: string | null;
  cancelReason: string | null;
  notes: string | null;
  createdAt: string;
}

export const SUPPLY_COLUMNS =
  'id, patient_id, prescription_id, lens_name, replacement, lenses_per_eye, supplier_id, status, ordered_on, received_on, collected_on, ' +
  'runs_out_on, cancel_reason, notes, created_at, supplier:stock_suppliers!optometry_cl_supplies_supplier_id_fkey(name)';

export function toSupply(row: Row): SupplyRecord {
  return {
    id: String(row.id),
    patientId: String(row.patient_id ?? ''),
    prescriptionId: text(row.prescription_id),
    lensName: text(row.lens_name) ?? 'Contact lenses',
    replacement: oneOf<Replacement>(row.replacement, ['daily', 'two_weekly', 'monthly', 'three_monthly', 'yearly'], 'monthly'),
    lensesPerEye: num(row.lenses_per_eye) ?? 0,
    supplierId: text(row.supplier_id),
    supplierName: text(one(row.supplier)?.name),
    status: oneOf<SupplyStatus>(row.status, ['ordered', 'received', 'collected', 'cancelled'], 'ordered'),
    orderedOn: day(row.ordered_on),
    receivedOn: day(row.received_on),
    collectedOn: day(row.collected_on),
    runsOutOn: day(row.runs_out_on),
    cancelReason: text(row.cancel_reason),
    notes: text(row.notes),
    createdAt: String(row.created_at ?? '')
  };
}

export const FUND_NOTE_COLUMNS = 'id, fund_reference, plan_option, note, limit_amount, cycle_months';

export function toFundNote(row: Row): FundNote {
  const limit = num(row.limit_amount);
  return {
    id: String(row.id),
    fundReference: (text(row.fund_reference) ?? '').toUpperCase(),
    planOption: text(row.plan_option),
    note: text(row.note) ?? '',
    limitCents: limit === null ? null : toCents(limit),
    cycleMonths: num(row.cycle_months)
  };
}
