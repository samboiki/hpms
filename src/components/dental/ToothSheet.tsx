import React, { useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import FormModal from '../modals/FormModal';
import { invoiceLink, visitLink } from '../billing/invoiceLinks';
import { formatServiceDate } from '../../utils/billing/dates';
import {
  describeEntryWork,
  describeWork,
  eventDate,
  type ChartEntry,
  type ChartModel,
  type PlanItem,
  type ToothEvent,
  type ToothWork
} from '../../utils/dental/chart';
import { toothName } from '../../utils/dental/fdi';
import { defaultPlanVisit, openPlanVisits } from '../../utils/dental/plan';
import { canBeDefective } from '../../utils/dental/workTypes';
import {
  addChartEntries,
  isDentalChartNotSetUp,
  markEnteredInError,
  setChartStatus,
  type NewChartEntry
} from '../../services/dental/dentalChartService';
import { QuoteStatusChip, inputClass, primaryButton, secondaryButton } from '../quotes/QuoteBits';
import { PlanWorkForm, RecordWorkForm } from './ToothForms';
import type { PricingState } from './usePlanPricing';

export interface ToothSheetProps {
  tooth: string;
  model: ChartModel;
  entriesById: ReadonlyMap<string, ChartEntry>;
  /** The chart tables exist (the proposal is applied) */
  chartReady: boolean;
  /** A practitioner, nurse or practice admin: may record, plan and change the chart */
  canChart: boolean;
  pricing: PricingState;
  patientId: string;
  /** Opened from a visit: work recorded or marked done is linked to it */
  visitId: string | null;
  /** Links that leave the screen are shown as text (inside a visit that may have unsaved changes) */
  navigation: boolean;
  today: string;
  onClose: () => void;
  onChanged: () => void;
  onOpenVisit?: (visitId: string) => void;
  onOpenQuote: (quoteId: string) => void;
  /** A new lab order for this tooth (Lab work); practitioners, nurses and practice admins */
  onSendToLab?: () => void;
}

/** The status beside work on the tooth; a missing tooth says only whether it was extracted here. */
const statusChip = (work: Pick<ToothWork, 'work' | 'status'>): { label: string; className: string } | null => {
  if (work.work === 'missing') return work.status === 'done' ? { label: 'Extracted', className: 'bg-gray-100 text-gray-700' } : null;
  return {
    existing: { label: 'Existing', className: 'bg-blue-50 text-blue-800' },
    done: { label: 'Done', className: 'bg-blue-50 text-blue-800' },
    defective: { label: 'Defective', className: 'bg-red-50 text-red-700' }
  }[work.status];
};

const smallButton =
  'inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

/** One tooth: what is on it, what is planned, what to do next and its history. */
const ToothSheet: React.FC<ToothSheetProps> = props => {
  const { tooth, model, entriesById, chartReady, canChart, pricing, patientId, visitId, navigation, today, onClose, onChanged, onOpenVisit, onOpenQuote, onSendToLab } = props;
  const record = model.teeth.get(tooth);
  const openVisits = openPlanVisits(model.planItems);
  const openPlan = model.planItems.filter(item => !item.done && item.entry.status === 'planned');
  const [mode, setMode] = useState<'view' | 'record' | 'plan'>('view');
  const [busy, setBusy] = useState(false);
  const [voiding, setVoiding] = useState<{ entryId: string; label: string } | null>(null);
  const [reason, setReason] = useState('');

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      setMode('view');
      setVoiding(null);
      setReason('');
      onChanged();
    } catch (error) {
      toast.error(
        isDentalChartNotSetUp(error) ? 'Charting is not set up yet.' : error instanceof Error ? plainWords(error.message) : 'Could not change the chart.',
        { duration: 8000 }
      );
    } finally {
      setBusy(false);
    }
  };

  const save = (entry: NewChartEntry, success: string) => void run(() => addChartEntries(patientId, [entry]), success);

  /** Defective: a status change for charted work; for billed work a new entry saying so (the billing stays as it is). */
  const markDefective = (work: ToothWork) => {
    const entry = work.entryId ? entriesById.get(work.entryId) : undefined;
    if (entry && (entry.status === 'existing' || entry.status === 'done')) {
      void run(() => setChartStatus([entry.id], 'defective'), `${describeWork(work)} on ${tooth} marked defective.`);
      return;
    }
    const billedNote = work.line ? `Billed ${work.line.code} on ${formatServiceDate(work.line.date)} (${work.line.invoiceNumber})` : null;
    save({ tooth, work: work.work, status: 'defective', surfaces: work.surfaces, visitId, note: billedNote }, `${describeWork(work)} on ${tooth} marked defective.`);
  };

  const visitRef = (id: string | null, label: string) => {
    if (!id) return null;
    if (onOpenVisit) {
      return (
        <button type="button" className="text-cyan-700 hover:underline" onClick={() => onOpenVisit(id)}>
          {label}
        </button>
      );
    }
    return navigation ? (
      <Link to={visitLink(patientId, id)} className="text-cyan-700 hover:underline">
        {label}
      </Link>
    ) : null;
  };

  const invoiceRef = (id: string, number: string) =>
    navigation ? (
      <Link to={invoiceLink(id)} className="text-cyan-700 hover:underline">
        {number}
      </Link>
    ) : (
      <span>{number}</span>
    );

  const workSource = (work: ToothWork) => {
    if (work.line) {
      return (
        <>
          billed {formatServiceDate(work.line.date)}, invoice {invoiceRef(work.line.invoiceId, work.line.invoiceNumber)}
          {work.line.visitId && <> · {visitRef(work.line.visitId, 'visit')}</>}
        </>
      );
    }
    const entry = work.entryId ? entriesById.get(work.entryId) : undefined;
    return (
      <>
        recorded {work.date ? formatServiceDate(work.date) : ''}
        {entry?.recordedBy ? ` by ${entry.recordedBy}` : ''}
        {entry?.note ? ` · ${entry.note}` : ''}
      </>
    );
  };

  const canVoid = (entryId: string | null): entryId is string => {
    const entry = entryId ? entriesById.get(entryId) : undefined;
    return Boolean(entry && !entry.voidedAt);
  };

  return (
    <FormModal isOpen onClose={onClose} title={`Tooth ${tooth}`} icon="solar:health-bold-duotone" className="max-w-lg">
      <div className="space-y-5">
        <p className="text-sm font-medium text-gray-700">{toothName(tooth)}</p>

        {!chartReady && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" role="status">
            Charting is not set up yet. This tooth shows its billed work; recording and planning work start once your
            administrator applies the dental chart update.
          </div>
        )}

        <section aria-labelledby={`now-${tooth}`}>
          <h3 id={`now-${tooth}`} className="mb-2 text-sm font-semibold text-gray-900">
            On this tooth
          </h3>
          {(record?.now ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">Nothing recorded or billed.</p>
          ) : (
            <ul className="space-y-2">
              {(record?.now ?? []).map(work => {
                const chipInfo = statusChip(work);
                const entry = work.entryId ? entriesById.get(work.entryId) : undefined;
                return (
                  <li key={work.key} className="rounded-lg border border-gray-200 p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{describeWork(work)}</span>
                      {chipInfo && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${chipInfo.className}`}>{chipInfo.label}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{workSource(work)}</p>
                    {chartReady && canChart && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {work.status !== 'defective' && canBeDefective(work.work) && (
                          <button type="button" className={smallButton} disabled={busy} onClick={() => markDefective(work)}>
                            <Icon icon="solar:danger-triangle-bold-duotone" className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                            Defective
                          </button>
                        )}
                        {work.status === 'defective' && entry?.status === 'defective' && (
                          <button
                            type="button"
                            className={smallButton}
                            disabled={busy}
                            onClick={() => void run(() => setChartStatus([entry.id], 'existing'), `${describeWork(work)} on ${tooth} is no longer marked defective.`)}
                          >
                            <Icon icon="solar:undo-left-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
                            Not defective
                          </button>
                        )}
                        {canVoid(work.entryId) && work.source === 'chart' && !work.line && (
                          <button type="button" className={smallButton} disabled={busy} onClick={() => setVoiding({ entryId: work.entryId as string, label: describeWork(work) })}>
                            <Icon icon="solar:eraser-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
                            Mistake
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {(record?.plan ?? []).length > 0 && (
          <section aria-labelledby={`plan-${tooth}`}>
            <h3 id={`plan-${tooth}`} className="mb-2 text-sm font-semibold text-gray-900">
              To do
            </h3>
            <ul className="space-y-2">
              {(record?.plan ?? []).map(item => (
                <PlannedOnTooth
                  key={item.entry.id}
                  item={item}
                  busy={busy}
                  canChart={chartReady && canChart}
                  onDone={() => void run(() => setChartStatus([item.entry.id], 'done', visitId), `${item.entry.tariffCode} on ${tooth} marked done.`)}
                  onRemove={() => void run(() => setChartStatus([item.entry.id], 'removed'), `${item.entry.tariffCode} on ${tooth} taken off the plan.`)}
                  onMistake={() => setVoiding({ entryId: item.entry.id, label: describeEntryWork(item.entry) })}
                  onOpenQuote={onOpenQuote}
                />
              ))}
            </ul>
          </section>
        )}

        {voiding && (
          <form
            className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3"
            onSubmit={event => {
              event.preventDefault();
              void run(() => markEnteredInError(voiding.entryId, reason), `${voiding.label} on ${tooth} marked as a mistake.`);
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-red-900">Why is "{voiding.label}" a mistake? It stays in the history, crossed out.</span>
              <input className={inputClass} value={reason} maxLength={200} onChange={event => setReason(event.target.value)} placeholder="For example: wrong tooth" />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={secondaryButton} onClick={() => setVoiding(null)} disabled={busy}>
                Keep it
              </button>
              <button type="submit" className={primaryButton} disabled={busy || reason.trim().length < 3}>
                Mark as a mistake
              </button>
            </div>
          </form>
        )}

        {chartReady && canChart && mode === 'view' && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className={`${secondaryButton} flex-1`} onClick={() => setMode('record')}>
              <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Record what is there
            </button>
            <button type="button" className={`${primaryButton} flex-1`} onClick={() => setMode('plan')}>
              <Icon icon="solar:clipboard-list-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Plan work
            </button>
          </div>
        )}
        {chartReady && !canChart && (
          <p className="text-xs text-gray-500">Practitioners, nurses and practice admins record and plan work on the chart.</p>
        )}
        {onSendToLab && canChart && mode === 'view' && (
          <button type="button" className={`${secondaryButton} w-full`} onClick={onSendToLab}>
            <Icon icon="solar:box-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Send to the lab
          </button>
        )}

        {mode === 'record' && (
          <RecordWorkForm
            tooth={tooth}
            visitId={visitId}
            saving={busy}
            onCancel={() => setMode('view')}
            onSave={entry => save(entry, `Saved on tooth ${tooth}.`)}
          />
        )}
        {mode === 'plan' && pricing.status === 'ready' && (
          <PlanWorkForm
            tooth={tooth}
            visitId={visitId}
            saving={busy}
            onCancel={() => setMode('view')}
            onSave={entry => save(entry, `Added to the plan: ${entry.tariffCode} on tooth ${tooth}.`)}
            record={record}
            pricing={pricing.pricing}
            openVisits={openVisits}
            openPlan={openPlan}
            today={today}
            defaultVisit={defaultPlanVisit(openVisits)}
          />
        )}
        {mode === 'plan' && pricing.status !== 'ready' && (
          <p className="text-sm text-gray-600" role="status">
            {pricing.status === 'error' ? `The tariff list could not be loaded: ${pricing.message}` : 'Loading the tariff list...'}
          </p>
        )}

        <ToothHistory events={record?.events ?? []} visitRef={visitRef} invoiceRef={invoiceRef} onOpenQuote={onOpenQuote} />
      </div>
    </FormModal>
  );
};

const PlannedOnTooth: React.FC<{
  item: PlanItem;
  busy: boolean;
  canChart: boolean;
  onDone: () => void;
  onRemove: () => void;
  onMistake: () => void;
  onOpenQuote: (quoteId: string) => void;
}> = ({ item, busy, canChart, onDone, onRemove, onMistake, onOpenQuote }) => {
  const quote = item.quote;
  return (
    <li className="rounded-lg border border-amber-200 bg-amber-50/40 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900">
          {item.entry.tariffCode} · {describeEntryWork(item.entry)}
        </span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Visit {item.entry.planVisit ?? 1}</span>
        {quote && (
          <button type="button" onClick={() => onOpenQuote(quote.id)} className="inline-flex items-center gap-1 text-xs text-cyan-700 hover:underline">
            {quote.quoteNumber}
            <QuoteStatusChip status={quote.status} />
          </button>
        )}
      </div>
      {canChart && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className={smallButton} disabled={busy} onClick={onDone}>
            <Icon icon="solar:check-circle-bold-duotone" className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
            Done
          </button>
          <button type="button" className={smallButton} disabled={busy} onClick={onRemove}>
            <Icon icon="solar:close-circle-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Take off the plan
          </button>
          <button type="button" className={smallButton} disabled={busy} onClick={onMistake}>
            <Icon icon="solar:eraser-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Mistake
          </button>
        </div>
      )}
    </li>
  );
};

/** The tooth's history, newest first, one tap away. */
const ToothHistory: React.FC<{
  events: readonly ToothEvent[];
  visitRef: (id: string | null, label: string) => React.ReactNode;
  invoiceRef: (id: string, number: string) => React.ReactNode;
  onOpenQuote: (quoteId: string) => void;
}> = ({ events, visitRef, invoiceRef, onOpenQuote }) => {
  if (events.length === 0) return null;
  return (
    <details className="rounded-lg border border-gray-200">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700">
        <Icon icon="solar:history-bold-duotone" className="mr-1.5 inline h-4 w-4 align-[-2px] text-gray-500" aria-hidden="true" />
        History ({events.length})
      </summary>
      <ul className="divide-y divide-gray-100">
        {events.map(event => {
          const visit = visitRef(event.visitId, 'visit');
          const quote = event.quote;
          return (
            <li key={event.key} className="px-3 py-2 text-sm">
              <p className={event.struck ? 'text-gray-400 line-through' : 'text-gray-900'}>{event.text}</p>
              <p className="text-xs text-gray-500">
                {eventDate(event)}
                {event.by ? ` · ${event.by}` : ''}
                {event.line && <> · invoice {invoiceRef(event.line.invoiceId, event.line.invoiceNumber)}</>}
                {visit && <> · {visit}</>}
                {quote && (
                  <>
                    {' · '}
                    <button type="button" className="text-cyan-700 hover:underline" onClick={() => onOpenQuote(quote.id)}>
                      quote {quote.quoteNumber}
                    </button>
                  </>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
};

export default ToothSheet;
