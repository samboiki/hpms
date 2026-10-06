import { describe, it, expect } from 'vitest';
import {
  buildMessageValues,
  describeMissingVariable,
  findUnknownVariables,
  renderListMessage
} from '../listMessages';
import type { PatientFacts } from '../listRules';

const TODAY = '2026-10-07';
const practice = { name: 'Eros Family Clinic', phone: '061 123 456' };

const facts = (overrides: Partial<PatientFacts> = {}): PatientFacts => ({
  patientId: 'p1',
  firstName: 'Maria',
  lastName: 'Shikongo',
  dateOfBirth: '1986-10-07',
  cellNumber: '081 123 4567',
  smsOptOut: false,
  lastCompletedVisitOn: '2026-03-03',
  lastCompletedByType: {},
  completedVisitsLastYear: 2,
  nextBookingOn: '2026-10-14',
  nextBookingTime: '09:30',
  lastNoShowOn: null,
  balanceDue: 1250,
  oldestUnpaidOn: '2026-08-01',
  ...overrides
});

const render = (template: string, patient = facts()) =>
  renderListMessage(template, buildMessageValues(patient, practice, TODAY));

describe('renderListMessage', () => {
  it('fills in the patient and practice details staff chose', () => {
    expect(render('Hi {{first_name}}, call {{practice_name}} on {{practice_phone}}.').text).toBe(
      'Hi Maria, call Eros Family Clinic on 061 123 456.'
    );
  });

  it('writes dates day-first and money in N$, as patients in Namibia read them', () => {
    expect(render('See you on {{appointment_date}} at {{appointment_time}}.').text).toBe(
      'See you on 14 October 2026 at 09:30.'
    );
    expect(render('Your balance is {{balance}}.').text).toBe('Your balance is N$ 1,250.00.');
  });

  it('gives the age the patient turns on their birthday', () => {
    expect(render('Happy {{age}}th birthday!').text).toBe('Happy 40th birthday!');
  });

  it('reports a detail the patient does not have instead of sending "see you on ."', () => {
    const result = render('See you on {{appointment_date}}.', facts({ nextBookingOn: null }));
    expect(result.missing).toEqual(['appointment_date']);
    expect(describeMissingVariable('appointment_date')).toBe('no upcoming appointment');
  });

  it('does not treat a balance of zero as something to tell the patient', () => {
    expect(render('You owe {{balance}}.', facts({ balanceDue: 0 })).missing).toEqual(['balance']);
  });

  it('reports a practice phone number that is not set up, rather than sending an empty number', () => {
    const values = buildMessageValues(facts(), { name: 'Eros Family Clinic', phone: '  ' }, TODAY);
    expect(renderListMessage('Call {{practice_phone}}', values).missing).toEqual(['practice_phone']);
  });
});

describe('findUnknownVariables', () => {
  it('catches a typo such as {{frist_name}} while the message is being written', () => {
    expect(findUnknownVariables('Hi {{frist_name}}, from {{practice_name}}')).toEqual(['frist_name']);
    expect(describeMissingVariable('frist_name')).toBe('{{frist_name}} is not a variable that can be filled in');
  });
});
