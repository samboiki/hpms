import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { formatNad } from '../../../utils/billing/money';
import { invoiceLink, patientOverviewLink } from '../../billing/invoiceLinks';
import { addMonthsToKey, formatServiceDate, todayKey } from '../../../utils/billing/dates';
import { checkClaimDeadline, getFundRule } from '../../../utils/billing/fundRules';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { addInvoicesToFundBatch, loadUnbatchedInvoices } from './claimsService';
import type { FundProvider, PracticeInfo, UnbatchedInvoice } from './types';

interface UnbatchedInvoicesProps {
  practice: PracticeInfo;
  funds: FundProvider[];
  /** Called after invoices were added to a batch. */
  onAdded: () => void;
}

const DEADLINE_STYLES: Record<string, string> = {
  ok: 'text-gray-600',
  expiring: 'text-amber-700 font-medium',
  expired: 'text-red-700 font-medium',
  future: 'text-red-700',
  invalid: 'text-gray-400'
};

/**
 * Medical aid invoices from the last 12 months that are in no claim batch. Invoices are normally
 * batched automatically, so these would otherwise never be claimed; staff add them to the fund's
 * open batch here.
 */
const UnbatchedInvoices: React.FC<UnbatchedInvoicesProps> = ({ practice, funds, onAdded }) => {
  const [invoices, setInvoices] = useState<UnbatchedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyFund, setBusyFund] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const today = todayKey();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvoices(await loadUnbatchedInvoices(practice.id, funds, addMonthsToKey(today, -12)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? plainWords(err.message) : 'Could not load the invoices.');
    } finally {
      setLoading(false);
    }
  }, [practice.id, funds, today]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const byFund = new Map<string, UnbatchedInvoice[]>();
    invoices.forEach(invoice => {
      const key = invoice.fundReference ?? '';
      byFund.set(key, [...(byFund.get(key) ?? []), invoice]);
    });
    return [...byFund.entries()].sort(([a], [b]) => (a || 'zzz').localeCompare(b || 'zzz'));
  }, [invoices]);

  const toggle = (invoiceId: string) =>
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });

  const addToBatch = async (fundReference: string, fundName: string, group: UnbatchedInvoice[]) => {
    const ids = group.filter(invoice => selected.has(invoice.invoiceId)).map(invoice => invoice.invoiceId);
    if (ids.length === 0 || busyFund) return;
    if (!window.confirm(`Add ${ids.length} invoice(s) to the open ${fundName} claim batch?`)) return;
    setBusyFund(fundReference);
    setMessage(null);
    try {
      const result = await addInvoicesToFundBatch(practice.id, fundReference, ids);
      const failures = result.failed.map(item => `${group.find(i => i.invoiceId === item.invoiceId)?.invoiceNumber ?? item.invoiceId}: ${item.message}`);
      setMessage(
        `${result.added.length} invoice(s) added to the ${fundName} batch.` + (failures.length > 0 ? ` Not added: ${failures.join('; ')}` : '')
      );
      onAdded();
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? plainWords(err.message) : 'The invoices could not be added.');
    } finally {
      setBusyFund(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <div className="mr-3 h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-600" />
        <span className="text-gray-600">Looking for medical aid invoices that are not in a batch...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
        <p className="mb-2">{error}</p>
        <button type="button" onClick={load} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 hover:bg-red-100">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">{message}</p>}
      {invoices.length === 0 ? (
        <div className="py-10 text-center text-gray-500">
          <Icon icon="solar:check-circle-bold-duotone" className="mx-auto mb-2 h-10 w-10 text-green-500" />
          Every medical aid invoice from the last 12 months is in a claim batch.
        </div>
      ) : (
        groups.map(([fundReference, group]) => {
          const fund = funds.find(item => (item.medical_aid_reference ?? '') === fundReference);
          const fundName = fund?.name ?? group[0].fundName;
          const rule = getFundRule(fundReference, fundName);
          const selectedCount = group.filter(invoice => selected.has(invoice.invoiceId)).length;
          return (
            <div key={fundReference || 'unknown'} className="rounded-xl border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-gray-900">
                    <MedicalAidLogo name={fundName} />
                    {fundName}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {fundReference ? `Fund code ${fundReference}` : "No fund code: check the patients' medical aid records"} - {group.length} invoice(s)
                  </p>
                </div>
                {fundReference && (
                  <button
                    type="button"
                    onClick={() => addToBatch(fundReference, fundName, group)}
                    disabled={selectedCount === 0 || busyFund !== null}
                    className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
                  >
                    <Icon icon="solar:add-folder-bold-duotone" className="h-4 w-4" />
                    {busyFund === fundReference ? 'Adding...' : `Add ${selectedCount} to the ${fundReference} batch`}
                  </button>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="w-10 px-4 py-2" />
                    <th className="px-4 py-2">Invoice</th>
                    <th className="px-4 py-2">Patient</th>
                    <th className="px-4 py-2">Service date</th>
                    <th className="px-4 py-2">Fund deadline</th>
                    <th className="px-4 py-2 text-right">Lines</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.map(invoice => {
                    const deadline = checkClaimDeadline(invoice.serviceDate, today, rule);
                    return (
                      <tr key={invoice.invoiceId}>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(invoice.invoiceId)}
                            disabled={!fundReference || invoice.notClaimableReason !== null}
                            onChange={() => toggle(invoice.invoiceId)}
                            aria-label={`Select invoice ${invoice.invoiceNumber}`}
                            className="h-4 w-4 rounded border-gray-300 text-cyan-600"
                          />
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {/* The invoice in Finance's invoice view: its lines, the patient, the visit */}
                          <Link to={invoiceLink(invoice.invoiceId)} className="hover:text-cyan-700 hover:underline">
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {invoice.patientName}
                          {/* No batch can take it until the patient's file names a fund again: say so, and where to fix it */}
                          {invoice.notClaimableReason && (
                            <p className="mt-0.5 text-xs text-amber-700">
                              {invoice.notClaimableReason}.{' '}
                              <Link to={patientOverviewLink(invoice.patientId)} className="font-medium text-cyan-700 hover:underline">
                                Open the patient&apos;s file
                              </Link>
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{formatServiceDate(invoice.serviceDate)}</td>
                        <td className={`px-4 py-2 text-xs ${DEADLINE_STYLES[deadline.status]}`}>
                          {deadline.status === 'expired'
                            ? `Expired ${formatServiceDate(deadline.lastDay)}`
                            : deadline.status === 'invalid'
                              ? 'Unknown'
                              : `By ${formatServiceDate(deadline.lastDay)}${deadline.daysLeft !== null ? ` (${deadline.daysLeft} days)` : ''}`}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">{invoice.lineCount}</td>
                        <td className="px-4 py-2 text-right text-gray-900">{formatNad(invoice.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
};

export default UnbatchedInvoices;
