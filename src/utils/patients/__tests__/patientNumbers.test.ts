import { describe, expect, it } from 'vitest';
import { normalizeOldFileNumber, oldFileNumberProblem, patientReferenceLabel } from '../patientNumbers';

// The OneHealth reference is what claims and statements carry and what patients quote: shown as the number itself,
// never "Ref 0" or "Ref undefined" for a file that has none yet.
describe('patientReferenceLabel', () => {
  it('shows the reference as a plain number, as statements print it', () => {
    expect(patientReferenceLabel(1234)).toBe('1234');
    expect(patientReferenceLabel('0001234')).toBe('1234');
  });

  it('shows nothing for a file without one', () => {
    expect(patientReferenceLabel(null)).toBeNull();
    expect(patientReferenceLabel(undefined)).toBeNull();
    expect(patientReferenceLabel(0)).toBeNull();
    expect(patientReferenceLabel('abc')).toBeNull();
  });
});

// The old file number is what the patient's paper file or previous system says: kept as written, so the patient and
// the old documents still match it; only stray spaces are tidied.
describe('old file number', () => {
  it('keeps the number as written, without stray spaces', () => {
    expect(normalizeOldFileNumber('  A 0012  345 ')).toBe('A 0012 345');
    expect(normalizeOldFileNumber(null)).toBe('');
  });

  it('accepts blank (most patients have none) and the usual characters', () => {
    expect(oldFileNumberProblem('')).toBeNull();
    expect(oldFileNumberProblem('0001234')).toBeNull();
    expect(oldFileNumberProblem('AB-12/345.6')).toBeNull();
  });

  it('refuses what no file number looks like, with a plain reason', () => {
    expect(oldFileNumberProblem('1'.repeat(31))).toMatch(/at most 30 characters/);
    expect(oldFileNumberProblem('12#45')).toMatch(/letters, digits/);
  });
});
