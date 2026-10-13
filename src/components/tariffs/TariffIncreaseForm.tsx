import React, { useId, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { formatNad } from '../../utils/billing/money';
import { formatServiceDate } from '../../utils/billing/dates';
import type { TariffRow } from '../../utils/billing/pricing';
import {
  INCREASE_ROUNDING,
  checkIncreaseOptions,
  increasePayload,
  nextNewYear,
  planIncrease,
  type IncreaseItem,
  type IncreaseOptions,
  type IncreaseRounding
} from '../../utils/billing/tariffIncrease';
import { applyTariffIncrease } from '../../services/codeRulesService';

interface TariffIncreaseFormProps {
  practiceId: string;
  /** The practice's list as billing reads it (the shared list with its own codes merged in) */
  rows: readonly TariffRow[];
  /** yyyy-MM-dd: today, for the usual start date (1 January next year) */
  today: string;
  onCancel: () => void;
  /** After the new prices are saved, to load the list again */
  onApplied: () => void;
}

const INPUT =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#01b9d4] disabled:bg-gray-100';
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500';

/**
 * The yearly increase (parity E3): the practice's prices up by a percentage from a date, for all codes or a range, with
 * the rounding chosen. The preview lists each code's price now and its new price; applying saves a new dated price for
 * every code ticked (tariffIncrease.ts). Earlier prices stay, so visits before the date keep theirs.
 */
const TariffIncreaseForm: React.FC<TariffIncreaseFormProps> = ({ practiceId, rows, today, onCancel, onApplied }) => {
  const id = useId();
  const [options, setOptions] = useState<IncreaseOptions>({
    percent: '',
    fromDate: nextNewYear(today),
    rounding: 'cent',
    scope: 'all',
    fromCode: '',
    toCode: ''
  });
  // Codes ticked or unticked by hand, by code (otherwise the preview's own choice)
  const [ticks, setTicks] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const checked = useMemo(() => checkIncreaseOptions(options), [options]);
  const plan = useMemo<IncreaseItem[]>(() => (checked.ok ? planIncrease(rows, checked.value) : []), [rows, checked]);
  const items = plan.map(item => (item.selectable && ticks.has(item.code) ? { ...item, include: ticks.get(item.code) === true } : item));
  const chosen = increasePayload(items).length;
  const update = (changes: Partial<IncreaseOptions>) => setOptions(current => ({ ...current, ...changes }));

  const apply = async (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!checked.ok || chosen === 0) return;
    const { percent, fromDate } = checked.value;
    const question = `Put ${chosen} price${chosen === 1 ? '' : 's'} up by ${percent}% from ${formatServiceDate(fromDate)}? Visits before that day keep their prices.`;
    if (!window.confirm(question)) return;
    setSaving(true);
    try {
      const changed = await applyTariffIncrease(practiceId, fromDate, items);
      toast.success(`${changed} price${changed === 1 ? '' : 's'} go up from ${formatServiceDate(fromDate)}.`);
      onApplied();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The new prices could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={apply} className="space-y-4 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4 sm:p-5" aria-labelledby={`${id}-title`} noValidate>
      <div className="flex items-start gap-2">
        <Icon icon="solar:graph-up-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#01b9d4]" aria-hidden="true" />
        <div>
          <h3 id={`${id}-title`} className="text-base font-semibold text-gray-900">
            Yearly increase
          </h3>
          <p className="text-sm text-gray-600">
            Puts your prices up by a percentage from a date. Visits before that date keep their prices, and each code keeps its earlier prices. Codes from the
            shared list become your practice&apos;s own prices from that date.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={LABEL}>Increase by (%)</span>
          <input className={INPUT} value={options.percent} onChange={event => update({ percent: event.target.value })} inputMode="decimal" placeholder="e.g. 6" autoFocus />
        </label>
        <label className="block">
          <span className={LABEL}>New prices from</span>
          <input type="date" className={INPUT} value={options.fromDate} onChange={event => update({ fromDate: event.target.value })} />
        </label>
        <label className="block">
          <span className={LABEL}>Round new prices</span>
          <select className={INPUT} value={options.rounding} onChange={event => update({ rounding: event.target.value as IncreaseRounding })}>
            {INCREASE_ROUNDING.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>Which codes</span>
          <select className={INPUT} value={options.scope} onChange={event => update({ scope: event.target.value === 'range' ? 'range' : 'all' })}>
            <option value="all">All codes</option>
            <option value="range">A range of codes</option>
          </select>
        </label>
        {options.scope === 'range' && (
          <>
            <label className="block">
              <span className={LABEL}>From code</span>
              <input
                className={`${INPUT} font-mono`}
                value={options.fromCode}
                onChange={event => update({ fromCode: event.target.value.toUpperCase() })}
                maxLength={10}
                placeholder="e.g. 0190"
              />
            </label>
            <label className="block">
              <span className={LABEL}>To code</span>
              <input
                className={`${INPUT} font-mono`}
                value={options.toCode}
                onChange={event => update({ toCode: event.target.value.toUpperCase() })}
                maxLength={10}
                placeholder="e.g. 0199"
              />
            </label>
          </>
        )}
      </div>

      {checked.ok && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700" role="status">
            {plan.length === 0
              ? 'No codes to change: none is billed the day before that date.'
              : `${chosen} of ${plan.length} codes go up from ${formatServiceDate(checked.value.fromDate)}. Untick any to leave its price as it is.`}
          </p>
          {plan.length > 0 && (
            <div className="max-h-[360px] overflow-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2">
                      <span className="sr-only">Change</span>
                    </th>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2 text-right">Price now</th>
                    <th className="px-4 py-2 text-right">New price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => (
                    <tr key={item.code}>
                      <td className="px-4 py-1.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                          checked={item.include}
                          disabled={!item.selectable}
                          onChange={event => setTicks(current => new Map(current).set(item.code, event.target.checked))}
                          aria-label={`Put up ${item.code}`}
                        />
                      </td>
                      <td className="px-4 py-1.5 font-semibold text-gray-900">{item.code}</td>
                      <td className="max-w-lg px-4 py-1.5 text-gray-700">
                        <span className="block truncate" title={item.description}>
                          {item.description}
                        </span>
                        {item.note && <span className="block text-xs text-amber-700">{item.note}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-1.5 text-right text-gray-600">{formatNad(item.oldPrice)}</td>
                      <td className={`whitespace-nowrap px-4 py-1.5 text-right font-medium ${item.include ? 'text-gray-900' : 'text-gray-400'}`}>{formatNad(item.newPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {attempted && !checked.ok && (
        <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {checked.errors.map(error => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || (checked.ok && chosen === 0)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01b9d4] px-4 py-2 text-sm font-medium text-white hover:bg-[#019bb3] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <Icon icon="solar:diskette-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {saving ? 'Saving...' : checked.ok ? `Put up ${chosen} price${chosen === 1 ? '' : 's'}` : 'Put the prices up'}
        </button>
      </div>
    </form>
  );
};

export default TariffIncreaseForm;
