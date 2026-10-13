/**
 * The patient app before its linking service is switched on: a patient with nobody linked yet would be shown the
 * "Confirm who you are" form, fill it in, and only then read that the app is not switched on. They are told at once.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { usePortal } from '../portalContext';

const mocks = vi.hoisted(() => ({ patients: [] as unknown[] }));

vi.mock('../portalService', () => ({
  loadMyPatients: () => Promise.resolve({ state: 'ready', data: mocks.patients }),
  loadPortalStatus: () => Promise.resolve({ state: 'not_enabled' })
}));
vi.mock('../../stores/authStore', () => ({ useAuthStore: { getState: () => ({ logout: vi.fn() }) } }));

import PortalProvider from '../PortalProvider';

const Show: React.FC = () => {
  const { loadState } = usePortal();
  return <p>state: {loadState}</p>;
};

describe('PortalProvider', () => {
  it('nobody linked and the linking service missing: not switched on', async () => {
    mocks.patients = [];
    render(<PortalProvider><Show /></PortalProvider>);
    expect(await screen.findByText('state: not_enabled')).toBeInTheDocument();
  });

  it('people already linked: their records still open', async () => {
    mocks.patients = [{ patientId: 'patient-1', firstName: 'Test', lastName: 'Patient' }];
    render(<PortalProvider><Show /></PortalProvider>);
    expect(await screen.findByText('state: ready')).toBeInTheDocument();
  });
});
