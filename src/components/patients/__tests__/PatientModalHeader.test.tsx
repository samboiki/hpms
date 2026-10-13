import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// All people are invented
const fileService = vi.hoisted(() => ({ loadFormalName: vi.fn() }));
vi.mock('../../../services/patientFileService', () => ({ loadFormalName: fileService.loadFormalName }));
// Reads the reference and old file number from the database (tested in PatientFileNumbers.test.tsx)
vi.mock('../PatientFileNumbers', () => ({ PatientFileNumbers: () => null }));
// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import PatientModalHeader from '../PatientModalHeader';

const noop = () => {};
const renderHeader = (patient: Record<string, unknown>, onEditProfile = vi.fn()) => {
  render(
    <PatientModalHeader
      activeTab="details"
      isFullScreen={false}
      selectedPatientDetails={{ id: 'patient-9', first_name: 'Ndapewa', last_name: 'Shilongo', ...patient }}
      onClose={noop}
      onToggleFullScreen={noop}
      onEditProfile={onEditProfile}
    />
  );
  return onEditProfile;
};

afterEach(() => cleanup());
beforeEach(() => {
  fileService.loadFormalName.mockReset().mockResolvedValue(null);
});

describe('PatientModalHeader', () => {
  it('shows the formal name ("Mrs N M Shilongo") under the full name once the file has a title or initials', async () => {
    fileService.loadFormalName.mockResolvedValue('Mrs N M Shilongo');
    renderHeader({ id_number: '90051400123', date_of_birth: '1990-05-14', gender: 'female' });
    expect(await screen.findByText('Mrs N M Shilongo')).toBeInTheDocument();
    expect(fileService.loadFormalName).toHaveBeenCalledWith('patient-9');
  });

  it('says what a file booked with a name and cell still needs, and opens the form in one tap', () => {
    const onEditProfile = renderHeader({ id_number: 'TEMP-1728000000000-abc123xyz', date_of_birth: '1990-01-01', gender: 'other' });
    expect(screen.getByText(/Still needed: ID number, date of birth and gender/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete file' }));
    expect(onEditProfile).toHaveBeenCalledTimes(1);
  });

  it('never shows the placeholders as an age, birthday, gender or ID number (a dose can depend on the age)', () => {
    renderHeader({ id_number: 'TEMP-1728000000000-abc123xyz', date_of_birth: '1990-01-01', gender: 'other' });
    expect(screen.getByText('Age unknown')).toBeInTheDocument();
    expect(screen.getByText('Born Unknown')).toBeInTheDocument();
    expect(screen.getByText('Not specified')).toBeInTheDocument();
    expect(screen.queryByText('TEMP-1728000000000-abc123xyz')).not.toBeInTheDocument();
  });

  it('shows a complete file as before, with no prompt', () => {
    renderHeader({ id_number: '90051400123', date_of_birth: '1990-05-14', gender: 'female' });
    expect(screen.queryByText(/File not complete/)).not.toBeInTheDocument();
    expect(screen.getByText('90051400123')).toBeInTheDocument();
  });
});
