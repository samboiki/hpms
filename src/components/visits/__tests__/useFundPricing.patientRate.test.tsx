/**
 * The visit's billing loads the patient's own price rate (parity R28) with the fund's prices: lines are priced with it,
 * and a rate that cannot be read stops billing (a staff member would otherwise be billed the full price without anyone
 * noticing). Before the database has rates every patient is billed as before. Invented ids only.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { EMPTY_PRICE_BOOK } from '../../../utils/billing/fundPricing';
import { NO_PRACTITIONER_BILLING } from '../../../utils/billing/practitionerBilling';

const loads = vi.hoisted(() => ({ loadPatientRate: vi.fn() }));
vi.mock('../../../services/fundPricingService', () => ({
  loadFundPriceBook: () => Promise.resolve({ book: EMPTY_PRICE_BOOK, error: null }),
  loadPatientFundKey: () => Promise.resolve({ fund: null, hasMedicalAid: false, error: null }),
  loadInfectionControlStaff: () => Promise.resolve(1)
}));
vi.mock('../../../services/practitionerBillingService', () => ({
  loadPractitionerBilling: () => Promise.resolve({ status: 'ready', billing: NO_PRACTITIONER_BILLING })
}));
vi.mock('../../../services/patientRateService', () => loads);

import { useFundPricing } from '../useFundPricing';

const params = { practiceId: 'practice-1', practiceType: 'General Practice', patientId: 'patient-1' };

beforeEach(() => {
  loads.loadPatientRate.mockReset();
});

describe("the visit's prices and the patient's own rate", () => {
  it("prices the visit with the patient's rate", async () => {
    loads.loadPatientRate.mockResolvedValue({ status: 'ready', rate: { kind: 'staff', percent: 50 }, setAt: null });
    const { result } = renderHook(() => useFundPricing(params));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.pricing.patientRate).toEqual({ kind: 'staff', percent: 50 });
    expect(result.current.patientRate).toEqual({ kind: 'staff', percent: 50 });
    expect(result.current.blockMessage).toBeNull();
    expect(loads.loadPatientRate).toHaveBeenCalledWith('patient-1');
  });

  it('stops billing when the rate cannot be read, and bills as before when rates are not set up', async () => {
    loads.loadPatientRate.mockResolvedValue({ status: 'error', rate: null, setAt: null, message: 'timeout' });
    const failed = renderHook(() => useFundPricing(params));
    await waitFor(() => expect(failed.result.current.status).toBe('ready'));
    expect(failed.result.current.blockMessage).toBe(
      "The patient's price rate could not be loaded (timeout), so services cannot be priced. Close and reopen the visit to try again."
    );

    loads.loadPatientRate.mockResolvedValue({ status: 'not_set_up', rate: null, setAt: null });
    const before = renderHook(() => useFundPricing({ ...params, patientId: 'patient-2' }));
    await waitFor(() => expect(before.result.current.status).toBe('ready'));
    expect(before.result.current).toMatchObject({ blockMessage: null, patientRate: null });
  });
});
