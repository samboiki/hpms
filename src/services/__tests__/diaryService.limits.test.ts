import { describe, it, expect, vi, beforeEach } from 'vitest';

// An invented practice in memory. Queries filter on eq() and in(); a column missing from the database answers like
// PostgREST does (42703), so the fallback for a database without the diary update is exercised too
const db = vi.hoisted(() => {
  const state = {
    tables: {} as Record<string, Array<Record<string, unknown>>>,
    missingColumns: new Set<string>(),
    selects: [] as string[]
  };
  const from = (table: string) => {
    let rows = [...(state.tables[table] ?? [])];
    let columns = '*';
    let single = false;
    const api: Record<string, unknown> = {};
    for (const name of ['order', 'limit', 'range', 'gte', 'lte', 'neq', 'or', 'is']) api[name] = () => api;
    api.select = (list: string) => {
      columns = list;
      state.selects.push(`${table}: ${list}`);
      return api;
    };
    api.eq = (column: string, value: unknown) => {
      rows = rows.filter((row) => row[column] === value);
      return api;
    };
    api.in = (column: string, values: unknown[]) => {
      rows = rows.filter((row) => values.includes(row[column]));
      return api;
    };
    api.maybeSingle = () => {
      single = true;
      return api;
    };
    api.then = (resolve: (value: unknown) => void) => {
      const missing = [...state.missingColumns].find((column) => columns.includes(column));
      if (missing) return resolve({ data: null, error: { code: '42703', message: `column visits.${missing} does not exist` } });
      return resolve({ data: single ? rows[0] ?? null : rows, error: null });
    };
    return api;
  };
  return { state, from };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from: db.from } }));

import { checkBooking, checkBookingSeries, loadVisitsInRange } from '../diaryService';
import type { AppointmentType } from '../../utils/diary/appointmentTypes';

const NEW_PATIENT: AppointmentType = { id: 't-new', name: 'New patient', visitType: 'consultation', lengthMinutes: 45, dailyLimit: 2, isActive: true };
const DAY = '2026-10-13';
const visit = (id: string, time: string, extra: Record<string, unknown> = {}) => ({
  id,
  practice_id: 'pr1',
  patient_id: `pt-${id}`,
  doctor_id: 'dr-a',
  visit_type: 'consultation',
  appointment_type_id: 't-new',
  scheduled_date: DAY,
  scheduled_time: time,
  visit_date: DAY,
  visit_time: time,
  status: 'scheduled',
  is_cancelled: false,
  duration_minutes: 45,
  ...extra
});
const proposal = { visitId: null, patientId: 'pt-new', doctorId: 'dr-a', date: DAY, time: '15:00', durationMinutes: 45 };

beforeEach(() => {
  db.state.tables = {
    visits: [visit('v1', '08:00'), visit('v2', '10:00'), visit('v3', '12:00', { status: 'cancelled', is_cancelled: true })],
    appointments: [],
    diary_blocks: []
  };
  db.state.missingColumns = new Set();
  db.state.selects = [];
});

describe("checkBooking: the appointment type's daily limit (B6)", () => {
  it('warns when the practitioner already has the most the practice books of the type that day', async () => {
    const warnings = await checkBooking({ practiceId: 'pr1', proposal, appointmentType: NEW_PATIENT, practitionerName: () => 'Dr A' });
    expect(warnings).toEqual([
      { kind: 'type_daily_limit', message: 'New patient: Dr A already has 2 on 13 Oct 2026, and the practice books at most 2 a day.' }
    ]);
  });

  // Moving one of the day's own bookings must not count it against itself, and a cancelled booking freed its place
  it('does not count the booking being moved, nor a cancelled one', async () => {
    const warnings = await checkBooking({ practiceId: 'pr1', proposal: { ...proposal, visitId: 'v2' }, appointmentType: NEW_PATIENT });
    expect(warnings).toEqual([]);
  });

  it('asks nothing extra for a type without a limit, or a standard type', async () => {
    await checkBooking({ practiceId: 'pr1', proposal, appointmentType: { ...NEW_PATIENT, dailyLimit: null } });
    await checkBooking({ practiceId: 'pr1', proposal });
    expect(db.state.selects.some((select) => select.includes('appointment_type_id, scheduled_date'))).toBe(false);
  });

  it('checks every date of a repeat booking against the limit', async () => {
    const result = await checkBookingSeries({
      practiceId: 'pr1',
      proposals: [proposal, { ...proposal, date: '2026-10-20' }],
      businessHours: null,
      appointmentType: NEW_PATIENT
    });
    expect(result.map((item) => item.warnings.map((warning) => warning.kind))).toEqual([['type_daily_limit'], []]);
  });

  // Before proposals/2026-10-12-diary-statuses-and-types.sql no booking has a type: the booking is still checked and saved
  it('skips the limit, without failing the other checks, while the database has no appointment types yet', async () => {
    db.state.missingColumns = new Set(['appointment_type_id']);
    const warnings = await checkBooking({ practiceId: 'pr1', proposal, appointmentType: NEW_PATIENT });
    expect(warnings).toEqual([]);
  });
});

describe('loadVisitsInRange before the diary update', () => {
  it("reads the bookings without the practice's status when the column is not there yet", async () => {
    db.state.missingColumns = new Set(['diary_status_id']);
    const rows = await loadVisitsInRange('pr1', DAY, DAY);
    expect(rows.map((row) => row.id)).toEqual(['v1', 'v2', 'v3']);
    const visitSelects = db.state.selects.filter((select) => select.startsWith('visits:'));
    expect(visitSelects[visitSelects.length - 1]).not.toContain('diary_status_id');
  });
});
