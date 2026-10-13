/**
 * The patient app's home screen. When the appointments could not be read it said "No appointment booked", so a patient
 * with a booking was told they had none; it now says the appointments could not be loaded (with Try again), or that
 * this part is not available yet.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { PortalContext, type PortalContextValue } from '../portalContext';
import type { LinkedPatient } from '../portalModel';
import type { PortalLoad } from '../portalService';

const mocks = vi.hoisted(() => ({ appointments: null as unknown }));

vi.mock('../portalService', () => ({
  LOAD_ERROR: 'Could not load this right now. Check your connection and try again.',
  loadAppointments: () => Promise.resolve(mocks.appointments),
  loadInvoices: () => Promise.resolve({ state: 'ready', data: [] })
}));

import HomePage from '../pages/HomePage';

const patient: LinkedPatient = {
  patientId: 'patient-1', relationship: 'self', firstName: 'Test', lastName: 'Patient', dateOfBirth: null, gender: null,
  idNumber: null, cellNumber: null, email: null, homeAddress: null, postalAddress: null, postalCode: null,
  practiceId: 'practice-1', practiceName: 'Example Practice', practicePhone: null, practiceEmail: null, practiceAddress: null,
  bank: null
};

const renderHome = (appointments: PortalLoad<unknown[]>) => {
  mocks.appointments = appointments;
  const value: PortalContextValue = {
    patients: [patient], selected: patient, selectPatient: vi.fn(), status: null, loadState: 'ready', reload: vi.fn(), signOut: vi.fn()
  };
  return render(
    <MemoryRouter>
      <PortalContext.Provider value={value}>
        <HomePage />
      </PortalContext.Provider>
    </MemoryRouter>
  );
};

describe('patient app home', () => {
  it('says the appointments could not be loaded, never "No appointment booked"', async () => {
    renderHome({ state: 'error', message: 'Could not load this right now. Check your connection and try again.' });
    expect(await screen.findByText('Could not load this right now. Check your connection and try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('No appointment booked')).not.toBeInTheDocument();
  });

  it('says when appointments are not available yet', async () => {
    renderHome({ state: 'not_enabled' });
    expect(await screen.findByText('Not switched on yet')).toBeInTheDocument();
    expect(screen.queryByText('No appointment booked')).not.toBeInTheDocument();
  });

  it('offers to ask for one when there really is none', async () => {
    renderHome({ state: 'ready', data: [] });
    expect(await screen.findByText('No appointment booked')).toBeInTheDocument();
  });
});
