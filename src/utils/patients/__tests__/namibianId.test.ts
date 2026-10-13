import { describe, expect, it } from 'vitest';
import { birthDateFromNamibianId, birthDateMismatch, birthDateToFill, checkIdNumber, normalizeIdNumber } from '../namibianId';

// Invented numbers: only the first six digits (the date of birth) mean anything here.
const TODAY = '2026-10-07';

describe('normalizeIdNumber', () => {
  it('saves the number without the spaces and dashes reception types from the card, so searches and duplicate checks match', () => {
    expect(normalizeIdNumber(' 9005 1400 123 ')).toBe('90051400123');
    expect(normalizeIdNumber('900514-00123')).toBe('90051400123');
    expect(normalizeIdNumber('p1234567')).toBe('P1234567');
  });
});

describe('birthDateFromNamibianId', () => {
  it('reads YYMMDD as the date of birth, so reception does not type it twice', () => {
    expect(birthDateFromNamibianId('90051400123', TODAY)).toBe('1990-05-14');
  });

  it('puts a two-digit year in this century only when that date has already happened', () => {
    // 2005 is in the past: a 21-year-old
    expect(birthDateFromNamibianId('05031200456', TODAY)).toBe('2005-03-12');
    // 2027 is in the future, so the holder was born in 1927
    expect(birthDateFromNamibianId('27010100789', TODAY)).toBe('1927-01-01');
    // later this year is still in the future today
    expect(birthDateFromNamibianId('26120100789', TODAY)).toBe('1926-12-01');
  });

  it('refuses impossible dates instead of guessing one', () => {
    expect(birthDateFromNamibianId('90133100123', TODAY)).toBeNull(); // month 13
    expect(birthDateFromNamibianId('01022900123', TODAY)).toBeNull(); // 29 Feb 2001 and 1901
    expect(birthDateFromNamibianId('9005140012', TODAY)).toBeNull(); // 10 digits
  });

  it('accepts 29 February in a leap year', () => {
    expect(birthDateFromNamibianId('00022900123', TODAY)).toBe('2000-02-29');
  });
});

describe('checkIdNumber', () => {
  it('fills the date of birth from a valid Namibian number without any warning', () => {
    expect(checkIdNumber('90051400123', TODAY)).toEqual({
      kind: 'namibian',
      normalized: '90051400123',
      dateOfBirth: '1990-05-14',
      warning: null
    });
  });

  it('never reads the sex from the number: no public source says any digit encodes it', () => {
    const check = checkIdNumber('90051400123', TODAY);
    expect(Object.keys(check)).not.toContain('gender');
    expect(Object.keys(check)).not.toContain('sex');
  });

  it('warns about an 11-digit number whose first six digits are not a date (a typo would follow the patient onto every claim)', () => {
    const check = checkIdNumber('90133100123', TODAY);
    expect(check.dateOfBirth).toBeNull();
    expect(check.warning).toMatch(/not a date/);
  });

  it('only warns about a number of the wrong length, because passports and foreign IDs are allowed', () => {
    const check = checkIdNumber('123456789', TODAY);
    expect(check.kind).toBe('other');
    expect(check.warning).toMatch(/11 digits; this one has 9/);
  });

  it('says nothing about passport numbers with letters', () => {
    expect(checkIdNumber('P1234567', TODAY)).toMatchObject({ kind: 'other', warning: null, dateOfBirth: null });
  });

  it('treats an empty field as empty, not as an invalid number', () => {
    expect(checkIdNumber('  ', TODAY)).toMatchObject({ kind: 'empty', warning: null });
  });
});

describe('birthDateMismatch', () => {
  it('asks reception to check when the typed date of birth differs from the ID number', () => {
    const check = checkIdNumber('90051400123', TODAY);
    expect(birthDateMismatch(check, '1990-05-15')).toMatch(/does not match/);
    expect(birthDateMismatch(check, '1990-05-14')).toBeNull();
  });

  it('stays quiet when the number carries no date (passport) or no date of birth is entered yet', () => {
    expect(birthDateMismatch(checkIdNumber('P1234567', TODAY), '1990-05-14')).toBeNull();
    expect(birthDateMismatch(checkIdNumber('90051400123', TODAY), '')).toBeNull();
  });
});

// Reception types the ID number once and the date of birth follows (registration, and completing a file booked with a
// name and cell only); a date reception chose themselves, from a birth certificate for example, is never overwritten.
describe('birthDateToFill', () => {
  it('fills a blank date of birth from the ID number', () => {
    expect(birthDateToFill('1990-05-14', '', null)).toBe('1990-05-14');
  });

  it('follows a corrected ID number while the date is still the one it filled in', () => {
    expect(birthDateToFill('1990-05-15', '1990-05-14', '1990-05-14')).toBe('1990-05-15');
  });

  it('never replaces a date reception chose themselves', () => {
    expect(birthDateToFill('1990-05-14', '1991-02-03', null)).toBeNull();
  });
});
