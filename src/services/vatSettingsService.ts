/**
 * Reads and saves whether the practice is VAT registered and its VAT number (src/utils/billing/vat.ts). One
 * practice_settings row ('vat_settings'); its policies let every staff member read it and only administrators change
 * it. Nothing new in the database is needed. When it cannot be read the practice counts as not registered: no VAT.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database.types';
import { NOT_VAT_REGISTERED, STANDARD_VAT_RATE, VAT_SETTINGS_KEY, checkVatSettings, lineVatRate, parseVatSettings, vatSettingsJson, type VatSettings } from '../utils/billing/vat';

export async function loadVatSettings(practiceId: string | null | undefined): Promise<VatSettings> {
  if (!practiceId) return NOT_VAT_REGISTERED;
  try {
    const { data, error } = await supabase
      .from('practice_settings')
      .select('setting_value')
      .eq('practice_id', practiceId)
      .eq('setting_key', VAT_SETTINGS_KEY)
      .limit(1);
    if (error) {
      console.error('Could not read the VAT setting:', error);
      return NOT_VAT_REGISTERED;
    }
    return parseVatSettings(data?.[0]?.setting_value ?? null);
  } catch (error) {
    console.error('Could not read the VAT setting:', error);
    return NOT_VAT_REGISTERED;
  }
}

/** Saves it (practice administrators only: the database refuses anyone else, said here in plain words) */
export async function saveVatSettings(practiceId: string, settings: VatSettings): Promise<VatSettings> {
  const check = checkVatSettings(settings);
  if (!check.ok) throw new Error(check.error ?? 'Check the VAT number');
  const clean = parseVatSettings(vatSettingsJson(settings));
  const { data, error } = await supabase
    .from('practice_settings')
    .upsert(
      {
        practice_id: practiceId,
        setting_key: VAT_SETTINGS_KEY,
        setting_value: vatSettingsJson(clean) as unknown as Json,
        setting_type: 'json',
        description: 'VAT: whether the practice is VAT registered and its VAT number (VAT on VAT-able stock items only)',
        is_public: false
      },
      { onConflict: 'practice_id,setting_key' }
    )
    .select('id');
  if (error) {
    console.error('Could not save the VAT setting:', error);
    const refused = error.code === '42501' || /row-level security|permission denied/i.test(error.message ?? '');
    throw new Error(refused ? 'Only a practice administrator can change the VAT setting.' : 'The VAT setting was not saved. Please try again.');
  }
  if (!data || data.length === 0) throw new Error('Only a practice administrator can change the VAT setting.');
  return clean;
}

/**
 * The VAT rate of each stock item on a document (0 for an item that is not VAT-able, and for everything while the
 * practice is not VAT registered). A line without a stock item is a service: exempt. Never throws: when the items or
 * the stock settings cannot be read, their lines count as exempt and the document says no VAT for them.
 */
// Stock columns (vat_rate, stock_settings) are newer than the generated types
const db = supabase as unknown as SupabaseClient;

export async function loadItemVatRates(practiceId: string, itemIds: readonly string[]): Promise<{ settings: VatSettings; rates: Map<string, number> }> {
  const settings = await loadVatSettings(practiceId);
  const rates = new Map<string, number>();
  const ids = [...new Set(itemIds.filter(Boolean))];
  if (!settings.registered || ids.length === 0) return { settings, rates };
  try {
    const [items, stock] = await Promise.all([
      db.from('practice_inventory').select('id, vat_rate').eq('practice_id', practiceId).in('id', ids),
      db.from('stock_settings').select('default_vat_rate').eq('practice_id', practiceId).maybeSingle()
    ]);
    if (items.error) throw items.error;
    const stored = (stock.data as { default_vat_rate?: number | string | null } | null)?.default_vat_rate;
    const defaultRate = stored === null || stored === undefined || stock.error ? STANDARD_VAT_RATE : Number(stored);
    for (const row of (items.data ?? []) as Array<{ id: string; vat_rate: number | string | null }>) {
      const own = row.vat_rate === null || row.vat_rate === undefined || row.vat_rate === '' ? null : Number(row.vat_rate);
      rates.set(row.id, lineVatRate(settings, { vatRate: own !== null && Number.isFinite(own) ? own : null }, defaultRate));
    }
  } catch (error) {
    console.error('Could not read the VAT rates of the stock items:', error);
  }
  return { settings, rates };
}
