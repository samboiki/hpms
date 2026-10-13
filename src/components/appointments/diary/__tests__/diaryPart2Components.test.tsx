import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  DEFAULT_REMINDER_SETTINGS,
  DEFAULT_REMINDER_TEMPLATE,
  type PlannedReminder,
  type ReminderBooking
} from '../../../../../supabase/functions/_shared/appointmentReminders.ts';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

const reminderService = vi.hoisted(() => ({
  loadReminderPreview: vi.fn(),
  sendRemindersNow: vi.fn()
}));
vi.mock('../../../../services/reminderRunService', () => ({
  REMINDERS_NOT_ENABLED_MESSAGE: 'Reminders are not switched on yet.',
  loadReminderPreview: reminderService.loadReminderPreview,
  sendRemindersNow: reminderService.sendRemindersNow
}));

const settingsService = vi.hoisted(() => ({
  loadDiarySettings: vi.fn(),
  saveReminderSettings: vi.fn(),
  saveBookingLengths: vi.fn(),
  loadWorkingHours: vi.fn(),
  savePractitionerHours: vi.fn(),
  loadPracticeBusinessHours: vi.fn()
}));
vi.mock('../../../../services/diarySettingsService', () => ({
  DIARY_SETTINGS_NOT_ENABLED_MESSAGE: 'Diary settings are not switched on yet.',
  ...settingsService
}));
vi.mock('../../../../services/diaryService', () => ({ loadPracticeBranches: vi.fn().mockResolvedValue([]) }));
// Whether OneHealth support switched the practice's SMS replies on (practice_features); off unless a test says so
const repliesLive = vi.hoisted(() => ({ value: false as boolean | null }));
vi.mock('../../../../hooks/useSmsRepliesLive', () => ({ useSmsRepliesLive: () => repliesLive.value }));

import { RemindPatientsModal } from '../RemindPatientsModal';
import { DiarySettingsModal } from '../DiarySettingsModal';
import { DiaryMoreMenu } from '../DiaryMoreMenu';
import { RepeatBookingFields } from '../RepeatBookingFields';
import { PremiumMonthGridView } from '../../PremiumMonthGridView';
import { DEFAULT_REPEAT_RULE } from '../../../../utils/diary/repeatBookings';

// Invented patients and practitioners
const booking = (overrides: Partial<ReminderBooking> = {}): ReminderBooking => ({
  visitId: 'visit-1',
  practiceId: 'practice-1',
  patientId: 'patient-1',
  practitionerId: 'pr-a',
  date: '2026-10-08',
  time: '09:30',
  stage: 'scheduled',
  isConfirmed: true,
  createdAt: null,
  patientFirstName: 'Maria',
  patientLastName: 'Shikongo',
  cellNumber: '0810000001',
  smsOptOut: false,
  ...overrides
});
const due: PlannedReminder = {
  booking: booking(),
  kind: 'day_before',
  slotKey: '2026-10-08T09:30',
  phone: '+264810000001',
  message: 'Ombili Family Practice: Hi Maria, reminder: appointment with Dr. A on Thu 8 Oct at 09:30.'
};
const PRACTITIONERS = [{ id: 'pr-a', name: 'Dr. A' }];

beforeEach(() => {
  vi.clearAllMocks();
  settingsService.loadPracticeBusinessHours.mockResolvedValue(null);
  repliesLive.value = false;
});

describe('RemindPatientsModal', () => {
  it('shows the count, the SMS itself and who is left out and why, before anything is sent', async () => {
    reminderService.loadReminderPreview.mockResolvedValue({
      state: 'ready',
      preview: {
        date: '2026-10-08',
        plan: { due: [due], skipped: [{ booking: booking({ visitId: 'visit-2', patientFirstName: 'Johannes', smsOptOut: true }), kind: 'day_before', reason: 'opted_out' }] },
        settings: { ...DEFAULT_REMINDER_SETTINGS, enabled: false },
        remindersLastRunAt: null
      }
    });
    render(<RemindPatientsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={PRACTITIONERS} />);
    expect(await screen.findByText(/patient gets/)).toHaveTextContent('1 patient gets a reminder for Thursday 8 Oct 2026 (1 SMS each).');
    expect(screen.getByText(due.message)).toBeInTheDocument();
    expect(screen.getByText(/The patient replied STOP to SMS \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Automatic reminders are off/)).toBeInTheDocument();
    expect(reminderService.sendRemindersNow).not.toHaveBeenCalled();
  });

  it('sends exactly the previewed reminders and reports the result', async () => {
    reminderService.loadReminderPreview.mockResolvedValue({
      state: 'ready',
      preview: { date: '2026-10-08', plan: { due: [due], skipped: [] }, settings: DEFAULT_REMINDER_SETTINGS, remindersLastRunAt: null }
    });
    reminderService.sendRemindersNow.mockResolvedValue({ sent: 1, failed: 0, duplicate: 0, results: [{ reminder: due, outcome: 'sent' }] });
    render(<RemindPatientsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={PRACTITIONERS} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send 1 reminder' }));
    await waitFor(() => expect(reminderService.sendRemindersNow).toHaveBeenCalledWith([due], expect.any(Function)));
    expect(await screen.findByText(/1 sent/)).toBeInTheDocument();
  });

  it('sends nothing before the reminder log exists, because then a patient could be reminded twice', async () => {
    reminderService.loadReminderPreview.mockResolvedValue({ state: 'not_enabled' });
    render(<RemindPatientsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={PRACTITIONERS} />);
    expect(await screen.findByText('Reminders are not switched on yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nobody to remind' })).toBeDisabled();
  });
});

describe('DiarySettingsModal', () => {
  const ready = {
    state: 'ready',
    settings: { lengths: { consultation: 30, 'follow-up': 15, procedure: 30, emergency: 30 }, reminders: DEFAULT_REMINDER_SETTINGS, remindersLastRunAt: null, saved: false }
  };

  it('lets staff read the reminder settings but only administrators change them (they cost SMS credits)', async () => {
    settingsService.loadDiarySettings.mockResolvedValue(ready);
    render(
      <DiarySettingsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={PRACTITIONERS} currentUserId="u1" currentUserRole="receptionist" />
    );
    expect(await screen.findByText(/Only a practice administrator can change the reminders/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save reminders' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Send reminders automatically/ })).toBeDisabled();
  });

  it('refuses a message without the date and time, in plain words, without saving', async () => {
    settingsService.loadDiarySettings.mockResolvedValue(ready);
    render(<DiarySettingsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={PRACTITIONERS} currentUserId="u1" currentUserRole="admin" />);
    const message = await screen.findByLabelText('The message');
    expect(message).toHaveValue(DEFAULT_REMINDER_TEMPLATE);
    fireEvent.change(message, { target: { value: 'Hi {{patientFirstName}}, see you soon.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save reminders' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('{{appointmentDate}} and {{appointmentTime}}');
    expect(settingsService.saveReminderSettings).not.toHaveBeenCalled();
  });

  it('shows the SMS a patient receives with invented example values', async () => {
    settingsService.loadDiarySettings.mockResolvedValue(ready);
    render(<DiarySettingsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={PRACTITIONERS} currentUserId="u1" currentUserRole="admin" />);
    expect(await screen.findByText(/What a patient receives \(1 SMS/)).toBeInTheDocument();
    expect(screen.getByText(/Hi Maria, reminder: appointment with Dr\. T\. Nghipandulwa on Thu 8 Oct at 09:30/)).toBeInTheDocument();
  });

  // A patient who answers "2" believes the booking is cancelled: until the practice's replies are collected the
  // reminder must not ask for an answer nobody will see
  it('leaves the reply line out of the reminder until replies are collected, and adds it once they are', async () => {
    settingsService.loadDiarySettings.mockResolvedValue(ready);
    const { unmount } = render(
      <DiarySettingsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={PRACTITIONERS} currentUserId="u1" currentUserRole="admin" />
    );
    const notLive = await screen.findByText(/Hi Maria, reminder:/);
    expect(notLive.textContent).not.toMatch(/Reply/);
    expect(screen.getByText(/SMS replies are not collected yet/)).toBeInTheDocument();
    unmount();

    repliesLive.value = true;
    render(<DiarySettingsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={PRACTITIONERS} currentUserId="u1" currentUserRole="admin" />);
    expect((await screen.findByText(/Hi Maria, reminder:/)).textContent).toMatch(/Reply 1 to confirm, 2 to cancel, 3 for a new time\.$/);
  });

  // "Send reminders automatically" saved on does not make anything run (there is no scheduler yet): the practice must
  // not believe its patients are being reminded
  it('says the switch is on but not running until the schedule has checked the practice', async () => {
    settingsService.loadDiarySettings.mockResolvedValue(ready);
    settingsService.saveReminderSettings.mockResolvedValue({ ok: true });
    render(<DiarySettingsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={PRACTITIONERS} currentUserId="u1" currentUserRole="admin" />);
    expect(await screen.findByText(/Off: nothing is sent by itself/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Send reminders automatically/ }));
    expect(screen.getByText(/On, but not running yet: OneHealth support must start the scheduler/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save reminders' }));
    await waitFor(() => expect(settingsService.saveReminderSettings).toHaveBeenCalledWith('practice-1', expect.objectContaining({ enabled: true }), false));
  });

  it('shows when the schedule last checked the practice once it runs', async () => {
    const lastRun = new Date(Date.now() - 20 * 60_000).toISOString();
    settingsService.loadDiarySettings.mockResolvedValue({
      ...ready,
      settings: { ...ready.settings, reminders: { ...DEFAULT_REMINDER_SETTINGS, enabled: true }, remindersLastRunAt: lastRun, saved: true }
    });
    render(<DiarySettingsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={PRACTITIONERS} currentUserId="u1" currentUserRole="admin" />);
    expect(await screen.findByText(/On: the schedule last checked this practice/)).toBeInTheDocument();
    expect(screen.queryByText(/not running yet/)).not.toBeInTheDocument();
  });
});

describe('PremiumMonthGridView', () => {
  it('gives each day its bookings count and holiday in words, and opens the day', () => {
    const onDayClick = vi.fn();
    render(
      <PremiumMonthGridView
        monthDate={new Date(2026, 7, 10)}
        appointments={[
          { id: 'a', date: '2026-08-25', time: '09:00', status: 'scheduled' },
          { id: 'b', date: '2026-08-25', time: '10:00', status: 'scheduled' },
          { id: 'c', date: '2026-08-25', time: '11:00', status: 'cancelled', is_cancelled: true }
        ]}
        onDayClick={onDayClick}
      />
    );
    const tuesday = screen.getByRole('button', { name: /Tuesday 25 Aug 2026, 2 bookings/ });
    expect(screen.getByRole('button', { name: /Wednesday 26 Aug 2026, no bookings, Heroes' Day, public holiday/ })).toBeInTheDocument();
    fireEvent.click(tuesday);
    expect(onDayClick).toHaveBeenCalledWith(new Date(2026, 7, 25));
  });
});

describe('RepeatBookingFields', () => {
  it('shows the days a repeat booking will take before it is saved', () => {
    const { rerender } = render(
      <RepeatBookingFields enabled={false} onEnabledChange={() => {}} rule={DEFAULT_REPEAT_RULE} onRuleChange={() => {}} firstDate="2026-10-08" />
    );
    expect(screen.queryByText(/Every week/)).not.toBeInTheDocument();
    rerender(<RepeatBookingFields enabled onEnabledChange={() => {}} rule={DEFAULT_REPEAT_RULE} onRuleChange={() => {}} firstDate="2026-10-08" />);
    expect(screen.getByText('Every week: 6 bookings, 8 Oct 2026 to 12 Nov 2026')).toBeInTheDocument();
  });

  it('says what is wrong instead of booking a series of one', () => {
    render(
      <RepeatBookingFields enabled onEnabledChange={() => {}} rule={{ ...DEFAULT_REPEAT_RULE, count: 1 }} onRuleChange={() => {}} firstDate="2026-10-08" />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Choose 2 to 52 bookings.');
  });
});

describe('DiaryMoreMenu', () => {
  it('keeps the occasional actions one tap away and works from the keyboard', () => {
    const onReport = vi.fn();
    render(<DiaryMoreMenu items={[{ label: 'Diary report', icon: 'solar:chart-square-bold-duotone', onSelect: onReport }]} />);
    const button = screen.getByRole('button', { name: 'More' });
    fireEvent.click(button);
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(within(menu).getByRole('menuitem', { name: 'Diary report' }), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Diary report' }));
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});
