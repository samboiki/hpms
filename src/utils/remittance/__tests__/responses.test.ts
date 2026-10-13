/**
 * Fund responses that come before (or instead of) a payment: the NMC claim assessment CSV, the
 * SwitchOn status report and the NHP batch acknowledgement. They carry no money; what matters is
 * that every rejected or pended line is found (so it can be fixed in time) and that format
 * detection never depends on the file name. Values are invented.
 */
import { describe, expect, it } from 'vitest';
import { parseNhpAcknowledgement, splitMessages } from '../nhpAcknowledgement';
import { parseNmcResponseCsv } from '../nmcResponseCsv';
import { isParsed, parseRemittancePages, parseRemittanceText, reconciliationStatus } from '../parseRemittance';
import { parseSwitchOnCsv } from '../switchOnCsv';
import { methealthStatement, nhpAcknowledgement, nmcCsv, NMC_HEADER, page, switchOnCsv, textAt } from './fixtures';

describe('NMC claim assessment CSV', () => {
  const csv = nmcCsv([
    { ref: '0000101', member: '000111222', date: '15/09/2026', tariff: '00190', claimed: 52000, benefit: 52000, status: 'ASSESSED', claim: '1', item: '1' },
    // Quantity 2 comes back as two items of one unit each
    { ref: '0000101', member: '000111222', date: '15/09/2026', tariff: '08109', claimed: 2500, benefit: 2500, status: 'ASSESSED', claim: '1', item: '2' },
    { ref: '0000101', member: '000111222', date: '15/09/2026', tariff: '08109', claimed: 2500, benefit: 0, status: 'PENDED', code: '388', note: 'POSSIBLE DUPLICATE ITEM WITHIN SAME CLAIM NO.', claim: '1', item: '3' },
    { ref: '0000202', member: '000333444', date: '16/09/2026', tariff: '00190', claimed: 52000, benefit: 0, status: 'REJECTED', code: '467', note: 'OPTION PAYS PREFERRED PROVIDER ONLY', claim: '2', item: '1' }
  ]);

  it('reads every assessed item with its status, code and the fund note', () => {
    const doc = parseNmcResponseCsv(csv);
    expect(doc).toMatchObject({ kind: 'adjudication', administrator: 'methealth', fundCode: 'NMC1', practiceNumber: '1110000222333', documentDate: '2026-10-01' });
    expect(doc.lines.map(line => line.status)).toEqual(['accepted', 'accepted', 'pended', 'rejected']);
    expect(doc.lines[3]).toMatchObject({ practiceReference: '0000202', memberNumber: '000333444', serviceDate: '2026-09-16', reasonCodes: ['467'], reasonTexts: ['OPTION PAYS PREFERRED PROVIDER ONLY'], fundClaimRef: '0000000777/2/1' });
  });

  it('adds up: on every row the benefit plus what was not paid is the amount claimed', () => {
    expect(reconciliationStatus(parseNmcResponseCsv(csv)).ok).toBe(true);
  });

  it('says it assumes NMC, because the file does not name the fund', () => {
    expect(parseNmcResponseCsv(csv).warnings.join(' ')).toMatch(/does not name the fund/);
  });

  it('still reads a row whose description contains an unquoted comma (the columns after it would shift)', () => {
    const shifted = csv.replace(' CONSULTATION', ' CONSULTATION, FOLLOW-UP');
    const doc = parseNmcResponseCsv(shifted);
    expect(doc.lines[0]).toMatchObject({ description: 'CONSULTATION, FOLLOW-UP', claimedCents: 52000, status: 'accepted' });
    expect(reconciliationStatus(doc).ok).toBe(true);
  });

  it('reads a medicine line (a dispensing GP) by its NAPPI code from the medicine columns', () => {
    const medicine = `${NMC_HEADER}\n1110000222333-EXAMPLE CLINIC,0000101,000111222,A EXAMPLE,00,ANNA EXAMPLE,15/09/2026,D,,01/10/2026,,,0.00,0.00,0.00,0.00,,0.00,0.00,0.00,0.00,ASSESSED,,,0000000777,1,4,AMOXICILLIN 500MG,7000001,15.00,96.00,96.00,ASSESSED,,\n`;
    const [line] = parseNmcResponseCsv(medicine).lines;
    expect(line).toMatchObject({ tariffRaw: '7000001', description: 'AMOXICILLIN 500MG', quantity: 15, claimedCents: 9600, paidCents: 9600 });
  });
});

describe('SwitchOn claim status report', () => {
  const csv = switchOnCsv([
    { date: '10/09/2026', account: '26000123', patient: 'ANNA EXAMPLE', claim: '1', status: 'CLAIM APPROVED FOR PAYMENT', amount: '1250.5' },
    { date: '11/09/2026', account: '26000124', patient: 'BEN SAMPLE', claim: '2', status: 'CLAIM APPROVED FOR PART ', amount: '980.00' },
    { date: '12/09/2026', account: '26000125', patient: 'CARL SAMPLE', claim: '3', status: 'CLAIM REJECTED', amount: '310.00' }
  ]);

  it('reads one line per claim with the invoice reference the practice sent, and maps the switch statuses', () => {
    const doc = parseSwitchOnCsv(csv);
    expect(doc).toMatchObject({ kind: 'claim_status', fundCode: 'MAG1', documentDate: '2026-09-30' });
    expect(doc.lines.map(line => [line.invoiceReference, line.status, line.claimedCents])).toEqual([
      ['26000123', 'accepted', 125050], ['26000124', 'part_paid', 98000], ['26000125', 'rejected', 31000]
    ]);
  });

  it('checks the claim count and total amount printed under the report', () => {
    expect(reconciliationStatus(parseSwitchOnCsv(csv)).ok).toBe(true);
    expect(reconciliationStatus(parseSwitchOnCsv(switchOnCsv([{ date: '10/09/2026', account: '1', patient: 'A', claim: '1', status: 'CLAIM APPROVED FOR PAYMENT', amount: '10.00' }], '99.00'))).ok).toBe(false);
  });
});

describe('NHP batch claim acknowledgement', () => {
  const pages = nhpAcknowledgement('1110000222333_45_NHPM_Dat.processed', [
    [
      { rx: '0000101', date: '15/09/2026', adminRef: '1000000001', member: '00000111222', dep: '01', item: '1', code: '0190', claimed: 52000, processed: 52000 },
      { rx: '0000101', date: '15/09/2026', adminRef: '1000000001', member: '00000111222', dep: '01', item: '2', code: '0308', claimed: 18000, processed: 0, notes: ['Claim line submitted without', 'diagnosis codes -- Service not', 'covered by plan'] }
    ],
    [
      { rx: '0000202', date: '16/09/2026', adminRef: '1000000002', member: '00000333444', dep: '00', item: '1', notes: ['Claim has been held for manual', 'intervention'] },
      { rx: '0000202', date: '16/09/2026', adminRef: '1000000002', member: '00000333444', dep: '00', item: '2', code: '0190', claimed: 52000, processed: 0, notes: ['This patient is not registered as a', 'beneficiary of the member'] }
    ]
  ]);

  it('reads each line with what the administrator processed and every message, joined across wrapped rows', () => {
    const doc = parseNhpAcknowledgement(pages);
    expect(doc).toMatchObject({ kind: 'acknowledgement', fundCode: 'NHPM', practiceNumber: '0000001', documentDate: '2026-10-03' });
    expect(doc.lines).toHaveLength(4);
    expect(doc.lines[1]).toMatchObject({ practiceReference: '0000101', dependantCode: '01', tariffRaw: '0308', claimedCents: 18000, paidCents: 0, status: 'rejected' });
    expect(doc.lines[1].reasonTexts).toEqual(['Claim line submitted without diagnosis codes', 'Service not covered by plan']);
    expect(doc.lines[2]).toMatchObject({ tariffRaw: null, status: 'pended' });
    expect(doc.lines[3].reasonTexts).toEqual(['This patient is not registered as a beneficiary of the member']);
  });

  it('adds up per claim (script totals) and for the batch', () => {
    expect(reconciliationStatus(parseNhpAcknowledgement(pages)).ok).toBe(true);
  });

  it('splits several messages printed in one cell', () => {
    expect(splitMessages('Tooth number(s) required. -- Claim line submitted without diagnosis codes')).toEqual(['Tooth number(s) required.', 'Claim line submitted without diagnosis codes']);
  });
});

describe('recognising a file by its content, never its name', () => {
  it('recognises each layout whatever the file is called', () => {
    const statement = parseRemittancePages(methealthStatement({ fund: 'NMC', pages: [[{ member: '000111222', name: 'A', ref: '0000101', date: '15-09-26', tariff: '00190', claimed: 100, paid: 100 }]] }));
    expect(isParsed(statement) && statement.format).toBe('methealth_statement');
    const csv = parseRemittanceText(nmcCsv([{ ref: '1', member: '1', date: '15/09/2026', tariff: '00190', claimed: 100, benefit: 100, status: 'ASSESSED', claim: '1', item: '1' }]));
    expect(isParsed(csv) && csv.format).toBe('nmc_response_csv');
  });

  it("explains files that are related but not fund responses instead of misreading them", () => {
    const medres = parseRemittanceText('1,1110000222333,R,1,2,20260930,,\r\nR,2,1,0000101,20260915,A,000111222, 52.00,1234,B, 52.00,,0000101,19800101,A,0190,1/1/1,\r\nZ,1, 52.00\r\n');
    expect(medres).toMatchObject({ format: null, reason: expect.stringMatching(/Eminance's own response file/) });
    const claimFile = parseRemittanceText('1,1110000222333,1,D,45,20260930,ONEHEALTH,01.00.00,1.6\r\nD,1,1,0000101,T,NMC1\r\nZ,1,52.00\r\n');
    expect(claimFile).toMatchObject({ format: null, reason: expect.stringMatching(/claim file the practice sends/) });
    const scan = parseRemittancePages([page(1, [], 0)]);
    expect(scan).toMatchObject({ format: null, reason: expect.stringMatching(/no text/) });
  });

  it('will not post a document that has no totals to check its lines against', () => {
    const statement = parseRemittancePages([page(1, [textAt('REMITTANCE STATEMENT: NMC', 326, 35, 12), textAt('PAID TO', 667, 135, 10), textAt('MEMBER PORTION', 748, 135, 10)])]);
    expect(isParsed(statement)).toBe(true);
    if (isParsed(statement)) expect(reconciliationStatus(statement.documents[0]).ok).toBe(false);
  });
});
