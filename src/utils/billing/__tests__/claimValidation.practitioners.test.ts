import { describe, it, expect } from 'vitest';
import { validateClaimBatch, validateClaimLine } from '../claimValidation';
import { getFundRule } from '../fundRules';
import type { ClaimLine } from '../claimLine';

// Invented numbers: the practice's own and a partner's own
const PRACTICE = '0111222333444';
const PARTNER_OWN = '0999888777666';
const NMC = getFundRule('NMC1');
const context = { today: '2026-10-12', fundRule: NMC, practiceNumber: PRACTICE, practiceType: 'dental' };

const line = (overrides: Partial<ClaimLine> = {}): ClaimLine => ({
  key: 'line-1',
  transactionNumber: 1,
  systemTransactionNumber: 70001,
  invoiceId: 'inv-1',
  invoiceNumber: 'INV2610001',
  visitId: 'visit-1',
  fundReference: 'NMC1',
  membershipNumber: '12345678',
  memberSurname: 'Testmember',
  memberInitials: 'T',
  patientName: 'Test Patient',
  patientDateOfBirth: '1990-05-17',
  patientIdNumber: '90051700123',
  patientReference: '1234',
  gender: 'F',
  tariffCode: '8368',
  description: 'TOOTH: 46 MO RESIN',
  serviceDate: '2026-10-05',
  quantity: 1,
  amount: 560,
  unitPrice: 560,
  practiceNumber: PRACTICE,
  treatingDoctorHpcnaNumber: 'DEN00001',
  doctorHpcnaNumber: 'DEN00001',
  icd10Primary: 'K02.1',
  icd10Secondary: [],
  icd10Confirmed: true,
  toothNumbers: '46',
  requiresTooth: true,
  ...overrides
});

const messages = (result: { errors: { message: string }[]; warnings: { message: string }[] }, kind: 'errors' | 'warnings') =>
  result[kind].map(issue => issue.message).join(' ');

// Business rule (D31): the fund pays the practitioner whose HPCNA number is on the line. A line treated by a
// practitioner without a number used to go out under the invoice practitioner's number; now it stops, naming who.
describe('a line whose practitioner has no HPCNA number', () => {
  it('is stopped, naming the practitioner and where to add the number', () => {
    const result = validateClaimLine(line({ treatingDoctorHpcnaNumber: '', doctorHpcnaNumber: null, treatingPractitionerName: 'Dr B Partner' }), context);
    expect(result.errors.map(issue => issue.field)).toEqual(['treatingDoctorHpcnaNumber']);
    expect(messages(result, 'errors')).toMatch(/^Dr B Partner treated this line and has no HPCNA registration number on record: add it under Settings > Users/);
  });
});

// Business rule (D31): a partner bills their own lines under their own practice number (claim field 29); the batch
// is still one practice's. Any other number on a line is a mistake that sends the fund's money elsewhere.
describe('a partner billing under their own practice number', () => {
  it("is accepted on the partner's own lines, also in a batch with the practice's lines", () => {
    // The partner filled tooth 36 on the same visit
    const partnerLine = line({ key: 'line-2', transactionNumber: 2, systemTransactionNumber: 70002, toothNumbers: '36', practiceNumber: PARTNER_OWN, practitionerPracticeNumber: PARTNER_OWN });
    expect(validateClaimLine(partnerLine, context).errors).toEqual([]);
    const batch = validateClaimBatch([line(), partnerLine], { ...context, storedTotal: null });
    expect(batch.batchIssues).toEqual([]);
    expect(batch.canSubmit).toBe(true);
  });

  it("refuses another practice's number on a line, and a batch of two practices", () => {
    const stranger = line({ key: 'line-2', transactionNumber: 2, systemTransactionNumber: 70002, practiceNumber: '0555666777888', practitionerPracticeNumber: PARTNER_OWN });
    expect(validateClaimLine(stranger, context).errors.map(issue => issue.field)).toEqual(['practiceNumber']);
    expect(validateClaimBatch([line(), stranger], { ...context, storedTotal: null }).batchIssues.map(issue => issue.message).join(' ')).toMatch(/one practice number/);
  });
});

// Business rule (D5): the claim says "TOOTH: 46 MO" and the fund pays the code. A code for another number of surfaces
// is pointed out at claim review, naming the code that fits, before the batch goes.
describe('surfaces and the code on a claim line', () => {
  it('warns when the code is for another number of surfaces, naming the code that fits', () => {
    const result = validateClaimLine(line({ tariffCode: '8369', toothSurfaces: 'MO', amount: 663, unitPrice: 663 }), context);
    expect(result.errors).toEqual([]);
    expect(messages(result, 'warnings')).toBe('8369 is for 3 surfaces, but 2 are marked (M O). Use 8368, the code for 2 surfaces.');
  });

  it('is quiet when the code fits the surfaces, or none are recorded', () => {
    expect(validateClaimLine(line({ toothSurfaces: 'MO' }), context).warnings).toEqual([]);
    expect(validateClaimLine(line({ toothSurfaces: null }), context).warnings).toEqual([]);
  });
});
