import React, { useEffect, useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import FormModal from '../modals/FormModal';
import { MessageList, inputClass, labelClass, primaryButton, secondaryButton } from '../quotes/QuoteBits';
import { saveLabSlip } from '../../services/dental/labOrderService';
import { formatAmount, formatNad, fromCents, sumCents, toCents } from '../../utils/billing/money';
import { describeLabWork } from '../../utils/dental/labOrders';
import type { DentalLabOrder } from '../../utils/dental/labOrderRecords';
import {
  LAB_FEE_CODE,
  MAX_SLIP_LINES,
  SLIP_DESCRIPTION_MAX,
  SLIP_NUMBER_MAX,
  emptySlipLine,
  parseSlipAmount,
  validateLabSlipDraft,
  type LabSlipDraft,
  type LabSlipErrors,
  type LabSlipLineDraft
} from '../../utils/dental/labSlips';

export interface LabSlipSheetProps {
  order: DentalLabOrder | null;
  onClose: () => void;
  onSaved: () => void;
}

const draftOf = (order: DentalLabOrder): LabSlipDraft => ({
  slipNumber: order.slipNumber ?? '',
  lines:
    order.slipLines.length > 0
      ? order.slipLines.map(line => ({ code: line.code ?? '', description: line.description, amount: formatAmount(fromCents(line.amountCents), { thousands: false }) }))
      : [emptySlipLine()]
});

/**
 * The lab's invoice for an order (parity D28), line by line as the lab wrote it: its item code, what it made and the
 * amount. The total is what the practice bills under 8099, and the claim carries these lines after the 8099 line.
 */
const LabSlipSheet: React.FC<LabSlipSheetProps> = ({ order, onClose, onSaved }) => {
  const id = useId();
  const [draft, setDraft] = useState<LabSlipDraft>({ slipNumber: '', lines: [emptySlipLine()] });
  const [errors, setErrors] = useState<LabSlipErrors>({ byLine: {} });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!order) return;
    setDraft(draftOf(order));
    setErrors({ byLine: {} });
    setFormError(null);
  }, [order]);

  if (!order) return null;

  const setLine = (index: number, patch: Partial<LabSlipLineDraft>) =>
    setDraft(current => ({ ...current, lines: current.lines.map((line, at) => (at === index ? { ...line, ...patch } : line)) }));
  const removeLine = (index: number) =>
    setDraft(current => ({ ...current, lines: current.lines.length > 1 ? current.lines.filter((_, at) => at !== index) : [emptySlipLine()] }));
  const totalCents = sumCents(draft.lines.map(line => toCents(parseSlipAmount(line.amount) ?? 0)));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateLabSlipDraft(draft);
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError(checked.errors.slipNumber ?? checked.errors.lines ?? 'Check the marked lines.');
      return;
    }
    setErrors({ byLine: {} });
    setFormError(null);
    setBusy(true);
    try {
      await saveLabSlip(order.id, checked.payload);
      toast.success(
        checked.payload.lines.length > 0
          ? `The lab's invoice for order ${order.orderNo} is saved: ${formatNad(fromCents(checked.totalCents))}.`
          : `The lab's invoice lines of order ${order.orderNo} are taken off.`
      );
      onSaved();
      onClose();
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : "The lab's invoice could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal isOpen onClose={() => !busy && onClose()} title={`The lab's invoice: order ${order.orderNo}`} icon="solar:bill-list-bold-duotone" className="max-w-2xl">
      <form onSubmit={save} noValidate className="space-y-4">
        <p className="text-sm text-gray-700">
          {describeLabWork(order)}
          {order.labName ? ` from ${order.labName}` : ''}. Type each line of the lab&apos;s invoice: the total is billed under {LAB_FEE_CODE}, and the medical aid
          gets these lines with it.
        </p>

        <label className="block max-w-xs">
          <span className={labelClass}>The lab&apos;s invoice number (optional)</span>
          <input
            className={inputClass}
            value={draft.slipNumber}
            maxLength={SLIP_NUMBER_MAX}
            aria-invalid={errors.slipNumber ? true : undefined}
            onChange={event => setDraft(current => ({ ...current, slipNumber: event.target.value }))}
          />
        </label>

        <fieldset className="space-y-2">
          <legend className={labelClass}>Lines</legend>
          {draft.lines.map((line, index) => {
            const own = errors.byLine[index] ?? {};
            const rowErrors = [own.code, own.description, own.amount].filter((message): message is string => Boolean(message));
            return (
              <div key={index} className="rounded-lg border border-gray-200 p-2.5">
                <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_7.5rem_auto] sm:items-end">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">Code</span>
                    <input
                      className={inputClass}
                      value={line.code}
                      maxLength={10}
                      placeholder="9330"
                      aria-invalid={own.code ? true : undefined}
                      onChange={event => setLine(index, { code: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">What the lab made</span>
                    <input
                      className={inputClass}
                      value={line.description}
                      maxLength={SLIP_DESCRIPTION_MAX}
                      placeholder="For example: porcelain fused to metal crown"
                      aria-invalid={own.description ? true : undefined}
                      onChange={event => setLine(index, { description: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">Amount (N$)</span>
                    <input
                      className={`${inputClass} text-right tabular-nums`}
                      value={line.amount}
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-invalid={own.amount ? true : undefined}
                      onChange={event => setLine(index, { amount: event.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className={`${secondaryButton} justify-self-start sm:justify-self-auto`}
                    onClick={() => removeLine(index)}
                    aria-label={`Take off line ${index + 1}`}
                  >
                    <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {rowErrors.length > 0 && (
                  <p id={`${id}-line-${index}-error`} className="mt-1 text-xs text-red-700" role="alert">
                    {rowErrors.join(' ')}
                  </p>
                )}
              </div>
            );
          })}
          {draft.lines.length < MAX_SLIP_LINES && (
            <button type="button" className={secondaryButton} onClick={() => setDraft(current => ({ ...current, lines: [...current.lines, emptySlipLine()] }))}>
              <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Add a line
            </button>
          )}
        </fieldset>

        <p className="text-right text-sm text-gray-700" aria-live="polite">
          Total to bill under {LAB_FEE_CODE} <span className="font-semibold text-gray-900">{formatNad(fromCents(totalCents))}</span>
        </p>

        {formError && <MessageList tone="error" messages={[formError]} />}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={secondaryButton} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={primaryButton} disabled={busy}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Save the lab&apos;s invoice
          </button>
        </div>
      </form>
    </FormModal>
  );
};

export default LabSlipSheet;
