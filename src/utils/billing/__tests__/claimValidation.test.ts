import { describe, it, expect } from 'vitest';
import { validateClaimLine, validateClaimBatch, type ClaimField, type ClaimValidationContext } from '../claimValidation';
import { FUND_RULES, DEFAULT_FUND_RULE, getFundRule, checkClaimDeadline, lastSubmissionDay } from '../fundRules';
import type { ClaimLine } from '../claimLine';
import type { Icd10MasterEntry } from '../icd10Master';
import { dayRange, localKey } from './generators';

// The built-in rules, by the claim code the fund master keys them on (MAG1 is PSEMAS)
const NHP = FUND_RULES.find(rule => rule.key === 'NHPM')!;
const NMC = FUND_RULES.find(rule => rule.key === 'NMC1')!;
const PSEMAS = FUND_RULES.find(rule => rule.key === 'MAG1')!;
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
    { label: 'more than 8 teeth on one line', field: 'toothNumbers', overrides: { toothNumbers: '11 12 13 14 15 16 17 18 21' } },
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
    // The funds paid about 1 line in 4 that Eminance sent without an ID number (mostly children)
    { label: 'no ID number', field: 'patientIdNumber', overrides: { patientIdNumber: '' } },
    { label: 'surname longer than the claim field', field: 'memberSurname', overrides: { memberSurname: 'Shikongo-Nangolo-Amupolo' } },
    { label: 'more than 4 initials', field: 'memberInitials', overrides: { memberInitials: 'ABCDE' } },
    { label: 'dependant named as the member', field: 'memberSurname', overrides: { relationshipToMainMember: 'child', memberNameSource: 'batch' } },
    { label: 'HPCNA differs from the doctor record', field: 'treatingDoctorHpcnaNumber', overrides: { doctorHpcnaNumber: 'DEN00999' } },
    { label: 'several teeth on one line', field: 'toothNumbers', overrides: { toothNumbers: '11 12' } },
    { label: 'no system transaction number', field: 'systemTransactionNumber', overrides: { systemTransactionNumber: null } },
    { label: 'empty description', field: 'description', overrides: { description: '' } },
    { label: 'injury without external cause', field: 'icd10', overrides: { icd10Primary: 'S02.50' } },
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

// Business rule: a credit file (header transaction type C) reverses what the fund was claimed for. The fund's
// deadline counts from the service date and is about new claims: a reversal must never be blocked by it, or the
// fund keeps money for a service the practice took back. A partial credit is not a whole number of units, so the
// unit price check does not apply either; every other check (dates in the future, amounts, codes) still does.
describe('a reversal line in a credit file', () => {
  const credit = { ...context, transactionType: 'C' };

  it('is never late, and carries the amount credited', () => {
    const old = validLine({ serviceDate: '2026-01-10', amount: 100, unitPrice: 254.7 });
    expect(validateClaimLine(old, context).errors.map(issue => issue.field)).toEqual(['serviceDate', 'amount']);
    const reversal = validateClaimLine(old, credit);
    expect(reversal.errors).toEqual([]);
    expect(reversal.warnings).toEqual([]);
  });

  it('still refuses what no file may carry', () => {
    expect(validateClaimLine(validLine({ serviceDate: '2026-10-07' }), credit).errors.map(issue => issue.field)).toEqual(['serviceDate']);
    expect(validateClaimLine(validLine({ amount: 0, unitPrice: null }), credit).errors.map(issue => issue.field)).toEqual(['amount']);
  });
});

// Business rule: each fund's deadline is found by its claim code (or another code meaning the same fund), then by its
// name, and a fund nobody configured falls back to the shortest known deadline (warn early rather than too late).
describe('finding the fund rule', () => {
  it.each([
    { reference: 'NHPM', name: null, key: 'NHPM' },
    { reference: 'nhpm', name: null, key: 'NHPM' },
    { reference: 'NMC1', name: null, key: 'NMC1' },
    { reference: 'PSEMAS', name: null, key: 'MAG1' },
    { reference: 'PSX1', name: 'PSEMAS (Public Service Employees Medical Aid Scheme)', key: 'MAG1' },
    { reference: 'ZZZ1', name: 'Namibia Medical Care', key: 'NMC1' },
    // MAG1 is PSEMAS's code on claim files, whatever name an old setup script gave the fund
    { reference: 'MAG1', name: 'Gemhealth Medical Aid', key: 'MAG1' },
    { reference: 'mag1', name: null, key: 'MAG1' },
    // NAMMED and Prosperity have their own (unconfirmed) rules instead of the fallback
    { reference: 'NAMM', name: null, key: 'NAMM' },
    { reference: 'ZZZ2', name: 'Prosperity Health', key: 'PROS' },
    { reference: 'XYZ9', name: 'Some other fund', key: 'DEFAULT' },
    { reference: '', name: '', key: 'DEFAULT' },
    { reference: null, name: undefined, key: 'DEFAULT' }
  ])('$reference / $name -> $key', ({ reference, name, key }) => {
    expect(getFundRule(reference, name).key).toBe(key);
  });

  // PSEMAS is about two thirds of this practice's claim value: a MAG1 claim 121-180 days old is still
  // payable and must not be blocked by the 120-day fallback meant for unconfigured funds (which only flags it)
  it('keeps a 150-day-old MAG1 (PSEMAS) claim submittable', () => {
    const line = validLine({ fundReference: 'MAG1', serviceDate: '2026-05-09' });
    const psemasContext = { ...context, fundRule: getFundRule('MAG1', 'Gemhealth Medical Aid') };
    expect(validateClaimLine(line, psemasContext).errors.map(issue => issue.field)).not.toContain('serviceDate');
    expect(validateClaimLine(line, psemasContext).warnings.map(issue => issue.field)).not.toContain('serviceDate');
    const fallback = validateClaimLine(line, { ...context, fundRule: DEFAULT_FUND_RULE });
    expect(fallback.errors.map(issue => issue.field)).not.toContain('serviceDate');
    expect(fallback.warnings.map(issue => issue.field)).toContain('serviceDate');
  });

  // Business rule (parity F11): a deadline nobody confirmed with the fund (NAMMED, Prosperity, or a fund without a
  // rule) is a guess. A guess must never stop a claim the fund may still pay, so a line past it is flagged, not
  // blocked; a confirmed deadline (NHP, NMC, PSEMAS) still blocks, or the practice sends lines the fund will refuse
  it('blocks a line past a confirmed deadline, and only flags one past an unconfirmed deadline', () => {
    const late = validLine({ fundReference: 'NAMM', serviceDate: '2026-05-09' });
    const nammed = validateClaimLine(late, { ...context, fundRule: getFundRule('NAMM') });
    expect(nammed.errors.map(issue => issue.field)).not.toContain('serviceDate');
    expect(nammed.warnings.find(issue => issue.field === 'serviceDate')?.message).toMatch(/not confirmed with the fund\) passed on 2026-09-06.*can still be sent/);
    const nmc = validateClaimLine(validLine({ serviceDate: '2026-05-09' }), context);
    expect(nmc.errors.map(issue => issue.field)).toContain('serviceDate');
  });

  it('says once per batch that the fund has not confirmed its deadline', () => {
    const result = validateClaimBatch([validLine({ fundReference: 'PROS' })], { ...context, fundRule: getFundRule('PROS'), storedTotal: null });
    expect(result.batchIssues.map(issue => issue.message)).toEqual([
      "Prosperity Health's claim deadline (120 days) is not confirmed with the fund yet: late lines are flagged, not blocked."
    ]);
    expect(result.canSubmit).toBe(true);
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

  // Field 24 holds 8 characters, so long invoice numbers are shortened; two invoices shortened to the same
  // number would let the fund's payment be posted against the wrong invoice
  it('blocks two invoices that would reach the fund as the same invoice number', () => {
    const lines = [
      validLine({ invoiceNumber: 'INV161000123' }),
      validLine({ key: 'line-2', transactionNumber: 2, systemTransactionNumber: 50124, invoiceNumber: 'INV261000123' })
    ];
    const result = validateClaimBatch(lines, batchContext);
    expect(result.canSubmit).toBe(false);
    expect(result.batchIssues.map(issue => issue.message).join(' ')).toMatch(/both reach the fund as invoice 61000123/);
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

// Business rule (QEDI claim specification p. 7): a medicine is claimed as GMED with its NAPPI code and type of service
// M (R for a repeat script, D for a chronic medicine). Without this, one medicine on an invoice blocked the whole batch.
describe('medicines on a claim', () => {
  const medicine = (extra: ClaimLine['extra']) =>
    validLine({ tariffCode: 'GMED', description: 'PARACETAMOL 500MG', icd10Primary: 'R51', extra: { ...extra } });
  const tariffErrors = (line: ClaimLine) =>
    validateClaimLine(line, context).errors.filter(issue => issue.field === 'tariffCode').map(issue => issue.message);

  it('accepts a medicine claimed as GMED with its NAPPI code', () => {
    expect(tariffErrors(medicine({ typeOfService: 'M', nappiCode: '700123001' }))).toEqual([]);
    expect(tariffErrors(medicine({ typeOfService: 'R', nappiCode: '700123001' }))).toEqual([]);
    expect(tariffErrors(medicine({ typeOfService: 'D', nappiCode: '700123001' }))).toEqual([]);
  });

  it('refuses a medicine without a NAPPI code, because the fund cannot tell what was dispensed', () => {
    expect(tariffErrors(medicine({ typeOfService: 'M', nappiCode: null })).join(' ')).toMatch(/no NAPPI code/);
  });

  it('still refuses a NAPPI number used as a tariff code on an ordinary line', () => {
    expect(tariffErrors(validLine({ tariffCode: '700123001' })).join(' ')).toMatch(/not a 4-digit NAMAF code/);
  });
});

// Business rule: a claim line carries at most 5 ICD-10 codes (field 33). The doctor may record more, but the ones that
// do not fit must be named, so nobody believes the fund was told about them.
describe('more ICD-10 codes than a claim line holds', () => {
  it('names the codes that will not be sent', () => {
    const line = validLine({ icd10Primary: 'K02.1', icd10Secondary: ['K04.0', 'K05.1', 'K08.1', 'K03.6', 'Z01.2'] });
    const warnings = validateClaimLine(line, context).warnings.filter(issue => issue.field === 'icd10').map(issue => issue.message);
    expect(warnings.join(' ')).toMatch(/not sent: Z01\.2/);
  });

  it('says nothing when all codes fit', () => {
    const line = validLine({ icd10Primary: 'K02.1', icd10Secondary: ['K04.0'] });
    expect(validateClaimLine(line, context).warnings.some(issue => /not sent/.test(issue.message))).toBe(false);
  });
});

// Business rule: a patient booked with a name and cell number only has a placeholder ID number, date of birth and gender
// until reception completes the file. A fund must never receive them, and reception must be told what to fix in plain
// words (not "may only contain letters and digits").
describe('a patient file that is not complete', () => {
  // The placeholders the booking form and the website booking write (src/utils/patients/temporaryPatient.ts)
  const temporaryFile = { patientIdNumber: 'TEMP-1728000000000-abc123xyz', patientDateOfBirth: '1990-01-01', gender: 'other' };

  it('blocks the claim and says the file must be completed first', () => {
    const errors = validateClaimLine(validLine(temporaryFile), context).errors.filter(issue => issue.field === 'patientIdNumber');
    expect(errors.map(issue => issue.message).join(' ')).toMatch(/file is not complete/);
  });

  it('still blocks it when reception already corrected the gender and date of birth but not the ID number', () => {
    const line = validLine({ ...temporaryFile, gender: 'F', patientDateOfBirth: '1985-03-02' });
    expect(validateClaimBatch([line], context).canSubmit).toBe(false);
  });
});

// Business rule (parity E14): the funds check every code against the medical aids' ICD-10 list (SA MIT). Claim review
// is given the list's entries for the batch's codes (one query) and stops the lines a fund would reject; while the list
// cannot be read it checks codes by their shape only, as before.
describe("codes the medical aids' ICD-10 list does not accept", () => {
  const entry = (code: string, overrides: Partial<Icd10MasterEntry> = {}): Icd10MasterEntry => ({
    code,
    description: `Invented description of ${code}`,
    validClinicalUse: true,
    validPrimary: true,
    isAsterisk: false,
    ageRange: null,
    gender: null,
    discontinued: false,
    endDate: null,
    ...overrides
  });
  const icd10Master = new Map([
    ['Z01.2', entry('Z01.2')],
    ['C34.1', entry('C34.1')],
    ['K02', entry('K02', { validClinicalUse: false, validPrimary: false })],
    ['D63.0', entry('D63.0', { isAsterisk: true, validPrimary: false })],
    ['E30.0', entry('E30.0', { ageRange: '≤ 19 years' })]
  ]);
  const withList = { ...context, icd10Master };
  const icd10Messages = (line: ClaimLine, severity: 'errors' | 'warnings', using: ClaimValidationContext = withList) =>
    validateClaimLine(line, using)[severity].filter(issue => issue.field === 'icd10').map(issue => issue.message);

  it('stops a category heading and a code that is not in the list, so the batch cannot be sent', () => {
    expect(icd10Messages(validLine({ icd10Primary: 'K02' }), 'errors')).toEqual([expect.stringContaining('is a category heading')]);
    const unknown = validLine({ icd10Secondary: ['K02.99'] });
    expect(icd10Messages(unknown, 'errors')).toEqual(["K02.99 is not in the medical aids' ICD-10 list: check the code."]);
    expect(validateClaimBatch([unknown], withList).canSubmit).toBe(false);
  });

  it('stops an asterisk code as the main diagnosis, and accepts it after the cause', () => {
    expect(icd10Messages(validLine({ icd10Primary: 'D63.0', icd10Secondary: ['C34.1'] }), 'errors')).toEqual([expect.stringContaining('asterisk (*) code')]);
    expect(icd10Messages(validLine({ icd10Primary: 'C34.1', icd10Secondary: ['D63.0'] }), 'errors')).toEqual([]);
  });

  // The patient on validLine was 36 on the service date
  it('questions a code meant for another age without stopping the claim', () => {
    const result = validateClaimLine(validLine({ icd10Primary: 'E30.0' }), withList);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map(issue => issue.message)).toEqual([expect.stringContaining('aged 19 or younger; this patient was 36 on the service date')]);
  });

  it('checks codes by their shape only while the list cannot be read', () => {
    expect(icd10Messages(validLine({ icd10Primary: 'K02.99' }), 'errors', { ...context, icd10Master: null })).toEqual([]);
  });

  it('does not hold up a reversal, which carries the codes the fund already received', () => {
    expect(icd10Messages(validLine({ icd10Primary: 'K02' }), 'errors', { ...withList, transactionType: 'C' })).toEqual([]);
  });
});
