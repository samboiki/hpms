import React, { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  PORTION_LABELS,
  centsToInput,
  checkAllocation,
  invoiceDateKey,
  openItemKey,
  owedPortions,
  parseAmountInput,
  payerPortions,
  sortOldestFirst,
  suggestAllocation,
  type ArReceipt,
  type OpenItem,
  type Portion
} from '../../../services/ledgerService';
import { identifyFund } from '../../../utils/remittance/funds';
import { allocateReceipt, loadFundOpenClaims, loadPatientAccount } from './arService';
import { AmountInput, ErrorBox, PrimaryButton, SecondaryButton, Sheet, SummaryRow } from './ArUi';
import { formatDay } from './receiptDocuments';

interface Item extends OpenItem {
  key: string;
  patientName?: string;
}

const nad = (cents: number) => formatNad(fromCents(cents));

/**
 * Allocate credit already on a receipt (an overpayment, or a fund's money that could not be
 * matched when it arrived) to open invoices: the patient's invoices for a patient's receipt, the
 * fund's open claims for a fund's receipt. Oldest first, editable.
 */
export const AllocateCreditDialog: React.FC<{
  practiceId: string;
  receipt: ArReceipt;
  payer: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ practiceId, receipt, payer, onClose, onSaved }) => {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lineText, setLineText] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const portions = useMemo<Portion[]>(() => payerPortions(receipt.payerType), [receipt.payerType]);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<Item[]> => {
      if (receipt.patientId) {
        const account = await loadPatientAccount(practiceId, receipt.patientId);
        return account.invoices.flatMap(invoice => {
          const owed = owedPortions(invoice, account.balances[invoice.id]);
          return (['patient', 'medical_aid'] as Portion[])
            .filter(portion => owed[portion] > 0)
            .map(portion => ({
              key: openItemKey({ invoiceId: invoice.id, portion }),
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              dateKey: invoiceDateKey(invoice),
              portion,
              outstandingCents: owed[portion]
            }));
        });
      }
      if (receipt.payerType === 'medical_aid' && receipt.fundName) {
        const { claims } = await loadFundOpenClaims(practiceId);
        // The fund's claims by its code ("PSEMAS" on the receipt is MAG1 on the claims), else by its name
        const fundCode = identifyFund(receipt.fundName)?.code ?? null;
        return claims
          .filter(claim => (fundCode ? claim.fundCode === fundCode : claim.fund.toLowerCase() === receipt.fundName?.toLowerCase()))
          .map(claim => ({
            key: openItemKey({ invoiceId: claim.invoiceId, portion: 'medical_aid' }),
            invoiceId: claim.invoiceId,
            invoiceNumber: claim.invoiceNumber,
            dateKey: claim.dateKey,
            portion: 'medical_aid' as Portion,
            outstandingCents: claim.medicalAidOwedCents,
            patientName: claim.patientName
          }));
      }
      return [];
    };
    load()
      .then(result => { if (!cancelled) setItems(sortOldestFirst(result, portions)); })
      .catch(error => { if (!cancelled) setLoadError(error instanceof Error ? plainWords(error.message) : 'Could not load the open invoices'); });
    return () => { cancelled = true; };
  }, [practiceId, receipt, portions]);

  const credit = Math.max(receipt.unallocatedCents, 0);
  const suggestion = useMemo(() => suggestAllocation(credit, items ?? [], portions), [credit, items, portions]);
  useEffect(() => {
    if (edited) return;
    setLineText(Object.fromEntries(suggestion.lines.map(line => [openItemKey(line), centsToInput(line.amountCents)])));
  }, [edited, suggestion]);

  const parsed = (items ?? []).map(item => {
    const text = lineText[item.key] ?? '';
    return { item, cents: text.trim() === '' ? 0 : parseAmountInput(text) };
  });
  const lines = parsed
    .filter((line): line is { item: Item; cents: number } => line.cents !== null && line.cents > 0)
    .map(line => ({ invoiceId: line.item.invoiceId, portion: line.item.portion, amountCents: line.cents, outstandingCents: line.item.outstandingCents }));
  const invalid = parsed.some(line => line.cents === null);
  const check = checkAllocation(credit, lines);
  const canSave = !saving && !invalid && check.ok && check.allocatedCents > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await allocateReceipt(receipt.id, lines.map(({ invoiceId, portion, amountCents }) => ({ invoiceId, portion, amountCents })));
      onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? plainWords(error.message) : 'The credit could not be allocated');
      setSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title={`Allocate credit from ${receipt.number}`}
      subtitle={`${payer} · ${nad(credit)} unallocated`}
      icon="solar:card-recive-bold-duotone"
      size="lg"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton icon="solar:diskette-bold-duotone" busy={saving} disabled={!canSave} onClick={() => void save()}>
            {saving ? 'Saving...' : `Allocate ${nad(check.allocatedCents)}`}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {loadError && <ErrorBox>{loadError}</ErrorBox>}
        {items === null && !loadError ? (
          <div className="space-y-2" role="status" aria-label="Loading open invoices">
            {[0, 1].map(index => <div key={index} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
          </div>
        ) : items && items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
            {receipt.patientId || receipt.fundName ? 'There are no open invoices to allocate this credit to. It can be refunded instead.' : 'This receipt has no patient or fund to match invoices to.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {parsed.map(({ item, cents }) => {
              const error = cents === null ? 'Enter an amount like 150.00' : check.lineErrors[item.key];
              return (
                <li key={item.key} className="grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-[1fr_9rem_10rem] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      <span className="font-mono text-cyan-700">{item.invoiceNumber}</span>
                      <span className="text-gray-500"> · {formatDay(item.dateKey)}</span>
                    </p>
                    <p className="truncate text-xs text-gray-500">{item.patientName ? `${item.patientName} · ` : ''}{PORTION_LABELS[item.portion]} portion</p>
                  </div>
                  <p className="text-sm text-gray-600 sm:text-right"><span className="sm:hidden">Owed </span><span className="tabular-nums font-medium text-gray-900">{nad(item.outstandingCents)}</span></p>
                  <div>
                    <label className="sr-only" htmlFor={`credit-line-${item.key}`}>Allocate to {item.invoiceNumber}</label>
                    <AmountInput
                      id={`credit-line-${item.key}`}
                      value={lineText[item.key] ?? ''}
                      onChange={event => {
                        setEdited(true);
                        setLineText(previous => ({ ...previous, [item.key]: event.target.value }));
                      }}
                      placeholder="0.00"
                      invalid={!!error}
                      disabled={saving}
                    />
                    {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1">
          <SummaryRow label="Credit on the receipt" value={nad(credit)} />
          <SummaryRow label="Allocated now" value={nad(check.allocatedCents)} />
          <SummaryRow label={check.remainingCents < 0 ? 'Allocated too much' : 'Still unallocated'} value={nad(Math.abs(check.remainingCents))} strong tone={check.remainingCents < 0 ? 'warning' : 'default'} />
        </div>
        {check.error && <ErrorBox>{check.error}</ErrorBox>}
        {saveError && <ErrorBox>{saveError}</ErrorBox>}
      </div>
    </Sheet>
  );
};
