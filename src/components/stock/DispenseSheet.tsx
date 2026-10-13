import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { dispenseMedicine } from '../../services/stock/stockService';
import type { ServiceSelection } from '../../types/billing';
import { fromCents } from '../../utils/billing/money';
import { daysOfMedicine, parseDirections } from '../../utils/stock/dosage';
import type { StockItem } from '../../utils/stock/items';
import type { DispensingRecord } from '../../utils/stock/repeats';
import { stockBillingLine } from '../../utils/stock/stockLine';
import type { ItemLevel, StockSettings } from '../../utils/stock/stockRows';
import { ItemPicker } from './ItemPicker';
import { priceOf } from './stockContext';
import { describePricedLine } from '../../utils/stock/pricingRules';
import { Field } from './stockParts';
import { INPUT, PRIMARY, SECONDARY, errorText, nad, units } from './stockUi';

/** What the sheet starts with: a prescribed medicine, a repeat of a script, or nothing (from stock) */
export interface DispenseStart {
  /** The visit's prescription line, as text, kept with the record */
  prescribedAs: string | null;
  /** Search text for the item (the prescribed medicine's name) */
  query: string;
  directions: string;
  item: StockItem | null;
  quantity: number | null;
  repeatOf: DispensingRecord | null;
}

interface DispenseSheetProps {
  open: boolean;
  onClose: () => void;
  practiceId: string;
  patientId: string;
  visitId: string;
  prescriberId: string | null;
  settings: StockSettings;
  items: readonly StockItem[];
  levels: ReadonlyMap<string, ItemLevel>;
  start: DispenseStart;
  /** Why the visit's bill cannot take lines now (the medical aid's prices are loading); null when it can */
  billingBlocked: string | null;
  hasMedicalAid: boolean;
  /** Put the line on the visit's bill on screen (charged, and taken off stock, when the visit is saved) */
  onBill: (line: ServiceSelection) => void;
  /** The allergy check of the visit: runs `proceed` when nothing matches or the practitioner gives a reason */
  confirmMedicine: (medicine: string, proceed: () => void) => void;
  onDispensed: () => void;
}

/** 0 to 12 repeats (the database allows the same) */
const REPEAT_CHOICES = Array.from({ length: 13 }, (_, index) => index);

/**
 * Dispense a medicine from stock: the item, how many, the directions (shorthand such as "1 tds x5d" becomes the label
 * text), repeats, and whether it goes on the visit's bill. Stock on hand is shown and a shortfall is said plainly; it
 * does not stop the dispensing (the shelf may hold stock not yet received in OneHealth).
 */
export const DispenseSheet: React.FC<DispenseSheetProps> = props => {
  const { start, settings, levels } = props;
  const [item, setItem] = useState<StockItem | null>(start.item);
  const [shorthand, setShorthand] = useState(start.directions || start.item?.defaultDirections || '');
  // A course the directions spell out ("1 tds x5d" = 15) is the quantity to start from
  const [quantity, setQuantity] = useState(() => {
    if (start.quantity) return String(start.quantity);
    const course = parseDirections(start.directions || start.item?.defaultDirections || '', { unit: start.item?.unit ?? null });
    return course.unitsPerDay && course.days && !course.asNeeded ? String(Math.ceil(course.unitsPerDay * course.days)) : '';
  });
  const [daysText, setDaysText] = useState('');
  const [repeats, setRepeats] = useState(0);
  const [chronic, setChronic] = useState(start.repeatOf?.isChronic ?? false);
  const [bill, setBill] = useState(props.billingBlocked === null);
  const [saving, setSaving] = useState(false);

  const isRepeat = start.repeatOf !== null;
  const count = /^\d+$/.test(quantity.trim()) ? Number(quantity.trim()) : 0;
  const onHand = item ? levels.get(item.id)?.onHand ?? 0 : 0;
  const directions = parseDirections(shorthand, { unit: item?.unit ?? null });
  const typedDays = /^\d+$/.test(daysText.trim()) ? Number(daysText.trim()) : null;
  const workedOutDays = count > 0 ? daysOfMedicine(count, directions) : null;
  const days = typedDays ?? workedOutDays;
  // The medicine's price for this patient: their tier and the fund's reference price, once the practice set them
  const price = item && count > 0 ? priceOf(item, count, settings, levels, { hasMedicalAid: props.hasMedicalAid }) : null;
  const priceBasis = price ? describePricedLine(price) : null;
  const short = item && count > onHand ? count - Math.max(onHand, 0) : 0;

  const chooseItem = (next: StockItem | null) => {
    setItem(next);
    if (next?.defaultDirections && !shorthand.trim()) setShorthand(next.defaultDirections);
  };

  /** What stops the dispensing, in words, or null */
  const problem = (): string | null => {
    if (!item) return 'Choose the item from stock.';
    if (count < 1 || count > 100000) return 'Type how many units to dispense.';
    if (!directions.text) return 'Write the directions for the label.';
    if (directions.text.length > 300) return 'Keep the directions to 300 characters.';
    if (typedDays !== null && (typedDays < 1 || typedDays > 366)) return 'Days of medicine: from 1 to 366.';
    if (bill && props.billingBlocked) return props.billingBlocked;
    if (bill && !price) return `${item.name} has no price: give it a cost or a selling price in Stock, or give it without billing.`;
    return null;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = problem();
    if (message || !item) {
      toast.error(message ?? 'Choose the item from stock.');
      return;
    }
    const chosen = item;
    props.confirmMedicine(chosen.name, () => {
      void dispense(chosen);
    });
  };

  const dispense = async (chosen: StockItem) => {
    setSaving(true);
    try {
      const result = await dispenseMedicine({
        practice_id: props.practiceId,
        patient_id: props.patientId,
        visit_id: props.visitId,
        item_id: chosen.id,
        quantity: count,
        directions: directions.text,
        directions_code: shorthand.trim().slice(0, 60) || null,
        // The database keeps up to a year; a larger supply still falls due within it
        days_supply: days === null ? null : Math.min(days, 366),
        repeats_allowed: isRepeat ? 0 : repeats,
        is_chronic: chronic,
        repeat_of: start.repeatOf?.id ?? null,
        prescriber_id: props.prescriberId,
        prescribed_as: start.prescribedAs?.slice(0, 300) ?? null,
        bill,
        unit_price: bill && price ? fromCents(price.unitPriceCents) : null
      });
      if (bill && price) {
        props.onBill(stockBillingLine({ item: chosen, quantity: count, price, hasMedicalAid: props.hasMedicalAid, lineId: crypto.randomUUID() }));
        toast.success(`${result.number}: ${chosen.name} is on the visit's bill. Save the visit to charge it.`, { duration: 6000 });
      } else {
        toast.success(`${result.number}: ${units(count, chosen.unit)} of ${chosen.name} given and taken off stock.`);
      }
      props.onDispensed();
    } catch (error) {
      toast.error(errorText(error, 'Could not dispense.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListSheet
      open={props.open}
      onClose={props.onClose}
      title={isRepeat ? 'Dispense a repeat' : 'Dispense from stock'}
      subtitle={start.prescribedAs ? `Prescribed: ${start.prescribedAs}` : isRepeat ? `Script ${start.repeatOf?.number ?? ''}` : undefined}
      dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={props.onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" form="stock-dispense-form" disabled={saving} className={PRIMARY}>
            {saving && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {short > 0 ? 'Dispense anyway' : 'Dispense'}
          </button>
        </div>
      }
    >
      <form id="stock-dispense-form" onSubmit={submit} className="space-y-4" noValidate>
        {isRepeat && item ? (
          <p className="rounded-xl border border-cyan-200 bg-cyan-50/50 px-3 py-2.5 text-sm text-gray-800">
            <span className="font-medium">{item.name}</span>
            <span className="block text-xs text-gray-500">{units(onHand, item.unit)} on hand</span>
          </p>
        ) : (
          <ItemPicker items={props.items} levels={levels} value={item} onChange={chooseItem} label="Item from stock" showOnHand autoFocus={!item} initialQuery={start.query} />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={`How many${item ? ` (${item.unit})` : ''}`}
            error={short > 0 ? `Only ${units(Math.max(onHand, 0), item?.unit ?? 'units')} on hand: ${short} short. Check the shelf, or receive the delivery first.` : undefined}
          >
            {fieldProps => <input {...fieldProps} value={quantity} onChange={event => setQuantity(event.target.value)} className={INPUT} inputMode="numeric" autoFocus={Boolean(item)} />}
          </Field>
          <Field label="Days of medicine" hint={workedOutDays !== null ? `About ${workedOutDays} from the directions; type to change.` : 'Type how long it should last (for the repeat due date).'}>
            {fieldProps => <input {...fieldProps} value={daysText} onChange={event => setDaysText(event.target.value)} className={INPUT} inputMode="numeric" placeholder={workedOutDays !== null ? String(workedOutDays) : ''} />}
          </Field>
          <Field
            label="Directions"
            className="sm:col-span-2"
            hint={directions.unknown.length > 0 ? `Not recognised, printed as typed: ${directions.unknown.join(', ')}. Check the label.` : 'Shorthand works: 1 tds x5d, 2 nocte, 5ml bd pc, 1 prn.'}
          >
            {fieldProps => <input {...fieldProps} value={shorthand} onChange={event => setShorthand(event.target.value)} className={INPUT} maxLength={300} />}
          </Field>
        </div>

        {directions.text && (
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" aria-live="polite">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">On the label</p>
            <p className="mt-0.5 text-gray-900">{directions.text}</p>
          </div>
        )}

        {!isRepeat && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Repeats" hint={repeats > 0 ? `Valid for ${settings.scriptValidMonths} months.` : undefined}>
              {fieldProps => (
                <select {...fieldProps} value={repeats} onChange={event => setRepeats(Number(event.target.value))} className={INPUT}>
                  {REPEAT_CHOICES.map(choice => <option key={choice} value={choice}>{choice === 0 ? 'No repeats' : `${choice} repeat${choice === 1 ? '' : 's'}`}</option>)}
                </select>
              )}
            </Field>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-gray-700">
              <input type="checkbox" checked={chronic} onChange={event => setChronic(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              Chronic medicine
            </label>
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-gray-700">Billing</legend>
          <div className="space-y-2">
            <label className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${bill ? 'border-cyan-300 bg-cyan-50/40' : 'border-gray-200'} ${props.billingBlocked ? 'opacity-60' : ''}`}>
              <input type="radio" name="stock-dispense-bill" checked={bill} disabled={Boolean(props.billingBlocked)} onChange={() => setBill(true)} className="mt-0.5 h-4 w-4 text-cyan-600 focus:ring-cyan-500" />
              <span>
                <span className="block font-medium text-gray-900">Add to this visit&apos;s bill</span>
                <span className="block text-gray-600">
                  {props.billingBlocked
                    ? props.billingBlocked
                    : price
                      ? `${count} × ${nad(price.unitPriceCents)} = ${nad(price.totalCents)} incl. VAT${priceBasis ? ` (${priceBasis})` : ''}. Stock comes off when the visit is saved.`
                      : item && count > 0 ? 'No price: the item has no cost and no selling price.' : 'The price shows once the item and quantity are chosen.'}
                </span>
              </span>
            </label>
            <label className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${!bill ? 'border-cyan-300 bg-cyan-50/40' : 'border-gray-200'}`}>
              <input type="radio" name="stock-dispense-bill" checked={!bill} onChange={() => setBill(false)} className="mt-0.5 h-4 w-4 text-cyan-600 focus:ring-cyan-500" />
              <span>
                <span className="block font-medium text-gray-900">Give without billing</span>
                <span className="block text-gray-600">A sample or a medicine included in the consultation. Stock comes off now.</span>
              </span>
            </label>
          </div>
        </fieldset>
      </form>
    </ListSheet>
  );
};

export default DispenseSheet;
