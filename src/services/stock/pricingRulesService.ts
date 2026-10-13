/**
 * Reads and writes for the medicine price tiers, the material rule and the fund reference prices (parity E7, D29;
 * proposals/2026-10-13-billing-extras.sql). The rules live in src/utils/stock/pricingRules.ts (tested). Before the file
 * is applied the reads say "not set up" and every item is priced by the price bands, as before.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { toCents } from '../../utils/billing/money';
import { NO_PRICING_RULES, pricingRulesFromRow, pricingRulesToJson, type PricingRules } from '../../utils/stock/pricingRules';

// The generated database types do not know these tables yet
const db = supabase as unknown as SupabaseClient;

interface DbError {
  code?: string;
  message?: string;
}

const isMissing = (error: DbError | null): boolean =>
  !!error && (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? '') || /could not find the|does not exist|schema cache/i.test(error.message ?? ''));

export interface PricingLoad {
  rules: PricingRules;
  /** False when a stored rule could not be used (the screen says so; items are priced as if it were not set) */
  readable: boolean;
  /** item id -> the fund's reference price per unit in cents */
  referencePrices: Map<string, number>;
  /** False before proposals/2026-10-13-billing-extras.sql: nothing can be saved yet */
  setUp: boolean;
}

/** The practice's rules and reference prices; never throws (the bands still price everything without them) */
export async function loadPricingRules(practiceId: string): Promise<PricingLoad> {
  const empty: PricingLoad = { rules: NO_PRICING_RULES, readable: true, referencePrices: new Map(), setUp: false };
  try {
    const [rules, prices] = await Promise.all([
      db.from('stock_pricing_rules').select('medicine_tiers, material_rule').eq('practice_id', practiceId).maybeSingle(),
      db.from('stock_reference_prices').select('item_id, reference_price').eq('practice_id', practiceId).limit(5000)
    ]);
    if (isMissing(rules.error) || isMissing(prices.error)) return empty;
    if (rules.error || prices.error) {
      console.warn('Stock: the price tiers and material rule could not be read; the price bands price every item', (rules.error ?? prices.error)?.message);
      return { ...empty, setUp: true, readable: false };
    }
    const read = pricingRulesFromRow((rules.data as { medicine_tiers?: unknown; material_rule?: unknown } | null) ?? null);
    const referencePrices = new Map(
      ((prices.data ?? []) as Array<{ item_id: string; reference_price: number | string }>).map(row => [row.item_id, toCents(Number(row.reference_price))] as const)
    );
    return { rules: read.rules, readable: read.readable, referencePrices, setUp: true };
  } catch (error) {
    console.warn('Stock: the price tiers and material rule could not be read', error);
    return empty;
  }
}

export async function savePricingRules(practiceId: string, rules: PricingRules): Promise<void> {
  const { error } = await db.rpc('stock_save_pricing_rules', { p_practice_id: practiceId, p_payload: pricingRulesToJson(rules) });
  if (error) {
    throw new Error(isMissing(error) ? 'The price tiers and the material rule are not set up in this database yet.' : error.message || 'The price rules could not be saved');
  }
}

/** A medicine's fund reference price per unit in N$ (VAT included); null clears it */
export async function saveReferencePrice(itemId: string, price: number | null): Promise<void> {
  const { error } = await db.rpc('stock_save_reference_price', { p_item_id: itemId, p_reference_price: price });
  if (error) {
    throw new Error(isMissing(error) ? 'Fund reference prices are not set up in this database yet.' : error.message || 'The reference price could not be saved');
  }
}
