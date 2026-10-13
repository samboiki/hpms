import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { formatServiceDate } from '../../../utils/billing/dates';
import { claimBatchLink, invoiceLink, patientBillingLink } from '../../billing/invoiceLinks';
import { LINE_OUTCOME_META } from '../claims/status';
import { AmountInput, inputClass } from './ArUi';
import {
  findClaims,
  lineRowKey,
  paidInFull,
  rowKeysOf,
  type KeyingClaim,
  type KeyingDraft,
  type KeyingSummary
} from './fundPaymentKeying';

const nad = (cents: number) => formatNad(fromCents(cents));
const PAGE = 30;

type Show = 'all' | 'keyed' | 'not_keyed';

/** Opens beside the payment being keyed, so nothing typed is lost */
const NewTabLink: React.FC<{ to: string; className?: string; title: string; children: React.ReactNode }> = ({ to, className, title, children }) => (
  <a href={to} target="_blank" rel="noopener noreferrer" className={className ?? 'text-cyan-700 hover:underline'} title={title}>
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

interface FundKeyingListProps {
  claims: readonly KeyingClaim[];
  draft: KeyingDraft;
  summary: KeyingSummary;
  disabled: boolean;
  onPaid: (values: Record<string, string>) => void;
  onRestToPatient: (invoiceId: string, on: boolean) => void;
}

/**
 * The fund's open claims, oldest first, each with the lines it was claimed on: the clerk finds a claim from the
 * remittance (patient, invoice or account number), types what the fund paid on each line (0.00 = nothing) or takes
 * "Paid in full", and ticks "Patient pays the rest" where the fund paid less.
 */
export const FundKeyingList: React.FC<FundKeyingListProps> = ({ claims, draft, summary, disabled, onPaid, onRestToPatient }) => {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(PAGE);

  const keyedClaims = useMemo(() => claims.filter(claim => (summary.claims.get(claim.invoiceId)?.keyedRows ?? 0) > 0).length, [claims, summary]);
  const found = useMemo(() => {
    const matching = findClaims(claims, query);
    return matching.filter(claim => {
      const keyed = (summary.claims.get(claim.invoiceId)?.keyedRows ?? 0) > 0;
      return show === 'all' || (show === 'keyed') === keyed;
    });
  }, [claims, query, show, summary]);
  // A search that finds one claim opens it, ready to key
  const openOne = found.length === 1 && query.trim().length > 0 ? found[0].invoiceId : null;

  const toggle = (invoiceId: string) =>
    setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });

  return (
    <section aria-labelledby="fund-keying-claims" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="fund-keying-claims" className="text-sm font-semibold text-gray-900">The fund&apos;s open claims, oldest first</h3>
          <p className="text-xs text-gray-500">Type what the fund paid on each line, as on its remittance. 0.00 means it paid nothing on that line.</p>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Show claims">
          {([['all', `All (${claims.length})`], ['keyed', `Keyed (${keyedClaims})`], ['not_keyed', `Not keyed (${claims.length - keyedClaims})`]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={show === value}
              onClick={() => {
                setShow(value);
                setVisible(PAGE);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${show === value ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <Icon icon="solar:magnifer-linear" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <label htmlFor="fund-keying-search" className="sr-only">Find a claim</label>
        <input
          id="fund-keying-search"
          className={`${inputClass} pl-9`}
          placeholder="Find a claim: patient, invoice or account number"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setVisible(PAGE);
          }}
          autoComplete="off"
        />
      </div>

      {found.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
          {claims.length === 0 ? 'This fund has no open claims.' : 'No claim matches. Check the spelling, or search by invoice or account number.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {found.slice(0, visible).map(claim => {
            const claimSummary = summary.claims.get(claim.invoiceId);
            const isOpen = expanded.has(claim.invoiceId) || openOne === claim.invoiceId;
            const restOn = draft.restToPatient.includes(claim.invoiceId);
            const rest = claimSummary?.restCents ?? 0;
            return (
              <li key={claim.invoiceId} className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <button
                    type="button"
                    onClick={() => toggle(claim.invoiceId)}
                    aria-expanded={isOpen}
                    aria-controls={`fund-claim-${claim.invoiceId}`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <Icon icon={isOpen ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} className="h-4 w-4 flex-none text-gray-500" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium text-gray-900">
                        {claim.patientName}
                        <span className="font-normal text-gray-500"> · {claim.invoiceNumber} · {formatServiceDate(claim.dateKey)}</span>
                      </span>
                      <span className="block text-xs text-gray-500">
                        {claim.accountReference ? `Account ${claim.accountReference} · ` : ''}
                        {claim.lines.length > 0 ? `${claim.lines.length} claim line${claim.lines.length === 1 ? '' : 's'}` : 'Keyed as a whole'}
                      </span>
                    </span>
                  </button>
                  <span className="text-right text-xs text-gray-600">
                    Owed <span className="tabular-nums font-medium text-gray-900">{nad(claim.owedCents)}</span>
                    <span className={`block tabular-nums ${claimSummary?.overOwed ? 'font-medium text-red-700' : 'text-gray-600'}`}>
                      Keyed {nad(claimSummary?.paidCents ?? 0)}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onPaid(paidInFull(claim))}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    title="Fill every line with what was claimed, up to what the fund still owes"
                  >
                    Paid in full
                  </button>
                </div>
                {claimSummary?.overOwed && (
                  <p className="mt-1 text-xs text-red-700" role="alert">
                    More is keyed than the {nad(claim.owedCents)} the fund still owes on this claim.
                  </p>
                )}

                {isOpen && (
                  <div id={`fund-claim-${claim.invoiceId}`} className="mt-3 space-y-2 border-l-2 border-cyan-100 pl-3">
                    <p className="flex flex-wrap gap-x-3 text-xs">
                      <NewTabLink to={invoiceLink(claim.invoiceId)} title="Open the invoice">Invoice {claim.invoiceNumber}</NewTabLink>
                      {claim.patientId && <NewTabLink to={patientBillingLink(claim.patientId)} title="Open the patient's file">Patient file</NewTabLink>}
                    </p>
                    {rowKeysOf(claim).map(key => {
                      const line = claim.lines.find(item => lineRowKey(item) === key);
                      const invalid = summary.invalidRows.has(key);
                      const label = line
                        ? `Paid on line ${line.lineNumber} of batch ${line.batchNumber}, code ${line.tariffCode}`
                        : `Paid on invoice ${claim.invoiceNumber} as a whole`;
                      return (
                        <div key={key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
                          <div className="min-w-0 text-xs text-gray-700">
                            {line ? (
                              <>
                                <span className="font-mono font-medium text-gray-900">{line.tariffCode}</span>
                                <span className="text-gray-500"> · {formatServiceDate(line.serviceDate)} · claimed {nad(line.claimedCents)} · </span>
                                <NewTabLink to={claimBatchLink(line.batchId)} title="Open the claim batch">batch {line.batchNumber}, line {line.lineNumber}</NewTabLink>
                                {line.resubmitted && <span className="ml-1 rounded bg-cyan-50 px-1 text-[11px] text-cyan-800">sent again</span>}
                                {line.outcome && (
                                  <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${LINE_OUTCOME_META[line.outcome].chip}`}>
                                    <Icon icon={LINE_OUTCOME_META[line.outcome].icon} className="h-3 w-3" aria-hidden="true" />
                                    earlier: {LINE_OUTCOME_META[line.outcome].label}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-500">No claim lines were sent from OneHealth for this invoice: key what the fund paid on it.</span>
                            )}
                          </div>
                          <div>
                            <label htmlFor={`keyed-${key}`} className="sr-only">{label}</label>
                            <AmountInput
                              id={`keyed-${key}`}
                              value={draft.paid[key] ?? ''}
                              onChange={event => onPaid({ [key]: event.target.value })}
                              placeholder="not keyed"
                              invalid={invalid}
                              disabled={disabled}
                            />
                            {invalid && <p className="mt-1 text-xs text-red-600" role="alert">Enter an amount like 150.00, or 0.00</p>}
                          </div>
                        </div>
                      );
                    })}
                    {(claimSummary?.keyedRows ?? 0) > 0 && (rest > 0 || restOn) && (
                      <label className="flex items-center gap-2 pt-1 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-cyan-600"
                          checked={restOn}
                          onChange={event => onRestToPatient(claim.invoiceId, event.target.checked)}
                          disabled={disabled}
                        />
                        Patient pays the rest: move {nad(rest)} to the patient when this payment is posted
                      </label>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {found.length > visible && (
        <div className="text-center">
          <button type="button" onClick={() => setVisible(count => count + PAGE)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            Show {Math.min(PAGE, found.length - visible)} more of {found.length - visible}
          </button>
        </div>
      )}
    </section>
  );
};
