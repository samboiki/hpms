import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../../modals/FormModal';
import { loadPracticeBusinessHours } from '../../../services/diarySettingsService';
import {
  REMINDERS_NOT_ENABLED_MESSAGE,
  loadReminderPreview,
  sendRemindersNow,
  type ReminderPreviewLoad
} from '../../../services/reminderRunService';
import {
  REMINDER_SKIP_TEXT,
  summarizeSkipped,
  type ReminderBooking
} from '../../../../supabase/functions/_shared/appointmentReminders.ts';
import type { ReminderRunSummary } from '../../../../supabase/functions/_shared/reminderRun.ts';
import { addDaysToKey, formatDiaryDate, formatDiaryTimestamp, parseDateKey, toDateKey } from '../../../utils/diary/diaryTime';
import { nextOpenDay, practiceHoursResolver } from '../../../utils/diary/nextFreeSlot';
import { getSmsLength } from '../../messages/messageText';

export interface RemindPractitioner {
  id: string;
  name: string;
}

interface RemindPatientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceId: string | null;
  practitioners: RemindPractitioner[];
  /** The practitioner the diary is filtered to: their patients are offered first */
  defaultPractitionerId?: string | null;
  /** Opens Diary settings at the reminders (shown to everyone; only administrators can change them) */
  onOpenSettings?: () => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const INPUT_CLASS =
  'w-full px-4 py-2.5 bg-gray-100 border-0 rounded-lg text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-1';

const dayName = (key: string): string => {
  const date = parseDateKey(key);
  return date ? `${WEEKDAYS[date.getDay()]} ${formatDiaryDate(key)}` : key;
};

const patientName = (booking: ReminderBooking): string =>
  [booking.patientFirstName, booking.patientLastName].filter(Boolean).join(' ') || 'Patient without a name';

/**
 * "Remind patients": SMS reminders for one day's bookings, sent now. Shows how many patients get one,
 * the SMS itself and who is left out and why before anything is sent. The same rules as the automatic
 * schedule, so nobody is reminded twice (P2 / B10 in the parity backlog).
 */
export const RemindPatientsModal: React.FC<RemindPatientsModalProps> = ({ isOpen, onClose, ...rest }) => (
  <FormModal isOpen={isOpen} onClose={onClose} title="Remind patients" icon="solar:bell-bing-bold-duotone" className="max-w-2xl">
    <RemindPatientsContent {...rest} />
  </FormModal>
);

const RemindPatientsContent: React.FC<Omit<RemindPatientsModalProps, 'isOpen' | 'onClose'>> = ({
  practiceId,
  practitioners,
  defaultPractitionerId,
  onOpenSettings
}) => {
  const today = toDateKey(new Date());
  const [date, setDate] = useState<string | null>(null);
  const [practitionerId, setPractitionerId] = useState<string>(
    defaultPractitionerId && practitioners.some((p) => p.id === defaultPractitionerId) ? defaultPractitionerId : ''
  );
  const [load, setLoad] = useState<ReminderPreviewLoad | { state: 'loading' }>({ state: 'loading' });
  const [version, setVersion] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ReminderRunSummary | null>(null);

  // Start on the next day the practice is open: on a Friday that is Monday, not an empty Saturday
  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    loadPracticeBusinessHours(practiceId).then((hours) => {
      if (!cancelled) setDate((current) => current ?? nextOpenDay(today, practiceHoursResolver(hours)) ?? addDaysToKey(today, 1));
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, today]);

  const nameOf = useCallback((id: string | null) => (id ? practitioners.find((p) => p.id === id)?.name ?? null : null), [practitioners]);

  useEffect(() => {
    if (!practiceId || !date) return;
    let cancelled = false;
    setLoad({ state: 'loading' });
    loadReminderPreview({ practiceId, date, practitionerId: practitionerId || null, practitionerName: nameOf }).then((loaded) => {
      if (!cancelled) setLoad(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, date, practitionerId, nameOf, version]);

  const preview = load.state === 'ready' ? load.preview : null;
  const due = preview?.plan.due ?? [];
  const skipped = preview?.plan.skipped ?? [];
  const sample = due[0]?.message ?? null;
  const parts = sample ? getSmsLength(sample).parts : 0;
  const skippedSummary = useMemo(() => summarizeSkipped(skipped), [skipped]);
  const sending = progress !== null && result === null;

  const handleSend = async () => {
    if (due.length === 0 || sending) return;
    setResult(null);
    setProgress({ done: 0, total: due.length });
    const summary = await sendRemindersNow(due, (done, total) => setProgress({ done, total }));
    setResult(summary);
    setProgress(null);
    if (summary.failed === 0) toast.success(`${summary.sent} reminder${summary.sent === 1 ? '' : 's'} sent`);
    else toast.error(`${summary.sent} sent, ${summary.failed} not sent. See the list for why.`);
    setVersion((current) => current + 1);
  };

  if (!practiceId) {
    return <p className="text-sm text-red-600">Your practice couldn't be identified. Reload the page and try again.</p>;
  }

  const automatic = preview?.settings;
  const failures = result?.results.filter((item) => item.outcome === 'failed' || item.outcome === 'not_claimed') ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="remind-day" className={LABEL_CLASS}>Day</label>
          <input
            id="remind-day"
            type="date"
            min={today}
            value={date ?? ''}
            onChange={(event) => {
              setResult(null);
              setDate(event.target.value || null);
            }}
            className={INPUT_CLASS}
          />
          {date && <p className="mt-1 text-xs text-gray-500">{dayName(date)}{date === today ? ' (today)' : ''}</p>}
        </div>
        <div>
          <label htmlFor="remind-practitioner" className={LABEL_CLASS}>Patients of</label>
          <select
            id="remind-practitioner"
            value={practitionerId}
            onChange={(event) => {
              setResult(null);
              setPractitionerId(event.target.value);
            }}
            className={INPUT_CLASS}
          >
            <option value="">All practitioners</option>
            {practitioners.map((practitioner) => (
              <option key={practitioner.id} value={practitioner.id}>
                {practitioner.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Whether the schedule sends them by itself, in plain words */}
      {automatic && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
          <Icon icon="solar:clock-circle-bold-duotone" className="mt-0.5 h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {automatic.enabled
              ? `Automatic reminders are on${automatic.dayBefore ? `: the day before at ${automatic.dayBeforeTime}` : ''}${automatic.sameDay ? `${automatic.dayBefore ? ' and' : ':'} ${automatic.sameDayHoursBefore} hours before` : ''}. ${
                  preview?.remindersLastRunAt
                    ? `Last check ${formatDiaryTimestamp(preview.remindersLastRunAt)}.`
                    : 'The schedule has not run yet: ask your administrator to switch it on.'
                }`
              : 'Automatic reminders are off, so patients are only reminded when you send them here.'}
          </span>
          {onOpenSettings && (
            <button type="button" onClick={onOpenSettings} className="font-medium text-purple-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded">
              Reminder settings
            </button>
          )}
        </div>
      )}

      {load.state === 'loading' && <p className="text-sm text-gray-500" role="status">Checking the bookings...</p>}
      {load.state === 'error' && <p className="text-sm text-red-600" role="alert">{load.message}</p>}
      {load.state === 'not_enabled' && (
        <div className="rounded-xl bg-gray-50 px-4 py-6 text-center">
          <Icon icon="solar:bell-bing-bold-duotone" className="mx-auto mb-2 h-8 w-8 text-indigo-400" aria-hidden="true" />
          <p className="text-sm text-gray-600">{REMINDERS_NOT_ENABLED_MESSAGE}</p>
        </div>
      )}

      {preview && (
        <>
          <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
            <p className="text-sm text-purple-900">
              <span className="text-2xl font-bold">{due.length}</span>{' '}
              {due.length === 1 ? 'patient gets' : 'patients get'} a reminder for {dayName(preview.date)}
              {due.length > 0 && parts > 0 ? ` (${parts} SMS each)` : ''}.
            </p>
            {skippedSummary.length > 0 && (
              <p className="mt-1 text-xs text-purple-800/80">
                Not reminded: {skippedSummary.map((item) => `${REMINDER_SKIP_TEXT[item.reason]} (${item.count})`).join('; ')}.
              </p>
            )}
            {sample && (
              <figure className="mt-3">
                <figcaption className="text-xs font-medium text-purple-900">The SMS, for {patientName(due[0].booking)}:</figcaption>
                <p className="mt-1 whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">{sample}</p>
              </figure>
            )}
          </div>

          {due.length > 0 && (
            <section aria-labelledby="remind-list-title">
              <h3 id="remind-list-title" className="text-sm font-semibold text-gray-900">Who gets one</h3>
              <ul className="mt-2 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {due.map((item) => (
                  <li key={`${item.booking.visitId}-${item.kind}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
                    <span className="w-12 flex-none font-medium tabular-nums text-gray-900">{item.booking.time}</span>
                    <span className="min-w-0 flex-1 break-words text-gray-800">{patientName(item.booking)}</span>
                    <span className="text-xs text-gray-500">{nameOf(item.booking.practitionerId) ?? ''}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {skipped.length > 0 && (
            <details className="rounded-lg border border-gray-200 bg-white">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700">
                Not reminded ({skipped.length})
              </summary>
              <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto border-t border-gray-100">
                {skipped.map((item) => (
                  <li key={`${item.booking.visitId}-${item.kind}`} className="px-3 py-2 text-sm">
                    <span className="font-medium tabular-nums text-gray-900">{item.booking.time ?? '--:--'}</span>{' '}
                    <span className="text-gray-800">{patientName(item.booking)}</span>
                    <span className="block text-xs text-gray-500">
                      {REMINDER_SKIP_TEXT[item.reason]}
                      {item.detail ? `: ${item.detail}` : ''}
                      {item.reason === 'failed_before' || item.reason === 'no_cell_number' ? '. Call the patient.' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {sending && progress && (
        <div role="status" aria-live="polite">
          <p className="text-sm text-gray-700">
            Sending {progress.done} of {progress.total}...
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-[width] motion-reduce:transition-none"
              style={{ width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {result && (
        <div role="status" className={`rounded-lg border p-3 text-sm ${failures.length > 0 ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
          <p className="font-medium">
            {result.sent} sent{result.duplicate > 0 ? `, ${result.duplicate} already reminded by someone else` : ''}
            {failures.length > 0 ? `, ${failures.length} not sent` : ''}.
          </p>
          {failures.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {failures.map((item) => (
                <li key={item.reminder.booking.visitId} className="break-words">
                  {patientName(item.reminder.booking)}: {item.error ?? 'not sent'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={!preview || due.length === 0 || sending}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:from-purple-600 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
        >
          <Icon
            icon={sending ? 'solar:refresh-bold-duotone' : 'solar:bell-bing-bold-duotone'}
            className={`h-5 w-5 ${sending ? 'animate-spin motion-reduce:animate-none' : ''}`}
            aria-hidden="true"
          />
          {sending ? 'Sending...' : due.length > 0 ? `Send ${due.length} reminder${due.length === 1 ? '' : 's'}` : 'Nobody to remind'}
        </button>
      </div>
    </div>
  );
};

export default RemindPatientsModal;
