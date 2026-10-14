import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { icd10ListProblems, toIcd10MasterEntry, type Icd10MasterRow } from '../icd10Master';
import { DENTAL_ICD10_BY_CODE } from '../dentalIcd10Map';
import { USUAL_ICD10_BY_CODE } from '../tariffRules';

// The list is written in two files: the first (OneHealth's own reasoning), then a follow-up that adds the links that
// follow a published South African coding standard and re-labels one row of the first
const FILES = ['proposals/2026-10-14-tariff-icd10-suggestions.sql', 'proposals/2026-10-14-tariff-icd10-suggestions-standards.sql'];
const sql = FILES.map(file => readFileSync(file, 'utf8'));

interface StarterRule {
  codes: string[];
  disciplines: string[];
  icd10: string;
  sortOrder: number;
  /** The standard a link follows (DSN2104); null for OneHealth's own reasoning */
  reference: string | null;
  rationale: string;
}

const quoted = (list: string): string[] => [...list.matchAll(/'([^']*)'/g)].map(match => match[1]);

/** The lines of a proposal's rows: (ARRAY[codes], ARRAY[disciplines], 'ICD-10', order, ['DSN....',] 'reason'). */
const LINE = /^[ \t]+\(ARRAY\[([^\]]*)\], ARRAY\[([^\]]*)\], '([A-Z][0-9]{2}\.[0-9]{1,2})', ([0-9]), (?:'(DSN[0-9]{4})', )?'((?:[^']|'')*)'\),?$/gm;
const rulesOf = (text: string): StarterRule[] =>
  [...text.matchAll(LINE)].map(match => ({
    codes: quoted(match[1]),
    disciplines: quoted(match[2]),
    icd10: match[3],
    sortOrder: Number(match[4]),
    reference: match[5] ?? null,
    rationale: match[6].replace(/''/g, "'")
  }));
const expand = (rules: readonly StarterRule[]) => rules.flatMap(rule => rule.codes.flatMap(code => rule.disciplines.map(discipline => ({ discipline, code, ...rule }))));

const [first, followUp] = sql.map(rulesOf);
const rules = [...first, ...followUp];
// The follow-up wins for a row both files write (it re-labels the dental therapist's full mouth examination)
const byRow = new Map(expand(rules).map(item => [`${item.discipline}|${item.code}|${item.icd10}`, item]));
const rows = [...byRow.values()];

/**
 * The medical aids' ICD-10 list (icd10_codes: the SA ICD-10 MIT 2021 that Namibian funds check claims against) for exactly
 * the codes the starter list uses, as the table gave them on 14 Oct 2026. A newly suggested code needs its row here,
 * copied from the table, so it is checked before it reaches a claim.
 */
const row = (code: string, description: string, extra: Partial<Icd10MasterRow> = {}): Icd10MasterRow => ({
  code, description, valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null, ...extra
});
const LIST_ROWS: readonly Icd10MasterRow[] = [
  row('Z00.1', 'Routine child health examination', { age_range: '≤ 19 years', status: 'M' }),
  row('Z01.0', 'Examination of eyes and vision'),
  row('Z01.1', 'Examination of ears and hearing'),
  row('Z01.2', 'Dental examination'),
  row('Z01.8', 'Other specified special examinations'),
  row('Z13.5', 'Special screening examination for eye and ear disorders'),
  row('Z26.9', 'Need for immunization against unspecified infectious disease'),
  row('Z30.1', 'Insertion of (intrauterine) contraceptive device', { gender: 'F', status: 'M' }),
  row('Z30.2', 'Sterilization'),
  row('Z30.8', 'Other contraceptive management'),
  row('Z30.9', 'Contraceptive management, unspecified'),
  row('Z34.9', 'Supervision of normal pregnancy, unspecified', { gender: 'F', status: 'M' }),
  row('Z36.9', 'Antenatal screening, unspecified', { gender: 'F', status: 'M' }),
  row('Z39.2', 'Routine postpartum follow-up', { gender: 'F', status: 'M' }),
  row('Z46.0', 'Fitting and adjustment of spectacles and contact lenses'),
  row('Z50.6', 'Orthoptic training'),
  row('Z53.2', "Procedure not carried out because of patient's decision for other and unspecified reasons"),
  row('Z53.9', 'Procedure not carried out, unspecified reason'),
  row('Z71.3', 'Dietary counselling and surveillance'),
  row('Z71.8', 'Other specified counselling'),
  row('Z76.2', 'Health supervision and care of other healthy infant and child')
];
const master = new Map(LIST_ROWS.map(item => [item.code, toIcd10MasterEntry(item)]));

// Business rule: the starter list is OneHealth's own suggestion, not a NAMAF or fund table. Every code in it must pass
// the same checks a claim line passes, or the practitioner would be offered a code the fund then rejects.
describe('the starter ICD-10 list in the proposals', () => {
  it('has the rows the proposals say they have', () => {
    expect(first.length).toBeGreaterThan(20);
    expect(expand(first)).toHaveLength(Number(/The starter rows \((\d+)\)/.exec(sql[0])?.[1]));
    expect(rows).toHaveLength(Number(/(\d+) starter rows in all/.exec(sql[1])?.[1]));
    // 59 new rows and one re-labelled: 60 rows follow a standard
    expect(expand(followUp)).toHaveLength(Number(/(\d+) new rows/.exec(sql[1])?.[1]) + 1);
  });

  it("uses only codes that can be the main code of a claim line in the medical aids' list", () => {
    const used = [...new Set(rows.map(item => item.icd10))];
    used.forEach(code => {
      expect(master.has(code), `${code} is missing from LIST_ROWS in this test: copy its row from icd10_codes`).toBe(true);
      expect(icd10ListProblems([code], master).filter(problem => problem.severity === 'error'), code).toEqual([]);
    });
  });

  // Z23, Z30, Z34 and Z01 are category headings in the list: the funds reject them, only the 4th character names a case
  it('never uses a category heading such as Z23', () => {
    expect(rows.filter(item => !/^[A-Z][0-9]{2}\.[0-9]{1,2}$/.test(item.icd10))).toEqual([]);
    expect(icd10ListProblems(['Z23'], new Map([['Z23', toIcd10MasterEntry(row('Z23', 'Need for immunization against single bacterial diseases', { valid_clinical_use: false, valid_primary: false }))]])).map(problem => problem.severity)).toEqual(['error']);
  });

  it('gives each tariff code of a discipline different codes, in an order, once each', () => {
    const order = new Map<string, number[]>();
    rows.forEach(item => order.set(`${item.discipline}|${item.code}`, [...(order.get(`${item.discipline}|${item.code}`) ?? []), item.sortOrder]));
    order.forEach((orders, key) => expect(new Set(orders).size, key).toBe(orders.length));
    // Each row once inside a file, too
    sql.forEach((_, index) => {
      const seen = new Set<string>();
      expand(index === 0 ? first : followUp).forEach(item => {
        const key = `${item.discipline}|${item.code}|${item.icd10}`;
        expect(seen.has(key), key).toBe(false);
        seen.add(key);
      });
    });
  });

  // The reason is shown under the code in the billing line; it has to read as a suggestion in plain words, not as a rule
  it('has a short plain reason for every row, and none that sounds like a rule or an official link', () => {
    rules.forEach(rule => {
      expect(rule.rationale.length, rule.rationale).toBeGreaterThanOrEqual(5);
      expect(rule.rationale.length, rule.rationale).toBeLessThanOrEqual(140);
      expect(rule.rationale, rule.rationale).not.toMatch(/\b(official|required|must|mandatory|NAMAF says|rule|standard)\b/i);
    });
  });

  // The app adds "(South African coding standard)" to these; it is not NAMAF's, and a link may only say so if it names one
  it('names a published standard only on the links that follow one, and keeps those inside the standards it read', () => {
    expect(first.every(rule => rule.reference === null)).toBe(true);
    const named = followUp.filter(rule => rule.reference !== null);
    expect(named.length).toBeGreaterThan(0);
    // The standards (Diagnosis Standard National 21) whose situations a NAMAF code names
    expect([...new Set(named.map(rule => rule.reference))].sort()).toEqual(['DSN2104', 'DSN2105', 'DSN2112', 'DSN2114', 'DSN2120']);
    expect(followUp.every(rule => rule.reference !== null)).toBe(true);
  });

  it('keeps discipline and code in the shapes the table checks', () => {
    rows.forEach(item => {
      expect(item.discipline, item.discipline).toMatch(/^[0-9]{3}([0-9]{3})?$/);
      expect(item.code, item.code).toMatch(/^[0-9A-Z]{1,10}$/);
    });
  });

  // Rule 7: where two sources disagree, one wins. The owner's dental sheet decides dentists' 4-digit codes
  // (dentalIcd10Map.ts, tariffRules.ts), so the starter list must not repeat or contradict them
  it("does not touch the dentists' codes the owner's dental sheet already decides", () => {
    const decided = new Set([...Object.keys(DENTAL_ICD10_BY_CODE), ...Object.keys(USUAL_ICD10_BY_CODE)]);
    const dentalDisciplines = new Set(['054', '054400', '062', '064', '092', '093', '094', '095', '096', '098', '113']);
    expect(rows.filter(item => dentalDisciplines.has(item.discipline) && decided.has(item.code))).toEqual([]);
  });

  it('is written for the codes whose wording names the situation, not for every code', () => {
    // A starter list for all 44,000 codes would be guesses; this one is a few hundred rows at most
    expect(rows.length).toBeLessThan(400);
    expect(new Set(rows.map(item => item.discipline)).size).toBeLessThan(80);
  });
});
