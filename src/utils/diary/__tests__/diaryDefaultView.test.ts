import { describe, it, expect } from 'vitest';
import {
  ALL_PRACTITIONERS,
  bookingFormPractitioner,
  describeDiaryView,
  resolveDiaryView,
  roleDefaultView,
  sameDiaryView,
  savedDiaryView,
  toggleDiaryView
} from '../diaryDefaultView';

// An invented practice: two doctors, a nurse who treats, a receptionist and an administrator
const ACTIVE = ['dr-1', 'dr-2', 'nurse-1', 'rec-1', 'adm-1'];
const NAMES: Record<string, string> = { 'dr-1': 'Dr One', 'dr-2': 'Dr Two', 'nurse-1': 'Nurse One' };
const nameOf = (id: string) => NAMES[id] ?? 'Someone';

describe('roleDefaultView (the diary when nothing is saved)', () => {
  it("opens a doctor on their own column, not on colleagues' columns (the owner's rule)", () => {
    expect(roleDefaultView('doctor', 'dr-1')).toEqual(['dr-1']);
  });

  it('opens reception and administrators on every practitioner, so the front desk sees everyone who is booked', () => {
    expect(roleDefaultView('receptionist', 'rec-1')).toEqual(ALL_PRACTITIONERS);
    expect(roleDefaultView('admin', 'adm-1')).toEqual(ALL_PRACTITIONERS);
  });

  it('opens a nurse on everyone: nurses often work for several doctors (one who treats alone can save her own column)', () => {
    expect(roleDefaultView('nurse', 'nurse-1')).toEqual(ALL_PRACTITIONERS);
  });

  it('shows everyone while the signed-in user is not known yet, rather than an empty diary', () => {
    expect(roleDefaultView('doctor', '')).toEqual(ALL_PRACTITIONERS);
    expect(roleDefaultView(null, null)).toEqual(ALL_PRACTITIONERS);
  });
});

describe('resolveDiaryView (a saved default wins over the role)', () => {
  it('opens a doctor who covers a colleague on both columns once they save that', () => {
    expect(resolveDiaryView({ role: 'doctor', userId: 'dr-1', saved: ['dr-1', 'dr-2'], activeStaffIds: ACTIVE })).toEqual(['dr-1', 'dr-2']);
  });

  it('opens a receptionist who works for one doctor on that doctor once she saves it', () => {
    expect(resolveDiaryView({ role: 'receptionist', userId: 'rec-1', saved: ['dr-2'], activeStaffIds: ACTIVE })).toEqual(['dr-2']);
  });

  it('lets a doctor save "all practitioners" (an empty list) instead of their own column', () => {
    expect(resolveDiaryView({ role: 'doctor', userId: 'dr-1', saved: [], activeStaffIds: ACTIVE })).toEqual(ALL_PRACTITIONERS);
  });

  it('uses the role default when nothing is saved', () => {
    expect(resolveDiaryView({ role: 'doctor', userId: 'dr-1', saved: null, activeStaffIds: ACTIVE })).toEqual(['dr-1']);
    expect(resolveDiaryView({ role: 'receptionist', userId: 'rec-1', saved: undefined, activeStaffIds: ACTIVE })).toEqual(ALL_PRACTITIONERS);
  });

  it('drops a saved practitioner who left the practice, and falls back to the role default rather than an empty diary', () => {
    expect(resolveDiaryView({ role: 'receptionist', userId: 'rec-1', saved: ['dr-gone', 'dr-2'], activeStaffIds: ACTIVE })).toEqual(['dr-2']);
    expect(resolveDiaryView({ role: 'receptionist', userId: 'rec-1', saved: ['dr-gone'], activeStaffIds: ACTIVE })).toEqual(ALL_PRACTITIONERS);
    expect(resolveDiaryView({ role: 'doctor', userId: 'dr-1', saved: ['dr-gone'], activeStaffIds: ACTIVE })).toEqual(['dr-1']);
  });

  it('keeps the saved practitioners while the staff list is still loading, so the diary does not jump to the role default and back', () => {
    expect(resolveDiaryView({ role: 'doctor', userId: 'dr-1', saved: ['dr-2'], activeStaffIds: null })).toEqual(['dr-2']);
  });
});

describe('bookingFormPractitioner (who a new booking starts with)', () => {
  const optionIds = ['dr-1', 'dr-2', 'nurse-1'];

  it('starts with the column, slot or copied booking the form was opened from: reception clicked that practitioner', () => {
    expect(bookingFormPractitioner({ openedForId: 'dr-2', view: ['dr-1'], optionIds })).toBe('dr-2');
  });

  it('starts with the default practitioner when the default is one practitioner', () => {
    expect(bookingFormPractitioner({ openedForId: null, view: ['nurse-1'], optionIds })).toBe('nurse-1');
  });

  it('leaves the choice to reception when the default is several or all practitioners: it never guesses one of them', () => {
    expect(bookingFormPractitioner({ openedForId: null, view: ['dr-1', 'dr-2'], optionIds })).toBeNull();
    expect(bookingFormPractitioner({ openedForId: null, view: ALL_PRACTITIONERS, optionIds })).toBeNull();
  });

  it('chooses nobody until the default is known, and nobody who cannot be booked with', () => {
    expect(bookingFormPractitioner({ openedForId: undefined, view: null, optionIds })).toBeNull();
    expect(bookingFormPractitioner({ openedForId: undefined, view: ['rec-1'], optionIds })).toBeNull();
  });
});

describe('toggleDiaryView (the practitioner filter)', () => {
  const order = ['dr-1', 'dr-2', 'nurse-1'];

  it('narrows "all practitioners" to the one ticked', () => {
    expect(toggleDiaryView(ALL_PRACTITIONERS, 'dr-2', order)).toEqual(['dr-2']);
  });

  it('adds a second practitioner in column order, so the columns do not swap places', () => {
    expect(toggleDiaryView(['nurse-1'], 'dr-1', order)).toEqual(['dr-1', 'nurse-1']);
  });

  it('shows everyone again when the last practitioner is unticked, never an empty diary', () => {
    expect(toggleDiaryView(['dr-1'], 'dr-1', order)).toEqual(ALL_PRACTITIONERS);
  });

  it('"All practitioners" clears the choice', () => {
    expect(toggleDiaryView(['dr-1', 'dr-2'], null, order)).toEqual(ALL_PRACTITIONERS);
  });
});

describe('describing and comparing views', () => {
  it('names the view in plain words for the filter button and the "Open the diary on" choice', () => {
    expect(describeDiaryView(ALL_PRACTITIONERS, nameOf)).toBe('all practitioners');
    expect(describeDiaryView(['dr-1'], nameOf)).toBe('Dr One');
    expect(describeDiaryView(['dr-1', 'nurse-1'], nameOf)).toBe('Dr One and Nurse One');
    expect(describeDiaryView(['dr-1', 'dr-2', 'nurse-1'], nameOf)).toBe('3 practitioners');
  });

  it('treats the same practitioners in another order as the same view, so a saved default is recognised', () => {
    expect(sameDiaryView(['dr-2', 'dr-1'], ['dr-1', 'dr-2'])).toBe(true);
    expect(sameDiaryView(['dr-1'], ALL_PRACTITIONERS)).toBe(false);
    expect(sameDiaryView(['dr-1', 'dr-2'], ['dr-1', 'nurse-1'])).toBe(false);
  });
});

describe('savedDiaryView (users.diary_practitioner_ids as read)', () => {
  it('reads nothing saved as null, so the role default applies', () => {
    expect(savedDiaryView(null)).toBeNull();
    expect(savedDiaryView(undefined)).toBeNull();
  });

  it('reads an empty list as "all practitioners", which is a choice and not "nothing saved"', () => {
    expect(savedDiaryView([])).toEqual(ALL_PRACTITIONERS);
  });

  it('keeps the ids once each and ignores anything that is not an id', () => {
    expect(savedDiaryView(['dr-1', 'dr-1', 'dr-2'])).toEqual(['dr-1', 'dr-2']);
    expect(savedDiaryView(['dr-1', 7, ''])).toEqual(['dr-1']);
  });

  it('never turns a damaged list into "all practitioners"', () => {
    expect(savedDiaryView([7, null])).toBeNull();
    expect(savedDiaryView('dr-1')).toBeNull();
  });
});
