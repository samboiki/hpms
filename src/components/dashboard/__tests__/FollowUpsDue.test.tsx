/**
 * The dashboard's "To Dos": the follow-ups of patient notes due today and overdue, the user's own first, each opening
 * the patient file at its note or marked done on the spot. It used to be a disabled button.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { FollowUpsDue } from '../useFollowUpsDue';
import type { DueFollowUp } from '../../patients/notes/patientNotes';

const hook = vi.hoisted(() => ({ value: null as unknown as FollowUpsDue }));
vi.mock('../useFollowUpsDue', () => ({ useFollowUpsDue: () => hook.value }));

import { FollowUpsDueDialog } from '../FollowUpsDueDialog';
import PracticeOverviewTile from '../PracticeOverviewTile';

const today = (() => {
  const local = new Date(Date.now() + 120 * 60_000);
  return local.toISOString().slice(0, 10);
})();

const item = (overrides: Partial<DueFollowUp>): DueFollowUp => ({
  noteId: 'n',
  patientId: 'p',
  patientName: 'Test Patient',
  type: 'general',
  header: 'Call back',
  followUpOn: today,
  followUpUserId: null,
  ...overrides
});

const followUps = (overrides: Partial<FollowUpsDue> = {}): FollowUpsDue => ({
  status: 'ready',
  error: null,
  items: [],
  dueForMe: 0,
  myUserId: 'me',
  staff: [{ id: 'col', full_name: 'Ben Hamutenya', role: 'nurse', is_active: true }],
  reload: vi.fn().mockResolvedValue(undefined),
  markDone: vi.fn().mockResolvedValue(undefined),
  ...overrides
});

const Where = () => {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the follow-ups list', () => {
  // Staff deal with their own follow-ups first, then those anyone may do; colleagues' come last, with their name
  it('groups my follow-ups first, then anyone\'s, then colleagues\'', () => {
    const value = followUps({
      items: [
        item({ noteId: 'mine', patientName: 'Maria Amukoto', followUpUserId: 'me' }),
        item({ noteId: 'any', patientName: 'Johannes Shilongo', followUpUserId: null }),
        item({ noteId: 'col', patientName: 'Selma Iipinge', followUpUserId: 'col' })
      ]
    });
    render(<MemoryRouter><FollowUpsDueDialog open onClose={vi.fn()} followUps={value} /></MemoryRouter>);
    const headings = screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent);
    expect(headings).toEqual(['Yours (1)', 'For anyone (1)', 'For colleagues (1)']);
    const colleagues = screen.getByRole('region', { name: 'For colleagues (1)' });
    expect(within(colleagues).getByText('Selma Iipinge')).toBeInTheDocument();
    expect(within(colleagues).getByText(/Ben Hamutenya/)).toBeInTheDocument();
    expect(value.reload).toHaveBeenCalled();
  });

  // Each follow-up leads to the note on the patient's file, with the way back to the list
  it('opens the patient file at the note', () => {
    const onClose = vi.fn();
    const value = followUps({ items: [item({ noteId: 'n1', patientId: 'p1', followUpUserId: 'me' })] });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<FollowUpsDueDialog open onClose={onClose} followUps={value} />} />
          <Route path="/patients" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Open note/ }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/patients?patientId=p1&tab=overview&noteId=n1&returnTo=dashboard');
  });

  // Done on the spot: a quick call needs no trip to the patient file
  it('marks a follow-up done from the list', async () => {
    const value = followUps({ items: [item({ noteId: 'n1', followUpUserId: 'me' })] });
    render(<MemoryRouter><FollowUpsDueDialog open onClose={vi.fn()} followUps={value} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Mark done/ }));
    expect(value.markDone).toHaveBeenCalledWith('n1');
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark done/ })).toBeEnabled());
  });

  // An empty list says so, instead of a blank box
  it('says when nothing is due', () => {
    render(<MemoryRouter><FollowUpsDueDialog open onClose={vi.fn()} followUps={followUps()} /></MemoryRouter>);
    expect(screen.getByText(/Nothing to follow up today/)).toBeInTheDocument();
  });
});

describe('To Dos on the dashboard', () => {
  // The button used to be disabled ("the app has no to-do list"); it now opens the follow-ups and shows how many
  it('opens the follow-ups and shows how many are due for me', () => {
    hook.value = followUps({ dueForMe: 2, items: [item({ noteId: 'n1', followUpUserId: 'me' }), item({ noteId: 'n2' })] });
    render(<MemoryRouter><PracticeOverviewTile totalPatients={0} todayAppointments={0} pendingAppointments={0} completedToday={0} practiceStatus="quiet" /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'To Dos: 2 follow-ups due' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Follow-ups due' })).toBeInTheDocument();
  });

  // Before the notes tables exist there is nothing to open: the button says why instead of opening an empty box
  it('stays off, saying why, before patient notes are set up', () => {
    hook.value = followUps({ status: 'not_set_up' });
    render(<MemoryRouter><PracticeOverviewTile totalPatients={0} todayAppointments={0} pendingAppointments={0} completedToday={0} practiceStatus="quiet" /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'To Dos' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', expect.stringContaining('not set up'));
  });
});

// Submit Batch opens Finance > Batches: a role the practice keeps out of Finance would land on "ask your administrator"
describe('Submit Batch on the dashboard', () => {
  it('opens for roles with Finance', () => {
    render(<MemoryRouter><PracticeOverviewTile totalPatients={0} todayAppointments={0} pendingAppointments={0} completedToday={0} practiceStatus="quiet" financeOpen /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Submit Batch/ })).toBeEnabled();
  });

  it('stays off, saying why, for a role without Finance', () => {
    render(<MemoryRouter><PracticeOverviewTile totalPatients={0} todayAppointments={0} pendingAppointments={0} completedToday={0} practiceStatus="quiet" financeOpen={false} /></MemoryRouter>);
    const button = screen.getByRole('button', { name: /Submit Batch/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', expect.stringContaining('not opened to your role'));
  });
});
