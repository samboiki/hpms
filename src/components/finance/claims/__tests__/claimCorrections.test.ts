/**
 * Claims after sending (parity D23, F9, F16). A fund that never answers a line costs the practice the whole claim once
 * the fund's deadline passes, so the unpaid lines must be found and sent again; but a list that offers lines the fund
 * paid, lines already sent again or lines on a credit note would make staff claim twice, which funds treat as
 * duplicate billing. A correction must send only what changed and must pass the claim check, or the fund's whole next
 * batch is stuck. Invented values only.
 */
import { describe, expect, it } from 'vitest';
import {
  claimedPractitionerOf,
  correctionPlan,
  describeReversal,
  isCreditBatch,
  isSentClaimBatch,
  serviceKeyOf,
  unpaidLines,
  type SentClaimLine,
  type SentLineValues,
  type UnpaidLinesInput
} from '../claimCorrections';
import { SILENT_FUND_DEFAULTS } from '../batchFollowUp';
import type { ClaimLineOutcome } from '../status';
import type { BatchHeaderRow } from '../types';

const batch = (id: string, overrides: Partial<BatchHeaderRow> = {}): BatchHeaderRow => ({
  id,
  practice_id: 'practice-1',
  practice_number: '0012345',
  batch_number: Number(id.replace(/\D/g, '')) || 1,
  batch_date: '2026-08-31',
  medical_aid_reference: 'NMC1',
  status: 'sent',
  total_amount: 1000,
  total_invoices: 1,
  generated_file_content: null,
  recipient_email: null,
  // Noon local time, so the sent day is the same in every time zone the tests run in
  sent_at: '2026-08-31T12:00:00',
  confirmed_at: null,
  created_at: '2026-08-31T08:00:00',
  transaction_type: 'D',
  source_software: null,
  source_software_version: null,
  system_identification: 1,
  ...overrides
});

const line = (id: string, overrides: Partial<SentClaimLine> = {}): SentClaimLine => ({
  id,
  batchId: 'b1',
  lineNumber: 1,
  invoiceId: `inv-${id}`,
  invoiceNumber: '100',
  patientId: 'patient-1',
  patientName: 'TESTA',
  systemTransactionNumber: 1,
  tariffCode: '0190',
  amountCents: 45000,
  serviceDate: '2026-08-28',
  ...overrides
});

const today = '2026-10-09'; // 39 days after 31 Aug

const input = (overrides: Partial<UnpaidLinesInput> = {}): UnpaidLinesInput => ({
  batches: [batch('b1')],
  lines: [line('l1')],
  outcomes: new Map<string, ClaimLineOutcome>(),
  medicalAidOwed: null,
  waiting: new Map(),
  credited: new Set(),
  settings: SILENT_FUND_DEFAULTS,
  today,
  ...overrides
});

describe('unpaidLines', () => {
  it('lists a sent line the fund has neither paid nor refused once its wait is over (30 days)', () => {
    expect(unpaidLines(input())).toEqual([expect.objectContaining({ fundCode: 'NMC1', daysSinceSent: 39, outcome: 'none', blocker: null })]);
    // 29 days: the fund may still be processing it
    expect(unpaidLines(input({ batches: [batch('b1', { sent_at: '2026-09-10T12:00:00' })] }))).toEqual([]);
  });

  // PSEMAS pays a median 31 days after the service: at 30 days half its lines would be sent twice on their way
  it('lets PSEMAS take 60 days by default', () => {
    expect(unpaidLines(input({ batches: [batch('b1', { medical_aid_reference: 'MAG1' })] }))).toEqual([]);
    expect(unpaidLines(input({ batches: [batch('b1', { medical_aid_reference: 'MAG1', sent_at: '2026-08-01T12:00:00' })] }))).toHaveLength(1);
  });

  it('lists a pended line (waiting) but never one the fund paid, part paid or refused', () => {
    const lines = ['l1', 'l2', 'l3', 'l4'].map((id, index) => line(id, { systemTransactionNumber: index + 1 }));
    const outcomes = new Map<string, ClaimLineOutcome>([['l1', 'waiting'], ['l2', 'paid'], ['l3', 'part_paid'], ['l4', 'rejected']]);
    expect(unpaidLines(input({ lines, outcomes })).map(item => [item.line.id, item.outcome])).toEqual([['l1', 'waiting']]);
  });

  // A line sent again replaces the one before it: chasing the old one would claim the same service twice
  it('follows only the latest claim of a service', () => {
    const batches = [batch('b1'), batch('b2', { sent_at: '2026-09-02T12:00:00', medical_aid_reference: 'NMC1' })];
    const lines = [line('old', { batchId: 'b1', invoiceId: 'inv-1' }), line('new', { batchId: 'b2', invoiceId: 'inv-1' })];
    expect(unpaidLines(input({ batches, lines })).map(item => item.line.id)).toEqual(['new']);
  });

  it('leaves out invoices the fund owes nothing on any more (paid by hand, written off or credited in full)', () => {
    expect(unpaidLines(input({ medicalAidOwed: new Map([['inv-l1', 0]]) }))).toEqual([]);
    expect(unpaidLines(input({ medicalAidOwed: new Map([['inv-l1', 45000]]) }))).toHaveLength(1);
  });

  it('says why a line cannot be sent again: already waiting, credited, or past the fund deadline', () => {
    const key = serviceKeyOf('inv-l1', 1) as string;
    expect(unpaidLines(input({ waiting: new Map([[key, 12]]) }))[0].blocker).toBe('Already sent again: it waits in batch 12');
    expect(unpaidLines(input({ credited: new Set([key]) }))[0].blocker).toMatch(/credit note/);
    // NMC allows 120 days from the service date: a stale line would stop the whole next batch at the claim check
    expect(unpaidLines(input({ lines: [line('l1', { serviceDate: '2026-05-01' })] }))[0].blocker).toMatch(/^Past the fund's deadline/);
  });

  it('never follows up open batches or credit files', () => {
    expect(unpaidLines(input({ batches: [batch('b1', { status: 'active', sent_at: null })] }))).toEqual([]);
    expect(unpaidLines(input({ batches: [batch('b1', { transaction_type: 'C' })] }))).toEqual([]);
  });
});

describe('the kinds of batch', () => {
  it('knows a credit file by its header transaction type C, and a sent claim batch from an open one', () => {
    expect(isCreditBatch({ transaction_type: 'C' })).toBe(true);
    expect(isCreditBatch({ transaction_type: 'D' })).toBe(false);
    expect(isSentClaimBatch(batch('b1'))).toBe(true);
    expect(isSentClaimBatch(batch('b1', { status: 'ready', sent_at: null }))).toBe(false);
    expect(isSentClaimBatch(batch('b1', { transaction_type: 'c' }))).toBe(false);
    expect(serviceKeyOf('inv-1', null)).toBeNull();
  });
});

describe('correctionPlan', () => {
  const sent: SentLineValues = { serviceDate: '2026-08-28', patientId: 'p1', icd10: ['J06.9'], practitionerId: 'd1', authorisationNumber: '' };
  const draft = { serviceDate: '2026-08-28', patientId: 'p1', icd10: { primary: 'J06.9', secondary: [] }, practitionerId: 'd1', authorisationNumber: '' };

  // claim_line_correct receives only what changed, so the history says exactly what was corrected
  it('sends only what differs from what the fund received', () => {
    const plan = correctionPlan(sent, { ...draft, serviceDate: '2026-08-27', authorisationNumber: ' A12/3.4 ' }, today);
    expect(plan.errors).toEqual([]);
    expect(plan.changes).toEqual({ service_date: '2026-08-27', authorisation_number: 'A12/3.4' });
    expect(plan.changed).toEqual(['Date 28 Aug 2026 to 27 Aug 2026', 'Authorisation A12/3.4']);
  });

  it('names the family member and the practitioner the claim now goes out for', () => {
    const plan = correctionPlan(sent, { ...draft, patientId: 'p2', practitionerId: 'd2', icd10: { primary: 'J02.9', secondary: ['J06.9'] } }, today, { patient: 'Child Test', practitioner: 'Dr Test' });
    expect(plan.changes).toEqual({ patient_id: 'p2', practitioner_id: 'd2', icd10: ['J02.9', 'J06.9'] });
    expect(plan.changed).toEqual(['Claimed for Child Test', 'ICD-10 J06.9 to J02.9, J06.9', 'Practitioner now Dr Test']);
  });

  it('takes an authorisation number off when it is cleared', () => {
    expect(correctionPlan({ ...sent, authorisationNumber: 'A1' }, draft, today).changes).toEqual({ authorisation_number: '' });
  });

  // Business rule (partner billing): the fund pays the practice number on the line (claim field 29). A line moved from a
  // partner with an own number to a colleague without one must go under the practice's number, or the partner is paid
  // for a colleague's work; staff see it in the confirmation (the database sets it: claim_line_correct)
  it('says which practice number the line moves to when the practitioner changes', () => {
    const billing = { billing: new Map([['partner', { practiceNumber: '0999888777666', ratePercent: null }]]), practiceNumber: '0111222333444' };
    const fromPartner = correctionPlan({ ...sent, practitionerId: 'partner', practiceNumber: '0999888777666' }, { ...draft, practitionerId: 'd2' }, today, { practitioner: 'Dr Test' }, billing);
    expect(fromPartner.changed).toEqual(['Practitioner now Dr Test', "Billed under the practice's number 0111222333444, not 0999888777666"]);
    expect(fromPartner.changes).toEqual({ practitioner_id: 'd2' });
    const toPartner = correctionPlan({ ...sent, practiceNumber: '0111222333444' }, { ...draft, practitionerId: 'partner' }, today, {}, billing);
    expect(toPartner.changed).toContain('Billed under their own practice number 0999888777666, not 0111222333444');
    // Same number either way, or nothing known: nothing more is said
    expect(correctionPlan({ ...sent, practiceNumber: '0111222333444' }, { ...draft, practitionerId: 'd2' }, today, {}, billing).changed).toEqual(['Practitioner changed']);
    expect(correctionPlan(sent, { ...draft, practitionerId: 'partner' }, today, {}, null).changed).toEqual(['Practitioner changed']);
  });

  // Business rule: a line without its own practitioner was claimed under the invoice's treating practitioner (their HPCNA
  // number is on the line), not the visit's doctor; the visit often has none. The correction must start from that one, as
  // claim_line_correct does, or keeping the practitioner the fund already has reads as a change and the history says
  // the fund was sent no practitioner
  it('starts from the practitioner the line was claimed under: the line\'s own, else the invoice\'s', () => {
    expect(claimedPractitionerOf('line-doctor', 'invoice-doctor')).toBe('line-doctor');
    expect(claimedPractitionerOf(null, 'invoice-doctor')).toBe('invoice-doctor');
    expect(claimedPractitionerOf('', undefined)).toBeNull();
    const claimedUnder = { ...sent, practitionerId: claimedPractitionerOf(null, 'invoice-doctor') };
    expect(correctionPlan(claimedUnder, { ...draft, practitionerId: 'invoice-doctor' }, today).errors)
      .toEqual(['Nothing was changed: correct the date, dependant, ICD-10 codes, practitioner or authorisation.']);
    expect(correctionPlan(claimedUnder, { ...draft, practitionerId: 'd2' }, today).changes).toEqual({ practitioner_id: 'd2' });
  });

  // Each of these would make the fund's whole next batch fail the claim check, or reach the fund wrong
  it('refuses a date in the future, codes the claim check refuses, an authorisation the file cannot carry, and no change', () => {
    expect(correctionPlan(sent, { ...draft, serviceDate: '2026-10-10' }, today).errors).toContain('The date of service cannot be in the future.');
    expect(correctionPlan(sent, { ...draft, icd10: { primary: '', secondary: [] } }, today).errors).toContain('A claim needs at least one ICD-10 code.');
    expect(correctionPlan(sent, { ...draft, authorisationNumber: 'AB 12' }, today).errors.join(' ')).toMatch(/no spaces or commas/);
    expect(correctionPlan(sent, draft, today).errors).toEqual(['Nothing was changed: correct the date, dependant, ICD-10 codes, practitioner or authorisation.']);
  });
});

describe('describeReversal', () => {
  it('says where a reversal stands in one sentence', () => {
    expect(describeReversal({ state: 'queued', creditBatchNumber: null, creditSentAt: null })).toMatch(/next credit file \(not sent yet\)/);
    expect(describeReversal({ state: 'in_file', creditBatchNumber: 57, creditSentAt: null })).toBe('The fund is told with a reversal in credit file 57 (not sent yet).');
    expect(describeReversal({ state: 'sent', creditBatchNumber: 57, creditSentAt: '2026-10-09T12:00:00' })).toBe('The fund was told with a reversal in credit file 57, sent 9 Oct 2026.');
    expect(describeReversal({ state: 'cancelled', creditBatchNumber: null, creditSentAt: null })).toMatch(/cancelled/);
  });
});
