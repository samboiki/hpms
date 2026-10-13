import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  ADJUSTMENT_LABELS,
  PORTION_LABELS,
  RECEIPT_METHOD_LABELS,
  adjustmentReversalEffect,
  billedPortions,
  canApproveWriteOffs,
  canGiveDiscounts,
  checkAdjustmentReversal,
  coverSummary,
  discountBaseCents,
  discountReasonText,
  discountedPortions,
  payerLabel,
  percentText,
  writeOffReasonLabel,
  type ArAdjustment,
  type ArAllocation,
  type ArReceipt,
  type InvoiceAdjustmentKind,
  type LedgerInvoice,
  type PortionCents
} from '../../../services/ledgerService';
import { formatTimestamp } from '../financeFormat';
import { ActionButton, Notice } from '../FinanceUI';
import { loadInvoiceEntries, loadStaffNames, reverseAdjustment, reverseAllocation, type InvoiceEntries } from './arService';
import { AdjustmentDialog } from './AdjustmentDialog';
import { DiscountDialog } from './DiscountDialog';
import { loadInvoiceDiscounts } from '../../../services/discountService';
import { CreditNoteLinesDialog } from './CreditNoteLinesDialog';
import { CreditNoteEntry } from './CreditNoteEntry';
import { loadCreditNoteDetails, type CreditNoteDetail } from './creditNoteService';
import { ReceivePaymentDialog } from './ReceivePaymentDialog';
import { ReceiptDetailModal } from './ReceiptDetailModal';
import { ReverseEntryDialog } from './RefundAndReverseDialogs';
import { formatDay } from './receiptDocuments';

const nad = (cents: number) => formatNad(fromCents(cents));

export interface InvoiceLedgerPanelProps {
  practiceId: string;
  practiceName: string;
  invoice: LedgerInvoice;
  patientName: string;
  patientNames: Record<string, string>;
  role: string | null;
  staffName: string | null;
  /** Something was saved: refresh Finance */
  onChanged: () => void;
}

type Action =
  | { type: 'pay' }
  | { type: 'credit_lines' }
  | { type: 'discount' }
  | { type: 'adjust'; kind: InvoiceAdjustmentKind }
  | { type: 'reverse_adjustment'; adjustment: ArAdjustment }
  | { type: 'reverse_allocation'; allocation: ArAllocation };

/**
 * An invoice's account: what each portion was billed, received, credited or written off and still
 * owes; every receipt and adjustment on it (with who and when); and the actions: receive payment,
 * credit note, write-off, correction, shortfall to the patient, reversals.
 */
export const InvoiceLedgerPanel: React.FC<InvoiceLedgerPanelProps> = ({ practiceId, practiceName, invoice, patientName, patientNames, role, staffName, onChanged }) => {
  const [entries, setEntries] = useState<InvoiceEntries | null>(null);
  const [staff, setStaff] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  // The lines and reversals of the invoice's credit notes (null before credit notes per line are set up)
  const [creditDetails, setCreditDetails] = useState<Map<string, CreditNoteDetail> | null>(null);
  // The percentage each discount was given as (by adjustment id), shown with it
  const [discountPercents, setDiscountPercents] = useState<Record<string, number | null>>({});
  // A payment on this invoice, opened to reprint, share, allocate its credit or see what else it paid
  const [openReceipt, setOpenReceipt] = useState<ArReceipt | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await loadInvoiceEntries(invoice.id);
      setEntries(result);
      loadCreditNoteDetails(invoice.id).then(setCreditDetails).catch(() => setCreditDetails(null));
      loadInvoiceDiscounts(invoice.id).then(rows => setDiscountPercents(Object.fromEntries(rows.map(row => [row.id, row.percent ?? null])))).catch(() => setDiscountPercents({}));
      loadStaffNames(practiceId, [
        ...result.allocations.flatMap(a => [a.createdBy, a.reversal?.by ?? null]),
        ...result.adjustments.flatMap(d => [d.createdBy, d.approvedBy, d.reversal?.by ?? null])
      ]).then(setStaff).catch(() => setStaff({}));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the payments on this invoice');
    }
  }, [invoice.id, practiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = (message: string) => {
    toast.success(message);
    setAction(null);
    onChanged();
    void load();
  };

  const balance = entries?.balance ?? null;
  // Before any entry, the invoice still follows its status (an invoice marked paid owes nothing)
  const owes: PortionCents = balance && balance.hasEntries
    ? balance.outstanding
    : invoice.status === 'paid' || invoice.status === 'cancelled' ? { medical_aid: 0, patient: 0 } : billedPortions(invoice);
  const billed = balance?.billed ?? billedPortions(invoice);
  const who = (id: string | null | undefined) => (id ? staff[id] ?? 'Staff member' : 'The system');
  const isCancelled = invoice.status === 'cancelled';
  const anyOwed = Math.max(owes.medical_aid, 0) + Math.max(owes.patient, 0) > 0;
  // Standing discounts (the patient's portion only) and what a percentage is of: what the patient was charged here
  const discounted = discountedPortions(entries?.adjustments ?? []);
  const discountBase = discountBaseCents({ billed, shortfallCents: balance?.shortfallCents ?? 0 });

  const rows: Array<{ label: string; medicalAid: number; patient: number; strong?: boolean }> = [
    { label: 'Billed', medicalAid: billed.medical_aid, patient: billed.patient },
    ...(balance && balance.shortfallCents > 0 ? [{ label: 'Shortfall moved to patient', medicalAid: -balance.shortfallCents, patient: balance.shortfallCents }] : []),
    ...(balance && (balance.journals.medical_aid !== 0 || balance.journals.patient !== 0) ? [{ label: 'Corrections', medicalAid: balance.journals.medical_aid, patient: balance.journals.patient }] : []),
    { label: 'Received', medicalAid: -(balance?.allocated.medical_aid ?? 0), patient: -(balance?.allocated.patient ?? 0) },
    ...(balance && (balance.credited.medical_aid + balance.credited.patient > 0) ? [{ label: 'Credit notes', medicalAid: -balance.credited.medical_aid, patient: -balance.credited.patient }] : []),
    ...(discounted.medical_aid + discounted.patient > 0 ? [{ label: 'Discounts', medicalAid: -discounted.medical_aid, patient: -discounted.patient }] : []),
    ...(balance && (balance.writtenOff.medical_aid + balance.writtenOff.patient > 0) ? [{ label: 'Written off', medicalAid: -balance.writtenOff.medical_aid, patient: -balance.writtenOff.patient }] : []),
    { label: 'Still owed', medicalAid: owes.medical_aid, patient: owes.patient, strong: true }
  ];

  // covered: what a payment paid on this invoice, line by line; creditNoteId: a credit note (its lines, reversals, PDF)
  type Entry = { key: string; when: string; title: string; detail: string; covered?: string; creditNoteId?: string; receipt?: ArReceipt; amountCents: number; reversed: boolean; onReverse?: () => void };
  const entryList: Entry[] = [
    ...(entries?.allocations ?? []).map(allocation => {
      const receipt = entries?.receipts[allocation.receiptId];
      return {
        key: allocation.id,
        when: allocation.createdAt ?? '',
        title: `Receipt ${receipt?.number ?? ''} · ${PORTION_LABELS[allocation.portion]} portion`,
        detail: allocation.reversal
          ? `Reversed ${formatTimestamp(allocation.reversal.at)} by ${who(allocation.reversal.by)}: ${allocation.reversal.reason}`
          : `${receipt ? `${payerLabel(receipt, patientNames)}, ${RECEIPT_METHOD_LABELS[receipt.method].toLowerCase()}, ${formatDay(receipt.receivedOn)}` : ''} · by ${who(allocation.createdBy)}`,
        covered: allocation.covers && allocation.covers.length > 0 ? `Covered ${coverSummary(allocation.covers)}` : undefined,
        receipt,
        amountCents: allocation.amountCents,
        reversed: !!allocation.reversal || !!receipt?.reversal,
        onReverse: allocation.reversal || receipt?.reversal ? undefined : () => setAction({ type: 'reverse_allocation', allocation })
      };
    }),
    ...(entries?.adjustments ?? []).map(adjustment => ({
      key: adjustment.id,
      when: adjustment.createdAt ?? '',
      title: `${ADJUSTMENT_LABELS[adjustment.kind]} ${adjustment.number}${adjustment.portion && adjustment.kind !== 'shortfall_transfer' ? ` · ${PORTION_LABELS[adjustment.portion]} portion` : ''}`,
      detail: adjustment.reversal
        ? `Reversed ${formatTimestamp(adjustment.reversal.at)} by ${who(adjustment.reversal.by)}: ${adjustment.reversal.reason}`
        : adjustment.kind === 'discount'
          // A discount: when, how much of what the patient was charged, why, and who gave it
          ? [
              formatDay(adjustment.effectiveOn),
              typeof discountPercents[adjustment.id] === 'number' ? percentText(discountPercents[adjustment.id] as number) : null,
              discountReasonText(adjustment),
              `given by ${who(adjustment.createdBy)}`
            ].filter(Boolean).join(' · ')
          : [
            formatDay(adjustment.effectiveOn),
            adjustment.kind === 'write_off' ? writeOffReasonLabel(adjustment.reasonCode) : null,
            adjustment.reason,
            `by ${who(adjustment.createdBy)}`,
            adjustment.approvedBy ? `approved by ${who(adjustment.approvedBy)}` : null
          ].filter(Boolean).join(' · '),
      creditNoteId: adjustment.kind === 'credit_note' ? adjustment.id : undefined,
      amountCents: adjustment.amountCents,
      reversed: !!adjustment.reversal,
      onReverse: adjustment.reversal ? undefined : () => setAction({ type: 'reverse_adjustment', adjustment })
    }))
  ].sort((a, b) => a.when.localeCompare(b.when));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">Payments and adjustments</h3>
        {!isCancelled && (
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="primary" icon="solar:hand-money-bold-duotone" label="Receive payment" onClick={() => setAction({ type: 'pay' })} disabled={!anyOwed} />
            <ActionButton icon="solar:document-add-bold-duotone" label="Credit note" onClick={() => setAction({ type: 'credit_lines' })} disabled={!anyOwed || !entries} />
            <ActionButton
              icon="solar:sale-bold-duotone"
              label="Discount"
              onClick={() => setAction({ type: 'discount' })}
              disabled={owes.patient <= 0 || !entries || !canGiveDiscounts(role)}
              title={!canGiveDiscounts(role) ? 'Only a practice administrator or practitioner can give a discount' : owes.patient <= 0 ? 'The patient owes nothing on this invoice: a discount comes off what the patient pays' : 'Discount'}
            />
            <ActionButton icon="solar:transfer-horizontal-bold-duotone" label="Shortfall to patient" onClick={() => setAction({ type: 'adjust', kind: 'shortfall_transfer' })} disabled={owes.medical_aid <= 0 || !entries} />
            <ActionButton
              icon="solar:bill-cross-bold-duotone"
              label="Write off"
              onClick={() => setAction({ type: 'adjust', kind: 'write_off' })}
              disabled={!anyOwed || !entries || !canApproveWriteOffs(role)}
              title={canApproveWriteOffs(role) ? 'Write off' : 'Only a practice admin or doctor can approve a write-off'}
            />
            <ActionButton icon="solar:pen-new-square-bold-duotone" label="Correction" onClick={() => setAction({ type: 'adjust', kind: 'journal' })} disabled={!entries} />
          </div>
        )}
      </div>

      {error && <Notice tone="error" title="Payments could not be loaded" action={<ActionButton icon="solar:refresh-bold-duotone" label="Retry" onClick={() => void load()} />}>{error}</Notice>}

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium"><span className="sr-only">Line</span></th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Medical aid</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Patient</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => (
              <tr key={row.label} className={row.strong ? 'bg-gray-50 font-semibold text-gray-900' : 'text-gray-700'}>
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{nad(row.medicalAid)}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{nad(row.patient)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {balance && !balance.hasEntries && invoice.status === 'paid' && (
        <p className="text-xs text-gray-500">Marked paid before receipts were recorded: it counts as paid in full.</p>
      )}

      {entries === null && !error ? (
        <div className="h-12 animate-pulse rounded-lg bg-gray-100" role="status" aria-label="Loading payments" />
      ) : entryList.length === 0 ? (
        <p className="text-sm text-gray-500">No receipts or adjustments on this invoice yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {entryList.map(entry => (
            <li key={entry.key} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${entry.reversed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{entry.title}</p>
                <p className="text-xs text-gray-500 break-words">{entry.detail}</p>
                {entry.covered && <p className="text-xs text-gray-600 break-words">{entry.covered}</p>}
                {entry.creditNoteId && <CreditNoteEntry adjustmentId={entry.creditNoteId} detail={creditDetails?.get(entry.creditNoteId) ?? null} />}
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-sm font-semibold text-gray-900">{nad(entry.amountCents)}</span>
                {entry.receipt && (
                  <button type="button" onClick={() => setOpenReceipt(entry.receipt ?? null)} className="text-xs font-medium text-cyan-700 hover:underline">
                    Open receipt
                  </button>
                )}
                {entry.onReverse && (
                  <button type="button" onClick={entry.onReverse} className="text-xs font-medium text-red-700 hover:underline">Reverse</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {openReceipt && (
        <ReceiptDetailModal
          practiceId={practiceId}
          practiceName={practiceName}
          receipt={openReceipt}
          patientNames={patientNames}
          onClose={() => setOpenReceipt(null)}
          onChanged={() => {
            onChanged();
            void load();
          }}
        />
      )}

      {action?.type === 'pay' && (
        <ReceivePaymentDialog
          practiceId={practiceId}
          practiceName={practiceName}
          staffName={staffName}
          initialPayer="patient"
          initialPatient={invoice.patientId ? { id: invoice.patientId, name: patientName } : null}
          focusInvoiceId={invoice.id}
          onClose={() => setAction(null)}
          onSaved={() => {
            onChanged();
            void load();
          }}
        />
      )}
      {action?.type === 'credit_lines' && (
        <CreditNoteLinesDialog
          practiceId={practiceId}
          invoice={{ id: invoice.id, invoiceNumber: invoice.invoiceNumber, patientName }}
          onClose={() => setAction(null)}
          onUseAmount={() => setAction({ type: 'adjust', kind: 'credit_note' })}
          onSaved={(notes, reversals) =>
            changed(`Credit note ${notes.map(note => note.number).join(' and ')} saved${reversals > 0 ? `; ${reversals} reversal(s) wait in Claims for the fund` : ''}`)}
        />
      )}
      {action?.type === 'discount' && (
        <DiscountDialog
          practiceId={practiceId}
          invoice={{ id: invoice.id, invoiceNumber: invoice.invoiceNumber, patientName }}
          outstanding={owes}
          baseCents={discountBase}
          role={role}
          staffName={staffName}
          onClose={() => setAction(null)}
          onSaved={number => changed(`Discount ${number} saved`)}
        />
      )}
      {action?.type === 'adjust' && (
        <AdjustmentDialog
          practiceId={practiceId}
          kind={action.kind}
          invoice={{ id: invoice.id, invoiceNumber: invoice.invoiceNumber, patientName }}
          outstanding={owes}
          role={role}
          staffName={staffName}
          onClose={() => setAction(null)}
          onSaved={number => changed(`${ADJUSTMENT_LABELS[action.kind]} ${number} saved`)}
        />
      )}
      {action?.type === 'reverse_adjustment' && (() => {
        const check = checkAdjustmentReversal(action.adjustment, owes, role);
        const effect = adjustmentReversalEffect(action.adjustment);
        return (
          <ReverseEntryDialog
            title={`Reverse ${ADJUSTMENT_LABELS[action.adjustment.kind].toLowerCase()} ${action.adjustment.number}`}
            blockedBy={check.ok ? null : check.error}
            effects={
              <p>
                Afterwards the medical aid owes {nad(Math.max(owes.medical_aid + effect.medical_aid, 0))} and the patient owes {nad(Math.max(owes.patient + effect.patient, 0))} on invoice {invoice.invoiceNumber}.
              </p>
            }
            confirmLabel="Reverse"
            onConfirm={async reason => {
              await reverseAdjustment(action.adjustment.id, reason);
              changed(`${action.adjustment.number} reversed`);
            }}
            onClose={() => setAction(null)}
          />
        );
      })()}
      {action?.type === 'reverse_allocation' && (
        <ReverseEntryDialog
          title={`Take ${nad(action.allocation.amountCents)} off invoice ${invoice.invoiceNumber}`}
          effects={
            <p>
              The {PORTION_LABELS[action.allocation.portion].toLowerCase()} portion is owed again and the money goes back to receipt{' '}
              {entries?.receipts[action.allocation.receiptId]?.number ?? ''} as credit, to allocate elsewhere or refund.
            </p>
          }
          confirmLabel="Take off invoice"
          onConfirm={async reason => {
            await reverseAllocation(action.allocation.id, reason);
            changed('Payment taken off the invoice');
          }}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
};
