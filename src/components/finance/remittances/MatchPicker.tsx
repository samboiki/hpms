import React, { useMemo, useState } from 'react';
import type { ClaimCandidate, VisitGroup } from '../../../utils/remittance/matching';
import { inputClass, SecondaryButton, Sheet } from '../receipts/ArUi';
import { formatDateKey, nad } from './remittanceUi';

interface MatchPickerProps {
  group: VisitGroup;
  candidates: readonly ClaimCandidate[];
  onClose: () => void;
  /** An invoice, or null to leave the visit unmatched (its money stays as credit) */
  onChoose: (invoiceId: string | null) => void;
  /** Back to the system's own suggestion */
  onReset: () => void;
}

interface InvoiceOption {
  invoiceId: string;
  invoiceNumber: string;
  patientName: string;
  serviceDate: string | null;
  claimedCents: number;
}

/** Choose the invoice a visit on the remittance belongs to: the suggestions first, or search */
export const MatchPicker: React.FC<MatchPickerProps> = ({ group, candidates, onClose, onChoose, onReset }) => {
  const [search, setSearch] = useState('');
  const invoices = useMemo(() => {
    const byId = new Map<string, InvoiceOption>();
    for (const candidate of candidates) {
      if (!candidate.invoiceId) continue;
      const option = byId.get(candidate.invoiceId) ?? { invoiceId: candidate.invoiceId, invoiceNumber: candidate.invoiceNumber, patientName: candidate.patientName, serviceDate: candidate.serviceDate, claimedCents: 0 };
      option.claimedCents += candidate.amountCents;
      byId.set(candidate.invoiceId, option);
    }
    return [...byId.values()];
  }, [candidates]);

  const term = search.trim().toLowerCase();
  const found = term.length >= 2
    ? invoices.filter(option => option.invoiceNumber.toLowerCase().includes(term) || option.patientName.toLowerCase().includes(term)).slice(0, 20)
    : [];

  const row = (option: InvoiceOption, hint?: string) => (
    <li key={option.invoiceId}>
      <button
        type="button"
        onClick={() => onChoose(option.invoiceId)}
        className={`flex w-full flex-col gap-0.5 rounded-lg border p-3 text-left hover:border-cyan-300 hover:bg-cyan-50/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${group.invoiceId === option.invoiceId ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200'}`}
      >
        <span className="font-medium text-gray-900">Invoice {option.invoiceNumber}</span>
        <span className="text-sm text-gray-600">{option.patientName} · {formatDateKey(option.serviceDate)} · claimed {nad(option.claimedCents)}</span>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </button>
    </li>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title="Choose the invoice"
      subtitle={`${group.label.patientName ?? 'Patient not named'} · ${formatDateKey(group.label.serviceDate)}${group.label.reference ? ` · ref ${group.label.reference}` : ''}`}
      icon="solar:link-round-angle-bold-duotone"
      footer={(
        <>
          <SecondaryButton onClick={onReset} icon="solar:restart-bold-duotone">Use the suggestion</SecondaryButton>
          <SecondaryButton onClick={() => onChoose(null)} icon="solar:link-broken-bold-duotone">Leave unmatched</SecondaryButton>
        </>
      )}
    >
      <p className="mb-3 text-sm text-gray-600">Choosing an invoice counts as checking the match: its lines are then posted to that invoice.</p>
      {group.options.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">Suggested</h3>
          <ul className="mb-4 space-y-2">
            {group.options.map(option => row({ invoiceId: option.invoiceId, invoiceNumber: option.invoiceNumber, patientName: option.patientName, serviceDate: option.serviceDate, claimedCents: option.claimedCents }))}
          </ul>
        </>
      )}
      <label htmlFor="match-search" className="mb-1 block text-sm font-medium text-gray-700">Find another invoice of this fund</label>
      <input id="match-search" className={inputClass} placeholder="Invoice number or patient name" value={search} onChange={event => setSearch(event.target.value)} />
      {term.length >= 2 && (
        found.length === 0
          ? <p className="mt-3 text-sm text-gray-500">No claimed invoice of this fund around these dates matches.</p>
          : <ul className="mt-3 space-y-2">{found.map(option => row(option))}</ul>
      )}
    </Sheet>
  );
};
