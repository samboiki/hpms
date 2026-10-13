import { describe, it, expect } from 'vitest';
import { checkTariffRules } from '../tariffRules';
import { validateClaimBatch } from '../claimValidation';
import { FUND_RULES } from '../fundRules';
import type { ClaimLine } from '../claimLine';

let next = 0;
const line = (overrides: Partial<ClaimLine> = {}): ClaimLine => {
  next += 1;
  return {
    key: `l${next}`,
    transactionNumber: next,
    systemTransactionNumber: 50000 + next,
    invoiceId: 'inv-1',
    invoiceNumber: 'INV2610001',
    visitId: 'visit-1',
    fundReference: 'NMC1',
    membershipNumber: '12345678',
    memberSurname: 'Shilongo',
    memberInitials: 'E',
    patientName: 'Elisabeth Shilongo',
    patientDateOfBirth: '1990-05-17',
    patientIdNumber: '90051700123',
    patientReference: '1234',
    gender: 'F',
    tariffCode: '8101',
    description: 'Examination',
    serviceDate: '2026-09-20',
    quantity: 1,
    amount: 254.7,
    unitPrice: 254.7,
    practiceNumber: '0540001133241',
    treatingDoctorHpcnaNumber: 'DEN00417',
    icd10Primary: 'K02.1',
    icd10Secondary: [],
    icd10Confirmed: true,
    toothNumbers: '',
    ...overrides
  };
};
/** Lines numbered in the order given, as they appear in the claim file. */
const batch = (...items: Array<Partial<ClaimLine>>): ClaimLine[] => items.map((item, index) => line({ transactionNumber: index + 1, ...item }));
const issuesOn = (lines: ClaimLine[], at: number) => checkTariffRules(lines).filter(issue => issue.key === lines[at].key);

// Business rule: NAMAF does not pay 8155 when 8159 is claimed at the same visit; the practice's history has
// 14 visits billed both, each a line the fund refuses.
describe('8155 with 8159', () => {
  it('blocks 8155 at the same visit, and only 8155', () => {
    const lines = batch({ tariffCode: '8159' }, { tariffCode: '8155' });
    expect(issuesOn(lines, 1).map(issue => issue.severity)).toEqual(['error']);
    expect(issuesOn(lines, 0)).toEqual([]);
  });

  it('allows them on different days', () => {
    expect(checkTariffRules(batch({ tariffCode: '8159' }, { tariffCode: '8155', serviceDate: '2026-09-27' }))).toEqual([]);
  });
});

// Business rule: per-code limits from the 2025 schedule; the history has 8107 billed for 8-11 films, 8145
// (per visit) with quantity 2-6 and 8304 is per arch.
describe('quantity limits', () => {
  it.each([
    { code: '8107', quantity: 8, severity: 'error' },
    { code: '8107', quantity: 7, severity: null },
    { code: '8145', quantity: 3, severity: 'warning' },
    { code: '8145', quantity: 1, severity: null },
    { code: '8304', quantity: 3, severity: 'error' },
    { code: '8304', quantity: 2, severity: null },
    { code: '8369', quantity: 2, severity: 'warning' }
  ])('$code x$quantity -> $severity', ({ code, quantity, severity }) => {
    const issues = checkTariffRules(batch({ tariffCode: code, quantity, toothNumbers: code === '8369' ? '36' : '' }));
    expect(issues.map(issue => issue.severity)).toEqual(severity ? [severity] : []);
  });
});

// Business rule: rule 001, 8101 and 8104 are not both paid at one visit.
it('warns when 8101 and 8104 are claimed at the same visit', () => {
  const lines = batch({ tariffCode: '8101' }, { tariffCode: '8104' });
  expect(issuesOn(lines, 1).map(issue => issue.severity)).toEqual(['warning']);
});

// Business rule: posterior restorations are paid once per tooth; NMC pended a second one as a possible
// duplicate. Anterior restorations are paid per restoration.
describe('restorations on the same tooth', () => {
  it('warns on the second posterior restoration of a tooth', () => {
    const lines = batch({ tariffCode: '8369', toothNumbers: '36' }, { tariffCode: '8367', toothNumbers: '36' });
    expect(issuesOn(lines, 0)).toEqual([]);
    expect(issuesOn(lines, 1).map(issue => issue.severity)).toEqual(['warning']);
  });

  it('allows two anterior restorations, and the same tooth number for different patients', () => {
    expect(checkTariffRules(batch({ tariffCode: '8351', toothNumbers: '11' }, { tariffCode: '8352', toothNumbers: '11' }))).toEqual([]);
    expect(checkTariffRules(batch({ tariffCode: '8369', toothNumbers: '36' }, { tariffCode: '8369', toothNumbers: '36', patientReference: '5678' }))).toEqual([]);
  });
});

// Business rule: 8346 (10% material factor) is an add-on to the restoration on the line before it, same tooth;
// without a restoration it is never paid, and when the restoration is rejected the fund drops 8346 with it.
describe('8346 material factor', () => {
  it('passes straight after its restoration', () => {
    expect(checkTariffRules(batch({ tariffCode: '8369', toothNumbers: '36' }, { tariffCode: '8346', toothNumbers: '36' }))).toEqual([]);
    expect(checkTariffRules(batch({ tariffCode: '8369', toothNumbers: '36' }, { tariffCode: '8346', toothNumbers: '' }))).toEqual([]);
  });

  it('warns when another line sits between them', () => {
    const lines = batch({ tariffCode: '8369', toothNumbers: '36' }, { tariffCode: '8109' }, { tariffCode: '8346', toothNumbers: '36' });
    expect(issuesOn(lines, 2).map(issue => issue.severity)).toEqual(['warning']);
  });

  it('blocks 8346 with no restoration on that tooth on the invoice', () => {
    const lines = batch({ tariffCode: '8369', toothNumbers: '46' }, { tariffCode: '8346', toothNumbers: '36' });
    expect(issuesOn(lines, 1).map(issue => issue.severity)).toEqual(['error']);
  });
});

// Business rule: dental technician items (9301-9776) belong under 8099 with the lab slip; sent as ordinary
// lines, the funds pended them as possible duplicates.
it('warns about laboratory items sent as ordinary lines', () => {
  expect(checkTariffRules(batch({ tariffCode: '9301' })).map(issue => issue.severity)).toEqual(['warning']);
  expect(checkTariffRules(batch({ tariffCode: '8101' }))).toEqual([]);
});

// Business rule: a rule the fund will not pay stops the batch, and the reason shows on the line it concerns.
it('blocks the batch and shows the reason on the line', () => {
  const lines = batch({ tariffCode: '8159', amount: 100, unitPrice: 100 }, { tariffCode: '8155', amount: 100, unitPrice: 100 });
  const NMC = FUND_RULES.find(rule => rule.key === 'NMC1')!;
  const result = validateClaimBatch(lines, { today: '2026-10-06', fundRule: NMC, practiceNumber: '0540001133241', practiceType: 'dental' });
  expect(result.canSubmit).toBe(false);
  expect(result.lines[1].errors.map(issue => issue.message).join(' ')).toMatch(/Remove 8155/);
  expect(result.lines[0].errors).toEqual([]);
});

// Business rule: OneHealth also serves GPs and specialists. These are NAMAF's dental rules: a GP or specialist
// practice's codes follow other schedules and must never be blocked by them.
it('does not apply the dental rules to a GP or specialist practice', () => {
  const lines = batch({ tariffCode: '8159', amount: 100, unitPrice: 100 }, { tariffCode: '8155', amount: 100, unitPrice: 100 });
  const NMC = FUND_RULES.find(rule => rule.key === 'NMC1')!;
  for (const practiceType of ['general_practice', 'specialist', '', null]) {
    const result = validateClaimBatch(lines, { today: '2026-10-06', fundRule: NMC, practiceNumber: '0540001133241', practiceType });
    expect(result.lines[1].errors.map(issue => issue.message).join(' ')).not.toMatch(/8155/);
  }
});
