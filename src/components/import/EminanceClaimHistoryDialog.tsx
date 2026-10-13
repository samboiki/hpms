import React, { useEffect, useId, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Icon } from '@iconify/react';
import { loadLegacyClaimLines, type LegacyClaimLine } from '../../services/import/eminanceImportService';
import { formatServiceDate } from '../../utils/billing/dates';
import { nad } from './importText';

/**
 * The claim history brought over from Eminance, read-only. A dialog of its own above the patient file (which is itself
 * a full-screen layer), closed with Escape or the close button. Opened from the patient file's numbers
 * (src/components/patients/PatientFileNumbers.tsx).
 */
export const EminanceClaimHistoryDialog: React.FC<{ patientId: string; accountNumber: string | null; onClose: () => void }> = ({ patientId, accountNumber, onClose }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<LegacyClaimLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLegacyClaimLines(patientId)
      .then(result => { if (!cancelled) setLines(result); })
      .catch(caught => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not read the claim history'); });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={event => event.stopPropagation()}
        className="flex max-h-[100dvh] w-full flex-col rounded-t-2xl bg-white text-gray-900 shadow-xl focus:outline-none sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
          <div className="flex-none rounded-lg bg-cyan-100 p-2 text-cyan-700">
            <Icon icon="solar:history-bold-duotone" className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold leading-snug">Claim history from Eminance</h2>
            <p className="text-sm text-gray-500">
              {accountNumber ? `Eminance account ${accountNumber}. ` : ''}Medical aid claims only, as sent from Eminance; read-only.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" aria-label="Close">
            <Icon icon="solar:close-circle-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {error ? (
            <p className="text-sm text-red-700" role="alert">{error}</p>
          ) : !lines ? (
            <p className="text-sm text-gray-500" role="status">Loading...</p>
          ) : lines.length === 0 ? (
            <p className="text-sm text-gray-600">No claim history was brought over for this patient.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Claim lines brought over from Eminance, newest first</caption>
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="py-2 pr-3">Date</th>
                  <th scope="col" className="py-2 pr-3">Code</th>
                  <th scope="col" className="hidden py-2 pr-3 sm:table-cell">Description</th>
                  <th scope="col" className="py-2 pr-3 text-right">Amount</th>
                  <th scope="col" className="hidden py-2 md:table-cell">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map(line => (
                  <tr key={line.id} className="align-top">
                    <td className="whitespace-nowrap py-2 pr-3">{formatServiceDate(line.serviceDate)}</td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{line.tariffCode}</span>
                      {line.quantity !== 1 && <span className="text-gray-500"> x{line.quantity}</span>}
                      {line.tooth && <span className="block text-xs text-gray-500">Tooth {line.tooth}</span>}
                      <span className="block text-xs text-gray-500 sm:hidden">{line.description}</span>
                    </td>
                    <td className="hidden py-2 pr-3 sm:table-cell">
                      {line.description}
                      {line.diagnosis && <span className="block text-xs text-gray-500">Diagnosis {line.diagnosis}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{nad(line.amountCents)}</td>
                    <td className="hidden py-2 text-gray-600 md:table-cell">{[line.invoiceNumber, line.fundCode].filter(Boolean).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EminanceClaimHistoryDialog;
