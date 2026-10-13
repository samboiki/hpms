/**
 * Matching what the fund paid to what the practice claimed. Funds echo only the patient reference,
 * membership number, date, code and amount, so the matcher must find the right claim line without
 * the practice's own numbers, must never call a guess "exact" (exact lines are posted without a
 * person looking), and must handle what the funds actually do: split quantities, fold add-on lines,
 * pay later what they rejected before. Codes from several disciplines are used on purpose.
 */
import { describe, expect, it } from 'vitest';
import { matchRemittance, summarizeMatches, type ClaimCandidate } from '../matching';
import { emptyDocument, emptyLine, type RemittanceDocument, type RemittanceLine } from '../types';

let nextId = 0;
const claim = (overrides: Partial<ClaimCandidate>): ClaimCandidate => {
  nextId += 1;
  return {
    claimLineId: `cl${nextId}`, batchId: 'b1', fundCode: 'NMC1', invoiceId: 'inv1', invoiceNumber: 'INV-2026-000101', patientId: 'p1',
    patientName: 'Anna Example', patientReference: '0000101', membershipNumber: '000111222', dependantCode: null, serviceDate: '2026-09-15',
    tariffCode: '0190', quantity: 1, amountCents: 52000, toothNumbers: '', lineNumber: nextId, history: null, ...overrides
  };
};

const remLine = (seq: number, overrides: Partial<RemittanceLine>): RemittanceLine => ({
  ...emptyLine(seq, 1),
  memberNumber: '000111222', practiceReference: '0000101', patientName: 'MRS A EXAMPLE', serviceDate: '2026-09-15',
  tariffRaw: '00190', claimedCents: 52000, paidCents: 52000, status: 'paid', ...overrides
});

const doc = (lines: RemittanceLine[], fundCode = 'NMC1', administrator: RemittanceDocument['administrator'] = 'methealth'): RemittanceDocument => ({
  ...emptyDocument('methealth_statement', 'payment', administrator), fundCode, lines
});

describe('matching a remittance to the claims sent', () => {
  it('is exact when reference, member number, date, code and amount all agree (leading zeros on codes ignored)', () => {
    const result = matchRemittance(doc([remLine(1, {})]), [claim({})]);
    expect(result.lines[0]).toMatchObject({ confidence: 'exact', invoiceId: 'inv1', patientId: 'p1' });
    expect(result.lines[0].claimLineIds).toHaveLength(1);
  });

  it('is only likely when the reference matches but the member number does not: a person must check before money moves', () => {
    const result = matchRemittance(doc([remLine(1, { memberNumber: '000999999' })]), [claim({})]);
    expect(result.lines[0].confidence).toBe('likely');
    expect(result.groups[0].rule).toMatch(/member number differs/);
  });

  it('finds nothing for a claim the practice never sent from this system (e.g. from the old system)', () => {
    const result = matchRemittance(doc([remLine(1, { practiceReference: '0000999', memberNumber: '000999999', patientName: 'MR Z OTHER' })]), [claim({})]);
    expect(result.lines[0]).toMatchObject({ confidence: 'none', invoiceId: null });
    expect(summarizeMatches(result)).toEqual({ exact: 0, likely: 0, none: 1 });
  });

  it('only suggests a claim found by name, date and codes when neither reference nor member number agrees', () => {
    const result = matchRemittance(doc([remLine(1, { practiceReference: '0000999', memberNumber: '000999999', patientName: 'MRS A EXAMPLE' })]), [claim({})]);
    expect(result.lines[0]).toMatchObject({ confidence: 'likely', invoiceId: 'inv1' });
    expect(result.groups[0].rule).toMatch(/name, date and codes/);
  });

  it("only looks at the document's own fund: another fund's claim with the same patient is not a candidate", () => {
    const result = matchRemittance(doc([remLine(1, {})]), [claim({ fundCode: 'NHPM' })]);
    expect(result.lines[0].confidence).toBe('none');
  });

  it('matches one quantity-2 claim line to the two unit lines the fund split it into', () => {
    const lines = [remLine(1, { tariffRaw: '08109', claimedCents: 2500, paidCents: 2500 }), remLine(2, { tariffRaw: '08109', claimedCents: 2500, paidCents: 0, status: 'rejected', reasonCodes: ['388'] })];
    const candidate = claim({ tariffCode: '8109', quantity: 2, amountCents: 5000 });
    const result = matchRemittance(doc(lines), [candidate]);
    expect(result.lines.map(match => [match.confidence, match.claimLineIds[0], match.split])).toEqual([
      ['exact', candidate.claimLineId, { unit: 1, of: 2 }],
      ['exact', candidate.claimLineId, { unit: 2, of: 2 }]
    ]);
  });

  it('matches one paid line to a claim line plus the add-on line after it, which some funds pay as one', () => {
    const procedure = claim({ tariffCode: '1201', amountCents: 30000 });
    const addOn = claim({ tariffCode: '0009', amountCents: 3000 });
    const result = matchRemittance(doc([remLine(1, { tariffRaw: '1201', claimedCents: 33000, paidCents: 33000 })], 'NHPM', 'medscheme'), [{ ...procedure, fundCode: 'NHPM' }, { ...addOn, fundCode: 'NHPM' }]);
    expect(result.lines[0]).toMatchObject({ confidence: 'exact', claimLineIds: [procedure.claimLineId, addOn.claimLineId] });
  });

  it('calls a re-priced line (same code, other amount) likely, not exact', () => {
    const result = matchRemittance(doc([remLine(1, { claimedCents: 50000, paidCents: 50000 })]), [claim({})]);
    expect(result.lines[0]).toMatchObject({ confidence: 'likely', invoiceId: 'inv1' });
  });

  it('keeps a paid line that was not on the claim with its visit (the money belongs to that invoice) but only as likely', () => {
    const result = matchRemittance(doc([remLine(1, {}), remLine(2, { tariffRaw: '00308', claimedCents: 18000, paidCents: 18000 })]), [claim({})]);
    expect(result.lines[1]).toMatchObject({ confidence: 'likely', invoiceId: 'inv1', claimLineIds: [] });
  });

  it('tells two family members seen the same day apart by their dependant codes', () => {
    const mother = claim({ invoiceId: 'invA', patientId: 'pA', dependantCode: '00', patientName: 'Anna Example' });
    const child = claim({ invoiceId: 'invB', patientId: 'pB', dependantCode: '02', patientName: 'Ben Example' });
    const lines = [remLine(1, { dependantCode: '02', patientName: null }), remLine(2, { dependantCode: '00', patientName: null })];
    const result = matchRemittance(doc(lines), [mother, child]);
    expect(result.lines.map(match => [match.invoiceId, match.confidence])).toEqual([['invB', 'exact'], ['invA', 'exact']]);
  });

  it('tells them apart by name only when the names clearly differ, otherwise asks a person', () => {
    const member = claim({ invoiceId: 'invA', patientName: 'Anna Example' });
    const spouse = claim({ invoiceId: 'invB', patientName: 'Ben Sample' });
    const clear = matchRemittance(doc([remLine(1, { patientName: 'MR B SAMPLE' })]), [member, spouse]);
    expect(clear.lines[0]).toMatchObject({ invoiceId: 'invB', confidence: 'exact' });

    const sibling = claim({ invoiceId: 'invC', patientName: 'Carl Example' });
    const unclear = matchRemittance(doc([remLine(1, { patientName: 'EXAMPLE' })]), [member, sibling]);
    expect(unclear.lines[0].confidence).toBe('likely');
    expect(unclear.groups[0].options.map(option => option.invoiceId).sort()).toEqual(['invA', 'invC']);
  });

  it('gives a rejection among identical lines to the one without a tooth number first (the fund rejected it for that)', () => {
    const withTooth = claim({ tariffCode: '8369', amountCents: 90000, toothNumbers: '36' });
    const withoutTooth = claim({ tariffCode: '8369', amountCents: 90000, toothNumbers: '' });
    const lines = [remLine(1, { tariffRaw: '08369', claimedCents: 90000, paidCents: 0, status: 'rejected', reasonCodes: ['154'] }), remLine(2, { tariffRaw: '08369', claimedCents: 90000, paidCents: 90000 })];
    const result = matchRemittance(doc(lines), [withTooth, withoutTooth]);
    expect(result.lines[0].claimLineIds).toEqual([withoutTooth.claimLineId]);
    expect(result.lines[1].claimLineIds).toEqual([withTooth.claimLineId]);
  });

  it('links an "already paid" line (code 18) to the claim line an earlier remittance paid, and pays the other one', () => {
    const paidBefore = claim({ history: { paidCents: 52000, lastStatus: 'paid', rejection: null } });
    const open = claim({});
    const lines = [remLine(1, { paidCents: 0, status: 'rejected', reasonCodes: ['18'] }), remLine(2, {})];
    const result = matchRemittance(doc(lines), [paidBefore, open]);
    expect(result.lines[0]).toMatchObject({ claimLineIds: [paidBefore.claimLineId], alreadyPaid: true });
    expect(result.lines[1]).toMatchObject({ claimLineIds: [open.claimLineId], alreadyPaid: false });
  });

  it('notices that a payment settles a line the fund rejected before (re-adjudication)', () => {
    const rejected = claim({ history: { paidCents: 0, lastStatus: 'rejected', rejection: { id: 'rej1', status: 'open', adjustmentId: null, adjustmentKind: null, adjustmentCents: 0 } } });
    const result = matchRemittance(doc([remLine(1, {})]), [rejected]);
    expect(result.lines[0].rejection).toMatchObject({ id: 'rej1', status: 'open' });
    expect(result.lines[0].notes.join(' ')).toMatch(/rejected before/);
  });

  it('matches a SwitchOn claim by the invoice reference sent in claim field 24 (the same 8-character reference)', () => {
    const switchDoc: RemittanceDocument = { ...emptyDocument('switchon_status_csv', 'claim_status', 'switchon'), fundCode: 'MAG1', lines: [
      { ...emptyLine(1, null), invoiceReference: '26000101', serviceDate: '2026-09-20', claimedCents: 70000, status: 'accepted' }
    ] };
    const lines = [claim({ fundCode: 'MAG1', amountCents: 52000 }), claim({ fundCode: 'MAG1', tariffCode: '0308', amountCents: 18000 })];
    const result = matchRemittance(switchDoc, lines);
    expect(result.lines[0]).toMatchObject({ confidence: 'exact', invoiceId: 'inv1' });
    expect(result.lines[0].claimLineIds).toHaveLength(2);
  });

  it('lets staff choose the invoice for a group (counted as their confirmation) or leave it unmatched', () => {
    const lines = [remLine(1, { practiceReference: '0000999', memberNumber: '000999999' })];
    const picked = matchRemittance(doc(lines), [claim({})], { invoiceByGroup: { [matchRemittance(doc(lines), []).groups[0].key]: 'inv1' } });
    expect(picked.groups[0]).toMatchObject({ manual: true, invoiceId: 'inv1', confidence: 'likely' });
    expect(picked.lines[0]).toMatchObject({ invoiceId: 'inv1', confidence: 'likely' });
    const left = matchRemittance(doc([remLine(1, {})]), [claim({})], { invoiceByGroup: { [matchRemittance(doc([remLine(1, {})]), []).groups[0].key]: null } });
    expect(left.lines[0].confidence).toBe('none');
  });
});
