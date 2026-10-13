/**
 * The Dashboard's "today's appointments". It used to read every patient id of the practice and put them all in the
 * address of the next request: past about a thousand patients the address was too long and the appointments failed to
 * load. The practice is now matched through the appointment's own patient in the same request.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; select?: string; filters: unknown[][] }>,
  appointments: [] as Array<Record<string, unknown>>
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const call: { table: string; select?: string; filters: unknown[][] } = { table, filters: [] };
      db.calls.push(call);
      const rows = table === 'appointments'
        ? db.appointments
        : [{ id: 'doctor-1', full_name: 'Invented Practitioner', email: 'practitioner@example.test' }];
      const chain: Record<string, unknown> = {
        select: (columns: string) => { call.select = columns; return chain; },
        eq: (column: string, value: unknown) => { call.filters.push(['eq', column, value]); return chain; },
        in: (column: string, values: unknown[]) => { call.filters.push(['in', column, values]); return chain; },
        order: () => chain,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve)
      };
      return chain;
    }
  }
}));
vi.mock('../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));

import { loadTodayAppointments } from '../useAppointments';

beforeEach(() => {
  db.calls = [];
  db.appointments = [{
    id: 'appointment-1', patient_id: 'patient-1', doctor_id: 'doctor-1', date: '2026-10-13', time: '09:00', status: 'scheduled',
    patient: { id: 'patient-1', first_name: 'Test', last_name: 'Patient', practice_id: 'practice-1' }
  }];
});

describe("today's appointments on the Dashboard", () => {
  it('match the practice through the patient in one request, never a list of every patient id', async () => {
    const rows = await loadTodayAppointments('practice-1', '2026-10-13');

    expect(db.calls.some(call => call.table === 'patients')).toBe(false);
    const appointments = db.calls.find(call => call.table === 'appointments');
    expect(appointments?.select).toContain('patients!patient_id!inner');
    expect(appointments?.filters).toContainEqual(['eq', 'patient.practice_id', 'practice-1']);
    expect(appointments?.filters).toContainEqual(['eq', 'date', '2026-10-13']);
    expect(appointments?.filters.some(([kind]) => kind === 'in')).toBe(false);

    expect(rows).toHaveLength(1);
    expect(rows[0].patient?.first_name).toBe('Test');
    expect(rows[0].doctor?.full_name).toBe('Invented Practitioner');
  });

  it('look up only the practitioners of today', async () => {
    await loadTodayAppointments('practice-1', '2026-10-13');
    const doctors = db.calls.find(call => call.table === 'users');
    expect(doctors?.filters).toContainEqual(['in', 'id', ['doctor-1']]);
  });

  it('read nothing more on a day without appointments', async () => {
    db.appointments = [];
    expect(await loadTodayAppointments('practice-1', '2026-10-13')).toEqual([]);
    expect(db.calls.map(call => call.table)).toEqual(['appointments']);
  });
});
