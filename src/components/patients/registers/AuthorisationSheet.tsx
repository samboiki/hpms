import React, { useEffect, useId, useState } from 'react';
import { ChoiceGroup, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../../finance/receipts/ArUi';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { loadFundLogos } from '../../../hooks/useMedicalAidLogo';
import { todayKey } from '../../../utils/billing/dates';
import { MAX_AUTHORISATION_LENGTH } from '../../../utils/billing/lineSplit';
import {
  MAX_AUTHORISATION_NOTE_LENGTH,
  MAX_VISITS_ALLOWED,
  draftOfAuthorisation,
  emptyAuthorisationDraft,
  validateAuthorisationDraft,
  type AuthorisationDraft,
  type AuthorisationField,
  type PatientAuthorisation
} from '../../../utils/billing/authorisations';
import { savePatientAuthorisation } from '../../../services/claimRegistersService';

interface AuthorisationSheetProps {
  patientId: string;
  /** The authorisation to change; null for a new one */
  authorisation: PatientAuthorisation | null;
  /** A new one starts from this (a quote's pre-authorisation number) */
  startFrom?: AuthorisationDraft | null;
  /** The patient's fund (its claim code), chosen for a new authorisation */
  patientFund: string | null;
  onClose: () => void;
  /** Saved: how many lines already billed in its window now carry the number */
  onSaved: (result: { id: string; applied: number }) => void;
}

interface FundChoice {
  reference: string;
  name: string;
}

/**
 * Adds or changes a fund's authorisation on the patient's file (parity D15, F18): the fund, the number, the first and
 * last day, the codes it covers (or all codes) and how many visits it allows. Lines billed in its window for those codes
 * carry the number on the claim; saving also numbers the lines already billed (not those a fund was sent).
 */
const AuthorisationSheet: React.FC<AuthorisationSheetProps> = ({ patientId, authorisation, startFrom = null, patientFund, onClose, onSaved }) => {
  const id = useId();
  const [draft, setDraft] = useState<AuthorisationDraft>(() =>
    authorisation ? draftOfAuthorisation(authorisation) : startFrom ?? emptyAuthorisationDraft(patientFund, todayKey())
  );
  const [funds, setFunds] = useState<FundChoice[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadFundLogos().then(list => {
      if (!live) return;
      const seen = new Set<string>();
      setFunds(
        list
          .map(fund => ({ reference: (fund.reference ?? '').trim().toUpperCase(), name: fund.shortName?.trim() || fund.name }))
          .filter(fund => /^[A-Z0-9]{2,10}$/.test(fund.reference) && !seen.has(fund.reference) && seen.add(fund.reference))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    });
    return () => {
      live = false;
    };
  }, []);

  const checked = validateAuthorisationDraft(draft);
  const errors: Partial<Record<AuthorisationField, string>> = showErrors && !checked.ok ? checked.errors : {};
  const update = <K extends keyof AuthorisationDraft>(key: K, value: AuthorisationDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  // The fund chosen is always offered, also when the list could not be read
  const fundChoices = draft.fundReference && !funds.some(fund => fund.reference === draft.fundReference.toUpperCase())
    ? [{ reference: draft.fundReference.toUpperCase(), name: draft.fundReference.toUpperCase() }, ...funds]
    : funds;

  const save = async () => {
    setShowErrors(true);
    if (!checked.ok) return;
    setSaving(true);
    setSaveError(null);
    try {
      onSaved(await savePatientAuthorisation(authorisation?.id ?? null, patientId, checked.value));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The authorisation could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title={authorisation ? 'Change authorisation' : 'Add an authorisation'}
      subtitle="The number the medical aid gave for this patient. Lines billed in its window for the codes it covers carry it on the claim."
      icon="solar:shield-check-bold-duotone"
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton busy={saving} onClick={() => void save()}>{saving ? 'Saving...' : 'Save authorisation'}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Medical aid" htmlFor={`${id}-fund`} error={errors.fundReference}>
            <div className="flex items-center gap-2">
              {draft.fundReference && <MedicalAidLogo name={draft.fundReference} />}
              <select id={`${id}-fund`} className={inputClass} value={draft.fundReference.toUpperCase()} onChange={event => update('fundReference', event.target.value)} disabled={saving}>
                <option value="">Choose the fund</option>
                {fundChoices.map(fund => (
                  <option key={fund.reference} value={fund.reference}>{fund.name} ({fund.reference})</option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Authorisation number" htmlFor={`${id}-number`} error={errors.number} hint={`At most ${MAX_AUTHORISATION_LENGTH} letters or digits, as the fund wrote it`}>
            <input id={`${id}-number`} className={inputClass} maxLength={MAX_AUTHORISATION_LENGTH} value={draft.number} onChange={event => update('number', event.target.value)} disabled={saving} />
          </Field>
          <Field label="First day" htmlFor={`${id}-from`} error={errors.validFrom}>
            <input id={`${id}-from`} type="date" className={inputClass} value={draft.validFrom} onChange={event => update('validFrom', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Last day" htmlFor={`${id}-to`} error={errors.validTo}>
            <input id={`${id}-to`} type="date" className={inputClass} min={draft.validFrom || undefined} value={draft.validTo} onChange={event => update('validTo', event.target.value)} disabled={saving} />
          </Field>
        </div>

        <div>
          <p className="mb-1 block text-sm font-medium text-gray-700">What it covers</p>
          <ChoiceGroup
            label="What the authorisation covers"
            value={draft.allCodes ? 'all' : 'codes'}
            onChange={value => update('allCodes', value === 'all')}
            options={[
              { value: 'codes', label: 'These codes', icon: 'solar:document-medicine-bold-duotone' },
              { value: 'all', label: 'All codes', icon: 'solar:check-circle-bold-duotone' }
            ]}
            disabled={saving}
          />
          {!draft.allCodes && (
            <Field label="Tariff codes" htmlFor={`${id}-codes`} error={errors.codes} hint="Separated by commas or spaces, for example 0190, 0191" className="mt-3">
              <input id={`${id}-codes`} className={inputClass} value={draft.codes} onChange={event => update('codes', event.target.value)} disabled={saving} />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Visits allowed" htmlFor={`${id}-visits`} error={errors.visitsAllowed} hint="Leave empty when the fund set no limit">
            <input id={`${id}-visits`} className={inputClass} inputMode="numeric" maxLength={String(MAX_VISITS_ALLOWED).length} value={draft.visitsAllowed} onChange={event => update('visitsAllowed', event.target.value)} disabled={saving} />
          </Field>
          <Field label="Note (optional)" htmlFor={`${id}-note`} error={errors.note} hint="For example who at the fund approved it">
            <input id={`${id}-note`} className={inputClass} maxLength={MAX_AUTHORISATION_NOTE_LENGTH} value={draft.note} onChange={event => update('note', event.target.value)} disabled={saving} />
          </Field>
        </div>

        {draft.quoteId && <p className="text-xs text-gray-500">From the quote&apos;s pre-authorisation: check the window and codes against the fund&apos;s letter before saving.</p>}
        {saveError && <ErrorBox>{saveError}</ErrorBox>}
      </div>
    </Sheet>
  );
};

export default AuthorisationSheet;
