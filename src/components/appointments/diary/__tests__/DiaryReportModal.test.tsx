import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { DiaryReport } from '../../../../services/diaryReportService';
import type { PractitionerReportRow, ReportBooking } from '../../../../utils/diary/diaryReport';
import type { PatientRecall } from '../../../../utils/patientLists/recalls';
import { diaryRangeFor } from '../../../../utils/diary/diaryRange';
import { addDaysToKey } from '../../../../utils/diary/diaryTime';
import { windhoekClock } from '../../../../utils/patientLists/listDates';

// The report's data come from services: here an invented practice with two practitioners
const mocks = vi.hoisted(() => ({
  report: null as unknown,
  notSeen: [] as unknown[],
  setRecalls: vi.fn(),
  loadOpenInRange: vi.fn(),
  loadInForce: vi.fn(),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('react-hot-toast', () => ({ toast: mocks.toast }));
vi.mock('../../../../services/diaryReportService', () => ({ loadDiaryReport: vi.fn(async () => ({ state: 'ready', report: mocks.report })) }));
vi.mock('../../../../services/patientRecallService', () => ({
  isRecallsNotSetUpError: () => false,
  patientRecallService: {
    loadOpenInRange: mocks.loadOpenInRange,
    loadPatients: vi.fn(async () => new Map([['pt-2', { id: 'pt-2', name: 'Recalled Patient', cellNumber: null }]])),
    loadInForceForPatients: mocks.loadInForce,
    setRecalls: mocks.setRecalls
  }
}));
// The list sheet is tested on its own: here "Move to a recall list" adds everyone at once
vi.mock('../../../patientLists/AddToListButton', () => ({
  AddToListButton: (props: { label?: string; onAdded?: (result: { listId: string; listName: string; added: number }) => void }) => (
    <button type="button" onClick={() => props.onAdded?.({ listId: 'list-1', listName: 'Recall list', added: 1 })}>
      {props.label}
    </button>
  )
}));

import { DiaryReportModal } from '../DiaryReportModal';

const thisWeek = diaryRangeFor('week', new Date());
const lastWeekStart = addDaysToKey(thisWeek.from, -7);
const today = windhoekClock(new Date()).dateKey;

const booking = (id: string, patientId: string, practitionerId: string | null, date: string, outcome: ReportBooking['outcome']): ReportBooking => ({
  id,
  patientId,
  patientName: `Patient ${id.toUpperCase()}`,
  practitionerId,
  date,
  time: '09:00',
  outcome,
  minutes: 30
});
const row = (practitionerId: string, name: string, ids: Partial<PractitionerReportRow>): PractitionerReportRow => ({
  practitionerId,
  name,
  bookingIds: [],
  seenIds: [],
  noShowIds: [],
  cancelledIds: [],
  upcomingIds: [],
  unmarkedIds: [],
  bookedMinutes: 0,
  availableMinutes: null,
  noShowRate: null,
  cancellationRate: null,
  utilisation: null,
  ...ids
});
const reportOf = (bookings: ReportBooking[], rows: PractitionerReportRow[]): DiaryReport => ({
  from: thisWeek.from,
  to: thisWeek.to,
  rows,
  bookingsById: new Map(bookings.map((item) => [item.id, item])),
  statusCounts: []
});
const recall = (id: string, patientId: string, dueOn: string): PatientRecall => ({
  id,
  patientId,
  dueOn,
  reason: '6-monthly check-up',
  visitId: null,
  createdAt: null,
  status: 'open',
  matchedVisitId: null,
  matchedOn: null
});

const renderReport = () => {
  const onOpenDay = vi.fn();
  render(
    <DiaryReportModal
      isOpen
      onClose={() => {}}
      practiceId="practice-1"
      practitioners={[{ id: 'dr-1', name: 'Doctor One' }, { id: 'dr-2', name: 'Doctor Two' }]}
      onOpenDay={onOpenDay}
    />
  );
  return { onOpenDay };
};

beforeEach(() => {
  mocks.loadOpenInRange.mockReset().mockResolvedValue([]);
  mocks.loadInForce.mockReset().mockResolvedValue([]);
  mocks.setRecalls.mockReset().mockResolvedValue({ set: 1, refused: 0, firstRefusal: null });
  mocks.toast.success.mockReset();
  mocks.toast.error.mockReset();
});
afterEach(cleanup);

// The report's bookings opened their day only: a doctor's diary showed their own column and the time grid left
// cancelled bookings out, so the booking clicked was not there
describe('DiaryReportModal: opening a booking', () => {
  it("opens a cancelled booking's day with its practitioner and the cancelled bookings", async () => {
    const cancelled = booking('c1', 'pt-1', 'dr-2', thisWeek.from, 'cancelled');
    mocks.report = reportOf([cancelled], [row('dr-2', 'Doctor Two', { bookingIds: ['c1'], cancelledIds: ['c1'] })]);
    const { onOpenDay } = renderReport();
    fireEvent.click(await screen.findByRole('button', { name: /Doctor Two: Cancelled 1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Patient C1, .* Open the day in the diary\./ }));
    expect(onOpenDay).toHaveBeenCalledWith(thisWeek.from, { practitionerId: 'dr-2', showCancelled: true });
  });
});

// A patient moved to a recall list was only a list entry: never due on the "Recall due" list, never closed by a booking
describe('DiaryReportModal: Move to a recall list', () => {
  it('gives each no-show a recall for today that closes when they book', async () => {
    const missed = booking('n1', 'pt-1', 'dr-1', thisWeek.from, 'no_show');
    mocks.report = reportOf([missed], [row('dr-1', 'Doctor One', { bookingIds: ['n1'], noShowIds: ['n1'] })]);
    renderReport();
    const noShows = await screen.findByRole('region', { name: 'No-shows by patient' });
    fireEvent.click(within(noShows).getByRole('button', { name: 'Move to a recall list' }));
    await waitFor(() => expect(mocks.setRecalls).toHaveBeenCalledTimes(1));
    expect(mocks.loadInForce).toHaveBeenCalledWith('practice-1', ['pt-1']);
    expect(mocks.setRecalls).toHaveBeenCalledWith('practice-1', [
      { patientId: 'pt-1', dueOn: today, reason: expect.stringMatching(/^Missed appointment on \d{1,2} [A-Z][a-z]{2} \d{4}$/), recallId: null }
    ]);
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledWith('1 recall set for today: each closes when the patient books.'));
  });

  it("moves a recall that passed with nothing booked to today, and the period's list is read again", async () => {
    mocks.report = reportOf([], []);
    mocks.loadOpenInRange.mockResolvedValue([recall('r1', 'pt-2', lastWeekStart)]);
    renderReport();
    fireEvent.click(await screen.findByRole('button', { name: 'Last week' }));
    const recalled = await screen.findByRole('region', { name: 'Recalled but not seen' });
    const move = await within(recalled).findByRole('button', { name: 'Move to a recall list' });
    const reads = mocks.loadOpenInRange.mock.calls.length;
    fireEvent.click(move);
    await waitFor(() => expect(mocks.setRecalls).toHaveBeenCalledTimes(1));
    expect(mocks.setRecalls).toHaveBeenCalledWith('practice-1', [{ patientId: 'pt-2', dueOn: today, reason: '6-monthly check-up', recallId: 'r1' }]);
    await waitFor(() => expect(mocks.loadOpenInRange).toHaveBeenCalledTimes(reads + 1));
    expect(mocks.toast.success).toHaveBeenCalledWith('1 recall moves to today: each closes when the patient books.');
  });
});
