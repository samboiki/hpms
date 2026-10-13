import { describe, expect, it } from 'vitest';
import { decideSessionKind, identityOfAuthUser, isPhoneOnlyIdentity, PATIENT_APP_PATH, redirectForSession } from '../portalRouting';

const patient = { email: null, phone: '264811234567' };
const staff = { email: 'sister@clinic.na', phone: null };

describe('staff app or patient app after sign-in', () => {
  it('a staff profile always means the staff app', () => {
    expect(decideSessionKind(staff, 'found')).toBe('staff');
    // Even a staff login that also has a phone number keeps the staff app
    expect(decideSessionKind({ email: 'dr@clinic.na', phone: '264811234567' }, 'found')).toBe('staff');
  });

  it('a cell-number login without a staff profile is a patient, so the staff app never renders for it', () => {
    expect(decideSessionKind(patient, 'not_found')).toBe('patient');
    // A failed profile lookup must not turn a patient into staff either
    expect(decideSessionKind(patient, 'error')).toBe('patient');
    expect(isPhoneOnlyIdentity({ email: '', phone: '264811234567' })).toBe(true);
  });

  it('a patient who later adds an email address to their login is still a patient', () => {
    // The sign-up provider cannot be changed by the user; an email address can
    const addedEmail = { email: 'me@example.com', phone: '264811234567', provider: 'phone' };
    expect(decideSessionKind(addedEmail, 'not_found')).toBe('patient');
    expect(
      identityOfAuthUser({ email: 'me@example.com', phone: '264811234567', app_metadata: { provider: 'phone' } })
    ).toEqual(addedEmail);
  });

  it('an email login whose profile could not be read keeps the staff app\'s existing fallback', () => {
    expect(decideSessionKind(staff, 'not_found')).toBe('staff');
    expect(decideSessionKind(staff, 'error')).toBe('staff');
  });

  it('a login with neither email nor phone gets the sign-in screen', () => {
    expect(decideSessionKind({ email: null, phone: null }, 'not_found')).toBeNull();
    expect(decideSessionKind(null, 'not_found')).toBeNull();
  });
});

describe('route guard', () => {
  it('patients can never reach a staff screen: every other address goes to the patient app', () => {
    for (const path of ['/', '/patients', '/finance', '/settings', '/admin/practices', '/login', '/media']) {
      expect(redirectForSession('patient', path)).toBe(PATIENT_APP_PATH);
    }
    expect(redirectForSession('patient', '/me')).toBeNull();
    expect(redirectForSession('patient', '/me/results')).toBeNull();
  });

  it('staff are sent from the patient app back to their own app', () => {
    expect(redirectForSession('staff', '/me')).toBe('/');
    expect(redirectForSession('staff', '/me/invoices')).toBe('/');
    expect(redirectForSession('staff', '/patients')).toBeNull();
  });
});
