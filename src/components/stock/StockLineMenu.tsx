import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { loadStockItems, type StockItemsLoad } from '../../services/stock/stockService';
import type { ServiceSelection } from '../../types/billing';
import type { StockItem } from '../../utils/stock/items';
import { stockBillingLine } from '../../utils/stock/stockLine';
import { describePricedLine, describeTier, itemKindOf } from '../../utils/stock/pricingRules';
import { addMaterialLine, procedureOptions } from '../../utils/stock/materialLines';
import { ItemPicker } from './ItemPicker';
import { priceOf } from './stockContext';
import { useStockSettings } from './useStockSettings';
import { Field } from './stockParts';
import { INPUT, PRIMARY, SECONDARY, nad, units } from './stockUi';

interface StockLineMenuProps {
  practiceId: string | null;
  /** The bill's lines as they are on screen */
  lines: readonly ServiceSelection[];
  hasMedicalAid: boolean;
  /** Why lines cannot be added now (the medical aid's prices are loading); null when they can */
  disabledReason: string | null;
  onApply: (lines: ServiceSelection[]) => void;
  /** The patient has a staff price rate (patientRates.ts): medicines start at the staff price, which staff can untick */
  staffPatient?: boolean;
}

/**
 * "From stock" on the visit's bill: a medicine or consumable from the practice's stock as a line, priced by the item's
 * price or the practice's rule. The units come off stock when the visit is saved (and go back if the invoice is
 * cancelled or credited). Shows only once the practice has stock items.
 */
export const StockLineMenu: React.FC<StockLineMenuProps> = ({ practiceId, lines, hasMedicalAid, disabledReason, onApply, staffPatient = false }) => {
  const setup = useStockSettings(practiceId);
  const ready = setup.status === 'ready';
  const [stock, setStock] = useState<StockItemsLoad | null>(null);
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<StockItem | null>(null);
  const [quantity, setQuantity] = useState('1');
  // The staff tier for a medicine (ticked for a patient with a staff rate), the full price above the fund's reference
  // price, the procedure a material was used for
  const [staffPrice, setStaffPrice] = useState(staffPatient);
  const [fullPrice, setFullPrice] = useState(false);
  const [usedFor, setUsedFor] = useState('');

  useEffect(() => {
    if (!practiceId || !ready) return;
    let active = true;
    loadStockItems(practiceId)
      .then(result => {
        if (active) setStock(result);
      })
      .catch(() => {
        // Without the items the button stays hidden; the rest of the bill works as before
        if (active) setStock(null);
      });
    return () => {
      active = false;
    };
  }, [practiceId, ready]);

  if (setup.status !== 'ready' || !stock || !stock.items.some(entry => entry.isActive)) return null;
  const { settings } = setup;
  const count = /^\d+$/.test(quantity.trim()) ? Number(quantity.trim()) : 0;
  const kind = item ? itemKindOf(item.category) : null;
  const price = item && count > 0 ? priceOf(item, count, settings, stock.levels, { hasMedicalAid, staffPrice, atReferencePrice: !fullPrice }) : null;
  const priceBasis = price ? describePricedLine(price) : null;
  const staffTier = kind === 'medicine' && item?.sellingPriceCents === null ? settings.pricing?.tiers.staff ?? null : null;
  const procedures = kind === 'material' ? procedureOptions(lines, new Set(stock.items.map(entry => entry.id))) : [];
  const onHand = item ? stock.levels.get(item.id)?.onHand ?? 0 : 0;
  const onBill = item ? lines.filter(line => line.tariffId === item.id).reduce((sum, line) => sum + line.quantity, 0) : 0;
  const short = item ? count + onBill - Math.max(onHand, 0) : 0;

  const close = () => {
    setOpen(false);
    setItem(null);
    setQuantity('1');
    setStaffPrice(staffPatient);
    setFullPrice(false);
    setUsedFor('');
  };

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!item) {
      toast.error('Choose the item from stock.');
      return;
    }
    if (count < 1 || count > 100000) {
      toast.error('Type how many units.');
      return;
    }
    if (!price) {
      toast.error(`${item.name} has no price: give it a cost or a selling price in Stock.`);
      return;
    }
    const service = stockBillingLine({ item, quantity: count, price, hasMedicalAid, lineId: crypto.randomUUID() });
    // A material goes with the procedure it was used for (NAMAF rule 013); anything else at the end of the bill
    onApply(kind === 'material' ? addMaterialLine(lines, service, usedFor || null) : [...lines, service]);
    toast.success(`${item.name} added to the bill. Stock comes off when the visit is saved.`);
    close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // The patient's rate may have loaded after the bill opened
          setStaffPrice(staffPatient);
          setOpen(true);
        }}
        disabled={Boolean(disabledReason)}
        title={disabledReason ?? 'Add a medicine or consumable from stock'}
        className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <Icon icon="solar:box-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        From stock
      </button>
      <ListSheet
        open={open}
        onClose={close}
        title="Add from stock"
        subtitle="Priced by the item's own price or your price rule (Stock > Settings)"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className={SECONDARY}>Cancel</button>
            <button type="submit" form="stock-line-form" className={PRIMARY}>Add to bill</button>
          </div>
        }
      >
        <form id="stock-line-form" onSubmit={add} className="space-y-4" noValidate>
          <ItemPicker items={stock.items} levels={stock.levels} value={item} onChange={setItem} label="Item from stock" showOnHand autoFocus />
          <Field
            label={`How many${item ? ` (${item.unit})` : ''}`}
            error={item && count > 0 && short > 0 ? `Only ${units(Math.max(onHand, 0), item.unit)} on hand${onBill > 0 ? ` and ${onBill} already on this bill` : ''}: check the shelf.` : undefined}
          >
            {fieldProps => <input {...fieldProps} value={quantity} onChange={event => setQuantity(event.target.value)} className={INPUT} inputMode="numeric" />}
          </Field>
          {procedures.length > 0 && (
            <Field label="Used for" hint="The material goes on the bill straight after this line, with its date, tooth and authorisation.">
              {fieldProps => (
                <select {...fieldProps} value={usedFor} onChange={event => setUsedFor(event.target.value)} className={INPUT}>
                  <option value="">Not for one procedure</option>
                  {procedures.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              )}
            </Field>
          )}
          {staffTier && (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={staffPrice} onChange={event => setStaffPrice(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              <span className="text-gray-700">Staff price ({describeTier(staffTier)}, then VAT)</span>
            </label>
          )}
          {price && price.referenceUnitCents !== null && (price.atReference || price.aboveReference) && (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={fullPrice} onChange={event => setFullPrice(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              <span className="text-gray-700">
                Bill the full price. The fund pays at most its reference price, {nad(price.referenceUnitCents)} a unit; the patient owes the rest.
              </span>
            </label>
          )}
          {item && count > 0 && (
            <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700" aria-live="polite">
              {price
                ? <>{count} × {nad(price.unitPriceCents)} = <strong>{nad(price.totalCents)}</strong> incl. VAT{priceBasis ? ` (${priceBasis})` : ''}{item.nappiCode ? ` · NAPPI ${item.nappiCode}` : ''}</>
                : 'No price: the item has no cost and no selling price.'}
            </p>
          )}
        </form>
      </ListSheet>
    </>
  );
};

export default StockLineMenu;
