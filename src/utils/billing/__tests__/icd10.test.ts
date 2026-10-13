import { describe, it, expect } from 'vitest';
import {
  COMMON_ICD10_CODES,
  MAX_SECONDARY_ICD10,
  normalizeIcd10,
  isValidIcd10Format,
  isExternalCauseCode,
  isInjuryCode,
  validateIcd10Selection,
  searchIcd10,
  describeIcd10,
  extractIcd10Codes,
  icd10CodesOf,
  icd10SelectionOf
} from '../icd10';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Business rule: NAMAF claims are paid only with a valid ICD-10 code ("no ICD-10, no pay"). The
// format is a letter, two digits and an optional dot with one or two digits (A00, J06.9, S52.50).
// Anything else is rejected before the claim leaves the practice.
describe('ICD-10 format', () => {
  const categories = ['00', '07', '10', '29', '50', '86', '99'];
  const suffixes = ['', '.0', '.9', '.12'];
  const valid = LETTERS.flatMap(letter => categories.flatMap(category => suffixes.map(suffix => `${letter}${category}${suffix}`)));

  it.each(valid)('%s is valid', code => {
    expect(isValidIcd10Format(code)).toBe(true);
    expect(normalizeIcd10(code)).toBe(code);
  });

  const invalid = LETTERS.flatMap(letter => [
    letter,
    `${letter}1`,
    `${letter}1.1`,
    `${letter}12.345`,
    `${letter}12-3`,
    `${letter}${letter}1`,
    `1${letter}2`,
    `${letter}12.3A`,
    `${letter}1A.1`
  ]);

  it.each(invalid)('%s is invalid', code => {
    expect(isValidIcd10Format(normalizeIcd10(code))).toBe(false);
  });
});

// Business rule: what the doctor types is tidied the way a coder would read it, so "j069" and
// "J06.9" are the same diagnosis and a stray space or dagger sign does not reject the claim.
describe('normalising typed codes', () => {
  it.each([
    { input: 'j069', output: 'J06.9' },
    { input: ' J06.9 ', output: 'J06.9' },
    { input: 'e11 .9', output: 'E11.9' },
    { input: 'S5250', output: 'S52.50' },
    { input: 'I10.', output: 'I10' },
    { input: 'i10', output: 'I10' },
    { input: 'A17.0†', output: 'A17.0' },
    { input: 'G01*', output: 'G01' },
    { input: 'k02.1', output: 'K02.1' },
    { input: '', output: '' }
  ])('"$input" -> "$output"', ({ input, output }) => {
    expect(normalizeIcd10(input)).toBe(output);
  });
});

// Business rule: external cause codes (V01-Y98) explain how an injury happened and may never be the
// primary diagnosis; an injury code (S/T) should be followed by one. Funds reject claims that break this.
describe('primary and secondary code rules', () => {
  const externalCauses = ['V', 'W', 'X', 'Y'].flatMap(letter =>
    Array.from({ length: 25 }, (_, index) => `${letter}${String(index * 4 + 1).padStart(2, '0')}.${index % 10}`)
  );

  it.each(externalCauses)('%s cannot be the primary code', code => {
    expect(isExternalCauseCode(code)).toBe(true);
    const { errors } = validateIcd10Selection({ primary: code, secondary: [] });
    expect(errors.join(' ')).toMatch(/external cause code/);
    expect(validateIcd10Selection({ primary: 'S02.50', secondary: [code] }).errors).toEqual([]);
  });

  const injuries = ['S', 'T'].flatMap(letter =>
    Array.from({ length: 30 }, (_, index) => `${letter}${String(index * 3).padStart(2, '0')}.${index % 10}`)
  );

  it.each(injuries)('injury %s warns without an external cause and is clean with one', code => {
    expect(isInjuryCode(code)).toBe(true);
    expect(validateIcd10Selection({ primary: code, secondary: [] }).warnings.join(' ')).toMatch(/external cause/);
    expect(validateIcd10Selection({ primary: code, secondary: ['W01.0'] }).warnings).toEqual([]);
  });

  it('requires a primary code', () => {
    expect(validateIcd10Selection({ primary: '', secondary: [] }).errors.join(' ')).toMatch(/required/);
    expect(validateIcd10Selection({ primary: '   ', secondary: ['J06.9'] }).errors.join(' ')).toMatch(/required/);
  });

  // The claim file carries 5 codes per line (field 33): a sixth code would never reach the fund, so it is refused
  // where it is typed instead of being dropped without a word when the claim is written
  it('allows the 4 secondary codes a claim line carries (5 in all) and refuses a fifth', () => {
    expect(MAX_SECONDARY_ICD10).toBe(4);
    const four = Array.from({ length: 4 }, (_, index) => `J0${index}.9`);
    expect(validateIcd10Selection({ primary: 'I10', secondary: four }).errors).toEqual([]);
    expect(validateIcd10Selection({ primary: 'I10', secondary: [...four, 'E11.9'] }).errors.join(' ')).toMatch(/at most 5 ICD-10 codes.*Remove 1/);
  });

  // A billing line keeps its codes as one list (main code first); the picker works with main and other codes
  it('turns a line\'s code list into the picker\'s selection and back, tidied and each code once', () => {
    expect(icd10SelectionOf(['J06.9', 'I10'])).toEqual({ primary: 'J06.9', secondary: ['I10'] });
    expect(icd10SelectionOf([])).toEqual({ primary: '', secondary: [] });
    expect(icd10CodesOf({ primary: 'j069', secondary: ['I10', '', 'J06.9', 'e119'] })).toEqual(['J06.9', 'I10', 'E11.9']);
    expect(icd10CodesOf({ primary: '', secondary: [] })).toEqual([]);
  });

  it('rejects the same code twice, also when typed differently', () => {
    expect(validateIcd10Selection({ primary: 'J06.9', secondary: ['j069'] }).errors.join(' ')).toMatch(/more than once/);
  });

  it('rejects malformed secondary codes and ignores empty ones', () => {
    expect(validateIcd10Selection({ primary: 'I10', secondary: ['E11.9', '', 'XX1'] }).errors).toEqual([
      '"XX1" is not a valid ICD-10 code (example: J06.9).'
    ]);
  });
});

// Business rule: the built-in quick-pick list must only offer codes a fund will accept as primary.
describe('built-in common codes', () => {
  it.each(COMMON_ICD10_CODES.map(entry => entry))('$code is a valid primary code', entry => {
    expect(isValidIcd10Format(entry.code)).toBe(true);
    expect(validateIcd10Selection({ primary: entry.code, secondary: [] }).errors).toEqual([]);
    expect(describeIcd10(entry.code.toLowerCase())).toBe(entry.description);
  });

  it('has no duplicates', () => {
    const codes = COMMON_ICD10_CODES.map(entry => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('finds codes by code or by words, code matches first', () => {
    expect(searchIcd10('j06')[0].code).toBe('J06.9');
    expect(searchIcd10('caries').map(entry => entry.code)).toEqual(['K02.1', 'K02.9']);
    expect(searchIcd10('back pain').map(entry => entry.code)).toEqual(['M54.56']);
    expect(searchIcd10('')).toHaveLength(COMMON_ICD10_CODES.length);
    expect(describeIcd10('Q99.9')).toBeNull();
  });
});

// Business rule: codes the doctor already wrote in the visit notes are offered as suggestions
// (they must still be confirmed), so doctors do not retype them.
describe('extracting codes from visit notes', () => {
  it.each([
    { text: 'URTI J06.9, HPT I10', codes: ['J06.9', 'I10'] },
    { text: 'Dx: K02.1 caries 36; K04.0', codes: ['K02.1', 'K04.0'] },
    { text: 'J06.9 and again J06.9', codes: ['J06.9'] },
    { text: 'BP 120/80, temp 37.5', codes: [] },
    { text: 'lowercase j06.9 is ignored', codes: [] },
    { text: '', codes: [] },
    { text: null, codes: [] }
  ])('"$text"', ({ text, codes }) => {
    expect(extractIcd10Codes(text)).toEqual(codes);
  });
});
