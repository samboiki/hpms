import { describe, it, expect } from 'vitest';
import { buildClaimLines, initialIcd10Draft, matchInvoiceServices } from '../buildClaimLines';
import { validateClaimBatch } from '../../../../utils/billing/claimValidation';
import { buildClaimFile, parseClaimFile, DETAIL_FIELD_COUNT } from '../../../../utils/billing/claimFile';
import { getFundRule } from '../../../../utils/billing/fundRules';
import type { BatchDetailRow, BatchLineSources, InvoiceServiceRow } from '../types';

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

const sources = (overrides: Partial<BatchLineSources> = {}): BatchLineSources => ({
  details: [detail()],
  patients: new Map([
    ['pat-1', { id: 'pat-1', first_name: 'Elisabeth', last_name: 'Shilongo', date_of_birth: '1990-05-17', id_number: '90051700123', gender: 'female', system_patient_reference_number: 1234 }]
  ]),
  visits: new Map([['visit-1', { id: 'visit-1', visit_date: '2026-09-20', doctor_id: 'doc-1', diagnosis: 'Caries 36, K02.1' }]]),
  doctors: new Map([['doc-1', { id: 'doc-1', full_name: 'Dr N Amupolo', hpcsa_number: 'DEN00512' }]]),
  invoiceServices: [invoiceLine()],
  requiresToothByCode: new Map([['8341', true]]),
  warnings: [],
  ...overrides
});

// Business rule: the claim must describe what actually happened. The batch rows were filled by
// the database with the invoice date, a fixed default HPCNA number and the patient's database id;
// the fund needs the date of service, the treating doctor's own HPCNA number and the patient's
// 7-digit reference, so those come from the visit, doctor and patient records.
describe('building claim lines from batch rows', () => {
  it('uses the visit date, the treating doctor and the patient reference', () => {
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
    const [line] = buildClaimLines(sources(), {});
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
