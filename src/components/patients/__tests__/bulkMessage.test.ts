import { describe, it, expect } from 'vitest';
import { bulkSmsOutcome, bulkSmsSummary, personalizePatientMessage } from '../bulkMessage';

// Bulk SMS and email from the patient list go out to real patients. These tests pin down that
// each one gets their own name and nothing invented by the app.
describe('personalizePatientMessage', () => {
  it("puts each patient's own name into the message", () => {
    const text = 'Hi {{patientFirstName}}, this is {{practiceName}}. Dear {{patientName}} ({{patientLastName}}).';
    expect(personalizePatientMessage(text, { first_name: 'Ndapewa', last_name: 'Shilongo' }, 'Katutura Clinic')).toBe(
      'Hi Ndapewa, this is Katutura Clinic. Dear Ndapewa Shilongo (Shilongo).'
    );
  });

  it('never sends an invented discount, credit or fake review link to patients', () => {
    // These used to be filled with "15% off your next visit", "$50 credit", a made-up Google
    // review link and "Wellness Wednesday"
    const text = 'Enjoy {{birthdayOffer}} on your next visit. Refer a friend for {{referralBonus}}. Review us: {{reviewLink}} {{programName}}';
    const sent = personalizePatientMessage(text, { first_name: 'Ndapewa', last_name: 'Shilongo' }, 'Katutura Clinic');
    expect(sent).toBe('Enjoy on your next visit. Refer a friend for. Review us:');
    expect(sent).not.toMatch(/15%|\$50|g\.page|Wellness/);
  });

  it('drops a name variable when the record has no such name instead of using "John Smith"', () => {
    expect(personalizePatientMessage('Hi {{patientFirstName}}, your results are ready.', { first_name: '  ', last_name: 'Shilongo' })).toBe(
      'Hi, your results are ready.'
    );
    expect(personalizePatientMessage('Dear {{patientName}}', { first_name: null, last_name: null })).toBe('Dear');
  });

  it('drops the practice name when it is not known rather than writing "Your Practice"', () => {
    expect(personalizePatientMessage('From {{practiceName}}', { first_name: 'A', last_name: 'B' }, '')).toBe('From');
    expect(personalizePatientMessage('From {{practiceName}}', { first_name: 'A', last_name: 'B' })).toBe('From');
  });

  it('leaves a message without variables exactly as typed', () => {
    const text = 'The clinic is closed on Friday.\nPlease call  061 123 456.';
    expect(personalizePatientMessage(text, { first_name: 'A', last_name: 'B' }, 'Clinic')).toBe(text);
  });
});

// A message to many patients: a patient who replied STOP is skipped on purpose and a used-up SMS bundle stops the
// rest. Counting either as "failed" sent staff looking for a fault that was not there.
describe('bulkSmsOutcome and bulkSmsSummary', () => {
  it('tells a STOP skip and a used-up bundle apart from a failed send', () => {
    expect(bulkSmsOutcome({ success: true })).toBe('sent');
    expect(bulkSmsOutcome({ success: false, error: 'Not sent: this patient replied STOP to opt out of non-essential SMS.' })).toBe('opted_out');
    expect(bulkSmsOutcome({ success: false, error: 'SMS_LIMIT_REACHED' })).toBe('limit_reached');
    expect(bulkSmsOutcome({ success: false, error: 'Gateway timeout' })).toBe('failed');
  });

  it('says how many were skipped and not tried, in plain words', () => {
    expect(bulkSmsSummary({ sent: 3, optedOut: 1, failed: 0, notTried: 2 })).toEqual({
      tone: 'warning',
      text: 'SMS sent to 3 patients; 1 patient replied STOP and was skipped; the SMS limit was reached, so 2 patients were not sent one.'
    });
    expect(bulkSmsSummary({ sent: 2, optedOut: 0, failed: 0, notTried: 0 })).toEqual({ tone: 'success', text: 'SMS sent to 2 patients.' });
    expect(bulkSmsSummary({ sent: 0, optedOut: 0, failed: 1, notTried: 0 }).tone).toBe('error');
  });
});
