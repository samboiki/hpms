/**
 * The practice's rules per code on a visit's Billing tab (parity E9, D13): whatever way staff add a code, its linked
 * codes come with it; the lines the visit opened with never bring them again; a code's default place of service fills
 * an empty one (and never overwrites what staff chose); each line says what it still needs.
 */
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { ServiceSelection } from '../../../types/billing';
import { NO_CODE_RULES, type CodeRules } from '../../../utils/billing/codeRules';
import { draftOfClaimDetails, type VisitClaimDetailsDraft } from '../../../utils/billing/visitClaimDetails';
import { buildTariffLine } from '../visitBillingLines';
import { useCodeRulesOnVisit } from '../useCodeRulesOnVisit';
import type { RuledVisitTariff } from '../linkedCodeLines';

const toasts = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('react-hot-toast', () => toasts);

const tariff = (code: string, rules: Partial<CodeRules> | null = null): RuledVisitTariff => ({
  id: `t-${code}`,
  code,
  description: `Service ${code}`,
  price: '100.00',
  can_be_multiplied: 'YES',
  requires_tooth_number: 'NO',
  is_active: true,
  code_rules: rules ? { ...NO_CODE_RULES, ...rules } : null
});
const TARIFFS = [
  tariff('0300', { linkedCodes: [{ code: '0201', quantity: 1 }], placeOfService: '21' }),
  tariff('0201'),
  tariff('0190', { needsAuthorisation: true }),
  tariff('0191', { placeOfService: '11' })
];
const line = (code: string): ServiceSelection => {
  const built = buildTariffLine(TARIFFS.find(item => item.code === code) as RuledVisitTariff, 1, '', true);
  if (!built.ok) throw new Error(built.message);
  return built.service;
};

const useVisit = (initial: ServiceSelection[], options: { hasMedicalAid: boolean; place?: string }) => {
  const [services, setServices] = useState(initial);
  const [draft, setDraft] = useState<VisitClaimDetailsDraft>({ ...draftOfClaimDetails(null), placeOfService: options.place ?? '' });
  const rules = useCodeRulesOnVisit({
    ready: true,
    services,
    setServices,
    tariffs: TARIFFS,
    hasMedicalAid: options.hasMedicalAid,
    practiceType: 'medical',
    claimDetails: { status: 'ready', draft, setDraft }
  });
  return { services, setServices, draft, rules };
};

describe('useCodeRulesOnVisit', () => {
  it("adds a new code's linked codes, but never for the lines the visit opened with", () => {
    const { result } = renderHook(() => useVisit([line('0300')], { hasMedicalAid: false }));
    // The visit's own saved line brought nothing again
    expect(result.current.services.map(service => service.code)).toEqual(['0300']);

    act(() => result.current.setServices([...result.current.services, line('0300')]));
    expect(result.current.services.map(service => service.code)).toEqual(['0300', '0300', '0201']);
    expect(result.current.services[2].linkedFrom).toBe('0300');
    expect(toasts.toast).toHaveBeenCalledWith('Also added: 0201 with 0300. Remove any you do not need before saving.', expect.anything());

    // Removing the linked line keeps it removed: the code that brought it is not new any more
    act(() => result.current.setServices(result.current.services.slice(0, 2)));
    expect(result.current.services.map(service => service.code)).toEqual(['0300', '0300']);
  });

  // The place of service goes on the claim: filled from the code when the visit has none, never over staff's choice
  it("fills the visit's empty place of service from the first new code that has one", () => {
    const { result } = renderHook(() => useVisit([], { hasMedicalAid: true }));
    act(() => result.current.setServices([line('0191'), line('0300')]));
    expect(result.current.draft.placeOfService).toBe('11');
  });

  it("keeps the place of service staff chose, and does nothing for a patient without medical aid", () => {
    const chosen = renderHook(() => useVisit([], { hasMedicalAid: true, place: '22' }));
    act(() => chosen.result.current.setServices([line('0191')]));
    expect(chosen.result.current.draft.placeOfService).toBe('22');

    const cash = renderHook(() => useVisit([], { hasMedicalAid: false }));
    act(() => cash.result.current.setServices([line('0191')]));
    expect(cash.result.current.draft.placeOfService).toBe('');
  });

  it("says which line still needs the fund's authorisation number", () => {
    const { result } = renderHook(() => useVisit([line('0190'), line('0201')], { hasMedicalAid: true }));
    const [needs, plain] = result.current.services;
    expect(result.current.rules.lineNotices.get(needs.id)?.[0]).toMatch(/0190 needs the fund's authorisation number/);
    expect(result.current.rules.lineNotices.has(plain.id)).toBe(false);
  });
});
