import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { formatNad, fromCents, sumCents } from '../../../utils/billing/money';
import { formatServiceDate } from '../../../utils/billing/dates';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { invoiceLink, patientBillingLink } from '../../billing/invoiceLinks';
import { describeSilentFundDays, type SilentFundDays } from './batchFollowUp';
import { unpaidLines, type UnpaidLine } from './claimCorrections';
import { loadUnpaidLineSources, resendClaimLines, type UnpaidLineSources } from './claimCorrectionsService';
import type { BatchHeaderRow } from './types';

interface UnpaidClaimLinesProps {
  practiceId: string;
  batches: readonly BatchHeaderRow[];
  settings: SilentFundDays;
  today: string;
  fundNameOf: (fundCode: string) => string;
  /** Opens a batch's review (where a line can be corrected and sent again) */
  onOpenBatch: (batchId: string) => void;
  /** Lines were sent again: reload the batches */
  onChanged: () => void;
}

const nad = (cents: number) => formatNad(fromCents(cents));

/**
 * Sent claim lines a fund has not paid after the wait set for it (parity F9; 30 days, PSEMAS 60, changed beside "Funds
 * that have not answered"). Tick the lines and send them again: each goes into its fund's open batch with
 * resubmission flag R (claim field 32), never twice in one open batch. A line that needs a correction first is
 * corrected from its batch ("Correct and send again").
 */
const UnpaidClaimLines: React.FC<UnpaidClaimLinesProps> = ({ practiceId, batches, settings, today, fundNameOf, onOpenBatch, onChanged }) => {
  const [sources, setSources] = useState<UnpaidLineSources | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSources(await loadUnpaidLineSources(practiceId, batches));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The sent claim lines could not be loaded');
    }
  }, [practiceId, batches]);

  useEffect(() => {
    void load();
  }, [load]);

  const lines = useMemo(() => (sources ? unpaidLines({ ...sources, settings, today }) : []), [sources, settings, today]);
  const byFund = useMemo(() => {
    const groups = new Map<string, UnpaidLine[]>();
    lines.forEach(line => groups.set(line.fundCode, [...(groups.get(line.fundCode) ?? []), line]));
    return [...groups.entries()];
  }, [lines]);
  const selectable = lines.filter(line => line.blocker === null);

  const toggle = (id: string) =>
    setChosen(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const send = async () => {
    const ids = selectable.filter(line => chosen.has(line.line.id)).map(line => line.line.id);
    if (ids.length === 0 || sending) return;
    if (!window.confirm(`Send ${ids.length} line(s) to the fund again with resubmission flag R? Each goes into its fund's open batch and is sent with it.`)) return;
    setSending(true);
    setOutcome(null);
    try {
      const result = await resendClaimLines(ids, null);
      const batchNumbers = [...new Set(result.resent.map(row => row.batchNumber).filter((number): number is number => number !== null))];
      toast.success(`${result.resent.length} line(s) wait in batch ${batchNumbers.join(', ')} to go to the fund again`);
      setOutcome(result.skipped.length > 0 ? `Not sent again: ${result.skipped.map(row => row.reason).join('; ')}.` : null);
      setChosen(new Set());
      onChanged();
    } catch (sendError) {
      setOutcome(sendError instanceof Error ? sendError.message : 'The lines could not be sent again');
    } finally {
      setSending(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
        <p className="mb-2">{error}</p>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 hover:bg-red-100">Retry</button>
      </div>
    );
  }
  if (!sources) {
    return <div className="h-24 animate-pulse rounded-xl bg-gray-100" role="status" aria-label="Loading the unpaid lines" />;
  }

  const chosenCount = selectable.filter(line => chosen.has(line.line.id)).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Claim lines the fund has neither paid nor refused. {describeSilentFundDays(settings, fundNameOf)} Refused lines are in Remittances &gt; Rejections, with the fund&apos;s reason.
      </p>
      {!sources.correctionsReady && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Claim corrections are not set up in this database yet (proposals/2026-10-09-claim-corrections.sql): lines cannot be sent again from here.
        </p>
      )}
      {sources.medicalAidOwed === null && (
        <p className="text-xs text-gray-500">What the funds still owe could not be read, so lines of invoices paid another way may show too.</p>
      )}
      {outcome && <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">{outcome}</p>}

      {lines.length === 0 ? (
        <div className="py-10 text-center text-gray-500">
          <Icon icon="solar:check-circle-bold-duotone" className="mx-auto mb-2 h-10 w-10 text-gray-300" aria-hidden="true" />
          No sent line has waited longer than its fund's wait without being paid.
        </div>
      ) : (
        byFund.map(([fund, items]) => {
          const name = fundNameOf(fund);
          const open = items.filter(item => item.blocker === null);
          const allChosen = open.length > 0 && open.every(item => chosen.has(item.line.id));
          return (
            <section key={fund} className="rounded-xl border border-gray-200" aria-label={`Unpaid lines of ${name}`}>
              <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-3 py-2">
                <MedicalAidLogo name={name} />
                <span className="font-medium text-gray-900">{name}</span>
                <span className="text-sm text-gray-600">{items.length} line(s), {nad(sumCents(items.map(item => item.line.amountCents)))}</span>
                {open.length > 0 && (
                  <button
                    type="button"
                    className="ml-auto text-xs font-medium text-cyan-700 hover:underline"
                    onClick={() => setChosen(previous => {
                      const next = new Set(previous);
                      open.forEach(item => (allChosen ? next.delete(item.line.id) : next.add(item.line.id)));
                      return next;
                    })}
                  >
                    {allChosen ? 'Clear' : 'Choose all'}
                  </button>
                )}
              </div>
              <ul className="divide-y divide-gray-100">
                {items.map(item => {
                  const id = `unpaid-${item.line.id}`;
                  return (
                    <li key={item.line.id} className="flex flex-wrap items-start gap-3 px-3 py-2 text-sm">
                      <input
                        id={id}
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-600 disabled:opacity-40"
                        checked={chosen.has(item.line.id)}
                        disabled={item.blocker !== null || sending || !sources.correctionsReady}
                        onChange={() => toggle(item.line.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={id} className="block font-medium text-gray-900">
                          <span className="font-mono">{item.line.tariffCode}</span> {item.line.patientName || 'Patient'} · {formatServiceDate(item.line.serviceDate)}
                        </label>
                        <p className="flex flex-wrap gap-x-3 text-xs text-gray-600">
                          <button type="button" onClick={() => onOpenBatch(item.batch.id)} className="font-medium text-cyan-700 hover:underline">
                            Batch {item.batch.batch_number}, line {item.line.lineNumber}
                          </button>
                          <span>sent {item.daysSinceSent} days ago{item.outcome === 'waiting' ? ', pended by the fund' : ', no answer'}</span>
                          {item.line.invoiceId && <Link to={invoiceLink(item.line.invoiceId)} className="text-cyan-700 hover:underline">Invoice {item.line.invoiceNumber}</Link>}
                          {item.line.patientId && <Link to={patientBillingLink(item.line.patientId)} className="text-cyan-700 hover:underline">Patient</Link>}
                        </p>
                        {item.blocker && <p className="text-xs text-amber-800">{item.blocker}</p>}
                      </div>
                      <span className="tabular-nums text-gray-900">{nad(item.line.amountCents)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {selectable.length > 0 && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm">
          <span className="text-sm text-gray-600">{chosenCount} chosen</span>
          <button
            type="button"
            onClick={() => void send()}
            disabled={chosenCount === 0 || sending}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            <Icon icon="solar:restart-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            {sending ? 'Sending again...' : `Send again (${chosenCount})`}
          </button>
        </div>
      )}
    </div>
  );
};

export default UnpaidClaimLines;
