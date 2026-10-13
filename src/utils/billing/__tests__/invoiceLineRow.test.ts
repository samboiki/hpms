import { describe, expect, it } from 'vitest';
import { buildInvoiceLineRow, buildInvoiceLineRows, invoiceLineAmounts, invoiceLinesAmounts, type InvoiceLineSource } from '../invoiceLineRow';
import { computeLine } from '../pricing';
import { fromCents, toCents } from '../money';
import { REAL_PRICES, intBetween, pick, seededRandom } from './generators';

const line = (overrides: Partial<InvoiceLineSource> = {}): InvoiceLineSource => ({
  tariffId: '11111111-1111-4111-8111-111111111111',
  code: '8101',
  description: 'Oral examination',
  unitPrice: 373.9,
  quantity: 2,
  ...overrides
});

/** The row as invoiceService and the visit screens wrote it before this change (the oracle). */
const legacyRow = (service: InvoiceLineSource, invoiceId: string, hasMedicalAid: boolean) => {
  const computed = computeLine({ code: service.code, unitPrice: service.unitPrice, quantity: service.quantity, multiplyRule: 'YES', hasMedicalAid });
  if (!computed.ok) throw new Error(computed.errors.join(' '));
  return {
    invoice_id: invoiceId,
    tariff_id: service.tariffId,
    code: service.code,
    description: service.description,
    quantity: service.quantity,
    unit_price: computed.unitPrice,
    total_price: computed.total,
    medical_aid_covered: computed.medicalAidAmount,
    patient_portion: computed.patientAmount,
    notes: service.notes || '',
    tooth_number: service.teethNumbers ? service.teethNumbers.join(',') : null
  };
};

describe('the stored invoice line', () => {
  // Pricing is money: without a co-payment, discount or new columns, every amount must stay exactly as before
  it('is exactly the row saved before this change when nothing new is used (thousands of lines)', () => {
    const random = seededRandom(7102026);
    for (let i = 0; i < 3000; i += 1) {
      const service = line({
        code: String(intBetween(random, 8101, 8999)),
        unitPrice: pick(random, REAL_PRICES),
        quantity: pick(random, [1, 2, 3, 0.5, 1.25, 7, 99]),
        teethNumbers: random() < 0.3 ? ['11', '12'] : undefined,
        notes: random() < 0.2 ? 'note' : undefined
      });
      const hasMedicalAid = random() < 0.6;
      expect(buildInvoiceLineRow(service, { invoiceId: 'inv-1', hasMedicalAid })).toEqual(legacyRow(service, 'inv-1', hasMedicalAid));
    }
  });

  it('splits a medical aid line by the co-payment, adding up to the line total', () => {
    const row = buildInvoiceLineRow(line({ unitPrice: 500.1, quantity: 1 }), { invoiceId: 'inv-1', hasMedicalAid: true, copayPercent: 5 });
    expect(row).toMatchObject({ total_price: 500.1, medical_aid_covered: 475.09, patient_portion: 25.01 });
    expect(toCents(row.medical_aid_covered) + toCents(row.patient_portion)).toBe(toCents(row.total_price));
  });

  // A private patient's discount lowers what they owe, and the invoice total follows the lines
  it("stores a private patient's line after the discount, all of it for the patient", () => {
    const row = buildInvoiceLineRow(line({ unitPrice: 500, quantity: 1, discountAmount: 50 }), { invoiceId: 'inv-1', hasMedicalAid: false, lineDetails: true });
    expect(row).toMatchObject({ unit_price: 500, total_price: 450, medical_aid_covered: 0, patient_portion: 450, discount_amount: 50 });
  });

  it('refuses a discount on a medical aid line and a discount the database cannot store yet', () => {
    expect(() => buildInvoiceLineRow(line({ discountAmount: 5 }), { invoiceId: 'i', hasMedicalAid: true, lineDetails: true })).toThrow(/cannot be discounted/);
    expect(() => buildInvoiceLineRow(line({ discountAmount: 5 }), { invoiceId: 'i', hasMedicalAid: false })).toThrow(/invoicing update/);
  });

  // The claim uses each line's own date and practitioner; a line without its own follows the visit, so correcting
  // the visit's date or practitioner later moves those lines with it
  it("stores a line's own date and treating practitioner, and nothing when they are the visit's", () => {
    const context = { invoiceId: 'inv-1', hasMedicalAid: true, lineDetails: true, defaultServiceDate: '2026-10-07', defaultPractitionerId: 'doc-1' };
    expect(buildInvoiceLineRow(line(), context)).toMatchObject({ service_date: null, practitioner_id: null, discount_amount: 0 });
    expect(buildInvoiceLineRow(line({ serviceDate: '2026-10-07', practitionerId: 'doc-1' }), context)).toMatchObject({ service_date: null, practitioner_id: null });
    expect(buildInvoiceLineRow(line({ serviceDate: '2026-10-05', practitionerId: 'doc-2' }), context)).toMatchObject({
      service_date: '2026-10-05',
      practitioner_id: 'doc-2'
    });
  });

  it('leaves the new columns out until the database has them, so saving keeps working', () => {
    const row = buildInvoiceLineRow(line({ serviceDate: '2026-10-05', practitionerId: 'doc-2' }), { invoiceId: 'i', hasMedicalAid: false });
    expect(row).not.toHaveProperty('service_date');
    expect(row).not.toHaveProperty('practitioner_id');
    expect(row).not.toHaveProperty('discount_amount');
  });

  it('refuses a line that cannot be priced or a date that does not exist, instead of saving N$ 0.00', () => {
    expect(() => buildInvoiceLineRow(line({ quantity: 0 }), { invoiceId: 'i', hasMedicalAid: false })).toThrow(/greater than 0/);
    expect(() => buildInvoiceLineRow(line({ serviceDate: '2026-02-30' }), { invoiceId: 'i', hasMedicalAid: false, lineDetails: true })).toThrow(/not a valid date/);
  });

  // Parity D1/D2: the claim line takes its ICD-10 codes from the invoice line ("no ICD-10, no payment"), so a line keeps
  // them main code first, each once, and never a code the fund would refuse
  it('stores the line\'s ICD-10 codes, main code first, tidied and each once', () => {
    const context = { invoiceId: 'inv-1', hasMedicalAid: true, lineDetails: true, lineCodes: true };
    expect(buildInvoiceLineRow(line({ icd10Codes: ['j069', 'I10', 'J06.9'] }), context)).toMatchObject({ icd10_primary: 'J06.9', icd10_secondary: ['I10'] });
    expect(buildInvoiceLineRow(line(), context)).toMatchObject({ icd10_primary: null, icd10_secondary: [] });
    // The same columns are written when only the code columns exist
    expect(buildInvoiceLineRow(line({ icd10Codes: ['K02.1'] }), { invoiceId: 'i', hasMedicalAid: false, lineCodes: true })).toMatchObject({ icd10_primary: 'K02.1' });
  });

  it('refuses codes the claim would be stopped for, naming the line', () => {
    const context = { invoiceId: 'i', hasMedicalAid: true, lineCodes: true };
    expect(() => buildInvoiceLineRow(line({ icd10Codes: ['W01.0', 'S52.5'] }), context)).toThrow(/8101: W01\.0 is an external cause code/);
    expect(() => buildInvoiceLineRow(line({ icd10Codes: ['J6'] }), context)).toThrow(/not a valid ICD-10 code/);
    expect(() => buildInvoiceLineRow(line({ icd10Codes: ['A09.9', 'B34.9', 'E11.9', 'I10', 'J06.9', 'R51'] }), context)).toThrow(/at most 5 ICD-10 codes/);
  });

  // Parity D1: a changed fee is billed and claimed as charged, and the invoice keeps why, the price before, who and when
  it('keeps a changed fee with its reason, the price before, who and when', () => {
    const feeOverride = { reason: '  Pensioner rate ', fromUnitPrice: 450, by: 'user-1', at: '2026-10-09T08:00:00.000Z' };
    const row = buildInvoiceLineRow(line({ unitPrice: 400, quantity: 1, feeOverride }), { invoiceId: 'i', hasMedicalAid: true, lineDetails: true, lineCodes: true });
    expect(row).toMatchObject({
      unit_price: 400,
      total_price: 400,
      medical_aid_covered: 400,
      fee_override_reason: 'Pensioner rate',
      fee_override_from: 450,
      fee_override_by: 'user-1',
      fee_override_at: '2026-10-09T08:00:00.000Z'
    });
    // Back at the price it had before: nothing was changed, so nothing is recorded
    const back = buildInvoiceLineRow(line({ unitPrice: 450, quantity: 1, feeOverride }), { invoiceId: 'i', hasMedicalAid: true, lineCodes: true });
    expect(back).toMatchObject({ fee_override_reason: null, fee_override_from: null, fee_override_by: null, fee_override_at: null });
  });

  it('refuses a changed fee without a reason, or before the database can say who changed it', () => {
    const feeOverride = { reason: ' ', fromUnitPrice: 450, by: 'user-1', at: '2026-10-09T08:00:00.000Z' };
    expect(() => buildInvoiceLineRow(line({ unitPrice: 400, feeOverride }), { invoiceId: 'i', hasMedicalAid: false, lineCodes: true })).toThrow(/say why the fee was changed/);
    const complete = { ...feeOverride, reason: 'Pensioner rate' };
    expect(() => buildInvoiceLineRow(line({ unitPrice: 400, feeOverride: complete }), { invoiceId: 'i', hasMedicalAid: false })).toThrow(/invoice-line update/);
  });

  it('leaves the code and fee columns out until the database has them, so saving keeps working', () => {
    const row = buildInvoiceLineRow(line({ icd10Codes: ['J06.9'] }), { invoiceId: 'i', hasMedicalAid: false, lineDetails: true });
    expect(row).not.toHaveProperty('icd10_primary');
    expect(row).not.toHaveProperty('fee_override_reason');
  });

  // Parity D8: a patient's own line must never reach the claim; the database leaves paid_by = 'patient' lines out
  it("stores who pays a line and its authorisation number once the database has the columns", () => {
    const context = { invoiceId: 'i', hasMedicalAid: true, copayPercent: 5, linePortions: true };
    expect(buildInvoiceLineRow(line({ unitPrice: 300, quantity: 1, paidBy: 'patient', authorisationNumber: ' A123 ' }), context)).toMatchObject({
      medical_aid_covered: 0,
      patient_portion: 300,
      paid_by: 'patient',
      authorisation_number: 'A123'
    });
    expect(buildInvoiceLineRow(line({ unitPrice: 300, quantity: 1 }), context)).toMatchObject({ medical_aid_covered: 285, patient_portion: 15, paid_by: null, authorisation_number: null });
    // A private patient's line is the patient's anyway: no payer is stored
    expect(buildInvoiceLineRow(line({ paidBy: 'fund' }), { ...context, hasMedicalAid: false })).toMatchObject({ paid_by: null });
  });

  // Before the update the claim would carry a "patient pays all" line to the fund: refuse it instead of claiming it
  it('refuses a line paid by one side or an authorisation number before the database can keep them', () => {
    expect(() => buildInvoiceLineRow(line({ paidBy: 'patient' }), { invoiceId: 'i', hasMedicalAid: true })).toThrow(/line-portions update/);
    expect(() => buildInvoiceLineRow(line({ authorisationNumber: 'A1' }), { invoiceId: 'i', hasMedicalAid: true })).toThrow(/line-portions update/);
    expect(() => buildInvoiceLineRow(line({ authorisationNumber: 'A 1,2' }), { invoiceId: 'i', hasMedicalAid: true, linePortions: true })).toThrow(/8101: An authorisation number/);
    expect(buildInvoiceLineRow(line(), { invoiceId: 'i', hasMedicalAid: true })).not.toHaveProperty('paid_by');
  });

  // Parity D5: the fund reads a filling by its tooth and surfaces, and a code billed per quadrant by its quadrant; both
  // are stored with the line so the invoice prints them and the claim carries them
  it("stores the surfaces of the line's one tooth, in the chart's order, and the quadrant", () => {
    const context = { invoiceId: 'i', hasMedicalAid: true, lineTeeth: true };
    expect(buildInvoiceLineRow(line({ code: '8368', quantity: 1, teethNumbers: ['46'], toothSurfaces: 'om' }), context)).toMatchObject({
      tooth_number: '46',
      tooth_surfaces: 'MO',
      tooth_quadrant: null
    });
    expect(buildInvoiceLineRow(line({ code: '8182', quantity: 1, toothQuadrant: 4 }), context)).toMatchObject({ tooth_surfaces: null, tooth_quadrant: 4 });
    // Surfaces belong to one tooth: a line of two teeth keeps none rather than claiming them for both
    expect(buildInvoiceLineRow(line({ code: '8368', quantity: 1, teethNumbers: ['46', '47'], toothSurfaces: 'MO' }), context)).toMatchObject({ tooth_surfaces: null });
    expect(() => buildInvoiceLineRow(line({ code: '8182', toothQuadrant: 5 }), context)).toThrow(/8182: a quadrant is 1, 2, 3 or 4/);
  });

  // Before the update the claim would go out without the surfaces staff marked: refuse rather than lose them
  it('refuses surfaces or a quadrant before the database can keep them, and leaves the columns out otherwise', () => {
    const context = { invoiceId: 'i', hasMedicalAid: true };
    expect(() => buildInvoiceLineRow(line({ teethNumbers: ['46'], toothSurfaces: 'MO' }), context)).toThrow(/tooth-surfaces update/);
    expect(() => buildInvoiceLineRow(line({ toothQuadrant: 2 }), context)).toThrow(/tooth-surfaces update/);
    expect(buildInvoiceLineRow(line({ teethNumbers: ['46'] }), context)).not.toHaveProperty('tooth_surfaces');
  });

  // Parity D7: a theatre line names its assistant and anaesthetist, and can name its own referring practitioner (claim
  // fields 25, 43, 44); kept with the line, so saving the visit again keeps them
  it("stores a line's own referral, its assistant and its anaesthetist", () => {
    const context = { invoiceId: 'i', hasMedicalAid: true, linePeople: true };
    expect(buildInvoiceLineRow(line({ referralId: 'ref-1', assistantId: ' u-2 ', anaesthetistId: 'u-3' }), context)).toMatchObject({
      referral_id: 'ref-1',
      assistant_id: 'u-2',
      anaesthetist_id: 'u-3'
    });
    expect(buildInvoiceLineRow(line(), context)).toMatchObject({ referral_id: null, assistant_id: null, anaesthetist_id: null });
  });

  // Before the update the claim would go out with the visit's referral instead of the line's: refuse rather than lose it
  it('refuses a line naming people before the database can keep them, and leaves the columns out otherwise', () => {
    expect(() => buildInvoiceLineRow(line({ assistantId: 'u-2' }), { invoiceId: 'i', hasMedicalAid: true })).toThrow(/referrals update/);
    expect(() => buildInvoiceLineRow(line({ referralId: 'ref-1' }), { invoiceId: 'i', hasMedicalAid: true })).toThrow(/8101: a line's own referral/);
    expect(buildInvoiceLineRow(line(), { invoiceId: 'i', hasMedicalAid: true })).not.toHaveProperty('referral_id');
  });

  // The levy is per visit: charged once across the invoice, never per line, and never from a patient's own line
  it('charges the levy once per invoice, off the first lines the fund pays', () => {
    const services = [line({ code: '9001', unitPrice: 100, quantity: 1, paidBy: 'patient' }), line({ code: '0190', unitPrice: 15, quantity: 1 }), line({ code: '0191', unitPrice: 400, quantity: 1 })];
    const context = { invoiceId: 'i', hasMedicalAid: true, levy: 20, linePortions: true };
    const rows = buildInvoiceLineRows(services, context);
    expect(rows.map(row => [row.code, row.medical_aid_covered, row.patient_portion])).toEqual([['9001', 0, 100], ['0190', 0, 15], ['0191', 395, 5]]);
    expect(invoiceLinesAmounts(services, context).levyCents).toBe(2_000);
    // One line built on its own never carries the levy (a screen mapping lines one by one would charge it per line)
    expect(buildInvoiceLineRow(services[2], context)).toMatchObject({ medical_aid_covered: 400, patient_portion: 0 });
    // A private patient pays everything and no levy is taken
    expect(invoiceLinesAmounts(services, { ...context, hasMedicalAid: false }).levyCents).toBe(0);
  });

  it('throws on a line that cannot be priced, so nothing is written for that invoice', () => {
    expect(() => buildInvoiceLineRows([line(), line({ quantity: 0 })], { invoiceId: 'i', hasMedicalAid: true, levy: 20 })).toThrow(/greater than 0/);
    const { amounts } = invoiceLinesAmounts([line({ quantity: 0 }), line({ unitPrice: 100, quantity: 1 })], { hasMedicalAid: true, levy: 20 });
    expect(amounts[0]).toBeNull();
    expect(amounts[1]).toMatchObject({ fundCents: 8_000, patientCents: 2_000 });
  });

  it('reports the gross, discount and both portions in cents', () => {
    expect(invoiceLineAmounts(line({ unitPrice: 135.4, quantity: 3 }), { hasMedicalAid: true, copayPercent: 10 })).toEqual({
      unitCents: 13_540,
      grossCents: 40_620,
      discountCents: 0,
      totalCents: 40_620,
      fundCents: 36_558,
      patientCents: 4_062
    });
    expect(fromCents(40_620)).toBe(406.2);
  });
});
