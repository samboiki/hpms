/**
 * A patient's price rate in the database (proposals/2026-10-13-patient-price-rates.sql). Before that file is applied
 * every patient must be billed as before (no rate, never an error on a visit); any other database problem is a real
 * error, because billing a staff member the full price without saying so is a wrong bill. Invented ids only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ maybeSingle: vi.fn(), rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => db.maybeSingle() }) }) }),
    rpc: (...args: unknown[]) => db.rpc(...args)
  }
}));

import { isPatientRatesNotSetUp, loadPatientRate, savePatientRate } from '../patientRateService';

const missingTable = { code: 'PGRST205', message: "Could not find the table 'public.patient_price_rates' in the schema cache" };

beforeEach(() => {
  db.maybeSingle.mockReset();
  db.rpc.mockReset();
});

describe("a patient's price rate", () => {
  it('reads the rate, none when the patient has none', async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: { kind: 'staff', percent: '50.00', set_at: '2026-10-13T08:00:00Z' }, error: null });
    expect(await loadPatientRate('patient-1')).toEqual({ status: 'ready', rate: { kind: 'staff', percent: 50 }, setAt: '2026-10-13T08:00:00Z' });
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await loadPatientRate('patient-1')).toEqual({ status: 'ready', rate: null, setAt: null });
    expect(await loadPatientRate(null)).toEqual({ status: 'ready', rate: null, setAt: null });
  });

  it('reads "not set up" before the database has rates, and passes every other error on', async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: missingTable });
    expect(await loadPatientRate('patient-1')).toMatchObject({ status: 'not_set_up', rate: null });
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied for table patient_price_rates' } });
    expect(await loadPatientRate('patient-1')).toMatchObject({ status: 'error', message: 'permission denied for table patient_price_rates' });
    expect(isPatientRatesNotSetUp({ code: 'PGRST205', message: "Could not find the table 'public.patient_recalls' in the schema cache" })).toBe(false);
  });

  it('saves through the database function, and removes the rate with none', async () => {
    db.rpc.mockResolvedValue({ data: null, error: null });
    await savePatientRate('practice-1', 'patient-1', { kind: 'contract', percent: 80.5 });
    expect(db.rpc).toHaveBeenCalledWith('set_patient_price_rate', { p_practice_id: 'practice-1', p_patient_id: 'patient-1', p_kind: 'contract', p_percent: 80.5 });
    await savePatientRate('practice-1', 'patient-1', null);
    expect(db.rpc).toHaveBeenLastCalledWith('set_patient_price_rate', { p_practice_id: 'practice-1', p_patient_id: 'patient-1', p_kind: null, p_percent: null });
  });

  it("says why it was not saved: not set up yet, or the database's own reason", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.set_patient_price_rate in the schema cache' } });
    await expect(savePatientRate('practice-1', 'patient-1', null)).rejects.toThrow('Price rates are not set up in this database yet.');
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: "Only a practice administrator or a practitioner can change a patient's price rate." } });
    await expect(savePatientRate('practice-1', 'patient-1', null)).rejects.toThrow("Only a practice administrator or a practitioner can change a patient's price rate.");
  });
});
