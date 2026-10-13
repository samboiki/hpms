import { describe, expect, it } from 'vitest';
import {
  accountKey,
  canonicalAccountNumber,
  isMobileNumber,
  parseImportDate,
  parseMoneyCents,
  readLanguage,
  readRelationship,
  readSex,
  sexFromTitle,
  splitFullName
} from '../importValues';

const TODAY = '2026-10-07';

describe('parseImportDate', () => {
  it('reads the date forms an Eminance export uses, so no birthday or recall is lost to formatting', () => {
    expect(parseImportDate('2026/10/07', TODAY)).toBe('2026-10-07'); // Firebird and South African Windows
    expect(parseImportDate('07/10/2026', TODAY)).toBe('2026-10-07'); // day first, as Namibia writes it
    expect(parseImportDate('20261007', TODAY)).toBe('2026-10-07'); // claim files
    expect(parseImportDate('7 Oct 2026', TODAY)).toBe('2026-10-07');
    expect(parseImportDate('07-Okt-2026', TODAY)).toBe('2026-10-07'); // Afrikaans month
    expect(parseImportDate('2026-10-07 00:00:00', TODAY)).toBe('2026-10-07');
    expect(parseImportDate(new Date(2026, 9, 7), TODAY)).toBe('2026-10-07'); // Excel date cell
    expect(parseImportDate(46302, TODAY)).toBe('2026-10-07'); // Excel serial number
  });

  it('reads day first unless the second number cannot be a month, so 03/04 is 3 April but 10/25 is 25 October', () => {
    expect(parseImportDate('03/04/2026', TODAY)).toBe('2026-04-03');
    expect(parseImportDate('10/25/2026', TODAY)).toBe('2026-10-25');
  });

  it('puts a two-digit birth year in the past (45 is 1945) but a recall in this century (27 is 2027)', () => {
    expect(parseImportDate('05/03/45', TODAY, 'past')).toBe('1945-03-05');
    expect(parseImportDate('05/03/20', TODAY, 'past')).toBe('2020-03-05');
    expect(parseImportDate('05/03/27', TODAY, 'near')).toBe('2027-03-05');
  });

  it('refuses dates that do not exist instead of rolling them over, so 31 February never becomes 3 March', () => {
    expect(parseImportDate('31/02/2026', TODAY)).toBeNull();
    expect(parseImportDate('not a date', TODAY)).toBeNull();
    expect(parseImportDate('', TODAY)).toBeNull();
  });
});

describe('parseMoneyCents', () => {
  it('reads amounts with a decimal comma or point and thousands spaces, as South African builds export them', () => {
    expect(parseMoneyCents('1 234,56')).toBe(123456);
    expect(parseMoneyCents('1,234.56')).toBe(123456);
    expect(parseMoneyCents('1.234,56')).toBe(123456);
    expect(parseMoneyCents('N$ 250.50')).toBe(25050);
    expect(parseMoneyCents('R250,5')).toBe(25050);
    expect(parseMoneyCents(99.99)).toBe(9999);
  });

  it('reads every way a report shows a credit, because unallocated money must reduce the debt, not add to it', () => {
    expect(parseMoneyCents('-150.00')).toBe(-15000);
    expect(parseMoneyCents('150.00-')).toBe(-15000);
    expect(parseMoneyCents('(150.00)')).toBe(-15000);
    expect(parseMoneyCents('150.00 CR')).toBe(-15000);
    expect(parseMoneyCents('150.00 DR')).toBe(15000);
  });

  it('gives null for an empty or non-numeric cell, so a blank age column is not a zero mistaken for data', () => {
    expect(parseMoneyCents('')).toBeNull();
    expect(parseMoneyCents('-')).toBeNull();
    expect(parseMoneyCents('n/a')).toBeNull();
  });
});

describe('account numbers', () => {
  it('restores the leading zeros Excel drops, because staff and statements know the account as 0001234', () => {
    expect(canonicalAccountNumber(1234)).toBe('0001234');
    expect(canonicalAccountNumber('1234.0')).toBe('0001234');
    expect(canonicalAccountNumber(' 0001234 ')).toBe('0001234');
  });

  it('keeps lettered account numbers (prefix or surname numbering) as they are, in capitals', () => {
    expect(canonicalAccountNumber('kan001')).toBe('KAN001');
  });

  it('matches the same account however many zeros a file shows', () => {
    expect(accountKey('0001234')).toBe(accountKey('1234'));
    expect(accountKey('KAN001')).toBe('KAN001');
  });
});

describe('sex, relationship, names and language', () => {
  it("reads English and Eminance's Afrikaans letters (M/V), but leaves codes like 0/1/2 to staff, whose meaning is unknown", () => {
    expect(readSex('F')).toBe('female');
    expect(readSex('V')).toBe('female');
    expect(readSex('Male')).toBe('male');
    expect(readSex('1')).toBeNull();
  });

  it('can tell sex from a title (Mrs, Mev, Mnr), the fall-back when the sex column is empty', () => {
    expect(sexFromTitle('Mrs.')).toBe('female');
    expect(sexFromTitle('Mnr')).toBe('male');
    expect(sexFromTitle('Dr')).toBeNull();
  });

  it('reads relationships in words in both languages but leaves a numeric RELATIONSHIP_KEY to staff', () => {
    expect(readRelationship('Main member')).toBe('self');
    expect(readRelationship('Hooflid')).toBe('self');
    expect(readRelationship('Wife')).toBe('spouse');
    expect(readRelationship('Seun')).toBe('child');
    expect(readRelationship('3')).toBeNull();
  });

  it('splits a one-column name both ways round, keeping surname particles with the surname', () => {
    expect(splitFullName('KANDEMO, Ndeshi Maria')).toEqual({ surname: 'KANDEMO', firstName: 'Ndeshi Maria' });
    expect(splitFullName('Mr Pieter van der Testa')).toEqual({ firstName: 'Pieter', surname: 'van der Testa' });
    expect(splitFullName('Kandemo')).toEqual({ firstName: '', surname: 'Kandemo' });
  });

  it('maps languages to the four the patient file accepts and ignores code numbers', () => {
    expect(readLanguage('Engels')).toBe('English');
    expect(readLanguage('A')).toBe('Afrikaans');
    expect(readLanguage('Oshindonga')).toBe('Oshiwambo');
    expect(readLanguage('Otjiherero')).toBe('Other');
    expect(readLanguage('2')).toBeNull();
  });

  it('only takes a phone number as the cell number when it is a Namibian mobile, so a landline never gets SMSes', () => {
    expect(isMobileNumber('081 234 5678')).toBe(true);
    expect(isMobileNumber('061 234 567')).toBe(false);
  });
});
