import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { invoiceLink, patientOverviewLink } from '../billing/invoiceLinks';
import { bookingLinks } from '../../utils/diary/patientBookings';
import { OUTCOME_LABELS, type MessageOutcome } from '../patients/patientMessages';
import { logTime, type LogChannelFilter, type LogOutcomeFilter, type MessageLogEntry } from './messageLog';
import { loadMessageBody, loadMessageLog, type MessageBody } from './messageLogService';

export interface MessageLogViewProps {
  practiceId: string;
  /** Only this patient's messages (the patient file's "Show all"); the patient column is then left out */
  patientId?: string | null;
  /** Called when a link leaves the screen (a dialog closes itself) */
  onNavigate?: () => void;
}

const CHANNELS: ReadonlyArray<{ id: LogChannelFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'Email' }
];

const OUTCOMES: ReadonlyArray<{ id: LogOutcomeFilter; label: string }> = [
  { id: 'all', label: 'Every outcome' },
  { id: 'delivered', label: OUTCOME_LABELS.delivered },
  { id: 'sent', label: OUTCOME_LABELS.sent },
  { id: 'waiting', label: OUTCOME_LABELS.waiting },
  { id: 'failed', label: OUTCOME_LABELS.failed }
];

const OUTCOME_CHIP: Readonly<Record<MessageOutcome, string>> = {
  delivered: 'bg-emerald-50 text-emerald-800',
  sent: 'bg-gray-100 text-gray-700',
  waiting: 'bg-amber-50 text-amber-800',
  failed: 'bg-red-50 text-red-800'
};

const BUTTON =
  'inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-60';

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; entries: MessageLogEntry[]; names: Record<string, string>; more: boolean; incomplete: boolean }
  | { kind: 'error'; message: string };

interface Opened {
  key: string;
  body: MessageBody | null;
  error: string | null;
}

/**
 * The practice's SMS and email log (or one patient's), newest first: who it went to, when, what it was, how it went
 * and the patient it belongs to. Searchable; a message's full text opens with one tap.
 */
export function MessageLogView({ practiceId, patientId = null, onNavigate }: MessageLogViewProps) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [channel, setChannel] = useState<LogChannelFilter>('all');
  const [outcome, setOutcome] = useState<LogOutcomeFilter>('all');
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const request = useRef(0);

  // Search after a short pause in typing, not on every key
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const mine = ++request.current;
    setView({ kind: 'loading' });
    setOpened(null);
    try {
      const page = await loadMessageLog(practiceId, { search: term, channel, outcome, patientId });
      if (mine === request.current) setView({ kind: 'ready', entries: page.entries, names: page.patientNames, more: page.more, incomplete: page.incomplete });
    } catch (error) {
      if (mine === request.current) setView({ kind: 'error', message: error instanceof Error ? error.message : 'The message log could not be loaded.' });
    }
  }, [practiceId, term, channel, outcome, patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (view.kind !== 'ready' || view.entries.length === 0) return;
    const mine = request.current;
    setLoadingMore(true);
    try {
      const last = view.entries[view.entries.length - 1];
      const page = await loadMessageLog(practiceId, {
        search: term,
        channel,
        outcome,
        patientId,
        before: last.at,
        shown: new Set(view.entries.map(entry => entry.key))
      });
      if (mine !== request.current) return;
      setView({
        kind: 'ready',
        entries: [...view.entries, ...page.entries],
        names: { ...view.names, ...page.patientNames },
        more: page.more && page.entries.length > 0,
        incomplete: view.incomplete || page.incomplete
      });
    } catch (error) {
      setView({ kind: 'error', message: error instanceof Error ? error.message : 'The message log could not be loaded.' });
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = async (entry: MessageLogEntry) => {
    if (opened?.key === entry.key) {
      setOpened(null);
      return;
    }
    setOpened({ key: entry.key, body: null, error: null });
    try {
      const body = await loadMessageBody(entry);
      setOpened(current => (current?.key === entry.key ? { key: entry.key, body, error: null } : current));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The message could not be opened.';
      setOpened(current => (current?.key === entry.key ? { key: entry.key, body: null, error: message } : current));
    }
  };

  const status =
    view.kind === 'ready' ? `${view.entries.length} message${view.entries.length === 1 ? '' : 's'} shown` : view.kind === 'loading' ? 'Loading messages' : '';

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-gray-100 p-2 sm:flex-row sm:items-center sm:p-3">
        <label htmlFor={`${id}-search`} className="sr-only">
          Search messages
        </label>
        <div className="relative min-w-0 flex-1">
          <Icon icon="solar:magnifer-bold-duotone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            id={`${id}-search`}
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={patientId ? 'Search text, number or email' : 'Search name, text, number or email'}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
        </div>
        <div className="flex gap-2">
          <div role="group" aria-label="Show" className="grid flex-1 grid-cols-3 gap-1 sm:flex-none">
            {CHANNELS.map(option => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === channel}
                onClick={() => setChannel(option.id)}
                className={cn(
                  'inline-flex min-h-[2.5rem] items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                  option.id === channel ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label htmlFor={`${id}-outcome`} className="sr-only">
            Outcome
          </label>
          <select
            id={`${id}-outcome`}
            value={outcome}
            onChange={event => setOutcome(event.target.value as LogOutcomeFilter)}
            className="min-h-[2.5rem] rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          >
            {OUTCOMES.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="sr-only" role="status">
        {status}
      </p>

      {view.kind === 'loading' && (
        <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-600">
          <Icon icon="solar:refresh-bold-duotone" className="h-5 w-5 animate-spin text-cyan-600 motion-reduce:animate-none" aria-hidden="true" />
          Loading messages...
        </div>
      )}

      {view.kind === 'error' && (
        <div className="px-4 py-8 text-center sm:px-6" role="alert">
          <Icon icon="solar:danger-triangle-bold-duotone" className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
          <h3 className="mt-2 font-semibold text-gray-900">Could not load the messages</h3>
          <p className="mt-1 break-words text-sm text-gray-600">{view.message}</p>
          <button type="button" onClick={() => void load()} className={cn(BUTTON, 'mt-3')}>
            <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {view.kind === 'ready' && view.incomplete && (
        <p className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-5" role="status">
          <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          The SMS or the email log could not be read, so this list may be missing some messages.
        </p>
      )}

      {view.kind === 'ready' && view.entries.length === 0 && (
        <div className="px-4 py-10 text-center sm:px-6">
          <Icon icon="solar:chat-round-dots-bold-duotone" className="mx-auto h-10 w-10 text-gray-300" aria-hidden="true" />
          <h3 className="mt-2 font-semibold text-gray-900">{term || channel !== 'all' || outcome !== 'all' ? 'No messages match' : 'No messages yet'}</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
            {term || channel !== 'all' || outcome !== 'all'
              ? 'Try other words, or show every channel and outcome.'
              : 'Every SMS and email the practice sends (reminders, invoices, letters, lists) appears here.'}
          </p>
        </div>
      )}

      {view.kind === 'ready' && view.entries.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {view.entries.map(entry => {
            const isOpen = opened?.key === entry.key;
            const patientName = entry.patientId ? view.names[entry.patientId] ?? null : null;
            return (
              <li key={entry.key}>
                <button
                  type="button"
                  onClick={() => void toggle(entry)}
                  aria-expanded={isOpen}
                  aria-controls={`${id}-${entry.key}`}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500 sm:px-5"
                >
                  <Icon
                    icon={entry.channel === 'sms' ? 'solar:chat-round-line-bold-duotone' : 'solar:letter-bold-duotone'}
                    className="mt-0.5 h-5 w-5 shrink-0 text-gray-400"
                    aria-label={entry.channel === 'sms' ? 'SMS' : 'Email'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-900" title={entry.summary}>
                      {entry.summary}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {[logTime(entry.at), patientId ? null : patientName, entry.what].filter(Boolean).join(' · ')}
                    </span>
                    <span className="block truncate text-xs text-gray-400">To {entry.recipientName ? `${entry.recipientName} (${entry.to})` : entry.to}</span>
                  </span>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', OUTCOME_CHIP[entry.outcome])}>{OUTCOME_LABELS[entry.outcome]}</span>
                </button>
                {isOpen && (
                  <div id={`${id}-${entry.key}`} className="space-y-3 bg-gray-50 px-4 pb-4 pt-1 text-sm sm:px-5 sm:pl-12">
                    {opened?.error && (
                      <p className="text-red-700" role="alert">
                        {opened.error}
                      </p>
                    )}
                    {!opened?.error && !opened?.body && <p className="text-gray-500">Opening the message...</p>}
                    {opened?.body && <p className="whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-gray-800 ring-1 ring-gray-200">{opened.body.text}</p>}
                    {(opened?.body?.failureReason || entry.failureReason) && entry.outcome === 'failed' && (
                      <p className="text-red-700">Why it was not delivered: {opened?.body?.failureReason ?? entry.failureReason}</p>
                    )}
                    {entry.attachments.length > 0 && (
                      <p className="flex items-center gap-2 text-gray-700">
                        <Icon icon="solar:paperclip-bold-duotone" className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                        {entry.attachments.join(', ')}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {!patientId && entry.patientId && (
                        <Link to={patientOverviewLink(entry.patientId)} onClick={onNavigate} className={BUTTON}>
                          <Icon icon="solar:user-id-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Patient file
                        </Link>
                      )}
                      {/* The visit or booking a reminder, confirmation or letter was about */}
                      {entry.patientId && entry.visitId && (
                        <Link to={bookingLinks.visit(entry.patientId, entry.visitId)} onClick={onNavigate} className={BUTTON}>
                          <Icon icon="solar:calendar-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Visit
                        </Link>
                      )}
                      {entry.invoiceId && (
                        <Link to={invoiceLink(entry.invoiceId)} onClick={onNavigate} className={BUTTON}>
                          <Icon icon="solar:bill-list-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Invoice
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {view.kind === 'ready' && view.more && (
        <div className="border-t border-gray-100 p-3 text-center">
          <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className={BUTTON}>
            <Icon icon="solar:alt-arrow-down-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            {loadingMore ? 'Loading...' : 'Show older messages'}
          </button>
        </div>
      )}
    </div>
  );
}

export default MessageLogView;
