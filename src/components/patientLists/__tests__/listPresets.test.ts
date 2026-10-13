import { describe, it, expect } from 'vitest';
import { LIST_PRESETS, presetsFor } from '../listPresets';
import { validateRule } from '../../../utils/patientLists/listRules';

// Business rule: OneHealth serves GPs, specialists and dentists. A recall by treatment follows the codes the
// practice bills: scale and polish (8159) is a dental code, so a GP or urologist must choose their own codes.
describe('ready-made lists per kind of practice', () => {
  const recall = (practiceType: string | null) => presetsFor(practiceType).find(preset => preset.id === 'recall_by_code')!;

  it('gives a dental practice the one-tap scale-and-polish recall', () => {
    const preset = recall('dental');
    expect(preset.rule).toEqual({ type: 'recall_by_code', months: 6, codes: ['8159'] });
    expect(preset.askForCodes).toBeFalsy();
    expect(validateRule(preset.rule).ok).toBe(true);
  });

  it('asks any other practice for its own codes, and only accepts the list once codes are given', () => {
    for (const practiceType of ['general_practice', 'specialist', null]) {
      const preset = recall(practiceType);
      expect(preset.askForCodes).toBe(true);
      expect(validateRule(preset.rule).ok).toBe(false); // no codes yet: never a list of nobody by accident
      expect(validateRule({ ...preset.rule, codes: ['0190'] })).toEqual({ ok: true, rule: { type: 'recall_by_code', months: 6, codes: ['0190'] } });
    }
  });

  it('leaves every other ready-made list the same for all practices', () => {
    const others = (practiceType: string | null) => presetsFor(practiceType).filter(preset => preset.id !== 'recall_by_code');
    expect(others('general_practice')).toEqual(others('dental'));
    expect(presetsFor('dental')).toBe(LIST_PRESETS);
  });
});

// Business rule: only a practice that dispenses has repeats to remind about (Stock > Settings > We dispense medicine),
// whatever its discipline
describe('the repeat medicine list', () => {
  it('is offered to a practice that dispenses, in every discipline, and to nobody else', () => {
    for (const practiceType of ['dental', 'general_practice', null]) {
      expect(presetsFor(practiceType, { dispenses: true }).some(preset => preset.id === 'repeat_medicine_due')).toBe(true);
      expect(presetsFor(practiceType).some(preset => preset.id === 'repeat_medicine_due')).toBe(false);
    }
  });
});

// Business rule: only optometrists hand out contact lenses; the "running out" list is theirs alone, and every other
// practice's ready-made lists stay as they were
describe('the contact lenses running out list', () => {
  it('is offered to an optometry practice and to nobody else', () => {
    expect(presetsFor('optometry').some(preset => preset.id === 'contact_lenses_running_out')).toBe(true);
    for (const practiceType of ['dental', 'general_practice', 'specialist', null]) {
      expect(presetsFor(practiceType).some(preset => preset.id === 'contact_lenses_running_out')).toBe(false);
    }
  });

  it('has a valid rule and a message that tells the patient whom to call', () => {
    const preset = presetsFor('optometry', { dispenses: true }).find(item => item.id === 'contact_lenses_running_out')!;
    expect(validateRule(preset.rule)).toEqual({ ok: true, rule: { type: 'contact_lenses_running_out', withinDays: 14 } });
    expect(preset.automation.template).toContain('{{practice_phone}}');
    expect(presetsFor('optometry', { dispenses: true }).some(item => item.id === 'repeat_medicine_due')).toBe(true);
  });
});
