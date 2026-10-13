import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

// All numbers are invented
vi.mock('@iconify/react', () => ({ Icon: () => null }));
const services = vi.hoisted(() => ({ loadPatientFileNumbers: vi.fn(), hasLegacyClaimHistory: vi.fn() }));
vi.mock('../../../services/patientFileService', () => ({ loadPatientFileNumbers: services.loadPatientFileNumbers }));
vi.mock('../../../services/import/eminanceImportService', () => ({ hasLegacyClaimHistory: services.hasLegacyClaimHistory }));
vi.mock('../../import/EminanceClaimHistoryDialog', () => ({ EminanceClaimHistoryDialog: () => <div>Claim history dialog</div> }));

import { PatientFileNumbers } from '../PatientFileNumbers';
import { PATIENT_FILE_NUMBERS_CHANGED } from '../../../utils/patients/patientNumbers';

afterEach(() => cleanup());
beforeEach(() => {
  services.loadPatientFileNumbers.mockReset().mockResolvedValue({ reference: 1234, oldFileNumber: '0004321', oldFileNumberAvailable: true });
  services.hasLegacyClaimHistory.mockReset().mockResolvedValue(false);
});

// Patients quote their OneHealth reference (on statements and claims) or the number of their old file: reception
// sees both on the file, without opening anything.
describe('PatientFileNumbers', () => {
  it("shows the file's OneHealth reference and old file number", async () => {
    render(<PatientFileNumbers patientId="patient-1" />);
    expect(await screen.findByText('1234')).toBeInTheDocument();
    expect(screen.getByText(/OneHealth ref/)).toBeInTheDocument();
    expect(screen.getByText('0004321')).toBeInTheDocument();
    expect(services.loadPatientFileNumbers).toHaveBeenCalledWith('patient-1');
  });

  it('offers the Eminance claim history only to a patient brought over with one', async () => {
    render(<PatientFileNumbers patientId="patient-1" />);
    await screen.findByText('1234');
    expect(screen.queryByRole('button', { name: 'Eminance claim history' })).not.toBeInTheDocument();
    cleanup();
    services.hasLegacyClaimHistory.mockResolvedValue(true);
    render(<PatientFileNumbers patientId="patient-1" />);
    (await screen.findByRole('button', { name: 'Eminance claim history' })).click();
    expect(await screen.findByText('Claim history dialog')).toBeInTheDocument();
  });

  it('shows the new old file number as soon as the edit form saves it', async () => {
    render(<PatientFileNumbers patientId="patient-1" />);
    await screen.findByText('0004321');
    services.loadPatientFileNumbers.mockResolvedValue({ reference: 1234, oldFileNumber: 'A-77', oldFileNumberAvailable: true });
    // Another patient's save changes nothing here
    act(() => { window.dispatchEvent(new CustomEvent(PATIENT_FILE_NUMBERS_CHANGED, { detail: 'patient-2' })); });
    expect(services.loadPatientFileNumbers).toHaveBeenCalledTimes(1);
    act(() => { window.dispatchEvent(new CustomEvent(PATIENT_FILE_NUMBERS_CHANGED, { detail: 'patient-1' })); });
    expect(await screen.findByText('A-77')).toBeInTheDocument();
  });

  it('shows nothing when the numbers cannot be read (the header works without them)', async () => {
    services.loadPatientFileNumbers.mockRejectedValue(new Error('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<PatientFileNumbers patientId="patient-1" />);
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    warn.mockRestore();
  });
});
