import React, { useId, useMemo, useState } from 'react';
import { ChoiceGroup, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../../finance/receipts/ArUi';
import { todayKey } from '../../../utils/billing/dates';
import { saveInjuryCase } from '../../../services/payerAccountService';
import {
  CASE_DATE_LABELS,
  CASE_TYPE_LABELS,
  INJURY_CASE_TYPES,
  STANDARD_PAYER_LABELS,
  draftOfInjuryCase,
  emptyInjuryCaseDraft,
  needsEmployer,
  validateInjuryCaseDraft,
  type CasePayerChoice,
  type InjuryCase,
  type InjuryCaseDraft,
  type InjuryCaseField,
  type InjuryCaseType
} from '../../../utils/accounts/injuryCases';
import { sortAccounts, type PayerAccount } from '../../../utils/accounts/payerAccounts';

interface InjuryCaseSheetProps {
  practiceId: string;
  patientId: string;
  /** The case to change; null for a new one */
  injuryCase: InjuryCase | null;
  /** The practice's accounts (employers, the funds, other payers) */
  accounts: readonly PayerAccount[];
  onClose: () => void;
  /** Saved: how many of its visits now go to its payer */
  onSaved: (saved: InjuryCase, visitsMoved: number) => void;
  /** Opened over the full-screen visit */
  overFullScreen?: boolean;
}

const TYPE_CHOICES = INJURY_CASE_TYPES.map(type => ({ value: type, label: CASE_TYPE_LABELS[type] }));
const STANDARD_KIND: Record<InjuryCaseType, PayerAccount['kind']> = {
  injury_on_duty: 'compensation_fund',
  occupational_disease: 'compensation_fund',
  motor_vehicle_accident: 'mva_fund'
};

/**
 * Records an injury on duty, an occupational disease or a motor vehicle accident on the patient's file (parity A19):
 * once, with the employer, the employee number and the fund's claim number, so every visit of the case reuses them and
 * its invoices go to whoever pays the case. The database checks everything again (save_injury_case) and creates the
 * fund's account the first time a case is billed to it.
 */
export const InjuryCaseSheet: React.FC<InjuryCaseSheetProps> = ({ practiceId, patientId, injuryCase, accounts, onClose, onSaved, overFullScreen = false }) => {
  const id = useId();
  const [today] = useState(() => todayKey());
  const standardAccountId = (type: InjuryCaseType) => accounts.find(account => account.kind === STANDARD_KIND[type] && !account.closedAt)?.id ?? null;
  const [draft, setDraft] = useState<InjuryCaseDraft>(() =>
    injuryCase ? draftOfInjuryCase(injuryCase, standardAccountId(injuryCase.type)) : emptyInjuryCaseDraft(today)
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const employers = useMemo(() => sortAccounts(accounts.filter(account => account.kind === 'employer' && (!account.closedAt || account.id === draft.employerAccountId))), [accounts, draft.employerAccountId]);
  const otherPayers = useMemo(
    () => sortAccounts(accounts.filter(account => (account.kind === 'other' || account.kind === 'employer') && (!account.closedAt || account.id === draft.payerAccountId))),
    [accounts, draft.payerAccountId]
  );
  const checked = validateInjuryCaseDraft(draft, today);
  const errors: Partial<Record<InjuryCaseField, string>> = showErrors && !checked.ok ? checked.errors : {};
  const update = <K extends InjuryCaseField>(key: K, value: InjuryCaseDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const employerName = draft.employerAccountId ? accounts.find(account => account.id === draft.employerAccountId)?.name ?? 'The employer' : null;

  const payerChoices: Array<{ value: CasePayerChoice; label: string }> = [
    { value: 'standard', label: STANDARD_PAYER_LABELS[draft.type] },
    ...(draft.employerAccountId ? [{ value: 'employer' as const, label: `${employerName} (the employer)` }] : []),
    { value: 'account', label: 'Another account' },
    { value: 'patient', label: 'The patient (and their medical aid)' }
  ];

  const save = async () => {
    setShowErrors(true);
    if (!checked.ok) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveInjuryCase(practiceId, patientId, injuryCase?.id ?? null, checked.value);
      onSaved(result.injuryCase, result.visitsMoved);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The case could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      overFullScreen={overFullScreen}
      icon="solar:adhesive-plaster-bold-duotone"
      title={injuryCase ? 'Change the case' : 'New injury or accident case'}
      subtitle="Entered once: every visit of the case reuses it, and its invoices go to whoever pays the case."
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={() => void save()} busy={saving}>
            {injuryCase ? 'Save changes' : 'Add case'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {saveError && <ErrorBox>{saveError}</ErrorBox>}
        <div>
          <p className="mb-1 block text-sm font-medium text-gray-700">What happened</p>
          <ChoiceGroup<InjuryCaseType>
            label="What happened"
            value={draft.type}
            onChange={type => update('type', type)}
            options={TYPE_CHOICES}
            disabled={saving}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={CASE_DATE_LABELS[draft.type]} htmlFor={`${id}-date`} error={errors.injuryDate}>
            <input id={`${id}-date`} type="date" className={inputClass} value={draft.injuryDate} max={today} onChange={event => update('injuryDate', event.target.value)} />
          </Field>
          <Field label="Claim or case number" htmlFor={`${id}-claim`} error={errors.claimNumber} hint="The fund's number, when it has given one">
            <input id={`${id}-claim`} className={inputClass} value={draft.claimNumber} maxLength={30} onChange={event => update('claimNumber', event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={needsEmployer(draft.type) ? 'Employer' : 'Employer (if any)'}
            htmlFor={`${id}-employer`}
            error={errors.employerName}
            hint={employers.length > 0 ? "One of the practice's company accounts, or type the name" : undefined}
          >
            {employers.length > 0 && (
              <select
                id={`${id}-employer`}
                className={`${inputClass} mb-2`}
                value={draft.employerAccountId}
                onChange={event => setDraft(current => ({ ...current, employerAccountId: event.target.value, payer: !event.target.value && current.payer === 'employer' ? 'standard' : current.payer }))}
              >
                <option value="">Not a company account (type the name)</option>
                {employers.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            )}
            {!draft.employerAccountId && (
              <input
                id={employers.length > 0 ? `${id}-employer-name` : `${id}-employer`}
                aria-label={employers.length > 0 ? "The employer's name" : undefined}
                className={inputClass}
                value={draft.employerName}
                maxLength={120}
                onChange={event => update('employerName', event.target.value)}
                placeholder="The employer's name"
              />
            )}
          </Field>
          <Field label="Employee number" htmlFor={`${id}-employee`} error={errors.employeeNumber}>
            <input id={`${id}-employee`} className={inputClass} value={draft.employeeNumber} maxLength={30} onChange={event => update('employeeNumber', event.target.value)} />
          </Field>
        </div>

        <div>
          <p className="mb-1 block text-sm font-medium text-gray-700">Who pays</p>
          <ChoiceGroup<CasePayerChoice> label="Who pays" value={draft.payer} onChange={payer => update('payer', payer)} options={payerChoices} disabled={saving} />
          {errors.payer && <p className="mt-1 text-xs text-red-600" role="alert">{errors.payer}</p>}
          {draft.payer === 'account' && (
            <select
              aria-label="The account that pays"
              className={`${inputClass} mt-2`}
              value={draft.payerAccountId}
              onChange={event => update('payerAccountId', event.target.value)}
            >
              <option value="">Choose the account</option>
              {otherPayers.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {draft.payer === 'patient'
              ? "The case's visits are billed to the patient and claimed from their medical aid as usual."
              : "The case's visits are billed to this payer; nothing is claimed from the patient's medical aid."}
          </p>
        </div>

        <Field label="Notes" htmlFor={`${id}-notes`} error={errors.notes}>
          <textarea id={`${id}-notes`} rows={2} className={inputClass} value={draft.notes} maxLength={1000} onChange={event => update('notes', event.target.value)} />
        </Field>
        {injuryCase && (
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" checked={draft.closed} onChange={event => update('closed', event.target.checked)} />
            <span>The case is closed: new visits are no longer billed under it (visits already billed stay as they are)</span>
          </label>
        )}
      </div>
    </Sheet>
  );
};

export default InjuryCaseSheet;
