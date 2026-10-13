import React, { useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { invoiceLink } from '../billing/invoiceLinks';
import { formatServiceDate } from '../../utils/billing/dates';
import { formatNad, fromCents, sumCents } from '../../utils/billing/money';
import { estimateQuote, fundRatesFromTariffs, type QuoteEstimate } from '../quotes/quotes';
import { isQuotesNotEnabledError } from '../quotes/quoteService';
import { describeQuotedLinks } from '../quotes/quoteLinkedCodes';
import { QuoteStatusChip, secondaryButton, primaryButton } from '../quotes/QuoteBits';
import { describeEntryWork, type ChartModel, type PlanItem } from '../../utils/dental/chart';
import {
  changedPlaces,
  moveToVisit,
  moveWithinVisit,
  nextPlanVisit,
  openPlanVisits,
  placesOf,
  storedPlaces,
  type PlanVisit
} from '../../utils/dental/plan';
import { priceVisit, type PricedVisit } from '../../utils/dental/planPricing';
import { checkPlannedVisit, checkPlannedWork, type PlanIssue } from '../../utils/dental/planRules';
import { arrangePlan, isDentalChartNotSetUp, makePlanQuote, setChartStatus } from '../../services/dental/dentalChartService';
import type { PricingState } from './usePlanPricing';

interface TreatmentPlanProps {
  model: ChartModel;
  pricing: PricingState;
  /** A practitioner, nurse or practice admin: may mark work done or take it off the plan */
  canChart: boolean;
  practiceId: string;
  patientId: string;
  visitId: string | null;
  navigation: boolean;
  today: string;
  onChanged: () => void;
  onOpenQuote: (quoteId: string) => void;
  onSelectTooth: (tooth: string) => void;
}

/** A quote the patient can still accept or be billed from. */
const isOpenQuote = (item: PlanItem): boolean =>
  item.quote !== null && (item.quote.status === 'draft' || item.quote.status === 'sent' || item.quote.status === 'accepted');

interface VisitView {
  visit: PlanVisit;
  priced: PricedVisit | null;
  estimate: QuoteEstimate | null;
  issues: PlanIssue[];
}

/**
 * The treatment plan: work still to do, grouped into planned visits, priced as each visit's quote and invoice will be
 * (the patient's fund prices, 8109 once per visit, 8346 with each restoration), with what a fund would refuse said in
 * plain words. "Make a quote" turns a visit into a draft quote through the quotes module; when the work is invoiced
 * it leaves the plan by itself.
 */
const TreatmentPlan: React.FC<TreatmentPlanProps> = ({
  model,
  pricing,
  canChart,
  practiceId,
  patientId,
  visitId,
  navigation,
  today,
  onChanged,
  onOpenQuote,
  onSelectTooth
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const visits = useMemo(() => openPlanVisits(model.planItems), [model]);
  const openPlan = useMemo(() => visits.flatMap(visit => visit.items), [visits]);
  const done = useMemo(
    () => model.planItems.filter(item => item.done).sort((a, b) => (b.doneDate ?? '').localeCompare(a.doneDate ?? '')),
    [model]
  );

  const views: VisitView[] = useMemo(() => {
    const ready = pricing.status === 'ready' ? pricing.pricing : null;
    const rates = ready ? fundRatesFromTariffs(ready.billable) : null;
    return visits.map(visit => {
      const priced = ready ? priceVisit(visit.visit, visit.items, ready.context) : null;
      const estimate =
        ready && priced && rates ? estimateQuote(priced.lines, { hasMedicalAid: ready.fund.hasMedicalAid, fundName: ready.fund.fundName, rates }) : null;
      const itemIssues = visit.items.flatMap(item =>
        checkPlannedWork(
          { itemId: item.entry.id, tooth: item.entry.tooth, code: item.entry.tariffCode ?? '', work: item.entry.work, surfaces: item.entry.surfaces },
          { record: model.teeth.get(item.entry.tooth), openPlan, today }
        )
      );
      return { visit, priced, estimate, issues: [...itemIssues, ...(priced ? checkPlannedVisit(priced, today) : [])] };
    });
  }, [visits, pricing, model, openPlan, today]);

  if (visits.length === 0 && done.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-gray-300 p-4 text-center" aria-label="Treatment plan">
        <p className="text-sm font-medium text-gray-800">No treatment planned</p>
        <p className="mt-1 text-xs text-gray-500">
          {canChart ? 'Tap a tooth and choose "Plan work". The plan becomes a quote in one tap.' : 'A practitioner plans work by tapping a tooth.'}
        </p>
      </section>
    );
  }

  const arrange = async (next: PlanVisit[], label: string) => {
    const changes = changedPlaces(storedPlaces(visits), placesOf(next));
    if (changes.length === 0) return;
    setBusy(label);
    try {
      await arrangePlan(patientId, changes);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not change the plan.');
    } finally {
      setBusy(null);
    }
  };

  const changeStatus = async (item: PlanItem, status: 'done' | 'removed') => {
    setBusy(item.entry.id);
    try {
      await setChartStatus([item.entry.id], status, status === 'done' ? visitId : null);
      toast.success(status === 'done' ? `${item.entry.tariffCode} on ${item.entry.tooth} marked done.` : `${item.entry.tariffCode} on ${item.entry.tooth} taken off the plan.`);
      onChanged();
    } catch (error) {
      toast.error(isDentalChartNotSetUp(error) ? 'Charting is not set up yet.' : error instanceof Error ? plainWords(error.message) : 'Could not change the plan.');
    } finally {
      setBusy(null);
    }
  };

  const makeQuote = async (visit: number, items: PlanItem[]) => {
    if (pricing.status !== 'ready') return;
    setBusy(`quote-${visit}`);
    try {
      const result = await makePlanQuote({ practiceId, patientId, visit, items, pricing: pricing.pricing });
      if (result.linkError) toast(`The quote was made, but the plan could not be linked to it: ${result.linkError}`, { duration: 10000 });
      else toast.success('Quote made as a draft. Check it, then print it or send it to the patient.', { duration: 6000 });
      // As in the quote editor: staff see which linked codes came with the work
      if (result.linked.length > 0) toast(describeQuotedLinks(result.linked), { id: 'plan-quote-linked-codes', duration: 8000 });
      onChanged();
      onOpenQuote(result.quoteId);
    } catch (error) {
      toast.error(isQuotesNotEnabledError(error) ? 'Quotes are not switched on yet.' : error instanceof Error ? plainWords(error.message) : 'Could not make the quote.', {
        duration: 8000
      });
    } finally {
      setBusy(null);
    }
  };

  const totalCents = views.every(view => view.priced) ? sumCents(views.map(view => view.priced?.totalCents ?? 0)) : null;
  const patientCents = views.every(view => view.estimate) ? sumCents(views.map(view => view.estimate?.patientCents ?? 0)) : null;
  const fund = pricing.status === 'ready' ? pricing.pricing.fund : null;
  const newVisit = nextPlanVisit(visits);
  // How sure the patient's portion is (the fund rates the practice knows), as the quote will say it
  const fundNote = views.find(view => view.estimate && view.estimate.basis !== 'private')?.estimate?.note ?? null;

  return (
    <section className="space-y-3" aria-labelledby="treatment-plan-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="treatment-plan-title" className="text-base font-semibold text-gray-900">
            Treatment plan
          </h3>
          <p className="text-xs text-gray-500">
            {pricing.status === 'ready'
              ? `Prices: tariffs in effect today${fund?.hasMedicalAid ? `, at ${fund.fundName ?? 'the medical aid'} prices where the fund has them` : ''}.`
              : pricing.status === 'error'
                ? `Prices could not be loaded: ${pricing.message}`
                : 'Loading prices...'}
          </p>
        </div>
        {totalCents !== null && visits.length > 0 && (
          <p className="text-right text-sm text-gray-700">
            Plan total <span className="font-semibold text-gray-900">{formatNad(fromCents(totalCents))}</span>
            {fund?.hasMedicalAid && patientCents !== null && (
              <span className="block text-xs text-gray-500">patient about {formatNad(fromCents(patientCents))}</span>
            )}
          </p>
        )}
      </div>

      {views.map(({ visit, priced, estimate, issues }) => {
        const unquoted = visit.items.filter(item => !isOpenQuote(item));
        const quotes = [...new Map(visit.items.flatMap(item => (item.quote && isOpenQuote(item) ? [[item.quote.id, item.quote] as const] : []))).values()];
        const blocking = issues.some(issue => issue.severity === 'error' && (issue.itemId === null || unquoted.some(item => item.entry.id === issue.itemId)));
        const visitIssues = issues.filter(issue => issue.itemId === null);
        const visitLines = priced ? priced.lines.filter(line => priced.visitLineIds.includes(line.id)) : [];
        return (
          <div key={visit.visit} className="rounded-xl border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <Icon icon="solar:calendar-bold-duotone" className="h-4 w-4 text-cyan-600" aria-hidden="true" />
                <h4 className="whitespace-nowrap text-sm font-semibold text-gray-900">Visit {visit.visit}</h4>
                {priced && <span className="whitespace-nowrap text-sm text-gray-700">{formatNad(fromCents(priced.totalCents))}</span>}
                {fund?.hasMedicalAid && estimate && (
                  <span className="whitespace-nowrap text-xs text-gray-500">(patient about {formatNad(fromCents(estimate.patientCents))})</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {quotes.map(quote => (
                  <button key={quote.id} type="button" onClick={() => onOpenQuote(quote.id)} className="inline-flex items-center gap-1 text-xs text-cyan-700 hover:underline">
                    <Icon icon="solar:bill-list-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    {quote.quoteNumber}
                    <QuoteStatusChip status={quote.status} />
                  </button>
                ))}
                {unquoted.length > 0 && (
                  <button
                    type="button"
                    className={`${primaryButton} px-3 py-1.5 text-xs`}
                    disabled={pricing.status !== 'ready' || blocking || busy !== null}
                    title={blocking ? 'Fix the work marked in red first' : undefined}
                    onClick={() => void makeQuote(visit.visit, unquoted)}
                  >
                    <Icon icon="solar:bill-list-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    {busy === `quote-${visit.visit}` ? 'Making the quote...' : quotes.length > 0 ? `Quote the other ${unquoted.length}` : 'Make a quote'}
                  </button>
                )}
              </div>
            </div>

            <ul className="divide-y divide-gray-100">
              {visit.items.map((item, index) => {
                const priceCents = priced?.items.get(item.entry.id)?.totalCents ?? null;
                const own = issues.filter(issue => issue.itemId === item.entry.id);
                const open = expanded === item.entry.id;
                return (
                  <li key={item.entry.id} className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectTooth(item.entry.tooth)}
                        className="mt-0.5 flex h-7 w-9 flex-shrink-0 items-center justify-center rounded-md bg-amber-100 text-xs font-bold text-amber-900 hover:bg-amber-200"
                        aria-label={`Open tooth ${item.entry.tooth}`}
                      >
                        {item.entry.tooth}
                      </button>
                      <p className="min-w-0 flex-1 text-sm text-gray-900">
                        <span className="font-semibold">{item.entry.tariffCode}</span> {describeEntryWork(item.entry)}
                      </p>
                      <span className="whitespace-nowrap text-sm font-medium text-gray-900">{priceCents !== null && priceCents > 0 ? formatNad(fromCents(priceCents)) : ''}</span>
                      <button
                        type="button"
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                        aria-expanded={open}
                        aria-label={`More for ${item.entry.tariffCode} on tooth ${item.entry.tooth}`}
                        onClick={() => setExpanded(open ? null : item.entry.id)}
                      >
                        <Icon icon="solar:menu-dots-bold-duotone" className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                    {own.length > 0 && (
                      <ul className="mt-1 space-y-1 pl-11">
                        {own.map(issue => (
                          <li key={issue.message} className={`flex items-start gap-1.5 text-xs ${issue.severity === 'error' ? 'text-red-700' : 'text-amber-800'}`}>
                            <Icon
                              icon={issue.severity === 'error' ? 'solar:danger-circle-bold-duotone' : 'solar:danger-triangle-bold-duotone'}
                              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                              aria-hidden="true"
                            />
                            <span>{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {open && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 pl-11">
                        <button
                          type="button"
                          className={`${secondaryButton} px-2 py-1 text-xs`}
                          disabled={index === 0 || busy !== null}
                          onClick={() => void arrange(moveWithinVisit(visits, item.entry.id, -1), 'move')}
                        >
                          <Icon icon="solar:alt-arrow-up-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Earlier
                        </button>
                        <button
                          type="button"
                          className={`${secondaryButton} px-2 py-1 text-xs`}
                          disabled={index === visit.items.length - 1 || busy !== null}
                          onClick={() => void arrange(moveWithinVisit(visits, item.entry.id, 1), 'move')}
                        >
                          <Icon icon="solar:alt-arrow-down-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Later
                        </button>
                        <label className="inline-flex items-center gap-1 text-xs text-gray-700">
                          Move to
                          <select
                            className="rounded-md border border-gray-300 px-1.5 py-1 text-xs"
                            value={visit.visit}
                            disabled={busy !== null}
                            onChange={event => void arrange(moveToVisit(visits, item.entry.id, Number(event.target.value)), 'move')}
                          >
                            {visits.map(option => (
                              <option key={option.visit} value={option.visit}>
                                Visit {option.visit}
                              </option>
                            ))}
                            <option value={newVisit}>A new visit ({newVisit})</option>
                          </select>
                        </label>
                        {canChart && (
                          <>
                            <button type="button" className={`${secondaryButton} px-2 py-1 text-xs`} disabled={busy !== null} onClick={() => void changeStatus(item, 'done')}>
                              <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 text-green-600" aria-hidden="true" />
                              Done
                            </button>
                            <button type="button" className={`${secondaryButton} px-2 py-1 text-xs`} disabled={busy !== null} onClick={() => void changeStatus(item, 'removed')}>
                              <Icon icon="solar:close-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                              Take off the plan
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
              {visitLines.map(line => (
                <li key={line.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-gray-600">
                  <span>
                    {line.code} {line.description}
                    {line.quantity > 1 ? ` x${line.quantity}` : ''}
                  </span>
                  <span className="whitespace-nowrap">{formatNad(line.totalPrice)}</span>
                </li>
              ))}
            </ul>
            {visitIssues.length > 0 && (
              <ul className="space-y-1 border-t border-gray-100 px-3 py-2">
                {visitIssues.map(issue => (
                  <li key={issue.message} className={`text-xs ${issue.severity === 'error' ? 'text-red-700' : 'text-amber-800'}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {fundNote && <p className="text-xs text-gray-500">{fundNote}</p>}

      {done.length > 0 && (
        <details className="rounded-xl border border-gray-200">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700">Done ({done.length})</summary>
          <ul className="divide-y divide-gray-100">
            {done.map(item => (
              <li key={item.entry.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-sm">
                <button type="button" className="font-semibold text-gray-900 hover:underline" onClick={() => onSelectTooth(item.entry.tooth)}>
                  {item.entry.tooth}
                </button>
                <span className="text-gray-800">
                  {item.entry.tariffCode} {describeEntryWork(item.entry)}
                </span>
                <span className="text-xs text-gray-500">
                  done {item.doneDate ? formatServiceDate(item.doneDate) : ''}
                  {item.billedBy && (
                    <>
                      {', invoice '}
                      {navigation ? (
                        <Link to={invoiceLink(item.billedBy.invoiceId)} className="text-cyan-700 hover:underline">
                          {item.billedBy.invoiceNumber}
                        </Link>
                      ) : (
                        item.billedBy.invoiceNumber
                      )}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};

export default TreatmentPlan;
