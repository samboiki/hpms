import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { useSearchParams } from 'react-router-dom';
import { todayKey } from '../../utils/billing/dates';
import { formatNad, fromCents, sumCents, toCents } from '../../utils/billing/money';
import { effectiveQuoteStatus, formatDayFirst, type QuoteRecord, type QuoteStatus } from './quotes';
import { isQuotesNotEnabledError, loadQuotes } from './quoteService';
import QuoteEditor, { type QuotePatient } from './QuoteEditor';
import QuoteViewer from './QuoteViewer';
import { QuoteStatusChip, QuotesNotEnabled, inputClass, primaryButton, secondaryButton } from './QuoteBits';

interface QuoteListProps {
  practiceId: string | null;
  /** One patient's quotes, with "New quote" (patient file); every quote of the practice when empty (Finance) */
  patient?: QuotePatient | null;
  /** A quote screen changed something (a quote made into an invoice): Finance reloads its figures */
  onChanged?: () => void;
}

type ListState = { status: 'loading' } | { status: 'not_enabled' } | { status: 'error'; message: string } | { status: 'ready'; quotes: QuoteRecord[] };
type Filter = 'all' | 'open' | 'accepted' | 'expired' | 'converted' | 'declined';

const FILTERS: { key: Filter; label: string; statuses: readonly QuoteStatus[] }[] = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'open', label: 'Open', statuses: ['draft', 'sent'] },
  { key: 'accepted', label: 'Accepted', statuses: ['accepted'] },
  { key: 'expired', label: 'Expired', statuses: ['expired'] },
  { key: 'converted', label: 'Invoiced', statuses: ['converted'] },
  { key: 'declined', label: 'Declined', statuses: ['declined'] }
];

type EditorState = { quoteId: string | null; patient: QuotePatient } | null;

/** Quotes with their status (expired shown as soon as "valid until" has passed) and the quote screens. */
const QuoteList: React.FC<QuoteListProps> = ({ practiceId, patient = null, onChanged }) => {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const practiceView = !patient;
  const patientId = patient?.id ?? null;

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    setState(current => (current.status === 'ready' ? current : { status: 'loading' }));
    loadQuotes({ practiceId, patientId })
      .then(quotes => {
        if (!cancelled) setState({ status: 'ready', quotes });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState(
          isQuotesNotEnabledError(error)
            ? { status: 'not_enabled' }
            : { status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not load the quotes.' }
        );
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, patientId, version]);

  const reload = useCallback(() => setVersion(value => value + 1), []);

  // A link from the invoice a quote became (?quote=<id>) opens that quote
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedQuoteId = searchParams.get('quote');
  useEffect(() => {
    if (!linkedQuoteId) return;
    setViewerId(linkedQuoteId);
    const next = new URLSearchParams(searchParams);
    next.delete('quote');
    setSearchParams(next, { replace: true });
  }, [linkedQuoteId, searchParams, setSearchParams]);

  const today = todayKey();
  const rows = useMemo(
    () => (state.status === 'ready' ? state.quotes.map(quote => ({ quote, effective: effectiveQuoteStatus(quote.status, quote.validUntil, today) })) : []),
    [state, today]
  );
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map(item => [item.key, item.key === 'all' ? rows.length : rows.filter(row => item.statuses.includes(row.effective)).length])) as Record<Filter, number>,
    [rows]
  );
  const shown = useMemo(() => {
    const statuses = FILTERS.find(item => item.key === filter)?.statuses ?? [];
    const text = search.trim().toLowerCase();
    return rows.filter(
      row =>
        (statuses.length === 0 || statuses.includes(row.effective)) &&
        (!text || row.quote.quoteNumber.toLowerCase().includes(text) || (row.quote.patientName ?? '').toLowerCase().includes(text))
    );
  }, [rows, filter, search]);
  const acceptedRows = rows.filter(row => row.effective === 'accepted');
  const openRows = rows.filter(row => row.effective === 'draft' || row.effective === 'sent');
  const valueOf = (items: typeof rows) => formatNad(fromCents(sumCents(items.map(row => toCents(row.quote.subtotal)))));

  if (!practiceId) return <p className="text-sm text-gray-500">Choose a practice to see its quotes.</p>;
  if (state.status === 'not_enabled') return <QuotesNotEnabled compact={!practiceView} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {practiceView ? (
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter quotes">
            {FILTERS.map(item => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  filter === item.key ? 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.label} <span className="font-normal text-gray-400">({counts[item.key] ?? 0})</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Estimates for this patient. Accepted quotes become invoices in one step.</p>
        )}
        {patient && (
          <button type="button" className={primaryButton} onClick={() => setEditor({ quoteId: null, patient })}>
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            New quote
          </button>
        )}
      </div>

      {practiceView && state.status === 'ready' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-green-50 p-3 text-sm text-green-900">
            <p className="text-xs">Accepted, not invoiced yet</p>
            <p className="font-semibold">
              {valueOf(acceptedRows)} <span className="font-normal">({acceptedRows.length} quote{acceptedRows.length === 1 ? '' : 's'})</span>
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            <p className="text-xs">Waiting for the patient (draft or sent, still valid)</p>
            <p className="font-semibold">
              {valueOf(openRows)} <span className="font-normal">({openRows.length} quote{openRows.length === 1 ? '' : 's'})</span>
            </p>
          </div>
        </div>
      )}

      {practiceView && (
        <div className="relative">
          <Icon icon="solar:magnifer-bold-duotone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input className={`${inputClass} pl-9`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by quote number or patient" aria-label="Search quotes" />
        </div>
      )}

      {state.status === 'loading' && (
        <div className="space-y-2" role="status" aria-live="polite">
          {[0, 1, 2].map(row => (
            <div key={row} className="h-14 animate-pulse rounded-xl bg-gray-100" />
          ))}
          <span className="sr-only">Loading quotes</span>
        </div>
      )}
      {state.status === 'error' && (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p>{state.message}</p>
          <button type="button" className={secondaryButton} onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {state.status === 'ready' && shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
          <Icon icon="solar:bill-list-bold-duotone" className="mx-auto mb-2 h-10 w-10 text-gray-300" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-800">{rows.length === 0 ? 'No quotes yet' : 'No quotes match'}</p>
          <p className="mt-1 text-xs text-gray-500">
            {practiceView ? "Create a quote from a patient's file: Billing > Quotes > New quote." : 'Give the patient a priced treatment estimate before treatment.'}
          </p>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {shown.map(({ quote, effective }) => (
            <li key={quote.id}>
              <button type="button" onClick={() => setViewerId(quote.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3 text-left hover:bg-gray-50">
                <span className="min-w-0 flex-1 basis-40">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{quote.quoteNumber}</span>
                    <QuoteStatusChip status={effective} />
                  </span>
                  {practiceView && <span className="block truncate text-sm text-gray-700">{quote.patientName ?? 'Unknown patient'}</span>}
                  <span className="block text-xs text-gray-500">
                    {formatDayFirst(quote.quoteDate)} · valid until {formatDayFirst(quote.validUntil)}
                    {quote.preauthNumber ? ` · pre-auth ${quote.preauthNumber}` : ''}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold text-gray-900">{formatNad(quote.subtotal)}</span>
                  <span className="block text-[11px] text-gray-500">Patient {formatNad(quote.patientEstimate)}</span>
                </span>
                <Icon icon="solar:alt-arrow-right-bold-duotone" className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <QuoteViewer
        quoteId={viewerId}
        onClose={() => setViewerId(null)}
        onChanged={() => {
          reload();
          onChanged?.();
        }}
        onEdit={quote => {
          setViewerId(null);
          setEditor({
            quoteId: quote.id,
            patient: patient ?? { id: quote.patientId, name: quote.patientName ?? 'Patient', phone: null, email: null }
          });
        }}
      />
      {editor && (
        <QuoteEditor
          isOpen
          practiceId={practiceId}
          patient={editor.patient}
          quoteId={editor.quoteId}
          onClose={() => setEditor(null)}
          onSaved={quoteId => {
            setEditor(null);
            reload();
            setViewerId(quoteId);
          }}
        />
      )}
    </div>
  );
};

export default QuoteList;
