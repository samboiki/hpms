import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { Field } from '../stock/stockParts';
import { INPUT, LINK, PRIMARY, SECONDARY, errorText } from '../stock/stockUi';
import { formatServiceDate, todayKey } from '../../utils/billing/dates';
import { loadSuppliers } from '../../services/stock/stockService';
import { loadFrames, loadRecentVisits, saveLabOrder, type FrameRow, type VisitOption } from '../../services/optometry/optometryService';
import { FRAME_STATUS_LABELS } from '../../utils/optometry/frames';
import {
  LAB_EYES_LABELS,
  LENS_COATINGS,
  LENS_COATING_LABELS,
  LENS_MATERIALS,
  LENS_MATERIAL_LABELS,
  LENS_TYPES,
  LENS_TYPE_LABELS,
  emptyLabOrderDraft,
  hasReadingPart,
  orderedSides,
  validateLabOrderDraft,
  type LabOrderDraft,
  type LabOrderDraftErrors,
  type LabOrderEyes,
  type LensMaterial,
  type LensType
} from '../../utils/optometry/labOrders';
import { EYE_LETTERS, eyeSummary } from '../../utils/optometry/prescription';
import type { LabOrderRecord, PrescriptionRecord } from '../../utils/optometry/records';
import type { Supplier } from '../../utils/stock/stockRows';
import FrameSheet from './FrameSheet';
import OpticalBenefitNote from './OpticalBenefitNote';

interface LabOrderSheetProps {
  open: boolean;
  onClose: () => void;
  practiceId: string;
  patientId: string;
  /** The patient's current spectacle prescriptions, newest first */
  prescriptions: readonly PrescriptionRecord[];
  /** Changing an order that has not gone to the lab yet */
  order?: LabOrderRecord | null;
  onSaved: (saved: { id: string; orderNo: number }) => void;
}

const rxLabel = (rx: PrescriptionRecord): string =>
  `${formatServiceDate(rx.prescribedOn)} · R ${eyeSummary(rx.right)} · L ${eyeSummary(rx.left)}`;

const draftFromOrder = (order: LabOrderRecord): LabOrderDraft => ({
  prescriptionId: order.prescriptionId,
  eyes: order.eyes,
  lensType: order.lensType,
  material: order.material,
  coatings: order.coatings,
  tintPercent: order.tintPercent ? String(order.tintPercent) : '',
  tintColour: order.tintColour ?? '',
  pdRight: order.pdRight === null ? '' : String(order.pdRight),
  pdLeft: order.pdLeft === null ? '' : String(order.pdLeft),
  heightRight: order.heightRight === null ? '' : String(order.heightRight),
  heightLeft: order.heightLeft === null ? '' : String(order.heightLeft),
  frameItemId: order.frameItemId ?? '',
  frameNote: order.frameNote ?? '',
  supplierId: order.supplierId ?? '',
  labReference: order.labReference ?? '',
  requiredBy: order.requiredBy ?? '',
  notes: order.notes ?? ''
});

/**
 * A spectacle order for the lab: the prescription, which eyes, the lens, the measurements, the frame and the lab.
 * The patient's optical benefit note (the practice's own, per fund) shows at the top while the lenses are chosen.
 */
const LabOrderSheet: React.FC<LabOrderSheetProps> = ({ open, onClose, practiceId, patientId, prescriptions, order = null, onSaved }) => {
  const today = todayKey();
  const [draft, setDraft] = useState<LabOrderDraft>(emptyLabOrderDraft());
  const [visitId, setVisitId] = useState('');
  const [errors, setErrors] = useState<LabOrderDraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [frames, setFrames] = useState<FrameRow[]>([]);
  const [visits, setVisits] = useState<VisitOption[]>([]);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [frameSearch, setFrameSearch] = useState('');
  const [addingFrame, setAddingFrame] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!open) return;
    setDraft(order ? draftFromOrder(order) : emptyLabOrderDraft(prescriptions[0]?.id ?? ''));
    setVisitId(order?.visitId ?? prescriptions[0]?.visitId ?? '');
    setErrors({});
    setFormError(null);
    setFrameSearch('');
  }, [open, order, prescriptions]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([loadSuppliers(practiceId), loadFrames(practiceId), loadRecentVisits(patientId)])
      .then(([supplierRows, frameLoad, visitRows]) => {
        if (cancelled) return;
        setSuppliers(supplierRows.filter(supplier => supplier.isActive));
        setFrames(frameLoad.status === 'ready' ? frameLoad.frames : []);
        setVisits(visitRows);
        setLookupsError(null);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setLookupsError(errorText(failure, 'The labs and frames could not be read.'));
      });
    return () => {
      cancelled = true;
    };
  }, [open, practiceId, patientId, version]);

  const rx = prescriptions.find(item => item.id === draft.prescriptionId) ?? null;
  const set = (patch: Partial<LabOrderDraft>) => setDraft(current => ({ ...current, ...patch }));
  const sides = orderedSides(draft.eyes);
  const readingPart = hasReadingPart(draft.lensType);

  // Frames free on the shelf (and the one already chosen); a scanned barcode picks its frame
  const frameChoices = useMemo(() => {
    const search = frameSearch.trim().toLowerCase();
    return frames
      .filter(frame => frame.item.isActive && (frame.onHand > frame.onOrder || frame.item.id === draft.frameItemId))
      .filter(frame => !search || frame.item.name.toLowerCase().includes(search) || (frame.item.barcode ?? '').toLowerCase() === search);
  }, [frames, frameSearch, draft.frameItemId]);
  useEffect(() => {
    const search = frameSearch.trim().toLowerCase();
    const scanned = search ? frames.find(frame => (frame.item.barcode ?? '').toLowerCase() === search) : undefined;
    if (scanned) setDraft(current => ({ ...current, frameItemId: scanned.item.id }));
  }, [frameSearch, frames]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateLabOrderDraft(draft, { rx, today });
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError('Check the marked boxes.');
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const saved = await saveLabOrder({ ...checked.payload, id: order?.id ?? null, visit_id: visitId || null });
      toast.success(order ? `Order ${saved.order_no} changed.` : `Order ${saved.order_no} saved. Print the slip for the lab.`);
      onSaved({ id: saved.id, orderNo: saved.order_no });
      onClose();
    } catch (failure) {
      setFormError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  const number = (field: 'pdRight' | 'pdLeft' | 'heightRight' | 'heightLeft', label: string, placeholder: string) => (
    <Field label={label} error={errors[field]}>
      {props => (
        <input {...props} className={INPUT} inputMode="decimal" value={draft[field]} placeholder={placeholder} onChange={event => set({ [field]: event.target.value } as Partial<LabOrderDraft>)} />
      )}
    </Field>
  );

  return (
    <>
      <ListSheet
        open={open && !addingFrame}
        onClose={onClose}
        size="lg"
        title={order ? `Change order ${order.orderNo}` : 'Order spectacles from the lab'}
        subtitle="The lab gets the prescription of the eyes ordered, the lens, the measurements and the frame."
        dismissible={!busy}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {formError && <p className="text-sm text-red-700 sm:mr-auto" role="alert">{formError}</p>}
            <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" form="optometry-lab-order-form" className={PRIMARY} disabled={busy || prescriptions.length === 0}>
              {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {order ? 'Save changes' : 'Save order'}
            </button>
          </div>
        }
      >
        <form id="optometry-lab-order-form" onSubmit={save} noValidate className="space-y-4">
          <OpticalBenefitNote practiceId={practiceId} patientId={patientId} />
          {lookupsError && <p className="text-sm text-amber-800" role="status">{lookupsError}</p>}

          <Field label="Prescription" error={errors.prescriptionId} hint={prescriptions.length === 0 ? 'Record a spectacle prescription first.' : undefined}>
            {props => (
              <select {...props} className={INPUT} value={draft.prescriptionId} onChange={event => set({ prescriptionId: event.target.value })}>
                {prescriptions.length === 0 && <option value="">No spectacle prescription</option>}
                {prescriptions.map(item => (
                  <option key={item.id} value={item.id}>{rxLabel(item)}</option>
                ))}
              </select>
            )}
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-gray-700">Eyes</legend>
            <div className="inline-flex flex-wrap rounded-lg bg-gray-100 p-0.5" role="group" aria-label="Eyes to order">
              {(['both', 'right', 'left'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={draft.eyes === option}
                  onClick={() => set({ eyes: option as LabOrderEyes })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                    draft.eyes === option ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {LAB_EYES_LABELS[option]}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Lens type" error={errors.lensType}>
              {props => (
                <select {...props} className={INPUT} value={draft.lensType} onChange={event => set({ lensType: event.target.value as LensType | '' })}>
                  <option value="">Choose</option>
                  {LENS_TYPES.map(type => (
                    <option key={type} value={type}>{LENS_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Material" error={errors.material}>
              {props => (
                <select {...props} className={INPUT} value={draft.material} onChange={event => set({ material: event.target.value as LensMaterial | '' })}>
                  <option value="">Choose</option>
                  {LENS_MATERIALS.map(material => (
                    <option key={material} value={material}>{LENS_MATERIAL_LABELS[material]}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-gray-700">Coatings and filters</legend>
            <div className="flex flex-wrap gap-2">
              {LENS_COATINGS.map(coating => {
                const on = draft.coatings.includes(coating);
                return (
                  <label key={coating} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${on ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-gray-200 text-gray-700'}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      checked={on}
                      onChange={() => set({ coatings: on ? draft.coatings.filter(item => item !== coating) : [...draft.coatings, coating] })}
                    />
                    {LENS_COATING_LABELS[coating]}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {draft.coatings.includes('tint') && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tint density (%)" error={errors.tintPercent}>
                {props => <input {...props} className={INPUT} inputMode="numeric" value={draft.tintPercent} onChange={event => set({ tintPercent: event.target.value })} />}
              </Field>
              <Field label="Tint colour" error={errors.tintColour}>
                {props => <input {...props} className={INPUT} value={draft.tintColour} maxLength={30} placeholder="Grey" onChange={event => set({ tintColour: event.target.value })} />}
              </Field>
            </div>
          )}

          <div className={`grid gap-3 ${sides.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {sides.includes('right') && number('pdRight', `Pupil distance ${EYE_LETTERS.right} (mm)`, '31.5')}
            {sides.includes('left') && number('pdLeft', `Pupil distance ${EYE_LETTERS.left} (mm)`, '31.5')}
            {readingPart && sides.includes('right') && number('heightRight', `Fitting height ${EYE_LETTERS.right} (mm)`, '18')}
            {readingPart && sides.includes('left') && number('heightLeft', `Fitting height ${EYE_LETTERS.left} (mm)`, '18')}
          </div>

          <fieldset className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <legend className="px-1 text-sm font-semibold text-gray-800">Frame</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Find a frame in stock" hint="Scan its barcode, or type the brand or model">
                {props => <input {...props} className={INPUT} value={frameSearch} autoComplete="off" onChange={event => setFrameSearch(event.target.value)} />}
              </Field>
              <Field label="Frame from stock">
                {props => (
                  <select {...props} className={INPUT} value={draft.frameItemId} onChange={event => set({ frameItemId: event.target.value })}>
                    <option value="">{frameChoices.length === 0 ? 'No frame free in stock' : 'None (the patient\'s own frame)'}</option>
                    {frameChoices.map(frame => (
                      <option key={frame.item.id} value={frame.item.id}>
                        {frame.item.name} · {FRAME_STATUS_LABELS[frame.status]}{frame.onHand > 1 ? ` (${frame.onHand} on hand)` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <Field label={draft.frameItemId ? 'Note on the frame (optional)' : 'The patient\'s own frame, or the frame to order'} error={errors.frameNote}>
              {props => <input {...props} className={INPUT} value={draft.frameNote} maxLength={200} placeholder="E.g. own frame, black metal, 52-18" onChange={event => set({ frameNote: event.target.value })} />}
            </Field>
            <button type="button" className={`${LINK} text-sm`} onClick={() => setAddingFrame(true)}>
              Add a frame to stock
            </button>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Lab" hint={suppliers.length === 0 ? 'Add the lab under Stock > Suppliers' : undefined}>
              {props => (
                <select {...props} className={INPUT} value={draft.supplierId} onChange={event => set({ supplierId: event.target.value })}>
                  <option value="">Not named</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Lab's reference (optional)" error={errors.labReference}>
              {props => <input {...props} className={INPUT} value={draft.labReference} maxLength={40} onChange={event => set({ labReference: event.target.value })} />}
            </Field>
            <Field label="Needed by (optional)" error={errors.requiredBy}>
              {props => <input {...props} type="date" className={INPUT} min={today} value={draft.requiredBy} onChange={event => set({ requiredBy: event.target.value })} />}
            </Field>
            <Field label="Billed at visit" hint="Its claim lines carry the prescription (claim fields 45-47)">
              {props => (
                <select {...props} className={INPUT} value={visitId} onChange={event => setVisitId(event.target.value)}>
                  <option value="">No visit</option>
                  {visits.map(visit => (
                    <option key={visit.id} value={visit.id}>
                      {formatServiceDate(visit.date)}{visit.type ? ` · ${visit.type.replace(/[-_]/g, ' ')}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label="Notes for the lab (optional)" error={errors.notes}>
            {props => <textarea {...props} rows={2} className={INPUT} value={draft.notes} maxLength={500} onChange={event => set({ notes: event.target.value })} />}
          </Field>
          {rx && <p className="text-xs text-gray-500">Lenses are made to the prescription of {formatServiceDate(rx.prescribedOn)}{rx.recordedBy ? ` by ${rx.recordedBy}` : ''}.</p>}
        </form>
      </ListSheet>
      <FrameSheet
        open={addingFrame}
        practiceId={practiceId}
        onClose={() => setAddingFrame(false)}
        onSaved={itemId => {
          set({ frameItemId: itemId });
          setVersion(value => value + 1);
        }}
      />
    </>
  );
};

export default LabOrderSheet;
