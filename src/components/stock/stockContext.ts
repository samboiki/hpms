import { useCallback, useEffect, useState } from 'react';
import { isStockNotSetUpError, loadStaffNames, loadStockItems, loadSuppliers } from '../../services/stock/stockService';
import type { StockItem } from '../../utils/stock/items';
import { issueValueCents, type StockLevel } from '../../utils/stock/ledger';
import { NO_PRICING_RULES, itemKindOf, priceItemLine, type PricedItemLine, type PricingContext } from '../../utils/stock/pricingRules';
import type { ItemLevel, StockSettings, Supplier } from '../../utils/stock/stockRows';
import type { StockStore, StoreLevel } from '../../utils/stock/stores';
import { errorText } from './stockUi';

/** What every part of the Stock page shares */
export interface StockContext {
  practiceId: string;
  /** Printed on reports */
  practiceName: string;
  role: string | null;
  settings: StockSettings;
  items: StockItem[];
  levels: Map<string, ItemLevel>;
  suppliers: Supplier[];
  staffNames: Map<string, string>;
  /** The practice's other stores and "On the way" (empty for a practice with one place: utils/stock/stores.ts) */
  stores: StockStore[];
  /** On hand per store: store key ('' = the main store) -> item id -> level */
  storeLevels: Map<string, Map<string, StoreLevel>>;
  /** The signed-in staff member's branch, for their default store */
  userBranchId: string | null;
  /** Load items, levels, suppliers and stores again (after a change) */
  reload: () => void;
  reloadSettings: () => void;
}

/** The ledger figures of an item for the value rules (src/utils/stock/ledger.ts) */
export const stockLevelOf = (item: Pick<StockItem, 'id' | 'unitCostCents'>, levels: ReadonlyMap<string, ItemLevel>): StockLevel => {
  const level = levels.get(item.id);
  return { onHand: level?.onHand ?? 0, valueCents: level?.valueCents ?? 0, unitCostCents: item.unitCostCents };
};

export const vatRateOf = (item: Pick<StockItem, 'vatRate'>, settings: StockSettings): number => item.vatRate ?? settings.defaultVatRate;

/** The VAT the practice adds when it sells the item: none unless it is VAT registered (Settings > Practice) and the item is VAT-able */
export const sellingVatRateOf = (item: Pick<StockItem, 'vatRate'>, settings: StockSettings): number =>
  settings.vatRegistered ? Math.max(vatRateOf(item, settings), 0) : 0;

/**
 * The selling price of `quantity` units of an item: its fixed price, or the practice's rules on the average cost (the
 * price bands; a medicine's tier for the patient and its fund reference price, a material's handling fee, once the
 * practice set them: pricingRules.ts). `patient`: who the line is billed to (none on the Stock screens).
 */
export function priceOf(item: StockItem, quantity: number, settings: StockSettings, levels: ReadonlyMap<string, ItemLevel>, patient?: PricingContext): PricedItemLine | null {
  const level = stockLevelOf(item, levels);
  const cost = issueValueCents(level, quantity);
  return priceItemLine({
    kind: itemKindOf(item.category),
    quantity,
    lineCostCents: cost > 0 ? cost : null,
    vatRate: sellingVatRateOf(item, settings),
    bands: settings.priceRule,
    rules: settings.pricing ?? NO_PRICING_RULES,
    fixedUnitPriceCents: item.sellingPriceCents,
    referenceUnitCents: settings.referencePrices?.get(item.id) ?? null,
    context: patient
  });
}

export type LoadState<T> = { status: 'loading' } | { status: 'not_set_up' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

export interface StockData {
  items: StockItem[];
  levels: Map<string, ItemLevel>;
  suppliers: Supplier[];
  staffNames: Map<string, string>;
}

/** Items, their levels, suppliers and staff names for a practice; 'not_set_up' before the database update */
export function useStockData(practiceId: string | null | undefined): LoadState<StockData> & { reload: () => void } {
  const [state, setState] = useState<LoadState<StockData>>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!practiceId) return;
    let active = true;
    Promise.all([loadStockItems(practiceId), loadSuppliers(practiceId), loadStaffNames(practiceId)])
      .then(([{ items, levels }, suppliers, staffNames]) => {
        if (active) setState({ status: 'ready', data: { items, levels, suppliers, staffNames } });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState(isStockNotSetUpError(error) ? { status: 'not_set_up' } : { status: 'error', message: errorText(error, 'Could not load the stock') });
      });
    return () => {
      active = false;
    };
  }, [practiceId, version]);

  const reload = useCallback(() => setVersion(value => value + 1), []);
  return { ...state, reload };
}
