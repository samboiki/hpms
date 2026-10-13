import { describe, expect, it } from 'vitest';
import {
  axisDifference,
  compareEye,
  defaultValidUntil,
  describeChange,
  emptyEyeDraft,
  eyeDraftFrom,
  eyeSummary,
  formatDioptre,
  inCylinderForm,
  isExpired,
  parseDioptre,
  sphericalEquivalent,
  transposeEye,
  validateEyeDraft,
  type EyeDraft,
  type EyeRx
} from '../prescription';
import { normaliseVisualAcuity } from '../visualAcuity';

const eye = (values: Partial<EyeRx> = {}): EyeRx => ({
  sphere: 0, cylinder: null, axis: null, prism: null, base: null, add: null, va: null, baseCurve: null, diameter: null, ...values
});
const draft = (values: Partial<EyeDraft>): EyeDraft => ({ ...emptyEyeDraft(), ...values });
const errorsOf = (values: Partial<EyeDraft>, kind: 'spectacles' | 'contact_lenses' = 'spectacles') => {
  const result = validateEyeDraft(draft(values), kind);
  return result.ok ? {} : result.errors;
};

// Business rule: optometrists type fast and in their own habits; a value read wrongly becomes wrong lenses
describe('reading what the optometrist types', () => {
  it('reads signs, a decimal comma, a typographic minus and "pl" for plano', () => {
    expect(parseDioptre('+1.25')).toEqual({ ok: true, value: 1.25 });
    expect(parseDioptre('-0,5')).toEqual({ ok: true, value: -0.5 });
    expect(parseDioptre('−2')).toEqual({ ok: true, value: -2 });
    expect(parseDioptre('pl')).toEqual({ ok: true, value: 0 });
    expect(parseDioptre('Plano')).toEqual({ ok: true, value: 0 });
    expect(parseDioptre('  ')).toEqual({ ok: true, value: null });
  });

  it('refuses what is not a dioptre value instead of guessing', () => {
    expect(parseDioptre('1.255').ok).toBe(false);
    expect(parseDioptre('abc').ok).toBe(false);
    expect(parseDioptre('1-2').ok).toBe(false);
  });
});

describe('checking one eye against the ranges the database accepts', () => {
  it('needs a sphere, so an empty box is never taken as plano by accident', () => {
    expect(errorsOf({}).sphere).toMatch(/plano/);
    expect(validateEyeDraft(draft({ sphere: 'pl' }), 'spectacles')).toEqual({ ok: true, eye: eye() });
  });

  it('keeps sphere -30 to +30, cylinder -15 to +15 and the add +0.75 to +4.00, all in quarter steps', () => {
    expect(errorsOf({ sphere: '-30.25' }).sphere).toBeDefined();
    expect(errorsOf({ sphere: '+30' }).sphere).toBeUndefined();
    expect(errorsOf({ sphere: '1.10' }).sphere).toMatch(/0\.25/);
    expect(errorsOf({ sphere: '0', cylinder: '-15.25', axis: '90' }).cylinder).toBeDefined();
    expect(errorsOf({ sphere: '0', add: '0.50' }).add).toBeDefined();
    expect(errorsOf({ sphere: '0', add: '4.25' }).add).toBeDefined();
    expect(errorsOf({ sphere: '0', add: '+2.50' }).add).toBeUndefined();
  });

  it('needs the axis with a cylinder (0 to 180), and refuses an axis without one: the lab cannot make half a cylinder', () => {
    expect(errorsOf({ sphere: '-1', cylinder: '-0.50' }).axis).toMatch(/needs its axis/);
    expect(errorsOf({ sphere: '-1', axis: '90' }).axis).toMatch(/goes with a cylinder/);
    expect(errorsOf({ sphere: '-1', cylinder: '-0.50', axis: '181' }).axis).toBeDefined();
    expect(validateEyeDraft(draft({ sphere: '-1', cylinder: '-0.50', axis: '180' }), 'spectacles')).toEqual({
      ok: true,
      eye: eye({ sphere: -1, cylinder: -0.5, axis: 180 })
    });
  });

  it('treats a zero cylinder and a zero add as none', () => {
    const result = validateEyeDraft(draft({ sphere: '+1', cylinder: '0', add: '0' }), 'spectacles');
    expect(result).toEqual({ ok: true, eye: eye({ sphere: 1 }) });
  });

  it('pairs a prism with its base, both ways', () => {
    expect(errorsOf({ sphere: '0', prism: '1' }).base).toMatch(/base/);
    expect(errorsOf({ sphere: '0', base: 'in' }).base).toMatch(/goes with a prism/);
    expect(validateEyeDraft(draft({ sphere: '0', prism: '1.5', base: 'in' }), 'spectacles')).toEqual({ ok: true, eye: eye({ prism: 1.5, base: 'in' }) });
  });

  it('takes base curve and diameter for contact lenses, and no prism', () => {
    expect(errorsOf({ sphere: '-2', baseCurve: '12' }, 'contact_lenses').baseCurve).toBeDefined();
    expect(errorsOf({ sphere: '-2', prism: '1', base: 'in' }, 'contact_lenses').prism).toMatch(/no prism/);
    expect(validateEyeDraft(draft({ sphere: '-2', baseCurve: '8.6', diameter: '14.2' }), 'contact_lenses')).toEqual({
      ok: true,
      eye: eye({ sphere: -2, baseCurve: 8.6, diameter: 14.2 })
    });
  });

  it('keeps the acuity in one written form and refuses what is not an acuity', () => {
    expect(validateEyeDraft(draft({ sphere: '0', va: ' 6/9 +2 ' }), 'spectacles')).toEqual({ ok: true, eye: eye({ va: '6/9+2' }) });
    expect(errorsOf({ sphere: '0', va: 'good' }).va).toBeDefined();
  });

  it('opens a saved eye in the form exactly as it was written', () => {
    const saved = eye({ sphere: -1.25, cylinder: -0.5, axis: 90, add: 2, va: '6/6' });
    const reopened = validateEyeDraft(eyeDraftFrom(saved), 'spectacles');
    expect(reopened).toEqual({ ok: true, eye: saved });
  });
});

describe('visual acuity', () => {
  it('accepts Snellen in metres or feet, decimal acuity and the low-vision steps, in one form', () => {
    expect(normaliseVisualAcuity('6/6')).toBe('6/6');
    expect(normaliseVisualAcuity('20/40')).toBe('20/40');
    expect(normaliseVisualAcuity('1')).toBe('1.0');
    expect(normaliseVisualAcuity('0,5')).toBe('0.5');
    expect(normaliseVisualAcuity('cf')).toBe('CF');
    expect(normaliseVisualAcuity('npl')).toBe('NLP');
    expect(normaliseVisualAcuity('6/0')).toBeNull();
    expect(normaliseVisualAcuity('3.5')).toBeNull();
  });
});

describe('writing a prescription the way it is read', () => {
  it('always shows the sign, so +1.00 and -1.00 are never confused', () => {
    expect(formatDioptre(1.25)).toBe('+1.25');
    expect(formatDioptre(-0.5)).toBe('-0.50');
    expect(formatDioptre(0)).toBe('0.00');
    expect(formatDioptre(0, { plano: true })).toBe('Plano');
  });

  it('writes one eye in a line', () => {
    expect(eyeSummary(eye({ sphere: -1.25, cylinder: -0.5, axis: 90, add: 2 }))).toBe('-1.25 / -0.50 x 90, add +2.00');
    expect(eyeSummary(eye({ sphere: 2 }))).toBe('+2.00 DS');
    expect(eyeSummary(eye())).toBe('Plano');
    expect(eyeSummary(eye({ prism: 1, base: 'in' }))).toBe('Plano, prism 1.00 base in');
  });
});

// Business rule: labs and practices use plus or minus cylinder; switching must never change the lens
describe('transposition', () => {
  const minus = eye({ sphere: -1, cylinder: -0.5, axis: 180 });
  const plus = eye({ sphere: -1.5, cylinder: 0.5, axis: 90 });

  it('turns minus cylinder into plus cylinder and back', () => {
    expect(transposeEye(minus)).toEqual(plus);
    expect(transposeEye(plus)).toEqual(minus);
    expect(transposeEye(transposeEye(eye({ sphere: 2.25, cylinder: -1.75, axis: 35 })))).toEqual(eye({ sphere: 2.25, cylinder: -1.75, axis: 35 }));
  });

  it('keeps the spherical equivalent, which is what the patient sees through', () => {
    expect(sphericalEquivalent(transposeEye(minus))).toBe(sphericalEquivalent(minus));
  });

  it('leaves an eye alone when it is already in the asked form or has no cylinder', () => {
    expect(inCylinderForm(minus, 'minus')).toBe(minus);
    expect(inCylinderForm(plus, 'minus')).toEqual(minus);
    expect(inCylinderForm(eye({ sphere: -2 }), 'plus')).toEqual(eye({ sphere: -2 }));
  });
});

describe('comparing with the last prescription', () => {
  it('sees no change when the same lens is written the other way', () => {
    const change = compareEye(eye({ sphere: -1, cylinder: -0.5, axis: 180 }), eye({ sphere: -1.5, cylinder: 0.5, axis: 90 }));
    expect(describeChange(change)).toBe('No change');
  });

  it('measures an axis turn the short way round (5 and 175 degrees are 10 apart)', () => {
    expect(axisDifference(175, 5)).toBe(10);
    expect(axisDifference(5, 175)).toBe(-10);
    expect(axisDifference(90, 90)).toBe(0);
  });

  it('says what changed in plain words', () => {
    const change = compareEye(eye({ sphere: -1, cylinder: -0.5, axis: 10, add: 1.5 }), eye({ sphere: -1.5, cylinder: -0.5, axis: 20, add: 1.75 }));
    expect(describeChange(change)).toBe('Sphere -0.50, axis +10 degrees, add +0.25');
    expect(change.sphericalEquivalent).toBe(-0.5);
  });
});

describe('how long a prescription is valid', () => {
  it('gives spectacles two years and contact lenses one, from the day prescribed', () => {
    expect(defaultValidUntil('spectacles', '2026-10-08')).toBe('2028-10-08');
    expect(defaultValidUntil('contact_lenses', '2026-10-08')).toBe('2027-10-08');
  });

  it('is expired from the day after its last valid day', () => {
    expect(isExpired('2026-10-08', '2026-10-08')).toBe(false);
    expect(isExpired('2026-10-07', '2026-10-08')).toBe(true);
    expect(isExpired(null, '2026-10-08')).toBe(false);
  });
});
