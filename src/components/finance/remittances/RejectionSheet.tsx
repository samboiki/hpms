import React, { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { addDaysToKey, todayKey } from '../../../utils/billing/dates';
import { toCents } from '../../../utils/billing/money';
import { parseAmountInput } from '../../../services/ledgerService';
import { fundLabel } from '../../../utils/remittance/funds';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { CATEGORY_LABELS, patientMayBeBilled } from '../../../utils/remittance/reasonCodes';
import DateInput from '../../ui/DateInput';
import { invoiceLink, patientBillingLink } from '../../billing/invoiceLinks';
import { AmountInput, ChoiceGroup, ErrorBox, Field, inputClass, PrimaryButton, SecondaryButton, Sheet, SummaryRow, type Choice } from '../receipts/ArUi';
import {
  actOnRejection,
  loadClaimLineDetail,
  loadRejectionEvents,
  type ClaimLineDetail,
  type RejectionAction,
  type RejectionEvent,
  type RejectionItem
} from './remittanceService';
import { ACTION_LABELS, CATEGORY_TONE, Chip, formatDateKey, nad, REJECTION_STATUS_LABELS } from './remittanceUi';
import { ClaimLineStoryButton } from '../practiceReports/ClaimLineStorySheet';

interface RejectionSheetProps {
  item: RejectionItem;
  canApproveWriteOffs: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const cents = (value: number | string | null | undefined): number => toCents(Number(value ?? 0) || 0);
const FINAL = ['patient_liable', 'write_off', 'duplicate'];

/** One queue item: what the fund said, in plain English, and the actions on it */
export const RejectionSheet: React.FC<RejectionSheetProps> = ({ item, canApproveWriteOffs, onClose, onChanged }) => {
  const open = item.status === 'open' || item.status === 'waiting';
  const billable = patientMayBeBilled(item.category);
  const actions = useMemo<Choice<RejectionAction>[]>(() => (open
    ? [
      { value: 'resubmit', label: 'Fix and resubmit', icon: 'solar:restart-bold-duotone' },
      ...(billable ? [{ value: 'bill_patient' as const, label: 'Bill the patient', icon: 'solar:user-hand-up-bold-duotone' }] : []),
      { value: 'write_off', label: 'Write off', icon: 'solar:eraser-bold-duotone' },
      { value: 'wait', label: 'Wait for the fund', icon: 'solar:hourglass-bold-duotone' },
      { value: 'close', label: 'Close the item', icon: 'solar:close-square-bold-duotone' },
      { value: 'note', label: 'Add a note', icon: 'solar:notes-bold-duotone' }
    ]
    : [
      { value: 'reopen', label: 'Reopen', icon: 'solar:refresh-circle-bold-duotone' },
      { value: 'note', label: 'Add a note', icon: 'solar:notes-bold-duotone' }
    ]), [open, billable]);
  const suggested: RejectionAction = !open ? 'note'
    : item.suggested_action === 'resubmit' ? 'resubmit'
      : item.suggested_action === 'bill_patient' && billable ? 'bill_patient'
        : item.suggested_action === 'write_off' ? 'write_off'
          : item.suggested_action === 'wait' ? 'wait' : 'note';

  const [action, setAction] = useState<RejectionAction>(suggested);
  const [detail, setDetail] = useState<ClaimLineDetail | null>(null);
  const [events, setEvents] = useState<RejectionEvent[]>([]);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState((cents(item.at_stake) / 100).toFixed(2));
  const [until, setUntil] = useState(item.follow_up_on ?? addDaysToKey(todayKey(), 21));
  const [writeOffCode, setWriteOffCode] = useState<'scheme_rate' | 'claim_expired' | 'other'>(item.category === 'rate_shortfall' ? 'scheme_rate' : 'other');
  const [flag, setFlag] = useState<'R' | 'code'>('R');
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (item.claim_line_id) {
      loadClaimLineDetail(item.claim_line_id).then(row => { if (!cancelled) setDetail(row); }).catch(() => { if (!cancelled) setDetail(null); });
    }
    loadRejectionEvents(item.id).then(rows => { if (!cancelled) setEvents(rows); }).catch(() => { if (!cancelled) setEvents([]); });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.claim_line_id]);

  const toothRelevant = !!detail?.tooth_numbers || /tooth/i.test(`${item.plain_reason} ${item.fund_reason ?? ''}`);
  const noteRequired = action === 'close' || action === 'note' || (action === 'resubmit' && FINAL.includes(item.category));

  const submit = async () => {
    setError(null);
    if (noteRequired && !note.trim()) {
      setError(action === 'resubmit' ? 'Say what changed (for example the membership or option): the fund refused this for a reason a correction does not change.' : 'Write the note first.');
      return;
    }
    const payload: Record<string, unknown> = { note: note.trim() || null };
    if (action === 'bill_patient' || action === 'write_off') {
      const value = parseAmountInput(amount);
      if (value === null) {
        setError('Enter the amount in N$ and cents.');
        return;
      }
      payload.amount = (value / 100).toFixed(2);
      if (action === 'write_off') payload.reason_code = writeOffCode;
    }
    if (action === 'wait') payload.until = until;
    if (action === 'resubmit') {
      payload.flag = flag === 'code' && item.reason_codes[0] ? item.reason_codes[0] : 'R';
      payload.changes = Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value !== ''));
    }
    setBusy(true);
    try {
      await actOnRejection(item.id, action, payload);
      toast.success(action === 'resubmit' ? "Added to the fund's next batch with the resubmission flag" : 'Saved');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? plainWords(err.message) : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const change = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => setChanges(current => ({ ...current, [key]: event.target.value }));

  return (
    <Sheet
      open
      onClose={onClose}
      busy={busy}
      title={item.patientName}
      subtitle={(
        <span className="inline-flex flex-wrap items-center gap-2">
          <MedicalAidLogo name={item.fund_code} />
          {`${fundLabel(item.fund_code)} · ${formatDateKey(item.service_date)} · code ${item.tariff_code ?? '-'}${item.invoiceNumber ? ` · invoice ${item.invoiceNumber}` : ''}`}
        </span>
      )}
      icon="solar:danger-triangle-bold-duotone"
      tone="amber"
      footer={(
        <>
          <SecondaryButton onClick={onClose} disabled={busy}>Cancel</SecondaryButton>
          <PrimaryButton busy={busy} onClick={submit} disabled={action === 'write_off' && !canApproveWriteOffs}>Save</PrimaryButton>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={CATEGORY_TONE[item.category]}>{CATEGORY_LABELS[item.category]}</Chip>
            <Chip tone="gray">{REJECTION_STATUS_LABELS[item.status]}</Chip>
            {item.reason_codes.length > 0 && <span className="text-xs text-gray-500">Fund code {item.reason_codes.join('/')}</span>}
          </div>
          <p className="text-sm font-medium text-gray-900">{item.plain_reason}</p>
          {item.fix_hint && <p className="text-sm text-gray-700">{item.fix_hint}</p>}
          {item.fund_reason && <p className="text-xs text-gray-500">The fund's words: {item.fund_reason}</p>}
          {item.linePatientName && <p className="text-xs text-gray-500">Named on the remittance: {item.linePatientName}</p>}
          {(item.patient_id || item.invoice_id) && (
            <div className="flex flex-wrap gap-3 text-xs">
              {item.patient_id && <Link to={patientBillingLink(item.patient_id)} className="font-medium text-cyan-700 hover:underline">Open the patient's file</Link>}
              {item.invoice_id && <Link to={invoiceLink(item.invoice_id)} className="font-medium text-cyan-700 hover:underline">Open the invoice</Link>}
            </div>
          )}
          {item.claim_line_id && <ClaimLineStoryButton claimLineId={item.claim_line_id} className="text-xs font-medium text-cyan-700 hover:underline" />}
          <SummaryRow label="Claimed" value={nad(cents(item.claimed))} />
          <SummaryRow label="Paid" value={nad(cents(item.paid))} />
          <SummaryRow strong label="At stake" value={nad(cents(item.at_stake))} />
          {item.resubmit_by && <SummaryRow label="Resubmit by" value={formatDateKey(item.resubmit_by)} />}
          {item.status === 'waiting' && item.follow_up_on && <SummaryRow label="Check again on" value={formatDateKey(item.follow_up_on)} />}
        </div>

        <ChoiceGroup<RejectionAction> label="What to do" value={action} onChange={value => { setAction(value); setError(null); }} options={actions} />
        {open && <p className="text-xs text-gray-500">Suggested: {ACTION_LABELS[item.suggested_action]}.{!billable ? ' This line may not be billed to the patient.' : ''}</p>}

        {action === 'resubmit' && (
          <div className="space-y-3">
            {!item.claim_line_id && <ErrorBox>This line is not matched to a claim line, so it cannot be resubmitted from here. Correct the invoice and add it to a batch instead.</ErrorBox>}
            <p className="text-sm text-gray-600">A copy of the claim line goes into the fund's open batch with the resubmission flag set (claim field 32). Correct what the fund rejected:</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="ICD-10 code" htmlFor="fix-icd10" hint={detail?.diagnostic_code ? `Sent: ${detail.diagnostic_code}` : 'None was sent'}>
                <input id="fix-icd10" className={inputClass} placeholder="e.g. J06.9" value={changes.diagnostic_code ?? ''} onChange={change('diagnostic_code')} />
              </Field>
              <Field label="Membership number" htmlFor="fix-member" hint={detail?.medical_aid_membership_number ? `Sent: ${detail.medical_aid_membership_number}` : undefined}>
                <input id="fix-member" className={inputClass} value={changes.medical_aid_membership_number ?? ''} onChange={change('medical_aid_membership_number')} />
              </Field>
              <Field label="Authorisation number" htmlFor="fix-auth" hint={detail?.authorisation_number ? `Sent: ${detail.authorisation_number}` : undefined}>
                <input id="fix-auth" className={inputClass} value={changes.authorisation_number ?? ''} onChange={change('authorisation_number')} />
              </Field>
              {toothRelevant && (
                <Field label="Tooth numbers" htmlFor="fix-tooth" hint={detail?.tooth_numbers ? `Sent: ${detail.tooth_numbers}` : 'None was sent'}>
                  <input id="fix-tooth" className={inputClass} placeholder="e.g. 36" value={changes.tooth_numbers ?? ''} onChange={change('tooth_numbers')} />
                </Field>
              )}
              <Field label="Motivation for the fund (optional)" htmlFor="fix-motivation" className="sm:col-span-2">
                <input id="fix-motivation" className={inputClass} maxLength={200} value={changes.free_text ?? ''} onChange={change('free_text')} />
              </Field>
            </div>
            {item.reason_codes[0] && (
              <ChoiceGroup<'R' | 'code'> label="Resubmission flag" value={flag} onChange={setFlag} options={[{ value: 'R', label: 'R (resubmission)' }, { value: 'code', label: `The fund's code ${item.reason_codes[0]}` }]} />
            )}
          </div>
        )}

        {(action === 'bill_patient' || action === 'write_off') && (
          <Field label="Amount" htmlFor="rejection-amount" hint={`At stake: ${nad(cents(item.at_stake))}`}>
            <AmountInput id="rejection-amount" value={amount} onChange={event => setAmount(event.target.value)} />
          </Field>
        )}
        {action === 'write_off' && (
          <>
            {!canApproveWriteOffs && <ErrorBox>Only a practice admin or doctor can approve a write-off. Ask one of them to open this item.</ErrorBox>}
            <ChoiceGroup<'scheme_rate' | 'claim_expired' | 'other'>
              label="Why it is written off"
              value={writeOffCode}
              onChange={setWriteOffCode}
              options={[
                { value: 'other', label: 'The fund will not pay and the patient may not be charged' },
                { value: 'scheme_rate', label: "The fund paid its own rate" },
                { value: 'claim_expired', label: 'Claim deadline missed' }
              ]}
            />
          </>
        )}
        {action === 'wait' && <DateInput label="Check again on" value={until} onChange={setUntil} minDate={todayKey()} />}

        <Field label={noteRequired ? 'Note (required)' : 'Note (optional)'} htmlFor="rejection-note">
          <textarea id="rejection-note" rows={2} className={inputClass} value={note} onChange={event => setNote(event.target.value)} />
        </Field>
        {error && <ErrorBox>{error}</ErrorBox>}

        {(events.length > 0 || item.notes) && (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-gray-800">History</h3>
            <ul className="space-y-1 text-xs text-gray-600">
              {events.map(event => (
                <li key={event.id}>{formatDateKey(event.occurred_at.slice(0, 10))}: {event.action.replace(/_/g, ' ')}{event.note ? ` - ${event.note}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
};
