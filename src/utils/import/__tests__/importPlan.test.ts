import { describe, expect, it } from 'vitest';
import { zeroBands } from '../../../services/ledger/ageAnalysis';
import { recogniseColumns } from '../eminanceFields';
import { readBalances, type BalancePortion } from '../eminanceBalances';
import { parseClaimFile } from '../eminanceClaims';
import { NO_CHOICES, readPeople } from '../eminancePeople';
import { readRecalls } from '../eminanceRecalls';
import { buildImportPlan, stagedRows, suggestedFund, type ExistingFile, type FundOption, type PlanInput } from '../importPlan';
import { parseDelimitedText, toImportTable } from '../tableFile';

const TODAY = '2026-10-07';

const FUNDS: FundOption[] = [
  { id: 'fund-nmc', name: 'Namibia Medical Care', short_name: 'NMC', medical_aid_reference: 'NMC1' },
  { id: 'fund-psemas', name: 'PSEMAS', short_name: null, medical_aid_reference: 'MAG1' }
];

// Invented people. 0000101: a family with a medical aid; 0000102: a private patient already in OneHealth;
// 0000103: two dependants and nobody marked as main member; 0000104: a row without a birth date;
// 0000105: the same person as line 2 on a second account.
const PATIENTS = [
  'ACCOUNT_KEY,PATIENT_KEY,INITIALS,SURNAME,FIRSTNAME,SEX,BIRTHDAY,IDNUMBER,CELL,MEDICALAID_KEY,MEMBERSHIPNO,USERDEPENDANTNUMBER,RELATIONSHIP,RECALLDATE,REASON',
  '0000101,0,NM,Kandemo,Ndeshi Maria,F,1980/01/15,80011500123,0811234567,NMC01,900000001,00,Main member,2026/11/14,Check-up',
  '0000101,1,P,Kandemo,Petrus,M,2015/05/05,,,,,01,Child,,',
  '0000102,0,J,Testa,Johannes,M,1985/02/02,85020200456,,PRIVATE,,,Main member,,',
  '0000103,1,A,Sampula,Anna,F,2010/01/01,,,PSEMAS,12345678901,01,Child,,',
  '0000103,2,B,Sampula,Ben,M,2012/01/01,,,PSEMAS,12345678901,02,Child,,',
  '0000104,0,X,Nodate,Xavier,M,,,,,,,Main member,,',
  '0000105,0,NM,Kandemo,Ndeshi Maria,F,1980/01/15,80011500123,,,,,Main member,,'
].join('\n');

const AGE = [
  'Account,Debtor,Current,30,60,90,120,150,180+,Unallocated,Total',
  '0000101,KANDEMO N M,100.00,250.50,0,0,0,0,0,-50.00,300.50',
  '0000102,TESTA J,0,0,40.00,0,0,0,0,0,40.00',
  '0000103,SAMPULA,0,0,0,0,0,0,25.00,0,25.00',
  '0000199,ELSEWHERE,10.00,0,0,0,0,0,0,0,10.00',
  '0000200,ONLY ONEHEALTH,0,0,0,0,0,0,60.00,0,60.00',
  '0000201,IN CREDIT,0,0,0,0,0,0,0,-75.00,-75.00'
].join('\n');

const RECALLS = 'Account,Patient,Recall Date,Reason\n0000101,"KANDEMO, Petrus",2026/09/30,Check-up\n0000101,Someone Else,2026/12/01,Check-up';

const EXISTING: ExistingFile[] = [
  { id: 'existing-testa', first_name: 'Johannes', last_name: 'Testa', id_number: '85020200456', date_of_birth: '1985-02-02', cell_number: null, legacy_account_number: null },
  { id: 'existing-only', first_name: 'Olga', last_name: 'Onlyhere', id_number: '70010100789', date_of_birth: '1970-01-01', cell_number: null, legacy_account_number: '0000200' }
];

/** A detail record of a claim file with invented values */
const claim = (account: string, birth: string, name: string, code: string, amount: string, id = ''): string => {
  const fields = Array.from({ length: 53 }, () => '');
  Object.assign(fields, { 0: 'D', 3: account, 5: 'NMC1', 10: name, 11: birth, 12: code, 13: amount, 14: 'SERVICE', 16: '20250304', 17: '1.00', 23: '1234', 47: id });
  return fields.join(',');
};
const CLAIMS = ['1,0540001234567,1,D,37,20250310,EMINANCE,05.06.00,1.6',
  claim('0000101', '19800115', 'NDESHI', '8101', '450.00', '80011500123'),
  claim('0000101', '20150505', '01 PETRUS', '8107', '210.00'),
  claim('0000300', '19990101', 'NOBODY', '8101', '450.00')].join('\n');

function input(overrides: Partial<PlanInput> = {}, portion: BalancePortion = 'both'): PlanInput {
  const patients = toImportTable(parseDelimitedText(PATIENTS), 0);
  const age = toImportTable(parseDelimitedText(AGE), 0);
  const recalls = toImportTable(parseDelimitedText(RECALLS), 0);
  return {
    today: TODAY,
    people: readPeople(patients, recogniseColumns(patients.headers, 'patients'), { fileName: 'patients.csv', fileIndex: 0, today: TODAY, choices: NO_CHOICES }),
    balances: [{ fileName: 'age.csv', portion, rows: readBalances(age, recogniseColumns(age.headers, 'balances'), { fileName: 'age.csv', fileIndex: 1 }) }],
    recalls: readRecalls(recalls, recogniseColumns(recalls.headers, 'recalls'), { fileName: 'recalls.csv', fileIndex: 2, today: TODAY }),
    claims: parseClaimFile(CLAIMS, 'claims.Dat').lines,
    existing: EXISTING,
    funds: FUNDS,
    fundChoices: {},
    ownerOfBoth: 'medical_aid',
    ...overrides
  };
}

const person = (plan: ReturnType<typeof buildImportPlan>, key: string) => plan.people.find(item => item.key === key)!;

describe('suggestedFund', () => {
  it("recognises Eminance plan codes by their fund's letters (NMC01 is NMC), names and fund codes", () => {
    expect(suggestedFund('NMC01', FUNDS)).toBe('fund-nmc');
    expect(suggestedFund('PSEMAS Standard', FUNDS)).toBe('fund-psemas');
    expect(suggestedFund('MAG1', FUNDS)).toBe('fund-psemas');
  });

  it('treats private and cash plans as no medical aid, and leaves unknown plans for staff to choose', () => {
    expect(suggestedFund('PRIV01', FUNDS)).toBeNull();
    expect(suggestedFund('XYZ12', FUNDS)).toBeUndefined();
  });
});

describe('buildImportPlan: people', () => {
  const plan = buildImportPlan(input());

  it('creates new files for new people, with the medical aid of the account and the main member named for claims', () => {
    expect(person(plan, 'p:0:2')).toMatchObject({
      decision: 'new',
      medicalAid: { providerId: 'fund-nmc', membershipNumber: '900000001', mainMemberName: 'Kandemo, N M', relationship: 'self', dependantCode: '00' }
    });
    // The child's row has no plan or membership number: Eminance keeps them on the account
    expect(person(plan, 'p:0:3')).toMatchObject({
      decision: 'new',
      medicalAid: { providerId: 'fund-nmc', membershipNumber: '900000001', mainMemberName: 'Kandemo, N M', mainMemberIdNumber: '80011500123', relationship: 'child', dependantCode: '01' }
    });
  });

  it('uses the existing file of someone already in OneHealth (same ID number) instead of making a second file', () => {
    expect(person(plan, 'p:0:4')).toMatchObject({ decision: 'existing', existing: { id: 'existing-testa' } });
  });

  it('skips a row that cannot be saved, with the reason staff will see', () => {
    expect(person(plan, 'p:0:7')).toMatchObject({ decision: 'skip', reason: 'No date of birth (and no Namibian ID number to read it from)' });
  });

  it('brings a person listed on two accounts over once, because one person must have one file', () => {
    expect(person(plan, 'p:0:8')).toMatchObject({ decision: 'skip', reason: 'Also on line 2 (account 0000101): brought over once' });
  });

  it('links each dependant to the main member who pays, but not people on an account without a main member', () => {
    expect(plan.links).toEqual([expect.objectContaining({ patientKey: 'p:0:3', holderKey: 'p:0:2', relationship: 'child' })]);
    expect(plan.counts.accountsWithoutMainMember).toBe(1);
  });

  it('counts what will happen for the review screen', () => {
    expect(plan.counts).toMatchObject({ newPatients: 4, existingPatients: 2, skippedPatients: 2, withMedicalAid: 4, familyLinks: 1, noIdNumber: 3 });
  });
});

describe('buildImportPlan: balances', () => {
  it('puts "both portions" balances of medical aid members on the fund when staff say so, and private ones on the patient', () => {
    const plan = buildImportPlan(input());
    const kandemo = plan.balances.find(balance => balance.accountNumber === '0000101')!;
    // 50.00 credit pays the oldest debt (30 days) first
    expect(kandemo.bands).toEqual([
      { band: 'current', patientCents: 0, medicalAidCents: 10000 },
      { band: 'days_30', patientCents: 0, medicalAidCents: 20050 }
    ]);
    expect(kandemo.holderKey).toBe('p:0:2');
    const testa = plan.balances.find(balance => balance.accountNumber === '0000102')!;
    expect(testa).toMatchObject({ holderKey: 'p:0:4', bands: [{ band: 'days_60', patientCents: 4000, medicalAidCents: 0 }] });
  });

  it('asks who owes the balances of medical aid members until staff choose, instead of guessing', () => {
    const plan = buildImportPlan(input({ ownerOfBoth: null }));
    expect(plan.needsOwnerChoice).toBe(true);
    expect(plan.openQuestions).toContain('Who owes the balances of members with a medical aid: the medical aid or the patient?');
    expect(buildImportPlan(input({ ownerOfBoth: null }, 'patient')).needsOwnerChoice).toBe(false);
  });

  it('says why a balance cannot be brought over: no main member, not in the patient list, or nothing owed', () => {
    const plan = buildImportPlan(input());
    const reason = (account: string) => plan.balances.find(balance => balance.accountNumber === account)?.skipReason;
    expect(reason('0000103')).toBe('No main member on this account in the patient list');
    expect(reason('0000199')).toBe('This account is not in the patient list');
    expect(reason('0000201')).toBe('The account is in credit in Eminance: nothing is owed');
  });

  it("finds a OneHealth file by its Eminance number for an account the patient list does not have (a balances-only import)", () => {
    const plan = buildImportPlan(input());
    const only = plan.balances.find(balance => balance.accountNumber === '0000200')!;
    expect(only).toMatchObject({ holderKey: 'x:existing-only', skipReason: null });
    expect(person(plan, 'x:existing-only')).toMatchObject({ decision: 'existing', label: 'Olga Onlyhere' });
  });

  it('totals the balances and the credit Eminance holds beyond what accounts owe', () => {
    const { counts } = buildImportPlan(input());
    expect(counts).toMatchObject({ balanceAccounts: 3, balanceCents: 10000 + 20050 + 4000 + 6000, creditSetOffCents: 5000, creditAccounts: 1, creditLeftCents: 7500 });
    expect(counts.byBand).toEqual({ ...zeroBands(), current: 10000, days_30: 20050, days_60: 4000, days_180_plus: 6000 });
  });
});

describe('buildImportPlan: medical aid choices', () => {
  it('asks which fund an unknown plan is, and leaves the medical aid out when staff choose "no medical aid"', () => {
    const odd = input();
    const people = odd.people.map(row => (row.key === 'p:0:2' ? { ...row, medicalAidRaw: 'XYZ12' } : row));
    const plan = buildImportPlan({ ...odd, people });
    expect(plan.openQuestions).toContain('Which fund is "XYZ12"? (2 people)');
    const chosen = buildImportPlan({ ...odd, people, fundChoices: { xyz12: null } });
    expect(person(chosen, 'p:0:2').medicalAid).toBeNull();
    expect(chosen.openQuestions).toEqual([]);
  });
});

describe('buildImportPlan: recalls and claim history', () => {
  const plan = buildImportPlan(input());

  it('puts recalls from the patient list and the recall view on the month lists, matched to the right person', () => {
    expect(plan.recalls.filter(recall => !recall.skipReason).map(recall => [recall.patientKey, recall.listName])).toEqual([
      ['p:0:2', 'Eminance recalls: Nov 2026'],
      ['p:0:3', 'Eminance recalls: overdue']
    ]);
    expect(plan.recalls.find(recall => recall.skipReason)?.skipReason).toBe('Could not tell which person on account 0000101 this recall is for');
    expect(plan.recallLists.map(list => list.name)).toEqual(['Eminance recalls: Nov 2026', 'Eminance recalls: overdue']);
  });

  it('matches claim lines by ID number, else by account and birth date, and keeps the rest as unmatched', () => {
    expect(plan.claims.map(item => [item.patientKey, item.lines.length])).toEqual([['p:0:2', 1], ['p:0:3', 1]]);
    expect(plan.unmatchedClaims).toEqual([{ accountNumber: '0000300', lines: 1 }]);
  });
});

describe('stagedRows', () => {
  const rows = stagedRows(buildImportPlan(input()));

  it('sends people first with the payload names the database expects', () => {
    expect(rows[0]).toMatchObject({
      kind: 'patient', key: 'p:0:2', line: 2, account_number: '0000101', label: 'Ndeshi Maria Kandemo',
      payload: {
        decision: 'new', first_name: 'Ndeshi Maria', last_name: 'Kandemo', id_number: '80011500123', date_of_birth: '1980-01-15', gender: 'female',
        medical_aid: { provider_id: 'fund-nmc', membership_number: '900000001', relationship: 'self', dependant_code: '00' }
      }
    });
    expect(rows.find(row => row.key === 'p:0:4')?.payload).toEqual({ decision: 'existing', existing_patient_id: 'existing-testa' });
  });

  it('sends family links, balances in cents per band, recalls with their list and claim lines', () => {
    expect(rows.find(row => row.kind === 'family')?.payload).toEqual({ patient_key: 'p:0:3', holder_key: 'p:0:2', relationship: 'child' });
    expect(rows.find(row => row.key === 'b:0000102')?.payload).toEqual({ holder_key: 'p:0:4', bands: [{ band: 'days_60', patient_cents: 4000, medical_aid_cents: 0 }] });
    expect(rows.find(row => row.kind === 'recall')?.payload).toMatchObject({ patient_key: 'p:0:2', due_date: '2026-11-14', list_name: 'Eminance recalls: Nov 2026' });
    expect(rows.find(row => row.kind === 'claim_line')?.payload).toMatchObject({ patient_key: 'p:0:2', lines: [expect.objectContaining({ tariff_code: '8101', amount_cents: 45000 })] });
  });

  it('keeps what cannot be brought over as skipped rows with the reason, so the result screen can say why', () => {
    expect(rows.find(row => row.key === 'b:0000103')?.payload).toEqual({ skip_reason: 'No main member on this account in the patient list' });
    expect(rows.find(row => row.key === 'u:0000300')).toMatchObject({ kind: 'claim_line', label: 'Account 0000300: 1 claim lines' });
    // Accounts that owe nothing are not sent at all
    expect(rows.find(row => row.key === 'b:0000201')).toBeUndefined();
  });

  it('keeps every key short enough for the database (80 characters)', () => {
    expect(rows.every(row => row.key.length <= 80 && row.label.length <= 200)).toBe(true);
  });
});
