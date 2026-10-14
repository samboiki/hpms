import React, { useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { formatNad } from '../../utils/billing/money';
import { parseTariffPrice } from '../../utils/billing/pricing';
import { noFixedAmount } from '../../utils/billing/namafTariffs';
import { parseOwnPrice } from '../../utils/billing/practiceTariffs';
import ToothIcon from '../dental/ToothIcon';
import { tariffNeedsTooth } from '../quotes/billingLines';
import type { VisitTariff } from '../visits/visitBillingLines';
import PickerDialog from './PickerDialog';
import { orderServices, usesOf } from './serviceOrder';

interface VisitServiceSelectorProps {
  open: boolean;
  /** The codes that may be billed on the visit date, priced for the patient */
  tariffs: readonly VisitTariff[];
  /** How often the practice billed each code */
  usage: Readonly<Record<string, number>>;
  onSelect: (tariff: VisitTariff) => void;
  onClose: () => void;
}

/** Cards drawn at once besides the most used codes: a NAMAF list holds up to 7,000 codes, a search finds the rest */
const MAX_CARDS = 120;

/**
 * "Add a service" on the visit's Billing tab, for every discipline: search on top, the practice's most used codes
 * first, one calm card per code with its price. Picking a card goes on to the quantity or the tooth when the code
 * needs one. A code with no fixed amount in the NAMAF list (priced by rule, at cost or by arrangement) asks for the
 * amount first and is added at it.
 */
const VisitServiceSelector: React.FC<VisitServiceSelectorProps> = ({ open, tariffs, usage, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const offered = useMemo(() => orderServices(tariffs, usage, ''), [tariffs, usage]);
  const searching = query.trim() !== '';
  const shown = useMemo(() => (searching ? orderServices(tariffs, usage, query) : offered), [searching, tariffs, usage, query, offered]);
  const mostUsed = searching ? [] : shown.filter(tariff => usesOf(usage, tariff.code) > 0);
  const allOthers = searching ? shown : shown.filter(tariff => usesOf(usage, tariff.code) === 0);
  const others = allOthers.slice(0, MAX_CARDS);
  // The code waiting for its amount (no fixed amount in the list), what was typed and why it is refused
  const [amountFor, setAmountFor] = useState<VisitTariff | null>(null);
  const [amountText, setAmountText] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  const close = () => {
    setQuery('');
    setAmountFor(null);
    onClose();
  };
  const pick = (tariff: VisitTariff) => {
    if (noFixedAmount(tariff)) {
      setAmountFor(tariff);
      setAmountText('');
      setAmountError(null);
      return;
    }
    setQuery('');
    onSelect(tariff);
  };
  const addAtAmount = (event: React.FormEvent) => {
    event.preventDefault();
    if (!amountFor) return;
    const amount = parseOwnPrice(amountText);
    if (amount === null || amount <= 0) {
      setAmountError('Enter the amount in N$, such as 450 or 450.00.');
      return;
    }
    const tariff = amountFor;
    setAmountFor(null);
    setQuery('');
    onSelect({ ...tariff, price: amount });
  };

  return (
    <PickerDialog
      open={open}
      title="Add a service"
      subtitle={`${offered.length} code${offered.length === 1 ? '' : 's'} in the practice's price list`}
      onClose={close}
      size="xl"
      initialFocus={searchRef}
    >
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <label className="relative block">
          <span className="sr-only">Search by code or description</span>
          <Icon icon="solar:magnifer-bold-duotone" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              // Enter takes the best match, so "8101 Enter" adds the consultation
              if (event.key === 'Enter' && searching && shown.length > 0) {
                event.preventDefault();
                pick(shown[0]);
              }
            }}
            placeholder="Search by code or description"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 sm:text-sm"
          />
        </label>
        {searching && shown.length > 0 && (
          <p className="mt-1.5 text-xs text-gray-500" aria-live="polite">
            {shown.length} match{shown.length === 1 ? '' : 'es'}. Enter adds {shown[0].code}.
          </p>
        )}
      </div>

      {amountFor && (
        <form onSubmit={addAtAmount} className="mx-4 mt-4 space-y-3 rounded-xl bg-cyan-50/60 p-4 ring-1 ring-cyan-200 sm:mx-6" aria-label={`Amount for ${amountFor.code}`} noValidate>
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{amountFor.code}</span> {amountFor.description?.trim() || ''}: the price list has no fixed amount for this code
            (it is priced by rule, at cost or by arrangement). Type the amount to bill.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Amount per unit (N$)</span>
              <input
                value={amountText}
                onChange={event => setAmountText(event.target.value)}
                inputMode="decimal"
                placeholder="e.g. 450.00"
                autoFocus
                aria-invalid={amountError ? true : undefined}
                aria-describedby={amountError ? 'visit-service-amount-error' : undefined}
                className="w-40 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 sm:text-sm"
              />
            </label>
            <button type="submit" className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
              Add the service
            </button>
            <button type="button" onClick={() => setAmountFor(null)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
              Back to the list
            </button>
          </div>
          {amountError && (
            <p id="visit-service-amount-error" className="text-sm text-red-700" role="alert">
              {amountError}
            </p>
          )}
        </form>
      )}

      <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-5">
        {offered.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500">
            The practice's price list has no codes for this visit date yet. An administrator can import the practice's
            schedule under Admin, Tariffs.
          </p>
        )}
        {offered.length > 0 && shown.length === 0 && <p className="py-10 text-center text-sm text-gray-500">No code matches "{query.trim()}".</p>}
        {mostUsed.length > 0 && <ServiceGroup title="Most used" tariffs={mostUsed} usage={usage} onPick={pick} />}
        {others.length > 0 && <ServiceGroup title={searching ? 'Matches' : mostUsed.length > 0 ? 'All other codes' : 'All codes'} tariffs={others} usage={usage} onPick={pick} />}
        {allOthers.length > others.length && (
          <p className="text-center text-sm text-gray-500" role="status">
            Showing {others.length} of {allOthers.length.toLocaleString('en-US')} {searching ? 'matches' : 'codes'}. Type more of the code or description to find the others.
          </p>
        )}
      </div>
    </PickerDialog>
  );
};

const ServiceGroup: React.FC<{ title: string; tariffs: readonly VisitTariff[]; usage: Readonly<Record<string, number>>; onPick: (tariff: VisitTariff) => void }> = ({
  title,
  tariffs,
  usage,
  onPick
}) => (
  <section>
    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tariffs.map(tariff => (
        <li key={tariff.id}>
          <ServiceCard tariff={tariff} uses={usesOf(usage, tariff.code)} onPick={() => onPick(tariff)} />
        </li>
      ))}
    </ul>
  </section>
);

const ServiceCard: React.FC<{ tariff: VisitTariff; uses: number; onPick: () => void }> = ({ tariff, uses, onPick }) => {
  const price = tariff.price_problem ? null : parseTariffPrice(tariff.price);
  const description = tariff.description?.trim() || 'No description';
  const typed = noFixedAmount(tariff);
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex h-full w-full flex-col rounded-xl bg-white p-3 text-left ring-1 ring-gray-200 transition-colors hover:bg-cyan-50/60 hover:ring-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 motion-reduce:transition-none"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums text-gray-900">{tariff.code}</span>
        <span className={`text-sm tabular-nums ${price === null ? 'text-amber-700' : typed ? 'text-gray-500' : 'font-medium text-gray-900'}`}>
          {price === null ? (tariff.price_problem ? 'Price to check' : 'No valid price') : typed ? 'Amount when billed' : formatNad(price)}
        </span>
      </span>
      <span className="mt-1 line-clamp-2 text-sm leading-snug text-gray-600">{description}</span>
      {(tariffNeedsTooth(tariff) || uses > 0) && (
        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-gray-500">
          {tariffNeedsTooth(tariff) && (
            <span className="inline-flex items-center gap-1 text-gray-600">
              <ToothIcon className="h-3.5 w-3.5" />
              Per tooth
            </span>
          )}
          {uses > 0 && <span>Used {uses} time{uses === 1 ? '' : 's'}</span>}
        </span>
      )}
    </button>
  );
};

export default VisitServiceSelector;
