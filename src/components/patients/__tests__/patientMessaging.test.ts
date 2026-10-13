import { describe, it, expect } from 'vitest';
import { getSingleRecipient, SEND_FAILED, SENT_ONE } from '../patientMessaging';

// ProfessionalSmsModal and ProfessionalEmailModal pass recipient objects to onSend. The patient
// file read that argument as a bare phone number or address, so it sent an array to the gateway
// and nothing from the patient header was ever delivered.
describe('getSingleRecipient', () => {
  const patient = { id: 'p1', first_name: 'Jane', last_name: 'Doe', cell_number: ' +264811234567 ', email: 'jane@example.com' };

  it('sends the SMS to the number the modal passes in, not to the recipient object', () => {
    expect(getSingleRecipient([patient], 'sms')).toEqual({ name: 'Jane Doe', contact: '+264811234567' });
  });

  it('sends the email to the address the modal passes in', () => {
    expect(getSingleRecipient([patient], 'email')).toEqual({ name: 'Jane Doe', contact: 'jane@example.com' });
  });

  it('names the next of kin, not the patient, when the SMS goes to the next of kin', () => {
    // The SMS modal passes the next of kin as first_name with an empty last_name
    const nextOfKin = { id: 'p1', first_name: 'Maria Doe', last_name: '', cell_number: '+264817654321' };
    expect(getSingleRecipient([nextOfKin], 'sms')).toEqual({ name: 'Maria Doe', contact: '+264817654321' });
  });

  it('refuses to send when there is no number or address, so the modal stays open', () => {
    expect(getSingleRecipient([{ ...patient, cell_number: '  ' }], 'sms')).toBeNull();
    expect(getSingleRecipient([{ ...patient, email: null }], 'email')).toBeNull();
    expect(getSingleRecipient([], 'sms')).toBeNull();
    expect(getSingleRecipient(undefined, 'email')).toBeNull();
  });
});

describe('send outcomes', () => {
  it('only reports success when the message went out, because the modals close on success', () => {
    expect(SENT_ONE).toEqual({ success: true, successCount: 1, failureCount: 0 });
    expect(SEND_FAILED.success).toBe(false);
  });
});
