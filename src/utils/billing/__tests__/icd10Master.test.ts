import { describe, expect, it } from 'vitest';
import {
  addIcd10ToDiagnosis,
  icd10ListProblems,
  icd10OptionNote,
  icd10Options,
  matchesIcd10Query,
  parseIcd10AgeRange,
  parseIcd10Query,
  toIcd10MasterEntry,
  type Icd10MasterEntry,
  type Icd10Option
} from '../icd10Master';

// Invented look-alikes of list rows (reference data, no patient data)
const entry = (code: string, description: string, overrides: Partial<Icd10MasterEntry> = {}): Icd10MasterEntry => ({
  code,
  description,
  validClinicalUse: true,
  validPrimary: true,
  isAsterisk: false,
  ageRange: null,
  gender: null,
  discontinued: false,
  endDate: null,
  ...overrides
});

const J06 = entry('J06', 'Acute upper respiratory infections of multiple and unspecified sites', { validClinicalUse: false, validPrimary: false });
const J069 = entry('J06.9', 'Acute upper respiratory infection, unspecified');
const D630 = entry('D63.0', 'Anaemia in neoplastic disease', { isAsterisk: true, validPrimary: false });
const C341 = entry('C34.1', 'Malignant neoplasm, upper lobe, bronchus or lung');
const B952 = entry('B95.2', 'Streptococcus, group D, as the cause of diseases classified to other chapters', { validPrimary: false });
const N922 = entry('N92.2', 'Excessive menstruation at puberty', { gender: 'F', ageRange: '≤ 19 years' });
const F680 = entry('F68.0', 'Elaboration of physical symptoms for psychological reasons', { ageRange: '> 19 years' });
const C832 = entry('C83.2', 'Mixed small and large cell (diffuse)', { discontinued: true, endDate: '2013-05-31' });
const W010 = entry('W01.0', 'Fall on same level from slipping, tripping and stumbling, at home', { validPrimary: false });
const S5250 = entry('S52.50', 'Fracture of lower end of radius, closed');

const listOf = (...entries: Icd10MasterEntry[]) => new Map(entries.map(item => [item.code, item]));

// Business rule (parity E14): the funds validate every claim line's codes against the South African ICD-10 Master
// Industry Table. A code that looks right but is a heading, an asterisk code in first place, discontinued or not in the
// list at all gets the line rejected, so claim review stops it before the batch is sent.
describe('what the medical aids\' list says about a line\'s codes', () => {
  it('refuses a code that is not in the list at all: the fund rejects it as an invalid diagnosis', () => {
    expect(icd10ListProblems(['J06.99'], listOf(J069))).toEqual([
      { code: 'J06.99', severity: 'error', message: "J06.99 is not in the medical aids' ICD-10 list: check the code." }
    ]);
  });

  it('refuses a category heading anywhere on the line and says which code to look under', () => {
    const [main] = icd10ListProblems(['J06'], listOf(J06));
    expect(main).toMatchObject({ code: 'J06', severity: 'error' });
    expect(main.message).toContain('is a category heading, not a diagnosis');
    expect(main.message).toContain('starts with J06');
    expect(icd10ListProblems(['J06.9', 'J06'], listOf(J06, J069)).map(problem => problem.code)).toEqual(['J06']);
  });

  // An asterisk code names a manifestation; the cause (dagger) code must come first or the fund rejects the line
  it('refuses an asterisk code as the main diagnosis but accepts it after the cause', () => {
    expect(icd10ListProblems(['D63.0', 'C34.1'], listOf(D630, C341))).toEqual([
      expect.objectContaining({ code: 'D63.0', severity: 'error', message: expect.stringContaining('asterisk (*) code') })
    ]);
    expect(icd10ListProblems(['C34.1', 'D63.0'], listOf(D630, C341))).toEqual([]);
  });

  it('warns when the main code may not be the main diagnosis, and not when it comes second', () => {
    expect(icd10ListProblems(['B95.2', 'N39.0'], listOf(B952, entry('N39.0', 'Urinary tract infection, site not specified')))).toEqual([
      expect.objectContaining({ code: 'B95.2', severity: 'warning', message: expect.stringContaining('may not be the main diagnosis') })
    ]);
    expect(icd10ListProblems(['N39.0', 'B95.2'], listOf(B952, entry('N39.0', 'Urinary tract infection, site not specified')))).toEqual([]);
  });

  // validateIcd10Selection already stops an external cause code in first place; one message per mistake is enough
  it('leaves an external cause code in first place to the shape check', () => {
    expect(icd10ListProblems(['W01.0', 'S52.50'], listOf(W010, S5250))).toEqual([]);
  });

  it('refuses a discontinued code for a service after it ended, but not for a service before', () => {
    const [late] = icd10ListProblems(['C83.2'], listOf(C832), { serviceDate: '2026-10-07' });
    expect(late).toMatchObject({ severity: 'error' });
    expect(late.message).toContain('ended on 31 May 2013 and is no longer accepted');
    expect(icd10ListProblems(['C83.2'], listOf(C832), { serviceDate: '2013-05-30' })).toEqual([]);
  });

  // A code for the other sex or another age is usually a typing slip or a wrong patient on the file: point it out,
  // the practitioner decides (the funds query these lines)
  it('warns when the code is meant for the other sex or another age', () => {
    const patient = { gender: 'M', dateOfBirth: '1990-03-01' };
    const messages = icd10ListProblems(['N92.2'], listOf(N922), { serviceDate: '2026-10-07', patient }).map(problem => problem.message);
    expect(messages).toEqual([
      expect.stringContaining('is meant for female patients, and this patient is male'),
      expect.stringContaining('is meant for patients aged 19 or younger; this patient was 36 on the service date')
    ]);
    expect(icd10ListProblems(['N92.2'], listOf(N922), { serviceDate: '2026-10-07', patient: { gender: 'F', dateOfBirth: '2012-01-15' } })).toEqual([]);
  });

  it('counts the age on the service date: a 19-year-old is not yet "over 19"', () => {
    const born = { gender: 'F', dateOfBirth: '2007-10-07' };
    expect(icd10ListProblems(['F68.0'], listOf(F680), { serviceDate: '2026-10-07', patient: born })).toHaveLength(1);
    expect(icd10ListProblems(['F68.0'], listOf(F680), { serviceDate: '2027-10-07', patient: born })).toEqual([]);
  });

  it('says nothing about sex or age when the patient file does not say', () => {
    expect(icd10ListProblems(['N92.2'], listOf(N922), { serviceDate: '2026-10-07', patient: { gender: '', dateOfBirth: null } })).toEqual([]);
  });

  it('tidies typed codes, reports each code once and leaves malformed codes to the shape check', () => {
    expect(icd10ListProblems(['j069', 'J06.9', 'J6'], listOf(J069))).toEqual([]);
  });
});

describe('notes on the options of the code search', () => {
  it('marks what cannot be used in that place, in plain words', () => {
    expect(icd10OptionNote(J06, 'other')).toBe('Category heading: choose a code under it');
    expect(icd10OptionNote(D630, 'main')).toBe('Asterisk code: not the main code');
    expect(icd10OptionNote(D630, 'other')).toBeNull();
    expect(icd10OptionNote(B952, 'main')).toBe('Not the main diagnosis');
    expect(icd10OptionNote(C832, 'other')).toBe('No longer valid');
    expect(icd10OptionNote(J069, 'main')).toBeNull();
  });
});

// Practitioners type codes the way they remember them ("j069", "a000") or the words they would say ("sore throat")
describe('reading what was typed in the code search', () => {
  it('reads one code-like token as the start of a code, with or without the dot', () => {
    expect(parseIcd10Query('a000')).toEqual({ code: 'A00.0', words: ['a000'] });
    expect(parseIcd10Query(' J06 ')).toEqual({ code: 'J06', words: ['j06'] });
    expect(parseIcd10Query('j06.9')).toEqual({ code: 'J06.9', words: ['j06', '9'] });
  });

  it('reads anything else as words, letters and digits only', () => {
    expect(parseIcd10Query('Type 2 diabetes')).toEqual({ code: null, words: ['type', '2', 'diabetes'] });
    expect(parseIcd10Query("can't sleep")).toEqual({ code: null, words: ['can', 't', 'sleep'] });
    expect(parseIcd10Query('G6PD')).toEqual({ code: null, words: ['g6pd'] });
    expect(parseIcd10Query('   ')).toEqual({ code: null, words: [] });
  });

  it('matches the start of a code or the start of every word, like the database search', () => {
    expect(matchesIcd10Query(J069, parseIcd10Query('j06'))).toBe(true);
    expect(matchesIcd10Query(J069, parseIcd10Query('acute resp'))).toBe(true);
    expect(matchesIcd10Query(J069, parseIcd10Query('cute'))).toBe(false);
    expect(matchesIcd10Query(J069, parseIcd10Query('acute asthma'))).toBe(false);
  });
});

describe('the options under the code search', () => {
  const suggested = (item: Icd10MasterEntry): Icd10Option => ({ code: item.code, entry: item, suggested: true });
  const I10 = entry('I10', 'Essential (primary) hypertension');

  // The practice's usual codes and the line's suggested codes are what is picked most: they come first
  it('shows the suggestions before anything is typed', () => {
    expect(icd10Options('', [suggested(J069), suggested(I10)], [C341]).map(option => option.code)).toEqual(['J06.9', 'I10']);
  });

  it('puts the exact code first, then the matching suggestions, then the other results, each once', () => {
    const results = [J06, J069, entry('J06.0', 'Acute laryngopharyngitis')];
    const options = icd10Options('j06', [suggested(J069), suggested(I10)], results);
    expect(options.map(option => [option.code, option.suggested])).toEqual([
      ['J06', false],
      ['J06.9', true],
      ['J06.0', false]
    ]);
  });

  it('keeps a suggestion whose description could not be read, and fills it in when the search found it', () => {
    const options = icd10Options('j06.9', [{ code: 'J06.9', entry: null, suggested: true }], [J069]);
    expect(options).toEqual([{ code: 'J06.9', entry: J069, suggested: true }]);
  });

  it('stops at the limit', () => {
    expect(icd10Options('j', [], [J06, J069, C341], 2)).toHaveLength(2);
  });
});

// A code chosen under the visit diagnosis goes into the diagnosis text, where the billing lines suggest it and the
// problem list offers it; the first code written there becomes a line's main code
describe('adding a chosen code to the visit diagnosis', () => {
  it('adds the code and its description on a line of its own', () => {
    expect(addIcd10ToDiagnosis('', 'J06.9', 'Acute upper respiratory infection, unspecified')).toBe('J06.9 Acute upper respiratory infection, unspecified');
    expect(addIcd10ToDiagnosis('Sore throat for 3 days  \n', 'J02.9', 'Acute pharyngitis, unspecified')).toBe(
      'Sore throat for 3 days\nJ02.9 Acute pharyngitis, unspecified'
    );
  });

  it('does not add a code that is already written in the diagnosis', () => {
    expect(addIcd10ToDiagnosis('URTI J06.9', 'J06.9', 'Acute upper respiratory infection, unspecified')).toBe('URTI J06.9');
  });

  it('adds the code alone when the list could not give its description', () => {
    expect(addIcd10ToDiagnosis(null, 'I10', null)).toBe('I10');
  });
});

describe('the age ranges the list writes', () => {
  // The load script refuses a list with a range this does not understand, so a newer list cannot slip past the check
  it('reads the four forms in the 2021 list, in whole years', () => {
    expect(parseIcd10AgeRange('≤ 19 years')).toEqual({ min: null, max: 19 });
    expect(parseIcd10AgeRange('≤19 years')).toEqual({ min: null, max: 19 });
    expect(parseIcd10AgeRange('≤ 1 year')).toEqual({ min: null, max: 1 });
    expect(parseIcd10AgeRange('> 19 years')).toEqual({ min: 20, max: null });
  });

  it('reads the other comparisons and spans, and nothing else', () => {
    expect(parseIcd10AgeRange('< 15 years')).toEqual({ min: null, max: 14 });
    expect(parseIcd10AgeRange('>= 65 years')).toEqual({ min: 65, max: null });
    expect(parseIcd10AgeRange('5 - 14 years')).toEqual({ min: 5, max: 14 });
    expect(parseIcd10AgeRange('')).toBeNull();
    expect(parseIcd10AgeRange('adults')).toBeNull();
  });
});

describe('a row of icd10_codes as the app reads it', () => {
  it('keeps the flags, the sex the code is for and whether it was discontinued', () => {
    expect(
      toIcd10MasterEntry({
        code: 'N92.2',
        description: ' Excessive menstruation at puberty ',
        valid_clinical_use: true,
        valid_primary: true,
        is_asterisk: false,
        age_range: '≤19 years',
        gender: 'f',
        status: 'D',
        sa_end_date: '2014-06-30'
      })
    ).toEqual({ ...N922, ageRange: '≤19 years', discontinued: true, endDate: '2014-06-30' });
  });
});
