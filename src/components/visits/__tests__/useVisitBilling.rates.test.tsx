import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ServiceSelection } from '../../../types/billing';
import type { TreatingPractitionerOption } from '../../../utils/billing/invoiceRights';
import { buildMaterialFactorLine, buildTariffLine, type VisitTariff } from '../visitBillingLines';

// The invoice context (database) is replaced by a ready one: two practitioners, every column in place
const practitioners: TreatingPractitionerOption[] = [
  { id: 'doc', label: 'Dr A Practice', hpcnaNumber: 'DEN00001', warning: null },
  { id: 'partner', label: 'Dr B Partner', hpcnaNumber: 'DEN00002', warning: null }
];
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
// The patient's referral and authorisation registers (database) are replaced by empty ones
vi.mock('../../../hooks/usePatientClaimRegisters', () => ({
  usePatientClaimRegisters: () => ({ status: 'ready', message: null, referrals: [], authorisations: [], usage: new Map(), reload: () => undefined })
}));
vi.mock('../useInvoiceContext', () => ({
  useInvoiceContext: () => ({
    status: 'ready',
    setup: { lineDetails: true, createdBy: true, audit: true, lineCodes: true, linePortions: true, lineTeeth: true },
    practitioners,
    copayRules: [],
    invoice: null,
    billedLines: [],
    icd10Defaults: new Map(),
    problems: [],
    reload: () => undefined
  })
}));

import { useVisitBilling } from '../useVisitBilling';

const tariffs: VisitTariff[] = [
  { id: 't-8369', code: '8369', description: 'Resin - three surfaces, posterior', price: 663, can_be_multiplied: 'NO', requires_tooth_number: 'YES' },
  { id: 't-8346', code: '8346', description: 'Material', price: 0, can_be_multiplied: 'YES', requires_tooth_number: 'NO' },
  { id: 't-8101', code: '8101', description: 'Examination', price: 254.7, can_be_multiplied: 'NO', requires_tooth_number: 'NO' }
];
const built = (outcome: ReturnType<typeof buildTariffLine>): ServiceSelection => {
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.service;
};
const filling = built(buildTariffLine(tariffs[0], 1, '46', false));
const material = (() => {
  const outcome = buildMaterialFactorLine(tariffs, filling, false);
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.service;
})();
const exam = built(buildTariffLine(tariffs[2], 1, '', false));
// The partner bills under an invented number of their own at 120% of the practice's price list
const partnerBilling = new Map([['partner', { practiceNumber: '0999888777666', ratePercent: 120 }]]);

const hook = (props: { visitPractitionerId: string; services: ServiceSelection[]; onServicesChange?: (lines: ServiceSelection[]) => void }) =>
  renderHook(current => useVisitBilling({
    services: current.services,
    practiceId: 'practice-1',
    patientId: 'patient-1',
    visitId: null,
    visitDateKey: '2026-10-12',
    visitPractitionerId: current.visitPractitionerId,
    hasMedicalAid: false,
    fund: null,
    practiceType: 'dental',
    tariffs,
    practitionerBilling: partnerBilling,
    onServicesChange: current.onServicesChange
  }), { initialProps: props });

const prices = (lines: readonly ServiceSelection[]) => lines.map(line => [line.code, line.unitPrice]);

// Business rule (D31): a line is priced at the rate of the practitioner who treats it. When reception gives a line to
// the partner, it (and its 8346 material line, 10% of the restoration) moves to the partner's rate; the partner's own
// practice number is shown with them, because the fund pays that number for the line.
describe('another practitioner treats a line', () => {
  it("moves the line and its 8346 to that practitioner's rate, and back", () => {
    const { result } = hook({ visitPractitionerId: 'doc', services: [filling, material, exam] });
    const toPartner = result.current.withLineDetails(filling.id, { practitionerId: 'partner' });
    expect(prices(toPartner)).toEqual([['8369', 795.6], ['8346', 79.56], ['8101', 254.7]]);
    expect(toPartner[1].practitionerId).toBe('partner');
    expect(prices(result.current.withLineDetails(filling.id, { practitionerId: 'doc' }))).toEqual([['8369', 663], ['8346', 66.3], ['8101', 254.7]]);
    expect(result.current.invoiceContext.practitioners.find(option => option.id === 'partner')).toMatchObject({ ownPracticeNumber: '0999888777666', ratePercent: 120 });
    expect(result.current.lineTeethEditable).toBe(true);
  });
});

// Business rule (D31): the lines that follow the visit's practitioner belong to whoever the visit is with. Changing the
// visit to the partner prices them at the partner's rate; a line given to someone else keeps its price, and opening a
// saved visit never changes a price on its own.
describe("the visit's practitioner changes", () => {
  it('prices the lines that follow the visit at the new rate, once', () => {
    const onServicesChange = vi.fn();
    const ownLine = { ...exam, practitionerId: 'doc' };
    const { rerender } = hook({ visitPractitionerId: 'doc', services: [filling, material, ownLine], onServicesChange });
    expect(onServicesChange).not.toHaveBeenCalled();
    rerender({ visitPractitionerId: 'partner', services: [filling, material, ownLine], onServicesChange });
    expect(onServicesChange).toHaveBeenCalledTimes(1);
    expect(prices(onServicesChange.mock.calls[0][0])).toEqual([['8369', 795.6], ['8346', 79.56], ['8101', 254.7]]);
    rerender({ visitPractitionerId: 'partner', services: [filling, material, ownLine], onServicesChange });
    expect(onServicesChange).toHaveBeenCalledTimes(1);
  });
});

// Business rule (D5): surfaces belong to the line's one tooth, in the chart's order; a line of several teeth keeps none
describe('surfaces marked on a line', () => {
  it("keeps the tooth's surfaces in order, and none on a line of two teeth", () => {
    const twoTeeth = { ...filling, id: 'two', teethNumbers: ['46', '47'] };
    const { result } = hook({ visitPractitionerId: 'doc', services: [filling, twoTeeth] });
    const [one, two] = result.current.withLineDetails(filling.id, { toothSurfaces: 'dom' });
    expect(one.toothSurfaces).toBe('MOD');
    expect(two.toothSurfaces).toBeUndefined();
    expect(result.current.withLineDetails('two', { toothSurfaces: 'MO' })[1].toothSurfaces).toBeUndefined();
    expect(result.current.withLineDetails(filling.id, { toothSurfaces: null })[0].toothSurfaces).toBeUndefined();
  });
});
