import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const { sendSMS } = vi.hoisted(() => ({ sendSMS: vi.fn() }));

// No gateway, database or icon CDN in unit tests
vi.mock('../../../services/communicationService', () => ({
  communicationService: { sendSMS },
  getCommunicationErrorMessage: (_channel: string, error?: string) =>
    error === 'SMS_LIMIT_REACHED' ? 'SMS limit reached for this billing period.' : error || 'Failed to send SMS'
}));
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import VideoConsultModal from '../VideoConsultModal';
import PatientContactActions from '../../patients/PatientContactActions';

const PRACTICE_ID = '1a2b3c4d-0000-4000-8000-000000000000';
const patient = { id: 'patient-1', firstName: 'Maria', lastName: 'Shikongo', cellNumber: '081 123 4567' };

const renderModal = (overrides: Partial<React.ComponentProps<typeof VideoConsultModal>> = {}) =>
  render(
    <VideoConsultModal
      isOpen
      onClose={() => {}}
      patient={patient}
      practiceId={PRACTICE_ID}
      practiceName="Kalahari Medical"
      clinicianName="Dr. Hilma Amalwa"
      {...overrides}
    />
  );

const roomLink = () => (screen.getByLabelText('Patient link') as HTMLInputElement).value;

beforeEach(() => {
  sendSMS.mockReset();
});

// Texting a patient costs credits and reaches a real phone. The link must only go out after the
// clinician has seen exactly which number gets which text, and only through the SMS gateway.
describe('VideoConsultModal SMS invite', () => {
  it('sends nothing until the clinician confirms the exact number and message', async () => {
    sendSMS.mockResolvedValue({ success: true, logId: 'log-1', status: 'sent' });
    renderModal({ patient: { ...patient, id: 'patient-confirm' }, visitId: 'visit-9' });

    const link = roomLink();
    expect(link).toMatch(/^https:\/\/meet\.jit\.si\/hpms-1a2b3c4d-[a-z2-7]{26}$/);

    fireEvent.click(screen.getByRole('button', { name: /send link to patient by sms/i }));
    expect(sendSMS).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('+264 81 123 4567')).toBeInTheDocument();
    const expectedMessage = `Hi Maria, Dr. Hilma Amalwa from Kalahari Medical is ready for your video consultation. Join: ${link}`;
    expect(within(dialog).getByText(expectedMessage)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^send sms$/i }));
    await waitFor(() => expect(screen.getByText(/SMS sent to \+264 81 123 4567/)).toBeInTheDocument());

    expect(sendSMS).toHaveBeenCalledTimes(1);
    expect(sendSMS).toHaveBeenCalledWith({
      practiceId: PRACTICE_ID,
      recipientPhone: '+264811234567',
      messageContent: expectedMessage,
      messageType: 'custom',
      patientId: 'patient-confirm',
      visitId: 'visit-9',
      tags: ['telemedicine_invite']
    });
  });

  it('can be cancelled from the confirmation without sending', () => {
    renderModal({ patient: { ...patient, id: 'patient-cancel' } });
    fireEvent.click(screen.getByRole('button', { name: /send link to patient by sms/i }));
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByLabelText('Patient link')).toBeInTheDocument();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('shows the gateway error and offers to try again', async () => {
    sendSMS.mockResolvedValue({ success: false, logId: '', status: 'blocked', error: 'SMS_LIMIT_REACHED' });
    renderModal({ patient: { ...patient, id: 'patient-limit' } });
    fireEvent.click(screen.getByRole('button', { name: /send link to patient by sms/i }));
    fireEvent.click(screen.getByRole('button', { name: /^send sms$/i }));

    expect(await screen.findByText('SMS limit reached for this billing period.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeEnabled();
  });

  it('disables the SMS option with the reason when the patient has no usable cell number', () => {
    renderModal({ patient: { ...patient, id: 'patient-no-cell', cellNumber: null } });
    const button = screen.getByRole('button', { name: /send link to patient by sms/i });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAttribute('title', 'No cell number on file for this patient');
  });

  it('keeps the same private link when reopened for the same patient, so a sent link stays valid', () => {
    const { rerender } = renderModal({ patient: { ...patient, id: 'patient-reopen' } });
    const first = roomLink();
    const props = { onClose: () => {}, patient: { ...patient, id: 'patient-reopen' }, practiceId: PRACTICE_ID };
    rerender(<VideoConsultModal {...props} isOpen={false} />);
    rerender(<VideoConsultModal {...props} isOpen />);
    expect(roomLink()).toBe(first);
  });

  it('gives each patient their own room', () => {
    const { unmount } = renderModal({ patient: { ...patient, id: 'patient-a' } });
    const linkA = roomLink();
    unmount();
    renderModal({ patient: { ...patient, id: 'patient-b' } });
    expect(roomLink()).not.toBe(linkA);
  });
});

describe('PatientContactActions call button', () => {
  it('dials the normalised number from the patient file', () => {
    render(<PatientContactActions patient={{ id: 'p', first_name: 'Maria', last_name: 'S', cell_number: '081 123 4567' }} />);
    expect(screen.getByRole('link', { name: /call/i })).toHaveAttribute('href', 'tel:+264811234567');
  });

  it('is disabled with the reason when there is no cell number', () => {
    render(<PatientContactActions patient={{ id: 'p', first_name: 'Maria', last_name: 'S', cell_number: '' }} />);
    const button = screen.getByRole('button', { name: /call unavailable/i });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAttribute('title', 'No cell number on file. Add one with Edit.');
  });
});
