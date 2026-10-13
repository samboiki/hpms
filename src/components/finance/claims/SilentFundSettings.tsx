import React, { useMemo, useState } from 'react';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { fundLabel } from '../../../utils/remittance/funds';
import {
  SILENT_DAYS_MAX,
  SILENT_DAYS_MIN,
  describeSilentFundDays,
  fundCodeOf,
  type SilentFundDays
} from './batchFollowUp';
import type { FundProvider } from './types';

interface SilentFundSettingsProps {
  settings: SilentFundDays;
  funds: readonly FundProvider[];
  /** Practice administrators change it; everyone else reads it */
  canEdit: boolean;
  onSave: (next: SilentFundDays) => Promise<void>;
}

const DAYS = /^\d{1,3}$/;
const daysOf = (text: string): number | null => {
  const trimmed = text.trim();
  if (!DAYS.test(trimmed)) return null;
  const days = Number(trimmed);
  return days >= SILENT_DAYS_MIN && days <= SILENT_DAYS_MAX ? days : null;
};

/**
 * When a fund counts as not having answered: one wait for every fund and a wait per fund (PSEMAS 60 days unless the
 * practice changes it). Shown in plain words beside the "Funds that have not answered" alert; administrators change
 * it there.
 */
export const SilentFundSettings: React.FC<SilentFundSettingsProps> = ({ settings, funds, canEdit, onSave }) => {
  const fundCodes = useMemo(
    () => [...new Map(funds.filter(fund => fund.medical_aid_reference).map(fund => [fundCodeOf(fund.medical_aid_reference), fund.name] as const)).entries()],
    [funds]
  );
  const nameOf = (code: string) => fundCodes.find(([fundCode]) => fundCode === code)?.[1] ?? fundLabel(code);
  const [editing, setEditing] = useState(false);
  const [defaultText, setDefaultText] = useState('');
  const [fundText, setFundText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setDefaultText(String(settings.default));
    setFundText(Object.fromEntries(fundCodes.map(([code]) => [code, settings.byFund[code] !== undefined ? String(settings.byFund[code]) : ''])));
    setError(null);
    setEditing(true);
  };

  const defaultDays = daysOf(defaultText);
  const invalidFunds = fundCodes.filter(([code]) => (fundText[code] ?? '').trim() && daysOf(fundText[code] ?? '') === null).map(([code]) => code);
  const canSave = !saving && defaultDays !== null && invalidFunds.length === 0;

  const save = async () => {
    if (!canSave || defaultDays === null) return;
    const byFund: Record<string, number> = {};
    for (const [code] of fundCodes) {
      const days = daysOf(fundText[code] ?? '');
      if (days !== null) byFund[code] = days;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ default: defaultDays, byFund });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The setting could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-700">
        <span>{describeSilentFundDays(settings, nameOf)}</span>
        {canEdit && (
          <button type="button" onClick={start} className="font-medium text-cyan-700 underline-offset-2 hover:underline">
            Change
          </button>
        )}
      </p>
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-amber-200 bg-white p-3 text-sm"
      aria-label="When to warn about funds that have not answered"
      onSubmit={event => {
        event.preventDefault();
        void save();
      }}
    >
      <label className="flex flex-wrap items-center gap-2 text-gray-800">
        Warn when a fund has not answered after
        <input
          type="text"
          inputMode="numeric"
          value={defaultText}
          onChange={event => setDefaultText(event.target.value)}
          aria-invalid={defaultDays === null}
          className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-right tabular-nums"
        />
        days
      </label>
      {fundCodes.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs text-gray-600">A different wait for a fund (leave empty to use the days above)</legend>
          {fundCodes.map(([code, name]) => (
            <label key={code} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 text-gray-800 sm:max-w-md">
              <MedicalAidLogo name={code} />
              <span className="break-words">{name}</span>
              <input
                type="text"
                inputMode="numeric"
                value={fundText[code] ?? ''}
                onChange={event => setFundText(previous => ({ ...previous, [code]: event.target.value }))}
                placeholder={defaultDays !== null ? String(defaultDays) : ''}
                aria-label={`Days to wait for ${name}`}
                aria-invalid={invalidFunds.includes(code)}
                className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-right tabular-nums"
              />
              days
            </label>
          ))}
        </fieldset>
      )}
      {(defaultDays === null || invalidFunds.length > 0) && (
        <p className="text-xs text-red-700" role="alert">Use whole days from {SILENT_DAYS_MIN} to {SILENT_DAYS_MAX}.</p>
      )}
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!canSave} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
};
