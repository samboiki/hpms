/**
 * The ICD-10 codes of the visit's billing lines (owner, 14 Oct 2026: the app suggests, the practitioner confirms). Why: a
 * diagnosis saved on a line reaches the claim as if the practitioner had chosen it (claim review treats a saved code as
 * confirmed, and the funds pay on it), so the practice's usual code for a tariff code and the codes written in the visit's
 * notes may only be OFFERED in the line's code box. The line is saved without a code until a person chooses one; codes a
 * person chose, and codes confirmed at claim review, are kept exactly as they are. Invented lines and codes only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ServiceSelection } from '../../../types/billing';

const context = vi.hoisted(() => ({
  icd10Defaults: new Map<string, string>(),
  claimCodes: undefined as Map<string, string[]> | undefined
}));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../useInvoiceContext', () => ({
  useInvoiceContext: () => ({
    status: 'ready',
    setup: { lineDetails: true, createdBy: true, audit: true, lineCodes: true, linePortions: true, lineTeeth: true, linePeople: true },
    practitioners: [],
    copayRules: [],
    invoice: context.claimCodes ? { id: 'i1', lock: null, claimCodes: context.claimCodes } : null,
    billedLines: [],
    icd10Defaults: context.icd10Defaults,
    problems: [],
    reload: () => undefined
  })
}));
vi.mock('../../../hooks/usePatientClaimRegisters', () => ({
  usePatientClaimRegisters: () => ({ status: 'ready', message: null, referrals: [], authorisations: [], usage: new Map(), reload: () => undefined })
}));

import { useVisitBilling } from '../useVisitBilling';

const line = (id: string, code: string, overrides: Partial<ServiceSelection> = {}): ServiceSelection => ({
  id, tariffId: `t-${code}`, code, description: `Service ${code}`, category: 'Consultation', unitPrice: 450, quantity: 1, totalPrice: 450, ...overrides
});

const hook = (services: ServiceSelection[], extra: { diagnosis?: string; practiceType?: string } = {}) =>
  renderHook(() =>
    useVisitBilling({
      services,
      practiceId: 'practice-1',
      patientId: 'p1',
      visitId: 'v1',
      visitDateKey: '2026-10-14',
      visitPractitionerId: null,
      hasMedicalAid: true,
      fund: { reference: 'MAG1', planOptions: [] },
      ...extra
    })
  );

beforeEach(() => {
  context.icd10Defaults = new Map();
  context.claimCodes = undefined;
});

describe("the practice's usual code for a tariff code", () => {
  it('is offered first in the line\'s code box, but the line is saved without a code', () => {
    context.icd10Defaults = new Map([['0190', 'J06.9']]);
    const { result } = hook([line('l1', '0190')]);
    expect(result.current.lineIcd10.get('l1')).toEqual({
      codes: [],
      suggested: false,
      sourceLabel: null,
      offered: ['J06.9'],
      offeredLabel: "the practice's usual code for 0190"
    });
    // What the invoice saves carries no diagnosis the practitioner did not choose
    expect(result.current.servicesForInvoice[0].icd10Codes).toBeUndefined();
  });

  it('is saved on the line only once a person has chosen it', () => {
    context.icd10Defaults = new Map([['0190', 'J06.9']]);
    const { result } = hook([line('l1', '0190', { icd10Codes: ['J06.9'] })]);
    expect(result.current.lineIcd10.get('l1')).toEqual({ codes: ['J06.9'], suggested: false, sourceLabel: null });
    expect(result.current.servicesForInvoice[0].icd10Codes).toEqual(['J06.9']);
  });

  // A practitioner may take the code off a line on purpose: that choice stays, the usual code does not come back
  it('does not come back on a line whose codes a person emptied', () => {
    context.icd10Defaults = new Map([['0190', 'J06.9']]);
    const { result } = hook([line('l1', '0190', { icd10Codes: [] })]);
    expect(result.current.lineIcd10.get('l1')?.codes).toEqual([]);
    expect(result.current.lineIcd10.get('l1')?.offered).toBeUndefined();
    expect(result.current.servicesForInvoice[0].icd10Codes).toEqual([]);
  });
});

describe("the codes written in the visit's diagnosis", () => {
  it('are offered for a line without codes, and not saved on it', () => {
    const { result } = hook([line('l1', '0190'), line('l2', '0191')], { diagnosis: 'K02.1 caries, K04.0 pulpitis' });
    expect(result.current.lineIcd10.get('l1')).toMatchObject({ codes: [], offered: ['K02.1', 'K04.0'], offeredLabel: 'from the visit diagnosis' });
    expect(result.current.lineIcd10.get('l2')).toMatchObject({ codes: [], offered: ['K02.1', 'K04.0'] });
    expect(result.current.servicesForInvoice.map(service => service.icd10Codes)).toEqual([undefined, undefined]);
  });

  it('are offered for a line whose own codes were chosen too, without touching them', () => {
    const { result } = hook([line('l1', '0190', { icd10Codes: ['I10'] })], { diagnosis: 'K02.1 caries' });
    expect(result.current.lineIcd10.get('l1')).toEqual({ codes: ['I10'], suggested: false, sourceLabel: null });
    expect(result.current.servicesForInvoice[0].icd10Codes).toEqual(['I10']);
  });
});

describe('a dental practice\'s built-in suggestions', () => {
  // The built-in lists are the owner's sheet and the funds' usual codes: still only suggestions
  it('are offered, not saved', () => {
    const { result } = hook([line('l1', '8109')], { practiceType: 'dental' });
    expect(result.current.lineIcd10.get('l1')).toMatchObject({ codes: [], offered: ['Z01.2'], offeredLabel: 'usual for 8109' });
    expect(result.current.servicesForInvoice[0].icd10Codes).toBeUndefined();
  });
});

describe('older lines', () => {
  // Someone confirmed these at claim review: they are kept, shown with where they came from
  it('keep the codes confirmed at claim review for their claim line', () => {
    context.claimCodes = new Map([['l1', ['K02.1']]]);
    const { result } = hook([line('l1', '0190')]);
    expect(result.current.lineIcd10.get('l1')).toEqual({ codes: ['K02.1'], suggested: true, sourceLabel: 'confirmed at claim review' });
    expect(result.current.servicesForInvoice[0].icd10Codes).toEqual(['K02.1']);
  });

  it('stay without a code when nothing is known for them', () => {
    const { result } = hook([line('l1', '0190')]);
    expect(result.current.lineIcd10.get('l1')).toMatchObject({ codes: [], offered: [], offeredLabel: null });
    expect(result.current.servicesForInvoice[0].icd10Codes).toBeUndefined();
  });
});
