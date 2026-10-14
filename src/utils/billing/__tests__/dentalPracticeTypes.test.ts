/**
 * Dental specialists work like dental (owner, 14 Oct 2026: "dental specialists are their own practice types that work like
 * dental"). Why it matters: an orthodontist, periodontist or prosthodontist examines teeth and bills funds that apply the
 * dental claim rules. If only the type 'dental' got the tooth chart and the dental checks, a specialist practice would
 * have to be typed 'dental' to get them and would then bill from the dentist's list (054) instead of its own (064).
 * The question is asked in one place (isDentalPractice), and the database's lab-order check has to agree with it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ClaimLine } from '../claimLine';
import { DENTAL_PRACTICE_TYPES, normalisePracticeType } from '../practiceTypeNames';
import { INFECTION_CONTROL_CODE, checkTariffRules, followsDentistSchedule, isDentalPractice } from '../tariffRules';
import { NAMAF_DISCIPLINE_BY_PRACTICE_TYPE, practiceDiscipline, typeDiscipline } from '../namafTariffs';
import { toothRuleFor } from '../practiceTariffs';
import type { TariffRow } from '../pricing';
import { validateClaimBatch } from '../claimValidation';
import { FUND_RULES } from '../fundRules';
import { withDisciplineRules } from '../../../components/visits/visitBillingLines';
import { addTariffLines } from '../../../components/quotes/billingLines';
import { starterBundlesFor } from '../../../components/quotes/bundles';
import { dentalTariffs, tariff } from '../../../components/quotes/__tests__/quoteTestTariffs';
import { LIST_PRESETS, presetsFor } from '../../../components/patientLists/listPresets';

const SPECIALISTS = ['orthodontist', 'maxillofacial_oral_surgeon', 'periodontist', 'prosthodontist', 'dental_therapist'];

describe('which practices are dental practices', () => {
  it('counts dental and every dental specialist, however the text is typed, and nothing else', () => {
    ['dental', ...SPECIALISTS].forEach(type => {
      expect(isDentalPractice(type)).toBe(true);
      expect(isDentalPractice(`  ${type.toUpperCase()} `)).toBe(true);
    });
    // A GP, other specialists, optometry, a nurse, the dental laboratory (no tooth chart there) and a type not chosen are not dental
    ['medical', 'urology', 'optometry', 'nursing', 'aesthetic', 'dental_technician', 'general', '', '   ', null, undefined].forEach(type => {
      expect(isDentalPractice(type)).toBe(false);
    });
  });

  it("reads the one practice typed 'dental_practice' (it matches no practice type) as dental, without changing its text", () => {
    const stored = ' Dental_Practice ';
    expect(normalisePracticeType(stored)).toBe('dental');
    expect(isDentalPractice(stored)).toBe(true);
    expect(typeDiscipline(stored)).toBe('054');
    // The alias is exact: a type that merely starts the same way, or an inherited object key, is not rewritten
    expect(normalisePracticeType('dental_practice_group')).toBe('dental_practice_group');
    expect(normalisePracticeType('constructor')).toBe('constructor');
    expect(normalisePracticeType(null)).toBe('');
  });

  it("has the same list as the database's lab-order check, so a specialist's lab orders are accepted wherever its tooth chart is", () => {
    const sql = readFileSync('proposals/2026-10-14-more-practice-types.sql', 'utf8');
    const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.is_dental_practice_type');
    const checked = sql.slice(start, sql.indexOf('REVOKE ALL ON FUNCTION public.is_dental_practice_type'));
    const inSql = [...checked.slice(checked.indexOf(' IN (')).matchAll(/'([a-z_]+)'/g)].map(match => match[1]);
    expect([...inSql].sort()).toEqual([...DENTAL_PRACTICE_TYPES, 'dental_practice'].sort());
    // The lab check is the one that asks it, not a second comparison with the text 'dental'
    expect(sql).toContain('public.is_dental_practice_type(pr.practice_type)');
  });
});

describe('a dental specialist bills from its own NAMAF list', () => {
  it('has its own discipline, not the dentist list (054), with the administrator free to choose another', () => {
    expect(Object.fromEntries(SPECIALISTS.map(type => [type, typeDiscipline(type)]))).toEqual({
      orthodontist: '064',
      maxillofacial_oral_surgeon: '062',
      periodontist: '092',
      prosthodontist: '094',
      dental_therapist: '095'
    });
    expect(practiceDiscipline('orthodontist', null)).toBe('064');
    // An orthodontist who chose the dentist list on the Tariffs page keeps it
    expect(practiceDiscipline('orthodontist', '054')).toBe('054');
    DENTAL_PRACTICE_TYPES.forEach(type => expect(NAMAF_DISCIPLINE_BY_PRACTICE_TYPE[type]).toMatch(/^\d{3}$/));
  });
});

describe('the dental rules in a specialist practice', () => {
  it('asks for a tooth where the list says so, as in a dental practice, and never in a GP practice', () => {
    const rows = [tariff('8369', '448.70', { requires_tooth_number: 'YES' }), tariff('0190', '100', { requires_tooth_number: 'YES' })];
    expect(withDisciplineRules(rows, 'orthodontist').map(row => row.requires_tooth_number)).toEqual(['YES', 'YES']);
    expect(withDisciplineRules(rows, 'medical').map(row => row.requires_tooth_number)).toEqual(['NO', 'NO']);
    // Claim review decides the same way from the same rows
    const priced: TariffRow[] = [{ id: 'r1', code: '8369', description: 'Resin', price: 448.7, is_active: true, effective_from: '2026-01-01', effective_to: null, can_be_multiplied: 'NO', requires_tooth_number: 'YES' }];
    expect(toothRuleFor(priced, 'orthodontist')('8369', '2026-10-01')).toBe(true);
    expect(toothRuleFor(priced, 'dental_practice')('8369', '2026-10-01')).toBe(true);
    expect(toothRuleFor(priced, 'medical')('8369', '2026-10-01')).toBe(false);
  });

  const NMC = FUND_RULES.find(rule => rule.key === 'NMC1')!;
  const claimLine = (code: string, number: number): ClaimLine => ({
    key: `l${number}`,
    transactionNumber: number,
    systemTransactionNumber: 50000 + number,
    invoiceId: 'inv-1',
    invoiceNumber: 'INV2610001',
    visitId: 'visit-1',
    fundReference: 'NMC1',
    membershipNumber: '12345678',
    memberSurname: 'Shilongo',
    memberInitials: 'E',
    patientName: 'Elisabeth Shilongo',
    patientDateOfBirth: '1990-05-17',
    patientIdNumber: '90051700123',
    patientReference: '1234',
    gender: 'F',
    tariffCode: code,
    description: 'Invented line',
    serviceDate: '2026-09-20',
    quantity: 1,
    amount: 100,
    unitPrice: 100,
    practiceNumber: '0540001133241',
    treatingDoctorHpcnaNumber: 'DEN00417',
    icd10Primary: 'K02.1',
    icd10Secondary: [],
    icd10Confirmed: true,
    toothNumbers: ''
  });

  it('runs the dental claim checks (8155 is not paid with 8159) for every dental practice type, and for no other', () => {
    const lines = [claimLine('8159', 1), claimLine('8155', 2)];
    expect(checkTariffRules(lines).map(issue => issue.severity)).toEqual(['error']);
    const context = { today: '2026-10-06', fundRule: NMC, practiceNumber: '0540001133241' };
    ['dental', 'dental_practice', ...SPECIALISTS].forEach(practiceType => {
      const result = validateClaimBatch(lines, { ...context, practiceType });
      expect(result.canSubmit).toBe(false);
      expect(result.lines[1].errors.map(issue => issue.message).join(' ')).toMatch(/Remove 8155/);
    });
    ['medical', 'urology', 'optometry', 'dental_technician'].forEach(practiceType => {
      expect(validateClaimBatch(lines, { ...context, practiceType }).lines[1].errors.map(issue => issue.message).join(' ')).not.toMatch(/8155/);
    });
  });
});

// Business rule: the app adds 8109 (infection control) by itself in a dental practice, and tells staff when a dentist's list
// cannot bill it. The dental therapist's NAMAF list (095) is a different schedule (codes 001-071, with its own infection
// control code 009): saying "8109 has no tariff" at every code added would be an error that is not one.
describe('the automatic infection control line', () => {
  const context = (tariffs: ReturnType<typeof dentalTariffs>) => ({ tariffs, hasMedicalAid: false, autoInfectionControl: true });

  it("is added once, first, in NAMAF's dentist schedule (8xxx codes)", () => {
    const tariffs = dentalTariffs();
    expect(followsDentistSchedule(tariffs)).toBe(true);
    const outcome = addTariffLines([], { code: '8159', quantity: 1 }, context(tariffs));
    expect(outcome.status === 'added' && outcome.lines.map(line => line.code)).toEqual([INFECTION_CONTROL_CODE, '8159']);
  });

  it("still tells staff when a dentist's list cannot bill 8109, as before", () => {
    const outcome = addTariffLines([], { code: '8159', quantity: 1 }, context(dentalTariffs().filter(row => row.code !== INFECTION_CONTROL_CODE)));
    expect(outcome).toMatchObject({ status: 'added', problems: [{ code: INFECTION_CONTROL_CODE, message: expect.stringMatching(/8109 has no tariff in effect/) }] });
  });

  it("adds none and says nothing for the dental therapist's own list", () => {
    const tariffs = [tariff('015', '333.60', { description: 'Scaling and polishing' }), tariff('051', '391.40', { description: 'Amalgam - one surface' })];
    expect(followsDentistSchedule(tariffs)).toBe(false);
    const outcome = addTariffLines([], { code: '015', quantity: 1 }, context(tariffs));
    expect(outcome).toMatchObject({ status: 'added', problems: [] });
    expect(outcome.status === 'added' && outcome.lines.map(line => line.code)).toEqual(['015']);
  });
});

describe('what only the dentist list has', () => {
  // The starter bundles are made of the dentist list's codes (8101 ...); a specialist's list does not have them all
  it("offers the starter bundles to the dentist list's practices ('dental_practice' too) and not to a specialist", () => {
    expect(starterBundlesFor('dental').length).toBeGreaterThan(0);
    expect(starterBundlesFor('dental_practice')).toBe(starterBundlesFor('dental'));
    SPECIALISTS.forEach(type => expect(starterBundlesFor(type)).toEqual([]));
  });

  it('gives a specialist the one-tap scale-and-polish recall like any dental practice (it can change the code)', () => {
    expect(presetsFor('orthodontist')).toBe(LIST_PRESETS);
    expect(presetsFor('medical')).not.toBe(LIST_PRESETS);
  });
});
