import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addMonthsToKey } from '../../../utils/billing/dates';
import { windhoekClock } from '../../../utils/patientLists/listDates';
import type { PatientRecall } from '../../../utils/patientLists/recalls';

const service = vi.hoisted(() => ({
  loadForPatient: vi.fn(),
  setRecall: vi.fn(),
  removeRecall: vi.fn()
}));

vi.mock('../../../services/patientRecallService', () => ({
  patientRecallService: service,
  isRecallsNotSetUpError: (error: unknown) => (error as { code?: string } | null)?.code === '42P01'
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// Icons load their drawings later; in a test that can land after the page is gone ("window is not defined")
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { RecallSheet } from '../RecallSheet';

const today = windhoekClock(new Date()).dateKey;

const openRecall = (overrides: Partial<PatientRecall> = {}): PatientRecall => ({
  id: 'r1',
  patientId: 'p1',
  dueOn: addMonthsToKey(today, 6),
  reason: '6-monthly check-up',
  visitId: null,
  createdAt: null,
  status: 'open',
  matchedVisitId: null,
  matchedOn: null,
  ...overrides
});

const renderSheet = (props: Partial<React.ComponentProps<typeof RecallSheet>> = {}) =>
  render(<RecallSheet open onClose={() => undefined} practiceId="practice-1" patientId="p1" patientName="Maria Shikongo" {...props} />);

describe('RecallSheet', () => {
  beforeEach(() => {
    service.loadForPatient.mockReset().mockResolvedValue([]);
    service.setRecall.mockReset().mockResolvedValue('r-new');
    service.removeRecall.mockReset().mockResolvedValue(undefined);
  });

  // Set from a visit, the recall remembers that visit: the database never counts it as the patient coming back
  it('sets a recall in two taps (6 months, a common reason) and sends the visit it was set from', async () => {
    renderSheet({ visitId: 'visit-9' });
    await screen.findByText('No recall set.');
    fireEvent.click(screen.getByRole('button', { name: 'In 6 months' }));
    fireEvent.click(screen.getByRole('button', { name: '6-monthly check-up' }));
    fireEvent.click(screen.getByRole('button', { name: /Set recall/ }));
    await waitFor(() => expect(service.setRecall).toHaveBeenCalledTimes(1));
    expect(service.setRecall).toHaveBeenCalledWith({
      practiceId: 'practice-1',
      patientId: 'p1',
      dueOn: addMonthsToKey(today, 6),
      reason: '6-monthly check-up',
      visitId: 'visit-9',
      recallId: null
    });
  });

  it('says what is missing instead of sending a recall without a reason', async () => {
    renderSheet();
    await screen.findByText('No recall set.');
    fireEvent.click(screen.getByRole('button', { name: 'In 2 weeks' }));
    fireEvent.click(screen.getByRole('button', { name: /Set recall/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Say what the recall is for');
    expect(service.setRecall).not.toHaveBeenCalled();
  });

  it('shows a booked recall as taken care of, with no Change or Remove (the booking completes it)', async () => {
    service.loadForPatient.mockResolvedValue([openRecall({ status: 'booked', matchedOn: addMonthsToKey(today, 6) })]);
    renderSheet();
    expect(await screen.findByText(/^Booked for /)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove the recall/ })).not.toBeInTheDocument();
  });

  it('changes an open recall in place rather than adding a second one', async () => {
    service.loadForPatient.mockResolvedValue([openRecall()]);
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: 'Change the recall: 6-monthly check-up' }));
    fireEvent.click(screen.getByRole('button', { name: 'In 1 year' }));
    fireEvent.click(screen.getByRole('button', { name: /Save the change/ }));
    await waitFor(() => expect(service.setRecall).toHaveBeenCalledTimes(1));
    expect(service.setRecall.mock.calls[0][0]).toMatchObject({ recallId: 'r1', dueOn: addMonthsToKey(today, 12), visitId: null });
  });

  it('says recalls are not set up yet before the database has them', async () => {
    service.loadForPatient.mockRejectedValue({ code: '42P01', message: 'relation "patient_recall_status" does not exist' });
    renderSheet();
    expect(await screen.findByText('Recalls are not set up in this database yet.')).toBeInTheDocument();
  });
});
