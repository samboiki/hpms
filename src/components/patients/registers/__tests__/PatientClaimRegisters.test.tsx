/**
 * The referrals and authorisations on the patient file's Billing tab (parity C10, D15): reception sees at a glance
 * which referral is still valid and which authorisation is active, ended or used up, and can remove a mistake.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { PatientClaimRegisters as Registers } from '../../../../hooks/usePatientClaimRegisters';

// Invented people and numbers only; the database is replaced
vi.mock('../../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../../letters/LetterComposer', () => ({ LetterComposer: () => <div>Letter composer</div> }));
vi.mock('../../../ui/MedicalAidLogo', () => ({ MedicalAidLogo: () => null }));
vi.mock('../../../../services/fundPricingService', () => ({ loadPatientFundKey: async () => ({ hasMedicalAid: true, fund: { reference: 'MAG1', planOptions: [] }, error: null }) }));
const removeReferral = vi.fn<(id: string) => Promise<void>>(async () => undefined);
vi.mock('../../../../services/claimRegistersService', () => ({
  removePatientReferral: (id: string) => removeReferral(id),
  removePatientAuthorisation: vi.fn(async () => undefined)
}));
let registers: Registers;
vi.mock('../../../../hooks/usePatientClaimRegisters', () => ({ usePatientClaimRegisters: () => registers }));

import PatientClaimRegisters from '../PatientClaimRegisters';

// Renders and lets the patient's fund (a promise) arrive, as the screen does
const renderRegisters = async () => {
  await act(async () => {
    render(<PatientClaimRegisters practiceId="practice-1" patientId="p1" />);
  });
};

const ready = (over: Partial<Registers> = {}): Registers => ({
  status: 'ready',
  message: null,
  referrals: [{
    id: 'r1', patientId: 'p1', referringName: 'Dr Test Referrer', referringPracticeNumber: '0123456', referringHpcna: null, referralNumber: 'REF-1',
    referralDate: '2026-09-01', validUntil: '2099-12-31', reason: 'Invented reason', letterPath: null, letterName: null, removedAt: null, createdAt: null
  }],
  authorisations: [{
    id: 'a1', patientId: 'p1', fundReference: 'MAG1', number: 'AUTH-77', validFrom: '2026-01-01', validTo: '2099-12-31',
    allCodes: false, codes: ['0190'], visitsAllowed: 2, note: null, quoteId: null, removedAt: null, createdAt: null
  }],
  usage: new Map([['AUTH-77', new Set(['v1', 'v2'])]]),
  reload: vi.fn(),
  ...over
});

describe('referrals and authorisations on the patient file', () => {
  it('shows a valid referral and an authorisation whose visits are used up, in words', async () => {
    registers = ready();
    await renderRegisters();
    expect(screen.getByText('Dr Test Referrer · practice 0123456')).toBeInTheDocument();
    expect(screen.getByText('Valid until 31 Dec 2099')).toBeInTheDocument();
    expect(screen.getByText(/2 of 2 visits used/)).toBeInTheDocument();
    expect(screen.getByText('Used up')).toBeInTheDocument();
  });

  // A referral recorded by mistake is removed, never deleted: the claims it went on can still be traced
  it('removes a referral after asking, and says so', async () => {
    registers = ready();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderRegisters();
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await waitFor(() => expect(screen.getByText('The referral was removed.')).toBeInTheDocument());
    expect(removeReferral).toHaveBeenCalledWith('r1');
    confirm.mockRestore();
  });

  it('offers the practice letters for referring the patient elsewhere', async () => {
    registers = ready();
    await renderRegisters();
    fireEvent.click(screen.getByRole('button', { name: /Write a referral letter/ }));
    expect(screen.getByText('Letter composer')).toBeInTheDocument();
  });

  it('says plainly when the registers are not set up', async () => {
    registers = ready({ status: 'not_set_up', referrals: [], authorisations: [] });
    await renderRegisters();
    expect(screen.getByText(/not set up in this database yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add referral/ })).toBeNull();
  });
});
