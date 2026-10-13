/**
 * The two figures a patient opens the app for, in the app's own cards: the next appointment (a link to the
 * appointments, with its day, time and whether the practice confirmed it) and what the patient owes (with what the
 * medical aid still has to pay, which is not the patient's to pay, and how many invoices are overdue).
 * The portal_* database functions are replaced; invented data.
 */
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { format } from 'date-fns';
import { PortalContext, type PortalContextValue } from '../portalContext';

const backend = vi.hoisted(() => ({ appointments: [] as unknown[], invoices: [] as unknown[] }));

// Icons are decorative here; a real icon fetches its shape on a timer that can outlive the test
vi.mock('@iconify/react', async (importOriginal) => ({ ...(await importOriginal<typeof import('@iconify/react')>()), Icon: () => null }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (fn: string) => ({
      data: fn === 'portal_appointments' ? backend.appointments : fn === 'portal_invoices' ? backend.invoices : [],
      error: null
    })),
    from: vi.fn()
  }
}));

import HomePage from '../pages/HomePage';
import { InvoicesPage } from '../pages/InvoicesPage';

const person = {
  patientId: 'pat-1', relationship: 'self' as const, firstName: 'Test', lastName: 'Patient', dateOfBirth: null, gender: null, idNumber: null,
  cellNumber: null, email: null, homeAddress: null, postalAddress: null, postalCode: null, practiceId: 'practice-1', practiceName: 'Test Practice',
  practicePhone: null, practiceEmail: null, practiceAddress: null, bank: null
};
const portal: PortalContextValue = {
  patients: [person], selected: person, selectPatient: vi.fn(), status: null, loadState: 'ready', reload: vi.fn(), signOut: vi.fn()
};

const renderPage = (page: ReactNode) =>
  render(
    <MemoryRouter>
      <PortalContext.Provider value={portal}>{page}</PortalContext.Provider>
    </MemoryRouter>
  );

// Three days ahead, so it is always the next appointment
const nextDay = new Date(Date.now() + 3 * 86400000);
const nextDayKey = format(nextDay, 'yyyy-MM-dd');

const invoice = (overrides: Record<string, unknown>) => ({
  id: 'inv-1', invoice_number: 'INV-000101', total: 1450.5, medical_aid_total: 1000, patient_total: 450.5, payment_status: 'pending',
  issue_date: '2026-09-02', practice_id: 'practice-1', practice_name: 'Test Practice', ...overrides
});

beforeEach(() => {
  backend.appointments = [];
  backend.invoices = [];
});

describe('Home: the next appointment', () => {
  it('shows its day, time and confirmation, and opens the appointments when tapped', async () => {
    backend.appointments = [
      { visit_id: 'v-1', practice_id: 'practice-1', status: 'scheduled', is_confirmed: true, scheduled_date: nextDayKey, scheduled_time: '10:30:00', visit_type: 'consultation', doctor_name: 'Dr Test', practice_name: 'Test Practice' }
    ];
    renderPage(<HomePage />);

    const tile = await screen.findByRole('link', { name: /Next appointment/ });
    expect(tile).toHaveAttribute('href', '/me/appointments');
    expect(tile).toHaveTextContent(`${format(nextDay, 'EEE d MMM yyyy')}, 10:30`);
    expect(tile).toHaveTextContent('Confirmed');
    expect(tile).toHaveTextContent('with Dr Test');
  });
});

describe('Invoices: what the patient owes', () => {
  it('shows the amount owed, the medical aid part still to be paid, and how many invoices are overdue', async () => {
    backend.invoices = [invoice({ payment_status: 'overdue' })];
    renderPage(<InvoicesPage />);

    const owed = await screen.findByText('You owe');
    const tile = owed.parentElement as HTMLElement;
    expect(tile).toHaveTextContent('N$ 450.50');
    expect(tile).toHaveTextContent('Medical aid still to pay: N$ 1,000.00');
    expect(tile).toHaveTextContent('1 overdue invoice');
  });

  it('shows N$ 0.00 owed, and no medical aid or overdue line, once everything is paid', async () => {
    backend.invoices = [invoice({ payment_status: 'paid' })];
    renderPage(<InvoicesPage />);

    const tile = (await screen.findByText('You owe')).parentElement as HTMLElement;
    expect(tile).toHaveTextContent('N$ 0.00');
    expect(tile).not.toHaveTextContent('Medical aid still to pay');
    expect(tile).not.toHaveTextContent('overdue');
  });
});
