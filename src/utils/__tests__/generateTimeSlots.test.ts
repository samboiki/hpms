import { describe, it, expect, vi, beforeEach } from 'vitest';

// Answers per table; `or`/`eq`/`neq` filters are recorded but the rows are given by each test
const db = vi.hoisted(() => {
  const state = { rows: {} as Record<string, unknown[]> };
  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'neq', 'or']) builder[method] = () => builder;
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.rows[table] ?? [], error: null }).then(resolve, reject);
    return builder;
  };
  return { state, makeBuilder };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (table: string) => db.makeBuilder(table) },
}));

import { generateTimeSlots, type ConflictVisit } from '../appointments';

const day = new Date(2026, 9, 6);
const visit = (overrides: Partial<ConflictVisit>): ConflictVisit => ({
  id: 'v1',
  visit_date: '2026-10-06',
  visit_time: '09:00',
  scheduled_date: '2026-10-06',
  scheduled_time: '09:00',
  status: 'scheduled',
  is_cancelled: false,
  ...overrides,
});
const slotAt = (slots: Awaited<ReturnType<typeof generateTimeSlots>>, hh: number, mm: number) =>
  slots.find((slot) => slot.start.getHours() === hh && slot.start.getMinutes() === mm);

describe('generateTimeSlots', () => {
  beforeEach(() => {
    db.state.rows = { appointments: [], visits: [] };
  });

  it("marks a booked visit's slot as taken", async () => {
    db.state.rows.visits = [visit({})];
    const slots = await generateTimeSlots(day, 'doctor-1');
    expect(slotAt(slots, 9, 0)?.available).toBe(false);
    expect(slotAt(slots, 9, 30)?.available).toBe(true);
  });

  it('frees the old day once a visit is rescheduled to another day, even if its visit_date was left behind', async () => {
    // Older reschedules only moved scheduled_*; the query still finds the visit through visit_date
    db.state.rows.visits = [visit({ visit_date: '2026-10-06', visit_time: '09:00', scheduled_date: '2026-10-08', scheduled_time: '14:00' })];
    const slots = await generateTimeSlots(day, 'doctor-1');
    expect(slots.every((slot) => slot.available)).toBe(true);
  });

  it('keeps walk-in visits that only have a visit date and time', async () => {
    db.state.rows.visits = [visit({ scheduled_date: null, scheduled_time: null, visit_time: '10:00' })];
    const slots = await generateTimeSlots(day, 'doctor-1');
    expect(slotAt(slots, 10, 0)?.available).toBe(false);
  });
});
