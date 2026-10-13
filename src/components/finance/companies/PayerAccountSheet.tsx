import React, { useId, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { ChoiceGroup, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';
import { RegionSelect, TownPicker } from '../../address/TownPicker';
import { savePayerAccount } from '../../../services/payerAccountService';
import {
  PAYER_ACCOUNT_KINDS,
  PAYER_FIELD_LIMITS,
  PAYER_KIND_HINTS,
  PAYER_KIND_LABELS,
  draftOfPayerAccount,
  emptyPayerAccountDraft,
  validatePayerAccountDraft,
  type PayerAccount,
  type PayerAccountDraft,
  type PayerAccountField,
  type PayerAccountKind
} from '../../../utils/accounts/payerAccounts';

interface PayerAccountSheetProps {
  practiceId: string;
  /** The account to change; null for a new one */
  account: PayerAccount | null;
  onClose: () => void;
  onSaved: (account: PayerAccount) => void;
}

const KIND_CHOICES = PAYER_ACCOUNT_KINDS.map(kind => ({ value: kind, label: PAYER_KIND_LABELS[kind] }));

/**
 * Adds or changes a company or fund account (parity A14): who it is, how to reach it, and where its statements go. The
 * account number (AC-0001) is given by the database. The database checks everything again (save_payer_account).
 */
export const PayerAccountSheet: React.FC<PayerAccountSheetProps> = ({ practiceId, account, onClose, onSaved }) => {
  const id = useId();
  const [draft, setDraft] = useState<PayerAccountDraft>(() => (account ? draftOfPayerAccount(account) : emptyPayerAccountDraft()));
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const checked = validatePayerAccountDraft(draft);
  const errors: Partial<Record<PayerAccountField, string>> = showErrors && !checked.ok ? checked.errors : {};
  const update = (key: PayerAccountField, value: string) => setDraft(current => ({ ...current, [key]: value }));

  const save = async () => {
    setShowErrors(true);
    if (!checked.ok) return;
    setSaving(true);
    setSaveError(null);
    try {
      onSaved(await savePayerAccount(practiceId, account?.id ?? null, checked.value));
    } catch (error) {
      setSaveError(error instanceof Error ? plainWords(error.message) : 'The account could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const text = (key: Exclude<PayerAccountField, 'kind' | 'region' | 'town'>, label: string, options: { type?: string; hint?: string; inputMode?: 'tel' | 'email' } = {}) => (
    <Field label={label} htmlFor={`${id}-${key}`} error={errors[key]} hint={options.hint}>
      <input
        id={`${id}-${key}`}
        type={options.type ?? 'text'}
        inputMode={options.inputMode}
        className={inputClass}
        value={draft[key]}
        maxLength={PAYER_FIELD_LIMITS[key]}
        onChange={event => update(key, event.target.value)}
      />
    </Field>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      icon="solar:buildings-2-bold-duotone"
      title={account ? `Change ${account.name}` : 'New company or fund account'}
      subtitle={account ? `Account ${account.accountNumber}` : 'Invoices of the visits billed to it are its to pay, with its own statement and age analysis.'}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={saving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton onClick={() => void save()} busy={saving}>
            {account ? 'Save changes' : 'Add account'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {saveError && <ErrorBox>{saveError}</ErrorBox>}
        <div>
          <p className="mb-1 block text-sm font-medium text-gray-700">What kind of account</p>
          <ChoiceGroup<PayerAccountKind> label="What kind of account" value={draft.kind} onChange={kind => update('kind', kind)} options={KIND_CHOICES} disabled={saving} />
          <p className="mt-1 text-xs text-gray-500">{PAYER_KIND_HINTS[draft.kind]}</p>
          {errors.kind && <p className="mt-1 text-xs text-red-600" role="alert">{errors.kind}</p>}
        </div>
        {text('name', 'Name', { hint: 'As it should appear on invoices and statements, e.g. "Test Builders (Pty) Ltd"' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text('registrationNumber', 'Registration number')}
          {text('vatNumber', 'VAT number')}
          {text('contactName', 'Contact person', { hint: 'Who receives the statements' })}
          {text('phone', 'Phone', { type: 'tel', inputMode: 'tel' })}
        </div>
        {text('email', 'Email address', { type: 'email', inputMode: 'email' })}
        <Field label="Postal address" htmlFor={`${id}-postalAddress`} error={errors.postalAddress} hint="PO Box or Private Bag and the town, one line each">
          <textarea
            id={`${id}-postalAddress`}
            rows={3}
            className={inputClass}
            value={draft.postalAddress}
            maxLength={PAYER_FIELD_LIMITS.postalAddress}
            onChange={event => update('postalAddress', event.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Town" htmlFor={`${id}-town`} error={errors.town}>
            <TownPicker
              id={`${id}-town`}
              value={draft.town}
              onChange={value => update('town', value)}
              onPick={(town, region) => setDraft(current => ({ ...current, town, region }))}
              inputClassName={inputClass}
            />
          </Field>
          <Field label="Region" htmlFor={`${id}-region`} error={errors.region}>
            <RegionSelect id={`${id}-region`} value={draft.region} onChange={value => update('region', value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Notes" htmlFor={`${id}-notes`} error={errors.notes}>
          <textarea id={`${id}-notes`} rows={2} className={inputClass} value={draft.notes} maxLength={PAYER_FIELD_LIMITS.notes} onChange={event => update('notes', event.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
};

export default PayerAccountSheet;
