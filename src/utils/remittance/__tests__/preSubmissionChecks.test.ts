/**
 * Checks before sending, learned from the funds' rejections. Each one exists because the practice
 * lost money or time on that rejection; the tests say which. Codes from several disciplines.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { ClaimLine } from '../../billing/claimLine';
import { fundRulesFromRows, setFundRulesInForce, type FundRuleRow } from '../../billing/fundRules';
import {
  checkAlreadyPaid,
  checkDependantCode,
  checkLearnedRules,
  checkMembershipFormat,
  checkResubmission,
  learnFromRemittances,
  type RemittanceHistoryLine
} from '../preSubmissionChecks';

const line = (overrides: Partial<ClaimLine>): ClaimLine => ({
  key: 'l1', transactionNumber: 1, systemTransactionNumber: 1, invoiceId: 'inv1', invoiceNumber: 'INV-2026-000101', visitId: 'v1',
  fundReference: 'NMC1', membershipNumber: '000111222', memberSurname: 'EXAMPLE', memberInitials: 'A', patientName: 'ANNA EXAMPLE',
  patientDateOfBirth: '1980-01-01', patientIdNumber: '80010100000', patientReference: '0000101', gender: 'F', tariffCode: '0190', description: '',
  serviceDate: '2026-09-15', quantity: 1, amount: 520, practiceNumber: '1110000222333', treatingDoctorHpcnaNumber: 'MP00000',
  icd10Primary: 'J06.9', icd10Secondary: [], icd10Confirmed: true, toothNumbers: '', ...overrides
});

const history = (overrides: Partial<RemittanceHistoryLine>): RemittanceHistoryLine => ({
  fundCode: 'MAG1', patientReference: '0000101', memberNumber: '000111222', serviceDate: '2026-08-01', tariffCode: '00190',
  claimedCents: 52000, paidCents: 52000, category: null, reasonCodes: [], ...overrides
});

describe('checks before sending a claim', () => {
  it('warns about a dependant claimed without a dependant code (funds then cannot find the patient: Methealth 4, NHP)', () => {
    expect(checkDependantCode(line({ relationshipToMainMember: 'child', patientName: 'BEN' }))).toMatchObject({ severity: 'warning' });
    expect(checkDependantCode(line({ relationshipToMainMember: 'child', patientName: '02 BEN' }))).toBeNull();
    expect(checkDependantCode(line({ relationshipToMainMember: 'self' }))).toBeNull();
  });

  it("warns when a membership number does not look like the fund's (every accepted NMC number had 9 digits)", () => {
    expect(checkMembershipFormat(line({ membershipNumber: '12345' }))).toMatchObject({ severity: 'warning' });
    expect(checkMembershipFormat(line({ membershipNumber: '000111222' }))).toBeNull();
    // PSEMAS claims went out with 13-14 digit numbers and were paid: no format is imposed there
    expect(checkMembershipFormat(line({ fundReference: 'MAG1', membershipNumber: '12345678901234' }))).toBeNull();
  });

  it('stops a line the fund already paid from being claimed again (Methealth 18, Medscheme 23), but allows a second, different service', () => {
    const paid = [history({ fundCode: 'NMC1', serviceDate: '2026-09-15' })];
    const issues = checkAlreadyPaid([line({ key: 'a' }), line({ key: 'b' })], paid);
    expect(issues.map(issue => [issue.lineKey, issue.severity])).toEqual([['a', 'error']]);
    expect(checkAlreadyPaid([line({ serviceDate: '2026-09-16' })], paid)).toEqual([]);
  });

  it('blocks resubmitting a line refused for a reason a correction cannot change (NMC 467 was resent unchanged and refused again)', () => {
    const resent = line({ resubmissionFlag: 'R' });
    expect(checkResubmission(resent, { category: 'patient_liable', reasonCodes: ['467'] }, false)).toMatchObject({ severity: 'error' });
    expect(checkResubmission(resent, { category: 'patient_liable', reasonCodes: ['467'] }, true)).toBeNull();
    expect(checkResubmission(resent, { category: 'fixable', reasonCodes: ['154'] }, false)).toBeNull();
  });

  it('learns which codes a fund refused together (202) and warns before they are sent together again', () => {
    const learned = learnFromRemittances([
      history({ tariffCode: '00190' }),
      history({ tariffCode: '00109', paidCents: 0, category: 'write_off', reasonCodes: ['202'] })
    ]);
    const visit = [line({ key: 'x', fundReference: 'MAG1', tariffCode: '0190' }), line({ key: 'y', fundReference: 'MAG1', tariffCode: '0109' })];
    const issues = checkLearnedRules(visit, learned);
    expect(issues).toEqual([expect.objectContaining({ prevents: expect.stringMatching(/202/), severity: 'warning' })]);
    expect(checkLearnedRules(visit.map(item => ({ ...item, fundReference: 'NMC1' })), learned)).toEqual([]);
  });

  it('learns the most units of a code a fund paid per visit after a quantity refusal (175) and warns above it', () => {
    const learned = learnFromRemittances([
      history({ tariffCode: '08109', claimedCents: 2500, paidCents: 2500 }),
      history({ tariffCode: '08109', claimedCents: 2500, paidCents: 2500 }),
      history({ tariffCode: '08109', claimedCents: 2500, paidCents: 0, category: 'hold', reasonCodes: ['175'] })
    ]);
    expect(learned.quantityLimits.get('MAG1|8109')).toBe(2);
    expect(checkLearnedRules([line({ fundReference: 'MAG1', tariffCode: '8109', quantity: 3, amount: 75 })], learned)).toHaveLength(1);
    expect(checkLearnedRules([line({ fundReference: 'MAG1', tariffCode: '8109', quantity: 2, amount: 50 })], learned)).toEqual([]);
  });
});

// The fund master (Administration > Medical aid funds): what OneHealth support sets for a fund is what these checks
// use, so a correction there reaches every practice's next batch without a new release
describe('checks that follow the fund master', () => {
  const fundRow = (overrides: Partial<FundRuleRow>): FundRuleRow => ({
    medical_aid_reference: 'MAG1', claim_deadline_days: 180, claim_deadline_months: null, deadline_confirmed: true, claims_portal_url: null,
    membership_digits: [], membership_hint: null, dependant_code_required: true, payment_terms_days: 60, ...overrides
  });
  afterEach(() => setFundRulesInForce(null));

  it("checks PSEMAS membership numbers once support sets their lengths, with support's hint", () => {
    setFundRulesInForce(fundRulesFromRows([fundRow({ membership_digits: [13, 14], membership_hint: 'Use the number on the front of the PSEMAS card.' })]));
    expect(checkMembershipFormat(line({ fundReference: 'MAG1', membershipNumber: '12345678901234' }))).toBeNull();
    expect(checkMembershipFormat(line({ fundReference: 'MAG1', membershipNumber: '1234567' }))?.message)
      .toBe('PSEMAS membership numbers have 13 or 14 digits; "1234567" does not look like one. Use the number on the front of the PSEMAS card.');
  });

  // A fund that finds dependants without the code must not get a warning practices learn to ignore
  it('does not ask for a dependant code when the fund says it does not need one', () => {
    setFundRulesInForce(fundRulesFromRows([fundRow({ dependant_code_required: false })]));
    expect(checkDependantCode(line({ fundReference: 'MAG1', relationshipToMainMember: 'child', patientName: 'BEN' }))).toBeNull();
    expect(checkDependantCode(line({ fundReference: 'NMC1', relationshipToMainMember: 'child', patientName: 'BEN' }))).toMatchObject({ severity: 'warning' });
  });
});
