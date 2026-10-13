/**
 * The posting rules. These decide where a fund's money and its refusals end up: on the invoice, on
 * the patient's account, written off, or in the rejection queue. The tests name the business rule
 * each case protects; the amounts and people are invented.
 */
import { describe, expect, it } from 'vitest';
import { matchRemittance, type ClaimCandidate } from '../matching';
import { buildPostingPlan, decideLine, policyFor, type PostingInput } from '../posting';
import { emptyDocument, emptyLine, type RemittanceDocument, type RemittanceLine } from '../types';

let nextId = 0;
const claim = (overrides: Partial<ClaimCandidate>): ClaimCandidate => {
  nextId += 1;
  return {
    claimLineId: `cl${nextId}`, batchId: 'b1', fundCode: 'MAG1', invoiceId: 'inv1', invoiceNumber: 'INV-2026-000101', patientId: 'p1',
    patientName: 'Anna Example', patientReference: '0000101', membershipNumber: '000111222', dependantCode: null, serviceDate: '2026-09-15',
    tariffCode: '0190', quantity: 1, amountCents: 52000, toothNumbers: '', lineNumber: nextId, history: null, ...overrides
  };
};

const remLine = (seq: number, overrides: Partial<RemittanceLine>): RemittanceLine => ({
  ...emptyLine(seq, 1),
  memberNumber: '000111222', practiceReference: '0000101', serviceDate: '2026-09-15', tariffRaw: '00190',
  claimedCents: 52000, tariffCents: 52000, paidCents: 52000, status: 'paid', ...overrides
});

const statement = (lines: RemittanceLine[], overrides: Partial<RemittanceDocument> = {}): RemittanceDocument => {
  const paid = lines.reduce((sum, line) => sum + line.paidCents, 0);
  return {
    ...emptyDocument('methealth_statement', 'payment', 'methealth'),
    fundCode: 'MAG1', fundName: 'PSEMAS', statementNumber: '0000123457', documentDate: '2026-10-04', paymentDate: '2026-10-04',
    totalPaidCents: paid, lines,
    checks: [{ label: 'Statement total paid', expectedCents: paid, actualCents: paid, ok: true }],
    reasonLegend: { '202': 'TARIFF CODES CANNOT BE CHARGED TOGETHER. MEMBER NOT LIABLE', '175': 'TARIFF QUANTITY MAXIMUM EXCEEDED' },
    ...overrides
  };
};

const plan = (doc: RemittanceDocument, candidates: ClaimCandidate[], extra: Partial<PostingInput> = {}) => {
  const owed = new Map<string, number>();
  candidates.forEach(candidate => {
    if (candidate.invoiceId) owed.set(candidate.invoiceId, (owed.get(candidate.invoiceId) ?? 0) + candidate.amountCents);
  });
  return buildPostingPlan({
    doc,
    matches: matchRemittance(doc, candidates),
    confirmedGroups: new Set(),
    balances: Object.fromEntries([...owed].map(([id, cents]) => [id, { medicalAidOutstandingCents: cents, patientOutstandingCents: 0 }])),
    policy: policyFor(doc.fundCode),
    canApproveWriteOffs: true,
    today: '2026-10-07',
    paymentAlreadyPosted: false,
    ...extra
  });
};

describe('posting a fund payment', () => {
  it('allocates each paid line to its invoice under one receipt for the whole payment', () => {
    const consult = claim({});
    const xray = claim({ tariffCode: '0308', amountCents: 18000 });
    const result = plan(statement([remLine(1, {}), remLine(2, { tariffRaw: '00308', claimedCents: 18000, tariffCents: 18000, paidCents: 18000 })]), [consult, xray]);
    expect(result.mode).toBe('receipt');
    expect(result.receiptAmountCents).toBe(70000);
    expect(result.allocations).toEqual([{ seq: 1, invoiceId: 'inv1', amountCents: 52000 }, { seq: 2, invoiceId: 'inv1', amountCents: 18000 }]);
    expect(result.totals).toMatchObject({ allocatedCents: 70000, suspenseCents: 0 });
    expect(result.blockers).toEqual([]);
  });

  it('never bills the patient for code 202: the fund says the member is not liable, even though it prints the amount as member portion', () => {
    const consult = claim({});
    const extra = claim({ tariffCode: '8109', amountCents: 9500 });
    const doc = statement([remLine(1, {}), remLine(2, { tariffRaw: '08109', claimedCents: 9500, tariffCents: 9500, paidCents: 0, memberPortionCents: 9500, status: 'rejected', reasonCodes: ['202'] })]);
    const result = plan(doc, [consult, extra]);
    expect(result.shortfalls).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]).toMatchObject({ category: 'write_off', suggestedAction: 'write_off', atStakeCents: 9500 });
  });

  it('writes off the unpaid part of a part-paid 202 line instead of billing it (an admin or doctor approves)', () => {
    const line = remLine(1, { claimedCents: 52000, paidCents: 30000, status: 'part_paid', reasonCodes: ['202'] });
    const approver = plan(statement([line]), [claim({})]);
    expect(approver.writeOffs).toEqual([expect.objectContaining({ invoiceId: 'inv1', amountCents: 22000, writeOffCode: 'other' })]);
    expect(approver.shortfalls).toEqual([]);
    const receptionist = plan(statement([line]), [claim({})], { canApproveWriteOffs: false });
    expect(receptionist.writeOffs).toEqual([]);
    expect(receptionist.rejections[0]).toMatchObject({ suggestedAction: 'write_off', needsApproval: true, atStakeCents: 22000 });
  });

  it('moves the unpaid part to the patient when the benefit is used up (514): the patient owes it', () => {
    const doc: RemittanceDocument = { ...statement([remLine(1, { claimedCents: 52000, paidCents: 20000, status: 'part_paid', reasonCodes: ['514'] })]), administrator: 'medscheme', format: 'medscheme_advice', fundCode: 'NHPM', paymentReference: 'NHP0000001-000042' };
    const result = plan(doc, [claim({ fundCode: 'NHPM' })]);
    expect(result.shortfalls).toEqual([expect.objectContaining({ invoiceId: 'inv1', amountCents: 32000 })]);
    expect(result.rejections).toEqual([]);
  });

  it("moves the PSEMAS 5% member co-payment to the patient, but only for the fund whose policy says so", () => {
    const line = remLine(1, { claimedCents: 20000, tariffCents: 20000, paidCents: 19000, memberPortionCents: 1000, status: 'part_paid' });
    const psemas = plan(statement([line]), [claim({ amountCents: 20000 })]);
    expect(psemas.shortfalls).toEqual([expect.objectContaining({ amountCents: 1000 })]);
    const nmc = plan(statement([line], { fundCode: 'NMC1', fundName: 'NMC' }), [claim({ amountCents: 20000, fundCode: 'NMC1' })]);
    expect(nmc.shortfalls).toEqual([]);
    expect(nmc.rejections[0]).toMatchObject({ category: 'review' });
  });

  it('tells a co-payment from a rate shortfall by the tariff printed: 5% below a lower fund tariff is the tariff, not a co-payment', () => {
    // Claimed N$ 200, the fund's tariff N$ 190, paid N$ 190: the 5% gap is the fund's lower rate
    const result = plan(statement([remLine(1, { claimedCents: 20000, tariffCents: 19000, paidCents: 19000, memberPortionCents: 1000, status: 'part_paid' })]), [claim({ amountCents: 20000 })]);
    expect(result.shortfalls).toEqual([]);
    expect(result.writeOffs).toEqual([expect.objectContaining({ amountCents: 1000, writeOffCode: 'scheme_rate' })]);
  });

  it("follows the fund's policy for a rate shortfall: PSEMAS pays its own tariff and the rest is written off; a private fund's is billed", () => {
    const line = remLine(1, { claimedCents: 52000, tariffCents: 31800, paidCents: 31800, status: 'part_paid' });
    const psemas = plan(statement([line]), [claim({})]);
    expect(psemas.writeOffs).toEqual([expect.objectContaining({ amountCents: 20200, writeOffCode: 'scheme_rate' })]);
    const nhp = plan({ ...statement([line]), fundCode: 'NHPM', administrator: 'medscheme' }, [claim({ fundCode: 'NHPM' })]);
    expect(nhp.shortfalls).toEqual([expect.objectContaining({ amountCents: 20200 })]);
  });

  it('queues a line rejected for a fixable reason with the fund deadline to resubmit by, and never bills it', () => {
    const doc: RemittanceDocument = { ...statement([remLine(1, {}), remLine(2, { tariffRaw: '1201', claimedCents: 31000, paidCents: 0, status: 'rejected', reasonCodes: ['154'] })]), administrator: 'medscheme', fundCode: 'NHPM' };
    const result = plan(doc, [claim({ fundCode: 'NHPM' }), claim({ fundCode: 'NHPM', tariffCode: '1201', amountCents: 31000 })]);
    expect(result.rejections).toEqual([expect.objectContaining({ seq: 2, category: 'fixable', suggestedAction: 'resubmit', resubmitBy: '2027-01-15', atStakeCents: 31000 })]);
    expect(result.shortfalls).toEqual([]);
  });

  it('holds a quantity-limit rejection (175) for a few payment runs, because the fund often pays it later', () => {
    const result = plan(statement([remLine(1, {}), remLine(2, { tariffRaw: '08109', claimedCents: 5000, paidCents: 0, status: 'rejected', reasonCodes: ['175'] })]), [claim({}), claim({ tariffCode: '8109', amountCents: 5000 })]);
    expect(result.rejections[0]).toMatchObject({ category: 'hold', suggestedAction: 'wait', followUpOn: '2026-10-25' });
    expect(result.lineResults[1].status).toBe('held');
  });

  it('keeps money for an unconfirmed "likely" match on the receipt as credit until a person confirms it', () => {
    const doc = statement([remLine(1, { memberNumber: '000999999' })]);
    const unconfirmed = plan(doc, [claim({})]);
    expect(unconfirmed.allocations).toEqual([]);
    expect(unconfirmed.totals.suspenseCents).toBe(52000);
    const key = matchRemittance(doc, [claim({})]).groups[0].key;
    const confirmed = plan(doc, [claim({})], { confirmedGroups: new Set([key]) });
    expect(confirmed.allocations).toEqual([expect.objectContaining({ amountCents: 52000 })]);
  });

  it("never allocates more than the invoice's medical aid portion still owes; the rest stays as credit", () => {
    const result = plan(statement([remLine(1, {})]), [claim({})], { balances: { inv1: { medicalAidOutstandingCents: 40000, patientOutstandingCents: 0 } } });
    expect(result.allocations[0].amountCents).toBe(40000);
    expect(result.totals.suspenseCents).toBe(12000);
  });

  it('will not post a payment dated in the future (advices arrive days before the money) or one that does not add up', () => {
    const early = plan(statement([remLine(1, {})], { paymentDate: '2026-10-09' }), [claim({})]);
    expect(early.blockers.join(' ')).toMatch(/2026-10-09/);
    const broken = plan(statement([remLine(1, {})], { checks: [{ label: 'Statement total paid', expectedCents: 1, actualCents: 52000, ok: false }] }), [claim({})]);
    expect(broken.blockers.join(' ')).toMatch(/does not match/);
  });

  it('posts nothing for a line the fund already paid (code 18) when the earlier payment is on record', () => {
    const paidBefore = claim({ history: { paidCents: 52000, lastStatus: 'paid', rejection: null } });
    const result = plan(statement([remLine(1, { paidCents: 0, status: 'rejected', reasonCodes: ['18'] })]), [paidBefore]);
    expect(result.decisions[0].outcome).toBe('duplicate');
    expect(result.rejections).toEqual([]);
    const noRecord = plan(statement([remLine(1, { paidCents: 0, status: 'rejected', reasonCodes: ['18'] })]), [claim({})]);
    expect(noRecord.rejections[0]).toMatchObject({ category: 'review' });
  });

  it('settles an earlier rejection when the fund pays it later, undoing the shortfall staff had billed while the patient still owes it', () => {
    const rejected = claim({ history: { paidCents: 0, lastStatus: 'rejected', rejection: { id: 'rej1', status: 'billed_patient', adjustmentId: 'adj1', adjustmentKind: 'shortfall_transfer', adjustmentCents: 52000 } } });
    const result = plan(statement([remLine(1, {})]), [rejected], { balances: { inv1: { medicalAidOutstandingCents: 0, patientOutstandingCents: 52000 } } });
    expect(result.resolves).toEqual([{ rejectionId: 'rej1', seq: 1 }]);
    expect(result.reversals).toEqual([expect.objectContaining({ adjustmentId: 'adj1', kind: 'shortfall_transfer', amountCents: 52000 })]);
    expect(result.allocations[0].amountCents).toBe(52000);
  });

  it('does not undo a write-off without an admin or doctor; the late payment waits as credit', () => {
    const writtenOff = claim({ history: { paidCents: 0, lastStatus: 'rejected', rejection: { id: 'rej2', status: 'written_off', adjustmentId: 'adj2', adjustmentKind: 'write_off', adjustmentCents: 52000 } } });
    const result = plan(statement([remLine(1, {})]), [writtenOff], { canApproveWriteOffs: false, balances: { inv1: { medicalAidOutstandingCents: 0, patientOutstandingCents: 0 } } });
    expect(result.reversals).toEqual([]);
    expect(result.allocations).toEqual([]);
    expect(result.totals.suspenseCents).toBe(52000);
    expect(result.warnings.join(' ')).toMatch(/admin or doctor/);
  });

  it('records a monthly statement whose payment was already posted from its advice, without posting money or queueing rejections twice', () => {
    const doc = { ...statement([remLine(1, {}), remLine(2, { tariffRaw: '08109', claimedCents: 9500, paidCents: 0, status: 'rejected', reasonCodes: ['202'] })]), kind: 'month_summary' as const };
    const result = plan(doc, [claim({}), claim({ tariffCode: '8109', amountCents: 9500 })], { paymentAlreadyPosted: true });
    expect(result.mode).toBe('record');
    expect(result.allocations).toEqual([]);
    expect(result.rejections).toEqual([]);
  });

  it('moves money the fund paid to the member to the patient: the patient now owes the practice', () => {
    const result = plan(statement([remLine(1, { paidCents: 0, paidToMemberCents: 52000, status: 'paid' })]), [claim({})]);
    expect(result.shortfalls).toEqual([expect.objectContaining({ amountCents: 52000 })]);
  });

  it('queues a negative line (the fund took money back) for a person instead of guessing', () => {
    const result = plan(statement([remLine(1, {}), remLine(2, { paidCents: -10000, status: 'part_paid' })]), [claim({}), claim({})]);
    expect(result.rejections).toEqual([expect.objectContaining({ seq: 2, category: 'review' })]);
    expect(result.receiptAmountCents).toBe(42000);
    expect(result.totals.allocatedCents).toBe(42000);
  });
});

describe('responses before payment', () => {
  it('records accepted lines and queues rejected and pended ones, without any money', () => {
    const doc: RemittanceDocument = {
      ...emptyDocument('nmc_response_csv', 'adjudication', 'methealth'), fundCode: 'NMC1', documentDate: '2026-10-01',
      checks: [{ label: 'x', expectedCents: 0, actualCents: 0, ok: true }],
      lines: [
        remLine(1, { status: 'accepted' }),
        remLine(2, { paidCents: 0, status: 'rejected', reasonCodes: ['467'], reasonTexts: ['OPTION PAYS PREFERRED PROVIDER ONLY'] }),
        remLine(3, { paidCents: 0, status: 'pended', reasonCodes: ['388'] })
      ]
    };
    const result = plan(doc, [claim({ fundCode: 'NMC1' }), claim({ fundCode: 'NMC1' }), claim({ fundCode: 'NMC1' })]);
    expect(result.mode).toBe('record');
    expect(result.receiptAmountCents).toBe(0);
    expect(result.rejections.map(item => [item.seq, item.category, item.suggestedAction])).toEqual([[2, 'patient_liable', 'bill_patient'], [3, 'hold', 'wait']]);
    expect(result.lineResults[0].status).toBe('recorded');
  });

  it('explains a decision in words staff can act on', () => {
    const decision = decideLine(remLine(1, { claimedCents: 52000, paidCents: 20000, status: 'part_paid', reasonCodes: ['149'] }), {
      doc: { kind: 'payment', administrator: 'methealth', fundCode: 'NMC1', reasonLegend: {}, paymentDate: '2026-10-04', documentDate: '2026-10-04' },
      match: { seq: 1, confidence: 'exact', rule: '', groupKey: 'g', invoiceId: 'inv1', patientId: 'p1', claimLineIds: ['cl'], split: null, alreadyPaid: false, rejection: null, notes: [] },
      confirmed: false, policy: policyFor('NMC1'), postsMoney: true
    });
    expect(decision).toMatchObject({ allocateCents: 20000, shortfallCents: 32000 });
    expect(decision.explanation).toMatch(/moves to the patient/);
  });
});
