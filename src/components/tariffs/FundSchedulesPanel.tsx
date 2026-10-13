import React, { useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { formatNad, toCents } from '../../utils/billing/money';
import { isValidDateKey, todayKey } from '../../utils/billing/dates';
import { searchTariffs, selectBillableTariffs, type TariffRow } from '../../utils/billing/pricing';
import { describePriceSource, fundPriceFor } from '../../utils/billing/fundPricing';
import { endFundTariffs, type FundContractRecord, type FundTariffRecord } from '../../services/fundPricingService';
import { scheduleVersions, type FundOption, type PracticeTariffRecord } from './tariffAdmin';

interface FundSchedulesPanelProps {
  practiceId: string;
  practiceType: string;
  isSuperAdmin: boolean;
  canEditPractice: boolean;
  funds: readonly FundOption[];
  tariffRows: readonly PracticeTariffRecord[];
  fundRows: readonly FundTariffRecord[];
  contracts: readonly FundContractRecord[];
  onChanged: () => void;
}

const dayLabel = (key: string | null): string => (key && isValidDateKey(key) ? format(parseISO(key), 'd MMM yyyy') : '-');
const inputClass = 'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#01b9d4]';

/**
 * A fund's prices as the billing screens will use them on a date: for every code of the practice tariff, the price a
 * patient of the fund is billed and where it comes from. Below, the fund's price versions with their dates; a version
 * can be ended on a date (it stays as history for older visits).
 */
const FundSchedulesPanel: React.FC<FundSchedulesPanelProps> = ({
  practiceId,
  practiceType,
  isSuperAdmin,
  canEditPractice,
  funds,
  tariffRows,
  fundRows,
  contracts,
  onChanged
}) => {
  const fundsWithPrices = funds.filter(fund => fundRows.some(row => (row.fund_reference ?? '').trim().toUpperCase() === fund.reference));
  const [fundReference, setFundReference] = useState(fundsWithPrices[0]?.reference ?? funds[0]?.reference ?? '');
  const [planOption, setPlanOption] = useState('');
  const [date, setDate] = useState(todayKey());
  const [search, setSearch] = useState('');
  const [endDates, setEndDates] = useState<Record<string, string>>({});
  const [ending, setEnding] = useState<string | null>(null);

  const dateKey = isValidDateKey(date) ? date : todayKey();
  const fundRowsOfFund = fundRows.filter(row => (row.fund_reference ?? '').trim().toUpperCase() === fundReference);
  const planOptions = [...new Set(fundRowsOfFund.map(row => row.plan_option?.trim()).filter((plan): plan is string => Boolean(plan)))].sort();
  const versions = scheduleVersions(fundRowsOfFund);

  const billed = useMemo(() => {
    const { tariffs } = selectBillableTariffs(tariffRows as unknown as TariffRow[], dateKey);
    const fund = fundReference ? { reference: fundReference, planOptions: planOption ? [planOption] : [] } : null;
    const context = { serviceDate: dateKey, practiceId, fund, book: { rows: fundRows, contracts } };
    return searchTariffs(tariffs, search).map(tariff => {
      const price = fundPriceFor(tariff.code, tariff.unitPrice, context);
      return { tariff, price };
    });
  }, [tariffRows, dateKey, fundReference, planOption, practiceId, fundRows, contracts, search]);
  const fromFund = billed.filter(item => item.price.ok && item.price.source.kind !== 'practice_tariff').length;
  const problems = billed.filter(item => !item.price.ok).length;

  const endVersion = async (key: string, ids: string[], effectiveFrom: string) => {
    const endDate = endDates[key];
    if (!isValidDateKey(endDate) || endDate < effectiveFrom) {
      toast.error('Choose an end date on or after the start date.');
      return;
    }
    if (!window.confirm(`End these ${ids.length} prices on ${dayLabel(endDate)}? Visits after that day get the next price in effect.`)) return;
    setEnding(key);
    try {
      await endFundTariffs(ids, endDate);
      toast.success('The prices were ended.');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The prices could not be ended.');
    } finally {
      setEnding(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fund</span>
          <select className={inputClass} value={fundReference} onChange={event => setFundReference(event.target.value)}>
            {funds.map(fund => (
              <option key={fund.reference} value={fund.reference}>
                {fund.label}
                {fundsWithPrices.some(item => item.reference === fund.reference) ? '' : ' - no own prices'}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Plan option</span>
          <select className={inputClass} value={planOption} onChange={event => setPlanOption(event.target.value)}>
            <option value="">Any plan</option>
            {planOptions.map(plan => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Prices on</span>
          <input type="date" className={inputClass} value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Search</span>
          <input className={`${inputClass} w-full`} placeholder="Code or description" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 text-sm">
          <span className="font-semibold text-gray-800">What a patient of this fund is billed on {dayLabel(dateKey)}</span>
          <span className="text-gray-600">
            {fromFund} of {billed.length} codes at the fund's own price{problems > 0 ? `, ${problems} refused (two prices from the same day)` : ''}; the rest at the{' '}
            {practiceType} practice tariff
          </span>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Practice tariff</th>
                <th className="px-4 py-2 text-right">Billed to this fund</th>
                <th className="px-4 py-2 text-right">% of tariff</th>
                <th className="px-4 py-2">Price from</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {billed.map(({ tariff, price }) => {
                const percent =
                  price.ok && tariff.unitPrice > 0 ? `${((toCents(price.unitPrice) / toCents(tariff.unitPrice)) * 100).toFixed(1)}%` : '-';
                return (
                  <tr key={tariff.id} className={price.ok && price.source.kind !== 'practice_tariff' ? 'bg-cyan-50/40' : ''}>
                    <td className="px-4 py-1.5 font-semibold text-gray-900">{tariff.code}</td>
                    <td className="max-w-md truncate px-4 py-1.5 text-gray-700" title={tariff.description}>
                      {tariff.description}
                    </td>
                    <td className="px-4 py-1.5 text-right text-gray-600">{formatNad(tariff.unitPrice)}</td>
                    <td className="px-4 py-1.5 text-right font-medium text-gray-900">{price.ok ? formatNad(price.unitPrice) : 'Refused'}</td>
                    <td className="px-4 py-1.5 text-right text-gray-600">{percent}</td>
                    <td className="px-4 py-1.5 text-gray-600">{price.ok ? describePriceSource(price.source) : price.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {billed.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No codes of the practice tariff are in effect on this date.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">Price versions of this fund</div>
        {versions.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">
            This fund has no prices of its own, so its patients are billed the practice tariff. Import its schedule under "Import a schedule".
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {versions.map(version => {
              const mayEnd = version.practiceId === null ? isSuperAdmin : canEditPractice && version.practiceId === practiceId;
              return (
                <li key={version.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">
                      {version.codeCount} codes from {dayLabel(version.effectiveFrom)}
                      {version.effectiveTo ? ` to ${dayLabel(version.effectiveTo)}` : ' (no end date)'}
                      {version.planOption ? ` - plan ${version.planOption}` : ' - every plan'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {version.practiceId === null ? `The fund's schedule for every ${practiceType} practice` : "This practice's agreed prices"}
                      {version.source ? ` - ${version.source}` : ''}
                    </p>
                  </div>
                  {mayEnd && !version.effectiveTo && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        aria-label="End date"
                        className={inputClass}
                        min={version.effectiveFrom}
                        value={endDates[version.key] ?? ''}
                        onChange={event => setEndDates(current => ({ ...current, [version.key]: event.target.value }))}
                      />
                      <button
                        type="button"
                        disabled={ending === version.key || !endDates[version.key]}
                        onClick={() => endVersion(version.key, version.ids, version.effectiveFrom)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Icon icon="solar:calendar-mark-bold-duotone" className="h-4 w-4" />
                        End on this date
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FundSchedulesPanel;
