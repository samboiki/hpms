/**
 * Spectacle and contact-lens prescriptions, per eye: reading what the optometrist types ("+1.25", "-0,5", "pl"),
 * checking it against the ranges the database accepts (proposals/2026-10-08-optometry.sql checks the same), writing
 * it the way prescriptions are written ("+1.25 / -0.50 x 90"), transposing between plus and minus cylinder, and
 * comparing a prescription with the one before it. Pure; tested in __tests__/prescription.test.ts.
 */
import { addMonthsToKey, isValidDateKey } from '../billing/dates';
import { normaliseVisualAcuity } from './visualAcuity';

export type EyeSide = 'right' | 'left';
export const EYES: readonly EyeSide[] = ['right', 'left'];
export const EYE_NAMES: Readonly<Record<EyeSide, string>> = { right: 'Right eye', left: 'Left eye' };
export const EYE_LETTERS: Readonly<Record<EyeSide, 'R' | 'L'>> = { right: 'R', left: 'L' };

export type PrismBase = 'in' | 'out' | 'up' | 'down';
export const PRISM_BASES: readonly PrismBase[] = ['in', 'out', 'up', 'down'];

export type RxKind = 'spectacles' | 'contact_lenses';
export const RX_KIND_LABELS: Readonly<Record<RxKind, string>> = { spectacles: 'Spectacles', contact_lenses: 'Contact lenses' };

/** One eye of a prescription. Dioptres; `null` = not prescribed. */
export interface EyeRx {
  /** -30 to +30 in steps of 0.25; 0 is plano */
  sphere: number;
  /** -15 to +15 in steps of 0.25; null (or 0) = no cylinder */
  cylinder: number | null;
  /** 0 to 180 degrees, with a cylinder only */
  axis: number | null;
  /** Prism dioptres, with its base */
  prism: number | null;
  base: PrismBase | null;
  /** Reading addition, +0.75 to +4.00 in steps of 0.25 */
  add: number | null;
  /** Visual acuity with this prescription, e.g. "6/6" */
  va: string | null;
  /** Contact lenses: base curve and diameter in mm */
  baseCurve: number | null;
  diameter: number | null;
}

export interface Rx {
  right: EyeRx;
  left: EyeRx;
}

/** The ranges the database accepts (optometry_prescriptions checks). */
export const RX_LIMITS = {
  sphere: { min: -30, max: 30 },
  cylinder: { min: -15, max: 15 },
  axis: { min: 0, max: 180 },
  add: { min: 0.75, max: 4 },
  prism: { min: 0.25, max: 20 },
  baseCurve: { min: 6.5, max: 10.5 },
  diameter: { min: 8, max: 20 }
} as const;

/** Months a new prescription stays valid unless the optometrist changes the date. */
export const DEFAULT_VALID_MONTHS: Readonly<Record<RxKind, number>> = { spectacles: 24, contact_lenses: 12 };

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Dioptres come in quarter steps (0.25); anything else is a typing slip. */
export const isQuarterStep = (value: number): boolean => Math.abs(value * 4 - Math.round(value * 4)) < 1e-9;

export type ParsedNumber = { ok: true; value: number | null } | { ok: false };

/**
 * A dioptre value as typed: "+1.25", "1.25", "-0,5" (a decimal comma), "−2" (a typographic minus), "pl" or "plano"
 * (0). Empty is null (not prescribed).
 */
export function parseDioptre(text: string): ParsedNumber {
  const cleaned = text.trim().replace(/[−–]/g, '-').replace(/,/g, '.').replace(/\s+/g, '');
  if (cleaned === '') return { ok: true, value: null };
  if (/^(pl|pl\.|plano)$/i.test(cleaned)) return { ok: true, value: 0 };
  if (!/^[+-]?(\d{1,2}(\.\d{1,2})?|\.\d{1,2})$/.test(cleaned)) return { ok: false };
  const value = Number(cleaned);
  return Number.isFinite(value) ? { ok: true, value: Object.is(value, -0) ? 0 : value } : { ok: false };
}

/** A plain number as typed (axis, base curve, diameter, pupil distance): decimal comma allowed; empty is null. */
export function parsePlainNumber(text: string, decimals: number): ParsedNumber {
  const cleaned = text.trim().replace(/,/g, '.').replace(/\s+/g, '');
  if (cleaned === '') return { ok: true, value: null };
  const pattern = decimals > 0 ? new RegExp(`^\\d{1,3}(\\.\\d{1,${decimals}})?$`) : /^\d{1,3}$/;
  if (!pattern.test(cleaned)) return { ok: false };
  return { ok: true, value: Number(cleaned) };
}

// ---------------------------------------------------------------------------------------------------
// The form: one eye as typed, checked
// ---------------------------------------------------------------------------------------------------

export interface EyeDraft {
  sphere: string;
  cylinder: string;
  axis: string;
  prism: string;
  base: '' | PrismBase;
  add: string;
  va: string;
  baseCurve: string;
  diameter: string;
}

export type EyeDraftErrors = Partial<Record<keyof EyeDraft, string>>;

export const emptyEyeDraft = (): EyeDraft => ({ sphere: '', cylinder: '', axis: '', prism: '', base: '', add: '', va: '', baseCurve: '', diameter: '' });

const plainText = (value: number | null, decimals = 2): string => (value === null ? '' : value.toFixed(decimals));

/** The form for an eye that is already recorded (editing starts from it). */
export function eyeDraftFrom(eye: EyeRx | null): EyeDraft {
  if (!eye) return emptyEyeDraft();
  return {
    sphere: formatDioptre(eye.sphere),
    cylinder: eye.cylinder ? formatDioptre(eye.cylinder) : '',
    axis: eye.cylinder && eye.axis !== null ? String(eye.axis) : '',
    prism: plainText(eye.prism),
    base: eye.base ?? '',
    add: eye.add ? formatDioptre(eye.add) : '',
    va: eye.va ?? '',
    baseCurve: plainText(eye.baseCurve),
    diameter: plainText(eye.diameter, 1)
  };
}

const inRange = (value: number, limits: { min: number; max: number }): boolean => value >= limits.min && value <= limits.max;

/**
 * Checks one eye. Sphere is required (type 0 or "pl" for plano) so a blank box is never read as plano by accident;
 * an axis belongs with a cylinder and a base with a prism. Contact lenses also take base curve and diameter.
 */
export function validateEyeDraft(draft: EyeDraft, kind: RxKind): { ok: true; eye: EyeRx } | { ok: false; errors: EyeDraftErrors } {
  const errors: EyeDraftErrors = {};
  /** `zeroIsNone`: 0 means "none" (no cylinder, no add), not a value to check */
  const dioptre = (field: 'sphere' | 'cylinder' | 'add', limits: { min: number; max: number }, label: string, zeroIsNone: boolean): number | null => {
    const parsed = parseDioptre(draft[field]);
    if (!parsed.ok) {
      errors[field] = `${label}: a number such as -1.25 or +0.50.`;
      return null;
    }
    if (parsed.value === null || (zeroIsNone && parsed.value === 0)) return null;
    if (!inRange(parsed.value, limits)) errors[field] = `${label}: from ${formatDioptre(limits.min)} to ${formatDioptre(limits.max)}.`;
    else if (!isQuarterStep(parsed.value)) errors[field] = `${label}: in steps of 0.25.`;
    return parsed.value;
  };

  const sphere = dioptre('sphere', RX_LIMITS.sphere, 'Sphere', false);
  if (sphere === null && !errors.sphere) errors.sphere = 'Sphere: type 0 or pl for plano.';
  const cylinder = dioptre('cylinder', RX_LIMITS.cylinder, 'Cylinder', true);

  const axisParsed = parsePlainNumber(draft.axis, 0);
  let axis: number | null = null;
  if (!axisParsed.ok) errors.axis = 'Axis: whole degrees from 0 to 180.';
  else if (axisParsed.value !== null) {
    if (!inRange(axisParsed.value, RX_LIMITS.axis)) errors.axis = 'Axis: whole degrees from 0 to 180.';
    else if (cylinder === null && !errors.cylinder) errors.axis = 'An axis goes with a cylinder: type the cylinder, or clear the axis.';
    axis = axisParsed.value;
  }
  if (cylinder !== null && axis === null && !errors.axis) errors.axis = 'Axis: the cylinder needs its axis (0 to 180).';

  const prismParsed = parsePlainNumber(draft.prism, 2);
  let prism: number | null = null;
  const prismRange = `Prism: from ${RX_LIMITS.prism.min.toFixed(2)} to ${RX_LIMITS.prism.max.toFixed(2)}.`;
  if (!prismParsed.ok) errors.prism = prismRange;
  else if (prismParsed.value !== null && prismParsed.value !== 0) {
    if (!inRange(prismParsed.value, RX_LIMITS.prism)) errors.prism = prismRange;
    else if (!isQuarterStep(prismParsed.value)) errors.prism = 'Prism: in steps of 0.25.';
    prism = prismParsed.value;
  }
  const base = draft.base || null;
  if (prism !== null && base === null) errors.base = 'Choose the base of the prism.';
  if (prism === null && base !== null && !errors.prism) errors.base = 'A base goes with a prism: type the prism, or clear the base.';

  const add = dioptre('add', RX_LIMITS.add, 'Add', true);

  const va = draft.va.trim() ? normaliseVisualAcuity(draft.va) : null;
  if (draft.va.trim() && va === null) errors.va = 'Vision: e.g. 6/6, 6/9+2, 20/20, 1.0, CF, HM, LP or NLP.';

  let baseCurve: number | null = null;
  let diameter: number | null = null;
  if (kind === 'contact_lenses') {
    const bc = parsePlainNumber(draft.baseCurve, 2);
    if (!bc.ok || (bc.value !== null && !inRange(bc.value, RX_LIMITS.baseCurve))) {
      errors.baseCurve = `Base curve: ${RX_LIMITS.baseCurve.min} to ${RX_LIMITS.baseCurve.max} mm.`;
    } else baseCurve = bc.value;
    const dia = parsePlainNumber(draft.diameter, 2);
    if (!dia.ok || (dia.value !== null && !inRange(dia.value, RX_LIMITS.diameter))) {
      errors.diameter = `Diameter: ${RX_LIMITS.diameter.min} to ${RX_LIMITS.diameter.max} mm.`;
    } else diameter = dia.value;
    if (prism !== null) errors.prism = 'Contact lenses take no prism.';
  }

  if (Object.keys(errors).length > 0 || sphere === null) return { ok: false, errors };
  return { ok: true, eye: { sphere, cylinder, axis: cylinder === null ? null : axis, prism, base: prism === null ? null : base, add, va, baseCurve, diameter } };
}

/** Both eyes as typed */
export interface RxDraft {
  right: EyeDraft;
  left: EyeDraft;
}

export type RxDraftErrors = { right?: EyeDraftErrors; left?: EyeDraftErrors };

export const emptyRxDraft = (): RxDraft => ({ right: emptyEyeDraft(), left: emptyEyeDraft() });
export const rxDraftFrom = (rx: Rx | null): RxDraft => ({ right: eyeDraftFrom(rx?.right ?? null), left: eyeDraftFrom(rx?.left ?? null) });

/** Nothing typed for either eye: the exam is saved without this prescription. */
export const isEmptyRxDraft = (draft: RxDraft): boolean =>
  EYES.every(side => Object.values(draft[side]).every(value => String(value).trim() === ''));

/** Checks both eyes; a prescription always has both (type 0 or pl for a plano or balance eye). */
export function validateRxDraft(draft: RxDraft, kind: RxKind): { ok: true; rx: Rx } | { ok: false; errors: RxDraftErrors } {
  const right = validateEyeDraft(draft.right, kind);
  const left = validateEyeDraft(draft.left, kind);
  if (right.ok && left.ok) return { ok: true, rx: { right: right.eye, left: left.eye } };
  return { ok: false, errors: { right: right.ok ? undefined : right.errors, left: left.ok ? undefined : left.errors } };
}

// ---------------------------------------------------------------------------------------------------
// Writing a prescription down
// ---------------------------------------------------------------------------------------------------

/** "+1.25", "-0.50", "0.00" (or "Plano" when asked) */
export function formatDioptre(value: number, options: { plano?: boolean } = {}): string {
  const rounded = round2(value);
  if (rounded === 0) return options.plano ? 'Plano' : '0.00';
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded).toFixed(2)}`;
}

export const PRISM_BASE_LABELS: Readonly<Record<PrismBase, string>> = { in: 'base in', out: 'base out', up: 'base up', down: 'base down' };

/** One eye in a line, as written on a prescription: "-1.25 / -0.50 x 90, prism 1.00 base in, add +2.00". */
export function eyeSummary(eye: EyeRx): string {
  const parts: string[] = [];
  if (eye.cylinder) {
    parts.push(`${formatDioptre(eye.sphere, { plano: true })} / ${formatDioptre(eye.cylinder)} x ${eye.axis ?? '?'}`);
  } else {
    parts.push(eye.sphere === 0 ? 'Plano' : `${formatDioptre(eye.sphere)} DS`);
  }
  if (eye.prism && eye.base) parts.push(`prism ${eye.prism.toFixed(2)} ${PRISM_BASE_LABELS[eye.base]}`);
  if (eye.add) parts.push(`add ${formatDioptre(eye.add)}`);
  return parts.join(', ');
}

// ---------------------------------------------------------------------------------------------------
// Transposition, spherical equivalent, comparison
// ---------------------------------------------------------------------------------------------------

export type CylinderForm = 'minus' | 'plus';

/**
 * The same correction written with the other cylinder sign: sphere + cylinder, the cylinder's sign changed and the
 * axis turned 90 degrees. Labs and practices differ in the form they use, so staff must be able to switch without
 * changing what the patient sees through the lens.
 */
export function transposeEye(eye: EyeRx): EyeRx {
  if (!eye.cylinder) return eye;
  const axis = eye.axis === null ? null : eye.axis <= 90 ? eye.axis + 90 : eye.axis - 90;
  return { ...eye, sphere: round2(eye.sphere + eye.cylinder), cylinder: round2(-eye.cylinder), axis };
}

/** The eye in minus- or plus-cylinder form (unchanged when it already is, or has no cylinder). */
export function inCylinderForm(eye: EyeRx, form: CylinderForm): EyeRx {
  if (!eye.cylinder) return eye;
  return (form === 'minus') === eye.cylinder < 0 ? eye : transposeEye(eye);
}

export const rxInCylinderForm = (rx: Rx, form: CylinderForm): Rx => ({ right: inCylinderForm(rx.right, form), left: inCylinderForm(rx.left, form) });

/** Sphere plus half the cylinder: the one number that says how short- or long-sighted an eye is. */
export const sphericalEquivalent = (eye: Pick<EyeRx, 'sphere' | 'cylinder'>): number => round2(eye.sphere + (eye.cylinder ?? 0) / 2);

export interface EyeChange {
  sphere: number;
  cylinder: number;
  /** Signed degrees, -89 to 90; null when either eye has no cylinder */
  axis: number | null;
  add: number;
  sphericalEquivalent: number;
}

/** Axis turn between two cylinders: axes 5 and 175 are 10 degrees apart, not 170. */
export function axisDifference(previous: number, current: number): number {
  const turn = (((current - previous) % 180) + 180) % 180;
  return turn > 90 ? turn - 180 : turn;
}

/** How one eye changed, both written in minus cylinder so a transposed prescription does not look like a change. */
export function compareEye(previous: EyeRx, current: EyeRx): EyeChange {
  const before = inCylinderForm(previous, 'minus');
  const now = inCylinderForm(current, 'minus');
  return {
    sphere: round2(now.sphere - before.sphere),
    cylinder: round2((now.cylinder ?? 0) - (before.cylinder ?? 0)),
    axis: before.cylinder && now.cylinder && before.axis !== null && now.axis !== null ? axisDifference(before.axis, now.axis) : null,
    add: round2((now.add ?? 0) - (before.add ?? 0)),
    sphericalEquivalent: round2(sphericalEquivalent(now) - sphericalEquivalent(before))
  };
}

export const isNoChange = (change: EyeChange): boolean =>
  change.sphere === 0 && change.cylinder === 0 && (change.axis ?? 0) === 0 && change.add === 0;

/** "Sphere -0.50, axis 10 degrees" or "No change". */
export function describeChange(change: EyeChange): string {
  if (isNoChange(change)) return 'No change';
  const parts: string[] = [];
  if (change.sphere !== 0) parts.push(`sphere ${formatDioptre(change.sphere)}`);
  if (change.cylinder !== 0) parts.push(`cylinder ${formatDioptre(change.cylinder)}`);
  if (change.axis) parts.push(`axis ${change.axis > 0 ? '+' : ''}${change.axis} degrees`);
  if (change.add !== 0) parts.push(`add ${formatDioptre(change.add)}`);
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const hasReadingAddition = (rx: Rx): boolean => Boolean(rx.right.add || rx.left.add);

// ---------------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------------

/** Spectacle prescriptions are given for two years and contact lenses for one, unless the optometrist says otherwise. */
export function defaultValidUntil(kind: RxKind, prescribedOn: string): string {
  return addMonthsToKey(prescribedOn, DEFAULT_VALID_MONTHS[kind]);
}

export const isExpired = (validUntil: string | null, today: string): boolean =>
  validUntil !== null && isValidDateKey(validUntil) && validUntil < today;
