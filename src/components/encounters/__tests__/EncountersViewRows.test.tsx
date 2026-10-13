/**
 * The Encounters list. The view repeats a visit that has two invoices or two medical aid rows, so a visit was listed
 * twice and the counts were too high; dates had no year on a list that reaches back years; a part-paid or cancelled
 * invoice showed "N/A"; and exporting an empty list said "exported successfully".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { onePerVisit, paymentStatusText } from '../../../utils/encounters/encounterRows';

const ROW = {
  visit_id: 'visit-1', sequential_number: 12, system_sequence_visit_number: 3, visit_status: 'completed', template_name: '',
  visit_date: '2024-10-09', schedule_date: '2024-10-09', practice: 'Example practice', patient_name: 'Example Patient',
  patient_id: 'patient-1', medical_aid_name: 'No Medical Aid', medical_aid_number: '', visit_type: 'follow-up',
  chief_complaint: 'Cough', total_bill: 450, invoice_number: 'INV-000001', payment_status: 'partial',
  created_at: '2024-10-09T08:00:00Z', updated_at: '2024-10-09T08:00:00Z', duration_minutes: 30, is_scheduled: false,
  is_confirmed: true, is_checked_in: true, is_cancelled: false, doctor_id: 'practitioner-1', practice_id: 'practice-1',
  branch_id: null, branch_name: null, pending_lab_requests: 0, pending_imaging_requests: 0
};

const db = vi.hoisted(() => {
  const rows: Record<string, unknown[]> = {};
  const query = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'is', 'lte', 'gte', 'or', 'order', 'range']) builder[method] = () => builder;
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve, reject);
    return builder;
  };
  return { rows, supabase: { from: (table: string) => query(table) } };
});
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast }));
vi.mock('../../../lib/supabase', () => ({ supabase: db.supabase }));
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1', isLoading: false }) }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => vi.fn()
}));

import { EncountersView } from '../EncountersView';

afterEach(() => {
  cleanup();
  toast.error.mockReset();
  toast.success.mockReset();
});

describe('one row per visit', () => {
  it('keeps the first row of a visit the view repeats', () => {
    expect(onePerVisit([{ visit_id: 'a', n: 1 }, { visit_id: 'a', n: 2 }, { visit_id: 'b', n: 3 }])).toEqual([
      { visit_id: 'a', n: 1 },
      { visit_id: 'b', n: 3 }
    ]);
  });

  it('lists a visit with two invoices once', async () => {
    db.rows.encounters_view = [ROW, { ...ROW, invoice_number: 'INV-000002' }];
    db.rows.branches = [];
    render(<EncountersView />);
    expect(await screen.findAllByText('Example Patient')).toHaveLength(1);
  });
});

describe('the list in plain words', () => {
  it('writes the year, the visit type and a part payment', async () => {
    db.rows.encounters_view = [ROW];
    db.rows.branches = [];
    render(<EncountersView />);
    await screen.findByText('Example Patient');
    expect(screen.getAllByText('9 Oct 2024').length).toBeGreaterThan(0);
    expect(screen.getByText('Follow-up')).toBeInTheDocument();
    expect(screen.getByText('Part paid')).toBeInTheDocument();
  });

  it('says "No invoice" for a visit without one, "Cancelled" for a cancelled invoice', () => {
    expect(paymentStatusText(null, false)).toBe('No invoice');
    expect(paymentStatusText(null, true)).toBe('Pending');
    expect(paymentStatusText('cancelled', true)).toBe('Cancelled');
  });

  it('says there is nothing to export instead of downloading an empty file', async () => {
    db.rows.encounters_view = [];
    db.rows.branches = [];
    render(<EncountersView />);
    await screen.findByText(/No encounters found|No visits/i);
    fireEvent.click(screen.getByRole('button', { name: /CSV/i }));
    expect(toast.error).toHaveBeenCalledWith('There are no visits to export');
    expect(toast.success).not.toHaveBeenCalled();
  });
});
