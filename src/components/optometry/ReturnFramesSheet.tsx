import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, QUIET, SECONDARY, errorText } from '../stock/stockUi';
import { loadSuppliers } from '../../services/stock/stockService';
import { returnFrameUnits } from '../../services/optometry/frameUnitsService';
import type { FrameRow } from '../../services/optometry/optometryService';
import { FRAME_UNIT_STATUS_LABELS, isOnHandStatus, sameBarcode, validateReturn, type FrameUnit, type ReturnDraft } from '../../utils/optometry/frameUnits';
import type { Supplier } from '../../utils/stock/stockRows';

interface ReturnFramesSheetProps {
  open: boolean;
  practiceId: string;
  frames: readonly FrameRow[];
  /** Every barcode of the practice */
  units: readonly FrameUnit[];
  /** Opened from a frame's barcode: that frame is chosen */
  startUnitIds?: readonly string[];
  onClose: () => void;
  onReturned: () => void;
}

/**
 * Frames back to the supplier: scan each frame that goes back (only frames in the practice), one return note for all
 * of them (as on the Stock page: the stock count goes down and the supplier owes a credit for frames the practice paid
 * for). Each frame's history keeps the return note, the reason, who sent it back and when.
 */
const ReturnFramesSheet: React.FC<ReturnFramesSheetProps> = ({ open, practiceId, frames, units, startUnitIds = [], onClose, onReturned }) => {
  const [draft, setDraft] = useState<ReturnDraft>({ supplierId: '', reference: '', reason: '', unitIds: [] });
  const [errors, setErrors] = useState<Partial<Record<keyof ReturnDraft, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [scan, setScan] = useState('');
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const scanRef = useRef<HTMLInputElement>(null);

  const frameById = useMemo(() => new Map(frames.map(frame => [frame.item.id, frame] as const)), [frames]);
  const unitById = useMemo(() => new Map(units.map(unit => [unit.id, unit] as const)), [units]);
  const supplierOf = (unit: FrameUnit | undefined): string => {
    const frame = unit ? frameById.get(unit.itemId) : undefined;
    return frame?.consignment?.supplierId ?? frame?.item.preferredSupplierId ?? '';
  };
  // The barcodes and frames change after every save; the form starts again only when it opens
  const startRef = useRef({ startUnitIds, supplierOf, unitById });
  startRef.current = { startUnitIds, supplierOf, unitById };
  const startKey = startUnitIds.join(',');

  useEffect(() => {
    if (!open) return;
    const { startUnitIds: chosen, supplierOf: supplier, unitById: known } = startRef.current;
    setDraft({ supplierId: supplier(known.get(chosen[0] ?? '')), reference: '', reason: '', unitIds: [...chosen] });
    setErrors({});
    setFormError(null);
    setScan('');
    setScanNote(null);
    let cancelled = false;
    loadSuppliers(practiceId)
      .then(rows => !cancelled && setSuppliers(rows.filter(row => row.isActive)))
      .catch((failure: unknown) => !cancelled && setFormError(errorText(failure, 'The suppliers could not be read.')));
    return () => {
      cancelled = true;
    };
  }, [open, practiceId, startKey]);

  const addScanned = () => {
    const code = scan.trim();
    if (!code) return;
    const unit = units.find(candidate => sameBarcode(candidate.barcode, code));
    if (!unit) setScanNote(`${code} is not one of the practice's frame barcodes.`);
    else if (!isOnHandStatus(unit.status)) setScanNote(`${unit.barcode} is ${FRAME_UNIT_STATUS_LABELS[unit.status].toLowerCase()}: only frames in the practice can go back.`);
    else if (draft.unitIds.includes(unit.id)) setScanNote(`${unit.barcode} is already on the list.`);
    else {
      setDraft(current => ({ ...current, unitIds: [...current.unitIds, unit.id], supplierId: current.supplierId || supplierOf(unit) }));
      setScanNote(null);
    }
    setScan('');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateReturn(draft, practiceId);
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError('Check the marked boxes.');
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const result = await returnFrameUnits(checked.payload);
      const count = draft.unitIds.length;
      toast.success(`Return ${result.number}: ${count} frame${count === 1 ? '' : 's'} back to the supplier.`);
      onReturned();
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
      title="Send frames back to the supplier"
      subtitle="One return note for the frames you scan: they come off the stock count, and the supplier owes a credit for frames you paid for."
      dismissible={!busy}
      initialFocus={scanRef}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {formError && <p className="text-sm text-red-700 sm:mr-auto" role="alert">{formError}</p>}
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="optometry-return-frames-form" className={PRIMARY} disabled={busy}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Send back {draft.unitIds.length > 0 ? `${draft.unitIds.length} frame${draft.unitIds.length === 1 ? '' : 's'}` : ''}
          </button>
        </div>
      }
    >
      <form id="optometry-return-frames-form" onSubmit={save} noValidate className="space-y-4">
        <Field label="Scan a frame that goes back" error={errors.unitIds} hint={scanNote ?? 'Scan each frame\'s barcode; press Enter after a typed one.'}>
          {props => (
            <input
              {...props}
              ref={scanRef}
              className={INPUT}
              value={scan}
              autoComplete="off"
              disabled={busy}
              onChange={event => setScan(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  // A scanner ends with Enter: add the frame, do not send the form
                  event.preventDefault();
                  addScanned();
                }
              }}
            />
          )}
        </Field>
        {draft.unitIds.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {draft.unitIds.map(id => {
              const unit = unitById.get(id);
              return (
                <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{unit?.barcode ?? 'Frame'}</span>
                  <span className="min-w-0 flex-1 text-xs text-gray-600">{unit ? frameById.get(unit.itemId)?.item.name ?? '' : ''}</span>
                  <button type="button" className={QUIET} disabled={busy} onClick={() => setDraft(current => ({ ...current, unitIds: current.unitIds.filter(other => other !== id) }))}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Supplier" error={errors.supplierId}>
            {props => (
              <select {...props} className={INPUT} value={draft.supplierId} disabled={busy} onChange={event => setDraft(current => ({ ...current, supplierId: event.target.value }))}>
                <option value="">Choose</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Credit note or return note number" error={errors.reference}>
            {props => <input {...props} className={INPUT} value={draft.reference} maxLength={60} disabled={busy} onChange={event => setDraft(current => ({ ...current, reference: event.target.value }))} />}
          </Field>
        </div>
        <Field label="Why they go back" error={errors.reason}>
          {props => <input {...props} className={INPUT} value={draft.reason} maxLength={300} placeholder="Slow sellers" disabled={busy} onChange={event => setDraft(current => ({ ...current, reason: event.target.value }))} />}
        </Field>
      </form>
    </ListSheet>
  );
};

export default ReturnFramesSheet;
