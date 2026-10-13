import React, { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { toDateKey, todayKey } from '../../utils/billing/dates';
import { formatNad, fromCents } from '../../utils/billing/money';
import { loadPatientFundKey } from '../../services/fundPricingService';
import { loadPatientRate } from '../../services/patientRateService';
import type { PatientFundKey } from '../../utils/billing/fundPricing';
import type { PatientRate } from '../../utils/billing/patientRates';
import { formatDayFirst, repriceQuoteLines, type QuoteLineRecord, type QuoteRecord } from './quotes';
import {
  billableOn,
  convertQuoteToInvoice,
  linkQuoteToInvoice,
  loadConvertibleVisits,
  loadTariffSet,
  type TariffSet,
  type VisitOption
} from './quoteService';
import { MessageList, primaryButton, secondaryButton } from './QuoteBits';
import { offerVisitRecalls } from '../visits/recallOffer';

interface QuoteConvertProps {
  quote: QuoteRecord;
  lines: readonly QuoteLineRecord[];
  onCancel: () => void;
  /** The quote was invoiced (and linked) */
  onConverted: () => void;
}

type Setup =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      visits: VisitOption[];
      tariffSet: TariffSet;
      hasMedicalAid: boolean;
      fund: PatientFundKey | null;
      /** The patient's own price rate (patientRates.ts): the invoice is priced with it, as a visit is */
      patientRate: PatientRate | null;
      pricingProblem: string | null;
    };

/**
 * "Convert to invoice": pick the visit the treatment was done in, see every price checked against the
 * tariffs in effect on that visit's date (differences shown line by line), then create the invoice
 * through invoiceService and link it to the quote.
 */
const QuoteConvert: React.FC<QuoteConvertProps> = ({ quote, lines, onCancel, onConverted }) => {
  const [setup, setSetup] = useState<Setup>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [unlinked, setUnlinked] = useState<{ invoiceId: string; invoiceNumber: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSetup({ status: 'loading' });
    Promise.all([
      loadConvertibleVisits(quote.patientId),
      loadTariffSet(quote.practiceId),
      loadPatientFundKey({ patientId: quote.patientId }),
      loadPatientRate(quote.patientId)
    ])
      .then(([visits, tariffSet, fundLoad, rateLoad]) => {
        if (cancelled) return;
        // As invoiceService: the medical aid record decides; when it cannot be read, the quote's own record
        const hasMedicalAid = fundLoad.hasMedicalAid ?? quote.medicalAidName !== null;
        // The invoice is priced from the patient's fund today: when its prices are unknown, nothing is invoiced
        const fundPricesExist = tariffSet.book.rows.length > 0 || tariffSet.book.contracts.length > 0;
        const pricingProblem =
          tariffSet.bookError && hasMedicalAid
            ? `The medical aid prices could not be loaded (${tariffSet.bookError}). Try again before invoicing.`
            : fundLoad.error && fundPricesExist
              ? `The patient's medical aid could not be read (${fundLoad.error}), so it is not known whether fund prices apply. Try again before invoicing.`
              : rateLoad.status === 'error'
                ? `The patient's price rate could not be read (${rateLoad.message}). Try again before invoicing.`
                : null;
        setSetup({ status: 'ready', visits, tariffSet, hasMedicalAid, fund: fundLoad.fund, patientRate: rateLoad.rate, pricingProblem });
        setVisitId(current => current ?? visits[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setSetup({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not prepare the invoice.' });
      });
    return () => {
      cancelled = true;
    };
  }, [quote.patientId, quote.practiceId, quote.medicalAidName, attempt]);

  const ready = setup.status === 'ready' ? setup : null;
  const visit = ready?.visits.find(item => item.id === visitId) ?? null;
  const serviceDate = (visit?.date && toDateKey(visit.date)) || todayKey();
  // Priced at the visit date for the patient's fund now (the fund's own price where its schedule has the code) and at
  // the patient's own price rate
  const repriced = useMemo(() => {
    if (!ready || !visit) return null;
    const result = repriceQuoteLines(lines, {
      tariffs: billableOn(ready.tariffSet, serviceDate, ready.fund, ready.patientRate),
      hasMedicalAid: ready.hasMedicalAid
    });
    return ready.pricingProblem ? { ...result, problems: [ready.pricingProblem, ...result.problems] } : result;
  }, [ready, visit, lines, serviceDate]);

  const create = async () => {
    if (!visit || !repriced || repriced.problems.length > 0) return;
    const priceNote =
      repriced.differenceCents === 0
        ? ''
        : ` The invoice total is ${formatNad(fromCents(repriced.newTotalCents))} instead of the quoted ${formatNad(fromCents(repriced.oldTotalCents))}.`;
    if (!window.confirm(`Create the invoice for the visit of ${formatDayFirst(serviceDate)} from quote ${quote.quoteNumber}?${priceNote}`)) return;
    setCreating(true);
    try {
      const result = await convertQuoteToInvoice({ quote, visitId: visit.id, services: repriced.services });
      // Codes with a recall: offer one for the patient, as when a visit is invoiced (never stops the conversion)
      void offerVisitRecalls({
        practiceId: quote.practiceId,
        patientId: quote.patientId,
        visitId: visit.id,
        visitDate: serviceDate,
        lines: repriced.services,
        tariffs: ready ? billableOn(ready.tariffSet, serviceDate, ready.fund, ready.patientRate) : []
      });
      if (result.linkError) {
        setUnlinked({ invoiceId: result.invoiceId, invoiceNumber: result.invoiceNumber, message: result.linkError });
        toast.error(`Invoice ${result.invoiceNumber} was created, but the quote could not be marked as invoiced.`, { duration: 10000 });
        return;
      }
      toast.success(`Invoice ${result.invoiceNumber} created from quote ${quote.quoteNumber}.`, { duration: 8000 });
      onConverted();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'Could not create the invoice.', { duration: 10000 });
    } finally {
      setCreating(false);
    }
  };

  const retryLink = async () => {
    if (!unlinked || !visit) return;
    try {
      await linkQuoteToInvoice(quote.id, unlinked.invoiceId, visit.id);
      toast.success(`Quote ${quote.quoteNumber} is now linked to invoice ${unlinked.invoiceNumber}.`);
      setUnlinked(null);
      onConverted();
    } catch (error) {
      setUnlinked({ ...unlinked, message: error instanceof Error ? plainWords(error.message) : 'unknown error' });
    }
  };

  if (unlinked) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
        <p className="font-semibold">Invoice {unlinked.invoiceNumber} was created, but the quote is not marked as invoiced yet</p>
        <p>{unlinked.message}</p>
        <p>Do not convert the quote again: link it to the invoice instead.</p>
        <button type="button" className={primaryButton} onClick={() => void retryLink()}>
          <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Link the quote to invoice {unlinked.invoiceNumber}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/40 p-3">
      <p className="text-sm font-semibold text-gray-900">Convert to invoice</p>
      {setup.status === 'loading' && <p className="text-sm text-gray-600" role="status">Loading the patient's visits and the tariff list...</p>}
      {setup.status === 'error' && (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-red-700">{setup.message}</p>
          <button type="button" className={secondaryButton} onClick={() => setAttempt(value => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {ready && ready.visits.length === 0 && (
        <MessageList
          tone="warning"
          messages={['This patient has no visit without an invoice. Record the treatment visit first, then convert the quote to its invoice.']}
        />
      )}
      {ready && ready.visits.length > 0 && (
        <>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs font-medium text-gray-600">Visit the treatment was done in (visits that already have an invoice are not listed)</legend>
            {ready.visits.slice(0, 8).map(option => (
              <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-gray-200 has-[:checked]:ring-cyan-500">
                <input type="radio" name={`convert-${quote.id}`} checked={visitId === option.id} onChange={() => setVisitId(option.id)} />
                <span className="font-medium">{formatDayFirst(toDateKey(option.date))}</span>
                <span className="truncate text-gray-600">
                  {[option.type, option.complaint].filter(Boolean).join(' - ') || 'Visit'}
                </span>
              </label>
            ))}
          </fieldset>

          {repriced && (
            <div className="space-y-2 text-sm">
              <p className="text-gray-700">
                Prices are checked against the tariffs in effect on {formatDayFirst(serviceDate)}.{' '}
                {repriced.changes.length === 0
                  ? 'No price has changed since the quote.'
                  : `${repriced.changes.length} line(s) have a new price:`}
              </p>
              {repriced.changes.length > 0 && (
                <ul className="divide-y divide-amber-100 rounded-lg border border-amber-200 bg-amber-50">
                  {repriced.changes.map(change => (
                    <li key={change.lineId} className="flex flex-wrap justify-between gap-2 px-3 py-1.5">
                      <span className="min-w-0">
                        <span className="font-semibold">{change.code}</span> x{change.quantity}: {formatNad(change.oldTotal)} {'->'} {formatNad(change.newTotal)}
                      </span>
                      <span className={change.differenceCents > 0 ? 'text-red-700' : 'text-green-700'}>
                        {change.differenceCents > 0 ? '+' : ''}
                        {formatNad(fromCents(change.differenceCents))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <MessageList tone="error" title="These lines cannot be invoiced" messages={repriced.problems} />
              <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-white p-2 ring-1 ring-gray-200">
                <span>Quoted {formatNad(fromCents(repriced.oldTotalCents))}</span>
                <span className="font-semibold">Invoice {formatNad(fromCents(repriced.newTotalCents))}</span>
              </div>
            </div>
          )}
        </>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={creating}>
          Cancel
        </button>
        <button
          type="button"
          className={primaryButton}
          onClick={() => void create()}
          disabled={creating || !repriced || repriced.problems.length > 0 || repriced.services.length === 0}
        >
          <Icon icon={creating ? 'solar:refresh-bold-duotone' : 'solar:bill-check-bold-duotone'} className={`h-4 w-4 ${creating ? 'animate-spin' : ''}`} aria-hidden="true" />
          {creating ? 'Creating the invoice...' : 'Create the invoice'}
        </button>
      </div>
    </div>
  );
};

export default QuoteConvert;
