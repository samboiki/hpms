import { describe, expect, it } from 'vitest';
import {
  isAlreadyActive,
  suggestProblemsFromDiagnosis,
  summarizeActiveProblems,
  validateProblemInput,
  type ProblemLike
} from '../problemList';

const hypertension: ProblemLike = { description: 'Essential (primary) hypertension', icd10Code: 'I10', status: 'active' };

describe('suggestProblemsFromDiagnosis', () => {
  it('offers every ICD-10 code in the visit diagnosis, so a chronic condition is added in one tap', () => {
    expect(suggestProblemsFromDiagnosis('HPT I10, DM2 E11.9', [])).toEqual([
      { icd10Code: 'I10', description: 'Essential (primary) hypertension' },
      { icd10Code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' }
    ]);
  });

  it("keeps the practitioner's own words for a code outside the built-in list", () => {
    expect(suggestProblemsFromDiagnosis('Gout of the left foot M10.07', [])).toEqual([
      { icd10Code: 'M10.07', description: 'Gout of the left foot' }
    ]);
  });

  it('offers an uncoded diagnosis as written', () => {
    expect(suggestProblemsFromDiagnosis('  Chronic lower back pain ', [])).toEqual([
      { icd10Code: null, description: 'Chronic lower back pain' }
    ]);
  });

  it('leaves out what is already on the active list, so the list never fills with duplicates', () => {
    expect(suggestProblemsFromDiagnosis('Hypertension I10', [hypertension])).toEqual([]);
    expect(suggestProblemsFromDiagnosis('asthma', [{ description: 'Asthma', icd10Code: null, status: 'active' }])).toEqual([]);
  });

  it('offers a problem again when the earlier entry is in the past (a recurrence)', () => {
    expect(suggestProblemsFromDiagnosis('I10', [{ ...hypertension, status: 'past' }])).toHaveLength(1);
  });

  it('suggests nothing for an empty diagnosis', () => {
    expect(suggestProblemsFromDiagnosis('', [])).toEqual([]);
    expect(suggestProblemsFromDiagnosis(null, [])).toEqual([]);
  });
});

describe('validateProblemInput', () => {
  it('fills the description from a known code, so typing "i10" is enough', () => {
    expect(validateProblemInput({ description: '', icd10Code: 'i10' })).toEqual({
      ok: true,
      value: { description: 'Essential (primary) hypertension', icd10Code: 'I10' }
    });
  });

  it('refuses a malformed code instead of saving something a claim would reject', () => {
    expect(validateProblemInput({ description: 'Hypertension', icd10Code: 'HT1' })).toMatchObject({ ok: false });
  });

  it('needs at least a description or a code', () => {
    expect(validateProblemInput({ description: '  ', icd10Code: '' })).toMatchObject({ ok: false });
  });
});

describe('summarizeActiveProblems', () => {
  it('shows two active problems and counts the rest, to keep the alert strip one line', () => {
    const problems: ProblemLike[] = [
      { description: 'Hypertension', icd10Code: 'I10', status: 'active' },
      { description: 'Asthma', icd10Code: null, status: 'past' },
      { description: 'Type 2 diabetes', icd10Code: 'E11.9', status: 'active' },
      { description: 'Gout', icd10Code: null, status: 'active' }
    ];
    expect(summarizeActiveProblems(problems)).toBe('Hypertension, Type 2 diabetes +1 more');
    expect(summarizeActiveProblems([])).toBeNull();
  });
});

describe('isAlreadyActive', () => {
  it('matches coded problems by code even when worded differently', () => {
    expect(isAlreadyActive({ icd10Code: 'I10', description: 'HPT' }, [hypertension])).toBe(true);
  });
});
