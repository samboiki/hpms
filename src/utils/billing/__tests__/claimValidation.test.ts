import { describe, it, expect } from 'vitest';
import { validateClaimLine, validateClaimBatch, type ClaimField } from '../claimValidation';
import { FUND_RULES, DEFAULT_FUND_RULE, getFundRule, checkClaimDeadline, lastSubmissionDay } from '../fundRules';
import type { ClaimLine } from '../claimLine';
import { dayRange, localKey } from './generators';

const NHP = FUND_RULES.find(rule => rule.key === 'NHP')!;
const NMC = FUND_RULES.find(rule => rule.key === 'NMC')!;
const PSEMAS = FUND_RULES.find(rule => rule.key === 'PSEMAS')!;
const TODAY = '2026-10-06';

const validLine = (overrides: Partial<ClaimLine> = {}): ClaimLine => ({
  key: 'line-1',
  transactionNumber: 1,
  systemTransactionNumber: 50123,
  invoiceId: 'inv-1',
  invoiceNumber: 'INV2610001',
  visitId: 'visit-1',
  fundReference: 'NMC1',
  membershipNumber: '12345678',
  memberSurname: 'Shilongo',
  memberInitials: 'EM',
  patientName: 'Elisabeth Shilongo',
  patientDateOfBirth: '1990-05-17',
  patientIdNumber: '90051700123',
  patientReference: '1234',
  gender: 'F',
  tariffCode: '8101',
  description: 'Full mouth examination',
  serviceDate: '2026-09-20',
  quantity: 1,
  amount: 254.7,
  unitPrice: 254.7,
  practiceNumber: '0540001133241',
  treatingDoctorHpcnaNumber: 'DEN00417',
  doctorHpcnaNumber: 'DEN00417',
  icd10Primary: 'Z01.2',
  icd10Secondary: [],
  icd10Confirmed: true,
  toothNumbers: '',
  requiresTooth: false,
  ...overrides
});

const context = { today: TODAY, fundRule: NMC, practiceNumber: '0540001133241' };
const errorFields = (line: ClaimLine): ClaimField[] => validateClaimLine(line, context).errors.map(issue => issue.field);

// Business rule: a complete, correct line passes with no errors and no warnings - validation must
// not cry wolf, or staff learn to ignore it.
describe('a correct claim line', () => {
  it('has no errors or warnings', () => {
    const result = validateClaimLine(validLine(), context);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.deadline.status).toBe('ok');
  });
});

// Business rule: every field the fund needs to identify the member, the patient, the practice,
// the practitioner and the service must be present; a missing one is a guaranteed rejection.
describe('missing details block the claim', () => {
  it.each([
    { field: 'membershipNumber', overrides: { membershipNumber: '' } },
    { field: 'memberSurname', overrides: { memberSurname: '  ' } },
    { field: 'memberInitials', overrides: { memberInitials: '' } },
    { field: 'patientName', overrides: { patientName: '' } },
    { field: 'patientDateOfBirth', overrides: { patientDateOfBirth: null } },
    { field: 'patientIdNumber', overrides: { patientIdNumber: '' } },
    { field: 'patientReference', overrides: { patientReference: '' } },
    { field: 'gender', overrides: { gender: '' } },
    { field: 'practiceNumber', overrides: { practiceNumber: '' } },
    { field: 'treatingDoctorHpcnaNumber', overrides: { treatingDoctorHpcnaNumber: '', doctorHpcnaNumber: null } },
    { field: 'tariffCode', overrides: { tariffCode: '' } },
    { field: 'serviceDate', overrides: { serviceDate: null } },
    { field: 'icd10', overrides: { icd10Primary: '' } },
    { field: 'invoiceNumber', overrides: { invoiceNumber: '' } },
    { field: 'fundReference', overrides: { fundReference: '' } },
    { field: 'transactionNumber', overrides: { transactionNumber: 0 } },
    { field: 'quantity', overrides: { quantity: 0 } },
    { field: 'amount', overrides: { amount: 0, unitPrice: null } }
  ] as Array<{ field: ClaimField; overrides: Partial<ClaimLine> }>)('$field', ({ field, overrides }) => {
    expect(errorFields(validLine(overrides))).toContain(field);
  });
});

// Business rule: values must have the shape the fund's system accepts. Fake codes such as the old
// fallback "M001" or "001" are not NAMAF tariff codes and must never reach a claim.
describe('badly formatted details block the claim', () => {
  it.each([
    { label: 'membership with spaces', field: 'membershipNumber', overrides: { membershipNumber: '1234 5678' } },
    { label: 'membership with symbols', field: 'membershipNumber', overrides: { membershipNumber: '1234#5678' } },
    { label: 'surname with digits', field: 'memberSurname', overrides: { memberSurname: 'Sh1longo' } },
    { label: 'surname too long', field: 'memberSurname', overrides: { memberSurname: 'A'.repeat(51) } },
    { label: 'initials with digits', field: 'memberInitials', overrides: { memberInitials: 'E1' } },
    { label: 'date of birth in the future', field: 'patientDateOfBirth', overrides: { patientDateOfBirth: '2027-01-01' } },
    { label: 'born after the service', field: 'patientDateOfBirth', overrides: { patientDateOfBirth: '2026-09-21' } },
    { label: 'impossible birth date', field: 'patientDateOfBirth', overrides: { patientDateOfBirth: '1990-02-30' } },
    { label: 'born 1880', field: 'patientDateOfBirth', overrides: { patientDateOfBirth: '1880-01-01' } },
    { label: 'ID with symbols', field: 'patientIdNumber', overrides: { patientIdNumber: '900517-00123' } },
    { label: 'patient reference with letters', field: 'patientReference', overrides: { patientReference: '3f9a2c1' } },
    { label: 'patient reference of 8 digits', field: 'patientReference', overrides: { patientReference: '12345678' } },
    { label: 'gender unknown', field: 'gender', overrides: { gender: 'X' } },
    { label: 'practice number with letters', field: 'practiceNumber', overrides: { practiceNumber: 'PR0540001' } },
    { label: 'practice number of another practice', field: 'practiceNumber', overrides: { practiceNumber: '0540001133242' } },
    { label: 'HPCNA with symbols', field: 'treatingDoctorHpcnaNumber', overrides: { treatingDoctorHpcnaNumber: 'DEN#417' } },
    { label: 'fake fallback code M001', field: 'tariffCode', overrides: { tariffCode: 'M001' } },
    { label: 'three-digit code 001', field: 'tariffCode', overrides: { tariffCode: '001' } },
    { label: 'letter O instead of zero', field: 'tariffCode', overrides: { tariffCode: '81O1' } },
    { label: 'manual placeholder tariff', field: 'tariffCode', overrides: { tariffCode: 'manual-8109' } },
    { label: 'invalid ICD-10', field: 'icd10', overrides: { icd10Primary: 'URTI' } },
    { label: 'external cause as primary', field: 'icd10', overrides: { icd10Primary: 'W01.0' } },
    { label: 'unconfirmed ICD-10 suggestion', field: 'icd10', overrides: { icd10Confirmed: false } },
    { label: 'invalid tooth', field: 'toothNumbers', overrides: { toothNumbers: '19' } },
    { label: 'tooth required but missing', field: 'toothNumbers', overrides: { requiresTooth: true, toothNumbers: '' } },
    { label: 'negative amount', field: 'amount', overrides: { amount: -254.7, unitPrice: null } },
    { label: 'amount not unit x quantity', field: 'amount', overrides: { quantity: 2, amount: 254.7 } },
    { label: 'quantity with 3 decimals', field: 'quantity', overrides: { quantity: 1.005 } },
    { label: 'quantity over 99', field: 'quantity', overrides: { quantity: 100, amount: 25470 } },
    { label: 'service date in the future', field: 'serviceDate', overrides: { serviceDate: '2026-10-07' } },
    { label: 'service date expired', field: 'serviceDate', overrides: { serviceDate: '2026-01-01' } }
  ] as Array<{ label: string; field: ClaimField; overrides: Partial<ClaimLine> }>)('$label', ({ field, overrides }) => {
    expect(errorFields(validLine(overrides))).toContain(field);
  });

  it('accepts real-world variations that are correct', () => {
    const variations: Array<Partial<ClaimLine>> = [
      { membershipNumber: 'NMC/12345-01' },
      { memberSurname: "O'Brien-Nangolo" },
      { memberSurname: 'Müller' },
      { memberInitials: 'E. M.' },
      { gender: 'female' },
      { gender: 'm' },
      { tariffCode: '0190' },
      { toothNumbers: '36', requiresTooth: true },
      { quantity: 3, amount: 764.1, unitPrice: 254.7 },
      { amount: 254.7, unitPrice: null },
      { icd10Primary: 'j069' },
      { treatingDoctorHpcnaNumber: 'MP 01234', doctorHpcnaNumber: 'mp01234' }
    ];
    variations.forEach(overrides => expect(validateClaimLine(validLine(overrides), context).errors).toEqual([]));
  });
});

// Business rule: some details are suspicious but can be correct; they are shown as warnings and
// do not block submission.
describe('warnings', () => {
  it.each([
    { label: 'passport instead of ID', field: 'patientIdNumber', overrides: { patientIdNumber: 'P1234567' } },
    { label: 'HPCNA differs from the doctor record', field: 'treatingDoctorHpcnaNumber', overrides: { doctorHpcnaNumber: 'DEN00999' } },
    { label: 'several teeth on one line', field: 'toothNumbers', overrides: { toothNumbers: '11 12' } },
    { label: 'no system transaction number', field: 'systemTransactionNumber', overrides: { systemTransactionNumber: null } },
    { label: 'empty description', field: 'description', overrides: { description: '' } },
    { label: 'injury without external cause', field: 'icd10', overrides: { icd10Primary: 'S02.5' } },
    { label: 'deadline close', field: 'serviceDate', overrides: { serviceDate: '2026-06-15' } }
  ] as Array<{ label: string; field: ClaimField; overrides: Partial<ClaimLine> }>)('$label', ({ field, overrides }) => {
    const result = validateClaimLine(validLine(overrides), context);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map(issue => issue.field)).toContain(field);
  });
});

// Business rule: funds refuse claims received after their deadline, counted from the service
// date (NMC 120 days, PSEMAS 180 days, others 120 days until configured). The last day itself is
// still on time; the day after is too late; the practice is warned 14 days before.
describe('day-based fund deadlines', () => {
  const rules = [NMC, PSEMAS, DEFAULT_FUND_RULE];
  const serviceDates = dayRange('2025-11-03', 73, 5);
  const plusDays = (key: string, days: number) => {
    const [year, month, day] = key.split('-').map(Number);
    return localKey(new Date(year, month - 1, day + days));
  };
  const cases = rules.flatMap(rule =>
    serviceDates.flatMap(serviceDate => {
      const limit = rule.deadline.days as number;
      return [
        { rule: rule.key, serviceDate, today: plusDays(serviceDate, -1), status: 'future' },
        { rule: rule.key, serviceDate, today: plusDays(serviceDate, 0), status: 'ok' },
        { rule: rule.key, serviceDate, today: plusDays(serviceDate, limit - 15), status: 'ok' },
        { rule: rule.key, serviceDate, today: plusDays(serviceDate, limit - 14), status: 'expiring' },
        { rule: rule.key, serviceDate, today: plusDays(serviceDate, limit), status: 'expiring' },
        { rule: rule.key, serviceDate, today: plusDays(serviceDate, limit + 1), status: 'expired' }
      ];
    })
  );

  it.each(cases)('$rule: served $serviceDate, submitted $today -> $status', ({ rule, serviceDate, today, status }) => {
    const fundRule = [NMC, PSEMAS, DEFAULT_FUND_RULE].find(item => item.key === rule)!;
    expect(checkClaimDeadline(serviceDate, today, fundRule).status).toBe(status);
  });
});

// Business rule: NHP counts calendar months (4). A service on 31 October can be claimed until
// 28/29 February - the end of the shorter month - and not a day later.
describe('month-based fund deadline (NHP, 4 months)', () => {
  const serviceDates = dayRange('2025-01-01', 730);
  const lastDayOracle = (key: string): string => {
    const [year, month, day] = key.split('-').map(Number);
    const daysInTargetMonth = new Date(year, month - 1 + 4 + 1, 0).getDate();
    return localKey(new Date(year, month - 1 + 4, Math.min(day, daysInTargetMonth)));
  };
  const cases = serviceDates.map(serviceDate => ({ serviceDate, lastDay: lastDayOracle(serviceDate) }));

  it.each(cases)('served $serviceDate: last day $lastDay', ({ serviceDate, lastDay }) => {
    expect(lastSubmissionDay(serviceDate, NHP)).toBe(lastDay);
    expect(checkClaimDeadline(serviceDate, lastDay, NHP)).toEqual({ status: 'expiring', lastDay, daysLeft: 0 });
    const [year, month, day] = lastDay.split('-').map(Number);
    expect(checkClaimDeadline(serviceDate, localKey(new Date(year, month - 1, day + 1)), NHP).status).toBe('expired');
  });
});

// Business rule: each fund's deadline is found by its reference code, then by its name, and a fund
// nobody configured falls back to the shortest known deadline (warn early rather than too late).
describe('finding the fund rule', () => {
  it.each([
    { reference: 'NHPM', name: null, key: 'NHP' },
    { reference: 'nhpm', name: null, key: 'NHP' },
    { reference: 'NMC1', name: null, key: 'NMC' },
    { reference: 'PSEMAS', name: null, key: 'PSEMAS' },
    { reference: 'PSX1', name: 'PSEMAS (Public Service Employees Medical Aid Scheme)', key: 'PSEMAS' },
    { reference: 'ZZZ1', name: 'Namibia Medical Care', key: 'NMC' },
    { reference: 'MAG1', name: 'Some other fund', key: 'DEFAULT' },
    { reference: '', name: '', key: 'DEFAULT' },
    { reference: null, name: undefined, key: 'DEFAULT' }
  ])('$reference / $name -> $key', ({ reference, name, key }) => {
    expect(getFundRule(reference, name).key).toBe(key);
  });

  it('flags invalid dates instead of guessing', () => {
    expect(checkClaimDeadline('2026-13-01', TODAY, NMC).status).toBe('invalid');
    expect(checkClaimDeadline(null, TODAY, NMC).status).toBe('invalid');
    expect(checkClaimDeadline('2026-09-01', 'today', NMC).status).toBe('invalid');
  });
});

// Business rule: a batch is one fund and one practice; line numbers and system transaction numbers
// identify lines in the fund's response, so they must be unique; a line billed twice is flagged.
describe('batch rules', () => {
  const batchContext = { ...context, storedTotal: null };

  it('accepts a clean batch', () => {
    const lines = [validLine(), validLine({ key: 'line-2', transactionNumber: 2, systemTransactionNumber: 50124, tariffCode: '8109', amount: 34.4, unitPrice: 34.4 })];
    const result = validateClaimBatch(lines, batchContext);
    expect(result.canSubmit).toBe(true);
    expect(result.totalCents).toBe(28910);
    expect(result.validLineCount).toBe(2);
    expect(result.batchIssues).toEqual([]);
  });

  it('blocks an empty batch', () => {
    expect(validateClaimBatch([], batchContext).canSubmit).toBe(false);
  });

  it.each([
    { label: 'two funds', second: { fundReference: 'NHPM' }, message: /one fund/ },
    { label: 'two practice numbers', second: { practiceNumber: '0540001133242' }, message: /one practice number/ },
    { label: 'duplicate line number', second: { transactionNumber: 1 }, message: /Line number 1/ },
    { label: 'duplicate system transaction number', second: { systemTransactionNumber: 50123 }, message: /System transaction number 50123/ }
  ] as Array<{ label: string; second: Partial<ClaimLine>; message: RegExp }>)('blocks $label', ({ second, message }) => {
    const lines = [validLine(), validLine({ key: 'line-2', transactionNumber: 2, systemTransactionNumber: 50124, tariffCode: '8109', amount: 34.4, unitPrice: 34.4, ...second })];
    const result = validateClaimBatch(lines, batchContext);
    expect(result.canSubmit).toBe(false);
    expect(result.batchIssues.map(issue => issue.message).join(' ')).toMatch(message);
  });

  it('warns about a service billed twice on one invoice, a total mismatch and an unconfigured fund', () => {
    const lines = [validLine(), validLine({ key: 'line-2', transactionNumber: 2, systemTransactionNumber: 50124 })];
    const result = validateClaimBatch(lines, { ...context, fundRule: DEFAULT_FUND_RULE, storedTotal: 100 });
    const messages = result.batchIssues.map(issue => issue.message).join(' ');
    expect(messages).toMatch(/more than once/);
    expect(messages).toMatch(/differs from the sum/);
    expect(messages).toMatch(/No claim deadline is configured/);
    expect(result.canSubmit).toBe(true);
  });

  it('counts every line error and blocks submission', () => {
    const result = validateClaimBatch([validLine({ icd10Primary: '' }), validLine({ key: 'line-2', transactionNumber: 2, systemTransactionNumber: 2, membershipNumber: '' })], batchContext);
    expect(result.errorCount).toBe(2);
    expect(result.validLineCount).toBe(0);
    expect(result.canSubmit).toBe(false);
  });
});
