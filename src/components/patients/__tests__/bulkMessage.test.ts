import { describe, it, expect } from 'vitest';
import { personalizePatientMessage } from '../bulkMessage';

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
