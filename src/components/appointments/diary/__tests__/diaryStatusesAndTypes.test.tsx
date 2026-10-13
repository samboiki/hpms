import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AppointmentType } from '../../../../utils/diary/appointmentTypes';
import type { DiaryStatus } from '../../../../utils/diary/diaryStatuses';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const lists = vi.hoisted(() => ({
  loadDiaryStatuses: vi.fn(),
  saveDiaryStatus: vi.fn(),
  removeDiaryStatus: vi.fn(),
  loadAppointmentTypes: vi.fn(),
  saveAppointmentType: vi.fn(),
  removeAppointmentType: vi.fn()
}));
vi.mock('../../../../services/diaryListsService', () => ({
  DIARY_LISTS_NOT_ENABLED_MESSAGE: 'Statuses and appointment types are not switched on yet.',
  ...lists
}));
const settings = vi.hoisted(() => ({
  loadDiarySettings: vi.fn(),
  loadWorkingHours: vi.fn(),
  loadPracticeBusinessHours: vi.fn(),
  savePractitionerSlot: vi.fn(),
  saveBookingLengths: vi.fn(),
  savePractitionerHours: vi.fn(),
  saveReminderSettings: vi.fn()
}));
vi.mock('../../../../services/diarySettingsService', () => ({
  DIARY_SETTINGS_NOT_ENABLED_MESSAGE: 'Diary settings are not switched on yet.',
  ...settings
}));
vi.mock('../../../../services/diaryService', () => ({ loadPracticeBranches: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../../hooks/useSmsRepliesLive', () => ({ useSmsRepliesLive: () => false }));

import { DiaryStatusesTab } from '../DiaryStatusesTab';
import { AppointmentTypesSection } from '../AppointmentTypesSection';
import { DiarySettingsModal } from '../DiarySettingsModal';

// An invented practice's lists
const NO_ANSWER: DiaryStatus = { id: 's-call', name: 'Called, no answer', colour: 'red', stage: 'scheduled', isActive: true };
const NEW_PATIENT: AppointmentType = { id: 't-new', name: 'New patient', visitType: 'consultation', lengthMinutes: 45, dailyLimit: 4, isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
  lists.loadDiaryStatuses.mockResolvedValue({ state: 'ready', items: [NO_ANSWER] });
  lists.loadAppointmentTypes.mockResolvedValue({ state: 'ready', items: [NEW_PATIENT] });
  lists.saveDiaryStatus.mockResolvedValue({ ok: true, id: 'new-id' });
  lists.saveAppointmentType.mockResolvedValue({ ok: true, id: 'new-id' });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('Diary settings > Statuses (B3)', () => {
  it('lists the statuses with their colour, words and the step they belong to', async () => {
    render(<DiaryStatusesTab practiceId="practice-1" isAdmin={false} />);
    expect(await screen.findByText('Called, no answer')).toBeInTheDocument();
    expect(screen.getByText('While: Scheduled')).toBeInTheDocument();
  });

  it('lets an administrator add a status with a name, a step and a colour', async () => {
    const onSaved = vi.fn();
    render(<DiaryStatusesTab practiceId="practice-1" isAdmin onSaved={onSaved} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a status' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Waiting for X-ray' } });
    fireEvent.change(screen.getByLabelText('Shown while the visit is'), { target: { value: 'checked-in' } });
    fireEvent.click(screen.getByLabelText('Amber'));
    fireEvent.click(screen.getByRole('button', { name: 'Add status' }));
    await waitFor(() =>
      expect(lists.saveDiaryStatus).toHaveBeenCalledWith('practice-1', null, expect.objectContaining({ name: 'Waiting for X-ray', colour: 'amber', stage: 'checked-in' }), [NO_ANSWER])
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('shows the database refusal in plain words and keeps the form', async () => {
    lists.saveDiaryStatus.mockResolvedValue({ ok: false, message: 'There is already a status called "Called, no answer".' });
    render(<DiaryStatusesTab practiceId="practice-1" isAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a status' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Called, no answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add status' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('There is already a status called');
    expect(screen.getByLabelText('Name')).toHaveValue('Called, no answer');
  });

  // Statuses change every practitioner's diary: only administrators change them (the database refuses others too)
  it('shows staff the list but nothing to change it with', async () => {
    render(<DiaryStatusesTab practiceId="practice-1" isAdmin={false} />);
    expect(await screen.findByText(/Only a practice administrator can change the statuses/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a status' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Called, no answer' })).toBeNull();
  });

  it('removes a status after asking, saying that bookings keep it', async () => {
    lists.removeDiaryStatus.mockResolvedValue({ ok: true });
    render(<DiaryStatusesTab practiceId="practice-1" isAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Called, no answer' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Bookings that have it keep it'));
    await waitFor(() => expect(lists.removeDiaryStatus).toHaveBeenCalledWith('practice-1', 's-call'));
  });

  it('says the statuses are not set up yet before the database update, instead of an error', async () => {
    lists.loadDiaryStatuses.mockResolvedValue({ state: 'not_enabled', items: [] });
    render(<DiaryStatusesTab practiceId="practice-1" isAdmin />);
    expect(await screen.findByText(/Statuses and appointment types are not switched on yet/)).toBeInTheDocument();
  });
});

describe('Diary settings > Appointment types (B6)', () => {
  it('describes each type with its length, daily limit and what it is billed as', async () => {
    render(<AppointmentTypesSection practiceId="practice-1" isAdmin={false} />);
    expect(await screen.findByText('New patient')).toBeInTheDocument();
    expect(screen.getByText('45 min, at most 4 a day per practitioner, billed as Consultation')).toBeInTheDocument();
  });

  it('lets an administrator add "Review, 15 min, at most 6 a day", billed as a follow-up', async () => {
    render(<AppointmentTypesSection practiceId="practice-1" isAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add an appointment type' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Review' } });
    fireEvent.change(screen.getByLabelText('Booked and billed as'), { target: { value: 'follow-up' } });
    fireEvent.change(screen.getByLabelText('Length'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('At most a day per practitioner'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add type' }));
    await waitFor(() =>
      expect(lists.saveAppointmentType).toHaveBeenCalledWith(
        'practice-1',
        null,
        { name: 'Review', visitType: 'follow-up', lengthMinutes: 15, dailyLimit: 6 },
        [NEW_PATIENT]
      )
    );
  });

  it('saves an empty daily limit as no limit', async () => {
    render(<AppointmentTypesSection practiceId="practice-1" isAdmin />);
    fireEvent.click(await screen.findByRole('button', { name: 'Change New patient' }));
    fireEvent.change(screen.getByLabelText('At most a day per practitioner'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save type' }));
    await waitFor(() =>
      expect(lists.saveAppointmentType).toHaveBeenCalledWith('practice-1', 't-new', expect.objectContaining({ dailyLimit: null, lengthMinutes: 45 }), [NEW_PATIENT])
    );
  });
});

describe('Diary settings > Working hours: the diary slot (B6)', () => {
  beforeEach(() => {
    settings.loadWorkingHours.mockResolvedValue({ state: 'ready', rows: [] });
    settings.loadPracticeBusinessHours.mockResolvedValue(null);
    settings.loadDiarySettings.mockResolvedValue({ state: 'ready', settings: { lengths: {}, slots: { 'pr-b': 20 }, reminders: {}, remindersLastRunAt: null, saved: true } });
    settings.savePractitionerSlot.mockResolvedValue({ ok: true });
  });
  const practitioners = [
    { id: 'pr-a', name: 'Dr. A' },
    { id: 'pr-b', name: 'Dr. B' }
  ];

  it("lets an administrator set a practitioner's slot, saved as soon as it is chosen", async () => {
    render(
      <DiarySettingsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={practitioners} currentUserId="u1" currentUserRole="admin" initialTab="hours" />
    );
    const slot = (await screen.findByLabelText('Diary slot')) as HTMLSelectElement;
    expect(slot.value).toBe('');
    fireEvent.change(slot, { target: { value: '15' } });
    await waitFor(() => expect(settings.savePractitionerSlot).toHaveBeenCalledWith('practice-1', 'pr-a', 15));
  });

  it('shows each practitioner their own saved slot, and puts the standard rows back with the first choice', async () => {
    render(
      <DiarySettingsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={practitioners} currentUserId="u1" currentUserRole="admin" initialTab="hours" />
    );
    fireEvent.change(await screen.findByLabelText('Practitioner'), { target: { value: 'pr-b' } });
    const slot = screen.getByLabelText('Diary slot') as HTMLSelectElement;
    expect(slot.value).toBe('20');
    fireEvent.change(slot, { target: { value: '' } });
    await waitFor(() => expect(settings.savePractitionerSlot).toHaveBeenCalledWith('practice-1', 'pr-b', null));
  });

  // The slot shapes every practitioner's diary: a practitioner may keep their own hours but not change the slot
  it('lets a practitioner read but not change their slot', async () => {
    render(
      <DiarySettingsModal isOpen onClose={() => {}} practiceId="practice-1" practitioners={practitioners} currentUserId="pr-a" currentUserRole="doctor" initialTab="hours" />
    );
    expect(await screen.findByLabelText('Diary slot')).toBeDisabled();
    expect(screen.getByText('Only a practice administrator can change the diary slot.')).toBeInTheDocument();
  });
});
