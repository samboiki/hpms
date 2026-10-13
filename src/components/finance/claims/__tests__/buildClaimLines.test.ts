import { describe, it, expect } from 'vitest';
import { buildClaimLines, initialIcd10Draft, matchInvoiceServices } from '../buildClaimLines';
import { validateClaimBatch } from '../../../../utils/billing/claimValidation';
import { buildClaimFile, parseClaimFile, DETAIL_FIELD_COUNT } from '../../../../utils/billing/claimFile';
import { getFundRule } from '../../../../utils/billing/fundRules';
import { mergeOwnTariffs, type OwnTariffRow } from '../../../../utils/billing/practiceTariffs';
import type { TariffRow } from '../../../../utils/billing/pricing';
import type { BatchDetailRow, BatchLineSources, Icd10Draft, InvoiceServiceRow } from '../types';

const detail = (overrides: Partial<BatchDetailRow> = {}): BatchDetailRow => ({
  id: 'd1',
  batch_header_id: 'b1',
  invoice_id: 'inv-1',
  visit_id: 'visit-1',
  patient_id: 'pat-1',
  transaction_number_in_batch: 1,
  system_transaction_number: null,
  system_patient_reference_number: '5f0c2a1e-0000-4000-8000-000000000001',
  type_of_service: 'T',
  medical_aid_reference: 'NMC1',
  medical_aid_membership_number: '12345678',
  member_surname: 'SHILONGO',
  member_initials: 'E',
  patient_name: 'ELISABETH SHILONGO',
  patient_date_of_birth: '1990-05-17',
  bhf_tariff_code: '8341',
  service_amount: 373.9,
  diagnosis: 'Amalgam - one surface',
  discount_amount: 0,
  service_date: '2026-09-25',
  number_of_services: 1,
  service_fee: 7,
  modifier_1: null,
  modifier_2: null,
  modifier_3: null,
  modifier_4: null,
  invoice_number: 'INV2609001',
  referring_doctor: null,
  nappi_code: null,
  referred_to_practice_number: null,
  practice_number: '0540001133241',
  hospital_indicator: null,
  authorisation_number: null,
  resubmission_flag: null,
  diagnostic_code: null,
  diagnostic_code_type: null,
  dosage_description: null,
  treating_doctor_hpcsa_number: 'DEN00417',
  tooth_numbers: null,
  gender: 'F',
  tariff_code_type: 'T',
  cpt_cdt_code: null,
  free_text: null,
  place_of_service: null,
  referring_doctor_2: null,
  tracking_number: null,
  reading_additions: null,
  lens_prescription: null,
  density_of_tint: null,
  patient_id_number: '90051700123',
  service_time: null,
  employer_name: null,
  employee_number: null,
  date_of_injury: null,
  iod_reference_number: null,
  ...overrides
});

const invoiceLine = (overrides: Partial<InvoiceServiceRow> = {}): InvoiceServiceRow => ({
  id: 'svc-1',
  invoice_id: 'inv-1',
  code: '8341',
  unit_price: 373.9,
  quantity: 1,
  total_price: 373.9,
  tooth_number: '36',
  system_transaction_number: 50123,
  ...overrides
});

/** A shared tariff row (practice_tariffs) for the code; `tooth` is its requires_tooth_number. */
const sharedTariff = (code: string, tooth: 'YES' | 'NO', from = '2025-01-01'): TariffRow => ({
  id: `shared-${code}-${from}`,
  code,
  price: 373.9,
  is_active: true,
  effective_from: from,
  effective_to: null,
  can_be_multiplied: 'NO',
  requires_tooth_number: tooth
});

/** The practice's own version of the code (Admin > Tariffs), from `from`. */
const ownTariff = (code: string, tooth: 'YES' | 'NO', from: string): OwnTariffRow => ({
  id: `own-${code}-${from}`,
  practice_id: 'practice-a',
  code,
  description: `Own ${code}`,
  price: 380,
  can_be_multiplied: 'NO',
  requires_tooth_number: tooth,
  effective_from: from,
  is_active: true
});

const sources = (overrides: Partial<BatchLineSources> = {}): BatchLineSources => ({
  details: [detail()],
  patients: new Map([
    ['pat-1', { id: 'pat-1', first_name: 'Elisabeth', last_name: 'Shilongo', date_of_birth: '1990-05-17', id_number: '90051700123', gender: 'female', system_patient_reference_number: 1234 }]
  ]),
  medicalAid: new Map(),
  visits: new Map([['visit-1', { id: 'visit-1', visit_date: '2026-09-20', doctor_id: 'doc-1', diagnosis: 'Caries 36, K02.1' }]]),
  doctors: new Map([['doc-1', { id: 'doc-1', full_name: 'Dr N Amupolo', hpcsa_number: 'DEN00512' }]]),
  invoiceServices: [invoiceLine()],
  // The invoice's treating practitioner (normally the visit's doctor, kept in step when the visit changes)
  invoicePractitioners: new Map([['inv-1', 'doc-1']]),
  tariffRows: [sharedTariff('8341', 'YES')],
  warnings: [],
  ...overrides
});

// Business rule: the claim must describe what actually happened. The batch rows were filled by
// the database with the invoice date, a fixed default HPCNA number and the patient's database id;
// the fund needs the date of service, the treating doctor's own HPCNA number and the patient's
// 7-digit reference, so those come from the visit, doctor and patient records.
describe('building claim lines from batch rows', () => {
  it("uses the visit date, the invoice's treating practitioner and the patient reference", () => {
    const [line] = buildClaimLines(sources(), {});
    expect(line.serviceDate).toBe('2026-09-20');
    expect(line.treatingDoctorHpcnaNumber).toBe('DEN00512');
    expect(line.patientReference).toBe('1234');
  });

  it('falls back to the batch row when the source record is missing', () => {
    const [line] = buildClaimLines(sources({ visits: new Map(), doctors: new Map(), patients: new Map() }), {});
    expect(line.serviceDate).toBe('2026-09-25');
    expect(line.treatingDoctorHpcnaNumber).toBe('DEN00417');
    expect(line.patientReference).toBe('');
    expect(line.patientName).toBe('ELISABETH SHILONGO');
  });

  it('fills the tooth number, unit price and system transaction number from the invoice line', () => {
    const [line] = buildClaimLines(sources({ practiceType: 'dental' }), {});
    expect(line.toothNumbers).toBe('36');
    expect(line.unitPrice).toBe(373.9);
    expect(line.systemTransactionNumber).toBe(50123);
    expect(line.requiresTooth).toBe(true);
  });

  it('keeps values already on the batch row', () => {
    const [line] = buildClaimLines(
      sources({ details: [detail({ tooth_numbers: '46', system_transaction_number: 777 })] }),
      {}
    );
    expect(line.toothNumbers).toBe('46');
    expect(line.systemTransactionNumber).toBe(777);
  });

  // D1/D31: a service done on another day or by another practitioner (a nurse, a locum) is claimed with that
  // line's own date and that practitioner's HPCNA number; the fund pays the practitioner who did the work
  it("uses the invoice line's own service date and treating practitioner when the line has them", () => {
    const [line] = buildClaimLines(
      sources({
        invoiceServices: [invoiceLine({ service_date: '2026-09-22', practitioner_id: 'nurse-1' })],
        doctors: new Map([
          ['doc-1', { id: 'doc-1', full_name: 'Dr N Amupolo', hpcsa_number: 'DEN00512' }],
          ['nurse-1', { id: 'nurse-1', full_name: 'Sister M Haufiku', hpcsa_number: 'RN00987' }]
        ])
      }),
      {}
    );
    expect(line.serviceDate).toBe('2026-09-22');
    expect(line.treatingDoctorHpcnaNumber).toBe('RN00987');
    expect(line.doctorHpcnaNumber).toBe('RN00987');
  });

  // Lines without their own date or practitioner: the visit's date, and the invoice's practitioner, never the visit's
  // doctor. The database built the line under the invoice's practitioner, so the file must name the same one, or the
  // fund gets one practitioner on the line and the correction screen treats another as "what was sent"
  it("names the invoice's practitioner, not the visit's doctor, for a line without its own", () => {
    const [line] = buildClaimLines(
      sources({
        invoiceServices: [invoiceLine({ service_date: null, practitioner_id: null })],
        invoicePractitioners: new Map([['inv-1', 'locum-1']]),
        doctors: new Map([
          ['doc-1', { id: 'doc-1', full_name: 'Dr N Amupolo', hpcsa_number: 'DEN00512' }],
          ['locum-1', { id: 'locum-1', full_name: 'Dr L Locum', hpcsa_number: 'MP00321' }]
        ])
      }),
      {}
    );
    expect(line.serviceDate).toBe('2026-09-20');
    expect(line.treatingDoctorHpcnaNumber).toBe('MP00321');
    expect(line.treatingPractitionerName).toBe('Dr L Locum');
  });

  // When the invoices' practitioners were not read, the number the database put on the batch line stands: it was chosen
  // by the same rule. The visit's doctor is never a stand-in
  it("keeps the batch line's number when the invoice's practitioner is not known", () => {
    const [line] = buildClaimLines(sources({ invoicePractitioners: undefined }), {});
    expect(line.treatingDoctorHpcnaNumber).toBe('DEN00417');
  });
});

// Business rule: a fund finds a spouse or child through the main member, so fields 9-10 carry the main
// member's surname and initials (the batch rows hold the patient's own). Naming the dependant as the member
// is what made the funds answer "patient not registered as a beneficiary" for the previous software.
describe('dependants are claimed under the main member', () => {
  const medicalAid = (relationship: string, mainMember: string, extra: Record<string, string> = {}) =>
    new Map([['pat-1', [{ patient_id: 'pat-1', membership_number: '12345678', main_member_name: mainMember, relationship_to_main: relationship, ...extra }]]]);
  const child = { id: 'pat-1', first_name: 'Ndapewa', last_name: 'Shilongo', date_of_birth: '2015-03-02', id_number: null, gender: 'F', system_patient_reference_number: 1234 };

  it("uses the main member's surname and initials for a child", () => {
    const [line] = buildClaimLines(sources({ patients: new Map([['pat-1', child]]), medicalAid: medicalAid('child', 'Johannes Tuhafeni Shilongo') }), {});
    expect([line.memberSurname, line.memberInitials, line.memberNameSource]).toEqual(['SHILONGO', 'JT', 'main-member']);
  });

  it("keeps the patient's own details for the main member", () => {
    const [line] = buildClaimLines(sources({ medicalAid: medicalAid('self', 'Elisabeth Shilongo') }), {});
    expect([line.memberSurname, line.memberInitials, line.memberNameSource]).toEqual(['SHILONGO', 'E', 'batch']);
  });

  it('writes "<dependant code> <first name>" in the patient field once the code is recorded', () => {
    const [line] = buildClaimLines(sources({ patients: new Map([['pat-1', child]]), medicalAid: medicalAid('child', 'Johannes Shilongo', { dependant_code: '02' }) }), {});
    expect(line.patientName).toBe('02 Ndapewa');
  });

  it('warns, without blocking, when a dependant has no main member name on record', () => {
    const lines = buildClaimLines(sources({ medicalAid: medicalAid('spouse', '') }), { d1: { primary: 'K02.1', secondary: [], confirmed: true, source: 'entered' } });
    const result = validateClaimBatch(lines, { today: '2026-10-06', fundRule: getFundRule('NMC1'), practiceNumber: '0540001133241' });
    expect(result.canSubmit).toBe(true);
    expect(result.lines[0].warnings.map(issue => issue.message).join(' ')).toMatch(/no main member name/);
  });
});

// Business rule: each batch line is matched to exactly one invoice line (same invoice, code and
// amount), so two identical procedures on different teeth keep their own tooth numbers.
describe('matching batch lines to invoice lines', () => {
  it('pairs by amount and uses every invoice line once, in transaction order', () => {
    const details = [
      detail({ id: 'a', transaction_number_in_batch: 1, service_amount: 373.9 }),
      detail({ id: 'b', transaction_number_in_batch: 2, service_amount: 373.9 }),
      detail({ id: 'c', transaction_number_in_batch: 3, bhf_tariff_code: '8109', service_amount: 34.4 })
    ];
    const services = [
      invoiceLine({ id: 's2', tooth_number: '46', system_transaction_number: 50125 }),
      invoiceLine({ id: 's1', tooth_number: '36', system_transaction_number: 50124 }),
      invoiceLine({ id: 's3', code: '8109', total_price: 34.4, unit_price: 34.4, tooth_number: null, system_transaction_number: 50123 })
    ];
    const matches = matchInvoiceServices(details, services);
    expect(matches.get('a')?.id).toBe('s1');
    expect(matches.get('b')?.id).toBe('s2');
    expect(matches.get('c')?.id).toBe('s3');
  });

  it('does not match lines of another invoice', () => {
    expect(matchInvoiceServices([detail()], [invoiceLine({ invoice_id: 'inv-2' })]).size).toBe(0);
  });
});

// Business rule: ICD-10 codes saved on the batch line are confirmed; codes read from the visit
// notes are only suggestions until a doctor confirms them; no code at all blocks the claim.
describe('initial ICD-10 codes', () => {
  it('uses the saved code as confirmed', () => {
    expect(initialIcd10Draft(detail({ diagnostic_code: 'k021' }), undefined)).toEqual({ primary: 'K02.1', secondary: [], confirmed: true, source: 'saved' });
  });

  it('suggests codes from the visit notes without confirming them', () => {
    const draft = initialIcd10Draft(detail(), { id: 'v', visit_date: null, doctor_id: null, diagnosis: 'K02.1 caries, K04.0 pulpitis' });
    expect(draft).toEqual({ primary: 'K02.1', secondary: ['K04.0'], confirmed: false, source: 'visit-notes' });
  });

  it('leaves the code empty when there is nothing to go on', () => {
    expect(initialIcd10Draft(detail(), undefined).source).toBe('none');
  });

  // Visit codes took Z01.2 on every 2025 line the funds accepted, even when the notes name the caries a
  // restoration was for; giving 8109 the caries code from the notes would be wrong for that line
  it("suggests a code's usual diagnosis before the visit notes, still unconfirmed", () => {
    const notes = { id: 'v', visit_date: null, doctor_id: null, diagnosis: 'K02.1 caries' };
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '8109' }), notes, true)).toEqual({ primary: 'Z01.2', secondary: [], confirmed: false, source: 'usual-for-code' });
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '8161' }), undefined, true).primary).toBe('Z29.8');
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '8341' }), notes, true).source).toBe('visit-notes');
  });

  // The owner's code sheet (dt.csv) covers dental codes the practice has never billed; it comes after the notes,
  // because a restoration's diagnosis depends on the tooth the doctor wrote about
  it("falls back to the owner's dental code sheet when the notes give nothing", () => {
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '8341' }), undefined, true)).toMatchObject({ confirmed: false, source: 'code-default' });
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '8109' }), undefined, true).source).toBe('usual-for-code');
  });

  // Parity E8: the practice's own usual code for a tariff code is suggested here exactly as on the visit's billing
  // line (one rule), before the built-in dental code and the notes, and still waits for a doctor's confirmation
  it("suggests the practice's own usual code for the tariff code first, unconfirmed", () => {
    const notes = { id: 'v', visit_date: null, doctor_id: null, diagnosis: 'J06.9 upper respiratory infection' };
    const defaults = new Map([['0190', 'Z00.0'], ['8109', 'Z01.0']]);
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '0190' }), notes, false, defaults)).toEqual({ primary: 'Z00.0', secondary: [], confirmed: false, source: 'usual-for-code' });
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '8109' }), undefined, true, defaults).primary).toBe('Z01.0');
    // Codes saved on the line (from the invoice line or confirmed earlier) always win
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '0190', diagnostic_code: 'J06.9/I10' }), notes, false, defaults)).toMatchObject({ primary: 'J06.9', secondary: ['I10'], source: 'saved' });
  });

  // OneHealth serves GPs and specialists too: their codes are other schedules, so dental suggestions never apply
  it('gives a GP or specialist practice no dental suggestions', () => {
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '8109' }), undefined, false).source).toBe('none');
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '8341' }), undefined).source).toBe('none');
    const notes = { id: 'v', visit_date: null, doctor_id: null, diagnosis: 'J06.9 upper respiratory infection' };
    expect(initialIcd10Draft(detail({ bhf_tariff_code: '0190' }), notes, false)).toMatchObject({ primary: 'J06.9', source: 'visit-notes' });
  });
});

// Business rule: from batch rows to a submittable file. A suggestion must be confirmed before the
// batch can be submitted, and the file then has the accepted 53-field layout with the ICD-10 code.
describe('from batch rows to a claim file', () => {
  const context = { today: '2026-10-06', fundRule: getFundRule('NMC1'), practiceNumber: '0540001133241' };

  it('blocks an unconfirmed suggestion and passes once it is confirmed', () => {
    const data = sources();
    const suggested = buildClaimLines(data, {});
    expect(validateClaimBatch(suggested, context).canSubmit).toBe(false);

    const confirmed = buildClaimLines(data, { d1: { primary: 'K02.1', secondary: [], confirmed: true, source: 'entered' } });
    const result = validateClaimBatch(confirmed, context);
    expect(result.errorCount).toBe(0);
    expect(result.canSubmit).toBe(true);

    const file = buildClaimFile(
      { practiceNumber: '0540001133241', batchNumber: 38, batchDate: '2026-10-06', fundReference: 'NMC1' },
      confirmed
    );
    const parsed = parseClaimFile(file.content);
    expect(parsed.details[0]).toHaveLength(DETAIL_FIELD_COUNT);
    expect(parsed.details[0][32]).toBe('K02.1');
    expect(parsed.details[0][35]).toBe('DEN00512');
    expect(parsed.details[0][16]).toBe('20260920');
    expect(parsed.details[0][3]).toBe('0001234');
    expect(file.fileName).toBe('0540001133241_38_NMC1.Dat');
  });
});

// Business rule: "Do not claim" on a patient's file means the practice decided this patient's invoices must not go to a
// medical aid (for example the patient pays cash and claims back themselves). A batch holding such a line must not be
// sent, and the flag on one patient must not hold up anyone else's claims.
describe('patients marked "Do not claim"', () => {
  const context = { today: '2026-10-06', fundRule: getFundRule('NMC1'), practiceNumber: '0540001133241' };
  const confirmed: Record<string, Icd10Draft> = { d1: { primary: 'K02.1', secondary: [], confirmed: true, source: 'entered' } };
  const flaggedOn = (patientId: string, reason: string) => new Map([[patientId, { since: '2026-09-01T08:00:00Z', reason }]]);

  it('blocks the batch and says why, until the line leaves the batch or the flag is cleared', () => {
    const result = validateClaimBatch(buildClaimLines(sources({ doNotClaim: flaggedOn('pat-1', 'Pays cash, claims back') }), confirmed), context);
    expect(result.canSubmit).toBe(false);
    expect(result.lines[0].errors.map(issue => issue.message).join(' ')).toMatch(/"Do not claim" \(Pays cash, claims back\)/);

    const cleared = validateClaimBatch(buildClaimLines(sources({ doNotClaim: new Map() }), confirmed), context);
    expect(cleared.canSubmit).toBe(true);
  });

  it("does not hold up other patients' lines", () => {
    const result = validateClaimBatch(buildClaimLines(sources({ doNotClaim: flaggedOn('pat-2', '') }), confirmed), context);
    expect(result.canSubmit).toBe(true);
  });
});

// Business rule (parity E13): a practice can add or change its own codes with "needs a tooth" (Admin > Tariffs), and the
// visit's billing follows the practice's own flag for a code it overrides. Claim review must ask for a tooth exactly when
// the visit did: otherwise it blocks a line the practice billed correctly, or lets through one the fund rejects for a
// missing tooth. The line here (code 8341, 20 Sep 2026) carries no tooth.
describe('whether a claim line needs a tooth', () => {
  const context = { today: '2026-10-06', fundRule: getFundRule('NMC1'), practiceNumber: '0540001133241', practiceType: 'dental' };
  const confirmed: Record<string, Icd10Draft> = { d1: { primary: 'K02.1', secondary: [], confirmed: true, source: 'entered' } };
  const toothErrors = (overrides: Partial<BatchLineSources>) =>
    validateClaimBatch(buildClaimLines(sources({ practiceType: 'dental', invoiceServices: [invoiceLine({ tooth_number: null })], ...overrides }), confirmed), context)
      .lines[0].errors.filter(issue => issue.field === 'toothNumbers')
      .map(issue => issue.message);

  it("asks for a tooth when the practice's own version of the code needs one", () => {
    const tariffRows = mergeOwnTariffs([sharedTariff('8341', 'NO')], [ownTariff('8341', 'YES', '2026-01-01')]);
    expect(toothErrors({ tariffRows })).toEqual(['Code 8341 needs a tooth number.']);
  });

  it("does not ask when the practice's own version needs no tooth, whatever the shared list says", () => {
    const tariffRows = mergeOwnTariffs([sharedTariff('8341', 'YES')], [ownTariff('8341', 'NO', '2026-01-01')]);
    expect(toothErrors({ tariffRows })).toEqual([]);
  });

  // The visit billed the line with the shared flag: the practice's own version only applies from its first date
  it('follows the shared list for a line dated before the own version starts', () => {
    const tariffRows = mergeOwnTariffs([sharedTariff('8341', 'YES')], [ownTariff('8341', 'NO', '2026-10-01')]);
    expect(toothErrors({ tariffRows })).toEqual(['Code 8341 needs a tooth number.']);
  });

  // Tooth numbers are a NAMAF dental rule: a GP or specialist practice never numbers teeth, as on the visit
  it('never asks a practice that is not dental', () => {
    expect(toothErrors({ practiceType: 'medical' })).toEqual([]);
  });
});

// Business rule: a patient brought over from Eminance without an ID number gets a placeholder so the file can exist
// (the number must be unique). Sending that placeholder to a fund would be a wrong ID; once staff record the real
// number, the claim must carry it even though the batch row was made before.
describe('patients brought over without an ID number', () => {
  it('sends no ID number while only the placeholder is known', () => {
    const [line] = buildClaimLines(sources({
      details: [detail({ patient_id_number: 'NOID-3F9A1C2B7D4E' })],
      patients: new Map([['pat-1', { id: 'pat-1', first_name: 'Elisabeth', last_name: 'Shilongo', date_of_birth: '1990-05-17', id_number: 'NOID-3F9A1C2B7D4E', gender: 'female', system_patient_reference_number: 1234 }]])
    }), {});
    expect(line.patientIdNumber).toBe('');
  });

  it('uses the real number once staff add it', () => {
    const [line] = buildClaimLines(sources({ details: [detail({ patient_id_number: 'NOID-3F9A1C2B7D4E' })] }), {});
    expect(line.patientIdNumber).toBe('90051700123');
  });
});

// Business rule (claim specification p. 8): field 39 says what kind of code field 13 holds; optometrists send E,
// everyone else T. An optometry claim sent with T is matched against the wrong schedule.
describe('the tariff code type (field 39)', () => {
  it('is E for an optometry practice', () => {
    const [line] = buildClaimLines(sources({ practiceType: 'optometry' }), {});
    expect(line.extra?.tariffCodeType).toBe('E');
  });

  it('stays T for other practices', () => {
    const [line] = buildClaimLines(sources({ practiceType: 'dental' }), {});
    expect(line.extra?.tariffCodeType).toBe('T');
  });
});

// Business rule (D31): the fund pays the practitioner whose HPCNA number is on the line. A line treated by a
// practitioner without a number used to go out under the number the batch row held (the invoice practitioner's); it
// now carries none, so claim review stops it and names who must add theirs.
describe("each line's own practitioner", () => {
  const doctors = new Map([
    ['doc-1', { id: 'doc-1', full_name: 'Dr N Amupolo', hpcsa_number: 'DEN00512' }],
    ['partner-1', { id: 'partner-1', full_name: 'Dr B Partner', hpcsa_number: null }]
  ]);

  it("never claims a line under a colleague's HPCNA number", () => {
    const [line] = buildClaimLines(sources({ doctors, invoiceServices: [invoiceLine({ practitioner_id: 'partner-1' })] }), {});
    expect(line.treatingDoctorHpcnaNumber).toBe('');
    expect(line.treatingPractitionerName).toBe('Dr B Partner');
    const result = validateClaimBatch([line], { today: '2026-10-06', fundRule: getFundRule('NMC1'), practiceNumber: '0540001133241' });
    expect(result.lines[0].errors.map(issue => issue.message).join(' ')).toMatch(/^Dr B Partner treated this line and has no HPCNA registration number/);
  });

  // A partner bills under their own practice number (claim field 29); the practice's other lines keep its number
  it("bills a partner's line under the partner's own practice number", () => {
    const practitionerBilling = new Map([['partner-1', { practiceNumber: '0999888777666', ratePercent: 120 }]]);
    const partnerDoctors = new Map([...doctors, ['partner-1', { id: 'partner-1', full_name: 'Dr B Partner', hpcsa_number: 'DEN00777' }]]);
    const [partner] = buildClaimLines(sources({ doctors: partnerDoctors, practitionerBilling, invoiceServices: [invoiceLine({ practitioner_id: 'partner-1' })] }), {});
    expect([partner.practiceNumber, partner.practitionerPracticeNumber, partner.treatingDoctorHpcnaNumber]).toEqual(['0999888777666', '0999888777666', 'DEN00777']);
    const [own] = buildClaimLines(sources({ doctors: partnerDoctors, practitionerBilling }), {});
    expect([own.practiceNumber, own.practitionerPracticeNumber]).toEqual(['0540001133241', null]);
  });
});

// Business rule (D5): the claim line keeps the surfaces and quadrant it was built with (the batch row), else the
// invoice line's, so claim review can check the code against the surfaces
it('carries the tooth surfaces and quadrant', () => {
  const [fromBatch] = buildClaimLines(sources({ details: [detail({ tooth_surfaces: 'MO', tooth_quadrant: 4 })] }), {});
  expect([fromBatch.toothSurfaces, fromBatch.toothQuadrant]).toEqual(['MO', 4]);
  const [fromLine] = buildClaimLines(sources({ invoiceServices: [invoiceLine({ tooth_surfaces: 'O', tooth_quadrant: null })] }), {});
  expect([fromLine.toothSurfaces, fromLine.toothQuadrant]).toEqual(['O', null]);
});

// Business rule: a fund prices a time-based line by its minutes, which the claim specification puts in field 18 (the
// number of services); without them the fund refuses the line (QEDI D036, "time in minutes missing"). The practice says
// which codes it charges by time (Admin > Tariffs > Practice tariff) and staff note the time on the visit's line, so the
// claim sends those minutes, and only for those codes: every other line keeps its number of services.
describe('a code the practice charges by time', () => {
  const context = { today: '2026-10-06', fundRule: getFundRule('NMC1'), practiceNumber: '0540001133241' };
  const confirmed: Record<string, Icd10Draft> = { d1: { primary: 'K02.1', secondary: [], confirmed: true, source: 'entered' } };
  const header = { practiceNumber: '0540001133241', batchNumber: 39, batchDate: '2026-10-06', fundReference: 'NMC1' };
  const timed = (notes: string | null, codes: string[] = ['8341']) =>
    buildClaimLines(sources({ timeBasedCodes: new Set(codes), invoiceServices: [invoiceLine({ notes })] }), confirmed);

  it('sends the minutes noted on the line as its number of services, and keeps the amount', () => {
    const lines = timed('Smile Lab slip 1234, 1 hour 15 minutes');
    expect(lines[0]).toMatchObject({ chargedByTime: true, timeMinutes: 75, quantity: 1, amount: 373.9 });
    const fields = parseClaimFile(buildClaimFile(header, lines).content).details[0];
    expect([fields[17], fields[13]]).toEqual(['75.00', '373.90']);
    expect(validateClaimBatch(lines, context).lines[0].warnings).toEqual([]);
  });

  // A dental lab's items under a timed 8099 line are items: one each, never the minutes of the line above them
  it("keeps the lab's lines under a timed line at one item each", () => {
    const [line] = timed('2 hours', ['8099']).map(item => ({ ...item, tariffCode: '8099' }));
    const withLab = { ...line, timeMinutes: 120, labDetails: [{ code: '9330', description: 'Crown', amount: 373.9 }] };
    const fields = parseClaimFile(buildClaimFile(header, [withLab]).content).details;
    expect(fields.map(record => [record[4], record[17]])).toEqual([['T', '120.00'], ['L', '1.00']]);
  });

  it('warns when the line does not say how long it took, and sends the number of services meanwhile', () => {
    const lines = timed('Smile Lab slip 1234');
    expect(lines[0]).toMatchObject({ chargedByTime: true, timeMinutes: null });
    expect(parseClaimFile(buildClaimFile(header, lines).content).details[0][17]).toBe('1.00');
    const result = validateClaimBatch(lines, context);
    expect(result.lines[0].warnings.map(issue => issue.message)).toEqual([
      'Code 8341 is charged by time, but its line\'s note does not say how long it took (for example "45 minutes"), so the fund gets the number of services instead of the minutes and may refuse the line.'
    ]);
    // A warning, never a block: the practice decides whether to send it
    expect(result.canSubmit).toBe(true);
  });

  it('leaves every other code, and practices without the rule, as before', () => {
    const [other] = timed('45 minutes', ['0190']);
    expect(other).toMatchObject({ chargedByTime: false, timeMinutes: null });
    expect(parseClaimFile(buildClaimFile(header, [other]).content).details[0][17]).toBe('1.00');
    const [before] = buildClaimLines(sources({ invoiceServices: [invoiceLine({ notes: '45 minutes' })] }), confirmed);
    expect(before).toMatchObject({ chargedByTime: false, timeMinutes: null });
  });
});
