import { describe, expect, it } from 'vitest';
import {
  CHANGE_GROUPS,
  belongsToPatient,
  describeChange,
  describeHistory,
  describeWho,
  earlierKey,
  earlierLookups,
  patientHistoryFilter,
  peopleIn,
  type AuditLogRow,
  type AuditValues
} from '../changeHistory';
import { fundMoveKey } from '../../../utils/accounts/fundMoves';

// Invented ids and values only
const PATIENT = '11111111-1111-4111-8111-111111111111';
const OTHER_PATIENT = '22222222-2222-4222-8222-222222222222';
const VISIT = '33333333-3333-4333-8333-333333333333';
const OTHER_VISIT = '44444444-4444-4444-8444-444444444444';
const DOCTOR = '55555555-5555-4555-8555-555555555555';
const RECEPTION = '66666666-6666-4666-8666-666666666666';
const AID = '77777777-7777-4777-8777-777777777777';
const VITALS = '88888888-8888-4888-8888-888888888888';

let next = 0;
const row = (overrides: Partial<AuditLogRow>): AuditLogRow => ({
  id: `row-${String(++next).padStart(3, '0')}`,
  table_name: 'patients',
  record_id: PATIENT,
  action: 'UPDATE',
  old_values: null,
  new_values: null,
  user_id: RECEPTION,
  created_at: '2026-10-09T06:30:00+00:00',
  ...overrides
});

const patientFile = (overrides: Record<string, unknown> = {}): AuditValues => ({
  id: PATIENT,
  first_name: 'Test',
  last_name: 'Example',
  cell_number: '+264 81 000 0001',
  email: 'test.example@example.invalid',
  home_address: '1 Example Street',
  sms_opt_out: false,
  updated_at: '2026-10-01T08:00:00+00:00',
  ...overrides
});

const visit = (overrides: Record<string, unknown> = {}): AuditValues => ({
  id: VISIT,
  patient_id: PATIENT,
  doctor_id: DOCTOR,
  scheduled_date: '2026-10-09',
  scheduled_time: '08:30:00',
  visit_date: '2026-10-09',
  visit_time: '08:30:00',
  status: 'scheduled',
  is_confirmed: false,
  is_checked_in: false,
  diagnosis: null,
  notes: null,
  updated_at: '2026-10-08T08:00:00+00:00',
  ...overrides
});

const names = { [DOCTOR]: 'Dr. A Tester' };

describe('a patient file change, in plain words', () => {
  // The list is read over a shoulder at reception: a cell number is personal data, so it waits behind a tap
  it('names a changed cell number without putting the number in the sentence', () => {
    const entry = describeChange(row({ new_values: patientFile({ cell_number: '+264 81 000 0002' }) }), patientFile());
    expect(entry?.title).toBe('Cell number changed');
    expect(entry?.title).not.toMatch(/\d/);
    expect(entry?.details).toEqual([{ label: 'Cell number', before: '+264 81 000 0001', after: '+264 81 000 0002' }]);
  });

  // Three in four saves of a file only touch updated_at: listing them would bury the real changes
  it('leaves out a save that changed nothing staff care about', () => {
    expect(describeChange(row({ new_values: patientFile({ updated_at: '2026-10-09T06:30:00+00:00' }) }), patientFile())).toBeNull();
  });

  // The database keeps no "before" for a change: without the earlier entry, guessing would invent history
  it('says when the values before a change are not known instead of guessing', () => {
    const entry = describeChange(row({ new_values: patientFile() }), null);
    expect(entry?.title).toBe('Patient details updated');
    expect(entry?.details).toEqual([]);
    expect(entry?.note).toMatch(/not in this file's history/);
  });

  it("works a change out against the same record's earlier entry, newest first", () => {
    const entries = describeHistory({
      rows: [
        row({ action: 'INSERT', new_values: patientFile(), created_at: '2026-10-01T08:00:00+00:00' }),
        row({ new_values: patientFile({ email: 'changed@example.invalid' }), created_at: '2026-10-09T06:30:00+00:00' })
      ],
      patientId: PATIENT,
      visitIds: new Set()
    });
    expect(entries.map(entry => entry.title)).toEqual(['Email address changed', 'Patient registered']);
    expect(entries[0].details[0]).toMatchObject({ before: 'test.example@example.invalid', after: 'changed@example.invalid' });
  });

  it('names up to three changed fields and counts the rest, so a long save stays one line', () => {
    const after = patientFile({ last_name: 'Other', cell_number: '+264 81 000 0009', email: 'x@example.invalid', home_address: '2 Example Street', postal_code: '9000' });
    expect(describeChange(row({ new_values: after }), patientFile())?.title).toBe('Surname, cell number, email address and 2 more changed');
  });
});

describe('bookings and visits (parity B18: who booked, moved, confirmed or cancelled)', () => {
  it('says a visit was added for the day it is booked, and points at that visit so it can be opened', () => {
    const entry = describeChange(row({ table_name: 'visits', record_id: VISIT, action: 'INSERT', new_values: visit() }), null, names);
    expect(entry?.title).toBe('Visit added for 9 Oct 2026');
    expect(entry?.visitId).toBe(VISIT);
    expect(entry?.details).toEqual(
      expect.arrayContaining([
        { label: 'Date and time', before: null, after: '9 Oct 2026, 08:30' },
        { label: 'Practitioner', before: null, after: 'Dr. A Tester' }
      ])
    );
    // A switch that is off is not worth listing for a new visit
    expect(entry?.details.map(detail => detail.label)).not.toContain('Confirmation');
  });

  it('says a booking was moved and confirmed, with the old and new time one tap away', () => {
    const after = visit({ scheduled_date: '2026-10-10', scheduled_time: '09:00:00', visit_date: '2026-10-10', is_confirmed: true });
    const entry = describeChange(row({ table_name: 'visits', record_id: VISIT, new_values: after }), visit(), names);
    expect(entry?.title).toBe('Visit of 9 Oct 2026 moved and confirmed');
    expect(entry?.details[0]).toEqual({ label: 'Date and time', before: '9 Oct 2026, 08:30', after: '10 Oct 2026, 09:00' });
  });

  it("names the visit's new stage in the clinic's words, never the stored flags", () => {
    const change = (after: AuditValues) => describeChange(row({ table_name: 'visits', record_id: VISIT, new_values: after }), visit(), names);
    expect(change(visit({ is_checked_in: true }))?.title).toBe('Visit of 9 Oct 2026 checked in');
    expect(change(visit({ is_checked_in: true, status: 'in-progress' }))?.title).toBe('Visit of 9 Oct 2026 started');
    expect(change(visit({ is_checked_in: true, status: 'in-progress' }))?.details).toContainEqual({ label: 'Stage', before: 'Scheduled', after: 'With the practitioner' });
    expect(change(visit({ status: 'cancelled', is_cancelled: true }))?.title).toBe('Visit of 9 Oct 2026 cancelled');
  });

  it('puts what happened to a visit first and the clinical fields that changed after it', () => {
    const before = visit({ status: 'in-progress', is_checked_in: true });
    const completed = describeChange(
      row({ table_name: 'visits', record_id: VISIT, new_values: { ...before, status: 'completed', diagnosis: 'Invented diagnosis', notes: 'Invented note' } }),
      before
    );
    expect(completed?.title).toBe('Visit of 9 Oct 2026 completed; diagnosis and notes changed');
    const diagnosis = describeChange(row({ table_name: 'visits', record_id: VISIT, new_values: { ...before, diagnosis: 'Invented diagnosis' } }), before);
    expect(diagnosis?.title).toBe('Visit of 9 Oct 2026: diagnosis changed');
    expect(diagnosis?.details).toEqual([{ label: 'Diagnosis', before: 'Blank', after: 'Invented diagnosis' }]);
  });
});

describe('vital signs and medical aid', () => {
  const vitals = { id: VITALS, visit_id: VISIT, blood_pressure: '120/80', pulse_rate: 72, temperature: 36.8 };

  // A vitals row names only its visit: it belongs to the patient through the patient's own visits
  it('says which readings were recorded and links them to the visit they were taken at', () => {
    const vitalsRow = row({ table_name: 'vitals', record_id: VITALS, action: 'INSERT', new_values: vitals });
    const [entry] = describeHistory({ rows: [vitalsRow], patientId: PATIENT, visitIds: new Set([VISIT]) });
    expect(entry.title).toBe('Blood pressure, pulse and temperature recorded');
    expect(entry.visitId).toBe(VISIT);
    expect(entry.details).toContainEqual({ label: 'Blood pressure', before: null, after: '120/80 mmHg' });
    expect(describeHistory({ rows: [vitalsRow], patientId: PATIENT, visitIds: new Set([OTHER_VISIT]) })).toEqual([]);
  });

  it('names the medical aid field that changed and marks a fund so its logo is shown', () => {
    const aid = { id: AID, patient_id: PATIENT, provider: 'PSEMAS', membership_number: '000111', dependant_code: '00' };
    const fund = describeChange(row({ table_name: 'medical_aid_details', record_id: AID, new_values: { ...aid, provider: 'NHP' } }), aid);
    expect(fund?.title).toBe('Medical aid: fund changed');
    expect(fund?.details).toEqual([{ label: 'Fund', before: 'PSEMAS', after: 'NHP', fund: true }]);
    const member = describeChange(row({ table_name: 'medical_aid_details', record_id: AID, new_values: { ...aid, membership_number: '000222' } }), aid);
    expect(member?.title).toBe('Medical aid: membership number changed');
  });

  // A21: when a fund merges or renames an option the practice moves its patients in one step; each patient's history
  // must still say why their fund changed, so the reason of the move is shown on that patient's own change
  it("carries the reason of a move of many patients to another fund on each patient's medical aid change", () => {
    const aid = { id: AID, patient_id: PATIENT, provider: 'NMC', plan_type: 'Standard' };
    const rows = [
      row({ table_name: 'medical_aid_details', record_id: AID, action: 'INSERT', new_values: aid, created_at: '2026-10-01T06:00:00+00:00' }),
      row({ table_name: 'medical_aid_details', record_id: AID, new_values: { ...aid, plan_type: 'Plus' }, created_at: '2026-10-13T06:00:00.123456+00:00' })
    ];
    const fundMoves = new Map([[fundMoveKey(AID, '2026-10-13T06:00:00.123456+00:00'), 'Standard option merged into Plus']]);
    const [moved, added] = describeHistory({ rows, patientId: PATIENT, visitIds: new Set(), fundMoves });
    expect(moved.title).toBe('Medical aid: plan changed');
    expect(moved.reason).toBe('Standard option merged into Plus');
    // Only the change the move made carries it
    expect(added.reason).toBeUndefined();
    expect(describeHistory({ rows, patientId: PATIENT, visitIds: new Set() })[0].reason).toBeUndefined();
  });
});

describe('town and region (A16)', () => {
  it('names a change of town or region like any other field of the file', () => {
    const before = patientFile({ town: 'Windhoek', region: 'Khomas' });
    const entry = describeChange(row({ new_values: { ...before, town: 'Oshakati', region: 'Oshana' } }), before);
    expect(entry?.title).toBe('Town and region changed');
    expect(entry?.details).toEqual([
      { label: 'Town', before: 'Windhoek', after: 'Oshakati' },
      { label: 'Region', before: 'Khomas', after: 'Oshana' }
    ]);
  });
});

describe("only this patient's history, and no value in the list", () => {
  // The history holds whole rows of other people's files; the query should never return them, but if it ever
  // did (a widened filter, a moved visit), nothing of theirs may reach this screen
  it("never shows another patient's entry, a stored value in a sentence, or the stored description and IP address", () => {
    // The view also returns these columns; a row read with select('*') would carry them
    const technical = { description: 'Phone: +264 81 000 0001 changed', ip_address: '192.0.2.10', user_agent: 'Invented browser' };
    const rows: AuditLogRow[] = [
      Object.assign(row({ new_values: patientFile({ cell_number: '+264 81 000 0002' }), created_at: '2026-10-09T07:00:00+00:00' }), technical),
      Object.assign(row({ action: 'INSERT', new_values: patientFile(), created_at: '2026-10-01T08:00:00+00:00' }), technical),
      row({ record_id: OTHER_PATIENT, new_values: patientFile({ id: OTHER_PATIENT, cell_number: '+264 81 999 9999' }) }),
      row({ table_name: 'visits', record_id: OTHER_VISIT, action: 'INSERT', new_values: visit({ id: OTHER_VISIT, patient_id: OTHER_PATIENT }) }),
      row({ table_name: 'vitals', record_id: VITALS, action: 'INSERT', new_values: { id: VITALS, visit_id: OTHER_VISIT, blood_pressure: '150/95' } })
    ];
    const entries = describeHistory({ rows, patientId: PATIENT, visitIds: new Set([VISIT]) });

    expect(entries.map(entry => entry.id)).toEqual([rows[0].id, rows[1].id]);
    const stored = ['+264', '000 0001', '000 0002', 'example.invalid', 'Example Street', '150/95'];
    for (const entry of entries) {
      for (const value of stored) expect(entry.title).not.toContain(value);
      const shown = JSON.stringify(entry);
      for (const value of Object.values(technical)) expect(shown).not.toContain(value);
      expect(shown).not.toContain('999 9999');
    }
  });

  // A visit moved here from another file: its earlier entries are that file's, so they are not "before" values here
  it("never uses another patient's entry as the values before a change", () => {
    const rows = [
      row({ table_name: 'visits', record_id: VISIT, action: 'INSERT', new_values: visit({ patient_id: OTHER_PATIENT, diagnosis: 'Their diagnosis' }), created_at: '2026-10-01T08:00:00+00:00' }),
      row({ table_name: 'visits', record_id: VISIT, new_values: visit(), created_at: '2026-10-09T06:30:00+00:00' })
    ];
    const entries = describeHistory({ rows, patientId: PATIENT, visitIds: new Set([VISIT]) });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ title: 'Visit of 9 Oct 2026 updated', details: [] });
    expect(JSON.stringify(entries)).not.toContain('Their diagnosis');
    expect(earlierLookups(rows.filter(item => belongsToPatient(item, PATIENT, new Set([VISIT]))))).toHaveLength(1);
  });
});

describe("the query asks only for this patient's entries", () => {
  it("keeps the file's existing filter and adds only the vitals of the patient's own visits", () => {
    const existing = `record_id.eq.${PATIENT},new_values->>patient_id.eq.${PATIENT},old_values->>patient_id.eq.${PATIENT}`;
    expect(patientHistoryFilter(PATIENT, [])).toBe(existing);
    expect(patientHistoryFilter(PATIENT, [VISIT, VISIT])).toBe(
      `${existing},and(table_name.eq.vitals,new_values->>visit_id.in.(${VISIT})),and(table_name.eq.vitals,old_values->>visit_id.in.(${VISIT}))`
    );
  });

  // A comma or bracket in an id would rewrite the filter (e.g. "or every other record") and list other files
  it('refuses an id that would change the filter itself', () => {
    expect(patientHistoryFilter(`${PATIENT},record_id.neq.${PATIENT}`, [])).toBeNull();
    expect(patientHistoryFilter(PATIENT, ['x),or(id.neq.0'])).toBe(patientHistoryFilter(PATIENT, []));
    expect(belongsToPatient(row({}), `${PATIENT},x`, new Set())).toBe(false);
  });
});

describe('who and when', () => {
  it('names who made a change and their role, and says when OneHealth made it itself', () => {
    const staff = { [DOCTOR]: { full_name: 'A Tester', role: 'doctor' }, [RECEPTION]: { full_name: 'B Helper', role: 'receptionist' } };
    expect(describeWho(DOCTOR, staff)).toBe('Dr. A Tester (Doctor)');
    expect(describeWho(RECEPTION, staff)).toBe('B Helper (Receptionist)');
    expect(describeWho(null, staff)).toBe('OneHealth (automatic)');
    expect(describeWho(OTHER_PATIENT, staff)).toBe('Someone not on your staff list');
  });

  it("asks for the names of who made each change and of each visit's practitioner", () => {
    const rows = [row({ table_name: 'visits', record_id: VISIT, new_values: visit() }), row({ user_id: null })];
    expect(peopleIn(rows).sort()).toEqual([DOCTOR, RECEPTION].sort());
  });

  // Each earlier entry costs a query: only changes whose earlier entry is not on the page need one
  it('looks up the earlier entry only where it is not loaded, once per record and moment', () => {
    const rows = [
      row({ table_name: 'visits', record_id: VISIT, new_values: visit(), created_at: '2026-10-09T08:00:00+00:00' }),
      row({ table_name: 'visits', record_id: VISIT, new_values: visit(), created_at: '2026-10-09T07:00:00+00:00' }),
      row({ new_values: patientFile(), created_at: '2026-10-09T06:00:00+00:00' }),
      row({ new_values: patientFile(), created_at: '2026-10-09T06:00:00+00:00' }),
      row({ table_name: 'medical_aid_details', record_id: AID, action: 'INSERT', new_values: { id: AID }, created_at: '2026-10-08T06:00:00+00:00' }),
      row({ table_name: 'medical_aid_details', record_id: AID, new_values: { id: AID }, created_at: '2026-10-09T06:00:00+00:00' })
    ];
    expect(earlierLookups(rows).map(lookup => lookup.key)).toEqual([earlierKey(rows[1]), earlierKey(rows[2])]);
  });
});

describe('filters by what changed', () => {
  // A filter that can never show anything would be a fake button: each one shows an audited table
  it('offers the four things staff look for, each backed by a table the trail records', () => {
    expect(CHANGE_GROUPS.map(group => group.label)).toEqual(['Patient file', 'Visits', 'Medical aid', 'Vital signs']);
    for (const group of CHANGE_GROUPS) {
      const entry = describeChange(row({ table_name: group.table, action: 'INSERT', new_values: { id: VISIT, patient_id: PATIENT } }), null);
      expect(entry?.group).toBe(group.key);
    }
  });
});
