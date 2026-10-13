import React, { useEffect, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { claimBatchLink, invoiceLink } from '../../billing/invoiceLinks';
import { formatDateKey, formatNad } from '../financeFormat';
import { EmptyState, ErrorState, LoadingState, Notice } from '../FinanceUI';
import { Sheet } from '../receipts/ArUi';
import { storyEntries, storyHeadline, type StoryEntry, type StoryTone } from './claimLineStory';
import { loadClaimLineStory, loadClaimLines, loadStaffNames, type ClaimLineListItem, type ReportLoad } from './practiceReportsService';

const DOT: Record<StoryTone, string> = {
  cyan: 'bg-cyan-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  violet: 'bg-violet-500',
  gray: 'bg-gray-400'
};

const NOT_SET_UP = 'The claim line story is not set up in this database yet (proposals/2026-10-12-claims-dashboard-and-story.sql).';

/** The story itself: where the claim stands now, then every step in the order it happened */
const StoryTimeline: React.FC<{ claimLineId: string; onNavigate: () => void }> = ({ claimLineId, onNavigate }) => {
  const practiceId = useAuthStore(state => state.selectedPracticeId || state.user?.practice_id || null);
  const [load, setLoad] = useState<ReportLoad<StoryEntry[]> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad(null);
    Promise.all([loadClaimLineStory(claimLineId), practiceId ? loadStaffNames(practiceId).catch(() => ({ names: {} })) : Promise.resolve({ names: {} })])
      .then(([story, staff]) => {
        if (cancelled) return;
        setLoad(story.state === 'ready' ? { state: 'ready', data: storyEntries(story.data, staff.names) } : story);
      });
    return () => {
      cancelled = true;
    };
  }, [claimLineId, practiceId, attempt]);

  if (!load) return <LoadingState label="Loading the claim line's story" rows={4} />;
  if (load.state === 'not_set_up') return <Notice tone="warning">{NOT_SET_UP}</Notice>;
  if (load.state === 'error') return <ErrorState title="Could not load the story" message={load.error} onRetry={() => setAttempt(n => n + 1)} />;
  if (load.data.length === 0) return <EmptyState compact icon="solar:document-text-bold-duotone" title="Nothing recorded yet" message="The claim line has no events yet." />;
  const entries = load.data;
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-900">{storyHeadline(entries)}</p>
      <ol className="relative space-y-4 border-l border-gray-200 pl-5" aria-label="What happened to this claim line, oldest first">
        {entries.map(entry => (
          <li key={entry.key} className="relative">
            <span className={`absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${DOT[entry.tone]}`} aria-hidden="true" />
            <p className="text-xs text-gray-500">
              {entry.dateKey ? formatDateKey(entry.dateKey) : ''}{entry.by ? ` · ${entry.by}` : ''}
            </p>
            <p className="text-sm font-medium text-gray-900">{entry.title}</p>
            {entry.detail && <p className="text-sm text-gray-600 break-words">{entry.detail}</p>}
            <div className="mt-1 flex flex-wrap gap-3 text-xs">
              {entry.batchId && (
                <Link to={claimBatchLink(entry.batchId)} onClick={onNavigate} className="font-medium text-cyan-700 hover:underline">Open the batch</Link>
              )}
              {entry.kind === 'claimed' && entry.invoiceId && (
                <Link to={invoiceLink(entry.invoiceId)} onClick={onNavigate} className="font-medium text-cyan-700 hover:underline">Open the invoice</Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

/** One claim line's story in a sheet (parity F10), opened from the claim line, the invoice, a rejection or a report */
export const ClaimLineStorySheet: React.FC<{ claimLineId: string; onClose: () => void }> = ({ claimLineId, onClose }) => (
  <Sheet open onClose={onClose} title="Claim line story" subtitle="Sent, answered, corrected, sent again, reversed and paid, on one timeline" icon="solar:history-bold-duotone" size="lg">
    <StoryTimeline claimLineId={claimLineId} onNavigate={onClose} />
  </Sheet>
);

/** A small link that opens a claim line's story (beside "Correct and send again" on a sent batch's line) */
export const ClaimLineStoryButton: React.FC<{ claimLineId: string; className?: string }> = ({ claimLineId, className }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'mt-1 block text-xs font-medium text-cyan-700 hover:underline'}
      >
        Claim line story
      </button>
      {open && <ClaimLineStorySheet claimLineId={claimLineId} onClose={() => setOpen(false)} />}
    </>
  );
};

/** Claim lines (of one invoice, or behind a report figure), each opening its story */
export const ClaimLineListSheet: React.FC<{ title: string; filter: { ids: readonly string[] } | { invoiceId: string }; onClose: () => void }> = ({ title, filter, onClose }) => {
  const [lines, setLines] = useState<ClaimLineListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storyId, setStoryId] = useState<string | null>(null);
  const filterKey = 'ids' in filter ? filter.ids.join(',') : filter.invoiceId;

  useEffect(() => {
    let cancelled = false;
    setLines(null);
    setError(null);
    loadClaimLines(filter)
      .then(rows => { if (!cancelled) setLines(rows); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? plainWords(err.message) : 'Could not load the claim lines.'); });
    return () => {
      cancelled = true;
    };
    // filterKey stands for the filter's content (a new array each render must not reload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  return (
    <>
      <Sheet open={!storyId} onClose={onClose} title={title} subtitle="Open a line to see its whole story" icon="solar:list-check-bold-duotone" size="lg">
        {error ? (
          <ErrorState title="Could not load the claim lines" message={error} />
        ) : !lines ? (
          <LoadingState label="Loading the claim lines" rows={3} />
        ) : lines.length === 0 ? (
          <EmptyState compact icon="solar:document-text-bold-duotone" title="No claim lines" message="Nothing of this was claimed from a fund." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {lines.map(line => (
              <li key={line.id}>
                <button
                  type="button"
                  onClick={() => setStoryId(line.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left text-sm hover:bg-cyan-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <span className="min-w-0">
                    <span className="font-mono font-medium text-gray-900">{line.tariffCode ?? 'Claim'}</span>
                    <span className="ml-2 text-gray-700">{line.invoiceNumber ? `Invoice ${line.invoiceNumber}` : 'Reversal line'}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {line.batchNumber !== null ? `Batch ${line.batchNumber}` : ''}{line.flag ? ` · sent again (${line.flag})` : ''}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums text-gray-700">
                    {formatNad(line.amountCents / 100)}
                    <Icon icon="solar:alt-arrow-right-bold-duotone" className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      {storyId && <ClaimLineStorySheet claimLineId={storyId} onClose={() => setStoryId(null)} />}
    </>
  );
};

/** On an invoice: its claim lines, each opening its story */
export const InvoiceClaimStoryButton: React.FC<{ invoiceId: string; invoiceNumber: string }> = ({ invoiceId, invoiceNumber }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-cyan-700 hover:underline">
        Claim lines and their story
      </button>
      {open && <ClaimLineListSheet title={`Claim lines of invoice ${invoiceNumber}`} filter={{ invoiceId }} onClose={() => setOpen(false)} />}
    </>
  );
};
