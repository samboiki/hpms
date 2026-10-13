import React, { useState } from 'react';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  REFUND_METHODS,
  RECEIPT_METHOD_LABELS,
  centsToInput,
  checkRefund,
  parseAmountInput,
  type ArReceipt,
  type RefundMethod
} from '../../../services/ledgerService';
import { postAdjustment } from './arService';
import { AmountInput, ChoiceGroup, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, SummaryRow, inputClass, type Choice } from './ArUi';

const nad = (cents: number) => formatNad(fromCents(cents));

const REFUND_CHOICES: readonly Choice<RefundMethod>[] = REFUND_METHODS.map(method => ({ value: method, label: RECEIPT_METHOD_LABELS[method] }));

/** Pay back unallocated credit on a receipt (an overpayment). Never more than the credit. */
export const RefundDialog: React.FC<{
  practiceId: string;
  receipt: ArReceipt;
  payer: string;
  onClose: () => void;
  onSaved: (number: string) => void;
}> = ({ practiceId, receipt, payer, onClose, onSaved }) => {
  const [amountText, setAmountText] = useState(centsToInput(Math.max(receipt.unallocatedCents, 0)));
  const [method, setMethod] = useState<RefundMethod | null>(receipt.method === 'cash' ? 'cash' : null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const amountCents = parseAmountInput(amountText);
  const result = checkRefund({ amountCents, method, reason }, receipt);

  const save = async () => {
    if (!result.ok || amountCents === null || !method || !confirmed) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await postAdjustment({ practiceId, kind: 'refund', receiptId: receipt.id, amountCents, method, reason });
      onSaved(saved.number);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The refund could not be saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title={`Refund from receipt ${receipt.number}`}
      subtitle={`${payer} · ${nad(receipt.unallocatedCents)} unallocated`}
      icon="solar:card-send-bold-duotone"
      tone="amber"
      size="md"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton icon="solar:card-send-bold-duotone" busy={saving} disabled={!result.ok || !confirmed} onClick={() => void save()}>
            {saving ? 'Saving...' : amountCents ? `Refund ${nad(amountCents)}` : 'Refund'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Only money not allocated to an invoice can be refunded. To refund money that paid an invoice, first take it off the invoice
          (reverse that allocation) so it becomes credit.
        </p>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1">
          <SummaryRow label="Received" value={nad(receipt.amountCents)} />
          <SummaryRow label="Allocated to invoices" value={nad(receipt.allocatedCents)} />
          {receipt.refundedCents > 0 && <SummaryRow label="Already refunded" value={nad(receipt.refundedCents)} />}
          <SummaryRow label="Unallocated credit" value={nad(receipt.unallocatedCents)} strong />
        </div>
        <Field label="Amount to refund" htmlFor="refund-amount" error={amountText.trim() && amountCents === null ? 'Enter an amount like 50.00' : null}>
          <AmountInput id="refund-amount" value={amountText} onChange={event => setAmountText(event.target.value)} disabled={saving} />
        </Field>
        <Field label="Paid back by">
          <ChoiceGroup value={method} onChange={setMethod} options={REFUND_CHOICES} label="Paid back by" disabled={saving} />
        </Field>
        <Field label="Reason" htmlFor="refund-reason">
          <textarea id="refund-reason" rows={2} className={inputClass} value={reason} onChange={event => setReason(event.target.value)} disabled={saving} />
        </Field>
        {amountCents !== null && result.error && <ErrorBox>{result.error}</ErrorBox>}
        {method === 'cash' && result.ok && <p className="text-xs text-amber-800">Cash refunds come out of the till and show on the day's cash-up.</p>}
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={saving} />
          The money has been (or is now being) paid back to {payer}.
        </label>
        {saveError && <ErrorBox>{saveError}</ErrorBox>}
      </div>
    </Sheet>
  );
};

/**
 * Reverse a receipt, an allocation or an adjustment: say why, see what it does, confirm. Nothing
 * is deleted; the entry stays on record as reversed, with who did it and when.
 */
export const ReverseEntryDialog: React.FC<{
  title: string;
  /** What reversing will do, in words */
  effects: React.ReactNode;
  /** Why it cannot be reversed yet */
  blockedBy?: string | null;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}> = ({ title, effects, blockedBy, confirmLabel, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const canSave = !blockedBy && reason.trim().length > 0 && confirmed && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onConfirm(reason.trim());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'It could not be reversed');
      setSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title={title}
      icon="solar:undo-left-round-bold-duotone"
      tone="red"
      size="md"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton icon="solar:undo-left-round-bold-duotone" tone="red" busy={saving} disabled={!canSave} onClick={() => void save()}>
            {saving ? 'Reversing...' : confirmLabel}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {blockedBy ? <ErrorBox>{blockedBy}</ErrorBox> : <div className="text-sm text-gray-700">{effects}</div>}
        <p className="text-xs text-gray-500">Nothing is deleted: the entry stays on record as reversed, with your name, the time and the reason.</p>
        <Field label="Reason" htmlFor="reverse-reason" hint="For example: EFT bounced, captured twice, wrong patient">
          <textarea id="reverse-reason" rows={2} className={inputClass} value={reason} onChange={event => setReason(event.target.value)} disabled={saving || !!blockedBy} />
        </Field>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={saving || !!blockedBy} />
          I want to reverse it.
        </label>
        {saveError && <ErrorBox>{saveError}</ErrorBox>}
      </div>
    </Sheet>
  );
};
