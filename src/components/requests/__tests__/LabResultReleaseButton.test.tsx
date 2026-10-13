/**
 * Sharing lab results with the patient app is for doctors and administrators (release_lab_results_to_patient refuses
 * anyone else). A nurse or receptionist was offered "Release to patient", confirmed, and was then refused; they now see
 * only whether the patient can see the results.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({ user: null as null | { role: string; is_super_admin?: boolean } }));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: mocks.user })
}));
vi.mock('../labRelease', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../labRelease')>()),
  setLabResultsRelease: vi.fn()
}));

import LabResultReleaseButton from '../LabResultReleaseButton';

const results = [{ id: 'result-1', released_to_patient: false }];
const renderButton = () => render(<LabResultReleaseButton requestId="lab-1" results={results} onChanged={vi.fn()} />);

describe('Release to patient', () => {
  it('is offered to a doctor', () => {
    mocks.user = { role: 'doctor' };
    renderButton();
    expect(screen.getByRole('button', { name: /Release to patient/ })).toBeInTheDocument();
  });

  it('is offered to OneHealth support', () => {
    mocks.user = { role: 'receptionist', is_super_admin: true };
    renderButton();
    expect(screen.getByRole('button', { name: /Release to patient/ })).toBeInTheDocument();
  });

  it('a nurse sees whether the patient can see the results, without a button the database would refuse', () => {
    mocks.user = { role: 'nurse' };
    renderButton();
    expect(screen.getByText('Not shown to the patient yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Release to patient/ })).not.toBeInTheDocument();
  });
});
