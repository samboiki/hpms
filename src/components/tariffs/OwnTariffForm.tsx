import React, { useId, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { formatServiceDate, todayKey } from '../../utils/billing/dates';
import { validateOwnTariffDraft, type OwnTariffDraft } from '../../utils/billing/practiceTariffs';
import { saveOwnTariff } from '../../services/practiceTariffService';

interface OwnTariffFormProps {
  practiceId: string;
  /** The code being changed (its current terms), or null to add a new code */
  initial: (Omit<OwnTariffDraft, 'fromDate'> & { shared: boolean }) | null;
  /** Dental practices: a code can need a tooth number */
  dental: boolean;
  onCancel: () => void;
  onSaved: () => void;
}

const INPUT =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#01b9d4] disabled:bg-gray-100';
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500';

/**
 * Adds one code to the practice's own tariff list, or changes one (parity E13): description, price from a date,
 * once per line or per unit, and (dental) whether it needs a tooth. Only this practice's prices change; the shared
 * list of the practice type and other practices stay as they are.
 */
const OwnTariffForm: React.FC<OwnTariffFormProps> = ({ practiceId, initial, dental, onCancel, onSaved }) => {
  const id = useId();
  const [draft, setDraft] = useState<OwnTariffDraft>({
    code: initial?.code ?? '',
    description: initial?.description ?? '',
    price: initial?.price ?? '',
    perUnit: initial?.perUnit ?? false,
    needsTooth: dental && (initial?.needsTooth ?? false),
    fromDate: todayKey()
  });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = validateOwnTariffDraft(draft);
  const editing = initial !== null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (errors.length > 0) return;
    setSaving(true);
    try {
      await saveOwnTariff(practiceId, draft);
      toast.success(`${draft.code.trim().toUpperCase()} saved: billed at the new price from ${formatServiceDate(draft.fromDate)}.`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The code could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4 sm:p-5" aria-labelledby={`${id}-title`} noValidate>
      <div className="flex items-start gap-2">
        <Icon icon={editing ? 'solar:pen-bold-duotone' : 'solar:add-circle-bold-duotone'} className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#01b9d4]" aria-hidden="true" />
        <div>
          <h3 id={`${id}-title`} className="text-base font-semibold text-gray-900">
            {editing ? `Change ${initial.code}` : 'Add a code'}
          </h3>
          <p className="text-sm text-gray-600">
            {editing && initial.shared
              ? "Your practice's own price for this code. From the date below your practice bills it instead of the shared list's price; other practices are not affected."
              : 'Only your practice bills this price. Visits dated before the start date keep the price of their date.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={LABEL}>Code</span>
          <input
            className={`${INPUT} font-mono`}
            value={draft.code}
            onChange={event => setDraft(current => ({ ...current, code: event.target.value.toUpperCase() }))}
            disabled={editing}
            maxLength={10}
            placeholder="e.g. 0190"
            autoFocus={!editing}
          />
        </label>
        <label className="block sm:col-span-1 lg:col-span-2">
          <span className={LABEL}>Description</span>
          <input
            className={INPUT}
            value={draft.description}
            onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
            maxLength={200}
            placeholder="What the patient and the fund see on the invoice"
            autoFocus={editing}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Price (N$)</span>
          <input
            className={INPUT}
            value={draft.price}
            onChange={event => setDraft(current => ({ ...current, price: event.target.value }))}
            inputMode="decimal"
            placeholder="e.g. 450.00"
          />
        </label>
        <label className="block">
          <span className={LABEL}>Price from</span>
          <input
            type="date"
            className={INPUT}
            value={draft.fromDate}
            onChange={event => setDraft(current => ({ ...current, fromDate: event.target.value }))}
          />
        </label>
        <label className="flex items-start gap-2 self-end pb-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
            checked={draft.perUnit}
            onChange={event => setDraft(current => ({ ...current, perUnit: event.target.checked }))}
          />
          <span>
            Charged per unit
            <span className="block text-xs text-gray-500">The line&apos;s quantity can be more than 1</span>
          </span>
        </label>
        {dental && (
          <label className="flex items-start gap-2 self-end pb-2 text-sm text-gray-800">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              checked={draft.needsTooth}
              onChange={event => setDraft(current => ({ ...current, needsTooth: event.target.checked }))}
            />
            <span>
              Needs a tooth
              <span className="block text-xs text-gray-500">Staff choose the tooth on each line</span>
            </span>
          </label>
        )}
      </div>

      {attempted && errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {errors.map(error => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01b9d4] px-4 py-2 text-sm font-medium text-white hover:bg-[#019bb3] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <Icon icon="solar:diskette-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {saving ? 'Saving...' : 'Save the code'}
        </button>
      </div>
    </form>
  );
};

export default OwnTariffForm;
