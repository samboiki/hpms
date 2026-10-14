import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { Field } from '../stock/stockParts';
import { INPUT, PRIMARY, SECONDARY, errorText } from '../stock/stockUi';
import { billableOn, loadTariffSet } from '../quotes/quoteService';
import { loadSuppliers } from '../../services/stock/stockService';
import { saveFrame, type FrameRow } from '../../services/optometry/optometryService';
import { fromCents } from '../../utils/billing/money';
import { isNamafListCode } from '../../utils/billing/namafTariffs';
import { todayKey } from '../../utils/billing/dates';
import { emptyFrameDraft, validateFrameDraft, type FrameDraft, type FrameDraftErrors } from '../../utils/optometry/frames';
import type { Supplier } from '../../utils/stock/stockRows';

interface FrameSheetProps {
  open: boolean;
  practiceId: string;
  /** Changing a frame that is already in stock */
  frame?: FrameRow | null;
  onClose: () => void;
  onSaved: (itemId: string) => void;
}

const amount = (cents: number | null): string => (cents === null ? '' : fromCents(cents).toFixed(2));

const draftFromFrame = (frame: FrameRow): FrameDraft => ({
  id: frame.item.id,
  brand: frame.details?.brand ?? frame.item.name,
  model: frame.details?.model ?? '',
  colour: frame.details?.colour ?? '',
  size: frame.details?.size ?? '',
  barcode: frame.item.barcode ?? '',
  tariffCode: frame.item.tariffCode ?? '',
  costPrice: amount(frame.item.unitCostCents),
  sellingPrice: amount(frame.item.sellingPriceCents),
  openingQuantity: '',
  supplierId: frame.consignment?.supplierId ?? frame.item.preferredSupplierId ?? '',
  location: frame.item.location ?? '',
  notes: frame.item.notes ?? '',
  consignment: frame.consignment !== null,
  consignmentCost: frame.consignment ? amount(frame.consignment.costCents) : ''
});

/**
 * A frame for the stock: brand, model, colour and size, its barcode, the code it is billed under (from the practice's
 * own tariff list: no code is made up), its prices and how many are on the shelf. It is a stock item like any other,
 * so deliveries, counts and sales on invoices work as on the Stock page. A consignment frame is the supplier's until
 * it is sold: it has no stock value, and what is owed per frame sold shows under Stock > Reports > Consignment frames.
 */
const FrameSheet: React.FC<FrameSheetProps> = ({ open, practiceId, frame = null, onClose, onSaved }) => {
  const [draft, setDraft] = useState<FrameDraft>(emptyFrameDraft());
  const [errors, setErrors] = useState<FrameDraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<Array<{ code: string; description: string }>>([]);
  const [codesNote, setCodesNote] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const costLocked = frame?.inLedger ?? false;

  useEffect(() => {
    if (!open) return;
    setDraft(frame ? draftFromFrame(frame) : emptyFrameDraft());
    setErrors({});
    setFormError(null);
  }, [open, frame]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadTariffSet(practiceId)
      .then(set => {
        if (cancelled) return;
        // The practice's own and shared codes, and the NAMAF frame codes (NA70405 "FRAME"): the discipline's whole NAMAF list
        // (optometry: 7,168 codes, the lens products among them) is not a menu to choose a frame's code from
        const billable = billableOn(set, todayKey())
          .filter(row => !isNamafListCode(row) || /\bframes?\b/i.test(row.description ?? ''))
          .map(row => ({ code: row.code, description: (row.description ?? '').trim() }));
        setCodes(billable);
        setCodesNote(billable.length === 0 ? 'Your tariff list has no codes yet: import your optometry tariffs, then choose the frame code here.' : null);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setCodesNote(errorText(failure, 'The tariff list could not be read.'));
      });
    loadSuppliers(practiceId)
      .then(rows => {
        if (!cancelled) setSuppliers(rows.filter(row => row.isActive));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, practiceId]);

  const set = (patch: Partial<FrameDraft>) => setDraft(current => ({ ...current, ...patch }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const checked = validateFrameDraft(draft, { practiceId, costLocked });
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError('Check the marked boxes.');
      return;
    }
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      const itemId = await saveFrame(checked.item, { ...checked.frame, ...checked.consignment });
      toast.success(frame ? 'Frame saved.' : 'Frame added to the stock.');
      onSaved(itemId);
      onClose();
    } catch (failure) {
      setFormError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  const text = (field: keyof FrameDraft, label: string, options: { hint?: string; placeholder?: string; mode?: 'decimal' | 'numeric'; max?: number; disabled?: boolean } = {}) => (
    <Field label={label} error={errors[field]} hint={options.hint}>
      {props => (
        <input
          {...props}
          className={INPUT}
          value={String(draft[field] ?? '')}
          placeholder={options.placeholder}
          inputMode={options.mode}
          maxLength={options.max}
          disabled={options.disabled || busy}
          onChange={event => set({ [field]: event.target.value } as Partial<FrameDraft>)}
        />
      )}
    </Field>
  );

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      size="lg"
      title={frame ? 'Change the frame' : 'Add a frame to stock'}
      subtitle="Frames are stock items in the Frames group: deliveries, stock takes and sales work as on the Stock page."
      dismissible={!busy}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {formError && <p className="text-sm text-red-700 sm:mr-auto" role="alert">{formError}</p>}
          <button type="button" className={SECONDARY} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="optometry-frame-form" className={PRIMARY} disabled={busy}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {frame ? 'Save frame' : 'Add frame'}
          </button>
        </div>
      }
    >
      <form id="optometry-frame-form" onSubmit={save} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {text('brand', 'Brand', { max: 60 })}
          {text('model', 'Model', { max: 60 })}
          {text('colour', 'Colour', { max: 30, placeholder: 'Black' })}
          {text('size', 'Size', { max: 20, placeholder: '52-18-140', hint: 'Eye, bridge, temple' })}
        </div>
        {text('barcode', 'Barcode', { hint: 'Scan the label, or type its number', max: 40 })}
        <Field label="Billed under" error={errors.tariffCode} hint={codesNote ?? 'The code from your tariff list that frames are billed under'}>
          {props => (
            <select {...props} className={INPUT} value={draft.tariffCode} disabled={busy} onChange={event => set({ tariffCode: event.target.value })}>
              <option value="">Not chosen yet</option>
              {draft.tariffCode && !codes.some(code => code.code === draft.tariffCode) && <option value={draft.tariffCode}>{draft.tariffCode}</option>}
              {codes.map(code => (
                <option key={code.code} value={code.code}>{code.code}{code.description ? ` · ${code.description}` : ''}</option>
              ))}
            </select>
          )}
        </Field>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={draft.consignment}
            disabled={busy || costLocked}
            onChange={event => set({ consignment: event.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
          />
          <span>
            <span className="font-medium">On consignment: the supplier owns these frames until they are sold</span>
            <span className="block text-xs text-gray-500">
              {costLocked
                ? 'This frame has stock history, so this cannot change. Add consignment frames as a new frame.'
                : 'No stock value. Each frame sold is owed to the supplier (Stock > Reports > Consignment frames).'}
            </span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {draft.consignment
            ? text('consignmentCost', 'Owed per frame sold (excl. VAT)', { mode: 'decimal', placeholder: '0.00' })
            : text('costPrice', 'Cost (excl. VAT)', { mode: 'decimal', placeholder: '0.00', disabled: costLocked, hint: costLocked ? 'Follows the deliveries' : undefined })}
          {text('sellingPrice', 'Selling price (incl. VAT)', { mode: 'decimal', hint: 'Empty: the practice\'s price rule' })}
          {!frame && text('openingQuantity', 'On the shelf now', { mode: 'numeric' })}
          {text('location', 'Where it is displayed', { max: 120, placeholder: 'Wall B' })}
        </div>
        <Field label={draft.consignment ? 'Supplier who owns the frames' : 'Supplier (optional)'} error={errors.supplierId}>
          {props => (
            <select {...props} className={INPUT} value={draft.supplierId} disabled={busy} onChange={event => set({ supplierId: event.target.value })}>
              <option value="">Not named</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          )}
        </Field>
      </form>
    </ListSheet>
  );
};

export default FrameSheet;
