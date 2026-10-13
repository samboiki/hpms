/**
 * The per-file claim report is what a practice prints and files with each claim batch (and what it checks a fund's
 * query against), so it must say exactly what the claim file says: the same lines, line count and total, read from
 * the file itself. Invented values only.
 */
import { describe, it, expect } from 'vitest';
import { buildClaimFile, type ClaimFileHeader } from '../../../../utils/billing/claimFile';
import type { ClaimLine } from '../../../../utils/billing/claimLine';
import { buildClaimReport, claimReportHtml, storedClaimFile } from '../claimReport';
import type { BatchHeaderRow } from '../types';

const header: ClaimFileHeader = { practiceNumber: '0012345', batchNumber: 41, batchDate: '2026-09-30', fundReference: 'NHPM' };

const line = (transactionNumber: number, overrides: Partial<ClaimLine> = {}): ClaimLine => ({
  key: `detail-${transactionNumber}`,
  transactionNumber,
  systemTransactionNumber: transactionNumber,
  patientReference: '0000101',
  fundReference: 'NHPM',
  membershipNumber: '99887766',
  memberSurname: 'TESTER',
  memberInitials: 'A',
  patientName: 'Ana Tester',
  patientDateOfBirth: '1990-01-01',
  tariffCode: '0190',
  amount: 450,
  description: 'Consultation',
  serviceDate: '2026-09-15',
  quantity: 1,
  invoiceNumber: 'INV-0007',
  invoiceId: 'invoice-7',
  visitId: null,
  practiceNumber: '0012345',
  authorisationNumber: '',
  resubmissionFlag: '',
  icd10Primary: 'J06.9',
  icd10Secondary: [],
  icd10Confirmed: true,
  treatingDoctorHpcnaNumber: 'MP0001',
  toothNumbers: '',
  gender: 'F',
  patientIdNumber: '',
  extra: {},
  ...overrides
} as ClaimLine);

const details = [
  { transaction_number_in_batch: 1, patient_id: 'patient-1', invoice_id: 'invoice-7' },
  { transaction_number_in_batch: 2, patient_id: 'patient-2', invoice_id: 'invoice-8' }
];

describe('buildClaimReport', () => {
  const file = buildClaimFile(header, [
    line(1),
    line(2, { patientName: 'Ben <Tester>', patientReference: '0000202', tariffCode: '8101', amount: 1250.5, serviceDate: '2026-09-16', invoiceNumber: 'INV-0008' })
  ]);
  const report = buildClaimReport({ file, source: 'sent_file', practiceName: 'Rehearsal Practice', fundName: 'Namibia Health Plan', fundCode: 'NHPM', sentAt: '2026-10-01T09:00:00', details });

  // The invoice number too is shown as the fund received it (claim field 24 keeps at most 8 characters: "0007")
  it('lists every line with patient, account, date, code and amount exactly as the file has them', () => {
    expect(report.lines.map(l => [l.lineNumber, l.patientName, l.accountReference, l.serviceDate, l.tariffCode, l.amountCents, l.invoiceNumber])).toEqual([
      [1, 'ANA TESTER', '0000101', '2026-09-15', '0190', 45000, '0007'],
      [2, 'BEN <TESTER>', '0000202', '2026-09-16', '8101', 125050, '0008']
    ]);
  });

  it('counts and totals the lines, and agrees with the count and total at the end of the file', () => {
    expect(report.lineCount).toBe(2);
    expect(report.totalCents).toBe(170050);
    expect(report.trailer).toEqual({ lineCount: 2, totalCents: 170050 });
    expect(report.matchesTrailer).toBe(true);
  });

  it('takes practice number, batch number and batch date from the file header, and the date sent from the batch', () => {
    expect(report.practiceNumber).toBe('0012345');
    expect(report.batchNumber).toBe('41');
    expect(report.batchDate).toBe('2026-09-30');
    expect(report.sentOn).toBe('2026-10-01');
    expect(report.fileName).toBe('0012345_41_NHPM.Dat');
  });

  // The report links each line to its patient and invoice: the link comes from the batch line with the same number
  it('links each line to the patient and invoice of the batch line with the same line number', () => {
    expect(report.lines.map(l => [l.patientId, l.invoiceId])).toEqual([['patient-1', 'invoice-7'], ['patient-2', 'invoice-8']]);
    const unlinked = buildClaimReport({ file, source: 'batch_lines', practiceName: 'P', fundName: 'F', fundCode: 'NHPM', sentAt: null, details: [] });
    expect(unlinked.lines.every(l => l.patientId === null && l.invoiceId === null)).toBe(true);
    expect(unlinked.sentOn).toBeNull();
  });

  // A file whose end record disagrees with its lines must never be filed as if it were right
  it('flags a file whose lines do not add up to its own count and total', () => {
    const tampered = { ...file, content: file.content.replace(/\r\nZ,2,1700\.50,/, '\r\nZ,3,1700.50,') };
    const flagged = buildClaimReport({ file: tampered, source: 'sent_file', practiceName: 'P', fundName: 'F', fundCode: 'NHPM', sentAt: null, details });
    expect(flagged.trailer?.lineCount).toBe(3);
    expect(flagged.matchesTrailer).toBe(false);
    expect(claimReportHtml(flagged)).toContain('do not agree');
  });

  it('prints day-first dates and N$ amounts, and escapes what came from the file', () => {
    const html = claimReportHtml(report);
    expect(html).toContain('16 Sep 2026');
    expect(html).toContain('N$ 1,250.50');
    expect(html).toContain('N$ 1,700.50');
    expect(html).toContain('BEN &lt;TESTER&gt;');
    expect(html).not.toContain('BEN <TESTER>');
    expect(html).toContain('exactly as it was sent');
  });
});

describe('storedClaimFile', () => {
  const batch = {
    practice_number: '0012345', batch_number: 41, medical_aid_reference: 'NHPM',
    generated_file_content: buildClaimFile(header, [line(1), line(2, { amount: 100 })]).content
  } as BatchHeaderRow;

  // A sent batch reports (and downloads) the file the fund received, not one rebuilt from lines changed since
  it('is the file exactly as it was sent, with its line count and total', () => {
    const file = storedClaimFile(batch);
    expect(file?.content).toBe(batch.generated_file_content);
    expect(file?.fileName).toBe('0012345_41_NHPM.Dat');
    expect(file?.lineCount).toBe(2);
    expect(file?.totalCents).toBe(55000);
  });

  it('is null when the batch did not keep the file it sent', () => {
    expect(storedClaimFile({ ...batch, generated_file_content: null })).toBeNull();
  });
});
