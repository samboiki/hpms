import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: supabaseMock }));

import {
  SafetyNotSetUpError,
  addAllergy,
  isSafetyNotSetUp,
  loadPatientSafety,
  printedAllergyLine,
  safetyErrorMessage,
  setNoKnownAllergies,
  toAllergyRecord,
  toProblemRecord
} from '../patientSafetyService';

/** A chainable stand-in for one PostgREST query that resolves to `result` */
const query = (result: { data?: unknown; error?: unknown }) => {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'neq', 'order']) chain[name] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
};

afterEach(() => supabaseMock.from.mockReset());

describe('reading the safety records', () => {
  it('reads who verified an allergy from the joined user, for the "Verified by" line', () => {
    expect(
      toAllergyRecord({
        id: 'a1',
        patient_id: 'p1',
        substance: 'Penicillin',
        reaction: '',
        severity: 'severe',
        verified_at: '2026-10-07T08:00:00Z',
        created_at: '2026-10-01T08:00:00Z',
        verifier: { full_name: 'Dr A Example' },
        recorder: null
      })
    ).toMatchObject({ substance: 'Penicillin', reaction: null, severity: 'severe', verifiedByName: 'Dr A Example', recordedByName: null });
  });

  it('treats an unexpected severity as "not known" rather than hiding the allergy', () => {
    expect(toAllergyRecord({ id: 'a1', patient_id: 'p1', substance: 'Latex', severity: 'extreme' }).severity).toBe('unknown');
  });

  it('keeps problem status to the three the database allows', () => {
    expect(toProblemRecord({ id: 'x', patient_id: 'p1', description: 'Asthma', status: 'past' }).status).toBe('past');
    expect(toProblemRecord({ id: 'x', patient_id: 'p1', description: 'Asthma', status: null }).status).toBe('active');
  });

  it('turns a missing table into "not switched on yet", so the screens keep working before the SQL is applied', async () => {
    const missing = { code: 'PGRST205', message: "Could not find the table 'public.patient_allergies' in the schema cache" };
    supabaseMock.from.mockImplementation(() => query({ data: null, error: missing }));
    await expect(loadPatientSafety('p1')).rejects.toBeInstanceOf(SafetyNotSetUpError);
    expect(isSafetyNotSetUp(missing)).toBe(true);
  });

  it('does not mistake another missing table for this feature being off', () => {
    expect(isSafetyNotSetUp({ code: '42P01', message: 'relation "public.something_else" does not exist' })).toBe(false);
  });

  it('loads only active allergies and leaves out problems entered in error', async () => {
    const allergies = query({ data: [], error: null });
    const profile = query({ data: null, error: null });
    const problems = query({ data: [], error: null });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'patient_allergies' ? allergies : table === 'patient_clinical_profiles' ? profile : problems
    );
    await expect(loadPatientSafety('p1')).resolves.toEqual({ allergies: [], profile: null, problems: [] });
    expect(allergies.eq).toHaveBeenCalledWith('status', 'active');
    expect(problems.neq).toHaveBeenCalledWith('status', 'entered_in_error');
  });
});

describe('printedAllergyLine', () => {
  const allergy = (substance: string, severity: 'severe' | 'mild') => toAllergyRecord({ id: substance, patient_id: 'p1', substance, severity });

  it('prints the allergies on the script for the pharmacist who dispenses it', () => {
    expect(printedAllergyLine({ allergies: [allergy('Penicillin', 'severe'), allergy('Latex', 'mild')], profile: null, problems: [] })).toBe(
      'Allergies: Penicillin (severe), Latex'
    );
  });

  it('prints "No known allergies" only when someone stated it, and nothing when allergies were never recorded', () => {
    const profile = { noKnownAllergies: true, nkaConfirmedAt: null, nkaConfirmedByName: null, alertNote: null, alertUpdatedAt: null, alertUpdatedByName: null };
    expect(printedAllergyLine({ allergies: [], profile, problems: [] })).toBe('No known allergies');
    expect(printedAllergyLine({ allergies: [], profile: null, problems: [] })).toBeNull();
    expect(printedAllergyLine(null)).toBeNull();
  });
});

describe('writing the safety records', () => {
  it('never sends who verified or when: the database stamps the signed-in user', async () => {
    const insert = vi.fn(async () => ({ error: null }));
    supabaseMock.from.mockReturnValue({ insert });
    await addAllergy('practice-1', 'p1', { substance: '  Sulfa   drugs ', reaction: ' ', severity: 'mild', verified: true });
    const sent = (insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(sent).toMatchObject({ practice_id: 'practice-1', patient_id: 'p1', substance: 'Sulfa drugs', reaction: null, severity: 'mild' });
    expect(sent).not.toHaveProperty('verified_by');
    expect(typeof sent.verified_at).toBe('string');
  });

  it('explains a duplicate allergy in plain words', async () => {
    supabaseMock.from.mockReturnValue({ insert: vi.fn(async () => ({ error: { code: '23505', message: 'duplicate key' } })) });
    await expect(addAllergy('practice-1', 'p1', { substance: 'Penicillin', reaction: '', severity: 'unknown', verified: false })).rejects.toThrow(
      'Penicillin is already on the allergy list.'
    );
  });

  it('shows the database rule when "no known allergies" is refused because allergies are recorded', async () => {
    const refusal = { code: '23514', message: 'This patient has recorded allergies. Remove them before marking "no known allergies".' };
    supabaseMock.from.mockReturnValue({ upsert: vi.fn(async () => ({ error: refusal })) });
    await expect(setNoKnownAllergies('practice-1', 'p1', true)).rejects.toThrow(refusal.message);
    expect(safetyErrorMessage({ code: '500', message: 'internal details' }, 'Could not save.')).toBe('Could not save.');
  });
});
