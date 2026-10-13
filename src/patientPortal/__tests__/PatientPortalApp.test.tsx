import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The patient app talks to the portal_* database functions and the patient-portal edge function only
const backend = vi.hoisted(() => ({
  patients: [] as unknown[],
  status: { ok: true, filesOnNumber: 2, linkedCount: 0, unlinkedOnNumber: 2, lock: null } as Record<string, unknown>,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (fn: string) => ({ data: fn === 'portal_my_patients' ? backend.patients : [], error: null })),
    functions: { invoke: vi.fn(async () => ({ data: backend.status, error: null })) },
    auth: { signOut: vi.fn(async () => ({ error: null })) },
    from: vi.fn(),
  },
}));

import PatientPortalApp from '../PatientPortalApp';

const Path = () => <p data-testid="path">{useLocation().pathname}</p>;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PatientPortalApp />
      <Path />
    </MemoryRouter>
  );

beforeEach(() => {
  backend.patients = [];
  backend.status = { ok: true, filesOnNumber: 2, linkedCount: 0, unlinkedOnNumber: 2, lock: null };
});

describe('patient app shell', () => {
  it('sends a patient who opens a staff address to the patient app', async () => {
    renderAt('/patients');
    expect(await screen.findByText('Confirm who you are')).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/me$/);
  });

  it('shows nothing from any file until the person confirmed who they are', async () => {
    renderAt('/me/results');
    expect(await screen.findByText('Confirm who you are')).toBeInTheDocument();
    expect(screen.queryByText('Results')).not.toBeInTheDocument();
  });

  it('tells a person whose number is on no file to ask reception', async () => {
    backend.status = { ok: true, filesOnNumber: 0, linkedCount: 0, unlinkedOnNumber: 0, lock: null };
    renderAt('/me');
    expect(await screen.findByText('We could not find your cell number')).toBeInTheDocument();
    expect(screen.getByText(/ask reception to add your cell number/i)).toBeInTheDocument();
  });

  it('opens on the home screen once a file is linked', async () => {
    backend.status = { ok: true, filesOnNumber: 1, linkedCount: 1, unlinkedOnNumber: 0, lock: null };
    backend.patients = [{ patient_id: 'pat-1', relationship: 'self', first_name: 'Maria', last_name: 'Nghipondoka', practice_name: 'Klein Windhoek Clinic' }];
    renderAt('/me');
    expect(await screen.findByText('Hello, Maria')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Patient app' })).toBeInTheDocument();
  });
});
