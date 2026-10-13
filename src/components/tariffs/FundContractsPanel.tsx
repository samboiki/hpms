import React, { useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { isValidDateKey, todayKey } from '../../utils/billing/dates';
import { MAX_CONTRACT_PERCENT, parseContractPercent } from '../../utils/billing/fundPricing';
import { MAX_INFECTION_CONTROL_STAFF } from '../../utils/billing/tariffRules';
import { endFundContract, insertFundContract, saveInfectionControlStaff, type FundContractRecord } from '../../services/fundPricingService';
import type { FundOption } from './tariffAdmin';

interface FundContractsPanelProps {
  practiceId: string;
  practiceType: string;
  dental: boolean;
  canEditPractice: boolean;
  fundsEnabled: boolean;
  funds: readonly FundOption[];
  contracts: readonly FundContractRecord[];
  infectionControlStaff: number;
  onChanged: () => void;
}

const dayLabel = (key: string | null | undefined): string => (key && isValidDateKey(key) ? format(parseISO(key), 'd MMM yyyy') : '-');
const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#01b9d4]';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500';

interface ContractDraft {
  fundReference: string;
  planOption: string;
  base: string;
  percent: string;
  from: string;
  to: string;
  notes: string;
}

const emptyDraft = (fundReference: string): ContractDraft => ({ fundReference, planOption: '', base: '', percent: '', from: todayKey(), to: '', notes: '' });

/** Problems that stop a contract from being saved. */
function contractDraftProblems(draft: ContractDraft): string[] {
  const problems: string[] = [];
  if (!draft.fundReference) problems.push('Choose the fund.');
  if (parseContractPercent(draft.percent) === null) problems.push(`Enter a percentage above 0 and up to ${MAX_CONTRACT_PERCENT}, with at most 2 decimals.`);
  if (!isValidDateKey(draft.from)) problems.push('Enter the date the contract starts.');
  if (draft.to && (!isValidDateKey(draft.to) || draft.to < draft.from)) problems.push('The end date must be on or after the start date.');
  return problems;
}

/**
 * Contracts: the practice's agreed price with a fund as a percentage of the practice tariff or of a fund's schedule
 * (for example 95% of the NAMAF benchmark). They apply to codes the fund has no fixed price for at this practice. Also
 * the 8109 setting: how many clinical staff are billed for infection control by default (dental practices).
 */
const FundContractsPanel: React.FC<FundContractsPanelProps> = ({
  practiceId,
  practiceType,
  dental,
  canEditPractice,
  fundsEnabled,
  funds,
  contracts,
  infectionControlStaff,
  onChanged
}) => {
  const [draft, setDraft] = useState<ContractDraft>(emptyDraft(funds[0]?.reference ?? ''));
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState(infectionControlStaff);
  const [endDates, setEndDates] = useState<Record<string, string>>({});
  const problems = contractDraftProblems(draft);
  const fundLabel = (reference: string | null | undefined) => funds.find(fund => fund.reference === (reference ?? '').toUpperCase())?.label ?? reference ?? '-';

  const saveContract = async () => {
    if (problems.length > 0 || !canEditPractice) return;
    setSaving(true);
    try {
      await insertFundContract({
        practice_id: practiceId,
        fund_reference: draft.fundReference,
        plan_option: draft.planOption.trim() || null,
        base_fund_reference: draft.base || null,
        percent: parseContractPercent(draft.percent) as number,
        effective_from: draft.from,
        effective_to: draft.to || null,
        notes: draft.notes.trim() || null
      });
      toast.success('The contract was saved.');
      setDraft(emptyDraft(draft.fundReference));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The contract could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const endContract = async (contract: FundContractRecord) => {
    const endDate = endDates[contract.id];
    if (!isValidDateKey(endDate) || endDate < (contract.effective_from ?? '')) {
      toast.error('Choose an end date on or after the start date.');
      return;
    }
    if (!window.confirm(`End this contract on ${dayLabel(endDate)}?`)) return;
    try {
      await endFundContract(contract.id, endDate);
      toast.success('The contract was ended.');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The contract could not be ended.');
    }
  };

  const saveStaff = async () => {
    try {
      await saveInfectionControlStaff(practiceId, staff);
      toast.success(`8109 is now billed for ${staff} clinical staff member${staff === 1 ? '' : 's'} by default.`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The setting could not be saved.');
    }
  };

  return (
    <div className="space-y-6">
      {dental && (
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5">
          <div>
            <p className="text-sm font-semibold text-gray-900">Infection control (8109)</p>
            <p className="text-xs text-gray-500">
              NAMAF bills 8109 per dentist, hygienist and assistant at the visit. New visits start with this number; staff can change it on the visit
              (1 to {MAX_INFECTION_CONTROL_STAFF}).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Clinical staff per visit"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={staff}
              disabled={!canEditPractice}
              onChange={event => setStaff(Number(event.target.value))}
            >
              {Array.from({ length: MAX_INFECTION_CONTROL_STAFF }, (_, index) => index + 1).map(count => (
                <option key={count} value={count}>
                  {count} staff
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!canEditPractice || staff === infectionControlStaff}
              onClick={saveStaff}
              className="rounded-lg bg-[#01b9d4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0196be] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">Contracts with funds</div>
        {contracts.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">No contracts: funds without their own prices are billed the {practiceType} practice tariff.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {contracts.map(contract => (
              <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900">
                    {fundLabel(contract.fund_reference)}
                    {contract.plan_option ? ` - plan ${contract.plan_option}` : ''}: {String(contract.percent)}% of{' '}
                    {contract.base_fund_reference ? `the ${fundLabel(contract.base_fund_reference)} schedule` : 'the practice tariff'}
                  </p>
                  <p className="text-xs text-gray-500">
                    From {dayLabel(contract.effective_from)}
                    {contract.effective_to ? ` to ${dayLabel(contract.effective_to)}` : ' (no end date)'}
                    {contract.is_active === false ? ' - not active' : ''}
                    {contract.notes ? ` - ${contract.notes}` : ''}
                  </p>
                </div>
                {canEditPractice && !contract.effective_to && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      aria-label="End date"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      min={contract.effective_from ?? undefined}
                      value={endDates[contract.id] ?? ''}
                      onChange={event => setEndDates(current => ({ ...current, [contract.id]: event.target.value }))}
                    />
                    <button
                      type="button"
                      disabled={!endDates[contract.id]}
                      onClick={() => endContract(contract)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      End on this date
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEditPractice && fundsEnabled && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900">New contract</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Fund</span>
              <select className={inputClass} value={draft.fundReference} onChange={event => setDraft({ ...draft, fundReference: event.target.value })}>
                <option value="">Choose a fund</option>
                {funds.map(fund => (
                  <option key={fund.reference} value={fund.reference}>
                    {fund.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Plan option (optional)</span>
              <input className={inputClass} placeholder="Every plan" value={draft.planOption} onChange={event => setDraft({ ...draft, planOption: event.target.value })} />
            </label>
            <label className="block">
              <span className={labelClass}>Percentage of</span>
              <select className={inputClass} value={draft.base} onChange={event => setDraft({ ...draft, base: event.target.value })}>
                <option value="">The practice tariff</option>
                {funds.map(fund => (
                  <option key={fund.reference} value={fund.reference}>
                    The {fund.label} schedule
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Percentage</span>
              <input className={inputClass} inputMode="decimal" placeholder="e.g. 95" value={draft.percent} onChange={event => setDraft({ ...draft, percent: event.target.value })} />
            </label>
            <label className="block">
              <span className={labelClass}>Starts on</span>
              <input type="date" className={inputClass} value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} />
            </label>
            <label className="block">
              <span className={labelClass}>Ends on (optional)</span>
              <input type="date" className={inputClass} value={draft.to} min={draft.from || undefined} onChange={event => setDraft({ ...draft, to: event.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className={labelClass}>Notes (optional)</span>
            <input className={inputClass} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {problems[0] ?? 'Prices are rounded to the cent. A contract applies to codes its base prices; the fund\'s own fixed prices for this practice come first.'}
            </p>
            <button
              type="button"
              disabled={saving || problems.length > 0}
              onClick={saveContract}
              className="inline-flex items-center gap-2 rounded-lg bg-[#01b9d4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0196be] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon icon="solar:diploma-verified-bold-duotone" className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save contract'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundContractsPanel;
