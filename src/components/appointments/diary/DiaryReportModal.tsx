import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../../modals/FormModal';
import { AddToListButton } from '../../patientLists/AddToListButton';
import { loadDiaryReport, type DiaryReport, type DiaryReportLoad } from '../../../services/diaryReportService';
import { isRecallsNotSetUpError, patientRecallService, type RecallPatient } from '../../../services/patientRecallService';
import { formatHours, formatRate, noShowsByPatient, type PractitionerReportRow, type ReportBooking, type ReportOutcome } from '../../../utils/diary/diaryReport';
import { focusOnBooking, type DiaryDayFocus } from '../../../utils/diary/diaryDayFocus';
import { movedRecalls, noShowRecalls, reportRecallsMessage } from '../../../utils/diary/reportRecalls';
import { recalledNotSeen, type PatientRecall } from '../../../utils/patientLists/recalls';
import { windhoekClock } from '../../../utils/patientLists/listDates';
import { DIARY_STATUS_COLOUR_STYLES } from '../../../utils/diary/diaryStatuses';
import { diaryRangeFor } from '../../../utils/diary/diaryRange';
import { addDaysToKey, formatDiaryDate, formatDiaryDateRange, parseDateKey, toDateKey } from '../../../utils/diary/diaryTime';

interface DiaryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceId: string | null;
  practitioners: Array<{ id: string; name: string }>;
  /** Opens a day in the diary (the report closes), with the booking in view: its practitioner, cancelled ones shown */
  onOpenDay: (date: string, focus: DiaryDayFocus) => void;
  /** Opens a patient's file (the report closes); without it names are plain text */
  onOpenPatient?: (patientId: string) => void;
}

/** A small round button, as the report's number chips */
const CHIP_BUTTON =
  'inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-default disabled:opacity-60';

type RecallReportLoad =
  | { state: 'loading' }
  | { state: 'not_set_up' }
  | { state: 'error' }
  | { state: 'ready'; recalls: PatientRecall[]; patients: Map<string, RecallPatient> };

type PeriodId = 'this_week' | 'last_week' | 'this_month' | 'last_month';

const PERIODS: Array<{ id: PeriodId; label: string }> = [
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' }
];

type ListKey = 'bookingIds' | 'seenIds' | 'noShowIds' | 'cancelledIds' | 'unmarkedIds' | 'upcomingIds';

const LIST_LABELS: Record<ListKey, string> = {
  bookingIds: 'Bookings',
  seenIds: 'Seen',
  noShowIds: 'No-shows',
  cancelledIds: 'Cancelled',
  unmarkedIds: 'Not marked',
  upcomingIds: 'Still to come'
};

const OUTCOME_LABELS: Record<ReportOutcome, string> = {
  seen: 'Seen',
  no_show: 'No-show',
  cancelled: 'Cancelled',
  upcoming: 'Booked'
};

/** The booking in view when its day opens: its practitioner's column, and the cancelled bookings for a cancelled one */
const focusOf = (booking: ReportBooking | undefined): DiaryDayFocus =>
  focusOnBooking({ practitionerId: booking?.practitionerId, cancelled: booking?.outcome === 'cancelled' });

function periodRange(id: PeriodId): { from: string; to: string } {
  const today = new Date();
  if (id === 'this_week') return diaryRangeFor('week', today);
  if (id === 'this_month') return diaryRangeFor('month', today);
  if (id === 'last_week') {
    const thisWeek = diaryRangeFor('week', today);
    return { from: addDaysToKey(thisWeek.from, -7), to: addDaysToKey(thisWeek.from, -1) };
  }
  return diaryRangeFor('month', new Date(today.getFullYear(), today.getMonth() - 1, 1));
}

/** The bookings a number counts, each opening its day in the diary (the report closes) */
const BookingList: React.FC<{
  title: string;
  ids: string[];
  report: DiaryReport;
  today: string;
  onOpenDay: (date: string, focus: DiaryDayFocus) => void;
  onClose: () => void;
}> = ({ title, ids, report, today, onOpenDay, onClose }) => (
  <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50/50">
    <p className="px-3 pt-2 text-xs font-semibold text-purple-900">{title}</p>
    <ul className="max-h-60 divide-y divide-purple-100 overflow-y-auto">
      {ids.map((id) => {
        const booking = report.bookingsById.get(id);
        if (!booking) return null;
        const day = parseDateKey(booking.date);
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => {
                onOpenDay(booking.date, focusOf(booking));
                onClose();
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-purple-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500"
              aria-label={`${booking.patientName}, ${formatDiaryDate(booking.date)}${booking.time ? ` at ${booking.time}` : ''}. Open the day in the diary.`}
            >
              {/* Two lines, so a name never squeezes into a narrow column on a phone */}
              <span className="min-w-0 flex-1">
                <span className="block break-words text-gray-900">{booking.patientName}</span>
                <span className="block text-xs tabular-nums text-gray-500">
                  {day ? formatDiaryDate(booking.date) : booking.date}
                  {booking.date === today ? ' (today)' : ''}, {booking.time ?? 'no time'} · {OUTCOME_LABELS[booking.outcome]}
                </span>
              </span>
              <Icon icon="solar:square-arrow-right-up-bold-duotone" className="h-4 w-4 flex-none text-purple-500" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  </div>
);

/**
 * Diary report: bookings per practitioner, no-show and cancellation rates and how full each diary
 * was, and how many bookings had each of the practice's own statuses. Every number opens the
 * bookings it counts, and each booking opens its day in the diary.
 */
export const DiaryReportModal: React.FC<DiaryReportModalProps> = ({ isOpen, onClose, ...rest }) => (
  <FormModal isOpen={isOpen} onClose={onClose} title="Diary report" icon="solar:chart-square-bold-duotone" className="max-w-3xl">
    <DiaryReportContent {...rest} onClose={onClose} />
  </FormModal>
);

const DiaryReportContent: React.FC<Omit<DiaryReportModalProps, 'isOpen'>> = ({ practiceId, practitioners, onOpenDay, onOpenPatient, onClose }) => {
  const [period, setPeriod] = useState<PeriodId>('this_week');
  const [load, setLoad] = useState<DiaryReportLoad | { state: 'loading' }>({ state: 'loading' });
  const [open, setOpen] = useState<{ practitionerKey: string; list: ListKey } | null>(null);
  // The practice status whose bookings are listed
  const [openStatus, setOpenStatus] = useState<string | null>(null);
  // Recalls of the period still open (parity O5: recalled but not seen); read again after some were moved to today
  const [recallLoad, setRecallLoad] = useState<RecallReportLoad>({ state: 'loading' });
  const [recallsVersion, setRecallsVersion] = useState(0);
  const range = useMemo(() => periodRange(period), [period]);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    setLoad({ state: 'loading' });
    setOpen(null);
    setOpenStatus(null);
    loadDiaryReport(practiceId, range.from, range.to, practitioners).then((loaded) => {
      if (!cancelled) setLoad(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, range.from, range.to, practitioners]);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    setRecallLoad({ state: 'loading' });
    patientRecallService
      .loadOpenInRange(practiceId, range.from, range.to)
      .then(async (recalls) => {
        const patients = await patientRecallService.loadPatients(practiceId, recalls.map((recall) => recall.patientId));
        if (!cancelled) setRecallLoad({ state: 'ready', recalls, patients });
      })
      .catch((error: unknown) => {
        if (!cancelled) setRecallLoad(isRecallsNotSetUpError(error) ? { state: 'not_set_up' } : { state: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, range.from, range.to, recallsVersion]);

  if (!practiceId) return <p className="text-sm text-red-600">Your practice couldn't be identified. Reload the page and try again.</p>;

  const report = load.state === 'ready' ? load.report : null;
  const keyOf = (row: PractitionerReportRow) => row.practitionerId ?? 'none';
  const totals = report?.rows.reduce(
    (sum, row) => ({
      bookings: sum.bookings + row.bookingIds.length,
      seen: sum.seen + row.seenIds.length,
      noShows: sum.noShows + row.noShowIds.length,
      cancelled: sum.cancelled + row.cancelledIds.length
    }),
    { bookings: 0, seen: 0, noShows: 0, cancelled: 0 }
  );
  const today = toDateKey(new Date());
  // Patients who missed appointments in the period, and recalls whose day passed without a booking (parity O5)
  const noShows = report ? noShowsByPatient([...report.bookingsById.values()], range.from, range.to) : [];
  const notSeen = recallLoad.state === 'ready' ? recalledNotSeen(recallLoad.recalls, range, today) : [];
  const periodLabel = formatDiaryDateRange(range.from, range.to);

  // "Move to a recall list" also gives each patient a recall (src/utils/diary/reportRecalls.ts), so they come due on the
  // "Recall due" list and the recall closes once they book: no-shows a recall for today, the recalled-not-seen their
  // recall moved to today. Runs once the patients are on the list
  const giveRecalls = async (kind: 'no_shows' | 'not_seen') => {
    if (!practiceId) return;
    const recallToday = windhoekClock(new Date()).dateKey;
    try {
      const recalls =
        kind === 'no_shows'
          ? noShowRecalls(noShows, await patientRecallService.loadInForceForPatients(practiceId, noShows.map((row) => row.patientId)), recallToday)
          : movedRecalls(notSeen, recallToday);
      const result = recalls.length > 0 ? await patientRecallService.setRecalls(practiceId, recalls) : { set: 0, refused: 0, firstRefusal: null };
      const message = reportRecallsMessage(kind, result);
      if (message.tone === 'error') toast.error(message.text, { duration: 8000 });
      else toast.success(message.text);
      if (kind === 'not_seen' && result.set > 0) setRecallsVersion((version) => version + 1);
    } catch (error) {
      if (isRecallsNotSetUpError(error)) toast('No recall was set: recalls are not set up in this database yet.');
      else toast.error(error instanceof Error ? error.message : 'The recalls could not be set.');
    }
  };

  const patientName = (patientId: string, name: string) =>
    onOpenPatient ? (
      <button
        type="button"
        onClick={() => {
          onOpenPatient(patientId);
          onClose();
        }}
        className="rounded text-left text-sm font-medium text-purple-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
      >
        {name}
      </button>
    ) : (
      <span className="text-sm font-medium text-gray-900">{name}</span>
    );

  const chip = (row: PractitionerReportRow, list: ListKey, extra?: string) => {
    const count = row[list].length;
    const selected = open?.practitionerKey === keyOf(row) && open.list === list;
    return (
      <button
        key={list}
        type="button"
        aria-pressed={selected}
        aria-label={`${row.name}: ${LIST_LABELS[list]} ${count}${extra ? `, ${extra}` : ''}. ${selected ? 'Hide' : 'Show'} the bookings.`}
        disabled={count === 0}
        onClick={() => setOpen(selected ? null : { practitionerKey: keyOf(row), list })}
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-default disabled:opacity-60 ${
          selected ? 'border-purple-400 bg-purple-100 text-purple-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        {LIST_LABELS[list]} <span className="font-bold tabular-nums">{count}</span>
        {extra && <span className="text-gray-500">({extra})</span>}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Period" className="flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={period === item.id}
            onClick={() => setPeriod(item.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
              period === item.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-600">{formatDiaryDateRange(range.from, range.to)}</p>

      {load.state === 'loading' && <p className="text-sm text-gray-500" role="status">Counting the bookings...</p>}
      {load.state === 'error' && <p className="text-sm text-red-600" role="alert">{load.message}</p>}

      {report && totals && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          All practitioners: <strong>{totals.bookings}</strong> bookings, <strong>{totals.seen}</strong> seen, no-show rate{' '}
          <strong>{formatRate(totals.seen + totals.noShows > 0 ? totals.noShows / (totals.seen + totals.noShows) : null)}</strong>, cancellation rate{' '}
          <strong>{formatRate(totals.bookings > 0 ? totals.cancelled / totals.bookings : null)}</strong>.
        </p>
      )}

      {/* The practice's own statuses (Diary settings > Statuses): how many bookings were last given each */}
      {report && report.statusCounts.length > 0 && (
        <section aria-labelledby="report-statuses" className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 id="report-statuses" className="text-sm font-semibold text-gray-900">By status</h3>
          <p className="text-xs text-gray-500">Each booking counts under the last status it was given.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.statusCounts.map(({ status, bookingIds }) => {
              const style = DIARY_STATUS_COLOUR_STYLES[status.colour];
              const selected = openStatus === status.id;
              return (
                <button
                  key={status.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${status.name}: ${bookingIds.length}. ${selected ? 'Hide' : 'Show'} the bookings.`}
                  disabled={bookingIds.length === 0}
                  onClick={() => setOpenStatus(selected ? null : status.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-default disabled:opacity-60 ${style.chip} ${
                    selected ? 'outline outline-2 outline-offset-1 outline-purple-500' : ''
                  }`}
                >
                  <span className={`h-2 w-2 flex-none rounded-full ${style.dot}`} aria-hidden="true" />
                  {status.name}
                  {!status.isActive && <span className="font-normal">(removed)</span>}
                  <span className="font-bold tabular-nums">{bookingIds.length}</span>
                </button>
              );
            })}
          </div>
          {openStatus && (
            <BookingList
              title={(() => {
                const count = report.statusCounts.find((item) => item.status.id === openStatus);
                return count ? `${count.status.name} (${count.bookingIds.length})` : '';
              })()}
              ids={report.statusCounts.find((item) => item.status.id === openStatus)?.bookingIds ?? []}
              report={report}
              today={today}
              onOpenDay={onOpenDay}
              onClose={onClose}
            />
          )}
        </section>
      )}

      {report?.rows.map((row) => {
        const isOpen = open?.practitionerKey === keyOf(row);
        const ids = isOpen && open ? row[open.list] : [];
        const utilisation = row.utilisation === null ? null : Math.min(1, row.utilisation);
        return (
          <section key={keyOf(row)} aria-labelledby={`report-${keyOf(row)}`} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id={`report-${keyOf(row)}`} className="text-sm font-semibold text-gray-900">{row.name}</h3>
              <p className="text-xs text-gray-600">
                {row.availableMinutes === null
                  ? `Booked ${formatHours(row.bookedMinutes)}`
                  : `Booked ${formatHours(row.bookedMinutes)} of ${formatHours(row.availableMinutes)} available (${formatRate(row.utilisation)})`}
              </p>
            </div>
            {utilisation !== null && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600" style={{ width: `${Math.round(utilisation * 100)}%` }} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {chip(row, 'bookingIds')}
              {chip(row, 'seenIds')}
              {chip(row, 'noShowIds', formatRate(row.noShowRate))}
              {chip(row, 'cancelledIds', formatRate(row.cancellationRate))}
              {row.unmarkedIds.length > 0 && chip(row, 'unmarkedIds')}
              {row.upcomingIds.length > 0 && chip(row, 'upcomingIds')}
            </div>
            {isOpen && open && (
              <BookingList
                title={`${LIST_LABELS[open.list]} (${ids.length})${open.list === 'unmarkedIds' ? ': check them in or mark them as no-shows' : ''}`}
                ids={ids}
                report={report}
                today={today}
                onOpenDay={onOpenDay}
                onClose={onClose}
              />
            )}
          </section>
        );
      })}

      {report && report.rows.length === 0 && <p className="text-sm text-gray-500">No practitioners or bookings in this period.</p>}

      {/* Who missed appointments, when and how often; they can be moved to a recall list to call them back */}
      {report && (
        <section aria-labelledby="report-no-shows" className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="report-no-shows" className="text-sm font-semibold text-gray-900">No-shows by patient</h3>
            {noShows.length > 0 && (
              <AddToListButton
                practiceId={practiceId}
                patientIds={noShows.map((row) => row.patientId)}
                scope="listed"
                label="Move to a recall list"
                title="Move the no-shows to a recall list"
                suggestedName={`No-shows ${periodLabel}`}
                buttonClassName={CHIP_BUTTON}
                onAdded={() => void giveRecalls('no_shows')}
              />
            )}
          </div>
          <p className="text-xs text-gray-500">Who did not come, when, and how often out of the visits they were due for.</p>
          {noShows.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No no-shows in this period.</p>
          ) : (
            <ul className="mt-2 max-h-72 divide-y divide-gray-100 overflow-y-auto">
              {noShows.map((row) => (
                <li key={row.patientId} className="py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    {patientName(row.patientId, row.patientName)}
                    <span className="text-xs tabular-nums text-gray-600">
                      Missed {row.dates.length} of {row.dueCount} {row.dueCount === 1 ? 'visit' : 'visits'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {row.bookingIds.map((bookingId, index) => (
                      <button
                        key={bookingId}
                        type="button"
                        onClick={() => {
                          onOpenDay(row.dates[index], focusOf(report.bookingsById.get(bookingId)));
                          onClose();
                        }}
                        className={CHIP_BUTTON}
                        aria-label={`${row.patientName} missed ${formatDiaryDate(row.dates[index])}. Open the day in the diary.`}
                      >
                        {formatDiaryDate(row.dates[index])}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Recalls whose day passed without a booking or visit that completes them (Eminance's "No shows" report) */}
      <section aria-labelledby="report-recalled" className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="report-recalled" className="text-sm font-semibold text-gray-900">Recalled but not seen</h3>
          {notSeen.length > 0 && (
            <AddToListButton
              practiceId={practiceId}
              patientIds={[...new Set(notSeen.map((recall) => recall.patientId))]}
              scope="listed"
              label="Move to a recall list"
              title="Move them to a recall list"
              suggestedName={`Recalled, not seen ${periodLabel}`}
              buttonClassName={CHIP_BUTTON}
              onAdded={() => void giveRecalls('not_seen')}
            />
          )}
        </div>
        <p className="text-xs text-gray-500">Recalls dated in this period that have passed with nothing booked; a missed booking does not count.</p>
        {recallLoad.state === 'loading' && <p className="mt-3 text-sm text-gray-500" role="status">Checking the recalls...</p>}
        {recallLoad.state === 'not_set_up' && <p className="mt-3 text-sm text-gray-500">Recalls are not set up in this database yet.</p>}
        {recallLoad.state === 'error' && <p className="mt-3 text-sm text-red-600" role="alert">The recalls could not be loaded.</p>}
        {recallLoad.state === 'ready' && notSeen.length === 0 && <p className="mt-3 text-sm text-gray-500">No recall in this period passed without a booking.</p>}
        {recallLoad.state === 'ready' && notSeen.length > 0 && (
          <ul className="mt-2 max-h-72 divide-y divide-gray-100 overflow-y-auto">
            {notSeen.map((recall) => {
              const patient = recallLoad.patients.get(recall.patientId);
              return (
                <li key={recall.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="min-w-0">
                    {patientName(recall.patientId, patient?.name ?? 'Patient')}
                    <span className="block text-xs text-gray-500">{recall.reason}</span>
                  </span>
                  <span className="text-xs tabular-nums text-amber-700">Due {formatDiaryDate(recall.dueOn)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="text-xs text-gray-500">
        No-show rate: no-shows out of the patients who were due. Available hours: working hours (else opening hours) less breaks,
        blocked time and public holidays.
      </p>
    </div>
  );
};

export default DiaryReportModal;
