import React, { useEffect, useId, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../finance/receipts/ArUi';
import { loadPracticeStaff } from '../../services/invoiceContextService';
import { savePaymentPlan } from '../../services/billing/billingExtrasService';
import { formatServiceDate, todayKey } from '../../utils/billing/dates';
import { formatNad, fromCents } from '../../utils/billing/money';
import { treatingPractitionerOptions, type TreatingPractitionerOption } from '../../utils/billing/invoiceRights';
import { PLAN_LIMITS, describeSchedule, planFromDraft, type PlanDraft } from '../../utils/billing/paymentPlans';

interface PaymentPlanSheetProps {
  practiceId: string;
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * A new payment plan on the patient's Billing tab (parity D16): what it is for, the total agreed, an optional deposit,
 * the monthly payments and the day it starts; the instalments show before saving. Each instalment goes on the account
 * on its date (when the patient's Billing tab is opened, or with Post due instalments in Finance > Overview).
 */
const PaymentPlanSheet: React.FC<PaymentPlanSheetProps> = ({ practiceId, patientId, patientName, onClose, onSaved }) => {
  const id = useId();
  const [draft, setDraft] = useState<PlanDraft>(() => ({ title: '', total: '', deposit: '', payments: '12', startKey: todayKey(), practitionerId: '', notes: '' }));
  const [practitioners, setPractitioners] = useState<TreatingPractitionerOption[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadPracticeStaff(practiceId)
      .then(staff => {
        if (live) setPractitioners(treatingPractitionerOptions(staff));
      })
      .catch(() => {
        // Without the list the plan is recorded under no practitioner; nothing else depends on it
        if (live) setPractitioners([]);
      });
    return () => {
      live = false;
    };
  }, [practiceId]);

  const result = useMemo(() => planFromDraft(draft, patientId), [draft, patientId]);
  const update = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const hasDeposit = draft.deposit.trim() !== '' && Number(draft.deposit.replace(/[^\d.]/g, '')) > 0;

  const save = async () => {
    setShowErrors(true);
    if (!result.payload) return;
    setSaving(true);
    setSaveError(null);
    try {
      await savePaymentPlan(result.payload);
      onSaved();
    } catch (error) {
      setSaveError(error instanceof Error ? plainWords(error.message) : 'The payment plan could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title="New payment plan"
      subtitle={`What ${patientName} agreed to pay, and when. Each instalment goes on the account on its date.`}
      icon="solar:wallet-money-bold-duotone"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton busy={saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Agree the plan'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="What it is for" htmlFor={`${id}-title`} hint="For example Braces or Implant treatment">
            <input id={`${id}-title`} className={inputClass} maxLength={PLAN_LIMITS.titleMax} value={draft.title} onChange={event => update('title', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Total agreed (N$)" htmlFor={`${id}-total`}>
            <input id={`${id}-total`} className={inputClass} inputMode="decimal" value={draft.total} onChange={event => update('total', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Deposit (N$, optional)" htmlFor={`${id}-deposit`} hint="Due on the start day; the rest is paid monthly after it">
            <input id={`${id}-deposit`} className={inputClass} inputMode="decimal" value={draft.deposit} onChange={event => update('deposit', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Monthly payments" htmlFor={`${id}-payments`}>
            <input id={`${id}-payments`} className={inputClass} inputMode="numeric" value={draft.payments} onChange={event => update('payments', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Starts on" htmlFor={`${id}-start`} hint={hasDeposit ? 'The deposit is due on this day' : 'The first payment is due on this day'}>
            <input id={`${id}-start`} type="date" className={inputClass} value={draft.startKey} onChange={event => update('startKey', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Practitioner (optional)" htmlFor={`${id}-practitioner`} hint="The instalment invoices are recorded under them">
            <select id={`${id}-practitioner`} className={inputClass} value={draft.practitionerId} onChange={event => update('practitionerId', event.target.value)} disabled={saving}>
              <option value="">No practitioner</option>
              {practitioners.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Note (optional)" htmlFor={`${id}-notes`} hint={`Up to ${PLAN_LIMITS.notesMax} characters, for example what was agreed if a payment is missed`}>
          <input id={`${id}-notes`} className={inputClass} maxLength={PLAN_LIMITS.notesMax} value={draft.notes} onChange={event => update('notes', event.target.value)} disabled={saving} />
        </Field>

        {result.schedule ? (
          <section aria-labelledby={`${id}-schedule`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <h3 id={`${id}-schedule`} className="text-sm font-semibold text-gray-900">{describeSchedule(result.schedule, hasDeposit)}</h3>
            <ol className="mt-2 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-lg bg-white text-sm">
              {result.schedule.map((item, index) => (
                <li key={item.dueOn} className="flex justify-between gap-3 px-3 py-1.5">
                  <span className="text-gray-700">{index + 1}. {formatServiceDate(item.dueOn)}</span>
                  <span className="tabular-nums text-gray-900">{formatNad(fromCents(item.amountCents))}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-gray-500">
              The patient pays these; they are never claimed from a medical aid. An instalment due today or earlier goes on the account straight away.
            </p>
          </section>
        ) : (
          showErrors && result.error && <ErrorBox>{result.error}</ErrorBox>
        )}
        {!showErrors && !result.schedule && (draft.title || draft.total) && <p className="text-xs text-gray-500">{result.error}</p>}
        {saveError && <ErrorBox>{saveError}</ErrorBox>}
      </div>
    </Sheet>
  );
};

export default PaymentPlanSheet;
