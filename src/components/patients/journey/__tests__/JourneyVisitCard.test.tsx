import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// All people, visits and amounts are invented
const db = vi.hoisted(() => {
  const eq = vi.fn();
  const update = vi.fn(() => ({ eq }));
  return { eq, update, from: vi.fn(() => ({ update })) };
});
vi.mock('../../../../lib/supabase', () => ({ supabase: { from: db.from } }));
const toastError = vi.hoisted(() => vi.fn());
vi.mock('react-hot-toast', () => ({ default: { error: toastError } }));
// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { toPatientInvoice } from '../../patientBilling';
import { JourneyVisitCard } from '../JourneyVisitCard';
import type { JourneyVisit } from '../visitJourney';

const TODAY = '2026-10-09';
const baseVisit: JourneyVisit = {
  id: 'visit-1',
  visit_number: 18,
  visit_date: TODAY,
  visit_time: '08:30:00',
  visit_type: 'consultation',
  chief_complaint: 'Headache for 3 days',
  diagnosis: 'Tension headache',
  treatment_plan: 'Rest and fluids',
  status: 'in-progress',
  doctor: { full_name: 'Test Practitioner' },
  medications: [{}],
  lab_requests: []
};

const renderCard = (visit: JourneyVisit = baseVisit, extra: Partial<ComponentProps<typeof JourneyVisitCard>> = {}) => {
  const handlers = { onOpenVisit: vi.fn(), onOpenVisitTab: vi.fn(), onCreateFollowUp: vi.fn(), onStatusChange: vi.fn() };
  render(<JourneyVisitCard visit={visit} today={TODAY} counts={{ lab: 2, imaging: 0, media: 3 }} {...handlers} {...extra} />);
  return handlers;
};

beforeEach(() => {
  db.from.mockClear();
  db.update.mockClear();
  db.eq.mockReset().mockResolvedValue({ error: null });
  toastError.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('JourneyVisitCard', () => {
  it('shows when, why, with whom and the clinical summary in plain words', () => {
    renderCard();
    expect(screen.getByText('9 Oct 2026, 08:30')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Headache for 3 days' })).toBeInTheDocument();
    expect(screen.getByText('Consultation')).toBeInTheDocument();
    expect(screen.getByText('Dr. Test Practitioner')).toBeInTheDocument();
    expect(screen.getByText('Tension headache')).toBeInTheDocument();
    expect(screen.getByText('Rest and fluids')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('opens the visit on the tab each action names, and only that (not the visit as well)', () => {
    const handlers = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Lab, 2 lab requests' }));
    fireEvent.click(screen.getByRole('button', { name: 'Media, 3 files' }));
    fireEvent.click(screen.getByRole('button', { name: 'Imaging' }));
    fireEvent.click(screen.getByRole('button', { name: 'Medications, 1 medication' }));
    fireEvent.click(screen.getByRole('button', { name: 'Billing' }));
    expect(handlers.onOpenVisitTab.mock.calls.map(([, tab]) => tab)).toEqual(['laboratory', 'media', 'imaging', 'medications', 'billing']);
    expect(handlers.onOpenVisit).not.toHaveBeenCalled();
  });

  it('opens the visit from its main button or from anywhere on the card, as before', () => {
    const handlers = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Open visit' }));
    fireEvent.click(screen.getByText('Tension headache'));
    expect(handlers.onOpenVisit).toHaveBeenCalledTimes(2);
  });

  it('shows the bill with its amount and whether it is paid, and keeps Letters one tap away under More', () => {
    const invoices = [toPatientInvoice({ id: 'inv-1', visit_id: 'visit-1', total: 450, payment_status: 'pending' })];
    const handlers = renderCard(baseVisit, { invoices });
    expect(screen.getByRole('button', { name: 'Billing: N$ 450.00, unpaid' })).toHaveTextContent('N$ 450.00');
    fireEvent.click(screen.getByRole('button', { name: 'More actions for visit #18' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Letters' }));
    expect(handlers.onOpenVisitTab).toHaveBeenCalledWith(baseVisit, 'leave');
  });

  it('asks before marking a visit done, saves it and tells the patient file', async () => {
    const handlers = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));
    expect(window.confirm).toHaveBeenCalledWith('Mark this visit as done?');
    expect(db.update).toHaveBeenCalledWith({ status: 'completed' });
    expect(db.eq).toHaveBeenCalledWith('id', 'visit-1');
    await waitFor(() => expect(handlers.onStatusChange).toHaveBeenCalledWith('visit-1', 'completed'));
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as done' })).not.toBeInTheDocument();
  });

  it('changes nothing when the question is declined: one stray click must not complete a visit', () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));
    expect(db.update).not.toHaveBeenCalled();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('puts the status back and says so when saving fails, so the card never shows a status that was not saved', async () => {
    db.eq.mockResolvedValue({ error: { message: 'offline' } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handlers = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(handlers.onStatusChange).not.toHaveBeenCalled();
  });

  it('reopens a done visit from More after asking, and offers a follow-up there', async () => {
    const handlers = renderCard({ ...baseVisit, status: 'completed' });
    expect(screen.queryByRole('button', { name: 'Mark as done' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for visit #18' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Letters', 'Create follow-up', 'Reopen visit']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Reopen visit' }));
    expect(db.update).toHaveBeenCalledWith({ status: 'in-progress' });
    await waitFor(() => expect(handlers.onStatusChange).toHaveBeenCalledWith('visit-1', 'in-progress'));
  });

  it('can be used with the keyboard alone: arrows move through More and Escape returns to its button', () => {
    renderCard({ ...baseVisit, status: 'completed' });
    const moreButton = screen.getByRole('button', { name: 'More actions for visit #18' });
    fireEvent.click(moreButton);
    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1], { key: 'ArrowUp' });
    fireEvent.keyDown(items[0], { key: 'ArrowUp' });
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(items[2], { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(moreButton).toHaveFocus();
  });
});
