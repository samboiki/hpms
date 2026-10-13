import { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { loadStockItems, loadStockSettings, type StockItemsLoad } from '../../services/stock/stockService';
import type { StockItem } from '../../utils/stock/items';
import type { ItemLevel, StockSettings } from '../../utils/stock/stockRows';
import { stockBillingLine } from '../../utils/stock/stockLine';
import { priceOf } from '../stock/stockContext';
import type { StockLineOutcome } from './bundles';

/**
 * Prices a bundle's stock line the way "From stock" does (StockLineMenu): the item's own price or the practice's
 * price rule on its average cost, as a line whose tariff id is the item, so the units come off stock when the visit
 * is saved. An item that is gone or switched off, or has no price, is reported and never guessed.
 */
export function bundleStockLine(
  stock: { items: readonly StockItem[]; levels: ReadonlyMap<string, ItemLevel>; settings: StockSettings },
  hasMedicalAid: boolean
): (itemId: string, quantity: number) => StockLineOutcome {
  return (itemId, quantity) => {
    const item = stock.items.find(entry => entry.id === itemId);
    if (!item) return { ok: false, message: 'A stock item of this bundle is no longer in the stock list, so it was not added. Edit the bundle.' };
    if (!item.isActive) return { ok: false, message: `${item.name} is switched off in Stock, so it was not added.` };
    // Priced for the patient as "From stock" prices it: their medicine tier and the fund's reference price
    const price = priceOf(item, quantity, stock.settings, stock.levels, { hasMedicalAid });
    if (!price) return { ok: false, message: `${item.name} has no price: give it a cost or a selling price in Stock, so the bundle can add it.` };
    return { ok: true, service: stockBillingLine({ item, quantity, price, hasMedicalAid, lineId: crypto.randomUUID() }) };
  };
}

export type BundleStock =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unavailable'; message: string }
  | { status: 'ready'; items: StockItem[]; stockLine: (itemId: string, quantity: number) => StockLineOutcome };

/** The practice's stock for bundles, loaded only when `active` (a bundle has stock lines, or the editor is open). */
export function useBundleStock(practiceId: string | null, active: boolean, hasMedicalAid: boolean): BundleStock {
  const [loaded, setLoaded] = useState<{ stock: StockItemsLoad; settings: StockSettings } | { error: string } | null>(null);

  useEffect(() => {
    if (!active || !practiceId || loaded) return;
    let cancelled = false;
    Promise.all([loadStockItems(practiceId), loadStockSettings(practiceId)])
      .then(([stock, settings]) => {
        if (!cancelled) setLoaded({ stock, settings });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded({ error: error instanceof Error ? plainWords(error.message) : 'The stock list could not be read.' });
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, active, loaded]);

  return useMemo((): BundleStock => {
    if (!active) return { status: 'idle' };
    if (!loaded) return { status: 'loading' };
    if ('error' in loaded) return { status: 'unavailable', message: loaded.error };
    const { stock, settings } = loaded;
    return { status: 'ready', items: stock.items, stockLine: bundleStockLine({ items: stock.items, levels: stock.levels, settings }, hasMedicalAid) };
  }, [active, loaded, hasMedicalAid]);
}
