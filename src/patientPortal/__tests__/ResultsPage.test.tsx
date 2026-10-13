import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The database function already returns released results only; here it misbehaves on purpose
const rpc = vi.hoisted(() =>
  vi.fn(async () => ({
    data: [
      {
        id: 'r1',
        lab_request_id: 'req-1',
        request_date: '2026-10-01',
        lab_facility: 'PathCare Windhoek',
        test_name: 'Haemoglobin',
        test_value: '13.1',
        test_unit: 'g/dL',
        reference_range: '12.0-16.0',
        released_at: '2026-10-05T09:00:00Z',
        released_to_patient: true,
      },
      {
        id: 'r2',
        lab_request_id: 'req-2',
        request_date: '2026-10-06',
        lab_facility: 'PathCare Windhoek',
        test_name: 'PSA',
        test_value: '9.8',
        test_unit: 'ng/mL',
        reference_range: '<4',
        released_at: null,
        released_to_patient: false,
      },
    ],
    error: null,
  }))
);
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }));

import ResultsPage from '../pages/ResultsPage';
import { PortalContext, type PortalContextValue } from '../portalContext';
import type { LinkedPatient } from '../portalModel';

const patient: LinkedPatient = {
  patientId: 'pat-1',
  relationship: 'self',
  firstName: 'Maria',
  lastName: 'Nghipondoka',
  dateOfBirth: '1985-03-02',
  gender: null,
  idNumber: null,
  cellNumber: '0811234567',
  email: null,
  homeAddress: null,
  postalAddress: null,
  postalCode: null,
  practiceId: 'practice-1',
  practiceName: 'Klein Windhoek Clinic',
  practicePhone: null,
  practiceEmail: null,
  practiceAddress: null,
  bank: null,
};

const context: PortalContextValue = {
  patients: [patient],
  selected: patient,
  selectPatient: () => undefined,
  status: null,
  loadState: 'ready',
  reload: async () => undefined,
  signOut: async () => undefined,
};

describe('Results screen', () => {
  it('shows released results with their range and never one the doctor has not released', async () => {
    render(
      <PortalContext.Provider value={context}>
        <ResultsPage />
      </PortalContext.Provider>
    );
    expect(await screen.findByText('Haemoglobin')).toBeInTheDocument();
    expect(screen.getByText('Reference range: 12.0-16.0')).toBeInTheDocument();
    // Dentists and optometrists share results too: "practitioner", not "doctor"
    expect(screen.getByText(/discuss your results with your practitioner/i)).toBeInTheDocument();
    // An unreleased PSA result could alarm a patient before the doctor has seen it
    expect(screen.queryByText('PSA')).not.toBeInTheDocument();
    expect(screen.queryByText(/9\.8/)).not.toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith('portal_lab_results', { p_patient_id: 'pat-1' });
  });
});
