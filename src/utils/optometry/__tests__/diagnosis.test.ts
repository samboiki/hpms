import { describe, expect, it } from 'vitest';
import { addToDiagnosis, suggestDiagnoses } from '../diagnosis';
import type { EyeRx, Rx } from '../prescription';

const eye = (values: Partial<EyeRx> = {}): EyeRx => ({
  sphere: 0, cylinder: null, axis: null, prism: null, base: null, add: null, va: null, baseCurve: null, diameter: null, ...values
});
const rx = (right: Partial<EyeRx>, left: Partial<EyeRx> = right): Rx => ({ right: eye(right), left: eye(left) });
const codes = (prescription: Rx) => suggestDiagnoses(prescription).map(suggestion => suggestion.code);

// Business rule: funds want the diagnosis on every line; the refraction already says which refractive error it is,
// but only the optometrist decides what goes on the claim
describe('ICD-10 suggestions from the prescription', () => {
  it('suggests myopia and astigmatism for a short-sighted eye with a cylinder', () => {
    expect(codes(rx({ sphere: -2, cylinder: -0.75, axis: 180 }))).toEqual(['H52.1', 'H52.2']);
  });

  it('suggests hypermetropia and presbyopia for long sight with a reading addition', () => {
    expect(codes(rx({ sphere: 1.5, add: 2 }))).toEqual(['H52.0', 'H52.4']);
  });

  it('looks at both main meridians, so simple and mixed astigmatism are coded as astigmatism only', () => {
    // +0.50 / -1.00: one meridian long-sighted, the other short-sighted
    expect(codes(rx({ sphere: 0.5, cylinder: -1, axis: 90 }))).toEqual(['H52.2']);
    // plano / -1.25: one meridian plano
    expect(codes(rx({ sphere: 0, cylinder: -1.25, axis: 90 }))).toEqual(['H52.2']);
    // The same eye written in plus cylinder gives the same codes
    expect(codes(rx({ sphere: -1.25, cylinder: 1.25, axis: 180 }))).toEqual(['H52.2']);
    // -1.00 / -0.75 and +2.00 / -1.00: both meridians the same way
    expect(codes(rx({ sphere: -1, cylinder: -0.75, axis: 10 }))).toEqual(['H52.1', 'H52.2']);
    expect(codes(rx({ sphere: 2, cylinder: -1, axis: 10 }))).toEqual(['H52.0', 'H52.2']);
  });

  it('starts myopia at -0.50 and hypermetropia at +0.50, the usual definitions', () => {
    expect(codes(rx({ sphere: -0.5 }))).toEqual(['H52.1']);
    expect(codes(rx({ sphere: -0.25 }))).toEqual([]);
    expect(codes(rx({ sphere: 0.5 }))).toEqual(['H52.0']);
  });

  it('suggests anisometropia when the eyes differ by 1.00 D or more', () => {
    expect(codes(rx({ sphere: -1 }, { sphere: -2 }))).toEqual(['H52.1', 'H52.3']);
    expect(codes(rx({ sphere: -1 }, { sphere: -1.75 }))).toEqual(['H52.1']);
    // One eye long-sighted, the other short-sighted: both, and the difference
    expect(codes(rx({ sphere: 1 }, { sphere: -1 }))).toEqual(['H52.0', 'H52.1', 'H52.3']);
  });

  it('suggests nothing for plano eyes', () => {
    expect(suggestDiagnoses(rx({}))).toEqual([]);
  });

  it('says why, in the prescription\'s own numbers', () => {
    const [astigmatism] = suggestDiagnoses(rx({ sphere: 0, cylinder: -1.25, axis: 90 }, { sphere: 0 }));
    expect(astigmatism).toEqual({ code: 'H52.2', label: 'Astigmatism', reason: 'Cylinder: Right eye -1.25' });
  });
});

describe('adding the ticked codes to the visit diagnosis', () => {
  const myopia = { code: 'H52.1', label: 'Myopia' };
  const astigmatism = { code: 'H52.2', label: 'Astigmatism' };

  it('adds after what is written, so the practitioner\'s own words stay', () => {
    expect(addToDiagnosis('Routine eye test.', [myopia, astigmatism])).toBe('Routine eye test; H52.1 Myopia; H52.2 Astigmatism');
    expect(addToDiagnosis('', [myopia])).toBe('H52.1 Myopia');
  });

  it('never adds a code twice (the claim would send it twice)', () => {
    expect(addToDiagnosis('H52.1 Myopia', [myopia, astigmatism])).toBe('H52.1 Myopia; H52.2 Astigmatism');
    expect(addToDiagnosis('H52.1 Myopia', [myopia])).toBe('H52.1 Myopia');
    expect(addToDiagnosis(null, [myopia, myopia])).toBe('H52.1 Myopia');
  });
});
