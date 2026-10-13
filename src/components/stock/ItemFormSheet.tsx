import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { INVENTORY_CATEGORY_LABELS } from '../finance/financeTheme';
import { saveStockItem } from '../../services/stock/stockService';
import { parseDirections } from '../../utils/stock/dosage';
import { STOCK_CATEGORIES, billingCodeFor, draftFromItem, normalizeNappi, validateItemDraft, type ItemDraft, type ItemDraftErrors, type StockItem } from '../../utils/stock/items';
import { priceStockLine } from '../../utils/stock/pricing';
import { toCents } from '../../utils/billing/money';
import type { StockContext } from './stockContext';
import { Field } from './stockParts';
import { INPUT, PRIMARY, SECONDARY, errorText, nad } from './stockUi';

interface ItemFormSheetProps {
  context: StockContext;
  item: StockItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: (itemId: string) => void;
}

const UNIT_SUGGESTIONS = ['tablet', 'capsule', 'ml', 'sachet', 'puff', 'drop', 'suppository', 'patch', 'tube', 'bottle', 'box', 'each', 'pair', 'frame'];

/** Add or change a stock item: what it is, how it is coded and billed, its price, and how much to hold */
export const ItemFormSheet: React.FC<ItemFormSheetProps> = ({ context, item, open, onClose, onSaved }) => {
  const [draft, setDraft] = useState<ItemDraft>(() => draftFromItem(item));
  const [errors, setErrors] = useState<ItemDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);
  const costLocked = !!item && context.levels.has(item.id);
  const set = (changes: Partial<ItemDraft>) => setDraft(current => ({ ...current, ...changes }));
  const groups = useMemo(() => [...new Set(context.items.map(entry => entry.group).filter((group): group is string => !!group))].sort(), [context.items]);
  const isMedicine = draft.category === 'medications';

  // What the item sells at, for the quantity it is usually given in (a pack, else one unit)
  const preview = useMemo(() => {
    const quantity = Number(draft.packSize) > 0 ? Number(draft.packSize) : 1;
    const cost = Number(draft.unitCost);
    const fixed = draft.sellingPrice.trim() === '' ? null : Number(draft.sellingPrice);
    // VAT is added only when the practice is VAT registered (Settings > Practice) and the item is VAT-able
    const vat = !context.settings.vatRegistered ? 0 : draft.vatRate.trim() === '' ? context.settings.defaultVatRate : Number(draft.vatRate);
    if (!Number.isFinite(cost) || (fixed !== null && !Number.isFinite(fixed)) || !Number.isFinite(vat)) return null;
    const unitCost = costLocked && item ? item.unitCostCents : toCents(cost);
    const price = priceStockLine({ quantity, lineCostCents: unitCost * quantity || null, vatRate: vat, rule: context.settings.priceRule, fixedUnitPriceCents: fixed === null ? null : toCents(fixed) });
    return price ? { quantity, price } : null;
  }, [draft.packSize, draft.unitCost, draft.sellingPrice, draft.vatRate, costLocked, item, context.settings]);

  const directionsPreview = draft.defaultDirections.trim() ? parseDirections(draft.defaultDirections, { unit: draft.unit }) : null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = validateItemDraft(draft, { practiceId: context.practiceId, costLocked });
    if (!result.ok) {
      setErrors(result.errors);
      toast.error('Check the fields marked in red.');
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const id = await saveStockItem(result.payload);
      toast.success(item ? `${draft.name.trim()} saved.` : `${draft.name.trim()} added.`);
      onSaved(id);
    } catch (error) {
      toast.error(errorText(error, 'Could not save the item.'));
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
      <button type="submit" form="stock-item-form" disabled={saving} className={PRIMARY}>
        {saving && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {item ? 'Save item' : 'Add item'}
      </button>
    </div>
  );

  return (
    <ListSheet open={open} onClose={onClose} title={item ? `Change ${item.name}` : 'Add a stock item'} subtitle="Medicines, consumables, frames: anything you keep on the shelf." size="lg" footer={footer} dismissible={!saving}>
      <form id="stock-item-form" onSubmit={save} className="space-y-6" noValidate>
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="What it is">
          <Field label="Name" error={errors.name} className="sm:col-span-2" hint={isMedicine ? 'Include the strength and form, e.g. "Amoxicillin 500 mg capsules".' : undefined}>
            {props => <input {...props} value={draft.name} onChange={event => set({ name: event.target.value })} className={INPUT} maxLength={160} autoFocus />}
          </Field>
          <Field label="Category" error={errors.category}>
            {props => (
              <select {...props} value={draft.category} onChange={event => set({ category: event.target.value })} className={INPUT}>
                {STOCK_CATEGORIES.map(category => <option key={category} value={category}>{INVENTORY_CATEGORY_LABELS[category] ?? category}</option>)}
              </select>
            )}
          </Field>
          <Field label="Unit (how it is counted and given)" error={errors.unit}>
            {props => (
              <>
                <input {...props} list="stock-units" value={draft.unit} onChange={event => set({ unit: event.target.value })} className={INPUT} placeholder="tablet" />
                <datalist id="stock-units">{UNIT_SUGGESTIONS.map(unit => <option key={unit} value={unit} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Group" hint="Your own grouping, e.g. Antibiotics, Dental materials." error={errors.group}>
            {props => (
              <>
                <input {...props} list="stock-groups" value={draft.group} onChange={event => set({ group: event.target.value })} className={INPUT} maxLength={60} />
                <datalist id="stock-groups">{groups.map(group => <option key={group} value={group} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Preferred supplier" hint="Where the reorder report orders it from.">
            {props => (
              <select {...props} value={draft.preferredSupplierId} onChange={event => set({ preferredSupplierId: event.target.value })} className={INPUT}>
                <option value="">None</option>
                {context.suppliers.filter(supplier => supplier.isActive || supplier.id === draft.preferredSupplierId)
                  .map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            )}
          </Field>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Codes">
          <Field label="NAPPI code" error={errors.nappiCode} hint={isMedicine ? 'Needed to claim a medicine from a fund.' : 'Medicines and some materials.'}>
            {props => <input {...props} value={draft.nappiCode} onChange={event => set({ nappiCode: event.target.value })} className={INPUT} inputMode="numeric" placeholder="e.g. 700123001" />}
          </Field>
          <Field label="Barcode" error={errors.barcode} hint="Scan it into this box.">
            {props => <input {...props} value={draft.barcode} onChange={event => set({ barcode: event.target.value })} className={INPUT} />}
          </Field>
          <Field label="Billed under code" error={errors.tariffCode} hint={`Leave empty for medicines. The bill shows ${billingCodeFor({ nappiCode: normalizeNappi(draft.nappiCode), tariffCode: draft.tariffCode.trim().toUpperCase() || null, sku: draft.sku || null })}.`}>
            {props => <input {...props} value={draft.tariffCode} onChange={event => set({ tariffCode: event.target.value })} className={INPUT} placeholder="tariff code" />}
          </Field>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4" aria-label="Price">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Cost per unit (excl. VAT)" error={errors.unitCost} hint={costLocked ? 'Follows the deliveries (average cost).' : 'What one unit costs you.'}>
              {props => <input {...props} value={draft.unitCost} disabled={costLocked} onChange={event => set({ unitCost: event.target.value })} className={INPUT} inputMode="decimal" placeholder="0.00" />}
            </Field>
            <Field
              label="VAT when sold"
              error={errors.vatRate}
              hint={context.settings.vatRegistered ? 'Frames and over-the-counter medicines carry VAT.' : 'The practice is not VAT registered (Settings > Practice): no VAT is added.'}
            >
              {props => (
                <select {...props} value={draft.vatRate.trim()} onChange={event => set({ vatRate: event.target.value })} className={INPUT}>
                  <option value="">VAT-able ({context.settings.defaultVatRate}%)</option>
                  <option value="0">Not VAT-able</option>
                  {draft.vatRate.trim() !== '' && Number(draft.vatRate) > 0 && <option value={draft.vatRate.trim()}>VAT-able ({draft.vatRate.trim()}%)</option>}
                </select>
              )}
            </Field>
            <Field label="Fixed price per unit (incl. VAT)" error={errors.sellingPrice} hint="Empty = your price rule (Stock > Settings).">
              {props => <input {...props} value={draft.sellingPrice} onChange={event => set({ sellingPrice: event.target.value })} className={INPUT} inputMode="decimal" placeholder="from the rule" />}
            </Field>
          </div>
          <p className="mt-3 text-sm text-gray-700" aria-live="polite">
            {preview
              ? <>Sells at <strong>{nad(preview.price.totalCents)}</strong> for {preview.quantity} {preview.quantity === 1 ? draft.unit || 'unit' : 'units'} ({preview.price.source === 'fixed' ? 'fixed price' : 'price rule'}).</>
              : 'Give a cost or a fixed price to see what it sells at.'}
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="How much to hold">
          <Field label="Minimum to hold" error={errors.minimum} hint="Below this it is on the reorder report.">
            {props => <input {...props} value={draft.minimum} onChange={event => set({ minimum: event.target.value })} className={INPUT} inputMode="numeric" />}
          </Field>
          <Field label="Most to hold" error={errors.maximum} hint="An order fills up to this.">
            {props => <input {...props} value={draft.maximum} onChange={event => set({ maximum: event.target.value })} className={INPUT} inputMode="numeric" />}
          </Field>
          <Field label="Units in a pack" error={errors.packSize} hint="Orders are in whole packs.">
            {props => <input {...props} value={draft.packSize} onChange={event => set({ packSize: event.target.value })} className={INPUT} inputMode="numeric" />}
          </Field>
        </section>

        {(isMedicine || context.settings.dispensingEnabled) && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Dispensing">
            <Field label="Usual directions" error={errors.defaultDirections} hint={directionsPreview ? `Label: ${directionsPreview.text}` : 'Shorthand such as 1 tds, offered when it is dispensed.'}>
              {props => <input {...props} value={draft.defaultDirections} onChange={event => set({ defaultDirections: event.target.value })} className={INPUT} maxLength={60} placeholder="1 tds" />}
            </Field>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={draft.isScheduled} onChange={event => set({ isScheduled: event.target.checked })} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                <span><span className="font-medium">Scheduled medicine</span> <span className="block text-xs text-gray-500">Every receipt and issue goes in the register (Reports).</span></span>
              </label>
              {draft.isScheduled && (
                <Field label="Schedule">
                  {props => <input {...props} value={draft.scheduleLabel} onChange={event => set({ scheduleLabel: event.target.value })} className={INPUT} maxLength={20} placeholder="e.g. S5" />}
                </Field>
              )}
            </div>
          </section>
        )}

        {!item && (
          <section className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4" aria-label="Already on the shelf">
            <p className="mb-3 text-sm font-medium text-gray-900">Already on the shelf?</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Quantity" error={errors.openingQuantity} hint="Recorded as the opening balance.">
                {props => <input {...props} value={draft.openingQuantity} onChange={event => set({ openingQuantity: event.target.value })} className={INPUT} inputMode="numeric" placeholder="0" />}
              </Field>
              <Field label="Batch">
                {props => <input {...props} value={draft.openingBatch} onChange={event => set({ openingBatch: event.target.value })} className={INPUT} maxLength={40} />}
              </Field>
              <Field label="Expires" error={errors.openingExpiry}>
                {props => <input {...props} type="date" value={draft.openingExpiry} onChange={event => set({ openingExpiry: event.target.value })} className={INPUT} />}
              </Field>
            </div>
          </section>
        )}

        <div>
          <button type="button" onClick={() => setMore(value => !value)} aria-expanded={more} className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded">
            <Icon icon="solar:alt-arrow-down-bold-duotone" className={`h-4 w-4 transition-transform motion-reduce:transition-none ${more ? 'rotate-180' : ''}`} aria-hidden="true" />
            More details
          </button>
          {more && (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Product code (your own)">
                {props => <input {...props} value={draft.sku} onChange={event => set({ sku: event.target.value })} className={INPUT} maxLength={60} />}
              </Field>
              <Field label="Where it is kept">
                {props => <input {...props} value={draft.location} onChange={event => set({ location: event.target.value })} className={INPUT} maxLength={120} placeholder="e.g. Dispensary, shelf 3" />}
              </Field>
              <Field label="Description" className="sm:col-span-2">
                {props => <input {...props} value={draft.description} onChange={event => set({ description: event.target.value })} className={INPUT} maxLength={500} />}
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                {props => <textarea {...props} value={draft.notes} onChange={event => set({ notes: event.target.value })} className={INPUT} rows={2} maxLength={1000} />}
              </Field>
            </div>
          )}
        </div>
      </form>
    </ListSheet>
  );
};

export default ItemFormSheet;
