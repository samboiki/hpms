import React, { useId, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import type { StockItem } from '../../utils/stock/items';
import type { ItemLevel } from '../../utils/stock/stockRows';
import { INPUT, LABEL, units } from './stockUi';

interface ItemPickerProps {
  items: readonly StockItem[];
  levels: ReadonlyMap<string, ItemLevel>;
  value: StockItem | null;
  onChange: (item: StockItem | null) => void;
  label?: string;
  /** Show on hand next to each item (dispensing, returns) */
  showOnHand?: boolean;
  autoFocus?: boolean;
  /** Start the search with this text (a prescribed medicine's name) */
  initialQuery?: string;
}

const matches = (item: StockItem, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return item.name.toLowerCase().includes(needle)
    || (item.nappiCode ?? '').toLowerCase().includes(needle.replace(/[\s-]/g, ''))
    || (item.barcode ?? '').toLowerCase() === needle
    || (item.sku ?? '').toLowerCase().includes(needle)
    || (item.group ?? '').toLowerCase().includes(needle);
};

/**
 * Finds a stock item by name, NAPPI code, product code or group, or by scanning its barcode (a scanner types the code
 * and Enter: an exact barcode is chosen at once). Enter chooses the first match.
 */
export const ItemPicker: React.FC<ItemPickerProps> = ({ items, levels, value, onChange, label = 'Item', showOnHand, autoFocus, initialQuery = '' }) => {
  const id = useId();
  const [query, setQuery] = useState(initialQuery);
  const active = useMemo(() => items.filter(item => item.isActive), [items]);
  const found = useMemo(() => active.filter(item => matches(item, query)).slice(0, 8), [active, query]);

  if (value) {
    const level = levels.get(value.id);
    return (
      <div>
        <p className={LABEL}>{label}</p>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50/50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{value.name}</p>
            <p className="text-xs text-gray-500">
              {value.nappiCode ? `NAPPI ${value.nappiCode} · ` : ''}
              {showOnHand ? `${units(level?.onHand ?? 0, value.unit)} on hand` : value.unit}
            </p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="rounded-lg px-2 py-1 text-sm font-medium text-cyan-700 hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
            Change
          </button>
        </div>
      </div>
    );
  }

  const pick = (item: StockItem) => {
    onChange(item);
    setQuery('');
  };

  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="relative">
        <Icon icon="solar:magnifer-bold-duotone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const scanned = active.find(item => item.barcode && item.barcode === query.trim());
            if (scanned) pick(scanned);
            else if (found[0]) pick(found[0]);
          }}
          placeholder="Name, NAPPI code or scan the barcode"
          className={`${INPUT} pl-9`}
          aria-controls={`${id}-results`}
        />
      </div>
      <ul id={`${id}-results`} className="mt-2 max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200" aria-label="Matching items">
        {found.length === 0 ? (
          <li className="px-3 py-3 text-sm text-gray-500">No item matches. Add it on the Stock page first.</li>
        ) : (
          found.map(item => {
            const level = levels.get(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => pick(item)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-cyan-50 focus:bg-cyan-50 focus:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{item.name}</span>
                    <span className="block text-xs text-gray-500">{item.nappiCode ? `NAPPI ${item.nappiCode}` : item.group ?? item.unit}</span>
                  </span>
                  {showOnHand && (
                    <span className={`shrink-0 text-xs font-medium ${(level?.onHand ?? 0) > 0 ? 'text-gray-600' : 'text-red-600'}`}>
                      {units(level?.onHand ?? 0, item.unit)}
                    </span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
};

export default ItemPicker;
