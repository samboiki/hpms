/**
 * Keying a medical aid payment line by line, as practices key a fund's remittance. The amount received is a control
 * total: a payment that does not add up to it is keyed wrong somewhere, and posting it would put money on the wrong
 * claims. Invented values only.
 */
import { describe, it, expect } from 'vitest';
import {
  draftFromRow,
  draftKeyedCents,
  draftPayload,
  emptyDraft,
  findClaims,
  fundOfClaim,
  lineRowKey,
  paidInFull,
  parseKeyedAmount,
  summarizeKeying,
  wholeClaimKey,
  type FundRecord,
  type KeyingClaim,
  type KeyingDraft
} from '../fundPaymentKeying';

const line = (id: string, claimedCents: number, lineNumber: number) => ({
  claimLineId: id,
  batchId: 'batch-12',
  batchNumber: 12,
  lineNumber,
  serviceDate: '2026-09-01',
  tariffCode: '0190',
  claimedCents,
  resubmitted: false,
  outcome: null
});

// A claim of N$ 450 + N$ 150 the fund still owes in full, and an old claim (from the old system) with no claim lines
const claims: KeyingClaim[] = [
  { invoiceId: 'inv-1', invoiceNumber: 'INV-0001', patientId: 'pt-1', patientName: 'Ana Tester', accountReference: '0000101', dateKey: '2026-09-01', owedCents: 60000, lines: [line('l1', 45000, 1), line('l2', 15000, 2)] },
  { invoiceId: 'inv-2', invoiceNumber: 'INV-0002', patientId: 'pt-2', patientName: 'Ben Sample', accountReference: '0000202', dateKey: '2026-08-15', owedCents: 30000, lines: [] }
];

const draft = (changes: Partial<KeyingDraft> = {}): KeyingDraft => ({ ...emptyDraft('NMC1', 'Namibia Medical Care', '2026-10-09'), ...changes });

describe('parseKeyedAmount', () => {
  // An empty line is not on this remittance; 0.00 is the fund saying it paid nothing (a refused line)
  it('tells "not keyed" apart from "the fund paid nothing"', () => {
    expect(parseKeyedAmount('')).toEqual({ state: 'empty' });
    expect(parseKeyedAmount('  ')).toEqual({ state: 'empty' });
    expect(parseKeyedAmount('0')).toEqual({ state: 'ok', cents: 0 });
    expect(parseKeyedAmount('0.00')).toEqual({ state: 'ok', cents: 0 });
    expect(parseKeyedAmount('1,250.50')).toEqual({ state: 'ok', cents: 125050 });
    expect(parseKeyedAmount('12.345')).toEqual({ state: 'invalid' });
    expect(parseKeyedAmount('abc')).toEqual({ state: 'invalid' });
  });
});

describe('summarizeKeying', () => {
  it('is balanced only when the keyed lines and the credit kept equal the amount received', () => {
    const keyed = { [lineRowKey({ claimLineId: 'l1' })]: '450', [lineRowKey({ claimLineId: 'l2' })]: '0', [wholeClaimKey('inv-2')]: '300' };
    const short = summarizeKeying(draft({ amountText: '800', paid: keyed }), claims);
    expect(short.keyedCents).toBe(75000);
    expect(short.differenceCents).toBe(5000);
    expect(short.balanced).toBe(false);
    expect(short.problems).toContain('N$ 50.00 of the amount received is not keyed yet.');

    const withCredit = summarizeKeying(draft({ amountText: '800', paid: keyed, unmatchedText: '50' }), claims);
    expect(withCredit.differenceCents).toBe(0);
    expect(withCredit.balanced).toBe(true);
    expect(withCredit.claims.get('inv-1')).toEqual({ paidCents: 45000, keyedRows: 2, overOwed: false, restCents: 15000 });
  });

  it('will not post lines that add up to more than the amount received', () => {
    const summary = summarizeKeying(draft({ amountText: '400', paid: { [lineRowKey({ claimLineId: 'l1' })]: '450' } }), claims);
    expect(summary.differenceCents).toBe(-5000);
    expect(summary.balanced).toBe(false);
    expect(summary.problems).toContain('The lines add up to N$ 50.00 more than the amount received.');
  });

  // Money keyed beyond what the fund owes on an invoice would be refused by the ledger, after all the keying
  it('flags a claim keyed for more than the fund still owes on it', () => {
    const summary = summarizeKeying(draft({ amountText: '700', paid: { [lineRowKey({ claimLineId: 'l1' })]: '700' } }), claims);
    expect(summary.claims.get('inv-1')?.overOwed).toBe(true);
    expect(summary.balanced).toBe(false);
  });

  it('will not post with an unreadable amount, no amount received, or no fund named', () => {
    expect(summarizeKeying(draft({ amountText: '450', paid: { [lineRowKey({ claimLineId: 'l1' })]: '4,5.0.0' } }), claims).invalidRows.size).toBe(1);
    expect(summarizeKeying(draft({ paid: { [lineRowKey({ claimLineId: 'l1' })]: '450' } }), claims).problems[0]).toMatch(/Type the amount the fund paid/);
    expect(summarizeKeying(draft({ fundName: ' ', amountText: '450', paid: { [lineRowKey({ claimLineId: 'l1' })]: '450' } }), claims).balanced).toBe(false);
  });
});

describe('paidInFull', () => {
  it('fills each line with what was claimed on it, and a claim without lines with what is owed', () => {
    expect(paidInFull(claims[0])).toEqual({ 'line:l1': '450.00', 'line:l2': '150.00' });
    expect(paidInFull(claims[1])).toEqual({ 'invoice:inv-2': '300.00' });
  });

  // A claim the fund already paid in part only gets the rest, never more than it still owes
  it('never fills more than the fund still owes on the invoice', () => {
    expect(paidInFull({ ...claims[0], owedCents: 50000 })).toEqual({ 'line:l1': '450.00', 'line:l2': '50.00' });
  });
});

describe('draftPayload and draftFromRow', () => {
  const typed = draft({
    amountText: '750',
    reference: ' REM-1 ',
    paid: { 'line:l1': '450', 'line:l2': '0', 'invoice:inv-2': '300', 'line:gone': '99' },
    unmatchedText: '',
    restToPatient: ['inv-1', 'inv-unknown']
  });

  // What is saved is what the database checks and posts: only readable keyed rows of claims still owed
  it('sends the keyed rows of claims still owed, amounts in N$ with 2 decimals', () => {
    const payload = draftPayload(typed, 'practice-1', claims);
    expect(payload).toMatchObject({
      practice_id: 'practice-1',
      fund_code: 'NMC1',
      fund_name: 'Namibia Medical Care',
      amount: '750.00',
      reference: 'REM-1',
      method: 'medical_aid',
      unmatched: '0.00',
      rest_to_patient: ['inv-1'],
      lines: [
        { claim_line_id: 'l1', invoice_id: 'inv-1', paid: '450.00' },
        { claim_line_id: 'l2', invoice_id: 'inv-1', paid: '0.00' },
        { claim_line_id: null, invoice_id: 'inv-2', paid: '300.00' }
      ]
    });
  });

  // A colleague opening a saved payment must see exactly what was keyed
  it('comes back from the database as it was typed', () => {
    const row = {
      id: 'draft-1', version: 3, fund_code: 'NMC1', fund_name: 'Namibia Medical Care', amount: '750.00', received_on: '2026-10-09',
      reference: 'REM-1', method: 'eft', notes: null, unmatched: '0.00', rest_to_patient: ['inv-1'], updated_at: '2026-10-09T10:00:00Z',
      updated_by: 'user-1', created_by: 'user-1',
      lines: (draftPayload(typed, 'practice-1', claims).lines as unknown[])
    };
    const back = draftFromRow(row);
    expect(back).toMatchObject({ id: 'draft-1', version: 3, amountText: '750.00', method: 'eft', restToPatient: ['inv-1'] });
    expect(back.paid).toEqual({ 'line:l1': '450.00', 'line:l2': '0.00', 'invoice:inv-2': '300.00' });
    expect(draftKeyedCents(row)).toBe(75000);
    expect(summarizeKeying(back, claims).balanced).toBe(true);
  });
});

describe('fundOfClaim', () => {
  const funds: FundRecord[] = [
    { id: 'p-psemas', name: 'PSEMAS', short_name: 'PSEMAS', medical_aid_reference: 'MAG1' },
    { id: 'p-nhp', name: 'Namibia Health Plan', short_name: 'NHP', medical_aid_reference: 'NHPM' }
  ];

  // Grouping by the typed name split a fund whenever it was typed differently, so those claims were never offered
  it('groups by the fund code, whatever name was typed on the patient file', () => {
    expect(fundOfClaim({ batchReference: null, providerId: 'p-nhp', providerName: 'nhp medical aid' }, funds)).toEqual({ fundCode: 'NHPM', fund: 'Namibia Health Plan' });
    expect(fundOfClaim({ batchReference: null, providerId: null, providerName: 'Namibia Health Plan (NHP)' }, funds)).toEqual({ fundCode: 'NHPM', fund: 'Namibia Health Plan' });
  });

  it('goes by the batch the claim was sent in first: that is the fund that has the claim', () => {
    expect(fundOfClaim({ batchReference: 'PSEMAS', providerId: 'p-nhp', providerName: 'NHP' }, funds)).toEqual({ fundCode: 'MAG1', fund: 'PSEMAS' });
  });

  it('says nothing when no fund is recorded or recognised', () => {
    expect(fundOfClaim({ batchReference: null, providerId: null, providerName: null }, funds)).toEqual({ fundCode: null, fund: null });
    expect(fundOfClaim({ batchReference: null, providerId: null, providerName: 'Some Insurer' }, funds)).toEqual({ fundCode: null, fund: null });
  });
});

describe('findClaims', () => {
  it('finds a claim by patient, invoice or account number, as printed on the remittance', () => {
    expect(findClaims(claims, 'ben').map(claim => claim.invoiceId)).toEqual(['inv-2']);
    expect(findClaims(claims, 'INV-0001').map(claim => claim.invoiceId)).toEqual(['inv-1']);
    expect(findClaims(claims, '0000202').map(claim => claim.invoiceId)).toEqual(['inv-2']);
    expect(findClaims(claims, '').length).toBe(2);
  });
});
