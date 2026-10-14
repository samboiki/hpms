import React, { useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { EmptyState } from '../finance/FinanceUI';
import { refreshAfterSave } from '../../lib/queryClient';
import { usePracticeTariffs } from '../../contexts/PracticeTariffsContext';
import { useAuthStore } from '../../stores/authStore';
import { useWardTariffs, wardTariffLookup } from './useWardTariffs';
import { saveBed, saveWard, type Bed, type Ward, type WardBoard } from '../../services/inpatientService';
import { BED_TYPES, BED_STATUS_LABELS, labelOf, ROOM_TYPES, WARD_TYPES, type BedStatus } from '../../utils/inpatient/inpatientRules';
import { toCents } from '../../utils/billing/money';
import { Chip, Field } from '../stock/stockParts';
import { CARD, INPUT, PRIMARY, QUIET, SECONDARY, errorText, nad } from '../stock/stockUi';
import { rateOf } from './inpatientData';

/** Wards and beds (administrators): names, visiting hours, daily rates and the codes a stay is billed under */
export const WardSetupTab: React.FC<{ board: WardBoard }> = ({ board }) => {
  const [editingWard, setEditingWard] = useState<{ ward: Ward | null } | null>(null);
  const [editingBed, setEditingBed] = useState<{ ward: Ward; bed: Bed | null } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Each ward&apos;s bed-day code is billed once per night at the bed&apos;s daily rate (a bed with none: at the code&apos;s amount on the price list); its daily codes once per night at their tariff price.
        </p>
        <button type="button" onClick={() => setEditingWard({ ward: null })} className={PRIMARY}>
          <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Add a ward
        </button>
      </div>

      {board.wards.length === 0 && (
        <EmptyState icon="solar:hospital-bold-duotone" title="No wards yet" message="Add a ward, then its beds with their daily rates." />
      )}

      {board.wards.map(ward => {
        const beds = board.beds.filter(bed => bed.ward_id === ward.id);
        return (
          <section key={ward.id} className={`${CARD} p-3 sm:p-5`} aria-label={ward.ward_name}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900">
                  {ward.ward_name}
                  {ward.ward_code && <span className="text-xs font-normal text-gray-500">{ward.ward_code}</span>}
                  {ward.is_active === false && <Chip tone="gray">Closed</Chip>}
                </h2>
                <p className="text-xs text-gray-500">
                  {labelOf(WARD_TYPES, ward.ward_type)} · Bed-day code {ward.bed_day_code || <strong className="text-amber-700">not set</strong>}
                  {(ward.daily_codes ?? []).length > 0 && ` · Daily codes ${(ward.daily_codes ?? []).join(', ')}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditingWard({ ward })} className={QUIET}>
                  <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  Change ward
                </button>
                <button type="button" onClick={() => setEditingBed({ ward, bed: null })} className={SECONDARY}>
                  <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  Add a bed
                </button>
              </div>
            </div>
            {beds.length === 0 ? (
              <p className="text-sm text-gray-500">No beds yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {beds.map(bed => {
                  const rate = rateOf(bed);
                  return (
                    <li key={bed.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0 text-sm">
                        <span className="font-medium text-gray-900">Bed {bed.bed_number}</span>
                        <span className="text-gray-500">
                          {bed.room_number ? ` · Room ${bed.room_number}` : ''} · {labelOf(BED_TYPES, bed.bed_type)} · {rate === null ? 'no daily rate' : `${nad(toCents(rate))} a day`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {bed.is_active === false
                          ? <Chip tone="gray">Not in use</Chip>
                          : <Chip>{BED_STATUS_LABELS[(bed.status ?? 'available') as BedStatus] ?? bed.status}</Chip>}
                        <button type="button" onClick={() => setEditingBed({ ward, bed })} className={QUIET} aria-label={`Change bed ${bed.bed_number}`}>
                          <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Change
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {editingWard && <WardSheet ward={editingWard.ward} onClose={() => setEditingWard(null)} />}
      {editingBed && <BedFormSheet ward={editingBed.ward} bed={editingBed.bed} onClose={() => setEditingBed(null)} />}
    </div>
  );
};

/** "Surgical cases" from "SURGICAL CASES: PER DAY" (the line above says they are per day) */
const wardCodeLabel = (description: string | null): string => {
  const text = (description ?? '').split(':')[0].trim().toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

/** Saves through a database function, then refreshes every inpatient screen */
function useSave(onClose: () => void) {
  const [saving, setSaving] = useState(false);
  const run = async (save: () => Promise<unknown>, done: string) => {
    setSaving(true);
    try {
      await save();
      await refreshAfterSave('inpatient');
      toast.success(done);
      onClose();
    } catch (error) {
      toast.error(errorText(error, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };
  return { saving, run };
}

const WardSheet: React.FC<{ ward: Ward | null; onClose: () => void }> = ({ ward, onClose }) => {
  const formId = useId();
  const codesId = useId();
  const { allTariffs, practiceType } = usePracticeTariffs();
  const practiceId = useAuthStore(state => state.selectedPracticeId || state.user?.practice_id || null);
  // The private hospital's ward fees per day are offered for the bed-day code (NAMAF list, discipline 057)
  const namaf = useWardTariffs(practiceId, practiceType);
  const wardDayCodes = namaf.data?.wardDayCodes ?? [];
  const [values, setValues] = useState({
    ward_name: ward?.ward_name ?? '',
    ward_code: ward?.ward_code ?? '',
    ward_type: ward?.ward_type ?? 'general',
    floor_number: ward?.floor_number === null || ward?.floor_number === undefined ? '' : String(ward.floor_number),
    visiting_hours_start: ward?.visiting_hours_start?.slice(0, 5) ?? '',
    visiting_hours_end: ward?.visiting_hours_end?.slice(0, 5) ?? '',
    max_visitors_per_patient: String(ward?.max_visitors_per_patient ?? 2),
    bed_day_code: ward?.bed_day_code ?? '',
    daily_codes: (ward?.daily_codes ?? []).join(', '),
    description: ward?.description ?? '',
    is_active: ward?.is_active !== false
  });
  const set = (key: keyof typeof values, value: string | boolean) => setValues(current => ({ ...current, [key]: value }));
  const { saving, run } = useSave(onClose);
  // What a code will bill as, looked up exactly as the stay bill looks it up
  const lookup = wardTariffLookup(allTariffs, namaf.data?.practiceList ?? [], wardDayCodes);
  const tariffName = (code: string) => (code.trim() ? lookup(code)?.description || undefined : undefined);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { ...values, daily_codes: values.daily_codes.split(/[,\s]+/).filter(Boolean) };
    void run(() => saveWard(ward?.id ?? null, payload), ward ? `${values.ward_name} saved.` : `${values.ward_name} added.`);
  };

  return (
    <ListSheet open onClose={onClose} title={ward ? `Change ${ward.ward_name}` : 'Add a ward'} dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" form={formId} disabled={saving} className={PRIMARY}>Save ward</button>
        </div>
      }>
      <form id={formId} onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Name" className="sm:col-span-2">
          {props => <input {...props} value={values.ward_name} onChange={event => set('ward_name', event.target.value)} className={INPUT} maxLength={120} autoFocus />}
        </Field>
        <Field label="Short code" hint="Optional, e.g. W2">
          {props => <input {...props} value={values.ward_code} onChange={event => set('ward_code', event.target.value)} className={INPUT} maxLength={20} />}
        </Field>
        <Field label="Kind of ward">
          {props => (
            <select {...props} value={values.ward_type} onChange={event => set('ward_type', event.target.value)} className={INPUT}>
              {WARD_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Visiting from">
          {props => <input {...props} type="time" value={values.visiting_hours_start} onChange={event => set('visiting_hours_start', event.target.value)} className={INPUT} />}
        </Field>
        <Field label="Visiting until">
          {props => <input {...props} type="time" value={values.visiting_hours_end} onChange={event => set('visiting_hours_end', event.target.value)} className={INPUT} />}
        </Field>
        <Field label="Visitors at a time">
          {props => <input {...props} inputMode="numeric" value={values.max_visitors_per_patient} onChange={event => set('max_visitors_per_patient', event.target.value)} className={INPUT} />}
        </Field>
        <Field label="Floor" hint="Optional">
          {props => <input {...props} inputMode="numeric" value={values.floor_number} onChange={event => set('floor_number', event.target.value)} className={INPUT} />}
        </Field>
        <Field label="Bed-day code" hint={tariffName(values.bed_day_code) ?? 'The tariff code a night is billed under, at the bed’s daily rate'}>
          {props => <input {...props} list={codesId} value={values.bed_day_code} onChange={event => set('bed_day_code', event.target.value)} className={INPUT} maxLength={20} />}
        </Field>
        {wardDayCodes.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs text-gray-500">Ward fees per day (NAMAF private hospital list): tap one to use it as the bed-day code. A night is billed at the bed&apos;s daily rate; a bed with no rate is billed at the amount the list shows, and where the list has none you type it when the stay is billed.</p>
            <div className="flex flex-wrap gap-1.5">
              {wardDayCodes.map(tariff => (
                <button
                  key={tariff.id}
                  type="button"
                  onClick={() => set('bed_day_code', tariff.code)}
                  aria-pressed={values.bed_day_code.trim().toUpperCase() === tariff.code}
                  className={`rounded-lg px-2.5 py-1.5 text-left text-xs ring-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${values.bed_day_code.trim().toUpperCase() === tariff.code ? 'bg-cyan-50 text-cyan-800 ring-cyan-300' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'}`}
                >
                  <span className="font-semibold">{tariff.code}</span> {wardCodeLabel(tariff.description)}
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Daily codes" hint="Optional: codes billed once per night at their tariff price, separated by commas">
          {props => <input {...props} value={values.daily_codes} onChange={event => set('daily_codes', event.target.value)} className={INPUT} />}
        </Field>
        <datalist id={codesId}>
          {allTariffs.slice(0, 500).map(tariff => <option key={tariff.id} value={tariff.code}>{tariff.description}</option>)}
        </datalist>
        <Field label="Notes" className="sm:col-span-2">
          {props => <input {...props} value={values.description} onChange={event => set('description', event.target.value)} className={INPUT} maxLength={500} />}
        </Field>
        {ward && (
          <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-gray-800 sm:col-span-2">
            <input type="checkbox" checked={values.is_active} onChange={event => set('is_active', event.target.checked)} className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
            Ward open (untick to close it; only possible with nobody in it)
          </label>
        )}
      </form>
    </ListSheet>
  );
};

const BedFormSheet: React.FC<{ ward: Ward; bed: Bed | null; onClose: () => void }> = ({ ward, bed, onClose }) => {
  const formId = useId();
  const [values, setValues] = useState({
    bed_number: bed?.bed_number ?? '',
    bed_code: bed?.bed_code ?? '',
    room_number: bed?.room_number ?? '',
    bed_type: bed?.bed_type ?? 'standard',
    room_type: bed?.room_type ?? '',
    daily_rate: bed && rateOf(bed) !== null ? String(rateOf(bed)) : '',
    notes: bed?.notes ?? '',
    is_active: bed?.is_active !== false
  });
  const set = (key: keyof typeof values, value: string | boolean) => setValues(current => ({ ...current, [key]: value }));
  const { saving, run } = useSave(onClose);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { ...values, daily_rate: values.daily_rate.replace(/[N$\s,]/g, '') };
    void run(() => saveBed(bed?.id ?? null, ward.id, payload), bed ? `Bed ${values.bed_number} saved.` : `Bed ${values.bed_number} added.`);
  };

  return (
    <ListSheet open onClose={onClose} title={bed ? `Change bed ${bed.bed_number}` : `Add a bed to ${ward.ward_name}`} dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" form={formId} disabled={saving} className={PRIMARY}>Save bed</button>
        </div>
      }>
      <form id={formId} onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Bed number or name">
          {props => <input {...props} value={values.bed_number} onChange={event => set('bed_number', event.target.value)} className={INPUT} maxLength={20} autoFocus />}
        </Field>
        <Field label="Daily rate (N$)" hint="What one night in this bed costs. Leave empty to bill the ward's bed-day code at its list amount">
          {props => <input {...props} inputMode="decimal" value={values.daily_rate} onChange={event => set('daily_rate', event.target.value)} className={INPUT} placeholder="1250.00" />}
        </Field>
        <Field label="Room" hint="Optional">
          {props => <input {...props} value={values.room_number} onChange={event => set('room_number', event.target.value)} className={INPUT} maxLength={20} />}
        </Field>
        <Field label="Kind of bed">
          {props => (
            <select {...props} value={values.bed_type} onChange={event => set('bed_type', event.target.value)} className={INPUT}>
              {BED_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Kind of room">
          {props => (
            <select {...props} value={values.room_type} onChange={event => set('room_type', event.target.value)} className={INPUT}>
              <option value="">Not set</option>
              {ROOM_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Bed code" hint="Optional, e.g. the label on the bed">
          {props => <input {...props} value={values.bed_code} onChange={event => set('bed_code', event.target.value)} className={INPUT} maxLength={20} />}
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          {props => <input {...props} value={values.notes} onChange={event => set('notes', event.target.value)} className={INPUT} maxLength={500} />}
        </Field>
        {bed && (
          <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-gray-800 sm:col-span-2">
            <input type="checkbox" checked={values.is_active} onChange={event => set('is_active', event.target.checked)} className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
            Bed in use (untick to take it out of the setup)
          </label>
        )}
      </form>
    </ListSheet>
  );
};
