import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_TYPE_LENGTHS } from '../../../utils/diary/bookingLength';
import { addDaysToKey, parseDateKey, toDateKey } from '../../../utils/diary/diaryTime';

// The diary's data comes from hooks and services: here they return a quiet, invented practice
const mocks = vi.hoisted(() => ({
  diaryDefault: { status: 'ready', saved: null as string[] | null, save: vi.fn() },
  findNextFreeSlotFor: vi.fn(),
  formProps: [] as Array<Record<string, unknown>>,
  // The same objects on every render, as the real hooks return
  blocks: { status: 'ready', blocks: [], error: null, reload: () => {} },
  reminders: new Map(),
  settings: null as unknown,
  // The waiting list as loaded: empty unless a test puts someone on it
  waitingList: { state: 'ready', entries: [] } as { state: 'ready'; entries: unknown[] }
}));
vi.mock('../../../services/waitingListService', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loadWaitingList: vi.fn(async () => mocks.waitingList)
}));
vi.mock('../../../lib/supabase', () => ({ supabase: { from: () => ({}) } }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../hooks/useDiaryDefault', () => ({ useDiaryDefault: () => mocks.diaryDefault }));
vi.mock('../../../hooks/useDiaryBlocks', () => ({ useDiaryBlocks: () => mocks.blocks }));
vi.mock('../../../hooks/useReminderStatuses', () => ({ useReminderStatuses: () => mocks.reminders }));
vi.mock('../../../hooks/useDiarySettings', () => ({ useDiarySettings: () => mocks.settings }));
mocks.settings = { status: 'ready', settings: { lengths: DEFAULT_TYPE_LENGTHS }, hours: [], hoursStatus: 'ready', reload: () => {} };
vi.mock('../../../services/diaryService', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkBooking: vi.fn().mockResolvedValue([]),
  findNextFreeSlotFor: mocks.findNextFreeSlotFor
}));
vi.mock('../../../services/diarySettingsService', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loadPracticeBusinessHours: vi.fn().mockResolvedValue(null)
}));
vi.mock('../../../services/patientFileService', () => ({ loadPatientFileStatus: vi.fn().mockResolvedValue({ incomplete: false, missing: [] }) }));
// The booking form itself is tested on its own: here it only shows what it was opened with
vi.mock('../../forms/PremiumAddAppointmentForm', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.formProps.push(props);
    return <div>Booking form</div>;
  }
}));

import PremiumAppointmentScheduler from '../../PremiumAppointmentScheduler';

// An invented practice: two doctors and a receptionist; a Tuesday at least a week ahead, so "Book again" looks ahead
const nextTuesday = (() => {
  let key = addDaysToKey(toDateKey(new Date()), 7);
  while (parseDateKey(key)?.getDay() !== 2) key = addDaysToKey(key, 1);
  return key;
})();
const member = (id: string, name: string, role: string) => ({ id, email: '', is_active: true, user_metadata: { full_name: name, role } });
const STAFF = [member('dr-1', 'Doctor One', 'doctor'), member('dr-2', 'Doctor Two', 'doctor'), member('rec-1', 'Reception One', 'receptionist')];
const booking = (id: string, doctorId: string, time: string) => ({
  id,
  patient: { id: `pt-${id}`, first_name: 'Patient', last_name: id.toUpperCase() },
  patient_id: `pt-${id}`,
  doctor_id: doctorId,
  date: nextTuesday,
  time,
  duration: 30,
  duration_minutes: 30,
  type: 'consultation' as const,
  status: 'scheduled' as const,
  is_confirmed: true,
  reason: 'Blood pressure review'
});
const BOOKINGS = [booking('a', 'dr-1', '09:00'), booking('b', 'dr-2', '10:00')];

type Props = React.ComponentProps<typeof PremiumAppointmentScheduler>;
const props = (overrides: Partial<Props> = {}): Props => ({
  appointments: BOOKINGS,
  staff: STAFF,
  blockedTimes: [],
  visits: [],
  isLoading: false,
  error: null,
  selectedDate: parseDateKey(nextTuesday)!,
  onDateChange: vi.fn(),
  onAppointmentClick: vi.fn(),
  onCreateAppointment: vi.fn(),
  onBlockTime: vi.fn(),
  currentUserRole: 'receptionist',
  currentUserId: 'rec-1',
  viewMode: 'day',
  internalViewMode: 'timeline',
  practiceId: 'p-1',
  ...overrides
});
const renderDiary = (overrides: Partial<Props> = {}) => {
  const view = render(
    <MemoryRouter>
      <PremiumAppointmentScheduler {...props(overrides)} />
    </MemoryRouter>
  );
  return {
    rerender: (next: Partial<Props>) =>
      view.rerender(
        <MemoryRouter>
          <PremiumAppointmentScheduler {...props({ ...overrides, ...next })} />
        </MemoryRouter>
      )
  };
};
const lastFormProps = () => mocks.formProps[mocks.formProps.length - 1];
// A free time in a practitioner's column of the day grid, found by its label in the time column
const slotOf = (practitioner: string, label: string): HTMLElement => {
  const labels = screen.getAllByText(/^\d{1,2}:\d{2} (AM|PM)$/).map((element) => element.textContent);
  const column = screen.getByText(practitioner).closest('[class*="min-w-[200px]"]') as HTMLElement;
  return column.querySelectorAll('[class*="h-[60px]"]')[labels.indexOf(label)] as HTMLElement;
};

beforeEach(() => {
  mocks.diaryDefault = { status: 'ready', saved: null, save: vi.fn() };
  mocks.findNextFreeSlotFor.mockReset();
  mocks.formProps.length = 0;
  mocks.waitingList = { state: 'ready', entries: [] };
});

// The owner's rule: a doctor's home page opens on their own schedule; the front desk sees everyone
describe('PremiumAppointmentScheduler: whose diary opens', () => {
  it("opens a doctor on their own column, never on a colleague's bookings", () => {
    renderDiary({ currentUserRole: 'doctor', currentUserId: 'dr-1' });
    expect(screen.getByText('Patient A')).toBeInTheDocument();
    expect(screen.queryByText('Patient B')).toBeNull();
  });

  it('opens reception on every practitioner, so nobody booked is missed at the front desk', () => {
    renderDiary();
    expect(screen.getByText('Patient A')).toBeInTheDocument();
    expect(screen.getByText('Patient B')).toBeInTheDocument();
  });

  it('still opens a doctor on their own column when the sign-in arrives after the diary is drawn (the old diary missed this)', () => {
    // The dashboard first passes its placeholder (administrator, no user), then the signed-in doctor
    const { rerender } = renderDiary({ currentUserRole: 'admin', currentUserId: '' });
    expect(screen.getByText('Patient B')).toBeInTheDocument();
    rerender({ currentUserRole: 'doctor', currentUserId: 'dr-1' });
    expect(screen.queryByText('Patient B')).toBeNull();
    expect(screen.getByText('Patient A')).toBeInTheDocument();
  });

  it("opens on the user's saved default instead of the role's", () => {
    mocks.diaryDefault = { status: 'ready', saved: ['dr-2'], save: vi.fn() };
    renderDiary({ currentUserRole: 'doctor', currentUserId: 'dr-1' });
    expect(screen.getByText('Patient B')).toBeInTheDocument();
    expect(screen.queryByText('Patient A')).toBeNull();
  });
});

describe('PremiumAppointmentScheduler: Copy, paste and Book again', () => {
  const openActions = (patient: string) => fireEvent.click(screen.getByText(patient));

  it("pastes a copied booking into the free time clicked, with that column's practitioner, then forgets the copy once booked", () => {
    renderDiary();
    openActions('Patient A');
    fireEvent.click(screen.getByText('Copy'));
    expect(screen.getByRole('status')).toHaveTextContent('Copied: Patient, 30 min. Choose a free time, or press Esc.');

    fireEvent.click(slotOf('Doctor Two', '11:00 AM'));
    const form = lastFormProps();
    expect(form.initialDoctorId).toBe('dr-2');
    expect(form.initialTime).toBe('11:00');
    expect(toDateKey(form.initialDate as Date)).toBe(nextTuesday);
    expect(form.prefill).toEqual(expect.objectContaining({ patientId: 'pt-a', durationMinutes: 30, reason: 'Blood pressure review' }));

    act(() => (form.onSuccess as () => void)());
    expect(screen.queryByText(/Copied:/)).toBeNull();
  });

  it('keeps the copy when the form is closed without booking, so reception can choose another time', () => {
    renderDiary();
    openActions('Patient A');
    fireEvent.click(screen.getByText('Copy'));
    fireEvent.click(slotOf('Doctor Two', '11:00 AM'));
    act(() => (lastFormProps().onCancel as () => void)());
    expect(screen.getByText(/Copied:/)).toBeInTheDocument();
  });

  it('forgets the copy with Esc, so a later click books normally', () => {
    renderDiary();
    openActions('Patient A');
    fireEvent.click(screen.getByText('Copy'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(/Copied:/)).toBeNull();
    fireEvent.click(slotOf('Doctor Two', '11:00 AM'));
    expect(lastFormProps().prefill).toBeUndefined();
  });

  it("books again at the practitioner's next free time, looking from the day after the booking", async () => {
    mocks.findNextFreeSlotFor.mockResolvedValue({ date: addDaysToKey(nextTuesday, 7), time: '09:30' });
    renderDiary();
    openActions('Patient A');
    fireEvent.click(screen.getByText('Book Again'));

    await waitFor(() => expect(mocks.formProps.length).toBeGreaterThan(0));
    const request = mocks.findNextFreeSlotFor.mock.calls[0][0] as { doctorId: string; fromDate: Date; durationMinutes: number };
    expect([request.doctorId, toDateKey(request.fromDate), request.durationMinutes]).toEqual(['dr-1', addDaysToKey(nextTuesday, 1), 30]);
    const form = lastFormProps();
    expect([toDateKey(form.initialDate as Date), form.initialTime]).toEqual([addDaysToKey(nextTuesday, 7), '09:30']);
    expect(form.prefill).toEqual(expect.objectContaining({ patientId: 'pt-a', practitionerId: 'dr-1' }));
  });

  it('opens Book again without a date when the next four weeks are full, instead of guessing a day', async () => {
    mocks.findNextFreeSlotFor.mockResolvedValue(null);
    renderDiary();
    openActions('Patient A');
    fireEvent.click(screen.getByText('Book Again'));
    await waitFor(() => expect(mocks.formProps.length).toBeGreaterThan(0));
    expect(lastFormProps().initialDate).toBeNull();
  });
});

describe('PremiumAppointmentScheduler: the practitioner filter', () => {
  it('shows several practitioners when reception ticks them, starting from one', () => {
    mocks.diaryDefault = { status: 'ready', saved: ['dr-1'], save: vi.fn() };
    renderDiary();
    expect(screen.queryByText('Patient B')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Practitioner:/ }));
    const filter = screen.getByRole('dialog');
    fireEvent.click(within(filter).getByRole('checkbox', { name: /Doctor Two/ }));
    expect(screen.getByText('Patient A')).toBeInTheDocument();
    expect(screen.getByText('Patient B')).toBeInTheDocument();
  });
});

// Links from the patient file, the diary report and Encounters opened the day only: a doctor's diary then showed their
// own column, and the time grid left cancelled bookings out, so the booking the link was for was not there
describe('PremiumAppointmentScheduler: a diary link keeps its booking in view', () => {
  it("shows a colleague's booking to a doctor, beside the doctor's own column", () => {
    renderDiary({ currentUserRole: 'doctor', currentUserId: 'dr-1', diaryFocus: { practitionerId: 'dr-2', showCancelled: false } });
    expect(screen.getByText('Patient A')).toBeInTheDocument();
    expect(screen.getByText('Patient B')).toBeInTheDocument();
  });

  it('shows a cancelled booking in the time grid, with the cancelled bookings only', () => {
    const cancelled = { ...booking('c', 'dr-1', '11:00'), status: 'cancelled' as const, is_cancelled: true };
    const { rerender } = renderDiary({ appointments: [...BOOKINGS, cancelled] });
    expect(screen.queryByText('Patient C')).toBeNull();
    rerender({ diaryFocus: { practitionerId: 'dr-1', showCancelled: true } });
    expect(screen.getByText('Patient C')).toBeInTheDocument();
    expect(screen.queryByText('Patient A')).toBeNull();
  });
});

// Cancel Visit and Delete Booking offered the freed time to the waiting list; the Reschedule form's Cancel Appointment
// (opened by the dashboard, outside the diary) did not, so a waiting patient was never told about it
describe('PremiumAppointmentScheduler: a time freed outside the diary', () => {
  it('is offered to the waiting list, as after Cancel Visit', async () => {
    mocks.waitingList = {
      state: 'ready',
      entries: [
        {
          id: 'w1',
          patient: { id: 'pt-w', firstName: 'Waiting', lastName: 'Patient', cellNumber: '0811234567', smsOptOut: false },
          practitionerId: null,
          appointmentTypeId: null,
          lengthMinutes: 15,
          days: [],
          from: null,
          to: null,
          until: addDaysToKey(nextTuesday, 30),
          current: null,
          note: null,
          status: 'waiting',
          offer: null,
          bookedVisitId: null,
          createdAt: '2026-10-01T08:00:00Z'
        }
      ]
    };
    const { rerender } = renderDiary();
    expect(screen.queryByText(/is free again/)).toBeNull();
    rerender({ freedSlot: { practitionerId: 'dr-1', date: nextTuesday, time: '09:00', lengthMinutes: 30 } });
    expect(await screen.findByText(/is free again/)).toBeInTheDocument();
  });
});
