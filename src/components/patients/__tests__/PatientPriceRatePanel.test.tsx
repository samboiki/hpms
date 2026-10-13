/**
 * The patient's price rate on the patient file's Billing tab (parity R28). What matters to a practice: an administrator
 * or a practitioner sets a staff, private or contract rate in one place and is told in plain words what it does;
 * reception sees it but cannot change it (a standing discount is a pricing decision); a mistyped rate is never saved;
 * and before the database has rates nothing breaks. Invented ids only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
const auth = vi.hoisted(() => ({ role: 'admin' as string }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) => selector({ user: { role: auth.role } })
}));
const service = vi.hoisted(() => ({ loadPatientRate: vi.fn(), savePatientRate: vi.fn() }));
vi.mock('../../../services/patientRateService', () => service);

import PatientPriceRatePanel from '../PatientPriceRatePanel';

const renderPanel = () => render(<PatientPriceRatePanel practiceId="practice-1" patientId="patient-1" />);

beforeEach(() => {
  auth.role = 'admin';
  service.loadPatientRate.mockReset().mockResolvedValue({ status: 'ready', rate: null, setAt: null });
  service.savePatientRate.mockReset().mockResolvedValue(undefined);
});

describe("the patient's price rate", () => {
  it('lets an administrator set a staff rate, saying what it does, and shows it', async () => {
    renderPanel();
    expect(await screen.findByText('Usual prices')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: 'staff' } });
    fireEvent.change(screen.getByLabelText('% of the usual price'), { target: { value: '50' } });
    expect(screen.getByText(/billed at 50% of the usual price .* Medicines from stock are billed at the staff price/)).toBeInTheDocument();

    service.loadPatientRate.mockResolvedValue({ status: 'ready', rate: { kind: 'staff', percent: 50 }, setAt: '2026-10-13T08:00:00Z' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(service.savePatientRate).toHaveBeenCalledWith('practice-1', 'patient-1', { kind: 'staff', percent: 50 }));
    expect(await screen.findByText('Staff rate: 50% of the usual price')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent("Staff rate: 50% of the usual price. New lines on this patient's visits and quotes use it.");
    expect(screen.getByText(/Set on 13 Oct 2026/)).toBeInTheDocument();
  });

  // A typing slip (5% instead of 50%) must never reach the patient's bills
  it('never saves a rate outside 10% to 500%', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: 'contract' } });
    fireEvent.change(screen.getByLabelText('% of the usual price'), { target: { value: '5' } });
    expect(screen.getByRole('alert')).toHaveTextContent('A rate is from 10% to 500% of the usual price.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(service.savePatientRate).not.toHaveBeenCalled();
  });

  it('removes the rate when no rate is chosen', async () => {
    service.loadPatientRate.mockResolvedValue({ status: 'ready', rate: { kind: 'private', percent: 120 }, setAt: null });
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByLabelText('Rate'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(service.savePatientRate).toHaveBeenCalledWith('practice-1', 'patient-1', null));
  });

  // The database refuses it too (set_patient_price_rate): the screen does not offer what will be refused
  it('shows reception the rate without a way to change it', async () => {
    auth.role = 'receptionist';
    service.loadPatientRate.mockResolvedValue({ status: 'ready', rate: { kind: 'contract', percent: 90 }, setAt: null });
    renderPanel();
    expect(await screen.findByText('Contract rate: 90% of the usual price')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.getByText('A practice administrator or a practitioner can change it.')).toBeInTheDocument();
  });

  it('says when price rates are not set up yet, and when the rate cannot be read', async () => {
    service.loadPatientRate.mockResolvedValue({ status: 'not_set_up', rate: null, setAt: null });
    const { unmount } = renderPanel();
    expect(await screen.findByText(/Price rates are not set up in this database yet/)).toBeInTheDocument();
    unmount();

    service.loadPatientRate.mockResolvedValue({ status: 'error', rate: null, setAt: null, message: 'The connection was lost.' });
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('The connection was lost.');
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });
});
