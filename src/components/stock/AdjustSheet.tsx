import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { adjustStock } from '../../services/stock/stockService';
import { todayKey } from '../../utils/billing/dates';
import { ADJUSTMENT_REASONS, gainValueCents, issueValueCents, type AdjustmentReason } from '../../utils/stock/ledger';
import type { StockItem } from '../../utils/stock/items';
import { defaultStoreFor, locationIdOf, storeName, usesStores } from '../../utils/stock/stores';
import { stockLevelOf, type StockContext } from './stockContext';
import { Field } from './stockParts';
import { StorePicker } from './storeParts';
import { INPUT, PRIMARY, SECONDARY, errorText, nad, units } from './stockUi';

interface AdjustSheetProps {
  context: StockContext;
  item: StockItem;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Take stock off (broken, expired, lost, used) or add it (found), always with a reason that stays with the stock */
export const AdjustSheet: React.FC<AdjustSheetProps> = ({ context, item, open, onClose, onSaved }) => {
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [quantity, setQuantity] = useState('');
  const [reasonCode, setReasonCode] = useState<AdjustmentReason>('damaged');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(todayKey());
  const [saving, setSaving] = useState(false);
  const level = stockLevelOf(item, context.levels);
  // L10: with more than one store, the store adjusted (the value still follows the practice's average cost)
  const multiStore = usesStores(context.stores);
  const [store, setStore] = useState(() => defaultStoreFor(context.stores, context.userBranchId));
  const held = multiStore ? context.storeLevels.get(store)?.get(item.id)?.onHand ?? 0 : level.onHand;
  const count = /^\d+$/.test(quantity.trim()) ? Number(quantity) : 0;
  const signed = direction === 'out' ? -count : count;
  const valueCents = count === 0 ? 0 : direction === 'out' ? -issueValueCents(level, count) : gainValueCents(level, count);
  const reasons = ADJUSTMENT_REASONS.filter(option => option.direction === 'either' || option.direction === direction);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (count < 1) {
      toast.error('Type how many units.');
      return;
    }
    if (reason.trim().length < 3) {
      toast.error('Describe what happened. It stays with the adjustment.');
      return;
    }
    setSaving(true);
    try {
      await adjustStock({ practice_id: context.practiceId, item_id: item.id, quantity: signed, reason_code: reasonCode, reason: reason.trim(), occurred_on: date,
        location_id: locationIdOf(store) });
      toast.success(`${item.name}: ${direction === 'out' ? 'taken off' : 'added'} ${units(count, item.unit)}.`);
      onSaved();
    } catch (error) {
      toast.error(errorText(error, 'Could not record the adjustment.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      title={`Adjust ${item.name}`}
      subtitle={`${units(held, item.unit)} on hand now${multiStore ? ` in ${storeName(context.stores, locationIdOf(store))}` : ''}`}
      dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" form="stock-adjust-form" disabled={saving} className={PRIMARY}>
            {saving && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Record adjustment
          </button>
        </div>
      }
    >
      <form id="stock-adjust-form" onSubmit={save} className="space-y-4" noValidate>
        <div className="inline-flex rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Take off or add">
          {(['out', 'in'] as const).map(option => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={direction === option}
              onClick={() => {
                setDirection(option);
                setReasonCode(option === 'out' ? 'damaged' : 'found');
              }}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${direction === option ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {option === 'out' ? 'Take off' : 'Add'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`How many (${item.unit})`}>
            {props => <input {...props} value={quantity} onChange={event => setQuantity(event.target.value)} className={INPUT} inputMode="numeric" autoFocus />}
          </Field>
          <Field label="Reason">
            {props => (
              <select {...props} value={reasonCode} onChange={event => setReasonCode(event.target.value as AdjustmentReason)} className={INPUT}>
                {reasons.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="What happened" className="sm:col-span-2" hint="e.g. Bottle dropped in the dispensary; expired batch B12 sent for destruction.">
            {props => <input {...props} value={reason} onChange={event => setReason(event.target.value)} className={INPUT} maxLength={300} />}
          </Field>
          <Field label="Date" hint="A day in a closed month is refused.">
            {props => <input {...props} type="date" value={date} max={todayKey()} onChange={event => setDate(event.target.value)} className={INPUT} />}
          </Field>
          {multiStore && <StorePicker stores={context.stores} value={store} onChange={setStore} label="Store" />}
        </div>
        {count > 0 && (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700" aria-live="polite">
            On hand {held} → <strong>{held + signed}</strong>; stock value {valueCents < 0 ? '−' : '+'}{nad(Math.abs(valueCents))} (at the average cost).
          </p>
        )}
      </form>
    </ListSheet>
  );
};

export default AdjustSheet;
