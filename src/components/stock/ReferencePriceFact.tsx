import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { saveReferencePrice } from '../../services/stock/pricingRulesService';
import type { StockItem } from '../../utils/stock/items';
import { parseAmountText } from '../../utils/stock/items';
import { canStock } from '../../utils/stock/stockRoles';
import type { StockContext } from './stockContext';
import { INPUT, LINK, errorText, nad } from './stockUi';

/**
 * A medicine's fund reference price on its sheet (parity E7): the most a medical aid pays per unit, VAT included. A
 * medical aid patient is billed at most this (From stock lets staff bill the full price instead). Practitioners, nurses
 * and administrators keep it, as they keep the item.
 */
export const ReferencePriceFact: React.FC<{ context: StockContext; item: StockItem }> = ({ context, item }) => {
  const current = context.settings.referencePrices?.get(item.id) ?? null;
  const canEdit = canStock(context.role, 'edit_items') && context.settings.pricingSetUp === true;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const start = () => {
    setText(current === null ? '' : (current / 100).toFixed(2));
    setProblem(null);
    setEditing(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim() === '' ? null : parseAmountText(text);
    if (text.trim() !== '' && (value === null || value <= 0)) {
      setProblem('An amount in N$ per unit, for example 12.50, or empty for none.');
      return;
    }
    setSaving(true);
    try {
      await saveReferencePrice(item.id, value);
      toast.success(value === null ? `${item.name} has no reference price now.` : `${item.name}: the fund pays at most ${nad(Math.round(value * 100))} a ${item.unit}.`);
      setEditing(false);
      context.reloadSettings();
    } catch (error) {
      setProblem(errorText(error, 'The reference price could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <span className="flex flex-wrap items-center gap-x-2">
        <span>{current === null ? 'Not kept' : `${nad(current)} per ${item.unit}`}</span>
        {canEdit && (
          <button type="button" className={LINK} onClick={start}>
            {current === null ? 'Add' : 'Change'}
          </button>
        )}
      </span>
    );
  }

  return (
    <form onSubmit={event => void save(event)} className="mt-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`reference-${item.id}`} className="sr-only">Fund reference price per {item.unit} (N$)</label>
        <input
          id={`reference-${item.id}`}
          inputMode="decimal"
          className={`${INPUT} w-28`}
          value={text}
          placeholder="0.00"
          autoFocus
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `reference-${item.id}-problem` : undefined}
          onChange={event => setText(event.target.value)}
        />
        <button type="submit" className={LINK} disabled={saving}>{saving ? 'Saving' : 'Save'}</button>
        <button type="button" className={LINK} onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
      </div>
      {problem && <p id={`reference-${item.id}-problem`} className="text-xs text-red-600" role="alert">{problem}</p>}
    </form>
  );
};

export default ReferencePriceFact;
