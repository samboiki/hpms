import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { cn } from '../../utils/cn';
import { bookingLinks } from '../../utils/diary/patientBookings';
import {
  answerPortalRequest,
  loadPortalRequests,
  STAFF_NOTE_MAX_LENGTH,
  type PortalRequestFilter,
  type PortalRequestKind,
  type PortalRequestStatus,
  type StaffPortalRequest,
} from './portalRequestsService';

export interface PortalRequestsInboxProps {
  /** The practice whose requests are shown; nothing loads while it is empty */
  practiceId: string | null | undefined;
  /** Called with the number of requests waiting after every load, e.g. for a tab badge */
  onPendingCountChange?: (count: number) => void;
}

const FILTERS: ReadonlyArray<{ id: PortalRequestFilter; label: string }> = [
  { id: 'pending', label: 'Waiting' },
  { id: 'handled', label: 'Answered' },
  { id: 'all', label: 'All' },
];

const KIND_LABELS: Record<PortalRequestKind, { label: string; icon: string; tone: string }> = {
  book: { label: 'Booking request', icon: 'solar:calendar-add-bold-duotone', tone: 'bg-sky-100 text-sky-800' },
  reschedule: { label: 'Wants another time', icon: 'solar:calendar-mark-bold-duotone', tone: 'bg-amber-100 text-amber-800' },
  cancel: { label: 'Cancelled in the app', icon: 'solar:close-circle-bold-duotone', tone: 'bg-rose-100 text-rose-800' },
  profile_change: { label: 'Change to details', icon: 'solar:user-id-bold-duotone', tone: 'bg-violet-100 text-violet-800' },
};

const STATUS_LABELS: Record<PortalRequestStatus, string> = {
  pending: 'Waiting',
  done: 'Done',
  declined: 'Not possible',
  withdrawn: 'Withdrawn by the patient',
};

const TIME_LABELS: Record<string, string> = { morning: 'morning', afternoon: 'afternoon', any: 'any time' };

const day = (value: string | null): string | null => {
  if (!value) return null;
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? null : format(date, 'EEE d MMM yyyy');
};
const when = (value: string): string => {
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'd MMM yyyy, HH:mm');
};

type View = { kind: 'loading' } | { kind: 'not_enabled' } | { kind: 'error'; message: string } | { kind: 'ready'; requests: StaffPortalRequest[] };

function RequestItem({
  request,
  busy,
  onAnswer,
  onOpenPatient,
}: {
  request: StaffPortalRequest;
  busy: boolean;
  onAnswer: (request: StaffPortalRequest, status: 'done' | 'declined', note: string) => Promise<boolean>;
  onOpenPatient: (patientId: string) => void;
}) {
  const [note, setNote] = useState('');
  const kind = KIND_LABELS[request.kind];
  const noteId = useId();

  return (
    <div className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', kind.tone)}>
            <Icon icon={kind.icon} className="h-4 w-4" aria-hidden="true" />
            {kind.label}
          </span>
          <button
            type="button"
            onClick={() => onOpenPatient(request.patientId)}
            className="mt-1 block text-left font-semibold text-gray-900 hover:text-cyan-700 hover:underline"
          >
            {request.patientName ?? 'Patient'}
          </button>
        </div>
        <span className="text-xs text-gray-500">{when(request.createdAt)}</span>
      </div>

      <dl className="grid gap-1 text-sm text-gray-700">
        {request.visitDate && (
          <div>
            <dt className="inline text-gray-500">Appointment: </dt>
            <dd className="inline">
              {day(request.visitDate)}
              {request.visitTime ? ` at ${request.visitTime.slice(0, 5)}` : ''}
            </dd>
          </div>
        )}
        {request.preferredDate && (
          <div>
            <dt className="inline text-gray-500">Would like: </dt>
            <dd className="inline">
              {day(request.preferredDate)}
              {request.preferredTime ? `, ${TIME_LABELS[request.preferredTime] ?? request.preferredTime}` : ''}
            </dd>
          </div>
        )}
        {request.message && (
          <div>
            <dt className="inline text-gray-500">{request.kind === 'profile_change' ? 'Change: ' : 'Message: '}</dt>
            <dd className="inline break-words">{request.message}</dd>
          </div>
        )}
      </dl>

      {/* The booking the request is about, and the diary on the day the patient would like (or the booking's day) */}
      {(request.visitId || request.preferredDate || request.visitDate) && request.kind !== 'profile_change' && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {request.visitId && (
            <Link to={bookingLinks.visit(request.patientId, request.visitId)} className="font-medium text-cyan-700 hover:underline">
              Open the booking
            </Link>
          )}
          {(request.preferredDate ?? request.visitDate) && (
            <Link to={bookingLinks.diaryDay((request.preferredDate ?? request.visitDate) as string)} className="font-medium text-cyan-700 hover:underline">
              Open the diary on {day((request.preferredDate ?? request.visitDate) as string)}
            </Link>
          )}
        </p>
      )}

      {request.status === 'pending' ? (
        <div className="space-y-2">
          <label htmlFor={noteId} className="block text-xs font-medium text-gray-600">
            Note to the patient (shown in their app)
          </label>
          <textarea
            id={noteId}
            rows={2}
            maxLength={STAFF_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={request.kind === 'book' ? 'e.g. Booked for Tue 14 Oct at 09:30 with Dr Shikongo' : 'Optional'}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <p className="text-xs text-gray-500">
            {request.kind === 'book' || request.kind === 'reschedule'
              ? 'Book or move the appointment in the scheduler first, then mark it done.'
              : request.kind === 'profile_change'
                ? "Update the patient's file first, then mark it done."
                : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onAnswer(request, 'done', note).then((saved) => saved && setNote(''))}
              className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Done
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onAnswer(request, 'declined', note).then((saved) => saved && setNote(''))}
              className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <Icon icon="solar:close-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Not possible
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          <span className="font-medium">{STATUS_LABELS[request.status]}</span>
          {request.handledByName ? ` by ${request.handledByName}` : ''}
          {request.handledAt ? `, ${when(request.handledAt)}` : ''}
          {request.staffNote ? ` - "${request.staffNote}"` : ''}
        </p>
      )}
    </div>
  );
}

/**
 * Requests from the patient app: bookings, new times, cancellations made in the app, and changes to
 * details. Reception does the work in the usual screens and answers here; the patient sees the answer.
 */
export function PortalRequestsInbox({ practiceId, onPendingCountChange }: PortalRequestsInboxProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<PortalRequestFilter>('pending');
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const countListener = useRef(onPendingCountChange);
  const titleId = useId();

  useEffect(() => {
    countListener.current = onPendingCountChange;
  }, [onPendingCountChange]);

  const load = useCallback(async () => {
    if (!practiceId) return;
    const request = ++latestRequest.current;
    const result = await loadPortalRequests(practiceId, filter);
    if (request !== latestRequest.current) return;
    if (result.state === 'ready') {
      setView({ kind: 'ready', requests: result.requests });
      setPendingCount(result.pendingCount);
      countListener.current?.(result.pendingCount);
    } else if (result.state === 'not_enabled') {
      setView({ kind: 'not_enabled' });
    } else {
      setView({ kind: 'error', message: result.message });
    }
  }, [practiceId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (request: StaffPortalRequest, status: 'done' | 'declined', note: string): Promise<boolean> => {
    setBusyId(request.id);
    const result = await answerPortalRequest(request.id, status, note);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    toast.success(status === 'done' ? 'Marked as done. The patient sees it in the app.' : 'Marked as not possible. The patient sees your note.');
    await load();
    return true;
  };

  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
            <Icon icon="solar:smartphone-2-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">
              Patient app requests
            </h2>
            <p className="text-sm text-gray-600">
              Bookings, new times and changes patients asked for in the patient app, and appointments they cancelled there.
            </p>
          </div>
        </div>
        {view.kind !== 'not_enabled' && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={!practiceId || view.kind === 'loading'}
            className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        )}
      </header>

      {view.kind === 'not_enabled' ? (
        <div className="px-4 py-10 text-center sm:px-6">
          <Icon icon="solar:smartphone-2-bold-duotone" className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-gray-900">The patient app is not switched on yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
            Once it is, patients sign in with their cell number to see appointments, invoices and released results, and their
            requests appear here. Ask your OneHealth administrator to switch it on.
          </p>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Show requests" className="grid grid-cols-3 gap-1 border-b border-gray-100 p-2 sm:p-3">
            {FILTERS.map((option) => {
              const selected = option.id === filter;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (option.id === filter) return;
                    setView({ kind: 'loading' });
                    setFilter(option.id);
                  }}
                  className={cn(
                    'inline-flex min-h-[2.5rem] items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                    selected ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  {option.label}
                  {option.id === 'pending' && pendingCount ? (
                    <span className={cn('rounded-full px-1.5 text-xs font-semibold', selected ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-900')}>
                      {pendingCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {!practiceId && <p className="px-4 py-10 text-center text-sm text-gray-600">Choose a practice to see its patient app requests.</p>}

          {practiceId && view.kind === 'loading' && (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-600">
              <Icon icon="solar:refresh-circle-bold-duotone" className="h-5 w-5 animate-spin text-cyan-600" aria-hidden="true" />
              Loading requests...
            </div>
          )}

          {view.kind === 'error' && (
            <div className="px-4 py-8 text-center" role="alert">
              <h3 className="font-semibold text-gray-900">Could not load requests</h3>
              <p className="mt-1 break-words text-sm text-gray-600">{view.message}</p>
            </div>
          )}

          {view.kind === 'ready' &&
            (view.requests.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Icon icon="solar:check-circle-bold-duotone" className="mx-auto h-10 w-10 text-emerald-400" aria-hidden="true" />
                <h3 className="mt-2 font-semibold text-gray-900">{filter === 'pending' ? 'Nothing waiting' : 'No requests yet'}</h3>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {view.requests.map((request) => (
                  <li key={request.id}>
                    <RequestItem
                      request={request}
                      busy={busyId === request.id}
                      onAnswer={answer}
                      onOpenPatient={(patientId) => navigate(`/patients?${new URLSearchParams({ patientId }).toString()}`)}
                    />
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}
    </section>
  );
}

export default PortalRequestsInbox;
