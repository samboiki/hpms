/**
 * The patient file header's photo (owner's decision, 13 Oct 2026; parity A12). Before photos are set up the header is
 * exactly as before (rule zero: no new look on an existing page until the feature works); once they are, the
 * patient's initials show until a photo is taken, and one tap offers Take photo and Upload photo. Invented names only.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ available: true, url: null as string | null }));

vi.mock('../../../forms/patientExtrasColumns', () => ({ usePatientPhotoColumn: () => state.available }));
vi.mock('../usePatientPhoto', () => ({ usePatientPhoto: () => state.url }));
vi.mock('../patientPhotoService', () => ({ savePatientPhoto: vi.fn(), removePatientPhoto: vi.fn() }));
vi.mock('../../../../services/recordFiles', () => ({ currentPracticeId: () => 'practice-1' }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PatientHeaderPhoto } from '../PatientHeaderPhoto';

afterEach(() => {
  cleanup();
  state.available = true;
  state.url = null;
});

describe('the photo on the patient file header', () => {
  it('shows nothing before photos are set up, so the header looks as it always did', () => {
    state.available = false;
    const { container } = render(<PatientHeaderPhoto patientId="p1" firstName="Ndapewa" lastName="Shilongo" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the initials until a photo is taken, and offers taking or uploading one', () => {
    render(<PatientHeaderPhoto patientId="p1" firstName="Ndapewa" lastName="Shilongo" />);
    expect(screen.getByText('NS')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add a patient photo' }));
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
  });

  it('shows the photo instead of the initials, and offers removing it', () => {
    state.url = 'https://signed.test/photo.jpg';
    const { container } = render(<PatientHeaderPhoto patientId="p1" firstName="Ndapewa" lastName="Shilongo" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://signed.test/photo.jpg');
    expect(screen.queryByText('NS')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change or remove the patient photo' }));
    expect(screen.getByRole('button', { name: 'Remove photo' })).toBeInTheDocument();
  });
});
