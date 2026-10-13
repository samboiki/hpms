import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { receiveDelivery, returnToSupplier } from '../../services/stock/stockService';
import { addDaysToKey, todayKey } from '../../utils/billing/dates';
import { toCents } from '../../utils/billing/money';
import { deliveryTotals, supplierTotalDifference, unitCostOf } from '../../utils/stock/deliveries';
import type { StockItem } from '../../utils/stock/items';
import type { ItemLevel, SupplierOrder } from '../../utils/stock/stockRows';
import { defaultStoreFor, locationIdOf, usesStores } from '../../utils/stock/stores';
import { ItemPicker } from './ItemPicker';
import { stockLevelOf, vatRateOf, type StockContext } from './stockContext';
import { Field } from './stockParts';
import { StorePicker } from './storeParts';
import { INPUT, PRIMARY, QUIET, SECONDARY, day, errorText, nad, units } from './stockUi';

export type DeliveryMode = 'receive' | 'return';

interface LineDraft {
  key: number;
  item: StockItem | null;
  quantity: string;
  /** Receive: the line total excl VAT as on the supplier invoice */
  lineCost: string;
  vatRate: string;
  batchNo: string;
  expiryDate: string;
}

interface DeliverySheetProps {
  context: StockContext;
  mode: DeliveryMode;
  open: boolean;
  onClose: () => void;
  onSaved: (deliveryId: string) => void;
  /** Start from this item (the item's "Receive" or "Return" action) */
  startItem?: StockItem | null;
  /** Receive an open order: its supplier and lines are filled in */
  fromOrder?: SupplierOrder | null;
}

let nextKey = 1;
const emptyLine = (item: StockItem | null, context: StockContext, quantity = ''): LineDraft => ({
  key: nextKey++,
  item,
  quantity,
  lineCost: '',
  vatRate: item ? String(vatRateOf(item, context.settings)) : String(context.settings.defaultVatRate),
  batchNo: '',
  expiryDate: ''
});

const money = (value: string): number | null => {
  const trimmed = value.trim().replace(/,/g, '');
  return /^\d+(\.\d{1,2})?$/.test(trimmed) ? toCents(Number(trimmed)) : null;
};

/**
 * Receive a delivery against the supplier's invoice (its number, lines with batch and expiry, the invoice total to
 * check against; the supplier's payable is created), or return stock to a supplier with the reason.
 */
export const DeliverySheet: React.FC<DeliverySheetProps> = ({ context, mode, open, onClose, onSaved, startItem = null, fromOrder = null }) => {
  const receiving = mode === 'receive';
  const [supplierId, setSupplierId] = useState(fromOrder?.supplierId ?? startItem?.preferredSupplierId ?? '');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(todayKey());
  const [reason, setReason] = useState('');
  const [supplierTotal, setSupplierTotal] = useState('');
  const [createPayable, setCreatePayable] = useState(true);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(() => {
    if (fromOrder) {
      return fromOrder.lines.map(line => {
        const item = context.items.find(entry => entry.id === line.itemId) ?? null;
        return { ...emptyLine(item, context, String(line.quantity)), lineCost: item ? (line.unitCostCents * line.quantity / 100).toFixed(2) : '' };
      });
    }
    return [emptyLine(startItem, context)];
  });
  const [saving, setSaving] = useState(false);
  const supplier = context.suppliers.find(entry => entry.id === supplierId) ?? null;
  // L10: with more than one store, the store the stock goes into or comes from (the staff member's own by default)
  const multiStore = usesStores(context.stores);
  const [store, setStore] = useState(() => defaultStoreFor(context.stores, context.userBranchId));
  const storeLevels = useMemo<Map<string, ItemLevel> | null>(() => (multiStore
    ? new Map([...(context.storeLevels.get(store) ?? new Map())].map(([itemId, level]) => [itemId, { onHand: level.onHand, valueCents: level.valueCents, lastMovementOn: null, lastReceivedOn: null }]))
    : null), [multiStore, context.storeLevels, store]);
  const heldOf = (item: StockItem): number => (storeLevels ? storeLevels.get(item.id)?.onHand ?? 0 : stockLevelOf(item, context.levels).onHand);

  const update = (key: number, changes: Partial<LineDraft>) =>
    setLines(current => current.map(line => (line.key === key ? { ...line, ...changes } : line)));

  const parsed = useMemo(() => lines.map(line => ({
    line,
    quantity: /^\d+$/.test(line.quantity.trim()) ? Number(line.quantity) : null,
    costCents: money(line.lineCost),
    vatRate: /^\d+(\.\d{1,2})?$/.test(line.vatRate.trim()) ? Number(line.vatRate) : null
  })), [lines]);

  const totals = useMemo(() => deliveryTotals(parsed.flatMap(entry => (entry.quantity && entry.costCents !== null && entry.vatRate !== null
    ? [{ quantity: entry.quantity, lineCostCents: entry.costCents, vatRate: entry.vatRate }] : []))), [parsed]);
  const typedTotal = supplierTotal.trim() === '' ? null : money(supplierTotal);
  const difference = supplierTotalDifference(totals, typedTotal);

  const problems = (): string | null => {
    if (!supplier) return receiving ? 'Choose the supplier the delivery came from.' : 'Choose the supplier the stock goes back to.';
    if (!reference.trim()) return receiving ? 'Type the supplier\'s invoice number.' : 'Type the supplier\'s credit note number or your return note number.';
    if (!receiving && reason.trim().length < 3) return 'Say why the stock goes back.';
    if (parsed.length === 0) return 'Add at least one line.';
    for (const [index, entry] of parsed.entries()) {
      if (!entry.line.item) return `Line ${index + 1}: choose the item.`;
      if (!entry.quantity) return `Line ${index + 1}: type the quantity.`;
      if (receiving && entry.costCents === null) return `Line ${index + 1}: type the line total (excl. VAT) from the supplier invoice.`;
      if (receiving && entry.vatRate === null) return `Line ${index + 1}: type the VAT rate.`;
      if (!receiving) {
        const onHand = heldOf(entry.line.item);
        if (entry.quantity > onHand) return `Line ${index + 1}: only ${units(Math.max(onHand, 0), entry.line.item.unit)} on hand${storeLevels ? ' in that store' : ''}.`;
      }
    }
    if (supplierTotal.trim() !== '' && typedTotal === null) return 'Type the supplier invoice total as an amount, e.g. 1234.50.';
    return null;
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = problems();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      if (receiving) {
        const result = await receiveDelivery({
          practice_id: context.practiceId,
          supplier_id: supplierId,
          supplier_reference: reference.trim(),
          document_date: date,
          order_id: fromOrder?.id ?? null,
          notes: notes.trim() || null,
          create_payable: createPayable,
          expected_total: typedTotal === null ? null : typedTotal / 100,
          location_id: locationIdOf(store),
          lines: parsed.map(entry => ({
            item_id: entry.line.item?.id,
            quantity: entry.quantity,
            line_cost: (entry.costCents ?? 0) / 100,
            vat_rate: entry.vatRate,
            batch_no: entry.line.batchNo.trim() || null,
            expiry_date: entry.line.expiryDate || null
          }))
        });
        toast.success(`Delivery ${result.number} recorded${result.expense_id ? ' and the supplier invoice added to payables' : ''}.`);
        onSaved(result.id);
      } else {
        const result = await returnToSupplier({
          practice_id: context.practiceId,
          supplier_id: supplierId,
          supplier_reference: reference.trim(),
          document_date: date,
          reason: reason.trim(),
          notes: notes.trim() || null,
          location_id: locationIdOf(store),
          lines: parsed.map(entry => ({ item_id: entry.line.item?.id, quantity: entry.quantity, batch_no: entry.line.batchNo.trim() || null }))
        });
        toast.success(`Return ${result.number} recorded. Credit expected from the supplier: ${nad(toCents(result.credit_expected))}.`);
        onSaved(result.id);
      }
    } catch (error) {
      toast.error(errorText(error, receiving ? 'Could not record the delivery.' : 'Could not record the return.'));
    } finally {
      setSaving(false);
    }
  };

  const activeSuppliers = context.suppliers.filter(entry => entry.isActive || entry.id === supplierId);

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      title={receiving ? (fromOrder ? `Receive order ${fromOrder.number}` : 'Receive stock') : 'Return stock to a supplier'}
      subtitle={receiving ? 'Type it from the supplier\'s invoice: the lines must add up to its total.' : 'The stock comes off the shelf and the supplier owes you a credit.'}
      size="lg"
      dismissible={!saving}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700" aria-live="polite">
            {receiving
              ? <>Lines: <strong>{nad(totals.inclVatCents)}</strong> incl. VAT ({nad(totals.vatCents)} VAT)
                {difference !== null && (difference === 0
                  ? <span className="ml-2 font-medium text-emerald-700">matches the invoice</span>
                  : <span className="ml-2 font-medium text-red-700">{nad(Math.abs(difference))} {difference > 0 ? 'short of' : 'more than'} the invoice</span>)}
              </>
              : `${parsed.length} line${parsed.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
            <button type="submit" form="stock-delivery-form" disabled={saving || activeSuppliers.length === 0} className={PRIMARY}>
              {saving && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {receiving ? 'Record delivery' : 'Record return'}
            </button>
          </div>
        </div>
      }
    >
      <form id="stock-delivery-form" onSubmit={save} className="space-y-5" noValidate>
        {activeSuppliers.length === 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">Add the supplier first (Stock &gt; Suppliers).</p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Supplier">
            {props => (
              <select {...props} value={supplierId} onChange={event => setSupplierId(event.target.value)} className={INPUT} disabled={!!fromOrder}>
                <option value="">Choose…</option>
                {activeSuppliers.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
            )}
          </Field>
          <Field label={receiving ? 'Supplier invoice number' : 'Credit note or return number'}>
            {props => <input {...props} value={reference} onChange={event => setReference(event.target.value)} className={INPUT} maxLength={60} />}
          </Field>
          <Field label={receiving ? 'Invoice date' : 'Date'} hint="A day in a closed month is refused.">
            {props => <input {...props} type="date" value={date} max={todayKey()} onChange={event => setDate(event.target.value)} className={INPUT} />}
          </Field>
          {multiStore && (
            <StorePicker stores={context.stores} value={store} onChange={setStore} label={receiving ? 'Into the store' : 'From the store'} />
          )}
          {!receiving && (
            <Field label="Why it goes back" className="sm:col-span-3">
              {props => <input {...props} value={reason} onChange={event => setReason(event.target.value)} className={INPUT} maxLength={300} placeholder="e.g. damaged in delivery, short dated" />}
            </Field>
          )}
        </div>

        <ol className="space-y-3" aria-label="Lines">
          {lines.map((line, index) => {
            const entry = parsed[index];
            const unitCost = receiving && entry.quantity && entry.costCents !== null ? unitCostOf({ quantity: entry.quantity, lineCostCents: entry.costCents }) : null;
            return (
              <li key={line.key} className="rounded-2xl border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Line {index + 1}</span>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines(current => current.filter(other => other.key !== line.key))} className={QUIET} aria-label={`Remove line ${index + 1}`}>
                      <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <ItemPicker
                  items={context.items}
                  levels={storeLevels ?? context.levels}
                  value={line.item}
                  onChange={item => update(line.key, { item, vatRate: item ? String(vatRateOf(item, context.settings)) : line.vatRate })}
                  showOnHand={!receiving}
                />
                <div className={`mt-3 grid grid-cols-2 gap-3 ${receiving ? 'sm:grid-cols-5' : 'sm:grid-cols-3'}`}>
                  <Field label={`Quantity${line.item ? ` (${line.item.unit})` : ''}`}>
                    {props => <input {...props} value={line.quantity} onChange={event => update(line.key, { quantity: event.target.value })} className={INPUT} inputMode="numeric" />}
                  </Field>
                  {receiving && (
                    <Field label="Line total excl. VAT" hint={unitCost !== null ? `${nad(unitCost)} each` : undefined}>
                      {props => <input {...props} value={line.lineCost} onChange={event => update(line.key, { lineCost: event.target.value })} className={INPUT} inputMode="decimal" placeholder="0.00" />}
                    </Field>
                  )}
                  {receiving && (
                    <Field label="VAT %">
                      {props => <input {...props} value={line.vatRate} onChange={event => update(line.key, { vatRate: event.target.value })} className={INPUT} inputMode="decimal" />}
                    </Field>
                  )}
                  <Field label="Batch">
                    {props => <input {...props} value={line.batchNo} onChange={event => update(line.key, { batchNo: event.target.value })} className={INPUT} maxLength={40} />}
                  </Field>
                  {receiving && (
                    <Field label="Expires" hint={line.expiryDate && line.expiryDate < addDaysToKey(todayKey(), 90) ? `Within 3 months (${day(line.expiryDate)})` : undefined}>
                      {props => <input {...props} type="date" value={line.expiryDate} onChange={event => update(line.key, { expiryDate: event.target.value })} className={INPUT} />}
                    </Field>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <button type="button" onClick={() => setLines(current => [...current, emptyLine(null, context)])} className={SECONDARY}>
          <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Add a line
        </button>

        {receiving && (
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-2">
            <Field label="Supplier invoice total incl. VAT" hint="Optional: when given, the lines must add up to it before the delivery is saved.">
              {props => <input {...props} value={supplierTotal} onChange={event => setSupplierTotal(event.target.value)} className={INPUT} inputMode="decimal" placeholder="0.00" />}
            </Field>
            <label className="flex items-start gap-2 text-sm text-gray-700 sm:pt-7">
              <input type="checkbox" checked={createPayable} onChange={event => setCreatePayable(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              <span>
                <span className="font-medium">Add the supplier invoice to payables</span>
                <span className="block text-xs text-gray-500">
                  {supplier ? `Due ${day(addDaysToKey(date || todayKey(), supplier.paymentTermsDays))} (${supplier.paymentTermsDays} days). Mark it paid in Finance.` : 'Due after the supplier\'s payment terms.'}
                </span>
              </span>
            </label>
            <Field label="Notes" className="sm:col-span-2">
              {props => <input {...props} value={notes} onChange={event => setNotes(event.target.value)} className={INPUT} maxLength={500} />}
            </Field>
          </div>
        )}
      </form>
    </ListSheet>
  );
};

export default DeliverySheet;
