import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// Recording stand-in for the Supabase query builder
const db = vi.hoisted(() => {
  type Op = [string, unknown[]];
  type Response = { data: unknown; error: unknown; count?: number | null };
  const state = {
    calls: [] as Array<{ table: string; ops: Op[] }>,
    respond: (() => ({ data: null, error: null })) as (table: string, ops: Op[]) => Response,
  };
  const makeBuilder = (table: string) => {
    const entry = { table, ops: [] as Op[] };
    state.calls.push(entry);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'update', 'delete', 'eq', 'in', 'or', 'order', 'limit']) {
      builder[method] = (...args: unknown[]) => {
        entry.ops.push([method, args]);
        return builder;
      };
    }
    builder.single = () => Promise.resolve(state.respond(table, entry.ops));
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(state.respond(table, entry.ops)).then(resolve, reject);
    return builder;
  };
  return { state, makeBuilder };
});

// Captures the realtime handler so tests can play postgres_changes events
const realtime = vi.hoisted(() => ({ handler: null as null | ((payload: unknown) => void) }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => db.makeBuilder(table),
    channel: () => {
      const channel = {
        on: (_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
          realtime.handler = handler;
          return channel;
        },
        subscribe: () => ({ unsubscribe: () => undefined }),
      };
      return channel;
    },
  },
}));

import {
  NO_SHOW_NOT_ACCEPTED_MESSAGE,
  VISIT_DELETE_NOT_ALLOWED_MESSAGE,
  VISIT_HAS_RECORDS_MESSAGE,
  useVisitsStore,
} from '../visitsStore';
import type { Visit } from '../../types/enhanced-visit.types';

const updatePayload = () =>
  db.state.calls.flatMap((call) => call.ops).find(([method]) => method === 'update')?.[1][0] as Record<string, unknown>;

const visit = (overrides: Partial<Visit>): Visit => ({ id: 'visit-1', ...overrides }) as Visit;

describe('visitsStore', () => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Africa/Windhoek';
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  beforeEach(() => {
    db.state.calls = [];
    db.state.respond = () => ({ data: null, error: null });
    useVisitsStore.setState({ visits: [], error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rescheduleVisit', () => {
    it('moves visit_date/visit_time as well as scheduled_*, so the old slot is freed and every screen shows the new time', async () => {
      useVisitsStore.setState({
        visits: [visit({ scheduled_date: '2026-10-06', scheduled_time: '09:00', visit_date: '2026-10-06', visit_time: '09:00' })],
      });

      await useVisitsStore.getState().rescheduleVisit('visit-1', '2026-10-08', '14:30');

      expect(updatePayload()).toMatchObject({
        scheduled_date: '2026-10-08',
        scheduled_time: '14:30',
        visit_date: '2026-10-08',
        visit_time: '14:30',
      });
      expect(useVisitsStore.getState().visits[0]).toMatchObject({
        scheduled_date: '2026-10-08',
        visit_date: '2026-10-08',
        visit_time: '14:30',
      });
    });
  });

  describe('markNoShow', () => {
    it('explains in plain words when the database rejects the no-show status, instead of a raw constraint error', async () => {
      db.state.respond = () => ({
        data: null,
        error: { message: 'new row for relation "visits" violates check constraint "visits_status_check"', details: null },
      });

      await expect(useVisitsStore.getState().markNoShow('visit-1')).rejects.toThrow(NO_SHOW_NOT_ACCEPTED_MESSAGE);
      expect(useVisitsStore.getState().error).toBe(NO_SHOW_NOT_ACCEPTED_MESSAGE);
    });

    it('still writes the no-show status (what is stored does not change)', async () => {
      await useVisitsStore.getState().markNoShow('visit-1');
      expect(updatePayload()).toMatchObject({ status: 'no-show' });
    });

    it('passes other errors through unchanged', async () => {
      db.state.respond = () => ({ data: null, error: { message: 'JWT expired', details: null } });
      await expect(useVisitsStore.getState().markNoShow('visit-1')).rejects.toMatchObject({ message: 'JWT expired' });
    });
  });

  describe('deleteVisit', () => {
    it('reports a delete the database refused instead of hiding a booking that still exists', async () => {
      // Without a delete rule for the user, Supabase deletes 0 rows and returns no error
      db.state.respond = () => ({ data: null, error: null, count: 0 });
      useVisitsStore.setState({ visits: [visit({ status: 'scheduled' })] });

      await expect(useVisitsStore.getState().deleteVisit('visit-1')).rejects.toThrow(VISIT_DELETE_NOT_ALLOWED_MESSAGE);
      expect(useVisitsStore.getState().visits).toHaveLength(1);
    });

    it('explains that a visit with clinical or billing records cannot be deleted', async () => {
      db.state.respond = () => ({ data: null, error: { code: '23503', message: 'violates foreign key constraint' } });
      useVisitsStore.setState({ visits: [visit({ status: 'scheduled' })] });

      await expect(useVisitsStore.getState().deleteVisit('visit-1')).rejects.toThrow(VISIT_HAS_RECORDS_MESSAGE);
      expect(useVisitsStore.getState().visits).toHaveLength(1);
    });

    it('removes the booking from the screen only when the database deleted it', async () => {
      db.state.respond = () => ({ data: null, error: null, count: 1 });
      useVisitsStore.setState({ visits: [visit({ status: 'scheduled' })] });

      await useVisitsStore.getState().deleteVisit('visit-1');

      expect(db.state.calls[0].ops[0]).toEqual(['delete', [{ count: 'exact' }]]);
      expect(useVisitsStore.getState().visits).toHaveLength(0);
    });
  });

  describe('moveVisitToStage', () => {
    it('gives the same plain explanation when marking a no-show through a stage change', async () => {
      db.state.respond = (_table, ops) =>
        ops.some(([method]) => method === 'update')
          ? { data: null, error: { message: 'violates check constraint "visits_status_check"', details: null } }
          : { data: { status: 'scheduled', is_checked_in: false, is_ready: false, is_handoff: false, is_cancelled: false }, error: null };

      await expect(useVisitsStore.getState().moveVisitToStage('visit-1', 'no-show')).rejects.toThrow(NO_SHOW_NOT_ACCEPTED_MESSAGE);
    });
  });

  describe('live updates', () => {
    const selma = { id: 'p1', first_name: 'Selma', last_name: 'Shilongo' };
    const drA = { id: 'd1', full_name: 'Dr A Nangolo', role: 'doctor' };
    const drB = { id: 'd2', full_name: 'Dr B Amutenya', role: 'doctor' };
    const play = (payload: unknown) => realtime.handler?.(payload);

    beforeEach(() => {
      realtime.handler = null;
      useVisitsStore.getState().subscribeToVisitChanges('practice-1');
    });

    it('keeps the patient and doctor names when a visit changes, instead of showing "Unknown Patient"', () => {
      useVisitsStore.setState({ visits: [visit({ patient_id: 'p1', doctor_id: 'd1', status: 'scheduled', patient: selma, doctor: drA } as Partial<Visit>)] });

      play({ eventType: 'UPDATE', new: { id: 'visit-1', patient_id: 'p1', doctor_id: 'd1', status: 'in-progress' }, old: {} });

      const [updated] = useVisitsStore.getState().visits;
      expect(updated.status).toBe('in-progress');
      expect(updated.patient).toEqual(selma);
      expect(updated.doctor).toEqual(drA);
    });

    it('loads the patient and doctor for a visit booked on another screen', async () => {
      db.state.respond = () => ({ data: { id: 'visit-2', patient_id: 'p1', doctor_id: 'd1', patient: selma, doctor: drA }, error: null });

      play({ eventType: 'INSERT', new: { id: 'visit-2', patient_id: 'p1', doctor_id: 'd1' }, old: {} });

      await vi.waitFor(() => expect(useVisitsStore.getState().visits[0]?.patient).toEqual(selma));
      const reload = db.state.calls.find((call) => call.ops.some(([method, args]) => method === 'eq' && args[1] === 'visit-2'));
      expect(String(reload?.ops.find(([method]) => method === 'select')?.[1][0])).toContain('patients!visits_patient_id_fkey');
    });

    it('reloads the doctor when a visit is reassigned, and never shows the previous doctor on it', async () => {
      useVisitsStore.setState({ visits: [visit({ patient_id: 'p1', doctor_id: 'd1', patient: selma, doctor: drA } as Partial<Visit>)] });
      db.state.respond = () => ({ data: { id: 'visit-1', patient_id: 'p1', doctor_id: 'd2', patient: selma, doctor: drB }, error: null });

      play({ eventType: 'UPDATE', new: { id: 'visit-1', patient_id: 'p1', doctor_id: 'd2' }, old: {} });
      await vi.waitFor(() => expect(useVisitsStore.getState().visits[0].doctor).toEqual(drB));

      // When the reload fails, the doctor is left blank rather than showing Dr A
      db.state.respond = () => ({ data: null, error: { message: 'offline' } });
      play({ eventType: 'UPDATE', new: { id: 'visit-1', patient_id: 'p1', doctor_id: 'd1' }, old: {} });
      await vi.waitFor(() => expect(useVisitsStore.getState().visits[0].doctor_id).toBe('d1'));
      expect(useVisitsStore.getState().visits[0].doctor).toBeUndefined();
      expect(useVisitsStore.getState().visits[0].patient).toEqual(selma);
    });

    it('leaves visits that are not in the loaded list out of it', () => {
      useVisitsStore.setState({ visits: [visit({ patient_id: 'p1', doctor_id: 'd1' })] });

      play({ eventType: 'UPDATE', new: { id: 'other-visit', patient_id: 'p9', doctor_id: 'd1' }, old: {} });

      expect(useVisitsStore.getState().visits.map((v) => v.id)).toEqual(['visit-1']);
    });
  });

  describe("today's count", () => {
    it("counts today's visits by the Namibian calendar date, also just after midnight (00:30 is still yesterday in UTC)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-05T22:30:00Z')); // 00:30 on 6 Oct in Windhoek
      useVisitsStore.setState({
        visits: [
          visit({ id: 'today', scheduled_date: '2026-10-06', is_cancelled: false }),
          visit({ id: 'yesterday', scheduled_date: '2026-10-05', is_cancelled: false }),
        ],
      });

      useVisitsStore.getState().updateCounts();

      expect(useVisitsStore.getState().todayCount).toBe(1);
    });
  });
});
