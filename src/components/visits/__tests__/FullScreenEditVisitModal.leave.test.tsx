/**
 * Leaving the visit screen (FullScreenEditVisitModal) never throws away what was typed without asking: the X and any
 * link that opens another page (the invoice or claim batch on the Billing tab, a medicine in stock) ask first once
 * something was typed. Staying keeps the visit and every word; nothing typed means no question. The form's own Cancel
 * stays a deliberate "throw away". The header shows the visit date day first, as Namibian practices write it.
 * The form itself (EditVisitTabs) and the database are replaced: the test is about the screen around them.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  visit: {
    id: 'visit-1',
    visit_date: '2026-10-07',
    visit_type: 'consultation',
    doctor_id: 'u1',
    patients: { first_name: 'Test', last_name: 'Patient', date_of_birth: null, gender: null }
  }
}));

vi.mock('../../../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq']) chain[name] = () => chain;
  chain.single = () => Promise.resolve({ data: mocks.visit, error: null });
  return { supabase: { from: () => chain } };
});
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1', practice_id: 'practice-1' } }) }));
vi.mock('../../../hooks/usePatientFileAccessLog', () => ({ usePatientFileAccessLog: () => undefined }));
vi.mock('../../ui/FullScreenModal', () => ({
  default: ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) =>
    isOpen ? (
      <div>
        <button type="button" onClick={onClose}>
          Backdrop
        </button>
        {children}
      </div>
    ) : null
}));
// The visit form: its line and medicine load as it opens and changes to them are reported by the real useLineEdits, as
// in EditVisitTabs; a field to type in, a line added and a medicine removed by clicking only, the Billing tab's invoice
// link, a file opened in a new tab, and Cancel
vi.mock('../EditVisitTabs', async () => {
  const { useEffect, useState } = await import('react');
  const { Link } = await import('react-router-dom');
  const { useLineEdits } = await import('../visitEdits');
  type Line = { id: string; code: string; quantity: number; totalPrice: number };
  const Form = ({
    onCancel,
    selectedServices = [],
    onSelectedServicesChange,
    onLinesEdited
  }: {
    onCancel: () => void;
    selectedServices?: Line[];
    onSelectedServicesChange?: (lines: Line[]) => void;
    onLinesEdited?: () => void;
  }) => {
    const [loaded, setLoaded] = useState(false);
    const [medicines, setMedicines] = useState<{ id: string }[]>([]);
    useEffect(() => {
      onSelectedServicesChange?.([{ id: 'line-1', code: '0190', quantity: 1, totalPrice: 520 }]);
      setMedicines([{ id: 'med-1' }]);
      setLoaded(true);
      // Loads once, as the visit opens
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useLineEdits({ ready: loaded, services: selectedServices, medications: medicines, onEdited: onLinesEdited });
    return (
      <div>
        <textarea aria-label="Clinical notes" />
        <button type="button" onClick={() => onSelectedServicesChange?.([...selectedServices, { id: 'line-2', code: '0201', quantity: 1, totalPrice: 35.5 }])}>
          Add 0201
        </button>
        <button type="button" onClick={() => setMedicines([])}>
          Remove medication
        </button>
        <Link to="/finance?invoice=inv-1">Open invoice INV-0001</Link>
        <a href="/files/result.pdf" target="_blank" rel="noreferrer" onClick={event => event.preventDefault()}>
          Open the result
        </a>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  };
  return { default: Form };
});
vi.mock('../PatientHistoryPanel', () => ({ default: () => null }));
vi.mock('../../patients/safety/ClinicalAlertStrip', () => ({ ClinicalAlertStrip: () => null }));
vi.mock('../../dental/TeethChartButton', () => ({ default: () => null }));
vi.mock('../../modals/FormModal', () => ({ default: () => null }));
vi.mock('../../dashboard/FloatingVisitTracker', () => ({ default: () => null }));
vi.mock('../../forms/PremiumAddAppointmentForm', () => ({ default: () => null }));
vi.mock('framer-motion', () => {
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return { motion: new Proxy({}, { get: () => Plain }), AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import FullScreenEditVisitModal from '../FullScreenEditVisitModal';

const PROMPT = 'You have changes on this visit that are not saved. Leave it anyway? Unsaved changes will be lost.';

const openVisit = async () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={<FullScreenEditVisitModal isOpen onClose={onClose} visitId="visit-1" patientId="patient-1" onSuccess={onSuccess} initialTab="billing" />}
        />
        <Route path="/finance" element={<p>Finance page</p>} />
      </Routes>
    </MemoryRouter>
  );
  const notes = await screen.findByLabelText('Clinical notes');
  return { onClose, onSuccess, notes };
};

const typeNote = (notes: HTMLElement) => fireEvent.change(notes, { target: { value: 'Swelling down since Monday' } });

let confirmSpy: MockInstance<typeof window.confirm>;
beforeEach(() => {
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
});
afterEach(() => {
  confirmSpy.mockRestore();
});

describe('the visit header', () => {
  it('shows the visit date day first (7 Oct 2026), never month first', async () => {
    await openVisit();
    expect(screen.getByText(/Test Patient • 7 Oct 2026 • consultation/)).toBeInTheDocument();
  });
});

describe('the X on the visit', () => {
  // Opening the visit loads its lines and medicines: that is not a change, so no question
  it('closes at once when nothing was typed, added or removed', async () => {
    const { onClose } = await openVisit();
    fireEvent.click(screen.getByRole('button', { name: 'Close visit' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // A practitioner who clicks X by mistake must not lose the consultation notes
  it('asks first once something was typed; staying keeps the visit and what was typed', async () => {
    const { onClose, notes } = await openVisit();
    typeNote(notes);
    fireEvent.click(screen.getByRole('button', { name: 'Close visit' }));
    expect(confirmSpy).toHaveBeenCalledWith(PROMPT);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Clinical notes')).toHaveValue('Swelling down since Monday');

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close visit' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // A service or tooth line added only by clicking (a code from the list, a bundle, the tooth chart) is unsaved work too
  it('asks first once a line was added by clicking only; staying keeps the visit', async () => {
    const { onClose } = await openVisit();
    fireEvent.click(screen.getByRole('button', { name: 'Add 0201' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close visit' }));
    expect(confirmSpy).toHaveBeenCalledWith(PROMPT);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks first once a medicine was removed by clicking only', async () => {
    const { onClose } = await openVisit();
    fireEvent.click(screen.getByRole('button', { name: 'Remove medication' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close visit' }));
    expect(confirmSpy).toHaveBeenCalledWith(PROMPT);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks the same way when the screen is closed from behind (the backdrop)', async () => {
    const { onClose, notes } = await openVisit();
    typeNote(notes);
    fireEvent.click(screen.getByRole('button', { name: 'Backdrop' }));
    expect(confirmSpy).toHaveBeenCalledWith(PROMPT);
    expect(onClose).not.toHaveBeenCalled();
  });

  // Cancel is the deliberate "throw this away" (as on a previous visit opened from History): no second question
  it("leaves the form's Cancel as a deliberate discard, without a question", async () => {
    const { onClose, notes } = await openVisit();
    typeNote(notes);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('links in the visit (the invoice on the Billing tab)', () => {
  // Opening the invoice in Finance closes the visit: unsaved notes would be gone
  it('ask first once something was typed; staying keeps the visit and what was typed', async () => {
    const { notes } = await openVisit();
    typeNote(notes);
    fireEvent.click(screen.getByRole('link', { name: 'Open invoice INV-0001' }));
    expect(confirmSpy).toHaveBeenCalledWith(PROMPT);
    expect(screen.queryByText('Finance page')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Clinical notes')).toHaveValue('Swelling down since Monday');
  });

  it('ask first once a line was added by clicking only', async () => {
    await openVisit();
    fireEvent.click(screen.getByRole('button', { name: 'Add 0201' }));
    fireEvent.click(screen.getByRole('link', { name: 'Open invoice INV-0001' }));
    expect(confirmSpy).toHaveBeenCalledWith(PROMPT);
    expect(screen.queryByText('Finance page')).not.toBeInTheDocument();
  });

  it('open the page when staff choose to leave', async () => {
    const { notes } = await openVisit();
    typeNote(notes);
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name: 'Open invoice INV-0001' }));
    expect(screen.getByText('Finance page')).toBeInTheDocument();
  });

  it('open the page straight away when nothing was typed', async () => {
    await openVisit();
    fireEvent.click(screen.getByRole('link', { name: 'Open invoice INV-0001' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Finance page')).toBeInTheDocument();
  });

  // A new tab leaves the visit open, so there is nothing to lose and nothing to ask
  it('never ask for a link that opens in a new tab', async () => {
    const { notes } = await openVisit();
    typeNote(notes);
    fireEvent.click(screen.getByRole('link', { name: 'Open the result' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Clinical notes')).toHaveValue('Swelling down since Monday');
  });
});
