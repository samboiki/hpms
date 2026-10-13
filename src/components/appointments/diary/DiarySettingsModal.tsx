import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../../modals/FormModal';
import {
  loadDiarySettings,
  loadPracticeBusinessHours,
  loadWorkingHours,
  saveBookingLengths,
  savePractitionerHours,
  savePractitionerSlot,
  saveReminderSettings,
  type DiarySettingsLoad,
  type WorkingHoursLoad
} from '../../../services/diarySettingsService';
import { loadPracticeBranches, type PracticeBranch } from '../../../services/diaryService';
import {
  REMINDER_HOURS_BEFORE_MAX,
  REMINDER_HOURS_BEFORE_MIN,
  REMINDER_PLACEHOLDERS,
  REMINDER_REPLY_INVITE,
  SAMPLE_REMINDER_VALUES,
  renderReminderMessage,
  validateReminderSettings,
  type ReminderSettings
} from '../../../../supabase/functions/_shared/appointmentReminders.ts';
import { withReplyInvite } from '../../../../supabase/functions/_shared/smsMessagePolicy.ts';
import { useSmsRepliesLive } from '../../../hooks/useSmsRepliesLive';
import { SCHEDULER_NOT_RUNNING_NOTICE, scheduleState } from '../../../utils/automations/processorHealth';
import {
  TYPE_LENGTH_OPTIONS,
  VISIT_TYPES,
  VISIT_TYPE_LABELS,
  formatBookingLength,
  validateTypeLengths,
  type TypeLengths
} from '../../../utils/diary/bookingLength';
import { formatDiaryTimestamp } from '../../../utils/diary/diaryTime';
import { practiceHoursResolver } from '../../../utils/diary/nextFreeSlot';
import {
  WEEKDAY_NAMES,
  WEEK_ORDER,
  describeWorkingWeek,
  validateWeekDraft,
  weekDraftFromRows,
  type DayDraft,
  type WeekDraft
} from '../../../utils/diary/workingHours';
import { getSmsLength } from '../../messages/messageText';
import { SLOT_LENGTH_OPTIONS, slotLengthOf } from '../../../utils/diary/slotLength';
import { AppointmentTypesSection } from './AppointmentTypesSection';
import { VideoLinkSettingsSection } from './VideoLinkSettingsSection';
import { PrevisitQuestionsTab } from '../../previsit/PrevisitQuestionsTab';
import { DiaryStatusesTab } from './DiaryStatusesTab';
import { SettingsErrors as Errors, ReadOnlyNote, SettingsNotEnabled as NotEnabled } from './DiarySettingsParts';
import { CHECK_CLASS, FIELD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_CLASS, SECONDARY_CLASS, TIME_CLASS } from './diarySettingsStyles';

export type DiarySettingsTab = 'reminders' | 'lengths' | 'hours' | 'statuses' | 'questions';

export interface DiarySettingsPractitioner {
  id: string;
  name: string;
}

interface DiarySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceId: string | null;
  practitioners: DiarySettingsPractitioner[];
  currentUserId: string;
  currentUserRole: 'admin' | 'doctor' | 'nurse' | 'receptionist';
  initialTab?: DiarySettingsTab;
  /** After a save, so the diary uses the new lengths and hours at once */
  onSaved?: () => void;
}

// short: the label on a phone, where the tabs must fit side by side (the row scrolls when they do not)
const TABS: Array<{ id: DiarySettingsTab; label: string; short: string; icon: string }> = [
  { id: 'reminders', label: 'Reminders', short: 'Reminders', icon: 'solar:bell-bing-bold-duotone' },
  { id: 'lengths', label: 'Appointment types', short: 'Types', icon: 'solar:stopwatch-bold-duotone' },
  { id: 'hours', label: 'Working hours', short: 'Hours', icon: 'solar:clock-circle-bold-duotone' },
  { id: 'statuses', label: 'Statuses', short: 'Statuses', icon: 'solar:tag-bold-duotone' },
  // The practice's questions before a visit (parity B17)
  { id: 'questions', label: 'Questions', short: 'Questions', icon: 'solar:clipboard-list-bold-duotone' }
];

/**
 * Diary settings: SMS reminders, the default booking length per visit type and the practice's own appointment
 * types, each practitioner's working hours and diary slot, and the practice's own booking statuses. Administrators
 * change everything but working hours, which a practitioner can also set for themselves.
 */
export const DiarySettingsModal: React.FC<DiarySettingsModalProps> = ({ isOpen, onClose, ...rest }) => (
  <FormModal isOpen={isOpen} onClose={onClose} title="Diary settings" icon="solar:settings-bold-duotone" className="max-w-3xl">
    <DiarySettingsContent {...rest} />
  </FormModal>
);

const DiarySettingsContent: React.FC<Omit<DiarySettingsModalProps, 'isOpen' | 'onClose'>> = ({ initialTab = 'reminders', ...props }) => {
  const [tab, setTab] = useState<DiarySettingsTab>(initialTab);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Arrow keys move between the tabs, as screen-reader users expect
  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const next = (index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  if (!props.practiceId) {
    return <p className="text-sm text-red-600">Your practice couldn't be identified. Reload the page and try again.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Diary settings" className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`diary-settings-tab-${item.id}`}
            aria-label={item.label}
            aria-selected={tab === item.id}
            aria-controls={`diary-settings-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => onTabKey(event, index)}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
              tab === item.id ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon icon={item.icon} className="hidden h-4 w-4 flex-none sm:block" aria-hidden="true" />
            <span className="sm:hidden">{item.short}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`diary-settings-panel-${tab}`} aria-labelledby={`diary-settings-tab-${tab}`}>
        {tab === 'reminders' && <ReminderSettingsTab {...props} practiceId={props.practiceId} />}
        {tab === 'lengths' && (
          <div className="space-y-8">
            <BookingLengthsTab {...props} practiceId={props.practiceId} />
            <AppointmentTypesSection practiceId={props.practiceId} isAdmin={props.currentUserRole === 'admin'} onSaved={props.onSaved} />
            <VideoLinkSettingsSection practiceId={props.practiceId} isAdmin={props.currentUserRole === 'admin'} />
          </div>
        )}
        {tab === 'hours' && <WorkingHoursTab {...props} practiceId={props.practiceId} />}
        {tab === 'statuses' && <DiaryStatusesTab practiceId={props.practiceId} isAdmin={props.currentUserRole === 'admin'} onSaved={props.onSaved} />}
        {tab === 'questions' && (
          <PrevisitQuestionsTab practiceId={props.practiceId} canChange={props.currentUserRole === 'admin' || props.currentUserRole === 'doctor'} />
        )}
      </div>
    </div>
  );
};

type TabProps = Omit<DiarySettingsModalProps, 'isOpen' | 'onClose' | 'initialTab'> & { practiceId: string };

function useSettingsLoad(practiceId: string, version: number): DiarySettingsLoad | null {
  const [load, setLoad] = useState<DiarySettingsLoad | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadDiarySettings(practiceId).then((loaded) => {
      if (!cancelled) setLoad(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);
  return load;
}

// ---------------------------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------------------------

const ReminderSettingsTab: React.FC<TabProps> = ({ practiceId, currentUserRole, onSaved }) => {
  const isAdmin = currentUserRole === 'admin';
  const [version, setVersion] = useState(0);
  const load = useSettingsLoad(practiceId, version);
  // The reminder invites a reply only while the practice's SMS replies are collected (OneHealth support switches it on)
  const repliesLive = useSmsRepliesLive(practiceId) === true;
  const [form, setForm] = useState<ReminderSettings | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (load) setForm(load.settings.reminders);
  }, [load]);

  const preview = useMemo(
    () =>
      form
        ? renderReminderMessage(withReplyInvite(form.template, REMINDER_REPLY_INVITE, repliesLive), { ...SAMPLE_REMINDER_VALUES, practiceName: 'Your practice' })
        : '',
    [form, repliesLive]
  );
  const length = getSmsLength(preview);

  if (!load || !form) return <p className="text-sm text-gray-500" role="status">Loading...</p>;
  if (load.state === 'not_enabled') return <NotEnabled />;

  const change = (patch: Partial<ReminderSettings>) => setForm((current) => (current ? { ...current, ...patch } : current));

  // Puts {{name}} where the cursor is, so staff never type the braces themselves
  const insertPlaceholder = (name: string) => {
    const element = templateRef.current;
    const token = `{{${name}}}`;
    const start = element?.selectionStart ?? form.template.length;
    const end = element?.selectionEnd ?? form.template.length;
    change({ template: `${form.template.slice(0, start)}${token}${form.template.slice(end)}` });
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateReminderSettings(form, repliesLive);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setSaving(true);
    const result = await saveReminderSettings(practiceId, checked.settings, repliesLive);
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    setErrors([]);
    // Saving "on" makes nothing run by itself: say "on" only when the schedule has really been checking this practice
    const saved = scheduleState(checked.settings.enabled, load.settings.remindersLastRunAt, new Date());
    if (saved === 'not_running') toast.success(`Reminder settings saved. ${SCHEDULER_NOT_RUNNING_NOTICE}.`, { duration: 8000 });
    else toast.success(saved === 'running' ? 'Reminder settings saved: automatic reminders are on' : 'Reminder settings saved');
    setVersion((current) => current + 1);
    onSaved?.();
  };

  const lastRun = load.settings.remindersLastRunAt;
  const runState = scheduleState(form.enabled, lastRun, new Date());

  return (
    <form onSubmit={handleSave} noValidate className="space-y-5">
      {load.state === 'error' && <p className="text-sm text-red-600">Could not load the saved settings: {load.message}</p>}
      {!isAdmin && <ReadOnlyNote>Only a practice administrator can change the reminders. You can still remind patients by hand from the diary.</ReadOnlyNote>}

      <fieldset disabled={!isAdmin} className="space-y-4">
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <input type="checkbox" className={`${CHECK_CLASS} mt-0.5`} checked={form.enabled} onChange={(event) => change({ enabled: event.target.checked })} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">Send reminders automatically</span>
            <span className="block text-xs text-gray-500">
              Each confirmed booking gets an SMS through the practice's SMS bundle. Patients who replied STOP, bookings without a
              cell number and booking requests nobody confirmed are left out. Nothing is sent between 20:00 and 07:00.
            </span>
            {runState === 'not_running' ? (
              <span className="mt-1 block text-xs font-medium text-amber-800">
                {SCHEDULER_NOT_RUNNING_NOTICE}.{lastRun ? ` It last checked this practice ${formatDiaryTimestamp(lastRun)}.` : ''} Until
                then, remind patients by hand from the diary.
              </span>
            ) : (
              <span className="mt-1 block text-xs text-gray-500">
                {runState === 'running'
                  ? `On: the schedule last checked this practice ${formatDiaryTimestamp(lastRun)}.`
                  : 'Off: nothing is sent by itself. You can still remind patients by hand from the diary.'}
              </span>
            )}
          </span>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
              <input type="checkbox" className={CHECK_CLASS} checked={form.dayBefore} onChange={(event) => change({ dayBefore: event.target.checked })} />
              The day before
            </label>
            <label htmlFor="reminder-day-before-time" className={`${LABEL_CLASS} mt-3`}>At</label>
            <input
              id="reminder-day-before-time"
              type="time"
              step={900}
              min="07:00"
              max="19:45"
              value={form.dayBeforeTime}
              disabled={!form.dayBefore || !isAdmin}
              onChange={(event) => change({ dayBeforeTime: event.target.value })}
              className={INPUT_CLASS}
            />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
              <input type="checkbox" className={CHECK_CLASS} checked={form.sameDay} onChange={(event) => change({ sameDay: event.target.checked })} />
              Also on the day
            </label>
            <label htmlFor="reminder-same-day-hours" className={`${LABEL_CLASS} mt-3`}>Before the appointment</label>
            <select
              id="reminder-same-day-hours"
              value={form.sameDayHoursBefore}
              disabled={!form.sameDay || !isAdmin}
              onChange={(event) => change({ sameDayHoursBefore: Number(event.target.value) })}
              className={INPUT_CLASS}
            >
              {Array.from({ length: REMINDER_HOURS_BEFORE_MAX - REMINDER_HOURS_BEFORE_MIN + 1 }, (_, i) => i + REMINDER_HOURS_BEFORE_MIN).map((hours) => (
                <option key={hours} value={hours}>
                  {hours} hour{hours === 1 ? '' : 's'} before
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="reminder-template" className={LABEL_CLASS}>The message</label>
          <textarea
            id="reminder-template"
            ref={templateRef}
            rows={4}
            value={form.template}
            onChange={(event) => change({ template: event.target.value })}
            className={`${INPUT_CLASS} resize-y`}
            aria-describedby="reminder-template-help"
          />
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Insert into the message">
            {REMINDER_PLACEHOLDERS.map((placeholder) => (
              <button
                key={placeholder.name}
                type="button"
                onClick={() => insertPlaceholder(placeholder.name)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                + {placeholder.label}
              </button>
            ))}
          </div>
          <p id="reminder-template-help" className="mt-2 text-xs text-gray-500">
            {repliesLive
              ? 'OneHealth adds "Reply 1 to confirm, 2 to cancel, 3 for a new time"; the diary shows each answer on the booking.'
              : "Patients' SMS replies are not collected yet, so the reminder does not ask them to reply. OneHealth support switches replies on."}
          </p>
        </div>
      </fieldset>

      <figure>
        <figcaption className="text-xs font-medium text-gray-700">
          What a patient receives ({length.parts} SMS, {length.used} characters):
        </figcaption>
        <p className="mt-1 whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-purple-50 px-3 py-2 text-sm text-gray-800">{preview}</p>
      </figure>

      <Errors errors={errors} />

      {isAdmin && (
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={PRIMARY_CLASS}>
            <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:bell-bing-bold-duotone'} className={`h-5 w-5 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            {saving ? 'Saving...' : 'Save reminders'}
          </button>
        </div>
      )}
    </form>
  );
};

// ---------------------------------------------------------------------------------------------
// Booking lengths
// ---------------------------------------------------------------------------------------------

const BookingLengthsTab: React.FC<TabProps> = ({ practiceId, currentUserRole, onSaved }) => {
  const isAdmin = currentUserRole === 'admin';
  const [version, setVersion] = useState(0);
  const load = useSettingsLoad(practiceId, version);
  const [lengths, setLengths] = useState<TypeLengths | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (load) setLengths(load.settings.lengths);
  }, [load]);

  if (!load || !lengths) return <p className="text-sm text-gray-500" role="status">Loading...</p>;
  if (load.state === 'not_enabled') return <NotEnabled />;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateTypeLengths(lengths);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setSaving(true);
    const result = await saveBookingLengths(practiceId, checked.lengths);
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    setErrors([]);
    toast.success('Booking lengths saved');
    setVersion((current) => current + 1);
    onSaved?.();
  };

  return (
    <form onSubmit={handleSave} noValidate className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Standard types</h3>
      <p className="text-sm text-gray-600">
        A new booking starts with its type's length, and reception can change it. Bookings made before lengths were stored
        use these too.
      </p>
      {!isAdmin && <ReadOnlyNote>Only a practice administrator can change the default lengths.</ReadOnlyNote>}
      <fieldset disabled={!isAdmin} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {VISIT_TYPES.map((type) => {
          const options: number[] = [...TYPE_LENGTH_OPTIONS];
          if (!options.includes(lengths[type])) options.push(lengths[type]);
          return (
            <div key={type}>
              <label htmlFor={`length-${type}`} className={LABEL_CLASS}>{VISIT_TYPE_LABELS[type]}</label>
              <select
                id={`length-${type}`}
                value={lengths[type]}
                onChange={(event) => setLengths({ ...lengths, [type]: Number(event.target.value) })}
                className={INPUT_CLASS}
              >
                {options.sort((a, b) => a - b).map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatBookingLength(minutes)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </fieldset>
      <Errors errors={errors} />
      {isAdmin && (
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className={PRIMARY_CLASS}>
            <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:stopwatch-bold-duotone'} className={`h-5 w-5 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            {saving ? 'Saving...' : 'Save lengths'}
          </button>
        </div>
      )}
    </form>
  );
};

// ---------------------------------------------------------------------------------------------
// Working hours
// ---------------------------------------------------------------------------------------------

const WorkingHoursTab: React.FC<TabProps> = ({ practiceId, practitioners, currentUserId, currentUserRole, onSaved }) => {
  const isAdmin = currentUserRole === 'admin';
  const [doctorId, setDoctorId] = useState<string>(() =>
    practitioners.some((p) => p.id === currentUserId) ? currentUserId : practitioners[0]?.id ?? ''
  );
  const [version, setVersion] = useState(0);
  const [load, setLoad] = useState<WorkingHoursLoad | null>(null);
  const [businessHours, setBusinessHours] = useState<unknown>(undefined);
  const [branches, setBranches] = useState<PracticeBranch[]>([]);
  const [draft, setDraft] = useState<WeekDraft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Each practitioner's diary slot (diary_settings.practitioner_slots); null until the settings load
  const [settings, setSettings] = useState<DiarySettingsLoad | null>(null);
  const canEdit = isAdmin || doctorId === currentUserId;

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadWorkingHours(practiceId), loadPracticeBusinessHours(practiceId), loadPracticeBranches(practiceId), loadDiarySettings(practiceId)]).then(
      ([hours, opening, branchList, diarySettings]) => {
        if (cancelled) return;
        setLoad(hours);
        setBusinessHours(opening);
        setBranches(branchList);
        setSettings(diarySettings);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  useEffect(() => {
    if (load && businessHours !== undefined && doctorId) {
      setDraft(weekDraftFromRows(load.rows, doctorId, practiceHoursResolver(businessHours)));
      setErrors([]);
    }
  }, [load, businessHours, doctorId]);

  if (practitioners.length === 0) return <p className="text-sm text-gray-600">No practitioners found in this practice.</p>;
  if (!load || !draft) return <p className="text-sm text-gray-500" role="status">Loading...</p>;
  if (load.state === 'not_enabled') return <NotEnabled />;

  const saved = describeWorkingWeek(load.rows, doctorId);
  const name = practitioners.find((p) => p.id === doctorId)?.name ?? 'This practitioner';
  const changeDay = (day: number, patch: Partial<DayDraft>) => setDraft((current) => current?.map((item, index) => (index === day ? { ...item, ...patch } : item)) ?? current);
  const copyMonday = () => setDraft((current) => current?.map((item, index) => (index >= 2 && index <= 5 ? { ...current[1] } : item)) ?? current);

  // The practitioner's diary slot (administrators): the grids' rows, the start times offered and "Next free slot"
  const slot = slotLengthOf(settings?.settings.slots, doctorId);
  const saveSlot = async (value: string) => {
    const minutes = value === '' ? null : Number(value);
    setSaving(true);
    const result = await savePractitionerSlot(practiceId, doctorId, minutes);
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    setErrors([]);
    toast.success(minutes === null ? `${name}'s diary has the standard rows again` : `${name}'s diary slot: ${formatBookingLength(minutes)}`);
    setVersion((current) => current + 1);
    onSaved?.();
  };

  const save = async (days: Parameters<typeof savePractitionerHours>[2], message: string) => {
    setSaving(true);
    const result = await savePractitionerHours(practiceId, doctorId, days);
    setSaving(false);
    if (!result.ok) {
      setErrors([result.message]);
      return;
    }
    setErrors([]);
    toast.success(message);
    setVersion((current) => current + 1);
    onSaved?.();
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateWeekDraft(draft);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    if (checked.days.length === 0 && !window.confirm(`${name} works on no day. Save anyway? The diary will warn about every booking.`)) return;
    await save(checked.days, `Working hours saved for ${name}`);
  };

  const handleClear = async () => {
    if (!window.confirm(`Clear ${name}'s working hours? The practice's opening hours then apply.`)) return;
    await save([], `${name} now works the practice's opening hours`);
  };

  return (
    <form onSubmit={handleSave} noValidate className="space-y-4">
      <div>
        <label htmlFor="hours-practitioner" className={LABEL_CLASS}>Practitioner</label>
        <select id="hours-practitioner" value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className={INPUT_CLASS}>
          {practitioners.map((practitioner) => (
            <option key={practitioner.id} value={practitioner.id}>
              {practitioner.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {saved ? `Saved: ${saved}.` : "No hours saved: the practice's opening hours apply. The days below are a suggestion until you save."}
        </p>
      </div>

      <div>
        <label htmlFor="hours-slot" className={LABEL_CLASS}>Diary slot</label>
        <select
          id="hours-slot"
          value={slot ?? ''}
          disabled={!isAdmin || saving || !settings}
          onChange={(event) => void saveSlot(event.target.value)}
          className={INPUT_CLASS}
          aria-describedby="hours-slot-help"
        >
          <option value="">Standard (30-minute rows)</option>
          {SLOT_LENGTH_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatBookingLength(minutes)}
            </option>
          ))}
        </select>
        <p id="hours-slot-help" className="mt-1 text-xs text-gray-500">
          {isAdmin
            ? `${name}'s diary rows, the start times offered and "Next free slot" follow it (standard: rows of 30 minutes, start times every 15). Saved as soon as you choose.`
            : 'Only a practice administrator can change the diary slot.'}
        </p>
      </div>

      {!canEdit && <ReadOnlyNote>Only a practice administrator, or {name}, can change these hours.</ReadOnlyNote>}

      <fieldset disabled={!canEdit} className="space-y-2">
        <legend className="sr-only">Working days and hours</legend>
        {WEEK_ORDER.map((day) => {
          const item = draft[day];
          const dayName = WEEKDAY_NAMES[day];
          return (
            <div key={day} className={`rounded-xl border p-3 ${item.works ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50'}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="inline-flex w-32 items-center gap-2 text-sm font-medium text-gray-800">
                  <input type="checkbox" className={CHECK_CLASS} checked={item.works} onChange={(event) => changeDay(day, { works: event.target.checked })} />
                  {dayName}
                </label>
                {item.works ? (
                  <>
                    <div className="flex items-center gap-2">
                      <input type="time" step={900} aria-label={`${dayName}: starts`} value={item.start} onChange={(event) => changeDay(day, { start: event.target.value })} className={TIME_CLASS} />
                      <span className="text-sm text-gray-500" aria-hidden="true">to</span>
                      <input type="time" step={900} aria-label={`${dayName}: ends`} value={item.end} onChange={(event) => changeDay(day, { end: event.target.value })} className={TIME_CLASS} />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" className={CHECK_CLASS} checked={item.hasBreak} onChange={(event) => changeDay(day, { hasBreak: event.target.checked })} />
                      Break
                    </label>
                    {item.hasBreak && (
                      <div className="flex items-center gap-2">
                        <input type="time" step={900} aria-label={`${dayName}: break starts`} value={item.breakStart} onChange={(event) => changeDay(day, { breakStart: event.target.value })} className={TIME_CLASS} />
                        <span className="text-sm text-gray-500" aria-hidden="true">to</span>
                        <input type="time" step={900} aria-label={`${dayName}: break ends`} value={item.breakEnd} onChange={(event) => changeDay(day, { breakEnd: event.target.value })} className={TIME_CLASS} />
                      </div>
                    )}
                    {branches.length > 1 && (
                      <select
                        aria-label={`${dayName}: branch`}
                        value={item.branchId ?? ''}
                        onChange={(event) => changeDay(day, { branchId: event.target.value || null })}
                        className={`${FIELD_CLASS} max-w-full`}
                      >
                        <option value="">Any branch</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-500">Not working</span>
                )}
              </div>
            </div>
          );
        })}
      </fieldset>

      <Errors errors={errors} />

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyMonday} disabled={saving} className={SECONDARY_CLASS}>
              Copy Monday to Tuesday-Friday
            </button>
            {saved && (
              <button type="button" onClick={handleClear} disabled={saving} className={SECONDARY_CLASS}>
                Use the practice's hours
              </button>
            )}
          </div>
          <button type="submit" disabled={saving} className={PRIMARY_CLASS}>
            <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:clock-circle-bold-duotone'} className={`h-5 w-5 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            {saving ? 'Saving...' : 'Save hours'}
          </button>
        </div>
      )}
    </form>
  );
};

export default DiarySettingsModal;
