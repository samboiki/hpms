import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { describeCopayRule, parseCopayPercent, parseShareAmount, type CopayRule } from '../../utils/billing/lineSplit';
import { loadCopayRules, saveCopayRules } from '../../services/invoiceContextService';
import { loadInvoicingSetup } from '../../services/invoicingSetup';

interface CopaymentPanelProps {
  practiceId: string;
  canEdit: boolean;
  /** Funds with their claim code (medical_aid_reference) */
  funds: ReadonlyArray<{ reference: string; label: string }>;
}

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rules: CopayRule[]; enabled: boolean };

/** How the patient's share of each line is set: a percentage, a fixed amount, or none (a levy only). */
type ShareKind = 'percent' | 'amount' | 'none';

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#01b9d4]';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500';

/**
 * Co-payments and levies, per fund (and plan option): the share of each medical aid line the patient pays at the
 * counter, as a percentage or a fixed amount per line, and a levy, a fixed amount the patient pays once per visit.
 * The visit's billing splits every line with them (lineSplit.ts) and the invoice shows both portions; the fund is
 * still claimed for the whole line. Billing them needs the invoicing database update, so they can only be added once
 * it is applied.
 */
const CopaymentPanel: React.FC<CopaymentPanelProps> = ({ practiceId, canEdit, funds }) => {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [fund, setFund] = useState(funds[0]?.reference ?? '');
  const [plan, setPlan] = useState('');
  const [kind, setKind] = useState<ShareKind>('percent');
  const [share, setShare] = useState('');
  const [levy, setLevy] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadCopayRules(practiceId), loadInvoicingSetup()]).then(([result, setup]) => {
      if (cancelled) return;
      setLoad(result.error ? { status: 'error', message: result.error } : { status: 'ready', rules: result.rules, enabled: setup.lineDetails });
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  const label = (reference: string) => funds.find(item => item.reference === reference)?.label ?? reference;
  const percent = kind === 'percent' ? parseCopayPercent(share) : null;
  const amount = kind === 'amount' ? parseShareAmount(share) : null;
  const levyAmount = levy.trim() === '' ? 0 : parseShareAmount(levy);
  const shareProblem =
    kind === 'percent' && share !== '' && percent === null
      ? 'Enter a percentage above 0 and up to 100, with at most 2 decimals.'
      : kind === 'amount' && share !== '' && amount === null
        ? 'Enter an amount in N$ above 0, such as 50 or 50.00.'
        : null;
  const levyProblem = levyAmount === null ? 'Enter the levy in N$ above 0, such as 20 or 20.00, or leave it empty.' : null;
  const rule: CopayRule | null =
    fund && !shareProblem && !levyProblem && (percent || amount || levyAmount)
      ? {
          fundReference: fund,
          planOption: plan.trim() || null,
          percent: percent ?? 0,
          ...(amount ? { amount } : {}),
          ...(levyAmount ? { levy: levyAmount } : {})
        }
      : null;

  const save = async (rules: CopayRule[], done: string) => {
    setSaving(true);
    try {
      await saveCopayRules(practiceId, rules);
      setLoad(current => (current.status === 'ready' ? { ...current, rules } : current));
      toast.success(done);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the co-payments.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    if (load.status !== 'ready' || !rule) return;
    const others = load.rules.filter(item => !(item.fundReference === rule.fundReference && (item.planOption ?? '').toLowerCase() === (rule.planOption ?? '').toLowerCase()));
    if (await save([...others, rule], `${label(rule.fundReference)}: the patient pays ${describeCopayRule(rule)}.`)) {
      setPlan('');
      setShare('');
      setLevy('');
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="copayments-heading">
      <h2 id="copayments-heading" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Icon icon="solar:hand-money-bold-duotone" className="h-5 w-5 text-[#01b9d4]" aria-hidden="true" />
        Co-payments and levies
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        What the patient pays at the counter of each medical aid visit: a share of each line (a percentage or a fixed amount), and a levy once per visit.
        The medical aid is still claimed for the whole of each line and pays the rest. Check the fund&apos;s current rule before you add it.
      </p>

      {load.status === 'loading' && <p className="mt-4 text-sm text-gray-500" role="status">Loading the co-payments...</p>}
      {load.status === 'error' && <p className="mt-4 text-sm text-red-700" role="alert">The co-payments could not be loaded: {load.message}</p>}
      {load.status === 'ready' && (
        <>
          {load.rules.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No co-payments or levies: medical aids are billed the whole line.</p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
              {load.rules.map(item => (
                <li key={`${item.fundReference}|${item.planOption ?? ''}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="text-gray-900">
                    {label(item.fundReference)}
                    <span className="text-gray-500">{item.planOption ? `, ${item.planOption}` : ', every plan'}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">The patient pays {describeCopayRule(item)}</span>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void save(load.rules.filter(other => other !== item), `Co-payment for ${label(item.fundReference)} removed.`)}
                        className="rounded text-xs font-medium text-red-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                        aria-label={`Remove the co-payment for ${label(item.fundReference)}${item.planOption ? `, ${item.planOption}` : ''}`}
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!load.enabled && (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status">
              <Icon icon="solar:info-circle-bold-duotone" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              Co-payments can be billed once the invoicing database update (proposals/2026-10-07-invoicing.sql) is applied. Until then medical aids are billed
              the whole line.
            </p>
          )}

          {load.enabled && canEdit && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
              <label className="block lg:col-span-2">
                <span className={labelClass}>Fund</span>
                <select value={fund} onChange={event => setFund(event.target.value)} className={inputClass}>
                  {funds.map(item => (
                    <option key={item.reference} value={item.reference}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Plan option (optional)</span>
                <input value={plan} onChange={event => setPlan(event.target.value)} placeholder="Every plan" className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Patient pays per line</span>
                <select
                  value={kind}
                  onChange={event => {
                    setKind(event.target.value as ShareKind);
                    setShare('');
                  }}
                  className={inputClass}
                >
                  <option value="percent">A percentage</option>
                  <option value="amount">A fixed amount</option>
                  <option value="none">Nothing (levy only)</option>
                </select>
              </label>
              {kind !== 'none' ? (
                <label className="block">
                  <span className={labelClass}>{kind === 'percent' ? 'Percentage (%)' : 'Amount (N$)'}</span>
                  <input
                    value={share}
                    onChange={event => setShare(event.target.value)}
                    inputMode="decimal"
                    placeholder={kind === 'percent' ? 'e.g. 5' : 'e.g. 50.00'}
                    className={inputClass}
                    aria-invalid={shareProblem ? true : undefined}
                  />
                </label>
              ) : (
                <span className="hidden lg:block" aria-hidden="true" />
              )}
              <label className="block">
                <span className={labelClass}>Levy per visit (N$)</span>
                <input
                  value={levy}
                  onChange={event => setLevy(event.target.value)}
                  inputMode="decimal"
                  placeholder="Optional"
                  className={inputClass}
                  aria-invalid={levyProblem ? true : undefined}
                />
              </label>
              <button
                type="button"
                onClick={() => void add()}
                disabled={saving || !rule}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01b9d4] px-4 py-2 text-sm font-medium text-white hover:bg-[#019bb3] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-50 sm:col-span-2 lg:col-span-6 lg:justify-self-end"
              >
                <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                {saving ? 'Saving...' : 'Save for this fund'}
              </button>
              {(shareProblem || levyProblem) && <p className="text-xs text-red-700 sm:col-span-2 lg:col-span-6" role="alert">{shareProblem ?? levyProblem}</p>}
              <p className="text-xs text-gray-500 sm:col-span-2 lg:col-span-6">
                A fund and plan option have one rule: saving again replaces it. The levy comes off what the medical aid pays on the visit&apos;s first lines,
                never more than the medical aid&apos;s share.
              </p>
            </div>
          )}
          {!canEdit && <p className="mt-3 text-xs text-gray-500">Only a practice administrator can change co-payments and levies.</p>}
        </>
      )}
    </section>
  );
};

export default CopaymentPanel;
