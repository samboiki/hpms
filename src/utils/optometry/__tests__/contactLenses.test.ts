import { describe, expect, it } from 'vitest';
import { emptySupplyDraft, runOutState, suggestedRunOut, supplyRunsOutOn, validateSupplyDraft, type SupplyDraft } from '../contactLenses';

const TODAY = '2026-10-08';

// Business rule: the patient is reminded before the lenses run out, so the day they run out must be right
describe('when a contact-lens supply runs out', () => {
  it('counts one lens per eye per replacement period', () => {
    expect(supplyRunsOutOn(TODAY, 'daily', 90)).toBe('2027-01-06');
    expect(supplyRunsOutOn(TODAY, 'two_weekly', 6)).toBe('2026-12-31');
    expect(supplyRunsOutOn(TODAY, 'monthly', 6)).toBe('2027-04-08');
    expect(supplyRunsOutOn(TODAY, 'three_monthly', 2)).toBe('2027-04-08');
    expect(supplyRunsOutOn(TODAY, 'yearly', 1)).toBe('2027-10-08');
  });

  it('keeps month-end supplies on the last day of a short month', () => {
    expect(supplyRunsOutOn('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
  });

  it('says a supply is running out two weeks before, and out after the day', () => {
    expect(runOutState('2026-10-22', TODAY)).toBe('soon');
    expect(runOutState('2026-10-23', TODAY)).toBe('ok');
    expect(runOutState('2026-10-07', TODAY)).toBe('out');
    expect(runOutState(null, TODAY)).toBeNull();
  });
});

describe('recording a supply', () => {
  const form = (values: Partial<SupplyDraft>): SupplyDraft => ({
    ...emptySupplyDraft(TODAY, 'Monthly silicone hydrogel'),
    replacement: 'monthly',
    lensesPerEye: '6',
    ...values
  });

  it('suggests the run-out day from the day the patient starts', () => {
    expect(suggestedRunOut(form({}))).toBe('2027-04-08');
    expect(suggestedRunOut(form({ lensesPerEye: '' }))).toBeNull();
  });

  it('needs the run-out day for lenses handed over now, after the day they were collected', () => {
    expect(validateSupplyDraft(form({ runsOutOn: '' }), TODAY)).toMatchObject({ ok: false, errors: { runsOutOn: expect.any(String) } });
    expect(validateSupplyDraft(form({ runsOutOn: TODAY }), TODAY)).toMatchObject({ ok: false, errors: { runsOutOn: expect.any(String) } });
    expect(validateSupplyDraft(form({ runsOutOn: '2027-04-08' }), TODAY)).toMatchObject({
      ok: true,
      payload: { status: 'collected', collected_on: TODAY, runs_out_on: '2027-04-08', lenses_per_eye: 6 }
    });
  });

  it('leaves the days open for lenses ordered from the supplier: the supply starts when the patient collects it', () => {
    expect(validateSupplyDraft(form({ status: 'ordered' }), TODAY)).toMatchObject({ ok: true, payload: { status: 'ordered', collected_on: null, runs_out_on: null } });
  });

  it('refuses a collection day still to come', () => {
    expect(validateSupplyDraft(form({ startOn: '2026-10-09', runsOutOn: '2027-04-09' }), TODAY)).toMatchObject({ ok: false, errors: { startOn: expect.any(String) } });
  });

  it('needs the lens name, the replacement and how many lenses each eye has', () => {
    const result = validateSupplyDraft(form({ lensName: ' ', replacement: '', lensesPerEye: '0' }), TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['lensName', 'lensesPerEye', 'replacement', 'runsOutOn']);
  });
});
