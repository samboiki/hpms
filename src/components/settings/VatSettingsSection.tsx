import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { loadVatSettings, saveVatSettings } from '../../services/vatSettingsService';
import { NOT_VAT_REGISTERED, STANDARD_VAT_RATE, VAT_NUMBER_MAX, checkVatSettings, type VatSettings } from '../../utils/billing/vat';

interface VatSettingsSectionProps {
  practiceId: string | null | undefined;
  /** Practice administrators: the database refuses anyone else */
  canChange: boolean;
}

/**
 * Settings > Practice: whether the practice is VAT registered and its VAT number (owner, 13 Oct 2026). When it is,
 * VAT applies only to VAT-able stock items (frames, over-the-counter medicines); services stay exempt. Laid out like the
 * practice type section above it.
 */
export const VatSettingsSection: React.FC<VatSettingsSectionProps> = ({ practiceId, canChange }) => {
  const [saved, setSaved] = useState<VatSettings | null>(null);
  const [draft, setDraft] = useState<VatSettings>(NOT_VAT_REGISTERED);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    void loadVatSettings(practiceId).then(settings => {
      if (cancelled) return;
      setSaved(settings);
      setDraft(settings);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  if (!practiceId) return null;

  const dirty = !!saved && (saved.registered !== draft.registered || (draft.registered && saved.vatNumber !== draft.vatNumber.trim()));
  const check = checkVatSettings(draft);

  const save = async () => {
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      const result = await saveVatSettings(practiceId, draft);
      setSaved(result);
      setDraft(result);
      setDone(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The VAT setting was not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg bg-gray-50 p-6" aria-labelledby="practice-vat-heading">
      <h3 id="practice-vat-heading" className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Icon icon="solar:bill-list-bold-duotone" className="h-5 w-5 text-purple-600" aria-hidden="true" />
        VAT
      </h3>
      <p className="mb-4 text-sm text-gray-600">
        A VAT-registered practice charges {STANDARD_VAT_RATE}% VAT on stock it sells, such as frames and over-the-counter medicines. Consultations and other
        services stay VAT exempt. Which stock items carry VAT is set on each item in Stock.
      </p>

      {!saved && <p className="text-sm text-gray-500" role="status">Loading...</p>}

      {saved && (
        <div className="space-y-3">
          <p className="text-sm text-gray-900">
            <span className="font-medium">Now: </span>
            {saved.registered ? `VAT registered, VAT number ${saved.vatNumber}` : 'Not VAT registered: no VAT is charged'}
          </p>

          {canChange ? (
            <div className="space-y-3">
              <fieldset>
                <legend className="mb-1 block text-sm font-medium text-gray-700">Is the practice VAT registered?</legend>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: true, label: 'Yes' },
                    { value: false, label: 'No' }
                  ].map(option => (
                    <label key={option.label} className="inline-flex items-center gap-2 text-sm text-gray-900">
                      <input
                        type="radio"
                        name="practice-vat-registered"
                        checked={draft.registered === option.value}
                        onChange={() => {
                          setDraft(current => ({ ...current, registered: option.value }));
                          setError(null);
                          setDone(false);
                        }}
                        className="h-4 w-4 border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                {draft.registered && (
                  <div className="min-w-0 sm:w-80">
                    <label htmlFor="practice-vat-number" className="mb-1 block text-sm font-medium text-gray-700">
                      VAT number
                    </label>
                    <input
                      id="practice-vat-number"
                      type="text"
                      value={draft.vatNumber}
                      maxLength={VAT_NUMBER_MAX}
                      onChange={event => {
                        setDraft(current => ({ ...current, vatNumber: event.target.value }));
                        setError(null);
                        setDone(false);
                      }}
                      aria-invalid={error ? true : undefined}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!dirty || saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:diskette-bold-duotone'} className={`h-4 w-4 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
                  {saving ? 'Saving...' : 'Save VAT'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Only a practice administrator can change the VAT setting.</p>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {done && (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
              <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 shrink-0" aria-hidden="true" />
              Saved. New invoices and stock prices follow it.
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default VatSettingsSection;
