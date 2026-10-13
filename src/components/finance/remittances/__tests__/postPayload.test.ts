/**
 * What the screens send to the database when a remittance is saved and posted. The database
 * re-checks everything, but these payloads are the contract: every allocation must carry the id of
 * the fund's line it pays, amounts must be exact text, and one payment must always produce the same
 * idempotency key. Invented data.
 */
import { describe, expect, it } from 'vitest';
import { matchRemittance, type ClaimCandidate } from '../../../../utils/remittance/matching';
import { buildPostingPlan, policyFor } from '../../../../utils/remittance/posting';
import { emptyDocument, emptyLine, type RemittanceDocument, type RemittanceLine } from '../../../../utils/remittance/types';
import { buildMatchesPayload, buildPostPayload, buildSavePayload } from '../postPayload';

const candidate = (overrides: Partial<ClaimCandidate>): ClaimCandidate => ({
  claimLineId: 'cl1', batchId: 'b1', fundCode: 'NHPM', invoiceId: 'inv1', invoiceNumber: 'INV-2026-000101', patientId: 'p1',
  patientName: 'Anna Example', patientReference: '0000101', membershipNumber: '00000111222', dependantCode: '01', serviceDate: '2026-09-22',
  tariffCode: '0190', quantity: 1, amountCents: 52000, toothNumbers: '', lineNumber: 1, history: null, ...overrides
});

const line = (seq: number, overrides: Partial<RemittanceLine>): RemittanceLine => ({
  ...emptyLine(seq, 2), memberNumber: '00000111222', dependantCode: '01', practiceReference: '0000101', patientName: 'MR A EXAMPLE',
  serviceDate: '2026-09-22', tariffRaw: '0190', claimedCents: 52000, paidCents: 52000, status: 'paid', ...overrides
});

const doc: RemittanceDocument = {
  ...emptyDocument('medscheme_advice', 'payment', 'medscheme'),
  fundCode: 'NHPM', fundName: 'Namibia Health Plan', paymentReference: 'NHP0000001-000042', paymentDate: '2026-10-02', documentDate: '2026-09-29',
  totalPaidCents: 52000 + 20000,
  lines: [line(1, {}), line(2, { tariffRaw: '0308', claimedCents: 30000, paidCents: 20000, status: 'part_paid', reasonCodes: ['514'] }), line(3, { tariffRaw: '1201', claimedCents: 31000, paidCents: 0, status: 'rejected', reasonCodes: ['154'] })],
  checks: [{ label: 'ACB payment row', expectedCents: 72000, actualCents: 72000, ok: true }],
  reasonLegend: { '514': 'Benefit limit reached', '154': 'Tooth number missing' }
};

const candidates = [candidate({}), candidate({ claimLineId: 'cl2', tariffCode: '0308', amountCents: 30000, lineNumber: 2 }), candidate({ claimLineId: 'cl3', tariffCode: '1201', amountCents: 31000, lineNumber: 3 })];
const matches = matchRemittance(doc, candidates);
const plan = buildPostingPlan({
  doc, matches, confirmedGroups: new Set(), balances: { inv1: { medicalAidOutstandingCents: 113000, patientOutstandingCents: 0 } },
  policy: policyFor('NHPM'), canApproveWriteOffs: false, today: '2026-10-07', paymentAlreadyPosted: false
});
const lineIds = { 1: 'line-1', 2: 'line-2', 3: 'line-3' };

describe('remittance payloads', () => {
  it('saves the document with its fingerprint, payment key and exact amounts, and the bank account as 4 digits only', () => {
    const payload = buildSavePayload({ practiceId: 'p', fileName: 'advice.pdf', sha256: 'a'.repeat(64), partNumber: 1, doc: { ...doc, bankAccountLast4: '3210' } });
    expect(payload).toMatchObject({ file_sha256: 'a'.repeat(64), payment_key: 'medscheme:NHP0000001-000042', total_paid: '720.00', reconciled: true, bank_account_last4: '3210' });
    expect((payload.lines as Array<Record<string, unknown>>)[1]).toMatchObject({ seq: 2, claimed: '300.00', paid: '200.00', line_status: 'part_paid', reason_codes: ['514'] });
  });

  it("posts one receipt for the payment, each allocation pointing at the fund's line, the patient's share as one shortfall per invoice", () => {
    const payload = buildPostPayload({ practiceId: 'p', documentId: 'doc1', lineIds, fundName: 'Namibia Health Plan (NHP)', doc, matches, confirmedGroups: new Set(), plan });
    const receipt = payload.receipt as Record<string, unknown>;
    expect(receipt).toMatchObject({ payer_type: 'medical_aid', method: 'medical_aid', amount: '720.00', source: 'remittance_import', external_ref: 'medscheme:NHP0000001-000042', received_on: '2026-10-02' });
    expect(receipt.allocations).toEqual([
      { invoice_id: 'inv1', portion: 'medical_aid', amount: '520.00', external_ref: 'line-1' },
      { invoice_id: 'inv1', portion: 'medical_aid', amount: '200.00', external_ref: 'line-2' }
    ]);
    expect(receipt.shortfalls).toEqual([expect.objectContaining({ invoice_id: 'inv1', amount: '100.00', external_ref: 'remittance:doc1:inv1' })]);
    expect(payload.rejections).toEqual([expect.objectContaining({ line_id: 'line-3', category: 'fixable', suggested_action: 'resubmit', at_stake: '310.00' })]);
  });

  it('stores each line as matched exactly, or as likely until a person confirms it', () => {
    expect(buildMatchesPayload(matches, new Set(), lineIds).map(item => item.match_status)).toEqual(['exact', 'exact', 'exact']);
    const unsure = matchRemittance({ ...doc, lines: [line(1, { memberNumber: '00000999999' })] }, candidates);
    expect(buildMatchesPayload(unsure, new Set(), { 1: 'line-1' })[0].match_status).toBe('likely');
    expect(buildMatchesPayload(unsure, new Set([unsure.groups[0].key]), { 1: 'line-1' })[0].match_status).toBe('confirmed');
  });

  it('refuses to post lines that were not saved first (every posting must trace back to a saved line)', () => {
    expect(() => buildPostPayload({ practiceId: 'p', documentId: 'doc1', lineIds: {}, fundName: 'NHP', doc, matches, confirmedGroups: new Set(), plan })).toThrow(/not been saved/);
  });
});
