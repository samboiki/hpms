/**
 * "Add a person" in the patient app. When adding is paused (too many tries) inside the app, the only way out was
 * "Sign out"; a parent who already sees their own records now also gets "Back to home".
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { PortalContext, type PortalContextValue } from '../portalContext';
import type { LinkedPatient } from '../portalModel';

vi.mock('../portalService', () => ({ linkRecords: vi.fn() }));

import LinkPage from '../pages/LinkPage';

const patient = { patientId: 'patient-1', firstName: 'Test', lastName: 'Parent' } as LinkedPatient;

const renderLink = (firstTime: boolean) => {
  const value: PortalContextValue = {
    patients: firstTime ? [] : [patient],
    selected: firstTime ? null : patient,
    selectPatient: vi.fn(),
    status: { filesOnNumber: 2, linkedCount: 1, unlinkedOnNumber: 1, lock: { until: '2026-10-20T08:00:00Z', askReception: false } },
    loadState: 'ready',
    reload: vi.fn(),
    signOut: vi.fn()
  };
  return render(
    <MemoryRouter>
      <PortalContext.Provider value={value}>
        <LinkPage firstTime={firstTime} />
      </PortalContext.Provider>
    </MemoryRouter>
  );
};

describe('adding a person while adding is paused', () => {
  it('inside the app: back home or sign out', () => {
    renderLink(false);
    expect(screen.getByText('Too many tries')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to home/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeInTheDocument();
  });

  it('at first sign-in (nothing to go home to): sign out only', () => {
    renderLink(true);
    expect(screen.queryByRole('button', { name: /Back to home/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeInTheDocument();
  });
});
