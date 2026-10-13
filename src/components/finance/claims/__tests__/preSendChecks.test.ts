import { describe, expect, it } from 'vitest';
import type { ClaimLine } from '../../../../utils/billing/claimLine';
import { validateClaimBatch } from '../../../../utils/billing/claimValidation';
import { getFundRule } from '../../../../utils/billing/fundRules';
import type { RemittanceHistoryLine } from '../../../../utils/remittance/preSubmissionChecks';
import { describePreSendIssue, mergePreSendIssues, preSendIssues, type PreSendHistory } from '../preSendChecks';

// Invented members and numbers only
const line = (overrides: Partial<ClaimLine> = {}): ClaimLine => ({
  key: 'l1', transactionNumber: 1, systemTransactionNumber: 1, invoiceId: 'inv1', invoiceNumber: 'INV-000101', visitId: 'v1',
  fundReference: 'NMC1', membershipNumber: '000111222', memberSurname: 'EXAMPLE', memberInitials: 'A', patientName: 'ANNA EXAMPLE',
  patientDateOfBirth: '1980-01-01', patientIdNumber: '80010100000', patientReference: '0000101', gender: 'F', tariffCode: '0190', description: 'Consultation',
  serviceDate: '2026-09-15', quantity: 1, amount: 520, unitPrice: 520, practiceNumber: '1110000222', treatingDoctorHpcnaNumber: 'MP00000',
  icd10Primary: 'J06.9', icd10Secondary: [], icd10Confirmed: true, toothNumbers: '', ...overrides
});

const paid = (overrides: Partial<RemittanceHistoryLine> = {}): RemittanceHistoryLine => ({
  fundCode: 'NMC1', patientReference: '0000101', memberNumber: '000111222', serviceDate: '2026-09-15', tariffCode: '0190',
  claimedCents: 52000, paidCents: 52000, category: null, reasonCodes: [], ...overrides
});

const noHistory: PreSendHistory = { remittanceLines: null, earlierRejections: new Map() };
const context = { today: '2026-10-07', fundRule: getFundRule('NMC1'), practiceNumber: '1110000222', practiceType: 'general_practice' };

describe('checks learned from the funds, at batch review', () => {
  // The fund pays a line once: sending it again earns a "duplicate / already paid" rejection and delays the batch
  it('stops a line the fund already paid, so the batch cannot be sent until it is removed', () => {
    const lines = [line()];
    const base = validateClaimBatch(lines, context);
    expect(base.canSubmit).toBe(true);
    const merged = mergePreSendIssues(base, preSendIssues(lines, { remittanceLines: [paid()], earlierRejections: new Map() }));
    expect(merged.canSubmit).toBe(false);
    expect(merged.errorCount).toBe(base.errorCount + 1);
    expect(merged.validLineCount).toBe(0);
    const errors = merged.lines[0].errors;
    expect(errors[errors.length - 1]?.message).toMatch(/^The fund already paid code 0190 .* \(Avoids: Methealth 18, Medscheme 23 \(already paid\)\.\)$/);
  });

  // A spouse or child without a dependant code is not found by the fund; a warning lets staff fix it first
  it('warns about a dependant without a dependant code, without blocking the batch', () => {
    const lines = [line({ relationshipToMainMember: 'child', patientName: 'BEN EXAMPLE' })];
    const merged = mergePreSendIssues(validateClaimBatch(lines, context), preSendIssues(lines, noHistory));
    expect(merged.lines[0].warnings.some(issue => issue.field === 'patientName' && /dependant code/.test(issue.message))).toBe(true);
    expect(merged.canSubmit).toBe(true);
    expect(merged.warningCount).toBe(validateClaimBatch(lines, context).warningCount + 1);
  });

  it("warns about a membership number that does not look like the fund's", () => {
    const lines = [line({ membershipNumber: '12345' })];
    const issues = preSendIssues(lines, noHistory);
    expect(issues).toEqual([expect.objectContaining({ field: 'membershipNumber', severity: 'warning' })]);
  });

  // A final rejection (not covered, network-only option) comes back rejected again unless the membership changed
  it('stops resending a line the fund refused for good, unless the membership changed', () => {
    const resent = [line({ resubmissionFlag: 'Y' })];
    const earlier = { category: 'patient_liable' as const, reasonCodes: ['467'], membershipChanged: false };
    expect(preSendIssues(resent, { remittanceLines: null, earlierRejections: new Map([['l1', earlier]]) })).toEqual([
      expect.objectContaining({ field: 'tariffCode', severity: 'error' })
    ]);
    expect(preSendIssues(resent, { remittanceLines: null, earlierRejections: new Map([['l1', { ...earlier, membershipChanged: true }]]) })).toEqual([]);
  });

  it('warns about codes the fund refused together before, on any discipline', () => {
    const history = [paid({ tariffCode: '0190' }), paid({ tariffCode: '0109', paidCents: 0, category: 'write_off', reasonCodes: ['202'] })];
    const visit = [line({ key: 'a', tariffCode: '0190' }), line({ key: 'b', tariffCode: '0109', serviceDate: '2026-09-20' })];
    // The already-paid check keys on the date: these lines are on another day, so only the combination warns
    const issues = preSendIssues(visit.map(item => ({ ...item, serviceDate: '2026-09-20' })), { remittanceLines: history, earlierRejections: new Map() });
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', field: 'tariffCode', prevents: expect.stringMatching(/202/) })]);
  });

  it('leaves the result untouched when there is nothing to add', () => {
    const base = validateClaimBatch([line()], context);
    expect(mergePreSendIssues(base, [])).toBe(base);
  });

  it("says what the warning avoids in the fund's own terms after the plain-English reason", () => {
    expect(describePreSendIssue({ lineKey: 'x', severity: 'warning', prevents: 'Methealth 4', message: 'Check the number.' })).toBe('Check the number. (Avoids: Methealth 4.)');
  });
});
