import { describe, expect, it } from 'vitest';
import { LAB_DETAIL_SERVICE_TYPE, buildClaimFile, parseClaimFile, type ClaimFileHeader } from '../claimFile';
import type { ClaimLine } from '../claimLine';

const header: ClaimFileHeader = { practiceNumber: '0540000000001', batchNumber: 51, batchDate: '2026-10-13', fundReference: 'NMC1' };

const line = (values: Partial<ClaimLine>): ClaimLine => ({
  key: 'k1',
  transactionNumber: 1,
  systemTransactionNumber: 70001,
  invoiceId: 'inv-1',
  invoiceNumber: '501',
  visitId: 'visit-1',
  fundReference: 'NMC1',
  membershipNumber: '99887766',
  memberSurname: 'Tester',
  memberInitials: 'AB',
  patientName: 'Alex Tester',
  patientDateOfBirth: '1980-01-01',
  patientIdNumber: '80010100011',
  patientReference: '42',
  gender: 'female',
  tariffCode: '8101',
  description: 'Examination',
  serviceDate: '2026-10-13',
  quantity: 1,
  amount: 254.7,
  practiceNumber: '0540000000001',
  treatingDoctorHpcnaNumber: 'DEN00001',
  icd10Primary: 'K02.1',
  icd10Secondary: [],
  icd10Confirmed: true,
  toothNumbers: '',
  ...values
});

const labLine = line({
  key: 'k2',
  transactionNumber: 2,
  tariffCode: '8099',
  description: 'Dental technician fees',
  amount: 1970,
  extra: { modifier1: '8005', nappiCode: '123456' },
  labSlipNumber: 'LS-4471',
  labDetails: [
    { code: '9330', description: 'Porcelain fused to metal crown with a long description', amount: 1850 },
    { code: null, description: 'Model and die', amount: 120 }
  ]
});

// Business rule: QEDI's layout carries a dental lab's invoice as type L lines straight after the 8099 line, adding up
// to it; a fund refuses 8099 without them. Nothing else in the file may move: the funds' answers and the sent file are
// matched to the batch's lines by their line numbers.
describe('a dental 8099 line with its lab lines in the claim file', () => {
  const file = buildClaimFile(header, [line({ key: 'k3', transactionNumber: 3, tariffCode: '8109', amount: 40 }), labLine, line({})]);
  const parsed = parseClaimFile(file.content);

  it('writes the lab lines straight after their 8099 line, numbered after the batch\'s last line', () => {
    expect(parsed.details.map(fields => [fields[1], fields[4], fields[12]])).toEqual([
      ['1', 'T', '8101'],
      ['2', 'T', '8099'],
      ['4', LAB_DETAIL_SERVICE_TYPE, '9330'],
      ['5', LAB_DETAIL_SERVICE_TYPE, ''],
      ['3', 'T', '8109']
    ]);
  });

  it('gives each lab line its amount, what it is (30 characters), quantity 1 and the lab\'s invoice number', () => {
    const [first, second] = parsed.details.filter(fields => fields[4] === LAB_DETAIL_SERVICE_TYPE);
    expect(first[13]).toBe('1850.00');
    expect(first[14]).toBe('Porcelain fused to metal crown');
    expect(first[17]).toBe('1.00');
    expect(first[23]).toBe('4471');
    expect(second[13]).toBe('120.00');
    // The 8099 line's own modifiers and NAPPI code are not the lab's
    expect([first[19], first[25]]).toEqual(['', '']);
  });

  it('keeps the patient, member, date and practitioner of the 8099 line on its lab lines', () => {
    const parent = parsed.details[1];
    const child = parsed.details[2];
    for (const field of [3, 5, 7, 8, 10, 11, 16, 28, 32, 35]) expect(child[field]).toBe(parent[field]);
  });

  it('counts and totals every record in the trailer, while the file says what is claimed', () => {
    expect(parsed.trailer?.[1]).toBe('5');
    expect(parsed.trailer?.[2]).toBe('4234.70');
    expect(file.lineCount).toBe(3);
    expect(file.totalCents).toBe(226470);
  });

  it('is exactly the file it was without lab lines when no line carries any', () => {
    const plain = [line({}), line({ key: 'k2', transactionNumber: 2, tariffCode: '8099', amount: 1970 })];
    const before = buildClaimFile(header, plain);
    expect(parseClaimFile(before.content).trailer?.slice(0, 3)).toEqual(['Z', '2', '2224.70']);
    expect(before.lineCount).toBe(2);
    expect(before.totalCents).toBe(222470);
  });
});
