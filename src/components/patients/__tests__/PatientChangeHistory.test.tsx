import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PatientChangeHistory from '../PatientChangeHistory';
import { patientHistoryFilter } from '../changeHistory';
import { supabase } from '../../../lib/supabase';

// Invented ids and values only; nothing here reaches a database
const PATIENT = '11111111-1111-4111-8111-111111111111';
const OTHER_PATIENT = '22222222-2222-4222-8222-222222222222';
const VISIT = '33333333-3333-4333-8333-333333333333';
const DOCTOR = '55555555-5555-4555-8555-555555555555';
const RECEPTION = '66666666-6666-4666-8666-666666666666';

const auth = vi.hoisted(() => ({ user: { id: 'me', role: 'admin', is_super_admin: false } }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (select: (state: typeof auth) => unknown) => select(auth) }));
vi.mock('../../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

type Op = [string, unknown[]];
const queries: Array<{ table: string; ops: Op[] }> = [];

const file = (cell: string) => ({ id: PATIENT, first_name: 'Test', last_name: 'Example', cell_number: cell });
const PAGE = [
  { id: 'a3', table_name: 'patients', record_id: PATIENT, action: 'UPDATE', old_values: null, new_values: file('+264 81 000 0002'), user_id: RECEPTION, created_at: '2026-10-09T07:00:00+00:00' },
  { id: 'a2', table_name: 'visits', record_id: VISIT, action: 'INSERT', old_values: null, new_values: { id: VISIT, patient_id: PATIENT, doctor_id: DOCTOR, scheduled_date: '2026-10-12', scheduled_time: '10:00:00', status: 'scheduled' }, user_id: DOCTOR, created_at: '2026-10-05T07:00:00+00:00' },
  { id: 'a1', table_name: 'patients', record_id: PATIENT, action: 'INSERT', old_values: null, new_values: file('+264 81 000 0001'), user_id: RECEPTION, created_at: '2026-10-01T07:00:00+00:00' },
  // Another patient's entry, as if the query had let it through
  { id: 'b1', table_name: 'patients', record_id: OTHER_PATIENT, action: 'INSERT', old_values: null, new_values: { id: OTHER_PATIENT, first_name: 'Someone', last_name: 'Else' }, user_id: RECEPTION, created_at: '2026-10-08T07:00:00+00:00' }
];

const resultFor = (table: string): unknown => {
  if (table === 'visits') return [{ id: VISIT }];
  if (table === 'users') return [{ id: RECEPTION, full_name: 'B Helper', role: 'receptionist' }, { id: DOCTOR, full_name: 'A Tester', role: 'doctor' }];
  if (table === 'patient_audit_logs') return PAGE;
  return [];
};

/** A stand-in for the Supabase query builder: records each call and resolves with the table's rows */
const builder = (table: string): unknown => {
  const ops: Op[] = [];
  queries.push({ table, ops });
  const chain: object = new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === 'then'
          ? (done: (value: unknown) => unknown) => Promise.resolve({ data: resultFor(table), error: null }).then(done)
          : (...args: unknown[]) => {
              ops.push([String(prop), args]);
              return chain;
            }
    }
  );
  return chain;
};

beforeEach(() => {
  queries.length = 0;
  auth.user.role = 'admin';
  vi.mocked(supabase.from).mockReset();
  vi.mocked(supabase.from).mockImplementation(((table: string) => builder(table)) as never);
});

describe('the Change history tab', () => {
  // The trail holds whole patient, visit and medical aid rows: only practice administrators may read it
  it('tells anyone else in one calm sentence and reads nothing', () => {
    auth.user.role = 'receptionist';
    render(<PatientChangeHistory patientId={PATIENT} />);
    expect(screen.getByText(/shown to practice administrators only/)).toBeInTheDocument();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("lists this patient's changes in plain words, shows values only on a tap, and opens a visit", async () => {
    const onOpenVisit = vi.fn();
    render(<PatientChangeHistory patientId={PATIENT} onOpenVisit={onOpenVisit} />);

    const change = await screen.findByRole('button', { name: /Cell number changed/ });
    expect(screen.getAllByText('B Helper (Receptionist) · 9 Oct 2026, 09:00')).toHaveLength(1);
    expect(screen.getByText('Visit added for 12 Oct 2026')).toBeInTheDocument();
    expect(screen.queryByText('Someone')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^(Patient registered|Cell number changed|Visit added)/ })).toHaveLength(3);

    // The number is personal data: not in the list until the change is opened
    expect(screen.queryByText('+264 81 000 0002')).toBeNull();
    fireEvent.click(change);
    expect(change).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('+264 81 000 0001')).toBeInTheDocument();
    expect(screen.getByText('+264 81 000 0002')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Open visit/ }));
    expect(onOpenVisit).toHaveBeenCalledWith(VISIT);

    // The page asked only for this patient's entries: the file's own filter plus the vitals of its own visits
    const page = queries.find(query => query.table === 'patient_audit_logs');
    expect(page?.ops).toContainEqual(['or', [patientHistoryFilter(PATIENT, [VISIT])]]);
  });

  it('filters by what changed, asking the database for that kind of record only', async () => {
    render(<PatientChangeHistory patientId={PATIENT} />);
    await screen.findByRole('button', { name: /Cell number changed/ });
    queries.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Medical aid' }));
    await waitFor(() => expect(queries.some(query => query.table === 'patient_audit_logs')).toBe(true));
    const page = queries.find(query => query.table === 'patient_audit_logs');
    expect(page?.ops).toContainEqual(['eq', ['table_name', 'medical_aid_details']]);
    expect(screen.getByRole('button', { name: 'Medical aid' })).toHaveAttribute('aria-pressed', 'true');
  });
});
