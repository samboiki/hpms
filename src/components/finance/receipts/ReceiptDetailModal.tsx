import React, { useCallback, useEffect, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { invoiceLink, patientBillingLink } from '../../billing/invoiceLinks';
import {
  ADJUSTMENT_LABELS,
  PORTION_LABELS,
  RECEIPT_METHOD_LABELS,
  allocationReversalEffect,
  coverLabelWithPractitioner,
  coverSummary,
  dateKeyFrom,
  isEffective,
  payerLabel,
  receiptReversalEffects,
  type ArAdjustment,
  type ArAllocation,
  type ArReceipt
} from '../../../services/ledgerService';
import { formatTimestamp } from '../financeFormat';
import { loadReceiptEntries, loadStaffNames, reverseAdjustment, reverseAllocation, reverseReceipt, type ReceiptEntries } from './arService';
import { ErrorBox, PrimaryButton, SecondaryButton, Sheet, SummaryRow } from './ArUi';
import { AllocateCreditDialog } from './AllocateCreditDialog';
import { RefundDialog, ReverseEntryDialog } from './RefundAndReverseDialogs';
import { useAuthStore } from '../../../stores/authStore';
import { canCorrectMoney } from '../../../services/ledger/moneyRights';
import { ReceiptShareActions } from './ReceiptShareActions';
import { formatDay, type ReceiptDocument } from './receiptDocuments';

const nad = (cents: number) => formatNad(fromCents(cents));

const SOURCE_LABELS: Record<ArReceipt['source'], string> = {
  manual: 'Recorded in Receive payment',
  batch: 'Medical aid payment (batch)',
  remittance_import: 'Imported from a remittance',
  status_bridge: 'Recorded when the invoice was marked paid',
  legacy_backfill: 'Payment from before receipts were recorded'
};

type Action =
  | { type: 'refund' }
  | { type: 'allocate' }
  | { type: 'reverse_receipt' }
  | { type: 'reverse_allocation'; allocation: ArAllocation }
  | { type: 'reverse_refund'; refund: ArAdjustment };

/**
 * One receipt: what it paid, refunds, who recorded and reversed what, and the actions on it
 * (print or send, allocate its credit, refund, reverse). Every change reloads it.
 */
export const ReceiptDetailModal: React.FC<{
  practiceId: string;
  practiceName: string;
  receipt: ArReceipt;
  patientNames: Record<string, string>;
  onClose: () => void;
  onChanged: () => void;
}> = ({ practiceId, practiceName, receipt: initial, patientNames, onClose, onChanged }) => {
  const [entries, setEntries] = useState<ReceiptEntries | null>(null);
  const [staff, setStaff] = useState<Record<string, string>>({});
  // Until the names are in, a practitioner is not called "Former practitioner"
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  // Refunds and reversals are for administrators only (owner, 13 Oct 2026)
  const mayCorrect = useAuthStore(state => canCorrectMoney(state.user?.role));

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await loadReceiptEntries(initial.id);
      setEntries(result);
      // Staff who took and changed it, and the practitioner of each line it paid (parity H4)
      const ids = [result.receipt?.createdBy ?? null, result.receipt?.reversal?.by ?? null,
        ...result.allocations.flatMap(a => [a.createdBy, a.reversal?.by ?? null, ...(a.covers ?? []).map(cover => cover.practitionerId ?? null)]),
        ...result.refunds.flatMap(r => [r.createdBy, r.reversal?.by ?? null])];
      loadStaffNames(practiceId, ids)
        .then(names => { setStaff(names); setStaffLoaded(true); })
        .catch(() => setStaff({}));
    } catch (loadError) {
      setError(loadError instanceof Error ? plainWords(loadError.message) : 'Could not load the receipt');
    }
  }, [initial.id, practiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const receipt = entries?.receipt ?? initial;
  const payer = payerLabel(receipt, patientNames);
  const who = (id: string | null | undefined) => (id ? staff[id] ?? 'Staff member' : 'The system');
  // Whose work each line paid; nothing until the names are loaded (no practitioner then reads as removed)
  const practitionerName = staffLoaded ? (id: string) => staff[id] ?? null : undefined;
  const invoiceNumber = (invoiceId: string) => entries?.invoices[invoiceId]?.invoiceNumber ?? 'Invoice';

  const changed = (message: string) => {
    toast.success(message);
    setAction(null);
    onChanged();
    void load();
  };

  const effectiveAllocations = (entries?.allocations ?? []).filter(isEffective);
  const document: ReceiptDocument = {
    practiceName,
    receiptNumber: receipt.number,
    receivedOn: receipt.receivedOn ?? '',
    payer,
    patientName: receipt.payerType !== 'patient' && receipt.patientId ? patientNames[receipt.patientId] ?? null : null,
    method: receipt.method,
    amountCents: receipt.amountCents,
    reference: receipt.reference,
    lines: effectiveAllocations.map(a => ({
      invoiceNumber: invoiceNumber(a.invoiceId),
      portion: a.portion,
      amountCents: a.amountCents,
      covers: (a.covers ?? []).map(cover => `${coverLabelWithPractitioner(cover, practitionerName)} ${nad(cover.amountCents)}`)
    })),
    unallocatedCents: receipt.unallocatedCents,
    receivedBy: receipt.createdBy ? who(receipt.createdBy) : null,
    reversed: receipt.reversal ? { on: dateKeyFrom(receipt.reversal.at) ?? '', reason: receipt.reversal.reason } : null
  };
  const reversal = receiptReversalEffects(receipt, entries?.allocations ?? [], entries?.refunds ?? []);
  const reversed = !!receipt.reversal;

  return (
    <>
      <Sheet
        open={action === null}
        onClose={onClose}
        title={`Receipt ${receipt.number}`}
        subtitle={`${payer} · ${formatDay(receipt.receivedOn)} · ${RECEIPT_METHOD_LABELS[receipt.method]}`}
        icon="solar:hand-money-bold-duotone"
        tone={reversed ? 'red' : 'green'}
        size="lg"
        footer={
          <>
            {!reversed && receipt.unallocatedCents > 0 && (
              <>
                <SecondaryButton icon="solar:card-recive-bold-duotone" onClick={() => setAction({ type: 'allocate' })}>Allocate credit</SecondaryButton>
                {mayCorrect && <SecondaryButton icon="solar:card-send-bold-duotone" onClick={() => setAction({ type: 'refund' })}>Refund</SecondaryButton>}
              </>
            )}
            {!reversed && mayCorrect && (
              <SecondaryButton icon="solar:undo-left-round-bold-duotone" onClick={() => setAction({ type: 'reverse_receipt' })} className="text-red-700">
                Reverse receipt
              </SecondaryButton>
            )}
            <PrimaryButton icon="solar:close-circle-bold-duotone" onClick={onClose}>Close</PrimaryButton>
          </>
        }
      >
        <div className="space-y-5">
          {error && <ErrorBox>{error}</ErrorBox>}
          {reversed && receipt.reversal && (
            <ErrorBox>
              Reversed {formatTimestamp(receipt.reversal.at)} by {who(receipt.reversal.by)}: {receipt.reversal.reason}. It no longer counts; the invoices it paid are owed again.
            </ErrorBox>
          )}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-1">
            <SummaryRow label="Received" value={nad(receipt.amountCents)} strong />
            <SummaryRow label="Allocated to invoices" value={nad(receipt.allocatedCents)} />
            {receipt.refundedCents > 0 && <SummaryRow label="Refunded" value={nad(receipt.refundedCents)} />}
            <SummaryRow label="Unallocated credit" value={nad(receipt.unallocatedCents)} tone={receipt.unallocatedCents > 0 ? 'warning' : 'default'} />
          </div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-gray-500">Reference</dt><dd className="text-gray-900">{receipt.reference ?? '—'}</dd></div>
            <div><dt className="text-xs text-gray-500">Recorded</dt><dd className="text-gray-900">{formatTimestamp(receipt.createdAt)} by {who(receipt.createdBy)}</dd></div>
            <div><dt className="text-xs text-gray-500">How it was recorded</dt><dd className="text-gray-900">{SOURCE_LABELS[receipt.source]}</dd></div>
            {receipt.notes && <div><dt className="text-xs text-gray-500">Notes</dt><dd className="text-gray-900 break-words">{receipt.notes}</dd></div>}
            {receipt.patientId && (
              <div>
                <dt className="text-xs text-gray-500">Patient</dt>
                <dd>
                  <Link
                    to={patientBillingLink(receipt.patientId)}
                    onClick={onClose}
                    title="The patient's Billing tab: invoices, payments and statements"
                    className="font-medium text-cyan-700 hover:underline"
                  >
                    {patientNames[receipt.patientId] ?? 'Open the patient file'}
                  </Link>
                </dd>
              </div>
            )}
          </dl>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Paid on</h3>
            {!entries ? (
              <div className="h-12 animate-pulse rounded-lg bg-gray-100" role="status" aria-label="Loading allocations" />
            ) : entries.allocations.length === 0 ? (
              <p className="text-sm text-gray-500">Not allocated to any invoice.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {entries.allocations.map(allocation => (
                  <li key={allocation.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${allocation.reversal ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {/* The invoice it paid, in Finance's invoice view */}
                        <Link to={invoiceLink(allocation.invoiceId)} onClick={onClose} className="font-mono hover:text-cyan-700 hover:underline">
                          {invoiceNumber(allocation.invoiceId)}
                        </Link>{' '}
                        · {PORTION_LABELS[allocation.portion]} portion
                      </p>
                      <p className="text-xs text-gray-500">
                        {allocation.reversal
                          ? `Reversed ${formatTimestamp(allocation.reversal.at)} by ${who(allocation.reversal.by)}: ${allocation.reversal.reason}`
                          : `Allocated ${formatTimestamp(allocation.createdAt)} by ${who(allocation.createdBy)}`}
                      </p>
                      {allocation.covers && allocation.covers.length > 0 && (
                        <p className="text-xs text-gray-600 break-words">Covered {coverSummary(allocation.covers, practitionerName)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold text-gray-900">{nad(allocation.amountCents)}</span>
                      {!allocation.reversal && !reversed && mayCorrect && (
                        <button type="button" className="text-xs font-medium text-red-700 hover:underline" onClick={() => setAction({ type: 'reverse_allocation', allocation })}>
                          Take off
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {entries && entries.refunds.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Refunds</h3>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {entries.refunds.map(refund => (
                  <li key={refund.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${refund.reversal ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {ADJUSTMENT_LABELS.refund} {refund.number}{refund.method ? ` (${RECEIPT_METHOD_LABELS[refund.method].toLowerCase()})` : ''}
                      </p>
                      <p className="text-xs text-gray-500">{refund.reversal ? `Reversed: ${refund.reversal.reason}` : `${formatDay(refund.effectiveOn)} by ${who(refund.createdBy)}: ${refund.reason}`}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold text-gray-900">{nad(refund.amountCents)}</span>
                      {!refund.reversal && mayCorrect && (
                        <button type="button" className="text-xs font-medium text-red-700 hover:underline" onClick={() => setAction({ type: 'reverse_refund', refund })}>
                          Reverse
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Receipt</h3>
            <ReceiptShareActions
              practiceId={practiceId}
              receiptId={receipt.id}
              document={document}
              patientId={receipt.payerType === 'medical_aid' ? null : receipt.patientId}
              invoiceId={new Set(effectiveAllocations.map(a => a.invoiceId)).size === 1 ? effectiveAllocations[0].invoiceId : null}
            />
          </section>
        </div>
      </Sheet>

      {action?.type === 'refund' && (
        <RefundDialog practiceId={practiceId} receipt={receipt} payer={payer} onClose={() => setAction(null)} onSaved={number => changed(`Refund ${number} recorded`)} />
      )}
      {action?.type === 'allocate' && (
        <AllocateCreditDialog practiceId={practiceId} receipt={receipt} payer={payer} onClose={() => setAction(null)} onSaved={() => changed('Credit allocated')} />
      )}
      {action?.type === 'reverse_receipt' && (
        <ReverseEntryDialog
          title={`Reverse receipt ${receipt.number}`}
          blockedBy={reversal.blockedBy}
          effects={
            <div className="space-y-2">
              <p>The receipt of {nad(receipt.amountCents)} no longer counts as money received.</p>
              {reversal.restores.length > 0 && (
                <p>
                  {reversal.restores.map(item => `${invoiceNumber(item.invoiceId)} (${PORTION_LABELS[item.portion].toLowerCase()} ${nad(item.amountCents)})`).join(', ')}
                  {reversal.restores.length === 1 ? ' is' : ' are'} owed again.
                </p>
              )}
              {reversal.creditCents > 0 && <p>The unallocated credit of {nad(reversal.creditCents)} is removed.</p>}
            </div>
          }
          confirmLabel="Reverse receipt"
          onConfirm={async reason => {
            await reverseReceipt(receipt.id, reason);
            changed(`Receipt ${receipt.number} reversed`);
          }}
          onClose={() => setAction(null)}
        />
      )}
      {action?.type === 'reverse_allocation' && (
        <ReverseEntryDialog
          title={`Take ${nad(action.allocation.amountCents)} off ${invoiceNumber(action.allocation.invoiceId)}`}
          effects={(() => {
            const effect = allocationReversalEffect(action.allocation);
            return <p>The {PORTION_LABELS[action.allocation.portion].toLowerCase()} portion of {invoiceNumber(action.allocation.invoiceId)} is owed again, and {nad(effect.creditCents)} goes back to receipt {receipt.number} as credit to allocate elsewhere or refund.</p>;
          })()}
          confirmLabel="Take off invoice"
          onConfirm={async reason => {
            await reverseAllocation(action.allocation.id, reason);
            changed('Allocation reversed');
          }}
          onClose={() => setAction(null)}
        />
      )}
      {action?.type === 'reverse_refund' && (
        <ReverseEntryDialog
          title={`Reverse refund ${action.refund.number}`}
          effects={<p>The refund of {nad(action.refund.amountCents)} is cancelled and the money is credit on receipt {receipt.number} again. Only do this if the money was not paid out, or came back.</p>}
          confirmLabel="Reverse refund"
          onConfirm={async reason => {
            await reverseAdjustment(action.refund.id, reason);
            changed(`Refund ${action.refund.number} reversed`);
          }}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
};
