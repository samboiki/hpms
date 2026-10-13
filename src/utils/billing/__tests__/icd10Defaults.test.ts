import { describe, expect, it } from 'vitest';
import {
  describeIcd10Source,
  suggestLineIcd10,
  tariffCodeKey,
  toTariffIcd10Defaults,
  usualIcd10ForCode,
  usualIcd10Problem
} from '../icd10Defaults';

// Business rule (parity E8): a practice sets the ICD-10 code each tariff code usually carries, so a new billing line
// starts with the right diagnosis and the claim is not stopped for a missing one. The same rule fills the visit's
// billing lines and claim review's suggestions, so a line never gets one code on the visit and another at the claim.
describe('the codes a billing line starts with', () => {
  const practiceDefaults = new Map([['8101', 'K02.1'], ['0190', 'Z00.0']]);

  it("puts the practice's own usual code first, for every discipline", () => {
    expect(suggestLineIcd10('0190', { practiceDefaults, dental: false, diagnosis: 'J06.9 flu' })).toEqual({ codes: ['Z00.0'], source: 'practice-default' });
    // The practice's choice wins over the built-in dental suggestion for the same code
    expect(suggestLineIcd10('8101', { practiceDefaults, dental: true })).toEqual({ codes: ['K02.1'], source: 'practice-default' });
  });

  // The funds paid 8109 and 8101 with Z01.2 alone in 2025, even when the notes named the caries a filling was for
  it('keeps the built-in dental code for dental practices when the practice set none, on its own', () => {
    expect(suggestLineIcd10('8109', { dental: true, diagnosis: 'K02.1 caries' })).toEqual({ codes: ['Z01.2'], source: 'usual-for-code' });
  });

  it('uses the codes written in the visit diagnosis when the tariff code has no usual code, at most 5', () => {
    expect(suggestLineIcd10('0190', { dental: false, diagnosis: 'URTI J06.9, HPT I10' })).toEqual({ codes: ['J06.9', 'I10'], source: 'visit-notes' });
    const many = 'A09.9 B34.9 E11.9 I10 J06.9 K29.7 R51';
    expect(suggestLineIcd10('0190', { dental: false, diagnosis: many }).codes).toEqual(['A09.9', 'B34.9', 'E11.9', 'I10', 'J06.9']);
  });

  // An external cause code (how an injury happened) can never be the main code: the claim would be stopped
  it('never makes an external cause code the main code', () => {
    expect(suggestLineIcd10('0190', { dental: false, diagnosis: 'W01.0 fell, S52.5 wrist fracture' }).codes).toEqual(['S52.5', 'W01.0']);
  });

  it("falls back to the owner's dental code sheet last, and gives GPs and specialists no dental codes", () => {
    expect(suggestLineIcd10('8341', { dental: true })).toMatchObject({ source: 'code-default' });
    expect(suggestLineIcd10('8341', { dental: true, diagnosis: 'K04.0 pulpitis' })).toEqual({ codes: ['K04.0'], source: 'visit-notes' });
    expect(suggestLineIcd10('8109', { dental: false })).toEqual({ codes: [], source: 'none' });
    expect(suggestLineIcd10('8341', { dental: false, practiceDefaults: null })).toEqual({ codes: [], source: 'none' });
  });

  it("matches tariff codes however they were typed", () => {
    expect(tariffCodeKey(' 0190 ')).toBe('0190');
    expect(usualIcd10ForCode(' 0190', { practiceDefaults, dental: false })).toEqual({ code: 'Z00.0', source: 'practice-default' });
    expect(usualIcd10ForCode('8109', { dental: false })).toBeNull();
  });

  it('says where suggested codes came from in plain words', () => {
    expect(describeIcd10Source('practice-default', '0190')).toBe("the practice's usual code for 0190");
    expect(describeIcd10Source('usual-for-code', '8101')).toBe('usual for 8101');
    expect(describeIcd10Source('visit-notes', '0190')).toBe('from the visit diagnosis');
    expect(describeIcd10Source('none', '0190')).toBeNull();
  });
});

// Business rule: a usual code becomes the main code of every new line for that tariff code, so only a code that can
// be a main code may be saved; rows that are not usable are ignored rather than put on lines
describe("a practice's usual codes", () => {
  it('accepts a main-code ICD-10 and explains what is wrong with anything else', () => {
    expect(usualIcd10Problem('j069')).toBeNull();
    expect(usualIcd10Problem('')).toMatch(/Type an ICD-10 code/);
    expect(usualIcd10Problem('J6')).toMatch(/not an ICD-10 code/);
    expect(usualIcd10Problem('W01.0')).toMatch(/cannot be the main code/);
  });

  it('reads the saved rows into a map by tariff code, tidied, leaving out unusable rows', () => {
    const defaults = toTariffIcd10Defaults([
      { tariff_code: '0190 ', icd10_code: 'j069' },
      { tariff_code: '0191', icd10_code: 'W01.0' },
      { tariff_code: null, icd10_code: 'I10' }
    ]);
    expect([...defaults.entries()]).toEqual([['0190', 'J06.9']]);
  });
});
