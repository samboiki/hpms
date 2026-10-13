/**
 * A patient's own price rate on the visit's prices (parity R28): a staff, private or contract rate is a percentage of the
 * usual price. What matters to a practice: a staff member is billed the staff price without anyone retyping fees; the
 * rate works with a partner's own rate instead of replacing it; a medical aid's own price is never changed (the claim
 * would be cut); and reception sees why the prices are lower. Invented prices in the shape of NAMAF 2025 dental ones.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  billableVisitTariffs,
  buildMaterialFactorLine,
  buildTariffLine,
  fundPricingNotice,
  priceForPatient,
  priceLinesAtRate,
  type VisitPricing,
  type VisitTariff
} from '../visitBillingLines';
import type { FundPriceBook, FundTariffRow } from '../../../utils/billing/fundPricing';
import type { PatientRate } from '../../../utils/billing/patientRates';
import type { ServiceSelection } from '../../../types/billing';

// visitBillingLines reaches invoiceService's pure line checks only; nothing here may reach the database
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const tariff = (code: string, price: string, overrides: Partial<VisitTariff> = {}): VisitTariff => ({
  id: `t-${code}`,
  code,
  description: `Service ${code}`,
  price,
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO',
  is_active: true,
  ...overrides
});
const LIST = () =>
  billableVisitTariffs(
    [tariff('8101', '254.70'), tariff('8110', '76.80'), tariff('8346', '0', { can_be_multiplied: 'YES' }), tariff('8369', '663.00', { requires_tooth_number: 'YES' })],
    '2026-10-13'
  );
const fundRow = (code: string, unitPrice: string): FundTariffRow => ({
  id: `f-${code}`,
  practice_id: null,
  fund_reference: 'MAG1',
  code,
  unit_price: unitPrice,
  effective_from: '2023-12-13'
});
const PSEMAS: FundPriceBook = { rows: [fundRow('8369', '386.10'), fundRow('8101', '148.30')], contracts: [] };
const STAFF: PatientRate = { kind: 'staff', percent: 50 };
const privatePatient = (patientRate: PatientRate | null, ratePercent: number | null = null): VisitPricing => ({
  practiceId: 'practice-1',
  fund: null,
  book: PSEMAS,
  ratePercent,
  patientRate
});
const added = (outcome: ReturnType<typeof buildTariffLine>): ServiceSelection => {
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.service;
};
const priceOf = (tariffs: readonly VisitTariff[], code: string) => tariffs.find(row => row.code === code)?.price;

describe("a patient's own price rate on the visit", () => {
  it('bills a staff member half the usual price on every code, the 8346 material following its procedure', () => {
    const priced = priceForPatient(LIST(), '2026-10-13', privatePatient(STAFF));
    expect(priced.find(row => row.code === '8101')).toMatchObject({ price: 127.35, patient_rate_percent: 50 });
    const filling = added(buildTariffLine(priced.find(row => row.code === '8369') as VisitTariff, 1, '16', false));
    expect(filling.unitPrice).toBe(331.5);
    expect(added(buildMaterialFactorLine(priced, filling, false)).unitPrice).toBe(33.15);
  });

  // A partner charging 120% charges a staff member 120% of the staff price; moving the line to another practitioner
  // keeps the staff rate, so the patient's rate never depends on who treats them
  it("works with the treating practitioner's own rate, also when a line moves to another practitioner", () => {
    const priced = priceForPatient(LIST(), '2026-10-13', privatePatient(STAFF, 120));
    expect(priced.find(row => row.code === '8101')).toMatchObject({ price: 152.82, list_price: 127.35, rate_percent: 120, patient_rate_percent: 50 });
    const exam = added(buildTariffLine(priced.find(row => row.code === '8101') as VisitTariff, 1, '', false));
    expect(priceLinesAtRate([exam], new Set([exam.id]), null, priced, false)[0].unitPrice).toBe(127.35);
    expect(priceLinesAtRate([exam], new Set([exam.id]), 80, priced, false)[0].unitPrice).toBe(101.88);
  });

  // The claim must carry the fund's own price: only codes the fund has no price for are at the practice tariff
  it("never changes a medical aid's own price", () => {
    const psemasStaff: VisitPricing = { practiceId: 'practice-1', fund: { reference: 'MAG1', planOptions: [], name: 'PSEMAS' }, book: PSEMAS, patientRate: STAFF };
    const priced = priceForPatient(LIST(), '2026-10-13', psemasStaff);
    expect([priceOf(priced, '8369'), priceOf(priced, '8101'), priceOf(priced, '8110')]).toEqual([386.1, 148.3, 38.4]);
    expect(fundPricingNotice(psemasStaff, '2026-10-13')).toMatch(
      /This patient has a staff rate: new lines are billed at 50% of the usual price for codes at the practice tariff \(the fund's own prices stay\)\.$/
    );
  });

  it('changes nothing without a rate, or with a rate at the usual price (a staff rate for medicines only)', () => {
    const list = LIST();
    expect(priceForPatient(list, '2026-10-13', privatePatient(null))).toEqual(list);
    expect(priceForPatient(list, '2026-10-13', privatePatient({ kind: 'staff', percent: null }))).toEqual(list);
    expect(fundPricingNotice(privatePatient({ kind: 'staff', percent: null }), '2026-10-13')).toBeNull();
  });

  // Lower prices surprise reception unless the Billing tab says why
  it('says so above the lines', () => {
    expect(fundPricingNotice(privatePatient({ kind: 'contract', percent: 90 }), '2026-10-13')).toBe(
      'This patient has a contract rate: new lines are billed at 90% of the usual price.'
    );
  });
});
