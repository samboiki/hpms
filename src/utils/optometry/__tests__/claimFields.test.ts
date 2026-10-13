import { describe, expect, it } from 'vitest';
import { CLAIM_FIELD_MAX, OPTOMETRY_CLAIM_PATTERNS } from '../../billing/claimLine';
import { claimDioptre, claimLensPrescription, claimReadingAdditions, claimTintDensity } from '../claimFields';
import type { EyeRx, Rx } from '../prescription';

const eye = (values: Partial<EyeRx> = {}): EyeRx => ({
  sphere: 0, cylinder: null, axis: null, prism: null, base: null, add: null, va: null, baseCurve: null, diameter: null, ...values
});
const rx = (right: Partial<EyeRx>, left: Partial<EyeRx> = right): Rx => ({ right: eye(right), left: eye(left) });

// Business rule: the Methealth/QEDI specification fixes the shape of claim fields 45-47; a fund's parser reads the
// prescription by position, so every sign, zero and letter must be where the specification puts it
describe('claim field 46: the lens prescription', () => {
  it('writes both eyes with signs, two-digit dioptres and a three-digit axis', () => {
    const value = claimLensPrescription(rx({ sphere: 1.25, cylinder: -0.5, axis: 90 }, { sphere: -10, cylinder: -0.75, axis: 180 }));
    expect(value).toBe('R+01.25-00.50X090L-10.00-00.75X180');
    expect(value).toHaveLength(CLAIM_FIELD_MAX.lensPrescription);
    expect(OPTOMETRY_CLAIM_PATTERNS.lensPrescription.test(value)).toBe(true);
  });

  it('writes plano and no cylinder as the specification\'s own example does', () => {
    expect(claimLensPrescription(rx({}))).toBe('R+00.00-00.00X000L+00.00-00.00X000');
  });

  it('keeps a plus cylinder as recorded (the specification takes either sign)', () => {
    expect(claimLensPrescription(rx({ sphere: -1.5, cylinder: 0.5, axis: 90 }))).toBe('R-01.50+00.50X090L-01.50+00.50X090');
  });

  it('pads a sphere as the specification\'s 00.00 shape asks', () => {
    expect(claimDioptre(0.25)).toBe('+00.25');
    expect(claimDioptre(-30)).toBe('-30.00');
  });
});

describe('claim field 45: reading additions', () => {
  it('writes each eye that has an addition, without spaces', () => {
    expect(claimReadingAdditions(rx({ add: 3 }, { add: 3.75 }))).toBe('R3.00L3.75');
    expect(claimReadingAdditions(rx({ add: 2 }, {}))).toBe('R2.00');
    expect(claimReadingAdditions(rx({}))).toBe('');
    expect(OPTOMETRY_CLAIM_PATTERNS.readingAdditions.test('R3.00L3.75')).toBe(true);
  });
});

describe('claim field 47: density of tint', () => {
  it('writes the tint per eye ordered, without the percent sign', () => {
    expect(claimTintDensity('both', 35)).toBe('R35L35');
    expect(claimTintDensity('left', 80)).toBe('L80');
    expect(claimTintDensity('both', null)).toBe('');
    expect('R99L99'.length).toBeLessThanOrEqual(CLAIM_FIELD_MAX.densityOfTint);
    expect(OPTOMETRY_CLAIM_PATTERNS.densityOfTint.test(claimTintDensity('both', 35))).toBe(true);
  });
});
