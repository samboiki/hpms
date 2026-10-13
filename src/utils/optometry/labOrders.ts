/**
 * Optical lab orders: what goes to the lab (the eyes, lens type, material, coatings and tint, pupil distances and
 * fitting heights, the frame), the steps an order goes through, and how long the lab took. The database allows the
 * same steps and checks the same ranges (optometry_lab_order_save and optometry_lab_order_set_status in
 * proposals/2026-10-08-optometry.sql). Pure; tested in __tests__/labOrders.test.ts.
 */
import { daysBetweenKeys, isValidDateKey } from '../billing/dates';
import { parsePlainNumber, type EyeSide, type Rx } from './prescription';

export type LabOrderStatus = 'ordered' | 'received' | 'fitted' | 'collected' | 'remake' | 'cancelled';
export const LAB_ORDER_STATUSES: readonly LabOrderStatus[] = ['ordered', 'received', 'fitted', 'collected', 'remake', 'cancelled'];

export const LAB_STATUS_LABELS: Readonly<Record<LabOrderStatus, string>> = {
  ordered: 'At the lab',
  received: 'Back from the lab',
  fitted: 'Fitted, ready to collect',
  collected: 'Collected',
  remake: 'Sent back for a remake',
  cancelled: 'Cancelled'
};

/** The button that moves an order to each status */
export const LAB_STATUS_ACTIONS: Readonly<Record<LabOrderStatus, string>> = {
  ordered: 'Ordered',
  received: 'Back from the lab',
  fitted: 'Fitted',
  collected: 'Collected',
  remake: 'Send for a remake',
  cancelled: 'Cancel order'
};

/**
 * The steps an order may take. Glasses can be collected straight from "back from the lab" (many labs glaze the
 * lenses into the frame), a remake can be asked for until the patient has worn them, and a remake comes back from
 * the lab like the first order did.
 */
export const NEXT_LAB_STATUSES: Readonly<Record<LabOrderStatus, readonly LabOrderStatus[]>> = {
  ordered: ['received', 'cancelled'],
  received: ['fitted', 'collected', 'remake'],
  fitted: ['collected', 'remake'],
  collected: ['remake'],
  remake: ['received', 'cancelled'],
  cancelled: []
};

export const canMoveLabOrder = (from: LabOrderStatus, to: LabOrderStatus): boolean => NEXT_LAB_STATUSES[from].includes(to);
/** A remake or a cancellation says why (the lab, the patient and the report need it) */
export const labStatusNeedsReason = (to: LabOrderStatus): boolean => to === 'remake' || to === 'cancelled';
/** Still in the practice's hands: not collected and not cancelled */
export const isOpenLabOrder = (status: LabOrderStatus): boolean => status !== 'collected' && status !== 'cancelled';

export type LabOrderEyes = 'both' | 'right' | 'left';
export const LAB_EYES_LABELS: Readonly<Record<LabOrderEyes, string>> = { both: 'Both eyes', right: 'Right eye only', left: 'Left eye only' };
export const orderedSides = (eyes: LabOrderEyes): EyeSide[] => (eyes === 'both' ? ['right', 'left'] : [eyes]);

export type LensType = 'single_vision' | 'bifocal' | 'multifocal' | 'office' | 'other';
export const LENS_TYPES: readonly LensType[] = ['single_vision', 'bifocal', 'multifocal', 'office', 'other'];
export const LENS_TYPE_LABELS: Readonly<Record<LensType, string>> = {
  single_vision: 'Single vision',
  bifocal: 'Bifocal',
  multifocal: 'Multifocal (varifocal)',
  office: 'Office (near and computer)',
  other: 'Other (say in the notes)'
};
/** Lenses with a reading part: they need the reading addition and a fitting height */
export const hasReadingPart = (type: LensType | ''): boolean => type === 'bifocal' || type === 'multifocal' || type === 'office';

export type LensMaterial = 'cr39' | 'polycarbonate' | 'trivex' | 'index_160' | 'index_167' | 'index_174' | 'glass' | 'other';
export const LENS_MATERIALS: readonly LensMaterial[] = ['cr39', 'polycarbonate', 'trivex', 'index_160', 'index_167', 'index_174', 'glass', 'other'];
export const LENS_MATERIAL_LABELS: Readonly<Record<LensMaterial, string>> = {
  cr39: 'Standard plastic (CR-39)',
  polycarbonate: 'Polycarbonate',
  trivex: 'Trivex',
  index_160: 'Thin 1.60',
  index_167: 'Thinner 1.67',
  index_174: 'Thinnest 1.74',
  glass: 'Glass',
  other: 'Other (say in the notes)'
};

export type LensCoating = 'hard_coat' | 'anti_reflective' | 'blue_filter' | 'photochromic' | 'tint' | 'polarised' | 'uv';
export const LENS_COATINGS: readonly LensCoating[] = ['hard_coat', 'anti_reflective', 'blue_filter', 'photochromic', 'tint', 'polarised', 'uv'];
export const LENS_COATING_LABELS: Readonly<Record<LensCoating, string>> = {
  hard_coat: 'Scratch-resistant',
  anti_reflective: 'Anti-reflective',
  blue_filter: 'Blue light filter',
  photochromic: 'Darkens in the sun',
  tint: 'Tint',
  polarised: 'Polarised',
  uv: 'UV filter'
};

/** Monocular pupil distance and fitting height in mm, in half millimetres; tint in percent (claim field 47 holds 2 digits) */
export const PD_LIMITS = { min: 20, max: 40 } as const;
export const HEIGHT_LIMITS = { min: 10, max: 40 } as const;
export const TINT_LIMITS = { min: 1, max: 99 } as const;

export interface LabOrderDraft {
  prescriptionId: string;
  eyes: LabOrderEyes;
  lensType: LensType | '';
  material: LensMaterial | '';
  coatings: LensCoating[];
  tintPercent: string;
  tintColour: string;
  pdRight: string;
  pdLeft: string;
  heightRight: string;
  heightLeft: string;
  /** A frame from the practice's stock */
  frameItemId: string;
  /** The patient's own frame, or a frame to be ordered, in words */
  frameNote: string;
  supplierId: string;
  labReference: string;
  requiredBy: string;
  notes: string;
}

export type LabOrderDraftErrors = Partial<Record<keyof LabOrderDraft, string>>;

export const emptyLabOrderDraft = (prescriptionId = ''): LabOrderDraft => ({
  prescriptionId,
  eyes: 'both',
  lensType: '',
  material: '',
  coatings: [],
  tintPercent: '',
  tintColour: '',
  pdRight: '',
  pdLeft: '',
  heightRight: '',
  heightLeft: '',
  frameItemId: '',
  frameNote: '',
  supplierId: '',
  labReference: '',
  requiredBy: '',
  notes: ''
});

const isHalfStep = (value: number): boolean => Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;

const SIDE_FIELDS: Readonly<Record<EyeSide, { pd: 'pdRight' | 'pdLeft'; height: 'heightRight' | 'heightLeft'; name: string }>> = {
  right: { pd: 'pdRight', height: 'heightRight', name: 'right' },
  left: { pd: 'pdLeft', height: 'heightLeft', name: 'left' }
};

/**
 * Checks the order form and builds the optometry_lab_order_save payload. The lab needs a pupil distance for every
 * eye ordered, and a fitting height for lenses with a reading part; such lenses also need a reading addition in the
 * prescription, or the lab would make them without one.
 */
export function validateLabOrderDraft(
  draft: LabOrderDraft,
  context: { rx: Rx | null; today: string }
): { ok: true; payload: Record<string, unknown> } | { ok: false; errors: LabOrderDraftErrors } {
  const errors: LabOrderDraftErrors = {};
  if (!draft.prescriptionId || !context.rx) errors.prescriptionId = 'Choose the prescription the lenses are made to.';
  if (!draft.lensType) errors.lensType = 'Choose the lens type.';
  if (!draft.material) errors.material = 'Choose the lens material.';
  const sides = orderedSides(draft.eyes);
  const readingPart = hasReadingPart(draft.lensType);

  const measure = (field: keyof LabOrderDraft, text: string, limits: { min: number; max: number }, label: string, required: boolean): number | null => {
    const parsed = parsePlainNumber(text, 1);
    if (!parsed.ok || (parsed.value !== null && (parsed.value < limits.min || parsed.value > limits.max || !isHalfStep(parsed.value)))) {
      errors[field] = `${label}: ${limits.min} to ${limits.max} mm, in half millimetres.`;
      return null;
    }
    if (parsed.value === null && required) errors[field] = `${label} is needed by the lab.`;
    return parsed.value;
  };

  const values: Record<EyeSide, { pd: number | null; height: number | null }> = { right: { pd: null, height: null }, left: { pd: null, height: null } };
  for (const side of sides) {
    const fields = SIDE_FIELDS[side];
    values[side].pd = measure(fields.pd, draft[fields.pd], PD_LIMITS, `Pupil distance (${fields.name})`, true);
    values[side].height = measure(fields.height, draft[fields.height], HEIGHT_LIMITS, `Fitting height (${fields.name})`, readingPart);
    if (readingPart && context.rx && !context.rx[side].add && !errors.lensType) {
      errors.lensType = `A ${draft.lensType === 'office' ? 'office' : draft.lensType} lens needs a reading addition for the ${fields.name} eye in the prescription.`;
    }
  }

  const tinted = draft.coatings.includes('tint');
  let tint: number | null = null;
  if (tinted) {
    const parsed = parsePlainNumber(draft.tintPercent, 0);
    if (!parsed.ok || parsed.value === null || parsed.value < TINT_LIMITS.min || parsed.value > TINT_LIMITS.max) {
      errors.tintPercent = `Tint: ${TINT_LIMITS.min} to ${TINT_LIMITS.max} %.`;
    } else tint = parsed.value;
  }
  if (draft.tintColour.trim().length > 30) errors.tintColour = 'Keep the colour short, e.g. grey or brown.';

  if (!draft.frameItemId && !draft.frameNote.trim()) errors.frameNote = 'Choose a frame from stock, or describe the frame (e.g. the patient\'s own).';
  if (draft.frameNote.trim().length > 200) errors.frameNote = 'Keep the frame description to 200 characters.';
  if (draft.labReference.trim().length > 40) errors.labReference = 'Keep the lab\'s reference to 40 characters.';
  if (draft.notes.trim().length > 500) errors.notes = 'Keep the notes to 500 characters.';
  if (draft.requiredBy) {
    if (!isValidDateKey(draft.requiredBy)) errors.requiredBy = 'Choose a date.';
    else if (draft.requiredBy < context.today) errors.requiredBy = 'The date needed cannot be in the past.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const optional = (value: string): string | null => (value.trim() ? value.trim() : null);
  return {
    ok: true,
    payload: {
      prescription_id: draft.prescriptionId,
      eyes: draft.eyes,
      lens_type: draft.lensType,
      material: draft.material,
      coatings: [...new Set(draft.coatings)],
      tint_percent: tint,
      tint_colour: tinted ? optional(draft.tintColour) : null,
      pd_right: values.right.pd,
      pd_left: values.left.pd,
      height_right: values.right.height,
      height_left: values.left.height,
      frame_item_id: optional(draft.frameItemId),
      frame_note: optional(draft.frameNote),
      supplier_id: optional(draft.supplierId),
      lab_reference: optional(draft.labReference),
      required_by: optional(draft.requiredBy),
      notes: optional(draft.notes)
    }
  };
}

// ---------------------------------------------------------------------------------------------------
// History and turnaround
// ---------------------------------------------------------------------------------------------------

export interface LabOrderEvent {
  status: LabOrderStatus;
  fromStatus: LabOrderStatus | null;
  reason: string | null;
  /** The day it happened (yyyy-MM-dd, Windhoek) */
  on: string;
  changedAt: string;
  changedBy: string | null;
}

export interface Turnaround {
  /** Days from ordering until the lenses first came back */
  daysAtLab: number | null;
  /** Days from ordering until the patient (last) collected */
  daysToCollect: number | null;
  remakes: number;
}

export function orderTurnaround(orderedOn: string, events: readonly LabOrderEvent[]): Turnaround {
  const byDay = [...events].sort((a, b) => a.on.localeCompare(b.on) || a.changedAt.localeCompare(b.changedAt));
  const firstBack = byDay.find(event => event.status === 'received');
  const collected = byDay.filter(event => event.status === 'collected');
  const lastCollected = collected.length > 0 ? collected[collected.length - 1] : undefined;
  const days = (event: LabOrderEvent | undefined): number | null =>
    event && isValidDateKey(orderedOn) && isValidDateKey(event.on) ? Math.max(0, daysBetweenKeys(orderedOn, event.on)) : null;
  return { daysAtLab: days(firstBack), daysToCollect: days(lastCollected), remakes: byDay.filter(event => event.status === 'remake').length };
}

/** Days an open order has been waiting since it was ordered (or sent back for a remake). */
export function daysWaiting(status: LabOrderStatus, statusOn: string, today: string): number | null {
  if (!isOpenLabOrder(status) || !isValidDateKey(statusOn) || !isValidDateKey(today)) return null;
  return Math.max(0, daysBetweenKeys(statusOn, today));
}
