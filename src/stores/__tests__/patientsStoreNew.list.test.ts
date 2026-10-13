/**
 * The Patients list. It stopped at 1,000 patients (the database hands out at most 1,000 rows per request), so a bigger
 * practice could not find the rest by scrolling, by branch or by search. And the page read the list twice when it
 * opened (the second time a second later): whichever finished last won, sometimes the list without the visits.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  patientCount: 0,
  patientRequests: 0,
  plainList: [] as unknown[],
  releasePlain: null as null | (() => void)
}));

const invented = (index: number) => ({
  id: `patient-${String(index).padStart(5, '0')}`, first_name: 'Test', last_name: `Patient ${index}`, practice_id: 'practice-1'
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let range: [number, number] = [0, 999];
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        range: (from: number, to: number) => { range = [from, to]; return chain; },
        then: (resolve: (value: unknown) => unknown) => {
          if (table !== 'patients') return Promise.resolve({ data: [], error: null }).then(resolve);
          db.patientRequests += 1;
          const rows = Array.from({ length: Math.max(0, Math.min(db.patientCount, range[1] + 1) - range[0]) }, (_, i) => invented(range[0] + i));
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        }
      };
      return chain;
    }
  }
}));
vi.mock('../../lib/practiceDataService', () => ({
  practiceDataService: { getAuthContext: () => Promise.resolve({ practiceId: 'practice-1' }) }
}));
// The plain list (no visits) is held back until a test lets it finish
vi.mock('../../lib/lightningCache', () => ({
  lightning: {
    getPatients: () => new Promise(resolve => { db.releasePlain = () => resolve(db.plainList); })
  },
  lightningCache: { get: vi.fn(), invalidatePattern: vi.fn() }
}));

import { usePatientsStoreNew } from '../patientsStoreNew';

beforeEach(() => {
  db.patientCount = 0;
  db.patientRequests = 0;
  db.plainList = [];
  db.releasePlain = null;
  usePatientsStoreNew.setState({ patients: [], isLoading: false, error: null });
});

describe('the Patients list', () => {
  it('lists every patient of a practice with more than 1,000, page by page', async () => {
    db.patientCount = 2345;
    await usePatientsStoreNew.getState().fetchPatientsWithVisits();
    const { patients, error } = usePatientsStoreNew.getState();
    expect(error).toBeNull();
    expect(patients).toHaveLength(2345);
    expect(new Set(patients.map(patient => patient.id)).size).toBe(2345);
    expect(db.patientRequests).toBeGreaterThanOrEqual(3);
  });

  it('a practice with fewer patients is read in one request', async () => {
    db.patientCount = 12;
    await usePatientsStoreNew.getState().fetchPatientsWithVisits();
    expect(usePatientsStoreNew.getState().patients).toHaveLength(12);
    expect(db.patientRequests).toBe(1);
  });

  it('an older load that finishes last never replaces the newer list', async () => {
    db.patientCount = 3;
    db.plainList = [invented(1)];
    const older = usePatientsStoreNew.getState().fetchPatients();
    await vi.waitFor(() => expect(db.releasePlain).not.toBeNull());
    await usePatientsStoreNew.getState().fetchPatientsWithVisits();
    db.releasePlain?.();
    await older;

    const { patients, isLoading } = usePatientsStoreNew.getState();
    expect(patients).toHaveLength(3);
    expect(patients[0]).toHaveProperty('total_visits');
    expect(isLoading).toBe(false);
  });
});
