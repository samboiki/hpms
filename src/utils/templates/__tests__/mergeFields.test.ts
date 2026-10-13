import { describe, expect, it } from 'vitest';
import { REMINDER_PLACEHOLDERS } from '../../../../supabase/functions/_shared/appointmentReminders';
import {
  MERGE_FIELDS,
  appointmentMergeValues,
  blankMissingFields,
  fieldsFor,
  fieldsIn,
  mergeTemplate,
  patientMergeValues,
  practiceMergeValues,
  sampleMergeValues,
  sickNoteMergeValues,
  singleBraceSlips,
  unknownFields
} from '../mergeFields';

// Invented patient and practice
const patient = {
  title: 'Mrs',
  initials: null,
  firstName: 'Ndapewa Maria',
  lastName: 'Shilongo',
  idNumber: '90051400123',
  dateOfBirth: '1990-05-14',
  postalAddress: 'PO Box 1',
  postalCode: '9000',
  homeAddress: '1 Example Street'
};

describe('one set of merge fields for letters, SMS and email', () => {
  // The diary reminders and automations fill these names; a template editor offering other names for the same thing
  // would teach staff two vocabularies and break their saved texts
  it('includes every field the diary reminders and automations already fill, under the same name', () => {
    const names = MERGE_FIELDS.map(field => field.name as string);
    for (const placeholder of REMINDER_PLACEHOLDERS) expect(names).toContain(placeholder.name);
  });

  it('offers SMS and email only the fields the patient file can fill, and letters every field', () => {
    const message = fieldsFor('message').map(field => field.name);
    expect(message).toContain('patientName');
    expect(message).toContain('appointmentDate');
    // A diagnosis or ID number never goes into an SMS
    expect(message).not.toContain('diagnosis');
    expect(message).not.toContain('patientIdNumber');
    expect(fieldsFor('letter')).toHaveLength(MERGE_FIELDS.length);
  });
});

describe('mergeTemplate', () => {
  it("fills the practice's saved SMS templates as before: {{patientName}}, {{practiceName}}, {{appointmentDate}}", () => {
    const result = mergeTemplate('{{practiceName}}: {{patientName}}, see you on {{appointmentDate}} at {{appointmentTime}}.', {
      practiceName: 'Example Family Practice',
      patientName: 'Ndapewa Shilongo',
      appointmentDate: '20 October 2026',
      appointmentTime: '09:30'
    });
    expect(result).toEqual({ text: 'Example Family Practice: Ndapewa Shilongo, see you on 20 October 2026 at 09:30.', missing: [] });
  });

  it('never fills a field without a value with a blank: it stays visible and is listed, so a person fills it in', () => {
    const result = mergeTemplate('Unfit for {{daysOff}}. Diagnosis: {{diagnosis}}.', { daysOff: '3 days', diagnosis: null });
    expect(result.text).toBe('Unfit for 3 days. Diagnosis: {{diagnosis}}.');
    expect(result.missing).toEqual(['diagnosis']);
  });

  it('fills the older name {{doctorName}} as the practitioner, as the reminders do', () => {
    expect(mergeTemplate('Seen by {{doctorName}}', { practitionerName: 'Dr A Example' }).text).toBe('Seen by Dr A Example');
  });
});

describe('checking a template before it is saved', () => {
  it('finds typos and fields a message cannot fill, each once', () => {
    expect(unknownFields('Hi {{patientNmae}} {{patientNmae}}, ID {{patientIdNumber}}', 'message')).toEqual(['patientNmae', 'patientIdNumber']);
    expect(unknownFields('Hi {{patientName}}, ID {{patientIdNumber}}', 'letter')).toEqual([]);
  });

  it('spots fields typed with one brace, which would print as typed', () => {
    expect(singleBraceSlips('Dear {patientName}, {{practiceName}} {not a field}')).toEqual(['{patientName}']);
  });

  it('lists the fields a text uses in order', () => {
    expect(fieldsIn('{{today}} {{patientName}} {{today}} {{doctorName}}')).toEqual(['today', 'patientName', 'practitionerName']);
  });
});

describe('blankMissingFields (the printed sick note only: nobody can be asked there)', () => {
  it('takes out an empty field and tidies the brackets and spaces around it', () => {
    expect(blankMissingFields('Unfit for work ({{daysOff}}). Seen on {{visitDate}} .')).toBe('Unfit for work. Seen on.');
  });

  it('drops a bracketed aside whose field is empty, so a file without an ID number never prints "(ID )"', () => {
    expect(blankMissingFields('Maria Shikongo (ID {{patientIdNumber}}) was examined.')).toBe('Maria Shikongo was examined.');
  });
});

describe('the values of the fields', () => {
  it("reads the patient's names, formal name, ID, birthday, age and postal address from the file", () => {
    const values = patientMergeValues(patient, '2026-10-12');
    expect(values).toMatchObject({
      patientTitle: 'Mrs',
      patientFirstName: 'Ndapewa Maria',
      patientName: 'Ndapewa Maria Shilongo',
      patientFormalName: 'Mrs N M Shilongo',
      patientIdNumber: '90051400123',
      patientDateOfBirth: '14 May 1990',
      patientAge: '36',
      patientAddress: 'PO Box 1 9000'
    });
  });

  it('never prints the temporary ID or placeholder birthday of a file opened with a name and cell number only', () => {
    const values = patientMergeValues({ ...patient, idNumber: 'TEMP-1760000000000', dateOfBirth: '1990-01-01' }, '2026-10-12');
    expect(values.patientIdNumber).toBeNull();
    expect(values.patientDateOfBirth).toBeNull();
    expect(values.patientAge).toBeNull();
  });

  // The town picker keeps the town in its own field: without it a label or letter to "PO Box 1 9000" has no town
  it('puts the town from the town picker on the address, once', () => {
    expect(patientMergeValues({ ...patient, town: 'Windhoek' }, '2026-10-12').patientAddress).toBe('PO Box 1, Windhoek 9000');
    expect(patientMergeValues({ ...patient, postalAddress: 'PO Box 1, Windhoek', town: 'Windhoek' }, '2026-10-12').patientAddress).toBe(
      'PO Box 1, Windhoek 9000'
    );
    expect(patientMergeValues({ ...patient, postalAddress: null, homeAddress: '12 Main Street', town: 'Oshakati' }, '2026-10-12').patientAddress).toBe(
      '12 Main Street, Oshakati'
    );
    // A town alone is not an address
    expect(patientMergeValues({ ...patient, postalAddress: null, homeAddress: null, town: 'Rundu' }, '2026-10-12').patientAddress).toBeNull();
  });

  it('addresses a file without a title or initials by its full name', () => {
    expect(patientMergeValues({ ...patient, title: null }, '2026-10-12').patientFormalName).toBe('Ndapewa Maria Shilongo');
  });

  it('counts a sick note inclusively and gives the day back, as the built-in sick note does', () => {
    expect(sickNoteMergeValues({ fromDate: '2026-10-06', toDate: '2026-10-08', formNumber: '0042' })).toEqual({
      sickNoteFrom: '6 October 2026',
      sickNoteTo: '8 October 2026',
      daysOff: '3 days',
      returnDate: '9 October 2026',
      sickNoteNumber: '0042'
    });
    expect(sickNoteMergeValues({ fromDate: '2026-10-06', toDate: '2026-10-06' }).daysOff).toBe('1 day');
    expect(sickNoteMergeValues({ fromDate: '2026-10-08', toDate: '2026-10-06' })).toEqual({});
  });

  it('gives an appointment time only with its date, and the last visit day first', () => {
    expect(appointmentMergeValues({ nextBookingOn: '2026-10-20', nextBookingTime: '09:30', lastCompletedVisitOn: '2026-03-03' })).toEqual({
      appointmentDate: '20 October 2026',
      appointmentTime: '09:30',
      lastVisitDate: '3 March 2026'
    });
    expect(appointmentMergeValues({ nextBookingOn: null, nextBookingTime: '09:30' }).appointmentTime).toBeNull();
  });

  // {{videoLink}} goes to the patient: only the next booking's own secure room, and nothing a caller never looked up
  it("fills the video link only from the next booking's own secure room link", () => {
    const next = { nextBookingOn: '2026-10-20', nextBookingTime: '09:30' };
    expect(appointmentMergeValues({ ...next, nextBookingVideoLink: 'https://meet.jit.si/hpms-invented-room' }).videoLink).toBe(
      'https://meet.jit.si/hpms-invented-room'
    );
    expect(appointmentMergeValues({ ...next, nextBookingVideoLink: 'http://meet.example.com/room' }).videoLink).toBeNull();
    expect(appointmentMergeValues({ nextBookingOn: null, nextBookingVideoLink: 'https://meet.jit.si/hpms-invented-room' }).videoLink).toBeNull();
    expect('videoLink' in appointmentMergeValues(next)).toBe(false);
  });

  it("joins the practice's address and town", () => {
    expect(practiceMergeValues({ name: 'Example Family Practice', address: '1 Example Street', city: 'Windhoek' }).practiceAddress).toBe(
      '1 Example Street, Windhoek'
    );
  });

  it('previews with invented values, the practice its own name where it is known', () => {
    const sample = sampleMergeValues({ practiceName: 'Example Family Practice', practicePhone: null });
    expect(sample.patientName).toBe('Maria Shikongo');
    expect(sample.practiceName).toBe('Example Family Practice');
    expect(sample.practicePhone).toBe('061 123 456');
  });
});
