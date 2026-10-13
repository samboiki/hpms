import { afterEach, describe, expect, it, vi } from 'vitest';

// One invented open lab order and its patient
const tables = vi.hoisted(() => ({
  rows: {
    optometry_lab_orders: [{ id: 'order-1', order_no: 7, patient_id: 'patient-1', prescription_id: 'rx-1', status: 'ordered', status_on: '2026-10-10', ordered_on: '2026-10-10' }],
    optometry_lab_order_events: [],
    optometry_prescriptions: [],
    patients: [{ id: 'patient-1', first_name: 'Example', last_name: 'Patient', date_of_birth: '1961-04-02' }]
  } as Record<string, unknown[]>
}));
vi.mock('../../lib/supabase', () => {
  const query = (table: string): unknown =>
    new Proxy(
      {},
      {
        get: (_target, key) =>
          key === 'then'
            ? (resolve: (value: unknown) => unknown) => Promise.resolve({ data: tables.rows[table] ?? [], error: null }).then(resolve)
            : () => query(table)
      }
    );
  return { supabase: { from: (table: string) => query(table) } };
});

import { loadPracticeLabOrders } from '../optometry/optometryService';

afterEach(() => vi.clearAllMocks());

describe("the Optometry page's open lab orders", () => {
  // A slip printed from the Optometry page left out the patient's date of birth, which the Eyes tab's slip prints:
  // the lab matches the job to the right person by name and birth date
  it("carry the patient's date of birth for the lab slip", async () => {
    const load = await loadPracticeLabOrders('practice-1', { openOnly: true });
    expect(load.status).toBe('ready');
    if (load.status !== 'ready') return;
    expect(load.orders[0]).toMatchObject({ patientName: 'Example Patient', patientDateOfBirth: '1961-04-02' });
  });
});
