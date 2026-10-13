import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// Invented rows only: no real patients, practitioners or visits
const ROW = {
  visit_id: 'visit-1',
  sequential_number: 12,
  system_sequence_visit_number: 3,
  visit_status: 'completed',
  template_name: '',
  visit_date: '2026-10-09',
  schedule_date: '2026-10-09',
  practice: 'Example practice',
  patient_name: 'Example Patient',
  patient_id: 'patient-1',
  medical_aid_name: 'No Medical Aid',
  medical_aid_number: '',
  visit_type: 'consultation',
  chief_complaint: 'Cough',
  total_bill: 450,
  invoice_number: 'INV-000001',
  payment_status: 'pending',
  created_at: '2026-10-09T08:00:00Z',
  updated_at: '2026-10-09T08:00:00Z',
  duration_minutes: 30,
  is_scheduled: false,
  is_confirmed: true,
  is_checked_in: true,
  is_cancelled: false,
  doctor_id: 'practitioner-1',
  practice_id: 'practice-1',
  branch_id: null,
  branch_name: null,
  pending_lab_requests: 0,
  pending_imaging_requests: 0
};

const db = vi.hoisted(() => {
  const rows: Record<string, unknown[]> = {};
  const errors: Record<string, { message: string } | null> = {};
  // A query builder that answers every chained call and resolves to the table's rows (or its error)
  const query = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'is', 'lte', 'order', 'range']) builder[method] = () => builder;
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(errors[table] ? { data: null, error: errors[table] } : { data: rows[table] ?? [], error: null }).then(resolve, reject);
    return builder;
  };
  return { rows, errors, supabase: { from: (table: string) => query(table) } };
});
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast }));
vi.mock('../../../lib/supabase', () => ({ supabase: db.supabase }));
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1', isLoading: false }) }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate
}));

import { EncountersView } from '../EncountersView';

afterEach(() => {
  cleanup();
  navigate.mockReset();
  toast.error.mockReset();
  db.errors.encounters_view = null;
});

const showList = async () => {
  db.rows.encounters_view = [ROW];
  db.rows.branches = [];
  render(<EncountersView />);
  const name = await screen.findByText('Example Patient');
  return name.closest('tr') as HTMLElement;
};

describe('Encounters list row actions', () => {
  // The row opens the visit, but a click on a button in the row is ignored by the row: the eye button did
  // nothing at all, so reception tapping "view" on a visit got no response
  it('the view button opens the visit, as the row does', async () => {
    const row = await showList();
    fireEvent.click(within(row).getByRole('button', { name: 'Open the visit' }));
    expect(navigate).toHaveBeenCalledWith('/patients?patientId=patient-1&visitId=visit-1&action=edit-visit');
  });

  // The second button (three dots) did nothing either: it now opens the patient's file on its visits, so the
  // list links back to the file every visit belongs to
  it("the second button opens the patient's file on its visits", async () => {
    const row = await showList();
    fireEvent.click(within(row).getByRole('button', { name: "Open the patient's file" }));
    expect(navigate).toHaveBeenCalledWith('/patients?patientId=patient-1&tab=encounters');
  });

  it('a click on the row still opens the visit', async () => {
    const row = await showList();
    fireEvent.click(within(row).getByText('Cough'));
    expect(navigate).toHaveBeenCalledWith('/patients?patientId=patient-1&visitId=visit-1&action=edit-visit');
  });
});

describe('Encounters list loading and export', () => {
  // A failed load showed "No encounters found", as if the practice had seen nobody
  it('says the visits could not be loaded instead of showing an empty list', async () => {
    db.errors.encounters_view = { message: 'connection lost' };
    db.rows.branches = [];
    render(<EncountersView />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The visits could not be loaded. Please try again.'));
  });

  // The tick boxes fed no action: an export took every visit on the list whatever was ticked
  it('exports only the ticked visits when some are ticked', async () => {
    db.rows.encounters_view = [ROW, { ...ROW, visit_id: 'visit-2', patient_id: 'patient-2', patient_name: 'Second Example', sequential_number: 13 }];
    db.rows.branches = [];
    // jsdom has no object URLs: the download's file is caught here instead
    const blobs: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        blobs.push(blob);
        return 'blob:example';
      },
      revokeObjectURL: () => undefined
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<EncountersView />);
    const row = (await screen.findByText('Second Example')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Export to CSV' }));
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blobs[0]);
    });
    expect(csv).toContain('Second Example');
    expect(csv).not.toContain('Example Patient');
    click.mockRestore();
  });
});
