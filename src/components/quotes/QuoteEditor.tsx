import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../modals/FormModal';
import type { ServiceSelection } from '../../types/billing';
import { addDaysToKey, isValidDateKey, todayKey } from '../../utils/billing/dates';
import { formatNad, fromCents } from '../../utils/billing/money';
import { normalizeMultiplyRule, parseTariffPrice, searchTariffs } from '../../utils/billing/pricing';
import { describePatientRate } from '../../utils/billing/patientRates';
import { changeLineQuantity, type VisitTariff } from '../visits/visitBillingLines';
import { describeAddedLinks } from '../visits/linkedCodeLines';
import { addTariffLines, removeLine, tariffNeedsTooth, type LineContext } from './billingLines';
import { withLinkedCodes } from './quoteLinkedCodes';
import {
  DEFAULT_VALIDITY_DAYS,
  VALIDITY_PRESETS,
  defaultValidUntil,
  estimateQuote,
  formatDayFirst,
  fundRatesFromTariffs,
  quoteLinesToServices,
  repriceQuoteLines,
  servicesToQuoteLines,
  validateQuoteHeader,
  validityNote
} from './quotes';
import {
  billableOn,
  isQuotesNotEnabledError,
  loadPatientFund,
  loadQuote,
  loadTariffSet,
  saveQuote,
  type PatientFund,
  type QuoteWithLines,
  type TariffSet
} from './quoteService';
import BundleMenu from './BundleMenu';
import { isDentalPractice, isOptometryPractice } from '../../utils/billing/tariffRules';
import OpticalBenefitNote from '../optometry/OpticalBenefitNote';
import { MessageList, QuotesNotEnabled, inputClass, labelClass, primaryButton, secondaryButton } from './QuoteBits';

export interface QuotePatient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface QuoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  practiceId: string;
  patient: QuotePatient;
  /** Edit this quote; a new quote when empty */
  quoteId?: string | null;
  onSaved: (quoteId: string) => void;
}

type Loaded = { tariffSet: TariffSet; fund: PatientFund; existing: QuoteWithLines | null };
type LoadState = { status: 'loading' } | { status: 'not_enabled' } | { status: 'error'; message: string } | ({ status: 'ready' } & Loaded);

interface HeaderForm {
  quoteDate: string;
  validUntil: string;
  preauthNumber: string;
  fundReference: string;
  notes: string;
}

const newHeader = (): HeaderForm => {
  const today = todayKey();
  return { quoteDate: today, validUntil: defaultValidUntil(today), preauthNumber: '', fundReference: '', notes: '' };
};

/** Create or edit a quote: codes and bundles priced like the visit's invoice, with the medical aid estimate. */
const QuoteEditor: React.FC<QuoteEditorProps> = ({ isOpen, onClose, practiceId, patient, quoteId = null, onSaved }) => {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [header, setHeader] = useState<HeaderForm>(newHeader);
  const [lines, setLines] = useState<ServiceSelection[]>([]);
  const [saving, setSaving] = useState(false);
  const [triedSave, setTriedSave] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoad({ status: 'loading' });
    setTriedSave(false);
    Promise.all([loadTariffSet(practiceId), loadPatientFund(patient.id), quoteId ? loadQuote(quoteId) : Promise.resolve(null)])
      .then(([tariffSet, fund, existing]) => {
        if (cancelled) return;
        if (existing) {
          const { quote } = existing;
          setHeader({
            quoteDate: quote.quoteDate,
            validUntil: quote.validUntil,
            preauthNumber: quote.preauthNumber ?? '',
            fundReference: quote.fundReference ?? '',
            notes: quote.notes ?? ''
          });
          setLines(quoteLinesToServices(existing.lines, billableOn(tariffSet, quote.quoteDate, fund.pricingFund, fund.patientRate ?? null), fund.hasMedicalAid));
        } else {
          setHeader(newHeader());
          setLines([]);
        }
        setLoad({ status: 'ready', tariffSet, fund, existing });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad(
          isQuotesNotEnabledError(error)
            ? { status: 'not_enabled' }
            : { status: 'error', message: error instanceof Error ? error.message : 'Could not open the quote.' }
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, practiceId, patient.id, quoteId, attempt]);

  const ready = load.status === 'ready' ? load : null;
  const serviceDate = isValidDateKey(header.quoteDate) ? header.quoteDate : todayKey();
  // Priced for the patient's fund on the quote date (the fund's own price where its schedule has the code), at the
  // patient's own price rate when they have one, as the visit will be
  const billable = useMemo(
    () => (ready ? billableOn(ready.tariffSet, serviceDate, ready.fund.pricingFund, ready.fund.patientRate ?? null) : []),
    [ready, serviceDate]
  );
  const isDental = isDentalPractice(ready?.tariffSet.practiceType);
  const hasMedicalAid = ready?.fund.hasMedicalAid ?? false;
  const infectionControlStaff = ready?.tariffSet.infectionControlStaff;
  const context: LineContext = useMemo(
    () => ({ tariffs: billable, hasMedicalAid, autoInfectionControl: isDental, infectionControlStaff }),
    [billable, hasMedicalAid, isDental, infectionControlStaff]
  );
  const estimate = useMemo(
    () => estimateQuote(lines, { hasMedicalAid, fundName: ready?.fund.fundName ?? null, rates: fundRatesFromTariffs(billable) }),
    [lines, hasMedicalAid, ready, billable]
  );
  const repriced = useMemo(
    () => (ready && lines.length > 0 ? repriceQuoteLines(servicesToQuoteLines(lines, estimate), { tariffs: billable, hasMedicalAid }) : null),
    [ready, lines, estimate, billable, hasMedicalAid]
  );
  const errors = validateQuoteHeader(header, lines.length);
  const wasSent = ready?.existing?.quote.status === 'sent';
  const note = validityNote(header.quoteDate, header.validUntil);

  // A code added from the search or a bundle brings the practice's linked codes, as on a visit: shown, removable
  const addLines = (next: ServiceSelection[]) => {
    const linked = withLinkedCodes(lines, next, billable, { hasMedicalAid, dental: isDental });
    setLines(linked.services);
    if (linked.problems.length > 0) toast.error(linked.problems.join(' '), { id: 'quote-linked-codes-problem', duration: 8000 });
    if (linked.added.length > 0) toast(describeAddedLinks(linked.added), { id: 'quote-linked-codes', duration: 8000 });
  };

  const save = async () => {
    setTriedSave(true);
    if (!ready || errors.length > 0) return;
    setSaving(true);
    try {
      const id = await saveQuote({
        id: ready.existing?.quote.id ?? null,
        practiceId,
        patientId: patient.id,
        status: 'draft',
        quoteDate: header.quoteDate,
        validUntil: header.validUntil,
        fund: ready.fund,
        estimate,
        preauthNumber: header.preauthNumber,
        fundReference: header.fundReference,
        notes: header.notes,
        lines: servicesToQuoteLines(lines, estimate)
      });
      toast.success(ready.existing ? `Quote ${ready.existing.quote.quoteNumber} saved.` : 'Quote saved.');
      onSaved(id);
    } catch (error) {
      if (isQuotesNotEnabledError(error)) setLoad({ status: 'not_enabled' });
      else toast.error(error instanceof Error ? error.message : 'Could not save the quote.');
    } finally {
      setSaving(false);
    }
  };

  const title = ready?.existing ? `Edit quote ${ready.existing.quote.quoteNumber}` : 'New quote';

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title={title} icon="solar:bill-list-bold-duotone" className="max-w-4xl">
      {load.status === 'loading' && (
        <div className="space-y-3" role="status" aria-live="polite">
          {[0, 1, 2].map(row => (
            <div key={row} className="h-14 animate-pulse rounded-xl bg-gray-100" />
          ))}
          <span className="sr-only">Loading the tariffs and the patient's medical aid</span>
        </div>
      )}
      {load.status === 'not_enabled' && <QuotesNotEnabled />}
      {load.status === 'error' && (
        <div className="space-y-3 py-6 text-center" role="alert">
          <p className="text-sm text-red-700">{load.message}</p>
          <button type="button" className={secondaryButton} onClick={() => setAttempt(value => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {ready && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-gray-50 p-3 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{patient.name}</p>
              <p className="text-xs text-gray-600">
                {ready.fund.hasMedicalAid
                  ? `${ready.fund.fundName ?? 'Medical aid'}${ready.fund.scheme ? ` - ${ready.fund.scheme}` : ''}${ready.fund.membershipNumber ? ` (member no ${ready.fund.membershipNumber})` : ''}`
                  : 'Private: no medical aid on file'}
              </p>
            </div>
            <span className="text-xs text-gray-500">
              Prices: tariffs in effect on {formatDayFirst(serviceDate)}
              {ready.fund.patientRate ? ` · ${describePatientRate(ready.fund.patientRate)}` : ''}
            </span>
          </div>

          {/* Optometry: the practice's own note on what the patient's fund pays for spectacles and lenses */}
          {isOptometryPractice(ready.tariffSet.practiceType) && <OpticalBenefitNote practiceId={practiceId} patientId={patient.id} />}

          {wasSent && (
            <MessageList tone="info" messages={['This quote was sent to the patient. Saving changes makes it a draft again: send it again afterwards.']} />
          )}

          <AddCode billable={billable} lines={lines} context={context} dental={isDental} onChange={addLines} />

          <div className="flex flex-wrap items-center gap-2">
            <BundleMenu
              practiceId={practiceId}
              practiceType={ready.tariffSet.practiceType}
              tariffs={billable}
              lines={lines}
              hasMedicalAid={hasMedicalAid}
              autoInfectionControl={isDental}
              infectionControlStaff={infectionControlStaff}
              onApply={addLines}
            />
            {isDental && <span className="text-xs text-gray-500">Infection control (8109) is added once, with the first code.</span>}
          </div>

          <QuoteLinesEditor
            lines={lines}
            estimateLines={estimate.lines}
            onQuantity={(lineId, quantity) => {
              const { services, line } = changeLineQuantity(lines, lineId, quantity, billable, hasMedicalAid);
              if (line && !line.ok) toast.error(line.errors.join(' '), { duration: 8000 });
              else setLines(services);
            }}
            onRemove={lineId => setLines(current => removeLine(current, lineId))}
          />

          {repriced && (repriced.changes.length > 0 || repriced.problems.length > 0) && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">The tariff list has changed since these prices were quoted</p>
              {repriced.changes.length > 0 && (
                <p>
                  {repriced.changes.length} line(s) have a different price on {formatDayFirst(serviceDate)}: the total would be{' '}
                  {formatNad(fromCents(repriced.newTotalCents))} ({repriced.differenceCents >= 0 ? '+' : ''}
                  {formatNad(fromCents(repriced.differenceCents))}).
                </p>
              )}
              {repriced.problems.map(problem => (
                <p key={problem}>{problem}</p>
              ))}
              {repriced.problems.length === 0 && (
                <button type="button" className={secondaryButton} onClick={() => setLines(repriced.services)}>
                  <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  Use current prices
                </button>
              )}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 p-3">
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-gray-500">Total</dt>
                <dd className="font-semibold text-gray-900">{formatNad(fromCents(estimate.totalCents))}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-gray-500">Medical aid (estimated)</dt>
                <dd className="font-semibold text-gray-900">{formatNad(fromCents(estimate.fundCents))}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-gray-500">Patient portion (estimated)</dt>
                <dd className="font-semibold text-cyan-700">{formatNad(fromCents(estimate.patientCents))}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-gray-600">{estimate.note}</p>
            {(ready.tariffSet.bookError ?? ready.fund.ratesError) && (
              <p className="mt-1 text-xs text-amber-700">
                The fund's prices could not be read ({ready.tariffSet.bookError ?? ready.fund.ratesError}), so the practice tariff is used and no fund
                portion is estimated.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Quote date</span>
              <input
                type="date"
                className={inputClass}
                value={header.quoteDate}
                onChange={event => setHeader(current => ({ ...current, quoteDate: event.target.value }))}
              />
              <span className="mt-1 block text-xs text-gray-500">{formatDayFirst(header.quoteDate)}</span>
            </label>
            <div>
              <label className="block">
                <span className={labelClass}>Valid until</span>
                <input
                  type="date"
                  className={inputClass}
                  min={header.quoteDate}
                  value={header.validUntil}
                  onChange={event => setHeader(current => ({ ...current, validUntil: event.target.value }))}
                />
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-xs text-gray-500">{formatDayFirst(header.validUntil)}</span>
                {isValidDateKey(header.quoteDate) &&
                  VALIDITY_PRESETS.map(days => (
                    <button
                      key={days}
                      type="button"
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200"
                      onClick={() => setHeader(current => ({ ...current, validUntil: addDaysToKey(current.quoteDate, days) }))}
                    >
                      {days} days{days === DEFAULT_VALIDITY_DAYS ? ' (usual)' : ''}
                    </button>
                  ))}
              </div>
            </div>
            <label className="block">
              <span className={labelClass}>Pre-authorisation number (optional)</span>
              <input
                className={inputClass}
                maxLength={40}
                value={header.preauthNumber}
                onChange={event => setHeader(current => ({ ...current, preauthNumber: event.target.value }))}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Fund reference (optional)</span>
              <input
                className={inputClass}
                maxLength={60}
                value={header.fundReference}
                onChange={event => setHeader(current => ({ ...current, fundReference: event.target.value }))}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Notes for the patient (printed on the quote)</span>
              <textarea
                className={`${inputClass} min-h-[72px]`}
                maxLength={1000}
                value={header.notes}
                onChange={event => setHeader(current => ({ ...current, notes: event.target.value }))}
              />
            </label>
          </div>
          {note && <MessageList tone="info" messages={[note]} />}

          {triedSave && <MessageList tone="error" title="Fix these before saving" messages={errors} />}

          <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-gray-100 bg-white px-4 pt-3 sm:-mx-6 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" className={secondaryButton} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className={primaryButton} onClick={() => void save()} disabled={saving}>
              <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:diskette-bold-duotone'} className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} aria-hidden="true" />
              {saving ? 'Saving...' : 'Save quote'}
            </button>
          </div>
        </div>
      )}
    </FormModal>
  );
};

interface AddCodeProps {
  billable: readonly VisitTariff[];
  lines: ServiceSelection[];
  context: LineContext;
  /** Dental practices (isDentalPractice): a line can name its tooth. Other disciplines never bill a tooth, so no field */
  dental: boolean;
  onChange: (lines: ServiceSelection[]) => void;
}

/** Search a code, set quantity (and the tooth in a dental practice), add it with the visit screens' rules. */
const AddCode: React.FC<AddCodeProps> = ({ billable, lines, context, dental, onChange }) => {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<VisitTariff | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [tooth, setTooth] = useState('');

  const searchable = useMemo(
    () => billable.filter(tariff => tariff.code !== '8346').map(tariff => ({ id: tariff.id, code: tariff.code, description: tariff.description ?? '', tariff })),
    [billable]
  );
  const matches = useMemo(() => (search.trim() && !picked ? searchTariffs(searchable, search).slice(0, 8) : []), [searchable, search, picked]);
  const multipliable = picked ? normalizeMultiplyRule(picked.can_be_multiplied) !== 'NO' : false;
  const needsTooth = picked ? tariffNeedsTooth(picked) : false;

  const reset = () => {
    setSearch('');
    setPicked(null);
    setQuantity('1');
    setTooth('');
  };

  const add = () => {
    if (!picked) return;
    const outcome = addTariffLines(lines, { code: picked.code, quantity: Number(quantity), tooth }, context);
    if (outcome.status === 'refused') {
      toast.error(outcome.message, { duration: 8000 });
      return;
    }
    if (outcome.status === 'skipped') {
      toast(outcome.reason, { duration: 6000 });
      reset();
      return;
    }
    onChange(outcome.lines);
    outcome.warnings.forEach(warning => toast(warning, { duration: 8000 }));
    outcome.problems.forEach(problem => toast.error(problem.message, { id: `quote-${problem.code}`, duration: 8000 }));
    reset();
  };

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className={labelClass}>Add a code</p>
      {!picked ? (
        <div className="relative">
          <Icon icon="solar:magnifer-bold-duotone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            className={`${inputClass} pl-9`}
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={billable.length > 0 ? 'Search by code or description' : 'The tariff list is not loaded'}
            disabled={billable.length === 0}
            aria-label="Search the tariff list"
          />
          {matches.length > 0 && (
            <ul className="mt-1 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              {matches.map(match => {
                const price = parseTariffPrice(match.tariff.price);
                return (
                  <li key={match.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-cyan-50"
                      onClick={() => {
                        setPicked(match.tariff);
                        setQuantity('1');
                        setTooth('');
                      }}
                    >
                      <span className="min-w-0">
                        <span className="font-semibold text-gray-900">{match.code}</span>{' '}
                        <span className="text-gray-600">{match.description}</span>
                      </span>
                      <span className="whitespace-nowrap font-medium text-gray-900">{price !== null ? formatNad(price) : '-'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {search.trim() && matches.length === 0 && <p className="mt-1 text-xs text-gray-500">No code in the tariff list matches "{search.trim()}".</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-900">
            <span className="font-semibold">{picked.code}</span> {picked.description ?? ''}
          </p>
          <div className={`grid grid-cols-2 gap-2 ${dental ? 'sm:grid-cols-[6rem_6rem_auto_auto]' : 'sm:grid-cols-[6rem_auto_auto]'} sm:items-end`}>
            <label className={dental ? 'block' : 'col-span-2 block sm:col-span-1'}>
              <span className={labelClass}>Quantity</span>
              <input
                className={inputClass}
                type="number"
                min={1}
                max={99}
                step="any"
                value={quantity}
                disabled={!multipliable}
                title={multipliable ? undefined : 'Billed once per line: add another line for another unit'}
                onChange={event => setQuantity(event.target.value)}
              />
            </label>
            {dental && (
              <label className="block">
                <span className={labelClass}>Tooth{needsTooth ? '' : ' (optional)'}</span>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  maxLength={2}
                  value={tooth}
                  placeholder={needsTooth ? 'Required' : ''}
                  onChange={event => setTooth(event.target.value.trim())}
                />
              </label>
            )}
            <button type="button" className={`${primaryButton} col-span-1`} onClick={add}>
              <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Add
            </button>
            <button type="button" className={`${secondaryButton} col-span-1`} onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface QuoteLinesEditorProps {
  lines: ServiceSelection[];
  estimateLines: readonly { fundCents: number; patientCents: number }[];
  onQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
}

const QuoteLinesEditor: React.FC<QuoteLinesEditorProps> = ({ lines, estimateLines, onQuantity, onRemove }) => {
  if (lines.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
        No codes yet. Search a code above or add a code bundle.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
      {lines.map((line, index) => {
        const locked = line.canBeMultiplied === false || line.isAutoGenerated === true || line.isRequired === true;
        const estimate = estimateLines[index];
        return (
          <li key={line.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
            <div className="min-w-0 flex-1 basis-48">
              <p className="text-sm text-gray-900">
                <span className="font-semibold">{line.code}</span> {line.description}
              </p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {line.isAutoGenerated && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">Automatic</span>}
                {line.linkedFrom && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">Added with {line.linkedFrom}</span>}
                {line.notes && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">{line.notes}</span>}
              </div>
            </div>
            <div className="inline-flex items-center overflow-hidden rounded-lg bg-gray-100">
              <button
                type="button"
                className="px-2 py-1 text-gray-600 hover:bg-gray-200 disabled:opacity-30"
                disabled={locked || line.quantity <= 1}
                onClick={() => onQuantity(line.id, line.quantity - 1)}
                aria-label={`One less ${line.code}`}
              >
                <Icon icon="solar:minus-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-[2rem] text-center text-sm font-semibold">{line.quantity}</span>
              <button
                type="button"
                className="px-2 py-1 text-gray-600 hover:bg-gray-200 disabled:opacity-30"
                disabled={locked}
                onClick={() => onQuantity(line.id, line.quantity + 1)}
                aria-label={`One more ${line.code}`}
              >
                <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="w-28 text-right">
              <p className="text-sm font-semibold text-gray-900">{formatNad(line.totalPrice)}</p>
              {estimate && <p className="text-[11px] text-gray-500">Patient {formatNad(fromCents(estimate.patientCents))}</p>}
            </div>
            <button
              type="button"
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
              disabled={line.isRequired === true}
              onClick={() => onRemove(line.id)}
              title={line.isRequired ? 'Charged once per visit: removed with the last other line' : 'Remove'}
              aria-label={`Remove ${line.code}`}
            >
              <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default QuoteEditor;
