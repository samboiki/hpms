/**
 * The full eye exam's other parts: the case history (why the patient came, symptoms, health, eye and family history,
 * what they use their eyes for), keratometry (the cornea's curvature), ocular health (front and back of the eye, with
 * the cup-to-disc ratio) and the contact-lens fit (lens type, how each lens sits, over-refraction, vision with the
 * lenses). The database checks the same (optometry_exams in proposals/2026-10-13-optometry-frames-and-exam.sql).
 * Pure; tested in __tests__/examParts.test.ts.
 */
import { normaliseVisualAcuity } from './visualAcuity';
import { EYES, EYE_LETTERS, formatDioptre, isQuarterStep, parseDioptre, parsePlainNumber, type EyeSide } from './prescription';

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const listOf = <T extends string>(value: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(value) ? allowed.filter(entry => (value as unknown[]).includes(entry)) : [];
const objectOf = (value: unknown): Row | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : null);

// ---------------------------------------------------------------------------------------------------
// Case history
// ---------------------------------------------------------------------------------------------------

export const SYMPTOMS = [
  'blur_distance',
  'blur_near',
  'headaches',
  'eye_strain',
  'dry_eyes',
  'red_itchy',
  'flashes_floaters',
  'double_vision',
  'night_glare',
  'pain'
] as const;
export type Symptom = (typeof SYMPTOMS)[number];
export const SYMPTOM_LABELS: Readonly<Record<Symptom, string>> = {
  blur_distance: 'Blurred distance vision',
  blur_near: 'Blurred near vision',
  headaches: 'Headaches',
  eye_strain: 'Tired or strained eyes',
  dry_eyes: 'Dry or gritty eyes',
  red_itchy: 'Red or itchy eyes',
  flashes_floaters: 'Flashes or floaters',
  double_vision: 'Double vision',
  night_glare: 'Glare or poor night vision',
  pain: 'Eye pain'
};

/** Health conditions that change what the optometrist looks for (diabetes and blood pressure affect the retina) */
export const HEALTH_FLAGS = ['diabetes', 'high_blood_pressure', 'thyroid', 'pregnant'] as const;
export type HealthFlag = (typeof HEALTH_FLAGS)[number];
export const HEALTH_FLAG_LABELS: Readonly<Record<HealthFlag, string>> = {
  diabetes: 'Diabetes',
  high_blood_pressure: 'High blood pressure',
  thyroid: 'Thyroid disease',
  pregnant: 'Pregnant'
};

/** Eye conditions in the family that raise the patient's own risk */
export const FAMILY_FLAGS = ['glaucoma', 'macular_degeneration', 'cataract', 'squint', 'blindness'] as const;
export type FamilyFlag = (typeof FAMILY_FLAGS)[number];
export const FAMILY_FLAG_LABELS: Readonly<Record<FamilyFlag, string>> = {
  glaucoma: 'Glaucoma',
  macular_degeneration: 'Macular degeneration',
  cataract: 'Cataract',
  squint: 'Squint or lazy eye',
  blindness: 'Blindness'
};

/** Longest texts, the same as the database's checks */
export const HISTORY_LIMITS = { reason: 200, lastTest: 60, healthNote: 500, eye: 500, needs: 300 } as const;

export interface CaseHistory {
  reason: string | null;
  lastTest: string | null;
  symptoms: Symptom[];
  health: HealthFlag[];
  healthNote: string | null;
  eye: string | null;
  family: FamilyFlag[];
  needs: string | null;
}

export interface HistoryDraft {
  reason: string;
  lastTest: string;
  symptoms: Symptom[];
  health: HealthFlag[];
  healthNote: string;
  eye: string;
  family: FamilyFlag[];
  needs: string;
}

export type HistoryErrors = Partial<Record<'reason' | 'lastTest' | 'healthNote' | 'eye' | 'needs', string>>;

export const emptyHistoryDraft = (): HistoryDraft => ({ reason: '', lastTest: '', symptoms: [], health: [], healthNote: '', eye: '', family: [], needs: '' });

export const emptyCaseHistory = (): CaseHistory => ({ reason: null, lastTest: null, symptoms: [], health: [], healthNote: null, eye: null, family: [], needs: null });

export const historyFromRow = (row: Row): CaseHistory => ({
  reason: text(row.history_reason),
  lastTest: text(row.history_last_test),
  symptoms: listOf(row.history_symptoms, SYMPTOMS),
  health: listOf(row.history_health, HEALTH_FLAGS),
  healthNote: text(row.history_health_note),
  eye: text(row.history_eye),
  family: listOf(row.history_family, FAMILY_FLAGS),
  needs: text(row.history_needs)
});

export const historyDraftFrom = (history: CaseHistory): HistoryDraft => ({
  reason: history.reason ?? '',
  lastTest: history.lastTest ?? '',
  symptoms: [...history.symptoms],
  health: [...history.health],
  healthNote: history.healthNote ?? '',
  eye: history.eye ?? '',
  family: [...history.family],
  needs: history.needs ?? ''
});

/** Ticks or unticks one choice of a chip list, keeping the list's own order (so a saved list compares equal) */
export function toggleChoice<T extends string>(chosen: readonly T[], value: T, order: readonly T[]): T[] {
  const next = chosen.includes(value) ? chosen.filter(entry => entry !== value) : [...chosen, value];
  return order.filter(entry => next.includes(entry));
}

const hasHistory = (draft: HistoryDraft): boolean =>
  draft.symptoms.length > 0 || draft.health.length > 0 || draft.family.length > 0 ||
  [draft.reason, draft.lastTest, draft.healthNote, draft.eye, draft.needs].some(value => value.trim() !== '');

export function validateHistory(draft: HistoryDraft): { ok: true; payload: Row; filled: boolean } | { ok: false; errors: HistoryErrors } {
  const errors: HistoryErrors = {};
  const long = (field: keyof HistoryErrors, limit: number, what: string) => {
    if (draft[field].trim().length > limit) errors[field] = `Keep ${what} to ${limit} characters.`;
  };
  long('reason', HISTORY_LIMITS.reason, 'the reason');
  long('lastTest', HISTORY_LIMITS.lastTest, 'the last eye test');
  long('healthNote', HISTORY_LIMITS.healthNote, 'the health notes');
  long('eye', HISTORY_LIMITS.eye, 'the eye history');
  long('needs', HISTORY_LIMITS.needs, 'what the eyes are used for');
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const list = <T extends string>(values: readonly T[], order: readonly T[]) => {
    const kept = order.filter(entry => values.includes(entry));
    return kept.length > 0 ? kept : null;
  };
  return {
    ok: true,
    filled: hasHistory(draft),
    payload: {
      history_reason: draft.reason.trim() || null,
      history_last_test: draft.lastTest.trim() || null,
      history_symptoms: list(draft.symptoms, SYMPTOMS),
      history_health: list(draft.health, HEALTH_FLAGS),
      history_health_note: draft.healthNote.trim() || null,
      history_eye: draft.eye.trim() || null,
      history_family: list(draft.family, FAMILY_FLAGS),
      history_needs: draft.needs.trim() || null
    }
  };
}

/** One line for the exam list: the reason, then what the patient complained of */
export function historySummary(history: CaseHistory): string | null {
  const parts = [history.reason, ...history.symptoms.map(symptom => SYMPTOM_LABELS[symptom].toLowerCase())].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  const line = parts.join(', ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

// ---------------------------------------------------------------------------------------------------
// Keratometry
// ---------------------------------------------------------------------------------------------------

/** Corneal power in dioptres, and the radius in mm a keratometer may show instead (D = 337.5 / r) */
export const K_LIMITS = { dioptres: { min: 30, max: 60 }, mm: { min: 5.63, max: 11.25 } } as const;
const KERATOMETRIC_INDEX = 337.5;

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const mmToDioptres = (radius: number): number => round2(KERATOMETRIC_INDEX / radius);
export const dioptresToMm = (power: number): number => round2(KERATOMETRIC_INDEX / power);

export type KParse = { ok: true; dioptres: number | null; fromMm: boolean } | { ok: false };

/**
 * A K reading as typed: dioptres ("43.25", "43,25 D") or the radius in mm ("7.80", "7.8 mm"). The two ranges do not
 * overlap (5.6 to 11.3 mm is 60 to 30 D), so the number says which it is. Kept in dioptres.
 */
export function parseKReading(input: string): KParse {
  const cleaned = input.trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, '');
  if (cleaned === '') return { ok: true, dioptres: null, fromMm: false };
  const match = /^(\d{1,2}(?:\.\d{1,3})?)(mm|d)?$/.exec(cleaned);
  if (!match) return { ok: false };
  const value = Number(match[1]);
  const unit = match[2] ?? (value >= K_LIMITS.mm.min && value <= K_LIMITS.mm.max ? 'mm' : 'd');
  if (unit === 'mm') {
    if (value < K_LIMITS.mm.min || value > K_LIMITS.mm.max) return { ok: false };
    return { ok: true, dioptres: mmToDioptres(value), fromMm: true };
  }
  if (value < K_LIMITS.dioptres.min || value > K_LIMITS.dioptres.max) return { ok: false };
  return { ok: true, dioptres: round2(value), fromMm: false };
}

export interface KReading {
  /** The flatter meridian (the lower power), dioptres, and its axis */
  flat: number;
  flatAxis: number;
  steep: number;
  steepAxis: number;
}

export interface KEyeDraft {
  flat: string;
  flatAxis: string;
  steep: string;
  steepAxis: string;
}

export type KEyeErrors = Partial<Record<keyof KEyeDraft, string>>;
export type KeratometryDraft = Record<EyeSide, KEyeDraft>;
export type KeratometryErrors = Partial<Record<EyeSide, KEyeErrors>>;
export type Keratometry = Record<EyeSide, KReading | null>;

export const emptyKEyeDraft = (): KEyeDraft => ({ flat: '', flatAxis: '', steep: '', steepAxis: '' });
export const emptyKeratometryDraft = (): KeratometryDraft => ({ right: emptyKEyeDraft(), left: emptyKEyeDraft() });

const kFromRow = (row: Row, side: 'r' | 'l'): KReading | null => {
  const flat = num(row[`k_${side}_flat`]);
  const steep = num(row[`k_${side}_steep`]);
  const flatAxis = num(row[`k_${side}_flat_axis`]);
  const steepAxis = num(row[`k_${side}_steep_axis`]);
  return flat === null || steep === null || flatAxis === null || steepAxis === null ? null : { flat, flatAxis, steep, steepAxis };
};

export const keratometryFromRow = (row: Row): Keratometry => ({ right: kFromRow(row, 'r'), left: kFromRow(row, 'l') });

export const keratometryDraftFrom = (keratometry: Keratometry): KeratometryDraft => {
  const eye = (reading: KReading | null): KEyeDraft =>
    reading
      ? { flat: reading.flat.toFixed(2), flatAxis: String(reading.flatAxis), steep: reading.steep.toFixed(2), steepAxis: String(reading.steepAxis) }
      : emptyKEyeDraft();
  return { right: eye(keratometry.right), left: eye(keratometry.left) };
};

const isEmptyKEye = (draft: KEyeDraft): boolean => Object.values(draft).every(value => value.trim() === '');

/** Checks one eye: all four boxes or none, the flat reading the lower power, axes in whole degrees 0 to 180. */
export function validateKEye(draft: KEyeDraft): { ok: true; reading: KReading | null } | { ok: false; errors: KEyeErrors } {
  if (isEmptyKEye(draft)) return { ok: true, reading: null };
  const errors: KEyeErrors = {};
  const power = (field: 'flat' | 'steep'): number | null => {
    const parsed = parseKReading(draft[field]);
    if (!parsed.ok) {
      errors[field] = `Dioptres ${K_LIMITS.dioptres.min} to ${K_LIMITS.dioptres.max}, or the radius in mm.`;
      return null;
    }
    if (parsed.dioptres === null) errors[field] = 'Type both readings of this eye.';
    return parsed.dioptres;
  };
  const axis = (field: 'flatAxis' | 'steepAxis'): number | null => {
    const parsed = parsePlainNumber(draft[field], 0);
    if (!parsed.ok || parsed.value === null || parsed.value > 180) {
      errors[field] = 'Axis: whole degrees from 0 to 180.';
      return null;
    }
    return parsed.value;
  };
  const flat = power('flat');
  const steep = power('steep');
  const flatAxis = axis('flatAxis');
  const steepAxis = axis('steepAxis');
  if (flat !== null && steep !== null && flat > steep) errors.flat = 'The flat reading is the lower power: swap the two.';
  if (Object.keys(errors).length > 0 || flat === null || steep === null || flatAxis === null || steepAxis === null) return { ok: false, errors };
  return { ok: true, reading: { flat, flatAxis, steep, steepAxis } };
}

export function validateKeratometry(draft: KeratometryDraft): { ok: true; payload: Row; filled: boolean } | { ok: false; errors: KeratometryErrors } {
  const right = validateKEye(draft.right);
  const left = validateKEye(draft.left);
  if (!right.ok || !left.ok) return { ok: false, errors: { right: right.ok ? undefined : right.errors, left: left.ok ? undefined : left.errors } };
  const columns = (side: 'r' | 'l', reading: KReading | null): Row => ({
    [`k_${side}_flat`]: reading?.flat ?? null,
    [`k_${side}_flat_axis`]: reading?.flatAxis ?? null,
    [`k_${side}_steep`]: reading?.steep ?? null,
    [`k_${side}_steep_axis`]: reading?.steepAxis ?? null
  });
  return { ok: true, filled: right.reading !== null || left.reading !== null, payload: { ...columns('r', right.reading), ...columns('l', left.reading) } };
}

/** The cornea's own astigmatism: the difference between the two readings, at the steep axis */
export const cornealCylinder = (reading: KReading): { power: number; axis: number } => ({ power: round2(reading.steep - reading.flat), axis: reading.steepAxis });

/** "43.25 @ 180 / 44.50 @ 90 (corneal cylinder 1.25 @ 90)" */
export function kSummary(reading: KReading): string {
  const cylinder = cornealCylinder(reading);
  const base = `${reading.flat.toFixed(2)} @ ${reading.flatAxis} / ${reading.steep.toFixed(2)} @ ${reading.steepAxis}`;
  return cylinder.power > 0 ? `${base} (corneal cylinder ${cylinder.power.toFixed(2)} @ ${cylinder.axis})` : `${base} (spherical)`;
}

/** "R 43.25 @ 180 / 44.50 @ 90 · L ..." for the exam list */
export function keratometrySummary(keratometry: Keratometry): string | null {
  const parts = EYES.flatMap(side => {
    const reading = keratometry[side];
    return reading ? [`${EYE_LETTERS[side]} ${reading.flat.toFixed(2)} @ ${reading.flatAxis} / ${reading.steep.toFixed(2)} @ ${reading.steepAxis}`] : [];
  });
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ---------------------------------------------------------------------------------------------------
// Ocular health
// ---------------------------------------------------------------------------------------------------

export const FRONT_STRUCTURES = ['lids', 'conjunctiva', 'cornea', 'anterior_chamber', 'iris', 'lens'] as const;
export const BACK_STRUCTURES = ['vitreous', 'disc', 'macula', 'vessels', 'periphery'] as const;
export const STRUCTURES = [...FRONT_STRUCTURES, ...BACK_STRUCTURES] as const;
export type Structure = (typeof STRUCTURES)[number];
export type EyePart = 'front' | 'back';
export const PART_STRUCTURES: Readonly<Record<EyePart, readonly Structure[]>> = { front: FRONT_STRUCTURES, back: BACK_STRUCTURES };
export const PART_LABELS: Readonly<Record<EyePart, string>> = { front: 'Front of the eye', back: 'Back of the eye' };

export const STRUCTURE_LABELS: Readonly<Record<Structure, string>> = {
  lids: 'Lids and lashes',
  conjunctiva: 'Conjunctiva',
  cornea: 'Cornea',
  anterior_chamber: 'Anterior chamber',
  iris: 'Iris and pupil',
  lens: 'Lens',
  vitreous: 'Vitreous',
  disc: 'Optic disc',
  macula: 'Macula',
  vessels: 'Blood vessels',
  periphery: 'Peripheral retina'
};

export type Finding = 'normal' | 'abnormal';
export const FINDING_LABELS: Readonly<Record<Finding, string>> = { normal: 'Normal', abnormal: 'Abnormal' };

export type FundusMethod = 'direct' | 'slit_lamp' | 'photo' | 'other';
export const FUNDUS_METHODS: readonly FundusMethod[] = ['direct', 'slit_lamp', 'photo', 'other'];
export const FUNDUS_METHOD_LABELS: Readonly<Record<FundusMethod, string>> = {
  direct: 'Direct ophthalmoscope',
  slit_lamp: 'Slit lamp with a lens',
  photo: 'Retinal photo',
  other: 'Other'
};

export const FINDING_NOTE_LIMIT = 200;
/** The cup-to-disc ratio of the optic nerve head: 0 to 1, two decimals */
export const CD_LIMITS = { min: 0, max: 1 } as const;

export interface StructureFinding {
  right: Finding | null;
  left: Finding | null;
  note: string | null;
}

export interface OcularHealth {
  findings: Partial<Record<Structure, StructureFinding>>;
  cdRight: number | null;
  cdLeft: number | null;
  fundusMethod: FundusMethod | null;
  dilated: boolean | null;
}

export interface StructureDraft {
  right: Finding | '';
  left: Finding | '';
  note: string;
}

export interface OcularDraft {
  findings: Record<Structure, StructureDraft>;
  cdRight: string;
  cdLeft: string;
  fundusMethod: FundusMethod | '';
  dilated: boolean;
}

export interface OcularErrors {
  findings?: Partial<Record<Structure, string>>;
  cdRight?: string;
  cdLeft?: string;
}

const emptyStructure = (): StructureDraft => ({ right: '', left: '', note: '' });

export const emptyOcularDraft = (): OcularDraft => ({
  findings: Object.fromEntries(STRUCTURES.map(structure => [structure, emptyStructure()])) as Record<Structure, StructureDraft>,
  cdRight: '',
  cdLeft: '',
  fundusMethod: '',
  dilated: false
});

export const emptyOcularHealth = (): OcularHealth => ({ findings: {}, cdRight: null, cdLeft: null, fundusMethod: null, dilated: null });

const findingOf = (value: unknown): Finding | null => (value === 'normal' || value === 'abnormal' ? value : null);

export function ocularFromRow(row: Row): OcularHealth {
  const stored = objectOf(row.ocular_health) ?? {};
  const findings: Partial<Record<Structure, StructureFinding>> = {};
  for (const structure of STRUCTURES) {
    const entry = objectOf(stored[structure]);
    if (!entry) continue;
    const finding = { right: findingOf(entry.r), left: findingOf(entry.l), note: text(entry.note) };
    if (finding.right || finding.left || finding.note) findings[structure] = finding;
  }
  return {
    findings,
    cdRight: num(row.cd_ratio_r),
    cdLeft: num(row.cd_ratio_l),
    fundusMethod: FUNDUS_METHODS.includes(row.fundus_method as FundusMethod) ? (row.fundus_method as FundusMethod) : null,
    dilated: typeof row.dilated === 'boolean' ? row.dilated : null
  };
}

export function ocularDraftFrom(health: OcularHealth): OcularDraft {
  const draft = emptyOcularDraft();
  for (const structure of STRUCTURES) {
    const finding = health.findings[structure];
    if (finding) draft.findings[structure] = { right: finding.right ?? '', left: finding.left ?? '', note: finding.note ?? '' };
  }
  return {
    ...draft,
    cdRight: health.cdRight === null ? '' : health.cdRight.toFixed(2),
    cdLeft: health.cdLeft === null ? '' : health.cdLeft.toFixed(2),
    fundusMethod: health.fundusMethod ?? '',
    dilated: health.dilated === true
  };
}

/** "All normal": every structure of the part that has nothing recorded becomes normal in both eyes (findings stay). */
export function markPartNormal(draft: OcularDraft, part: EyePart): OcularDraft {
  const findings = { ...draft.findings };
  for (const structure of PART_STRUCTURES[part]) {
    const current = findings[structure];
    findings[structure] = { ...current, right: current.right || 'normal', left: current.left || 'normal' };
  }
  return { ...draft, findings };
}

/** A ratio as typed: "0.3", ".35", "0,4"; empty is null */
export function parseRatio(input: string): { ok: true; value: number | null } | { ok: false } {
  const cleaned = input.trim().replace(/,/g, '.');
  if (cleaned === '') return { ok: true, value: null };
  if (!/^(0?\.\d{1,2}|0|1|1\.0{1,2}|0\.0{1,2})$/.test(cleaned)) return { ok: false };
  return { ok: true, value: Number(cleaned.startsWith('.') ? `0${cleaned}` : cleaned) };
}

export function validateOcular(draft: OcularDraft): { ok: true; payload: Row; filled: boolean } | { ok: false; errors: OcularErrors } {
  const errors: OcularErrors = {};
  const findings: Row = {};
  for (const structure of STRUCTURES) {
    const entry = draft.findings[structure];
    const note = entry.note.trim();
    const abnormal = entry.right === 'abnormal' || entry.left === 'abnormal';
    if (note.length > FINDING_NOTE_LIMIT) (errors.findings ??= {})[structure] = `Keep the note to ${FINDING_NOTE_LIMIT} characters.`;
    else if (abnormal && !note) (errors.findings ??= {})[structure] = 'Say what you saw.';
    if (!entry.right && !entry.left) continue;
    findings[structure] = {
      ...(entry.right ? { r: entry.right } : {}),
      ...(entry.left ? { l: entry.left } : {}),
      // A note belongs with an abnormal finding; with "normal" in both eyes it is dropped
      ...(abnormal && note ? { note } : {})
    };
  }
  const ratio = (field: 'cdRight' | 'cdLeft'): number | null => {
    const parsed = parseRatio(draft[field]);
    if (!parsed.ok) {
      errors[field] = 'A ratio from 0 to 1, e.g. 0.3.';
      return null;
    }
    return parsed.value;
  };
  const cdRight = ratio('cdRight');
  const cdLeft = ratio('cdLeft');
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const recorded = Object.keys(findings).length > 0;
  return {
    ok: true,
    filled: recorded || cdRight !== null || cdLeft !== null || draft.fundusMethod !== '' || draft.dilated,
    payload: {
      ocular_health: recorded ? findings : null,
      cd_ratio_r: cdRight,
      cd_ratio_l: cdLeft,
      fundus_method: draft.fundusMethod || null,
      dilated: draft.dilated ? true : null
    }
  };
}

/** "All normal", "Not examined", or "Abnormal: cornea (R), lens (R, L)"; for one part of the eye */
export function partSummary(findings: OcularHealth['findings'] | OcularDraft['findings'], part: EyePart): string {
  const recorded = PART_STRUCTURES[part].filter(structure => {
    const finding = findings[structure];
    return Boolean(finding && (finding.right || finding.left));
  });
  if (recorded.length === 0) return 'Not examined';
  const abnormal = recorded.flatMap(structure => {
    const finding = findings[structure];
    const eyes = EYES.filter(side => finding?.[side] === 'abnormal').map(side => EYE_LETTERS[side]);
    return eyes.length > 0 ? [`${STRUCTURE_LABELS[structure].toLowerCase()} (${eyes.join(', ')})`] : [];
  });
  if (abnormal.length > 0) return `Abnormal: ${abnormal.join(', ')}`;
  return recorded.length === PART_STRUCTURES[part].length ? 'All normal' : 'Normal where examined';
}

// ---------------------------------------------------------------------------------------------------
// Contact-lens fit
// ---------------------------------------------------------------------------------------------------

export type ClLensType = 'soft' | 'toric' | 'multifocal' | 'rgp' | 'scleral' | 'other';
export const CL_LENS_TYPES: readonly ClLensType[] = ['soft', 'toric', 'multifocal', 'rgp', 'scleral', 'other'];
export const CL_LENS_TYPE_LABELS: Readonly<Record<ClLensType, string>> = {
  soft: 'Soft',
  toric: 'Soft toric',
  multifocal: 'Multifocal',
  rgp: 'Rigid (RGP)',
  scleral: 'Scleral',
  other: 'Other'
};

export const FIT_ASPECTS = ['centration', 'movement', 'coverage', 'comfort'] as const;
export type FitAspect = (typeof FIT_ASPECTS)[number];
export const FIT_ASPECT_LABELS: Readonly<Record<FitAspect, string>> = {
  centration: 'Centration',
  movement: 'Movement',
  coverage: 'Coverage',
  comfort: 'Comfort'
};
export const FIT_VALUES: Readonly<Record<FitAspect, readonly string[]>> = {
  centration: ['centred', 'decentred'],
  movement: ['good', 'tight', 'loose'],
  coverage: ['full', 'partial'],
  comfort: ['good', 'fair', 'poor']
};
export const FIT_VALUE_LABELS: Readonly<Record<FitAspect, Readonly<Record<string, string>>>> = {
  centration: { centred: 'Centred', decentred: 'Off centre' },
  movement: { good: 'Good', tight: 'Too tight', loose: 'Too loose' },
  coverage: { full: 'Covers the cornea', partial: 'Partly' },
  comfort: { good: 'Comfortable', fair: 'Some awareness', poor: 'Uncomfortable' }
};
/** The over-refraction through the lens: dioptres in quarter steps */
export const OVER_REFRACTION_LIMITS = { min: -10, max: 10 } as const;

export type EyeFit = Partial<Record<FitAspect, string>>;

export interface ClFit {
  lensType: ClLensType | null;
  right: EyeFit;
  left: EyeFit;
  overRight: number | null;
  overLeft: number | null;
  vaRight: string | null;
  vaLeft: string | null;
}

export interface ClFitDraft {
  lensType: ClLensType | '';
  right: Record<FitAspect, string>;
  left: Record<FitAspect, string>;
  overRight: string;
  overLeft: string;
  vaRight: string;
  vaLeft: string;
}

export type ClFitErrors = Partial<Record<'overRight' | 'overLeft' | 'vaRight' | 'vaLeft', string>>;

const emptyEyeFit = (): Record<FitAspect, string> => ({ centration: '', movement: '', coverage: '', comfort: '' });
export const emptyClFitDraft = (): ClFitDraft => ({ lensType: '', right: emptyEyeFit(), left: emptyEyeFit(), overRight: '', overLeft: '', vaRight: '', vaLeft: '' });
export const emptyClFit = (): ClFit => ({ lensType: null, right: {}, left: {}, overRight: null, overLeft: null, vaRight: null, vaLeft: null });

const eyeFitOf = (value: unknown): EyeFit => {
  const stored = objectOf(value) ?? {};
  const fit: EyeFit = {};
  for (const aspect of FIT_ASPECTS) {
    if (FIT_VALUES[aspect].includes(stored[aspect] as string)) fit[aspect] = stored[aspect] as string;
  }
  return fit;
};

export function clFitFromRow(row: Row): ClFit {
  const stored = objectOf(row.cl_fit) ?? {};
  return {
    lensType: CL_LENS_TYPES.includes(row.cl_lens_type as ClLensType) ? (row.cl_lens_type as ClLensType) : null,
    right: eyeFitOf(stored.r),
    left: eyeFitOf(stored.l),
    overRight: num(row.cl_over_r),
    overLeft: num(row.cl_over_l),
    vaRight: text(row.cl_va_r),
    vaLeft: text(row.cl_va_l)
  };
}

export const clFitDraftFrom = (fit: ClFit): ClFitDraft => ({
  lensType: fit.lensType ?? '',
  right: { ...emptyEyeFit(), ...fit.right },
  left: { ...emptyEyeFit(), ...fit.left },
  overRight: fit.overRight === null ? '' : formatDioptre(fit.overRight),
  overLeft: fit.overLeft === null ? '' : formatDioptre(fit.overLeft),
  vaRight: fit.vaRight ?? '',
  vaLeft: fit.vaLeft ?? ''
});

export function validateClFit(draft: ClFitDraft): { ok: true; payload: Row; filled: boolean } | { ok: false; errors: ClFitErrors } {
  const errors: ClFitErrors = {};
  const over = (field: 'overRight' | 'overLeft'): number | null => {
    const parsed = parseDioptre(draft[field]);
    if (!parsed.ok || (parsed.value !== null && (parsed.value < OVER_REFRACTION_LIMITS.min || parsed.value > OVER_REFRACTION_LIMITS.max || !isQuarterStep(parsed.value)))) {
      errors[field] = 'Over-refraction: -10.00 to +10.00 in steps of 0.25.';
      return null;
    }
    return parsed.value;
  };
  const va = (field: 'vaRight' | 'vaLeft'): string | null => {
    const typed = draft[field].trim();
    if (!typed) return null;
    const normalised = normaliseVisualAcuity(typed);
    if (normalised === null) errors[field] = 'E.g. 6/6, 6/9+2, 20/20, 1.0, CF, HM, LP or NLP.';
    return normalised;
  };
  const overRight = over('overRight');
  const overLeft = over('overLeft');
  const vaRight = va('vaRight');
  const vaLeft = va('vaLeft');
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const eye = (fit: Record<FitAspect, string>): EyeFit =>
    Object.fromEntries(FIT_ASPECTS.filter(aspect => FIT_VALUES[aspect].includes(fit[aspect])).map(aspect => [aspect, fit[aspect]]));
  const right = eye(draft.right);
  const left = eye(draft.left);
  const fitted = Object.keys(right).length > 0 || Object.keys(left).length > 0;
  return {
    ok: true,
    filled: fitted || draft.lensType !== '' || overRight !== null || overLeft !== null || vaRight !== null || vaLeft !== null,
    payload: {
      cl_lens_type: draft.lensType || null,
      cl_fit: fitted ? { ...(Object.keys(right).length > 0 ? { r: right } : {}), ...(Object.keys(left).length > 0 ? { l: left } : {}) } : null,
      cl_over_r: overRight,
      cl_over_l: overLeft,
      cl_va_r: vaRight,
      cl_va_l: vaLeft
    }
  };
}

/** The payload keys of every part above, so a fit taken off (or never fitted) clears them all */
export const CL_FIT_KEYS = ['cl_lens_type', 'cl_fit', 'cl_over_r', 'cl_over_l', 'cl_va_r', 'cl_va_l'] as const;
