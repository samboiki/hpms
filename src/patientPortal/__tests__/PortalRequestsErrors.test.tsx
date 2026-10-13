/**
 * A patient's requests (appointments asked for, details to change). When they could not be read the list simply
 * vanished, so a patient waiting for an answer saw nothing; the page now says they could not be loaded, with Try again.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { PortalContext, type PortalContextValue } from '../portalContext';
import type { LinkedPatient } from '../portalModel';

vi.mock('../portalService', () => ({
  LOAD_ERROR: 'Could not load this right now. Check your connection and try again.',
  loadRequests: () => Promise.resolve({ state: 'error', message: 'Could not load this right now. Check your connection and try again.' }),
  loadAppointments: () => Promise.resolve({ state: 'ready', data: [] }),
  cancelAppointment: vi.fn(),
  withdrawRequest: vi.fn()
}));

import ProfilePage from '../pages/ProfilePage';
import AppointmentsPage from '../pages/AppointmentsPage';

const patient: LinkedPatient = {
  patientId: 'patient-1', relationship: 'self', firstName: 'Test', lastName: 'Patient', dateOfBirth: '1981-03-03', gender: null,
  idNumber: null, cellNumber: null, email: null, homeAddress: null, postalAddress: null, postalCode: null,
  practiceId: 'practice-1', practiceName: 'Example Practice', practicePhone: null, practiceEmail: null, practiceAddress: null,
  bank: null
};

const renderPage = (page: React.ReactElement) => {
  const value: PortalContextValue = {
    patients: [patient], selected: patient, selectPatient: vi.fn(), status: null, loadState: 'ready', reload: vi.fn(), signOut: vi.fn()
  };
  return render(
    <MemoryRouter>
      <PortalContext.Provider value={value}>{page}</PortalContext.Provider>
    </MemoryRouter>
  );
};

describe('patient requests that could not be loaded', () => {
  it('My details says the change requests could not be loaded', async () => {
    renderPage(<ProfilePage />);
    expect(await screen.findByText('Change requests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    // A date of birth without a weekday
    expect(screen.getByText('3 Mar 1981')).toBeInTheDocument();
  });

  it('Appointments says the requests could not be loaded', async () => {
    renderPage(<AppointmentsPage />);
    expect(await screen.findByText('Your requests')).toBeInTheDocument();
    expect(screen.getByText('Could not load this right now. Check your connection and try again.')).toBeInTheDocument();
  });
});
