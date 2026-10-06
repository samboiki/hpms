import { describe, it, expect, vi, beforeEach } from 'vitest';

// Recording stand-in for the Supabase query builder
const db = vi.hoisted(() => {
  type Op = [string, unknown[]];
  const state = {
    calls: [] as Array<{ table: string; ops: Op[] }>,
    rows: [] as unknown[],
  };
  const makeBuilder = (table: string) => {
    const entry = { table, ops: [] as Op[] };
    state.calls.push(entry);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order']) {
      builder[method] = (...args: unknown[]) => {
        entry.ops.push([method, args]);
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.rows, error: null }).then(resolve, reject);
    return builder;
  };
  return { state, makeBuilder };
});

const auth = vi.hoisted(() => ({ practiceId: 'practice-1' as string | null }));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (table: string) => db.makeBuilder(table) },
}));
vi.mock('../../lib/practiceDataService', () => ({
  practiceDataService: {
    getAuthContext: async () => (auth.practiceId ? { practiceId: auth.practiceId, userId: 'user-1', userRole: 'receptionist' } : null),
  },
}));

import { toStorePatient, usePatientsStore, type PatientStoreRow } from '../patientsStore';

const row = (overrides: Partial<PatientStoreRow> = {}): PatientStoreRow => ({
  id: 'patient-1',
  first_name: 'Selma',
  last_name: 'Shilongo',
  date_of_birth: '1990-04-12',
  id_number: '90041200123',
  gender: 'Female',
  email: 'selma@example.com',
  cell_number: '081 555 0101',
  home_address: 'Erf 12, Ongwediva',
  occupation: null,
  employer: null,
  home_language: 'oshiwambo',
  ...overrides,
});

describe('toStorePatient', () => {
  it("uses the patient's own cell number and email, so a message goes to the real patient", () => {
    const patient = toStorePatient(row());
    expect(patient.phone).toBe('081 555 0101');
    expect(patient.email).toBe('selma@example.com');
    expect(patient.firstName).toBe('Selma');
    expect(patient.lastName).toBe('Shilongo');
    expect(patient.address).toBe('Erf 12, Ongwediva');
  });

  it('leaves missing contact details empty instead of inventing them', () => {
    const patient = toStorePatient(row({ cell_number: null, email: null, home_address: null }));
    expect(patient.phone).toBe('');
    expect(patient.email).toBe('');
    expect(patient.address).toBe('');
    expect(patient.medicalHistory).toEqual([]);
    expect(patient.allergies).toEqual([]);
  });

  it('reads gender and home language case-insensitively', () => {
    expect(toStorePatient(row({ gender: 'Female' })).gender).toBe('female');
    expect(toStorePatient(row({ gender: 'M' })).gender).toBe('male');
    expect(toStorePatient(row({ gender: null })).gender).toBe('other');
    expect(toStorePatient(row({ home_language: 'oshiwambo' })).preferredLanguage).toBe('Oshiwambo');
    expect(toStorePatient(row({ home_language: 'Otjiherero' })).preferredLanguage).toBe('Other');
  });
});

describe('usePatientsStore', () => {
  beforeEach(() => {
    db.state.calls = [];
    db.state.rows = [];
    auth.practiceId = 'practice-1';
    usePatientsStore.setState({ patients: [], error: null, isLoading: false });
  });

  it('starts with no patients, so invented sample patients are never offered as real recipients', () => {
    // Before, the store started with two made-up patients and made-up phone numbers
    expect(usePatientsStore.getInitialState().patients).toEqual([]);
  });

  it("loads only the signed-in practice's patients", async () => {
    db.state.rows = [row()];
    await usePatientsStore.getState().fetchPatients();

    const call = db.state.calls.find((c) => c.table === 'patients');
    expect(call?.ops).toContainEqual(['eq', ['practice_id', 'practice-1']]);
    expect(usePatientsStore.getState().patients.map((p) => p.id)).toEqual(['patient-1']);
    expect(usePatientsStore.getState().error).toBeNull();
  });

  it('lists nobody and says why when no practice is selected, rather than querying every practice', async () => {
    auth.practiceId = null;
    await usePatientsStore.getState().fetchPatients();

    expect(db.state.calls).toHaveLength(0);
    expect(usePatientsStore.getState().patients).toEqual([]);
    expect(usePatientsStore.getState().error).toMatch(/no practice/i);
  });
});
