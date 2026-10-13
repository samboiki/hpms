import React, { useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  PORTION_LABELS,
  WRITE_OFF_REASONS,
  adjustmentLimitCents,
  canApproveWriteOffs,
  centsToInput,
  checkInvoiceAdjustment,
  outstandingAfter,
  parseAmountInput,
  signedAdjustmentCents,
  type InvoiceAdjustmentKind,
  type JournalDirection,
  type Portion,
  type PortionCents
} from '../../../services/ledgerService';
import { postAdjustment } from './arService';
import { AmountInput, ChoiceGroup, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, SummaryRow, inputClass, type Choice } from './ArUi';

export interface AdjustmentDialogProps {
  practiceId: string;
  kind: InvoiceAdjustmentKind;
  invoice: { id: string; invoiceNumber: string; patientName?: string | null };
  /** What each portion still owes now */
  outstanding: PortionCents;
  /** The signed-in user's role (write-offs need an admin or doctor) */
  role: string | null;
  staffName?: string | null;
  defaultPortion?: Portion;
  onClose: () => void;
  onSaved: (number: string) => void;
}

const COPY: Record<InvoiceAdjustmentKind, { title: string; icon: string; tone: 'cyan' | 'amber' | 'red' | 'violet'; intro: string; action: string }> = {
  credit_note: {
    title: 'Credit note',
    icon: 'solar:document-add-bold-duotone',
    tone: 'violet',
    intro: 'Takes an amount off what the invoice owes, for example a service billed by mistake. The invoice itself is not changed.',
    action: 'Issue credit note'
  },
  write_off: {
    title: 'Write off',
    icon: 'solar:bill-cross-bold-duotone',
    tone: 'red',
    intro: 'Gives up an amount the practice will not collect. Needs a reason code and is approved by a practice admin or doctor.',
    action: 'Write off'
  },
  journal: {
    title: 'Correction (journal)',
    icon: 'solar:pen-new-square-bold-duotone',
    tone: 'amber',
    intro: 'Corrects what a portion owes up or down, with a reason, without editing the invoice.',
    action: 'Post correction'
  },
  shortfall_transfer: {
    title: 'Move shortfall to patient',
    icon: 'solar:transfer-horizontal-bold-duotone',
    tone: 'cyan',
    intro: 'The medical aid paid less than claimed (or rejected the claim) and the patient must pay the rest: the unpaid medical aid amount moves to the patient portion.',
    action: 'Move to patient'
  }
};

const PORTION_CHOICES: readonly Choice<Portion>[] = [
  { value: 'patient', label: 'Patient portion', icon: 'solar:user-bold-duotone' },
  { value: 'medical_aid', label: 'Medical aid portion', icon: 'solar:heart-pulse-bold-duotone' }
];

const DIRECTION_CHOICES: readonly Choice<JournalDirection>[] = [
  { value: 'decrease', label: 'Take off' },
  { value: 'increase', label: 'Add on' }
];

const nad = (cents: number) => formatNad(fromCents(cents));

/**
 * Credit note, write-off, correction or shortfall transfer on one invoice: fill in, check the
 * effect on each portion, confirm. Limits come from the invoice balance (never more than a
 * portion owes) and are checked again by the database.
 */
export const AdjustmentDialog: React.FC<AdjustmentDialogProps> = ({
  practiceId,
  kind,
  invoice,
  outstanding,
  role,
  staffName,
  defaultPortion,
  onClose,
  onSaved
}) => {
  const copy = COPY[kind];
  const firstOwing: Portion = outstanding.patient > 0 ? 'patient' : 'medical_aid';
  const [portion, setPortion] = useState<Portion>(kind === 'shortfall_transfer' ? 'medical_aid' : defaultPortion ?? firstOwing);
  const [direction, setDirection] = useState<JournalDirection | null>(kind === 'journal' ? null : 'decrease');
  const [amountText, setAmountText] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const amountCents = parseAmountInput(amountText);
  const draft = { kind, portion, amountCents, direction: direction ?? undefined, reason, reasonCode: reasonCode || null };
  const result = checkInvoiceAdjustment(draft, outstanding, role);
  const limit = adjustmentLimitCents(draft, outstanding);
  const after = amountCents !== null ? outstandingAfter(outstanding, draft, amountCents) : outstanding;
  const approverMissing = kind === 'write_off' && !canApproveWriteOffs(role);

  const save = async () => {
    if (!result.ok || amountCents === null || !confirmed) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await postAdjustment({
        practiceId,
        kind,
        invoiceId: invoice.id,
        portion,
        amountCents: signedAdjustmentCents(draft, amountCents),
        reason,
        reasonCode: kind === 'write_off' ? reasonCode : null
      });
      onSaved(saved.number);
    } catch (error) {
      setSaveError(error instanceof Error ? plainWords(error.message) : 'It could not be saved');
      setStep('edit');
      setConfirmed(false);
    } finally {
      setSaving(false);
    }
  };

  const portionLabel = PORTION_LABELS[kind === 'shortfall_transfer' ? 'medical_aid' : portion].toLowerCase();
  const summary = amountCents === null ? '' : kind === 'shortfall_transfer'
    ? `${nad(amountCents)} of the unpaid medical aid portion of invoice ${invoice.invoiceNumber} becomes payable by the patient.`
    : kind === 'journal'
      ? `${direction === 'increase' ? 'Add' : 'Take off'} ${nad(amountCents)} ${direction === 'increase' ? 'to' : 'from'} the ${portionLabel} portion of invoice ${invoice.invoiceNumber}.`
      : `${kind === 'write_off' ? 'Write off' : 'Credit'} ${nad(amountCents)} on the ${portionLabel} portion of invoice ${invoice.invoiceNumber}.`;

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title={`${copy.title}: invoice ${invoice.invoiceNumber}`}
      subtitle={invoice.patientName ?? undefined}
      icon={copy.icon}
      tone={copy.tone}
      size="md"
      footer={step === 'edit' ? (
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton icon="solar:arrow-right-bold-duotone" disabled={!result.ok} onClick={() => setStep('confirm')}>Review</PrimaryButton>
        </>
      ) : (
        <>
          <SecondaryButton onClick={() => { setStep('edit'); setConfirmed(false); }} disabled={saving}>Back</SecondaryButton>
          <PrimaryButton icon={copy.icon} tone={kind === 'write_off' ? 'red' : 'cyan'} busy={saving} disabled={!confirmed || !result.ok} onClick={() => void save()}>
            {saving ? 'Saving...' : copy.action}
          </PrimaryButton>
        </>
      )}
    >
      {step === 'edit' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{copy.intro}</p>
          {approverMissing && <ErrorBox>Only a practice admin or doctor can approve a write-off. Ask one of them to write it off.</ErrorBox>}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1">
            <SummaryRow label="Medical aid still owes" value={nad(Math.max(outstanding.medical_aid, 0))} />
            <SummaryRow label="Patient still owes" value={nad(Math.max(outstanding.patient, 0))} />
          </div>

          {kind !== 'shortfall_transfer' && (
            <Field label="Portion">
              <ChoiceGroup value={portion} onChange={setPortion} options={PORTION_CHOICES} label="Portion" disabled={saving} />
            </Field>
          )}
          {kind === 'journal' && (
            <Field label="Correction">
              <ChoiceGroup value={direction} onChange={setDirection} options={DIRECTION_CHOICES} label="Correction" disabled={saving} />
            </Field>
          )}

          <Field
            label="Amount"
            htmlFor="adj-amount"
            hint={limit !== null ? `At most ${nad(limit)}` : 'No limit: this adds to what is owed'}
            error={amountText.trim() && amountCents === null ? 'Enter an amount like 120.00' : null}
          >
            <div className="flex gap-2">
              <div className="flex-1">
                <AmountInput id="adj-amount" value={amountText} onChange={event => setAmountText(event.target.value)} placeholder="0.00" disabled={saving} />
              </div>
              {limit !== null && limit > 0 && (
                <SecondaryButton onClick={() => setAmountText(centsToInput(limit))} disabled={saving} className="!px-3">All</SecondaryButton>
              )}
            </div>
          </Field>

          {kind === 'write_off' && (
            <Field label="Why it is written off" htmlFor="adj-code">
              <select id="adj-code" className={inputClass} value={reasonCode} onChange={event => setReasonCode(event.target.value)} disabled={saving}>
                <option value="">Choose a reason</option>
                {WRITE_OFF_REASONS.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </Field>
          )}

          <Field label="Reason" htmlFor="adj-reason" hint="Kept with the entry and shown on the patient's statement">
            <textarea id="adj-reason" rows={2} className={inputClass} value={reason} onChange={event => setReason(event.target.value)} disabled={saving} />
          </Field>

          {amountCents !== null && result.error && !approverMissing && <ErrorBox>{result.error}</ErrorBox>}
          {saveError && <ErrorBox>{saveError}</ErrorBox>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-900">{summary}</p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1">
            <SummaryRow label="Medical aid will owe" value={nad(Math.max(after.medical_aid, 0))} />
            <SummaryRow label="Patient will owe" value={nad(Math.max(after.patient, 0))} />
          </div>
          <p className="text-sm text-gray-600"><span className="font-medium text-gray-700">Reason: </span>{reason.trim()}</p>
          {kind === 'write_off' && (
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-700">Approved by: </span>{staffName ?? 'you'} ({role})
            </p>
          )}
          <p className="text-xs text-gray-500">It is recorded with your name and the time, and can be reversed later with a reason. Nothing is deleted.</p>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={saving} />
            I have checked the amount and the reason.
          </label>
        </div>
      )}
    </Sheet>
  );
};
