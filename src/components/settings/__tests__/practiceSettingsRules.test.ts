/**
 * Settings > Practice rules decided by the owner on 13 Oct 2026: who sees the edit controls, the period the overhead
 * tiles add up, and where claim batch numbers continue after Eminance.
 */
import { describe, expect, it } from 'vitest';
import { canEditPracticeSettings, canEditProtectedPracticeDetails } from '../practiceSettingsAccess';
import {
  currentMonthKey,
  isInOverheadRange,
  overheadRange,
  overheadRangeLabel,
  parseOverheadPeriod
} from '../overheadPeriod';
import { lastBatchFromStart, nextClaimBatchNumber, parseLastBatchInput, startFromLastBatch } from '../claimBatchStart';

describe('who sees the edit controls in Settings > Practice', () => {
  it('administrators and doctors keep them: the database lets both change branches and departments (rls_is_practice_admin)', () => {
    expect(canEditPracticeSettings({ role: 'admin' })).toBe(true);
    expect(canEditPracticeSettings({ role: 'doctor' })).toBe(true);
    expect(canEditPracticeSettings({ role: 'receptionist', is_super_admin: true })).toBe(true);
  });

  it('receptionists and nurses see the same information read-only, so nobody meets a button that only fails', () => {
    expect(canEditPracticeSettings({ role: 'receptionist' })).toBe(false);
    expect(canEditPracticeSettings({ role: 'nurse' })).toBe(false);
    expect(canEditPracticeSettings(null)).toBe(false);
  });

  it("the practice's type and claim batch start are for role admin only, as the protected-columns trigger refuses doctors", () => {
    expect(canEditProtectedPracticeDetails({ role: 'admin' })).toBe(true);
    expect(canEditProtectedPracticeDetails({ role: 'doctor' })).toBe(false);
  });
});

describe('the period the overhead tiles add up', () => {
  // 13 Oct 2026, 23:30 in Windhoek (21:30 UTC); and 1 Nov 00:30 Windhoek is still 31 Oct in UTC
  const october13 = new Date(Date.UTC(2026, 9, 13, 21, 30));
  const november1Early = new Date(Date.UTC(2026, 9, 31, 22, 30));

  it('opens on this month, in Windhoek time, so "Fixed Monthly" no longer grows with every month ever recorded', () => {
    expect(currentMonthKey(october13)).toBe('2026-10');
    expect(currentMonthKey(november1Early)).toBe('2026-11');
    expect(overheadRange('month', null, october13)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('a picked month looks back to that whole month (February in a leap year included)', () => {
    expect(overheadRange('month', '2028-02', october13)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(overheadRange('month', 'garbage', october13)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it("the financial year is Namibia's tax year, 1 March to the end of February", () => {
    expect(overheadRange('financial_year', null, october13)).toEqual({ from: '2026-03-01', to: '2027-02-28' });
    expect(overheadRange('financial_year', null, new Date(Date.UTC(2027, 1, 10)))).toEqual({ from: '2026-03-01', to: '2027-02-28' });
    expect(overheadRange('financial_year', null, new Date(Date.UTC(2027, 2, 1, 6)))).toEqual({ from: '2027-03-01', to: '2028-02-29' });
  });

  it('counts an expense by its date; all time counts everything, even an undated one', () => {
    const october = overheadRange('month', '2026-10', october13);
    expect(isInOverheadRange('2026-10-31', october)).toBe(true);
    expect(isInOverheadRange('2026-11-01', october)).toBe(false);
    expect(isInOverheadRange(null, october)).toBe(false);
    expect(isInOverheadRange(null, overheadRange('all', null))).toBe(true);
  });

  it('says in words what the tiles cover', () => {
    expect(overheadRangeLabel('month', overheadRange('month', '2026-10', october13))).toBe('October 2026');
    expect(overheadRangeLabel('financial_year', overheadRange('financial_year', null, october13))).toBe('Financial year March 2026 to February 2027');
    expect(overheadRangeLabel('all', overheadRange('all', null))).toBe('All time');
  });

  it("reads the administrators' saved default safely: anything unknown or missing is this month", () => {
    expect(parseOverheadPeriod({ period: 'financial_year' })).toBe('financial_year');
    expect(parseOverheadPeriod({ period: 'all' })).toBe('all');
    expect(parseOverheadPeriod('all')).toBe('all');
    expect(parseOverheadPeriod({ period: 'week' })).toBe('month');
    expect(parseOverheadPeriod(null)).toBe('month');
  });
});

describe('claim batches continue after the last Eminance batch', () => {
  it('stores one more than the last Eminance batch, the first number OneHealth may use', () => {
    expect(startFromLastBatch(44)).toBe(45);
    expect(startFromLastBatch(null)).toBeNull();
    expect(lastBatchFromStart(45)).toBe(44);
    expect(lastBatchFromStart(null)).toBeNull();
    expect(lastBatchFromStart(1)).toBeNull();
  });

  it("shows the next number as the database gives it: after the highest batch used, never below the practice's start", () => {
    expect(nextClaimBatchNumber(null, 45)).toBe(45);
    expect(nextClaimBatchNumber(3, 45)).toBe(45);
    expect(nextClaimBatchNumber(50, 45)).toBe(51);
    expect(nextClaimBatchNumber(null, null)).toBe(1);
  });

  it('accepts a whole number or nothing, and says what is wrong otherwise', () => {
    expect(parseLastBatchInput(' 44 ')).toEqual({ ok: true, value: 44 });
    expect(parseLastBatchInput('')).toEqual({ ok: true, value: null });
    expect(parseLastBatchInput('4.5').ok).toBe(false);
    expect(parseLastBatchInput('0').ok).toBe(false);
    expect(parseLastBatchInput('abc').ok).toBe(false);
  });
});
