import React, { useEffect, useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import FormModal from '../modals/FormModal';
import { stockLink } from '../billing/invoiceLinks';
import { MessageList, inputClass, labelClass, primaryButton, secondaryButton } from '../quotes/QuoteBits';
import { loadSuppliers } from '../../services/stock/stockService';
import { saveDentalLabOrder } from '../../services/dental/labOrderService';
import type { ChartModel } from '../../utils/dental/chart';
import { defaultDentition, toothName, type Dentition } from '../../utils/dental/fdi';
import {
  DENTAL_LAB_WORKS,
  DENTAL_LAB_WORK_LABELS,
  JAWS,
  JAW_LABELS,
  NOTES_MAX,
  SHADE_MAX,
  emptyDentalLabOrderDraft,
  minimumTeeth,
  sortedTeeth,
  validateDentalLabOrderDraft,
  type DentalLabOrderDraft,
  type DentalLabOrderDraftErrors,
  type DentalLabWork,
  type Jaw
} from '../../utils/dental/labOrders';
import type { DentalLabOrder } from '../../utils/dental/labOrderRecords';
import type { Supplier } from '../../utils/stock/stockRows';
import DentitionSwitch from './DentitionSwitch';
import Odontogram from './Odontogram';

export interface DentalLabOrderSheetProps {
  open: boolean;
  onClose: () => void;
  practiceId: string;
  patientId: string;
  /** Opened from a visit: a new order is started at it */
  visitId: string | null;
  /** Changing an order still at the lab; null for a new one */
  order: DentalLabOrder | null;
  /** A new order from a tooth on the chart starts with that tooth chosen */
  initialTeeth?: readonly string[];
  /** The patient's chart (teeth are chosen on it) and date of birth (which teeth to show first) */
  model: ChartModel;
  dateOfBirth: string | null;
  today: string;
  /** Links that leave the screen are text (inside a visit with unsaved changes) */
  navigation: boolean;
  onSaved: () => void;
}

const chip = (selected: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    selected ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
  }`;

const draftFromOrder = (order: DentalLabOrder): DentalLabOrderDraft => ({
  workType: order.workType,
  teeth: order.teeth,
  jaw: order.jaw ?? '',
  shade: order.shade ?? '',
  notes: order.notes ?? '',
  supplierId: order.supplierId ?? '',
  sentOn: order.sentOn,
  dueOn: order.dueOn ?? ''
});

/**
 * A dental lab order (parity N5): the work, the teeth tapped on the chart (or the jaw), the shade, the lab and the
 * dates, and notes for the lab. A practitioner, nurse or practice admin orders; the order prints as the lab slip.
 */
const DentalLabOrderSheet: React.FC<DentalLabOrderSheetProps> = props => {
  const { open, onClose, practiceId, patientId, visitId, order, initialTeeth, model, dateOfBirth, today, navigation, onSaved } = props;
  const id = useId();
  const [draft, setDraft] = useState<DentalLabOrderDraft>(emptyDentalLabOrderDraft(today));
  const [errors, setErrors] = useState<DentalLabOrderDraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [dentition, setDentition] = useState<Dentition | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(order ? draftFromOrder(order) : emptyDentalLabOrderDraft(today, initialTeeth ?? []));
    setErrors({});
    setFormError(null);
    setDentition(null);
  }, [open, order, initialTeeth, today]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadSuppliers(practiceId)
      .then(rows => {
        if (!cancelled) {
          setSuppliers(rows.filter(supplier => supplier.isActive || supplier.id === order?.supplierId));
          setSuppliersError(null);
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) setSuppliersError(failure instanceof Error ? failure.message : 'The labs could not be read.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, practiceId, order?.supplierId]);

  const set = (patch: Partial<DentalLabOrderDraft>) => setDraft(current => ({ ...current, ...patch }));
  const chosen = new Set(draft.teeth);
  const shown = dentition ?? defaultDentition(dateOfBirth, today, [...model.recordedTeeth, ...draft.teeth]);
  const toggleTooth = (tooth: string) =>
    set({ teeth: chosen.has(tooth) ? draft.teeth.filter(item => item !== tooth) : sortedTeeth([...draft.teeth, tooth]) });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateDentalLabOrderDraft(draft, { today });
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError('Check the marked fields.');
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const payload = order ? { ...checked.payload, id: order.id } : { ...checked.payload, patient_id: patientId, visit_id: visitId };
      const saved = await saveDentalLabOrder(payload);
      toast.success(order ? `Order ${saved.order_no} changed.` : `Order ${saved.order_no} saved. Print the slip for the lab.`);
      onSaved();
      onClose();
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'The order could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const errorText = (field: keyof DentalLabOrderDraft) =>
    errors[field] ? (
      <span id={`${id}-${field}-error`} className="mt-1 block text-xs text-red-700" role="alert">
        {errors[field]}
      </span>
    ) : null;
  const needs = minimumTeeth(draft.workType);

  return (
    <FormModal isOpen={open} onClose={() => !busy && onClose()} title={order ? `Change order ${order.orderNo}` : 'Send work to the lab'} icon="solar:box-bold-duotone" className="max-w-2xl">
      <form onSubmit={save} noValidate className="space-y-5">
        <fieldset>
          <legend className={labelClass}>Work</legend>
          <div className="flex flex-wrap gap-2">
            {DENTAL_LAB_WORKS.map(work => (
              <button key={work} type="button" aria-pressed={draft.workType === work} className={chip(draft.workType === work)} onClick={() => set({ workType: work as DentalLabWork })}>
                {DENTAL_LAB_WORK_LABELS[work]}
              </button>
            ))}
          </div>
          {errorText('workType')}
        </fieldset>

        <fieldset aria-describedby={errors.teeth ? `${id}-teeth-error` : undefined}>
          <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
            <legend className={labelClass}>
              {needs === 2 ? 'Teeth (tap every tooth of the bridge)' : needs === 1 ? 'Teeth (tap the tooth)' : 'Teeth (or choose the jaw below)'}
            </legend>
            <DentitionSwitch value={shown} onChange={setDentition} />
          </div>
          <Odontogram dentition={shown} model={model} mode="select" selected={chosen} onToothClick={toggleTooth} />
          <p className="mt-2 text-sm text-gray-700" aria-live="polite">
            {draft.teeth.length === 0
              ? 'No tooth chosen.'
              : draft.teeth.length === 1
                ? `Tooth ${draft.teeth[0]}: ${toothName(draft.teeth[0]).toLowerCase()}`
                : `Teeth ${draft.teeth.join(', ')}`}
          </p>
          {errorText('teeth')}
        </fieldset>

        <fieldset>
          <legend className={labelClass}>Jaw (dentures, guards and appliances)</legend>
          <div className="flex flex-wrap gap-2">
            {JAWS.map(jaw => (
              <button key={jaw} type="button" aria-pressed={draft.jaw === jaw} className={chip(draft.jaw === jaw)} onClick={() => set({ jaw: draft.jaw === jaw ? '' : (jaw as Jaw) })}>
                {JAW_LABELS[jaw]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Shade</span>
            <input
              className={inputClass}
              value={draft.shade}
              maxLength={SHADE_MAX}
              placeholder="For example A2"
              aria-invalid={errors.shade ? true : undefined}
              aria-describedby={errors.shade ? `${id}-shade-error` : undefined}
              onChange={event => set({ shade: event.target.value })}
            />
            {errorText('shade')}
          </label>
          <label className="block">
            <span className={labelClass}>Lab</span>
            <select className={inputClass} value={draft.supplierId} onChange={event => set({ supplierId: event.target.value })}>
              <option value="">{suppliers && suppliers.length === 0 ? 'No lab added yet' : 'Not named'}</option>
              {(suppliers ?? []).map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            {suppliersError && <span className="mt-1 block text-xs text-amber-800">{suppliersError}</span>}
            {suppliers && suppliers.length === 0 && (
              <span className="mt-1 block text-xs text-gray-500">
                Labs are the practice&apos;s suppliers:{' '}
                {navigation ? (
                  <Link to={stockLink('suppliers')} className="text-cyan-700 hover:underline">
                    add one under Stock, Suppliers
                  </Link>
                ) : (
                  'add one under Stock, Suppliers'
                )}
                .
              </span>
            )}
          </label>
          <label className="block">
            <span className={labelClass}>Sent to the lab on</span>
            <input
              type="date"
              className={inputClass}
              value={draft.sentOn}
              max={today}
              disabled={order !== null}
              aria-invalid={errors.sentOn ? true : undefined}
              aria-describedby={errors.sentOn ? `${id}-sentOn-error` : undefined}
              onChange={event => set({ sentOn: event.target.value })}
            />
            {errorText('sentOn')}
          </label>
          <label className="block">
            <span className={labelClass}>Needed back by (optional)</span>
            <input
              type="date"
              className={inputClass}
              value={draft.dueOn}
              min={draft.sentOn || undefined}
              aria-invalid={errors.dueOn ? true : undefined}
              aria-describedby={errors.dueOn ? `${id}-dueOn-error` : undefined}
              onChange={event => set({ dueOn: event.target.value })}
            />
            {errorText('dueOn')}
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Notes for the lab (optional)</span>
          <textarea
            rows={3}
            className={inputClass}
            value={draft.notes}
            maxLength={NOTES_MAX}
            placeholder="For example: porcelain fused to metal, metal collar lingual only"
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={errors.notes ? `${id}-notes-error` : undefined}
            onChange={event => set({ notes: event.target.value })}
          />
          {errorText('notes')}
        </label>

        {formError && <MessageList tone="error" messages={[formError]} />}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={secondaryButton} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={primaryButton} disabled={busy}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {order ? 'Save changes' : 'Save the order'}
          </button>
        </div>
      </form>
    </FormModal>
  );
};

export default DentalLabOrderSheet;
