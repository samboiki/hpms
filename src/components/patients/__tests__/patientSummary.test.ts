import { describe, it, expect } from 'vitest';
import { ageInYears, countRegisteredInMonth, describeMedicalAidRelationship } from '../patientSummary';

// Local dates, as staff in Namibia see them
const on = (year: number, month: number, day: number) => new Date(year, month - 1, day, 9, 0, 0);

describe('ageInYears', () => {
  it('adds the year on the birthday itself, so a patient is never shown a year younger that day', () => {
    // The old formula (elapsed ms / 365.25 days) still said 25 here
    expect(ageInYears('2000-10-06', on(2026, 10, 6))).toBe(26);
    expect(ageInYears('2000-10-07', on(2026, 10, 6))).toBe(25);
  });

  it('keeps a 17-year-old a minor until the 18th birthday, unlike a year-only subtraction', () => {
    expect(ageInYears('2008-12-20', on(2026, 1, 15))).toBe(17);
  });

  it('returns 0 for babies under one, which is a real age', () => {
    expect(ageInYears('2026-03-01', on(2026, 10, 6))).toBe(0);
  });

  it('returns null instead of a made-up age when the date of birth is missing, unreadable or in the future', () => {
    expect(ageInYears(undefined, on(2026, 10, 6))).toBeNull();
    expect(ageInYears('', on(2026, 10, 6))).toBeNull();
    expect(ageInYears('not a date', on(2026, 10, 6))).toBeNull();
    expect(ageInYears('2030-01-01', on(2026, 10, 6))).toBeNull();
  });
});

describe('countRegisteredInMonth', () => {
  const today = on(2026, 10, 6);

  it('counts only patients registered this calendar month, replacing the old "15% of all patients" guess', () => {
    const patients = [
      { created_at: '2026-10-02T12:00:00+02:00' },
      { created_at: '2026-10-05T16:30:00.123456+00:00' },
      { created_at: '2026-09-30T10:00:00+02:00' },
      { created_at: '2025-10-15T10:00:00+02:00' }
    ];
    expect(countRegisteredInMonth(patients, today)).toBe(2);
  });

  it('ignores records without a usable registration date rather than guessing', () => {
    expect(countRegisteredInMonth([{ created_at: null }, {}, { created_at: 'unknown' }], today)).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(countRegisteredInMonth([], today)).toBe(0);
  });
});

describe('describeMedicalAidRelationship', () => {
  it('shows every stored spelling of the main member as "Main member", never as a dependent', () => {
    // The registration form saves "self"; it used to be shown as "Dependent (self)"
    expect(describeMedicalAidRelationship('self')).toBe('Main member');
    expect(describeMedicalAidRelationship('Self')).toBe('Main member');
    expect(describeMedicalAidRelationship('main_member')).toBe('Main member');
    expect(describeMedicalAidRelationship('Main Member')).toBe('Main member');
  });

  it('names the relationship of dependents', () => {
    expect(describeMedicalAidRelationship('spouse')).toBe('Dependent (spouse)');
    expect(describeMedicalAidRelationship('child')).toBe('Dependent (child)');
  });

  it('says the relationship is not recorded instead of showing an empty "Dependent ()"', () => {
    expect(describeMedicalAidRelationship('')).toBe('Relationship not recorded');
    expect(describeMedicalAidRelationship(null)).toBe('Relationship not recorded');
  });
});
