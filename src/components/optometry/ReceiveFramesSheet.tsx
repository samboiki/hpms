import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, QUIET, SECONDARY, errorText } from '../stock/stockUi';
import { loadSuppliers } from '../../services/stock/stockService';
import { receiveFrames, type NewUnit } from '../../services/optometry/frameUnitsService';
import type { FrameRow } from '../../services/optometry/optometryService';
import { RECEIVE_LIMITS, emptyReceiveLine, validateReceive, type ReceiveDraft, type ReceiveErrors } from '../../utils/optometry/frameUnits';
import type { Supplier } from '../../utils/stock/stockRows';

interface ReceiveFramesSheetProps {
  open: boolean;
  practiceId: string;
  frames: readonly FrameRow[];
  /** Opened from a frame's row: that frame on the first line */
  startItemId?: string | null;
  onClose: () => void;
  onReceived: (result: { number: string; units: NewUnit[] }) => void;
}

const emptyDraft = (itemId = '', supplierId = ''): ReceiveDraft => ({ supplierId, reference: '', lines: [emptyReceiveLine(itemId)] });

/**
 * Frames received from a supplier: one delivery (as on the Stock page's Deliveries, with the supplier's invoice as a
 * payable for frames the practice buys), and a barcode for every frame: the tags the frames came with, scanned, or
 * the practice's own numbers. Consignment frames come in without a cost: the supplier owns them until they are sold.
 */
const ReceiveFramesSheet: React.FC<ReceiveFramesSheetProps> = ({ open, practiceId, frames, startItemId = null, onClose, onReceived }) => {
  const [draft, setDraft] = useState<ReceiveDraft>(emptyDraft());
  const [errors, setErrors] = useState<ReceiveErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const sorted = useMemo(() => [...frames].sort((a, b) => a.item.name.localeCompare(b.item.name)), [frames]);
  const consignment = useMemo(() => new Set(frames.filter(frame => frame.consignment).map(frame => frame.item.id)), [frames]);
  // The frames list changes after every save; the form starts again only when it opens
  const framesRef = useRef(frames);
  framesRef.current = frames;

  useEffect(() => {
    if (!open) return;
    const start = startItemId ? framesRef.current.find(frame => frame.item.id === startItemId) : undefined;
    setDraft(emptyDraft(start?.item.id ?? '', start?.consignment?.supplierId ?? start?.item.preferredSupplierId ?? ''));
    setErrors({});
    setFormError(null);
    let cancelled = false;
    loadSuppliers(practiceId)
      .then(rows => !cancelled && setSuppliers(rows.filter(row => row.isActive)))
      .catch((failure: unknown) => !cancelled && setFormError(errorText(failure, 'The suppliers could not be read.')));
    return () => {
      cancelled = true;
    };
  }, [open, practiceId, startItemId]);

  const setLine = (index: number, patch: Partial<ReceiveDraft['lines'][number]>) =>
    setDraft(current => ({ ...current, lines: current.lines.map((line, at) => (at === index ? { ...line, ...patch } : line)) }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    // Empty lines are dropped first, so the marked boxes stay on the lines they belong to
    const lines = draft.lines.filter(line => line.itemId || line.barcodes.trim());
    const checkedDraft = { ...draft, lines: lines.length > 0 ? lines : draft.lines.slice(0, 1) };
    setDraft(checkedDraft);
    const checked = validateReceive(checkedDraft, { practiceId, consignment });
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError(checked.errors.form ?? 'Check the marked boxes.');
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const result = await receiveFrames(checked.payload);
      toast.success(`Delivery ${result.number}: ${checked.frames} frame${checked.frames === 1 ? '' : 's'} in stock, each with a barcode.`);
      onReceived({ number: result.number, units: result.units });
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
      title="Receive frames"
      subtitle="A delivery from the supplier: the frames go into stock with a barcode each, and the supplier's invoice is added to payables (not for consignment frames)."
      dismissible={!busy}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {formError && <p className="text-sm text-red-700 sm:mr-auto" role="alert">{formError}</p>}
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="optometry-receive-frames-form" className={PRIMARY} disabled={busy}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Receive frames
          </button>
        </div>
      }
    >
      <form id="optometry-receive-frames-form" onSubmit={save} noValidate className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Supplier" error={errors.supplierId}>
            {props => (
              <select {...props} className={INPUT} value={draft.supplierId} disabled={busy} onChange={event => setDraft(current => ({ ...current, supplierId: event.target.value }))}>
                <option value="">Choose</option>
                {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Invoice or delivery note number" error={errors.reference}>
            {props => <input {...props} className={INPUT} value={draft.reference} maxLength={60} disabled={busy} onChange={event => setDraft(current => ({ ...current, reference: event.target.value }))} />}
          </Field>
        </div>

        <ol className="space-y-3">
          {draft.lines.map((line, index) => {
            const lineErrors = errors.lines?.[index];
            const owned = !consignment.has(line.itemId);
            return (
              <li key={index} className="space-y-3 rounded-xl border border-gray-200 p-3">
                <Field label={`Frame ${draft.lines.length > 1 ? index + 1 : ''}`.trim()} error={lineErrors?.itemId}>
                  {props => (
                    <select {...props} className={INPUT} value={line.itemId} disabled={busy} onChange={event => setLine(index, { itemId: event.target.value })}>
                      <option value="">Choose the frame</option>
                      {sorted.map(frame => (
                        <option key={frame.item.id} value={frame.item.id}>{frame.item.name}{frame.consignment ? ' (consignment)' : ''}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="How many" error={lineErrors?.quantity}>
                    {props => <input {...props} className={INPUT} inputMode="numeric" value={line.quantity} disabled={busy} onChange={event => setLine(index, { quantity: event.target.value })} />}
                  </Field>
                  {owned ? (
                    <Field label="Cost per frame (excl. VAT)" error={lineErrors?.unitCost}>
                      {props => <input {...props} className={INPUT} inputMode="decimal" placeholder="0.00" value={line.unitCost} disabled={busy} onChange={event => setLine(index, { unitCost: event.target.value })} />}
                    </Field>
                  ) : (
                    <p className="self-end pb-2 text-xs text-gray-500">Consignment: no cost now. What is owed shows once a frame is sold.</p>
                  )}
                </div>
                <Field label="Their own barcodes (optional)" error={lineErrors?.barcodes} hint="Scan each frame's tag, one per frame. Empty: the practice's own numbers are given, to print as labels.">
                  {props => <textarea {...props} rows={2} className={INPUT} value={line.barcodes} disabled={busy} onChange={event => setLine(index, { barcodes: event.target.value })} />}
                </Field>
                {draft.lines.length > 1 && (
                  <button type="button" className={QUIET} disabled={busy} onClick={() => setDraft(current => ({ ...current, lines: current.lines.filter((_, at) => at !== index) }))}>
                    Remove this frame
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        {draft.lines.length < RECEIVE_LIMITS.lines && (
          <button type="button" className={QUIET} disabled={busy} onClick={() => setDraft(current => ({ ...current, lines: [...current.lines, emptyReceiveLine()] }))}>
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Another frame
          </button>
        )}
      </form>
    </ListSheet>
  );
};

export default ReceiveFramesSheet;
