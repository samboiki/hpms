import { beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for the Supabase query builder: records the calls and answers with the queued result
const calls = vi.hoisted(() => ({ list: [] as Array<{ method: string; args: unknown[] }>, result: { data: null as unknown, error: null as unknown } }));
vi.mock('../../lib/supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['from', 'select', 'update', 'eq', 'is', 'gte', 'lte', 'order', 'range']) {
    builder[method] = (...args: unknown[]) => {
      calls.list.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = () => Promise.resolve(calls.result);
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(calls.result).then(resolve, reject);
  return { supabase: builder };
});

import { DueDatesNotSetUpError, MAX_DUE_LIST, isDueDatesNotSetUp, listDueDates, loadDueDate, saveDueDate } from '../pregnancyService';

beforeEach(() => {
  calls.list = [];
  calls.result = { data: null, error: null };
});

describe('pregnancy due dates on the patient file', () => {
  it('says "not set up yet" only for its own missing column, so another broken column is still reported', () => {
    expect(isDueDatesNotSetUp({ code: '42703', message: 'column patients.pregnancy_due_date does not exist' })).toBe(true);
    expect(isDueDatesNotSetUp({ code: 'PGRST204', message: "Could not find the 'pregnancy_due_date' column of 'patients'" })).toBe(true);
    expect(isDueDatesNotSetUp({ code: '42703', message: 'column patients.title does not exist' })).toBe(false);
  });

  it('reads the date as a day, whatever form the database sends it in', async () => {
    calls.result = { data: { pregnancy_due_date: '2027-03-14' }, error: null };
    await expect(loadDueDate('patient-1')).resolves.toBe('2027-03-14');
    calls.result = { data: { pregnancy_due_date: null }, error: null };
    await expect(loadDueDate('patient-1')).resolves.toBeNull();
  });

  it('turns the missing column into "not set up yet" instead of an error on the file', async () => {
    calls.result = { data: null, error: { code: '42703', message: 'column patients.pregnancy_due_date does not exist' } };
    await expect(loadDueDate('patient-1')).rejects.toBeInstanceOf(DueDatesNotSetUpError);
  });

  it("changes only this practice's file, and says so when nothing could be changed", async () => {
    calls.result = { data: [{ id: 'patient-1' }], error: null };
    await saveDueDate('practice-1', 'patient-1', '2027-03-14');
    expect(calls.list).toContainEqual({ method: 'update', args: [{ pregnancy_due_date: '2027-03-14' }] });
    expect(calls.list).toContainEqual({ method: 'eq', args: ['practice_id', 'practice-1'] });
    calls.result = { data: [], error: null };
    await expect(saveDueDate('practice-1', 'patient-1', null)).rejects.toThrow("This patient's file could not be changed from your practice.");
  });
});

describe('the due-dates list', () => {
  it('asks for the period soonest first, leaving out files merged into another', async () => {
    calls.result = { data: [{ id: 'p1', first_name: ' Maria ', last_name: 'Example', cell_number: '', pregnancy_due_date: '2026-11-02' }], error: null };
    const result = await listDueDates('practice-1', { from: '2026-10-13', to: '2026-11-09' });
    expect(result).toEqual({ patients: [{ patientId: 'p1', firstName: 'Maria', lastName: 'Example', cellNumber: null, dueDate: '2026-11-02' }], more: false });
    expect(calls.list).toContainEqual({ method: 'is', args: ['merged_into_patient_id', null] });
    expect(calls.list).toContainEqual({ method: 'gte', args: ['pregnancy_due_date', '2026-10-13'] });
    expect(calls.list).toContainEqual({ method: 'lte', args: ['pregnancy_due_date', '2026-11-09'] });
  });

  it('says when a period holds more patients than one screen lists', async () => {
    calls.result = {
      data: Array.from({ length: MAX_DUE_LIST + 1 }, (_, index) => ({ id: `p${index}`, first_name: 'A', last_name: 'B', cell_number: null, pregnancy_due_date: '2026-11-02' })),
      error: null
    };
    const result = await listDueDates('practice-1', { from: '2026-10-13', to: '2026-11-09' });
    expect(result.patients).toHaveLength(MAX_DUE_LIST);
    expect(result.more).toBe(true);
  });
});
