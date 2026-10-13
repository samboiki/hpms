import { describe, it, expect } from 'vitest';
import { DENTAL_ICD10_BY_CODE } from '../dentalIcd10Map';
import { USUAL_ICD10_BY_CODE } from '../tariffRules';
import { validateIcd10Selection } from '../icd10';
import { icd10ListProblems, toIcd10MasterEntry, type Icd10MasterRow } from '../icd10Master';
import { suggestLineIcd10 } from '../icd10Defaults';

// Business rule: a suggested diagnosis must itself pass the claim check; a suggestion the check then rejects
// would put an error on the claim line that the doctor cannot explain.
describe('dental ICD-10 suggestions', () => {
  const all = { ...DENTAL_ICD10_BY_CODE, ...USUAL_ICD10_BY_CODE };

  it.each(Object.entries(all))('%s -> %s is a valid primary diagnosis', (_code, icd10) => {
    expect(validateIcd10Selection({ primary: icd10, secondary: [] }).errors).toEqual([]);
  });

  it('covers the NAMAF dental codes only (4 digits, 8xxx and 9xxx)', () => {
    expect(Object.keys(DENTAL_ICD10_BY_CODE).length).toBeGreaterThan(400);
    expect(Object.keys(all).every(code => /^[89]\d{3}$/.test(code))).toBe(true);
  });

  // The sheet marks 8109, 8110 and 8145 "N/A", but funds want a diagnosis on every line: the practice's accepted
  // claims supply those (Z01.2 for the per-visit codes)
  it('gives the per-visit codes the sheet leaves out a usual diagnosis instead', () => {
    expect(DENTAL_ICD10_BY_CODE['8109']).toBeUndefined();
    expect(USUAL_ICD10_BY_CODE['8109']).toBe('Z01.2');
    expect(USUAL_ICD10_BY_CODE['8110']).toBe('Z01.2');
  });
});

/**
 * The medical aids' ICD-10 list (icd10_codes: the SA ICD-10 MIT 2021 that Namibian funds check claims against) for
 * exactly the codes the dental suggestions use, as the table gave them on 12 Oct 2026. A newly suggested code needs its
 * row here, copied from the table, so it is checked before it reaches a claim.
 */
const LIST_ROWS: readonly Icd10MasterRow[] = [
  { code: 'G50.0', description: 'Trigeminal neuralgia', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K00.7', description: 'Teething syndrome', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K01.1', description: 'Impacted teeth', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K02.1', description: 'Caries of dentine', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K02.9', description: 'Dental caries, unspecified', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K03.0', description: 'Excessive attrition of teeth', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K03.6', description: 'Deposits [accretions] on teeth', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K03.7', description: 'Posteruptive colour changes of dental hard tissues', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K04.0', description: 'Pulpitis', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K04.2', description: 'Pulp degeneration', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K04.5', description: 'Chronic apical periodontitis', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K04.7', description: 'Periapical abscess without sinus', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K05.1', description: 'Chronic gingivitis', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K05.3', description: 'Chronic periodontitis', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K06.8', description: 'Other specified disorders of gingiva and edentulous alveolar ridge', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K07.4', description: 'Malocclusion, unspecified', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K07.6', description: 'Temporomandibular joint disorders', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K08.1', description: 'Loss of teeth due to accident, extraction or local periodontal disease', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K08.2', description: 'Atrophy of edentulous alveolar ridge', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K08.8', description: 'Other specified disorders of teeth and supporting structures', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K08.9', description: 'Disorder of teeth and supporting structures, unspecified', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K10.2', description: 'Inflammatory conditions of jaws', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K10.8', description: 'Other specified diseases of jaws', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K11.5', description: 'Sialolithiasis', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K11.6', description: 'Mucocele of salivary gland', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K12.2', description: 'Cellulitis and abscess of mouth', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K13.7', description: 'Other and unspecified lesions of oral mucosa', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'K14.8', description: 'Other diseases of tongue', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'Q35.9', description: 'Cleft palate, unspecified', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: 'M', sa_end_date: null },
  { code: 'Q75.1', description: 'Craniofacial dysostosis', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'S01.5', description: 'Open wound of lip and oral cavity', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'S02.40', description: 'Fracture of malar and maxillary bones, closed', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'S02.50', description: 'Fracture of tooth, closed', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'S02.60', description: 'Fracture of mandible, closed', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'S02.61', description: 'Fracture of mandible, open', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'S03.0', description: 'Dislocation of jaw', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'S03.2', description: 'Dislocation of tooth', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'Z01.2', description: 'Dental examination', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'Z01.6', description: 'Radiological examination, not elsewhere classified', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'Z29.8', description: 'Other specified prophylactic measures', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'Z46.3', description: 'Fitting and adjustment of dental prosthetic device', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'Z47.0', description: 'Follow-up care involving removal of fracture plate and other internal fixation device', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'Z48.0', description: 'Attention to surgical dressings and sutures', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null },
  { code: 'Z71.3', description: 'Dietary counselling and surveillance', valid_clinical_use: true, valid_primary: true, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null }
];

// Business rule: the funds check every code on a claim line against their ICD-10 list and reject the line when a code
// is a category heading (S02.5 "Fracture of tooth" has S02.50 and S02.51 under it) or is not in the list at all, like
// the US ICD-10-CM M26.6 the owner's sheet used. A suggestion becomes the main code of a line unless the practitioner
// changes it, so each one must be in the list, valid for clinical use and valid as the main diagnosis.
describe('dental ICD-10 suggestions are codes the funds accept', () => {
  const list = new Map(LIST_ROWS.map(row => [row.code, toIcd10MasterEntry(row)]));
  const suggestions = [
    ...Object.entries(DENTAL_ICD10_BY_CODE).map(([code, icd10]) => ({ code, icd10, from: "owner's sheet" })),
    ...Object.entries(USUAL_ICD10_BY_CODE).map(([code, icd10]) => ({ code, icd10, from: 'usual code' }))
  ];

  it('suggests only codes the list accepts as the main code of a line', () => {
    const rejected = suggestions.flatMap(({ code, icd10, from }) =>
      icd10ListProblems([icd10], list).map(problem => `${code} (${from}): ${problem.message}`)
    );
    expect(rejected).toEqual([]);
  });

  it('keeps list rows for exactly the codes suggested', () => {
    expect([...list.keys()].sort()).toEqual([...new Set(suggestions.map(item => item.icd10))].sort());
  });

  // The same check on the codes the sheet gave before: the heading as the list has it, and M26.6, which it lacks
  it("rejects the sheet's category heading and US-only codes", () => {
    const heading: Icd10MasterRow = { code: 'S02.5', description: 'Fracture of tooth', valid_clinical_use: false, valid_primary: false, is_asterisk: false, age_range: null, gender: null, status: null, sa_end_date: null };
    const sheetCodes = new Map([[heading.code, toIcd10MasterEntry(heading)]]);
    expect(icd10ListProblems(['S02.5'], sheetCodes)).toEqual([expect.objectContaining({ severity: 'error', message: expect.stringMatching(/category heading/) })]);
    expect(icd10ListProblems(['M26.6'], sheetCodes)).toEqual([expect.objectContaining({ severity: 'error', message: expect.stringMatching(/not in the medical aids' ICD-10 list/) })]);
  });

  // Tumour surgery and the repair of a jaw: the sheet's M27.2 means inflammation, and the right code depends on the tumour
  // or defect, so the practitioner enters it instead of confirming a wrong suggestion
  it('suggests nothing where no code fits, rather than a wrong one', () => {
    ['8973', '8975', '8977'].forEach(code => expect(suggestLineIcd10(code, { dental: true })).toEqual({ codes: [], source: 'none' }));
  });
});
