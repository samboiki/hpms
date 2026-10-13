import React, { useCallback, useEffect, useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { formatServiceDate } from '../../utils/billing/dates';
import {
  PATIENT_RATE_KINDS,
  PATIENT_RATE_LABELS,
  describePatientRate,
  parsePatientRate,
  staffMedicinePrice,
  type PatientRate
} from '../../utils/billing/patientRates';
import { loadPatientRate, savePatientRate, type PatientRateLoad } from '../../services/patientRateService';

interface PatientPriceRatePanelProps {
  practiceId: string;
  patientId: string;
}

// The look of the other sections of the patient's Billing tab (PatientPlansPanel, PatientPayersRegister)
const PRIMARY = 'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed';
const SECONDARY = 'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
const LINK = 'font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded disabled:opacity-50';
const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:bg-gray-50 disabled:text-gray-400';

const SectionHeader: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-cyan-50 text-cyan-700">
        <Icon icon="solar:tag-price-bold-duotone" className="w-5 h-5" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900">Price rate</h3>
        <p className="text-xs text-gray-500">A private, staff or contract rate this patient is billed at.</p>
      </div>
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </header>
);

/** What the rate does, in plain words (patientRates.ts) */
const explain = (rate: PatientRate | null): string => {
  if (!rate) return "Billed at the usual prices: the practice's price list, or the medical aid's own prices.";
  const prices =
    rate.percent === null
      ? 'Services are billed at the usual prices.'
      : `Codes at the practice's price list are billed at ${rate.percent}% of the usual price (what the treating practitioner charges anyone). A medical aid's own prices never change, so claims keep them.`;
  const medicines = staffMedicinePrice(rate) ? ' Medicines from stock are billed at the staff price when the practice has set one.' : '';
  return `${prices}${medicines} New lines on visits and quotes use it; lines already billed keep their prices.`;
};

/**
 * The patient's price rate on the Billing tab of the patient file (parity R28): private, staff or contract, as a
 * percentage of the usual price. Practice administrators and practitioners change it (as the database allows);
 * everyone else sees it. Before the database has rates the section says so and every patient is billed as before.
 */
const PatientPriceRatePanel: React.FC<PatientPriceRatePanelProps> = ({ practiceId, patientId }) => {
  const id = useId();
  const user = useAuthStore(state => state.user);
  const canChange = user?.role === 'admin' || user?.role === 'doctor';
  const [load, setLoad] = useState<PatientRateLoad | { status: 'loading' }>({ status: 'loading' });
  const [draft, setDraft] = useState<{ kind: string; percent: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoad({ status: 'loading' });
    // Never throws: an unreadable rate comes back as 'error'
    setLoad(await loadPatientRate(patientId));
  }, [patientId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rate = load.status === 'ready' ? load.rate : null;
  const parsed = draft ? parsePatientRate(draft.kind, draft.percent) : null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsed || !parsed.ok) return;
    setSaving(true);
    setError(null);
    try {
      await savePatientRate(practiceId, patientId, parsed.value);
      setDraft(null);
      setNotice(parsed.value ? `${describePatientRate(parsed.value)}. New lines on this patient's visits and quotes use it.` : 'The price rate was removed: the usual prices apply again.');
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The price rate could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (load.status === 'not_set_up') {
    return (
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <SectionHeader />
        <p className="px-4 py-4 text-sm text-gray-600">Price rates are not set up in this database yet: every patient is billed at the usual prices.</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <SectionHeader>
        {canChange && load.status === 'ready' && !draft && (
          <button
            type="button"
            className={SECONDARY}
            onClick={() => {
              setNotice(null);
              setError(null);
              setDraft({ kind: rate?.kind ?? '', percent: rate?.percent === null || !rate ? '' : String(rate.percent) });
            }}
          >
            <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" aria-hidden="true" />
            Change
          </button>
        )}
      </SectionHeader>
      <div className="space-y-3 p-4">
        {(notice || error) && (
          <div className={`flex items-start justify-between gap-3 p-3 rounded-lg text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-cyan-50 text-cyan-800'}`} role={error ? 'alert' : 'status'}>
            <span className="flex items-start gap-2">
              <Icon icon={error ? 'solar:danger-triangle-bold-duotone' : 'solar:check-circle-bold-duotone'} className="mt-0.5 w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {error ?? notice}
            </span>
            <button type="button" onClick={() => { setNotice(null); setError(null); }} className="font-medium underline">Dismiss</button>
          </div>
        )}

        {load.status === 'loading' && (
          <div className="h-10 rounded-lg bg-gray-100 animate-pulse motion-reduce:animate-none" role="status" aria-label="Loading the price rate" />
        )}

        {load.status === 'error' && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-red-700" role="alert">
            <span>{load.message}</span>
            <button type="button" className={LINK} onClick={() => void reload()}>Try again</button>
          </div>
        )}

        {load.status === 'ready' && !draft && (
          <div className="text-sm">
            <p className="font-medium text-gray-900">{rate ? describePatientRate(rate) : 'Usual prices'}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {explain(rate)}
              {rate && load.setAt ? ` Set on ${formatServiceDate(load.setAt.slice(0, 10))}.` : ''}
            </p>
            {!canChange && <p className="mt-1 text-xs text-gray-500">A practice administrator or a practitioner can change it.</p>}
          </div>
        )}

        {draft && (
          <form className="grid gap-3 rounded-lg bg-gray-50 p-3 sm:grid-cols-[12rem_12rem_auto] sm:items-end" onSubmit={event => void save(event)}>
            <div>
              <label htmlFor={`${id}-kind`} className="mb-1 block text-sm font-medium text-gray-700">Rate</label>
              <select id={`${id}-kind`} className={INPUT} value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value })} disabled={saving}>
                <option value="">No rate: usual prices</option>
                {PATIENT_RATE_KINDS.map(kind => <option key={kind} value={kind}>{PATIENT_RATE_LABELS[kind]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-percent`} className="mb-1 block text-sm font-medium text-gray-700">% of the usual price</label>
              <input
                id={`${id}-percent`}
                className={INPUT}
                inputMode="decimal"
                placeholder="100"
                maxLength={7}
                value={draft.percent}
                onChange={event => setDraft({ ...draft, percent: event.target.value })}
                disabled={saving || !draft.kind}
                aria-describedby={`${id}-hint`}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" className={SECONDARY} onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
              <button type="submit" className={PRIMARY} disabled={saving || !parsed?.ok}>
                <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:diskette-bold-duotone'} className={`w-4 h-4 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p id={`${id}-hint`} className={`text-xs sm:col-span-3 ${parsed && !parsed.ok ? 'text-red-600' : 'text-gray-500'}`} role={parsed && !parsed.ok ? 'alert' : undefined}>
              {parsed && !parsed.ok
                ? parsed.message
                : draft.kind
                  ? explain(parsed?.ok ? parsed.value : null)
                  : 'The patient is billed at the usual prices.'}
            </p>
          </form>
        )}
      </div>
    </section>
  );
};

export default PatientPriceRatePanel;
