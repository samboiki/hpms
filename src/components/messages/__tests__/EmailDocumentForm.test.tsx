/**
 * P6: emailing a document. Who pays gets it by default (the account holder), staff can pick the patient with one tap
 * and change the message, and nothing is sent until Send. No real gateway or database in tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const recipients = vi.hoisted(() => ({ loadDocumentRecipients: vi.fn() }));
vi.mock('../../../services/documentEmailService', () => recipients);
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { EmailDocumentForm } from '../EmailDocumentForm';

const facts = { kind: 'invoice' as const, number: 'INV-0042', practiceName: 'Example Family Practice', practicePhone: '061 000 000', amount: 'N$ 450.00', date: null };

afterEach(() => cleanup());
beforeEach(() => {
  recipients.loadDocumentRecipients.mockReset();
  recipients.loadDocumentRecipients.mockResolvedValue([
    { who: 'account_holder', name: 'Mrs M Testing', email: 'maria@example.test' },
    { who: 'patient', name: 'Kim Testing', email: 'kim@example.test' }
  ]);
});

const renderForm = (send = vi.fn().mockResolvedValue({ ok: true, message: 'Emailed.' }), onSent = vi.fn()) => {
  render(
    <EmailDocumentForm practiceId="practice-1" patientId="patient-1" facts={facts} attachmentName="invoice-INV-0042.pdf" send={send} onSent={onSent} onCancel={vi.fn()} />
  );
  return { send, onSent };
};

describe('EmailDocumentForm', () => {
  it('addresses the account holder by default, with the invoice named and attached', async () => {
    renderForm();
    await waitFor(() => expect(screen.getByLabelText('Send to')).toHaveValue('maria@example.test'));
    expect(screen.getByLabelText('Subject')).toHaveValue('Invoice INV-0042 from Example Family Practice');
    expect(screen.getByLabelText('Message')).toHaveValue(
      'Dear Mrs M Testing,\n\nPlease find invoice INV-0042 for N$ 450.00 attached.\n\nIf you have any questions, please contact us on 061 000 000.\n\nKind regards,\nExample Family Practice'
    );
    expect(screen.getByText('invoice-INV-0042.pdf')).toBeInTheDocument();
  });

  it('switches to the patient with one tap, greeting them, unless staff already changed the message', async () => {
    renderForm();
    await waitFor(() => expect(screen.getByLabelText('Send to')).toHaveValue('maria@example.test'));
    fireEvent.click(screen.getByRole('button', { name: /Patient: Kim Testing/ }));
    expect(screen.getByLabelText('Send to')).toHaveValue('kim@example.test');
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value.startsWith('Dear Kim Testing,')).toBe(true);

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'My own words.' } });
    fireEvent.click(screen.getByRole('button', { name: /Account holder: Mrs M Testing/ }));
    expect(screen.getByLabelText('Message')).toHaveValue('My own words.');
  });

  it('sends what staff checked, only when they press Send', async () => {
    const { send, onSent } = renderForm();
    await waitFor(() => expect(screen.getByLabelText('Send to')).toHaveValue('maria@example.test'));
    expect(send).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Your invoice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'maria@example.test', recipientName: 'Mrs M Testing', subject: 'Your invoice' });
    await waitFor(() => expect(onSent).toHaveBeenCalledWith('maria@example.test'));
  });

  it('lets staff type an address when none is on file, and will not send to an incomplete one', async () => {
    recipients.loadDocumentRecipients.mockResolvedValue([]);
    const { send } = renderForm();
    expect(await screen.findByText(/No email address on the patient file/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Send to'), { target: { value: 'kim@' } });
    expect(screen.getByRole('button', { name: 'Send email' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Send to'), { target: { value: 'kim@example.test' } });
    expect(screen.getByRole('button', { name: 'Send email' })).toBeEnabled();
    expect(send).not.toHaveBeenCalled();
  });
});
