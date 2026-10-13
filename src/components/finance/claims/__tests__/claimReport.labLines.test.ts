/**
 * A dental 8099 line goes to the fund with its lab's invoice lines (type L records after it). They are part of what the
 * 8099 line claims, never claims of their own: the report, the stored file's count and total, and the matching of the
 * sent file to the batch's lines must count the claim lines only, while the file's own end record counts every record.
 * Invented values only.
 */
import { describe, expect, it } from 'vitest';
import { buildClaimFile, type ClaimFileHeader } from '../../../../utils/billing/claimFile';
import type { ClaimLine } from '../../../../utils/billing/claimLine';
import { buildClaimReport, sentFileFields, storedClaimFile } from '../claimReport';
import type { BatchHeaderRow } from '../types';

const header: ClaimFileHeader = { practiceNumber: '0012345', batchNumber: 52, batchDate: '2026-10-13', fundReference: 'NMC1' };

const line = (transactionNumber: number, overrides: Partial<ClaimLine> = {}): ClaimLine =>
  ({
    key: `detail-${transactionNumber}`,
    transactionNumber,
    systemTransactionNumber: transactionNumber,
    patientReference: '0000101',
    fundReference: 'NMC1',
    membershipNumber: '99887766',
    memberSurname: 'TESTER',
    memberInitials: 'A',
    patientName: 'Ana Tester',
    patientDateOfBirth: '1990-01-01',
    tariffCode: '8101',
    amount: 254.7,
    description: 'Examination',
    serviceDate: '2026-10-13',
    quantity: 1,
    invoiceNumber: 'INV-0009',
    invoiceId: 'invoice-9',
    visitId: 'visit-9',
    practiceNumber: '0012345',
    icd10Primary: 'K02.1',
    icd10Secondary: [],
    icd10Confirmed: true,
    treatingDoctorHpcnaNumber: 'DEN0001',
    toothNumbers: '',
    gender: 'F',
    patientIdNumber: '',
    extra: {},
    ...overrides
  }) as ClaimLine;

const content = buildClaimFile(header, [
  line(1),
  line(2, {
    tariffCode: '8099',
    amount: 1970,
    labSlipNumber: 'LS-4471',
    labDetails: [
      { code: '9330', description: 'Crown', amount: 1850 },
      { code: null, description: 'Model', amount: 120 }
    ]
  })
]).content;
const details = [
  { transaction_number_in_batch: 1, patient_id: 'patient-1', invoice_id: 'invoice-9' },
  { transaction_number_in_batch: 2, patient_id: 'patient-1', invoice_id: 'invoice-9' }
];

describe('a claim file with a dental lab invoice under its 8099 line', () => {
  it('reports the claim lines only, and agrees with the file\'s own count and total of every record', () => {
    const report = buildClaimReport({ file: { fileName: 'x.Dat', content }, source: 'sent_file', practiceName: 'P', fundName: 'F', fundCode: 'NMC1', sentAt: null, details });
    expect(report.lines.map(item => [item.lineNumber, item.tariffCode, item.amountCents])).toEqual([
      [1, '8101', 25470],
      [2, '8099', 197000]
    ]);
    expect(report.totalCents).toBe(222470);
    expect(report.trailer).toEqual({ lineCount: 4, totalCents: 419470 });
    expect(report.matchesTrailer).toBe(true);
  });

  it('keeps the sent file\'s count and total of what was claimed', () => {
    const file = storedClaimFile({ practice_number: '0012345', batch_number: 52, medical_aid_reference: 'NMC1', generated_file_content: content } as BatchHeaderRow);
    expect(file?.lineCount).toBe(2);
    expect(file?.totalCents).toBe(222470);
  });

  it('matches the sent file to the batch\'s lines by line number, without the lab lines', () => {
    const fields = sentFileFields({ generated_file_content: content });
    expect([...fields.keys()].sort()).toEqual([1, 2]);
    expect(fields.get(2)?.[12]).toBe('8099');
  });
});
