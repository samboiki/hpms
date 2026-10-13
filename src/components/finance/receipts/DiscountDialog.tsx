import React, { useState } from 'react';
import { formatNad, fromCents, percentOfCents } from '../../../utils/billing/money';
import { cn } from '../../../utils/cn';
import {
  DISCOUNT_NOTE_MAX,
  DISCOUNT_REASONS,
  canGiveDiscounts,
  centsToInput,
  parseAmountInput,
  parsePercentInput,
  percentText,
  planDiscount,
  type DiscountMode,
  type DiscountReason,
  type PortionCents
} from '../../../services/ledgerService';
import { postAdjustment } from './arService';
import { AmountInput, ChoiceGroup, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, SummaryRow, inputClass, type Choice } from './ArUi';

export interface DiscountDialogProps {
  practiceId: string;
  invoice: { id: string; invoiceNumber: string; patientName?: string | null };
  /** What each portion still owes now */
  outstanding: PortionCents;
  /** What the patient was charged on the invoice: a percentage is of this (discountBaseCents) */
  baseCents: number;
  /** The signed-in user's role (administrators and practitioners give discounts) */
  role: string | null;
  staffName?: string | null;
  onClose: () => void;
  onSaved: (number: string) => void;
}

const MODE_CHOICES: readonly Choice<DiscountMode>[] = [
  { value: 'amount', label: 'Amount (N$)' },
  { value: 'percent', label: 'Percentage' }
];

const nad = (cents: number) => formatNad(fromCents(cents));

/**
 * A discount on one invoice (parity D19): an amount or a percentage, a reason from the list and a note; then check and
 * confirm. It comes off what the patient pays only: the invoice and the medical aid claim stay as they are. Limits come
 * from the invoice balance and are checked again by the database.
 */
export const DiscountDialog: React.FC<DiscountDialogProps> = ({ practiceId, invoice, outstanding, baseCents, role, staffName, onClose, onSaved }) => {
  const [mode, setMode] = useState<DiscountMode>('amount');
  const [amountText, setAmountText] = useState('');
  const [percentInput, setPercentInput] = useState('');
  const [reasonCode, setReasonCode] = useState<DiscountReason | ''>('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const patientOwesCents = Math.max(outstanding.patient, 0);
  const amountCents = parseAmountInput(amountText);
  const percent = parsePercentInput(percentInput);
  // The amount a typed percentage comes to, shown at once (the same rounding as planDiscount and the database)
  const percentCents = percent !== null && baseCents > 0 ? percentOfCents(baseCents, percent) : null;
  const check = planDiscount({ mode, amountCents, percent, reasonCode, note }, { baseCents, patientOwesCents }, role);
  const plan = check.plan;
  const allowed = canGiveDiscounts(role);
  // Say what is wrong only once something was typed, except the reasons that stop the whole discount
  const typed = mode === 'amount' ? amountText.trim() !== '' : percentInput.trim() !== '';
  const showError = check.error && allowed && (patientOwesCents <= 0 || typed);

  const save = async () => {
    if (!plan || !confirmed) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await postAdjustment({
        practiceId,
        kind: 'discount',
        invoiceId: invoice.id,
        portion: 'patient',
        amountCents: plan.amountCents,
        reason: plan.reason,
        reasonCode: plan.reasonCode,
        percent: plan.percent
      });
      onSaved(saved.number);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'It could not be saved');
      setStep('edit');
      setConfirmed(false);
    } finally {
      setSaving(false);
    }
  };

  const summary = plan
    ? `Take ${nad(plan.amountCents)}${plan.percent !== null ? ` (${percentText(plan.percent)} of ${nad(baseCents)})` : ''} off what the patient pays on invoice ${invoice.invoiceNumber}.`
    : '';

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title={`Discount: invoice ${invoice.invoiceNumber}`}
      subtitle={invoice.patientName ?? undefined}
      icon="solar:sale-bold-duotone"
      tone="green"
      size="md"
      footer={step === 'edit' ? (
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton icon="solar:arrow-right-bold-duotone" disabled={!plan} onClick={() => setStep('confirm')}>Review</PrimaryButton>
        </>
      ) : (
        <>
          <SecondaryButton onClick={() => { setStep('edit'); setConfirmed(false); }} disabled={saving}>Back</SecondaryButton>
          <PrimaryButton icon="solar:sale-bold-duotone" busy={saving} disabled={!confirmed || !plan} onClick={() => void save()}>
            {saving ? 'Saving...' : 'Give discount'}
          </PrimaryButton>
        </>
      )}
    >
      {step === 'edit' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Takes an amount off what the patient pays on this invoice, with a reason. The invoice and what the medical aid is claimed stay as they are.
          </p>
          {!allowed && <ErrorBox>Only a practice administrator or practitioner can give a discount. Ask one of them to give it.</ErrorBox>}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1">
            <SummaryRow label="The patient was charged" value={nad(baseCents)} />
            <SummaryRow label="Patient still owes" value={nad(patientOwesCents)} />
            <SummaryRow label="Medical aid still owes (not changed)" value={nad(Math.max(outstanding.medical_aid, 0))} />
          </div>

          <Field label="Discount as">
            <ChoiceGroup value={mode} onChange={setMode} options={MODE_CHOICES} label="Discount as" disabled={saving || !allowed} />
          </Field>

          {mode === 'amount' ? (
            <Field
              label="Amount"
              htmlFor="discount-amount"
              hint={`At most ${nad(patientOwesCents)}`}
              error={amountText.trim() && amountCents === null ? 'Enter an amount like 50.00' : null}
            >
              <div className="flex gap-2">
                <div className="flex-1">
                  <AmountInput id="discount-amount" value={amountText} onChange={event => setAmountText(event.target.value)} placeholder="0.00" disabled={saving || !allowed} />
                </div>
                {patientOwesCents > 0 && (
                  <SecondaryButton onClick={() => setAmountText(centsToInput(patientOwesCents))} disabled={saving || !allowed} className="!px-3">All</SecondaryButton>
                )}
              </div>
            </Field>
          ) : (
            <Field
              label="Percentage"
              htmlFor="discount-percent"
              hint={percent !== null && percentCents !== null ? `${percentText(percent)} of ${nad(baseCents)} is ${nad(percentCents)}` : `Of what the patient was charged (${nad(baseCents)})`}
              error={percentInput.trim() && percent === null ? 'Enter a percentage such as 10 (more than 0, at most 100)' : null}
            >
              <div className="relative">
                <input
                  id="discount-percent"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={cn(inputClass, 'pr-8 text-right tabular-nums')}
                  value={percentInput}
                  onChange={event => setPercentInput(event.target.value)}
                  placeholder="10"
                  disabled={saving || !allowed}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500">%</span>
              </div>
            </Field>
          )}

          <Field label="Why the discount is given" htmlFor="discount-reason">
            <select id="discount-reason" className={inputClass} value={reasonCode} onChange={event => setReasonCode(event.target.value as DiscountReason | '')} disabled={saving || !allowed}>
              <option value="">Choose a reason</option>
              {DISCOUNT_REASONS.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
          </Field>

          <Field
            label={reasonCode === 'other' ? 'Say why' : 'Note (optional)'}
            htmlFor="discount-note"
            hint={`Kept with the discount and shown on the patient's statement. ${note.length}/${DISCOUNT_NOTE_MAX}`}
          >
            <textarea id="discount-note" rows={2} className={inputClass} value={note} onChange={event => setNote(event.target.value)} maxLength={DISCOUNT_NOTE_MAX} disabled={saving || !allowed} />
          </Field>

          {showError && <ErrorBox>{check.error}</ErrorBox>}
          {saveError && <ErrorBox>{saveError}</ErrorBox>}
        </div>
      ) : plan ? (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900">{summary}</p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1">
            <SummaryRow label="Patient will owe" value={nad(Math.max(patientOwesCents - plan.amountCents, 0))} />
            <SummaryRow label="Medical aid will owe (not changed)" value={nad(Math.max(outstanding.medical_aid, 0))} />
          </div>
          <p className="text-sm text-gray-600"><span className="font-medium text-gray-700">Reason: </span>{plan.reason}</p>
          <p className="text-sm text-gray-600"><span className="font-medium text-gray-700">Given by: </span>{staffName ?? 'you'}{role ? ` (${role})` : ''}</p>
          <p className="text-xs text-gray-500">It is recorded with your name and the time, printed on the invoice and the patient's statements, and can be taken back later with a reason. Nothing is deleted.</p>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={saving} />
            I have checked the amount and the reason.
          </label>
        </div>
      ) : null}
    </Sheet>
  );
};
