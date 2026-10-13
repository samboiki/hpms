import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { useSmsRepliesLive } from '../../hooks/useSmsRepliesLive';
import { SmsReplyCard } from './SmsReplyCard';
import {
  loadSmsReplies,
  sendSmsReplyAnswer,
  setSmsReplyHandled,
  subscribeToSmsReplies,
  type SmsReply,
  type SmsReplyFilter,
} from './smsRepliesService';

export interface SmsRepliesInboxProps {
  /** The practice whose replies are shown (usePractice().practiceId); nothing loads while it is empty */
  practiceId: string | null | undefined;
  /** Called with the number of replies waiting for staff after every load, e.g. for a tab badge */
  onNeedsReplyCountChange?: (count: number) => void;
  className?: string;
}

const FILTERS: ReadonlyArray<{ id: SmsReplyFilter; label: string }> = [
  { id: 'needs_reply', label: 'Needs reply' },
  { id: 'handled', label: 'Handled' },
  { id: 'all', label: 'All' },
];

const EMPTY_TEXT: Record<SmsReplyFilter, { title: string; body: string }> = {
  needs_reply: {
    title: 'Nothing needs a reply',
    body: 'Replies that need a person (questions, booking requests, unclear answers) appear here.',
  },
  handled: { title: 'No handled replies yet', body: 'Replies handled automatically or by staff appear here.' },
  all: { title: 'No SMS replies yet', body: "When patients answer your SMS messages, their replies appear here." },
};

/** Until OneHealth support switches replies on for the practice, nothing a patient answers arrives here. */
const NOT_COLLECTED_TEXT = {
  title: 'Replies are not collected yet',
  body: "Patients' answers to your SMS do not reach OneHealth yet, so reminders and booking messages do not ask them to reply. OneHealth support switches replies on for your practice.",
};

type View =
  | { kind: 'loading' }
  | { kind: 'not_enabled' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; replies: SmsReply[] };

/**
 * Patients' replies to the practice's SMS messages. Clear answers (1 / YES, 2 / NO, STOP, START, HELP)
 * are handled by the sms-reply-webhook edge function; everything else waits under "Needs reply".
 * Staff open the patient, answer by SMS (through the SMS gateway) and mark replies handled.
 * Until OneHealth support switches replies on for the practice (useSmsRepliesLive), the inbox says that replies are
 * not collected instead of an all-clear "Nothing needs a reply".
 */
export function SmsRepliesInbox({ practiceId, onNeedsReplyCountChange, className }: SmsRepliesInboxProps) {
  const [filter, setFilter] = useState<SmsReplyFilter>('needs_reply');
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [needsReplyCount, setNeedsReplyCount] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const countListener = useRef(onNeedsReplyCountChange);
  const titleId = useId();
  // null while it is read; false: patients' answers do not arrive, so the empty inbox must not look like "all done"
  const repliesLive = useSmsRepliesLive(practiceId);

  useEffect(() => {
    countListener.current = onNeedsReplyCountChange;
  }, [onNeedsReplyCountChange]);

  const load = useCallback(async () => {
    if (!practiceId) return;
    const request = ++latestRequest.current;
    const result = await loadSmsReplies(practiceId, filter);
    if (request !== latestRequest.current) return; // a newer load (filter change, live update) won
    if (result.state === 'ready') {
      setView({ kind: 'ready', replies: result.replies });
      setNeedsReplyCount(result.needsReplyCount);
      countListener.current?.(result.needsReplyCount);
    } else if (result.state === 'not_enabled') {
      setView({ kind: 'not_enabled' });
    } else {
      setView({ kind: 'error', message: result.message });
    }
  }, [practiceId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates: a new reply (or one handled on another screen) reloads the list
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  const enabled = view.kind !== 'not_enabled';
  useEffect(() => {
    if (!practiceId || !enabled) return undefined;
    return subscribeToSmsReplies(practiceId, () => {
      void loadRef.current();
    });
  }, [practiceId, enabled]);

  const chooseFilter = (next: SmsReplyFilter) => {
    if (next === filter) return;
    setView({ kind: 'loading' });
    setFilter(next);
  };

  const setHandled = async (reply: SmsReply, handled: boolean) => {
    setBusyId(reply.id);
    const result = await setSmsReplyHandled(reply.id, handled);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(handled ? 'Marked as handled' : 'Moved back to Needs reply');
    await load();
  };

  const sendAnswer = async (reply: SmsReply, answer: string): Promise<boolean> => {
    const result = await sendSmsReplyAnswer(reply, answer);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    toast.success(result.markedHandled ? 'Reply sent and marked as handled' : 'Reply sent (could not mark it handled)');
    await load();
    return true;
  };

  const emptyText = repliesLive === false ? NOT_COLLECTED_TEXT : EMPTY_TEXT[filter];
  const status =
    view.kind === 'ready'
      ? `${view.replies.length} ${view.replies.length === 1 ? 'reply' : 'replies'} shown${
          needsReplyCount ? `, ${needsReplyCount} waiting for a reply` : ''
        }`
      : view.kind === 'loading'
        ? 'Loading SMS replies'
        : '';

  return (
    <section aria-labelledby={titleId} className={cn('rounded-2xl border border-gray-200 bg-white shadow-sm', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
            <Icon icon="solar:chat-round-dots-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">
              SMS replies
            </h2>
            <p className="text-sm text-gray-600">
              Patients&apos; answers to your SMS messages.
              {repliesLive ? ' Clear answers (1 or YES, 2 or NO, STOP) are handled automatically.' : ''}
            </p>
          </div>
        </div>
        {enabled && (
          <button
            type="button"
            onClick={() => void load()}
            disabled={!practiceId || view.kind === 'loading'}
            className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        )}
      </header>

      {view.kind === 'not_enabled' ? (
        <div className="px-4 py-10 text-center sm:px-6">
          <Icon icon="solar:chat-round-dots-bold-duotone" className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-gray-900">Two-way SMS is not switched on yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
            Once it is, patients can answer your SMS messages to confirm or cancel appointments, ask for a booking or stop
            messages, and their replies appear here. Ask your OneHealth administrator to switch it on.
          </p>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Show replies" className="grid grid-cols-3 gap-1 border-b border-gray-100 p-2 sm:p-3">
            {FILTERS.map((option) => {
              const selected = option.id === filter;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseFilter(option.id)}
                  className={cn(
                    'inline-flex min-h-[2.5rem] items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                    selected ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  {option.label}
                  {option.id === 'needs_reply' && needsReplyCount ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-xs font-semibold',
                        selected ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-900'
                      )}
                    >
                      {needsReplyCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="sr-only" role="status">
            {status}
          </p>

          {!practiceId && (
            <p className="px-4 py-10 text-center text-sm text-gray-600 sm:px-6">Choose a practice to see its SMS replies.</p>
          )}

          {practiceId && view.kind === 'loading' && (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-600">
              <Icon icon="solar:refresh-bold-duotone" className="h-5 w-5 animate-spin text-cyan-600" aria-hidden="true" />
              Loading SMS replies...
            </div>
          )}

          {view.kind === 'error' && (
            <div className="px-4 py-8 text-center sm:px-6" role="alert">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
              <h3 className="mt-2 font-semibold text-gray-900">Could not load SMS replies</h3>
              <p className="mt-1 break-words text-sm text-gray-600">{view.message}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
            </div>
          )}

          {view.kind === 'ready' && repliesLive === false && view.replies.length > 0 && (
            <p className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-5" role="status">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {NOT_COLLECTED_TEXT.title}: new answers from patients do not arrive here. OneHealth support switches replies on.
            </p>
          )}

          {view.kind === 'ready' &&
            (view.replies.length === 0 ? (
              <div className="px-4 py-10 text-center sm:px-6">
                {repliesLive === false ? (
                  <Icon icon="solar:chat-round-dots-bold-duotone" className="mx-auto h-10 w-10 text-gray-300" aria-hidden="true" />
                ) : (
                  <Icon icon="solar:check-circle-bold-duotone" className="mx-auto h-10 w-10 text-emerald-400" aria-hidden="true" />
                )}
                <h3 className="mt-2 font-semibold text-gray-900">{emptyText.title}</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">{emptyText.body}</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {view.replies.map((reply) => (
                  <li key={reply.id}>
                    <SmsReplyCard reply={reply} busy={busyId === reply.id} onSetHandled={setHandled} onSendAnswer={sendAnswer} />
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}
    </section>
  );
}

export default SmsRepliesInbox;
