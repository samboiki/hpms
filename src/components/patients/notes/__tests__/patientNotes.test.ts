import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAFF_ROLE_LABELS } from '../../../settings/UserManagement/staffUtils';
import type { ContactNote } from '../../../../services/ledger/creditControl';
import {
  buildNoteList,
  canEditNote,
  defaultLockFor,
  defaultNoteType,
  dueFollowUps,
  dueForMeCount,
  followUpCandidates,
  followUpStatus,
  headerFor,
  noteCounts,
  noteDraftProblem,
  noteLink,
  noteTypesFor,
  type DueFollowUp,
  type NoteDraft,
  type PatientNote
} from '../patientNotes';

const TODAY = '2026-10-09';

const note = (overrides: Partial<PatientNote> = {}): PatientNote => ({
  id: 'n1',
  patientId: 'p1',
  type: 'general',
  header: 'Header',
  body: 'Text',
  followUpOn: null,
  followUpUserId: null,
  followUpDoneAt: null,
  followUpDoneBy: null,
  lockedAt: null,
  lockedBy: null,
  createdBy: 'u1',
  createdAt: '2026-10-08T08:00:00+00:00',
  editedBy: null,
  editedAt: null,
  addenda: [],
  ...overrides
});

const draft = (overrides: Partial<NoteDraft> = {}): NoteDraft => ({
  type: 'general',
  header: '',
  body: 'Called the patient about the next booking',
  followUpOn: '',
  followUpUserId: null,
  lock: false,
  ...overrides
});

describe('who reads and writes which kind of note', () => {
  // Clinical notes are clinical records: every clinician reads them, nobody else does
  it('gives clinical notes to doctors and nurses', () => {
    expect(noteTypesFor({ role: 'doctor' })).toContain('clinical');
    expect(noteTypesFor({ role: 'nurse' })).toContain('clinical');
  });

  // In small Namibian practices the owner-practitioner is usually the administrator: their registration number, not
  // their role, makes them a clinician, so they read their own clinical notes
  it('gives clinical notes to an administrator with a practitioner registration number', () => {
    expect(noteTypesFor({ role: 'admin', hpcsa_number: 'MP 12345' })).toEqual(['clinical', 'account', 'contact', 'general']);
  });

  // Reception and administrators who are not practitioners must never read clinical notes; a blank number is no number
  it('keeps clinical notes from non-clinical staff without a registration number', () => {
    expect(noteTypesFor({ role: 'admin' })).not.toContain('clinical');
    expect(noteTypesFor({ role: 'admin', hpcsa_number: '   ' })).not.toContain('clinical');
    expect(noteTypesFor({ role: 'receptionist', hpcsa_number: null })).not.toContain('clinical');
  });

  // Account notes follow billing rights, so the front desk that takes payments sees the payment arrangement
  it('gives account notes to everyone with billing rights, and calls and general notes to all staff', () => {
    expect(noteTypesFor({ role: 'receptionist' })).toEqual(['account', 'contact', 'general']);
    expect(noteTypesFor({ role: 'Admin ' })).toEqual(['account', 'contact', 'general']);
  });

  // A switched-off account or an unknown role reads nothing, even with a number (the database answers the same)
  it('gives nothing to a switched-off account or an unknown role', () => {
    expect(noteTypesFor({ role: 'doctor', is_active: false })).toEqual([]);
    expect(noteTypesFor({ role: 'admin', hpcsa_number: 'MP 12345', is_active: false })).toEqual([]);
    expect(noteTypesFor({ role: 'patient', hpcsa_number: 'MP 12345' })).toEqual([]);
    expect(noteTypesFor(null)).toEqual([]);
  });

  // If the screen and the database disagreed, staff would see buttons that fail, or miss notes they may read: every
  // staff role, with and without a registration number, gets the same kinds from patient_note_types_for_staff
  it('matches the database rule (patient_note_types_for_staff) for every role, with and without a number', () => {
    const sql = readFileSync('proposals/2026-10-08-patient-notes-practitioners.sql', 'utf8');
    const fn = /FUNCTION public\.patient_note_types_for_staff\(p_role text, p_registration_number text\)[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(sql)?.[1] ?? '';
    const shape = /WHEN p_role IN \(([^)]*)\) THEN\s*CASE\s*WHEN p_role IN \(([^)]*)\) OR btrim\(COALESCE\(p_registration_number, ''\)\) <> ''\s*THEN ARRAY\[([^\]]*)\]\s*ELSE ARRAY\[([^\]]*)\]/.exec(fn);
    expect(shape).not.toBeNull();
    const list = (text: string) => [...text.matchAll(/'(\w+)'/g)].map(match => match[1]);
    const [staffRoles, clinicalRoles, withClinical, withoutClinical] = (shape ?? []).slice(1).map(list);
    expect(staffRoles.sort()).toEqual(Object.keys(STAFF_ROLE_LABELS).sort());
    for (const role of [...staffRoles, 'patient']) {
      for (const hpcsa_number of [null, 'MP 12345']) {
        const fromSql = !staffRoles.includes(role) ? [] : clinicalRoles.includes(role) || hpcsa_number ? withClinical : withoutClinical;
        expect(noteTypesFor({ role, hpcsa_number })).toEqual(fromSql);
      }
    }
  });

  // A follow-up given to someone who cannot open the note would sit unseen on nobody's list; an owner-practitioner
  // who is the administrator can be asked to follow up a clinical note
  it('offers only staff who can open the note to follow it up', () => {
    const staff = [
      { id: 'r', full_name: 'Rita Reception', role: 'receptionist', is_active: true },
      { id: 'd', full_name: 'Anna Shikongo', role: 'doctor', is_active: true },
      { id: 'n', full_name: 'Ben Nurse', role: 'nurse', is_active: false },
      { id: 'o', full_name: 'Owner Practitioner', role: 'admin', is_active: true, hpcsa_number: 'MP 12345' },
      { id: 'm', full_name: 'Office Manager', role: 'admin', is_active: true, hpcsa_number: null }
    ];
    expect(followUpCandidates(staff, 'clinical').map(member => member.id)).toEqual(['d', 'o']);
    expect(followUpCandidates(staff, 'account').map(member => member.id)).toEqual(['d', 'm', 'o', 'r']);
  });
});

describe('writing a note in seconds', () => {
  // Practitioners mostly write clinical notes, reception mostly general ones: the first choice is the likely one
  it('starts as clinical for clinicians and general for everyone else', () => {
    expect(defaultNoteType(noteTypesFor({ role: 'nurse' }))).toBe('clinical');
    expect(defaultNoteType(noteTypesFor({ role: 'receptionist' }))).toBe('general');
  });

  // A clinical record is not rewritten after the fact: clinical notes start locked, other notes stay editable
  it('locks clinical notes by default only', () => {
    expect(defaultLockFor('clinical')).toBe(true);
    expect(defaultLockFor('account')).toBe(false);
    expect(defaultLockFor('contact')).toBe(false);
  });

  // The header is optional to type: the start of the note becomes the header, cut at a word
  it('uses the first line of the note as the header when none is typed', () => {
    expect(headerFor('  Payment   plan ', 'x')).toBe('Payment plan');
    expect(headerFor('', '\n  Called about results  \nSecond line')).toBe('Called about results');
    const long = headerFor('', 'Patient phoned to say the medicine makes her dizzy in the mornings and wants another one');
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('…')).toBe(true);
    expect(long).toBe('Patient phoned to say the medicine makes her dizzy in the…');
  });

  // The screen refuses what the database would refuse, in the same plain words, before anything is sent
  it('explains what is missing or not allowed', () => {
    const reception = noteTypesFor({ role: 'receptionist' });
    expect(noteDraftProblem(draft({ type: 'clinical' }), reception, TODAY)).toBe('Only practitioners and nurses can write clinical notes.');
    expect(noteDraftProblem(draft({ body: '   ' }), reception, TODAY)).toBe('Write the note first.');
    expect(noteDraftProblem(draft({ body: 'x'.repeat(4001) }), reception, TODAY)).toBe('Keep the note to 4,000 characters.');
    expect(noteDraftProblem(draft({ followUpUserId: 'r' }), reception, TODAY)).toBe('Choose the follow-up date.');
    expect(noteDraftProblem(draft({ followUpOn: '2026-10-10', followUpUserId: 'r' }), reception, TODAY)).toBeNull();
  });

  // A new follow-up in the past would be overdue the moment it is saved; one already on the note may stay
  it('refuses a new follow-up day in the past but keeps an existing one', () => {
    const reception = noteTypesFor({ role: 'receptionist' });
    expect(noteDraftProblem(draft({ followUpOn: '2026-10-08' }), reception, TODAY)).toBe('Choose today or a later day for the follow-up.');
    expect(noteDraftProblem(draft({ followUpOn: '2026-10-08' }), reception, TODAY, '2026-10-08')).toBeNull();
    expect(noteDraftProblem(draft({ followUpOn: TODAY }), reception, TODAY)).toBeNull();
  });
});

describe('locked notes', () => {
  // Once locked, the text is the record: changes are made as dated addenda, never by editing
  it('can be changed until locked, then only added to', () => {
    const visible = noteTypesFor({ role: 'doctor' });
    expect(canEditNote(note(), visible)).toBe(true);
    expect(canEditNote(note({ lockedAt: '2026-10-08T09:00:00Z' }), visible)).toBe(false);
    expect(canEditNote(note({ type: 'clinical' }), noteTypesFor({ role: 'receptionist' }))).toBe(false);
  });
});

describe('follow-ups', () => {
  // "Due" is the practice's day in Windhoek, not the browser's: overdue notes must say by how much
  it('says whether a follow-up is due today, overdue, coming up or done', () => {
    expect(followUpStatus(note({ followUpOn: TODAY }), TODAY)).toEqual({ state: 'today', label: 'Due today' });
    expect(followUpStatus(note({ followUpOn: '2026-10-08' }), TODAY)).toEqual({ state: 'overdue', label: '1 day overdue' });
    expect(followUpStatus(note({ followUpOn: '2026-10-02' }), TODAY).label).toBe('7 days overdue');
    expect(followUpStatus(note({ followUpOn: '2026-10-12' }), TODAY)).toEqual({ state: 'upcoming', label: 'Follow up 12 Oct 2026' });
    expect(followUpStatus(note({ followUpOn: '2026-10-08', followUpDoneAt: '2026-10-08T12:00:00Z' }), TODAY).state).toBe('done');
    expect(followUpStatus(note(), TODAY).state).toBe('none');
  });

  const due = (overrides: Partial<DueFollowUp>): DueFollowUp => ({
    noteId: 'x',
    patientId: 'p',
    patientName: 'Patient',
    type: 'general',
    header: 'Call back',
    followUpOn: TODAY,
    followUpUserId: null,
    ...overrides
  });

  // Each person sees their own work first, then what anyone may pick up, then colleagues'; the oldest first in each
  it('lists my follow-ups first, then anyone\'s, then colleagues\', the longest overdue first', () => {
    const list = dueFollowUps(
      [
        due({ noteId: 'colleague', followUpUserId: 'other', followUpOn: '2026-10-01' }),
        due({ noteId: 'anyone', followUpUserId: null, followUpOn: '2026-10-05' }),
        due({ noteId: 'mine-today', followUpUserId: 'me', followUpOn: TODAY }),
        due({ noteId: 'mine-late', followUpUserId: 'me', followUpOn: '2026-10-07' }),
        due({ noteId: 'later', followUpUserId: 'me', followUpOn: '2026-10-10' })
      ],
      'me',
      TODAY
    );
    expect(list.map(item => item.noteId)).toEqual(['mine-late', 'mine-today', 'anyone', 'colleague']);
  });

  // The number on "To Dos" is what this person should act on: their own and anyone's, not colleagues'
  it('counts my own and anyone\'s follow-ups for the To Dos number', () => {
    const items = [due({ followUpUserId: 'me' }), due({ followUpUserId: null }), due({ followUpUserId: 'other' }), due({ followUpUserId: 'me', followUpOn: '2026-10-11' })];
    expect(dueForMeCount(items, 'me', TODAY)).toBe(2);
  });

  // The dashboard opens the patient file at the note, and offers the way back to the next follow-up
  it('links to the note on the patient file', () => {
    expect(noteLink('p 1', 'n1')).toBe('/patients?patientId=p+1&tab=overview&noteId=n1');
    expect(noteLink('p1', 'n1', { returnToDashboard: true })).toBe('/patients?patientId=p1&tab=overview&noteId=n1&returnTo=dashboard');
  });
});

describe('the list on the patient file', () => {
  const credit: ContactNote = { id: 'c1', patientId: 'p1', channel: 'call', note: 'Promised to pay Friday', createdBy: 'u2', createdAt: '2026-10-08T10:00:00+00:00' };
  const notes = [
    note({ id: 'old', type: 'clinical', createdAt: '2026-10-01T08:00:00+00:00' }),
    note({ id: 'new', type: 'contact', createdAt: '2026-10-09T08:00:00+00:00' })
  ];

  // Newest first, with credit-control notes in their place as account notes, so the account story reads in order
  it('mixes credit-control notes in, newest first, and files them under account notes', () => {
    const all = buildNoteList(notes, [credit], 'all', noteTypesFor({ role: 'doctor' }));
    expect(all.map(item => item.id)).toEqual(['new', 'cc-c1', 'old']);
    expect(buildNoteList(notes, [credit], 'account', noteTypesFor({ role: 'doctor' })).map(item => item.kind)).toEqual(['credit_control']);
  });

  // Reception never gets a clinical note on screen, even if one were loaded
  it('leaves out what the person may not see, also in the counts', () => {
    const reception = noteTypesFor({ role: 'receptionist' });
    expect(buildNoteList(notes, [credit], 'all', reception).map(item => item.id)).toEqual(['new', 'cc-c1']);
    expect(noteCounts(notes, [credit], reception)).toEqual({ all: 2, clinical: 0, account: 1, contact: 1, general: 0 });
  });
});
