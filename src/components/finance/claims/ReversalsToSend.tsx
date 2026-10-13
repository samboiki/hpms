import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { formatNad, fromCents, sumCents } from '../../../utils/billing/money';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { claimBatchLink, invoiceLink } from '../../billing/invoiceLinks';
import { loadReversals, makeCreditFile, type ReversalRow } from './claimCorrectionsService';

interface ReversalsToSendProps {
  practiceId: string;
  /** Fund name by claim-file reference (MAG1, NMC1 ...) */
  fundNameOf: (reference: string) => string;
  /** A credit file was made: open it to review and send it */
  onMade: (batchId: string | null) => void;
  /** Changes when the claims reload, so the list follows */
  reloadKey: number;
}

const nad = (cents: number) => formatNad(fromCents(cents));

/**
 * Reversals waiting to go to a fund (parity F16): medical-aid credits on lines the fund was already sent. Per fund,
 * "Put in a credit file" puts them in its credit file (a batch with header transaction type C), which is then reviewed
 * and sent from here like any batch, with the fund's next claims.
 */
const ReversalsToSend: React.FC<ReversalsToSendProps> = ({ practiceId, fundNameOf, onMade, reloadKey }) => {
  const [rows, setRows] = useState<ReversalRow[] | null>(null);
  const [busyFund, setBusyFund] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await loadReversals({ practiceQueued: practiceId }));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? plainWords(loadError.message) : 'The reversals could not be loaded');
    }
  }, [practiceId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const byFund = useMemo(() => {
    const groups = new Map<string, ReversalRow[]>();
    (rows ?? []).forEach(row => {
      const key = row.fundReference.toUpperCase();
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
    return [...groups.entries()];
  }, [rows]);

  const make = async (fund: string) => {
    setBusyFund(fund);
    try {
      const result = await makeCreditFile(practiceId, fund);
      toast.success(result.batchId ? `Credit file ${result.batchNumber ?? ''} is ready to send to ${fundNameOf(fund)}` : 'Nothing was left to send');
      await load();
      onMade(result.batchId);
    } catch (makeError) {
      toast.error(makeError instanceof Error ? plainWords(makeError.message) : 'The credit file could not be made');
    } finally {
      setBusyFund(null);
    }
  };

  if (error) return <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p>;
  if (!rows || byFund.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="reversals-title">
      <h3 id="reversals-title" className="flex items-center gap-2 font-semibold text-gray-900">
        <Icon icon="solar:document-add-bold-duotone" className="h-5 w-5 text-violet-600" aria-hidden="true" />
        Reversals to send
      </h3>
      <p className="text-sm text-gray-600">
        Credit notes on lines the medical aid was already sent. They go to the fund in a credit file of their own (the claim
        layout carries credits in a separate file), best together with its next claims.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {byFund.map(([fund, items]) => {
          const name = fundNameOf(fund);
          return (
            <div key={fund} className="flex flex-col rounded-xl border border-violet-200 bg-violet-50/40 p-4">
              <div className="mb-3 flex items-center gap-3">
                <MedicalAidLogo name={name} size="md" />
                <div>
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className="text-xs text-gray-600">
                    {items.length} {items.length === 1 ? 'reversal' : 'reversals'}, {nad(sumCents(items.map(item => item.amountCents)))}
                  </p>
                </div>
              </div>
              <ul className="mb-3 space-y-1 text-sm">
                {items.map(item => (
                  <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="min-w-0 text-gray-700">
                      <span className="font-mono">{item.lineCode}</span>{' '}
                      <Link to={invoiceLink(item.invoiceId)} className="text-cyan-700 hover:underline">{item.creditNoteNumber}</Link>
                      {' · sent in '}
                      <Link to={claimBatchLink(item.claimBatchId)} className="text-cyan-700 hover:underline">batch {item.claimBatchNumber ?? ''}</Link>
                    </span>
                    <span className="tabular-nums text-gray-900">{nad(item.amountCents)}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void make(fund)}
                disabled={busyFund !== null}
                className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                <Icon icon="solar:document-add-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                {busyFund === fund ? 'Making the credit file...' : 'Put in a credit file'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ReversalsToSend;
