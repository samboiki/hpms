/**
 * ICD-10 codes suggested from a spectacle prescription (WHO ICD-10 as the Namibian funds take it). Suggestions only:
 * the optometrist ticks the ones that apply before they go into the visit's diagnosis, the way dental codes are
 * suggested and then confirmed for claims (src/components/finance/claims/buildClaimLines.ts). Nothing is coded by
 * itself.
 *
 * The cut-offs are the usual clinical definitions, written here so the practice can check them:
 * - myopia H52.1: both main meridians -0.50 D or more minus, in either eye (so plano / -1.25 is astigmatism only)
 * - hypermetropia H52.0: both main meridians +0.50 D or more plus, in either eye
 * - astigmatism H52.2: a cylinder of 0.50 D or more, in either eye
 * - anisometropia H52.3: the two eyes' spherical equivalents differ by 1.00 D or more
 * - presbyopia H52.4: a reading addition
 */
import { extractIcd10Codes } from '../billing/icd10';
import { EYE_NAMES, EYES, eyeSummary, formatDioptre, inCylinderForm, sphericalEquivalent, type EyeRx, type Rx } from './prescription';

export interface DiagnosisSuggestion {
  code: string;
  label: string;
  /** Why it is suggested, in the prescription's own numbers */
  reason: string;
}

export const REFRACTIVE_CODES = {
  hypermetropia: { code: 'H52.0', label: 'Hypermetropia' },
  myopia: { code: 'H52.1', label: 'Myopia' },
  astigmatism: { code: 'H52.2', label: 'Astigmatism' },
  anisometropia: { code: 'H52.3', label: 'Anisometropia' },
  presbyopia: { code: 'H52.4', label: 'Presbyopia' }
} as const;

export const SUGGESTION_CUT_OFFS = { myopia: -0.5, hypermetropia: 0.5, astigmatism: 0.5, anisometropia: 1 } as const;

/** The two main meridians of an eye, weakest first in each direction: [less minus, more minus] in minus cylinder. */
const meridians = (eye: EyeRx): [number, number] => {
  const minus = inCylinderForm(eye, 'minus');
  return [minus.sphere, minus.sphere + (minus.cylinder ?? 0)];
};

/** The refractive-error codes the prescription points to, in code order. */
export function suggestDiagnoses(rx: Rx): DiagnosisSuggestion[] {
  const suggestions: DiagnosisSuggestion[] = [];
  const se = { right: sphericalEquivalent(rx.right), left: sphericalEquivalent(rx.left) };
  const eyesWhere = (test: (side: 'right' | 'left') => boolean) => EYES.filter(test);
  const describe = (sides: readonly ('right' | 'left')[], value: (side: 'right' | 'left') => string) =>
    sides.map(side => `${EYE_NAMES[side]} ${value(side)}`).join(', ');

  // Long-sighted when even the weaker meridian is (in minus cylinder that is sphere + cylinder)
  const plus = eyesWhere(side => meridians(rx[side])[1] >= SUGGESTION_CUT_OFFS.hypermetropia);
  if (plus.length > 0) {
    suggestions.push({ ...REFRACTIVE_CODES.hypermetropia, reason: describe(plus, side => eyeSummary(rx[side])) });
  }
  // Short-sighted when even the weaker meridian is (in minus cylinder that is the sphere)
  const minus = eyesWhere(side => meridians(rx[side])[0] <= SUGGESTION_CUT_OFFS.myopia);
  if (minus.length > 0) {
    suggestions.push({ ...REFRACTIVE_CODES.myopia, reason: describe(minus, side => eyeSummary(rx[side])) });
  }
  const cylinders = eyesWhere(side => Math.abs(rx[side].cylinder ?? 0) >= SUGGESTION_CUT_OFFS.astigmatism);
  if (cylinders.length > 0) {
    suggestions.push({ ...REFRACTIVE_CODES.astigmatism, reason: `Cylinder: ${describe(cylinders, side => formatDioptre(rx[side].cylinder ?? 0))}` });
  }
  const difference = Math.abs(se.right - se.left);
  if (difference >= SUGGESTION_CUT_OFFS.anisometropia) {
    suggestions.push({ ...REFRACTIVE_CODES.anisometropia, reason: `The eyes differ by ${difference.toFixed(2)} D (spherical equivalent)` });
  }
  const adds = eyesWhere(side => Boolean(rx[side].add));
  if (adds.length > 0) {
    suggestions.push({ ...REFRACTIVE_CODES.presbyopia, reason: `Reading addition: ${describe(adds, side => formatDioptre(rx[side].add ?? 0))}` });
  }
  return suggestions;
}

/**
 * The visit's diagnosis with the ticked codes added after what is already written ("H52.1 Myopia; H52.2
 * Astigmatism"); a code already in the text is not added twice. The claim reads the codes from this text and the
 * practitioner confirms them before sending, as for any other visit.
 */
export function addToDiagnosis(current: string | null | undefined, picked: readonly Pick<DiagnosisSuggestion, 'code' | 'label'>[]): string {
  const text = (current ?? '').trim();
  const present = new Set(extractIcd10Codes(text));
  const added = picked.filter((item, index) => !present.has(item.code) && picked.findIndex(other => other.code === item.code) === index);
  if (added.length === 0) return text;
  const items = added.map(item => `${item.code} ${item.label}`).join('; ');
  return text ? `${text.replace(/[;,.\s]+$/, '')}; ${items}` : items;
}
