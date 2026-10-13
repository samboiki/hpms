import { describe, expect, it } from 'vitest';
import { zeroBands } from '../../../services/ledger/ageAnalysis';
import { ageBandFor, invoiceAgeDays } from '../../../services/ledger/receivables';
import { recogniseColumns } from '../eminanceFields';
import { combineBalances, openingBalanceDate, readBalances, setOffCredit } from '../eminanceBalances';
import { parseDelimitedText, toImportTable } from '../tableFile';

// An invented age analysis in the layout of Eminance's report: per account, Current to 180+, Unallocated and Total
const CSV = [
  'Account;Debtor;Current;30;60;90;120;150;180+;Unallocated;Total',
  '0000101;KANDEMO N M;100,00;250,50;0,00;100,00;0,00;0,00;7,77;0,00;458,27',
  '0000102;TESTA J;0,00;0,00;50,00;0,00;0,00;0,00;200,00;-120,00;130,00',
  '0000103;SAMPULA A;0,00;0,00;0,00;0,00;0,00;0,00;0,00;-80,00;-80,00',
  'TOTAL;;100,00;250,50;50,00;100,00;0,00;0,00;207,77;-200,00;508,27'
].join('\n');

const rows = () => {
  const table = toImportTable(parseDelimitedText(CSV), 0);
  return readBalances(table, recogniseColumns(table.headers, 'balances'), { fileName: 'age.csv', fileIndex: 1 });
};

describe('readBalances', () => {
  it('reads each age column in cents and the unallocated credit as a positive credit', () => {
    const [kandemo, testa] = rows();
    expect(kandemo.bands).toEqual({ ...zeroBands(), current: 10000, days_30: 25050, days_90: 10000, days_180_plus: 777 });
    expect(kandemo.creditCents).toBe(0);
    expect(testa.creditCents).toBe(12000);
    expect(kandemo.problems).toEqual([]);
  });

  it("skips the report's total line, which would otherwise be imported as an account called TOTAL", () => {
    expect(rows()[3].problems).toContainEqual({ message: 'A total line, not an account', blocking: true });
  });

  it('warns when the total does not match the age columns, so a damaged export is noticed', () => {
    const table = toImportTable(parseDelimitedText('Account,Current,30,Total\n0000104,100.00,50.00,999.00'), 0);
    const [row] = readBalances(table, recogniseColumns(table.headers, 'balances'), { fileName: 'x.csv', fileIndex: 0 });
    expect(row.problems[0]).toMatchObject({ blocking: false });
  });
});

describe('setOffCredit', () => {
  it('pays the oldest debt first, as Eminance allocates credit when an account is converted', () => {
    const bands = { ...zeroBands(), days_60: 5000, days_180_plus: 20000 };
    expect(setOffCredit(bands, 12000)).toEqual({ bands: { ...zeroBands(), days_60: 5000, days_180_plus: 8000 }, creditLeftCents: 0 });
  });

  it('keeps credit larger than the debt as credit left over, which is not brought over as a balance', () => {
    expect(setOffCredit({ ...zeroBands(), current: 3000 }, 8000)).toEqual({ bands: zeroBands(), creditLeftCents: 5000 });
  });
});

describe('combineBalances', () => {
  it('puts a "medical aid only" file on the fund portion and a "patient only" file on the patient portion', () => {
    const [kandemo] = rows();
    const accounts = combineBalances(
      [
        { fileName: 'fund.csv', rows: [kandemo], portion: 'medical_aid' },
        { fileName: 'patient.csv', rows: [{ ...kandemo, bands: { ...zeroBands(), days_30: 1000 } }], portion: 'patient' }
      ],
      () => 'patient'
    );
    expect(accounts).toHaveLength(1);
    expect(accounts[0].medicalAid.days_30).toBe(25050);
    expect(accounts[0].patient.days_30).toBe(1000);
  });

  it('lets the owner choice decide where a "both portions" file goes for members with a medical aid', () => {
    const accounts = combineBalances([{ fileName: 'age.csv', rows: rows(), portion: 'both' }], account => (account === '0000101' ? 'medical_aid' : 'patient'));
    expect(accounts.find(account => account.accountNumber === '0000101')?.medicalAid.current).toBe(10000);
    const testa = accounts.find(account => account.accountNumber === '0000102');
    expect(testa?.patient).toEqual({ ...zeroBands(), days_60: 5000, days_180_plus: 8000 });
    expect(testa?.creditUsedCents).toBe(12000);
  });

  it('reports an account in credit with the credit left, and adds up an account listed twice in one file', () => {
    const [, , sampula] = rows();
    const accounts = combineBalances([{ fileName: 'age.csv', rows: [sampula, sampula], portion: 'patient' }], () => 'patient');
    expect(accounts[0].creditLeftCents).toBe(16000);
    expect(accounts[0].warnings).toEqual(['On 2 lines of age.csv: the amounts were added up']);
  });

  it('warns when one account is in two files of the same portion, since the same export added twice would double its balance', () => {
    const [kandemo] = rows();
    const accounts = combineBalances(
      [
        { fileName: 'age.csv', rows: [kandemo], portion: 'patient' },
        { fileName: 'age (1).csv', rows: [kandemo], portion: 'patient' }
      ],
      () => 'patient'
    );
    expect(accounts[0].patient.current).toBe(20000);
    expect(accounts[0].warnings).toEqual(['In 2 files of the same portion (age.csv, age (1).csv): the amounts were added up. Check the same age analysis was not added twice']);
  });
});

describe('openingBalanceDate', () => {
  it("dates a balance at the start of its band, so OneHealth's age analysis shows it in the band Eminance did", () => {
    const asOf = '2026-10-07';
    for (const band of ['current', 'days_30', 'days_60', 'days_90', 'days_120', 'days_150', 'days_180_plus'] as const) {
      const issueDate = openingBalanceDate(asOf, band);
      expect(ageBandFor(invoiceAgeDays({ issueDate, createdAt: null }, asOf))).toBe(band);
    }
    expect(openingBalanceDate(asOf, 'days_30')).toBe('2026-09-07');
  });
});
