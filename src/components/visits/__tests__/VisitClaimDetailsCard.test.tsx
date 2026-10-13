/**
 * A visit's referral and hospital details on its Billing tab (parity C10, F19): picking a referral from the patient's
 * register fills the claim fields; a hospital stay asks for its dates; nothing shows for a private patient.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { draftOfClaimDetails, type VisitClaimDetailsDraft } from '../../../utils/billing/visitClaimDetails';
import type { PatientReferral } from '../../../utils/billing/referrals';
import type { VisitClaimDetailsState } from '../useVisitClaimDetails';

// Invented people and numbers only; nothing here may reach the database
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

import VisitClaimDetailsCard from '../VisitClaimDetailsCard';

const referral: PatientReferral = {
  id: 'r1', patientId: 'p1', referringName: 'Dr Test Referrer', referringPracticeNumber: '0123456', referringHpcna: 'MP12345',
  referralNumber: 'REF-1', referralDate: '2026-10-01', validUntil: '2026-12-31', reason: null, letterPath: null, letterName: null, removedAt: null, createdAt: null
};

const renderCard = (draft: VisitClaimDetailsDraft = draftOfClaimDetails(null), hasMedicalAid = true) => {
  const setDraft = vi.fn();
  const state: VisitClaimDetailsState = { status: 'ready', message: null, draft, setDraft, dirty: false, save: vi.fn() };
  render(
    <VisitClaimDetailsCard
      state={state}
      visitDate="2026-10-12"
      hasMedicalAid={hasMedicalAid}
      practiceId="practice-1"
      patientId="p1"
      registers={{ status: 'ready', message: null, referrals: [referral], authorisations: [], usage: new Map(), reload: vi.fn() }}
      authorisationNotices={[]}
    />
  );
  return setDraft;
};

describe("a visit's referral and hospital details", () => {
  // Business rule: the claim names the referring practitioner as the register has them, so reception picks the
  // referral instead of typing it again (claim fields 25, 43, 44)
  it('fills the claim fields from the referral picked', () => {
    const setDraft = renderCard();
    fireEvent.click(screen.getByRole('button', { name: /Referral and hospital details/ }));
    fireEvent.change(screen.getByLabelText('Referral'), { target: { value: 'r1' } });
    expect(setDraft).toHaveBeenLastCalledWith(expect.objectContaining({
      referralId: 'r1', referringName: 'Dr Test Referrer', referringPracticeNumber: '0123456', referringHpcna: 'MP12345', referralNumber: 'REF-1'
    }));
  });

  it('opens with what is set, in one line', () => {
    renderCard({ ...draftOfClaimDetails(null), referralId: 'r1', referringName: 'Dr Test Referrer', referralNumber: 'REF-1', inHospital: true, admissionDate: '2026-10-10' });
    expect(screen.getByText('Referred by Dr Test Referrer (referral REF-1) · in hospital from 10 Oct 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Admitted on')).toHaveValue('2026-10-10');
  });

  // A place of service outside the fund's list is refused on the claim; staff see the group of the code they type
  it('names the group of a place-of-service code', () => {
    renderCard({ ...draftOfClaimDetails(null), placeOfService: '41' });
    expect(screen.getByText(/^Hospital, admitted/)).toBeInTheDocument();
  });

  it('opens on a code outside the list and says why it would be refused', () => {
    renderCard({ ...draftOfClaimDetails(null), placeOfService: '47' });
    expect(screen.getByRole('alert')).toHaveTextContent(/two-digit code from the fund list/);
  });

  it('shows nothing for a private patient', () => {
    renderCard(draftOfClaimDetails(null), false);
    expect(screen.queryByText('Referral and hospital details')).toBeNull();
  });
});
