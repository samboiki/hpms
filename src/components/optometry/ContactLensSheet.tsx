import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, SECONDARY, errorText } from '../stock/stockUi';
import { formatServiceDate, isValidDateKey, todayKey } from '../../utils/billing/dates';
import { loadSuppliers } from '../../services/stock/stockService';
import { saveSupply, setSupplyStatus } from '../../services/optometry/optometryService';
import {
  REPLACEMENTS,
  REPLACEMENT_LABELS,
  emptySupplyDraft,
  suggestedRunOut,
  supplyRunsOutOn,
  validateSupplyDraft,
  type Replacement,
  type SupplyDraft,
  type SupplyDraftErrors
} from '../../utils/optometry/contactLenses';
import type { PrescriptionRecord, SupplyRecord } from '../../utils/optometry/records';
import type { Supplier } from '../../utils/stock/stockRows';

interface ContactLensSheetProps {
  open: boolean;
  onClose: () => void;
  practiceId: string;
  patientId: string;
  /** The patient's current contact-lens prescriptions, newest first */
  prescriptions: readonly PrescriptionRecord[];
  onSaved: () => void;
}

/**
 * Contact lenses handed to the patient (or ordered for them): which lenses, how often they are replaced and how many
 * each eye has. The day they run out is worked out and can be changed; it puts the patient on the "Contact lenses
 * running out" list in time to order more.
 */
const ContactLensSheet: React.FC<ContactLensSheetProps> = ({ open, onClose, practiceId, patientId, prescriptions, onSaved }) => {
  const today = todayKey();
  const [draft, setDraft] = useState<SupplyDraft>(emptySupplyDraft(today));
  const [runOutTouched, setRunOutTouched] = useState(false);
  const [errors, setErrors] = useState<SupplyDraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    if (!open) return;
    const latest = prescriptions[0] ?? null;
    setDraft(emptySupplyDraft(today, latest?.lensName ?? '', latest?.id ?? ''));
    setRunOutTouched(false);
    setErrors({});
    setFormError(null);
    let cancelled = false;
    loadSuppliers(practiceId)
      .then(rows => {
        if (!cancelled) setSuppliers(rows.filter(row => row.isActive));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, prescriptions, practiceId, today]);

  // The run-out day follows the supply until someone changes it by hand
  const suggestion = suggestedRunOut(draft);
  useEffect(() => {
    if (!runOutTouched && suggestion) setDraft(current => (current.runsOutOn === suggestion ? current : { ...current, runsOutOn: suggestion }));
  }, [suggestion, runOutTouched]);

  const set = (patch: Partial<SupplyDraft>) => setDraft(current => ({ ...current, ...patch }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateSupplyDraft(draft, today);
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError('Check the marked boxes.');
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      await saveSupply({ ...checked.payload, patient_id: patientId });
      toast.success(draft.status === 'collected' ? 'Contact lenses recorded.' : 'Contact lens order recorded.');
      onSaved();
      onClose();
    } catch (failure) {
      setFormError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      size="lg"
      title="Contact lenses"
      subtitle="Record lenses handed to the patient, or ordered for them."
      dismissible={!busy}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {formError && <p className="text-sm text-red-700 sm:mr-auto" role="alert">{formError}</p>}
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="optometry-supply-form" className={PRIMARY} disabled={busy}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Save
          </button>
        </div>
      }
    >
      <form id="optometry-supply-form" onSubmit={save} noValidate className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-gray-700">The lenses are</legend>
          <div className="inline-flex flex-wrap rounded-lg bg-gray-100 p-0.5" role="group">
            {(['collected', 'ordered'] as const).map(option => (
              <button
                key={option}
                type="button"
                aria-pressed={draft.status === option}
                onClick={() => set({ status: option })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  draft.status === option ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {option === 'collected' ? 'Handed to the patient' : 'Ordered from the supplier'}
              </button>
            ))}
          </div>
        </fieldset>
        {prescriptions.length > 0 && (
          <Field label="Prescription">
            {props => (
              <select
                {...props}
                className={INPUT}
                value={draft.prescriptionId}
                onChange={event => {
                  const chosen = prescriptions.find(item => item.id === event.target.value);
                  set({ prescriptionId: event.target.value, lensName: chosen?.lensName ?? draft.lensName });
                }}
              >
                <option value="">None</option>
                {prescriptions.map(item => (
                  <option key={item.id} value={item.id}>
                    {formatServiceDate(item.prescribedOn)}{item.lensName ? ` · ${item.lensName}` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label="Lenses" error={errors.lensName} hint="Brand and product, as on the box">
          {props => <input {...props} className={INPUT} value={draft.lensName} maxLength={80} onChange={event => set({ lensName: event.target.value })} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Replaced" error={errors.replacement}>
            {props => (
              <select {...props} className={INPUT} value={draft.replacement} onChange={event => set({ replacement: event.target.value as Replacement | '' })}>
                <option value="">Choose</option>
                {REPLACEMENTS.map(option => (
                  <option key={option} value={option}>{REPLACEMENT_LABELS[option]}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Lenses for each eye" error={errors.lensesPerEye} hint="E.g. 2 boxes of 30 = 60">
            {props => <input {...props} className={INPUT} inputMode="numeric" value={draft.lensesPerEye} onChange={event => set({ lensesPerEye: event.target.value })} />}
          </Field>
        </div>
        {draft.status === 'collected' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Handed over on" error={errors.startOn}>
              {props => <input {...props} type="date" className={INPUT} max={today} value={draft.startOn} onChange={event => set({ startOn: event.target.value })} />}
            </Field>
            <Field label="Run out on" error={errors.runsOutOn} hint={suggestion ? `Worked out: ${formatServiceDate(suggestion)}` : 'Worked out from the replacement and the number of lenses'}>
              {props => (
                <input
                  {...props}
                  type="date"
                  className={INPUT}
                  min={draft.startOn}
                  value={draft.runsOutOn}
                  onChange={event => {
                    setRunOutTouched(true);
                    set({ runsOutOn: event.target.value });
                  }}
                />
              )}
            </Field>
          </div>
        )}
        <Field label="Supplier (optional)">
          {props => (
            <select {...props} className={INPUT} value={draft.supplierId} onChange={event => set({ supplierId: event.target.value })}>
              <option value="">Not named</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Notes (optional)" error={errors.notes}>
          {props => <textarea {...props} rows={2} className={INPUT} value={draft.notes} maxLength={300} onChange={event => set({ notes: event.target.value })} />}
        </Field>
      </form>
    </ListSheet>
  );
};

export default ContactLensSheet;

/** An ordered supply handed to the patient: the day, and the day it runs out (worked out from the supply). */
export const CollectSupplySheet: React.FC<{ supply: SupplyRecord | null; onClose: () => void; onSaved: () => void }> = ({ supply, onClose, onSaved }) => {
  const today = todayKey();
  const [on, setOn] = useState(today);
  const [runsOut, setRunsOut] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supply) return;
    setOn(today);
    setRunsOut(supplyRunsOutOn(today, supply.replacement, supply.lensesPerEye));
    setError(null);
  }, [supply, today]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supply) return;
    if (!isValidDateKey(on) || on > today) return setError('Choose the day the patient got the lenses.');
    if (!isValidDateKey(runsOut) || runsOut <= on) return setError('The lenses run out after the day they were collected.');
    setBusy(true);
    try {
      await setSupplyStatus(supply.id, 'collected', { on, runsOutOn: runsOut });
      toast.success('Contact lenses marked collected.');
      onSaved();
      onClose();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListSheet
      open={supply !== null}
      onClose={onClose}
      title="Lenses collected"
      subtitle={supply ? `${supply.lensName} · ${REPLACEMENT_LABELS[supply.replacement]}, ${supply.lensesPerEye} for each eye` : undefined}
      dismissible={!busy}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {error && <p className="text-sm text-red-700 sm:mr-auto" role="alert">{error}</p>}
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            Back
          </button>
          <button type="submit" form="optometry-collect-form" className={PRIMARY} disabled={busy}>
            Save
          </button>
        </div>
      }
    >
      <form id="optometry-collect-form" onSubmit={save} noValidate className="grid grid-cols-2 gap-3">
        <Field label="Collected on">
          {props => (
            <input
              {...props}
              type="date"
              className={INPUT}
              max={today}
              value={on}
              onChange={event => {
                setOn(event.target.value);
                if (supply && isValidDateKey(event.target.value)) setRunsOut(supplyRunsOutOn(event.target.value, supply.replacement, supply.lensesPerEye));
              }}
            />
          )}
        </Field>
        <Field label="Run out on">
          {props => <input {...props} type="date" className={INPUT} min={on} value={runsOut} onChange={event => setRunsOut(event.target.value)} />}
        </Field>
      </form>
    </ListSheet>
  );
};
