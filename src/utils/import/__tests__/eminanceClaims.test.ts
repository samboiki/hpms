import { describe, expect, it } from 'vitest';
import { isClaimFile, parseClaimFile, uniqueClaimLines } from '../eminanceClaims';

/** A detail record (53 fields) of the Methealth HP EDI / QEDI layout with invented values */
function detail(values: Record<number, string>): string {
  const fields = Array.from({ length: 53 }, (_, index) => values[index + 1] ?? '');
  fields[0] = 'D';
  return fields.join(',');
}

const LINE_A = detail({ 2: '1', 3: '4711', 4: '0000101', 5: 'T', 6: 'NMC1', 8: '900000001', 9: 'KANDEMO', 10: 'NM', 11: 'NDESHI', 12: '19800115', 13: '8101', 14: '450.00', 15: 'CONSULTATION', 16: '0.00', 17: '20250304', 18: '1.00', 24: '1234', 33: 'K02.1', 34: 'D', 38: 'F', 48: '80011500123' });
const LINE_B = detail({ 2: '2', 3: '4712', 4: '0000101', 6: 'NMC1', 11: '01 PETRUS', 12: '20150505', 13: '8107', 14: '210.00', 15: 'TOOTH: 16 INTRAORAL X-RAY', 17: '20250304', 18: '2.00', 24: '1234', 37: '16' });
// The trailer splits totals of 1,000 and more with an unquoted comma (as Eminance writes them)
const FILE = ['1,0540001234567,1,D,37,20250310,EMINANCE,05.06.00,1.6', LINE_A, LINE_B, 'Z,2,1,110.00'].join('\r\n');

describe('isClaimFile', () => {
  it('recognises a claim file by its header, detail and trailer records, so it is not read as a spreadsheet', () => {
    expect(isClaimFile(FILE)).toBe(true);
    expect(isClaimFile('Account,Surname\n0000101,Kandemo')).toBe(false);
  });
});

describe('parseClaimFile', () => {
  it('reads each claim line with the account, patient, date, code, amount, invoice, diagnosis and tooth', () => {
    const { lines, ignored } = parseClaimFile(FILE, '0540001234567_37_NMC1.Dat');
    expect(ignored).toBe(0);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      accountNumber: '0000101', fundCode: 'NMC1', firstName: 'NDESHI', dateOfBirth: '1980-01-15', idNumber: '80011500123',
      tariffCode: '8101', amountCents: 45000, serviceDate: '2025-03-04', quantity: 1, invoiceNumber: '1234', diagnosis: 'K02.1'
    });
  });

  it('drops the dependant number before the name and the "TOOTH: nn" prefix Eminance puts in the description', () => {
    const [, child] = parseClaimFile(FILE, 'x.Dat').lines;
    expect(child.firstName).toBe('PETRUS');
    expect(child.description).toBe('INTRAORAL X-RAY');
    expect(child.tooth).toBe('16');
    expect(child.quantity).toBe(2);
  });

  it('ignores the trailer, whose split thousands total is not a claim line', () => {
    expect(parseClaimFile('Z,1,23,652.41', 'x.Dat').lines).toEqual([]);
  });

  it('counts a damaged detail line as ignored instead of failing the whole file', () => {
    expect(parseClaimFile(detail({ 4: '0000101', 13: '8101' }), 'x.Dat')).toEqual({ lines: [], ignored: 1 });
  });
});

describe('uniqueClaimLines', () => {
  it('keeps one copy of a line found in two files (practices keep copies of the History folder)', () => {
    const { lines } = parseClaimFile(FILE, 'a.Dat');
    const { lines: copy } = parseClaimFile(FILE, 'copy/a.Dat');
    expect(uniqueClaimLines([...lines, ...copy])).toHaveLength(2);
  });
});
