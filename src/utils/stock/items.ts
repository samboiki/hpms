/**
 * Stock items (practice_inventory rows with the stock fields): reading them from the database, checking the item
 * form before it is saved (stock_save_item checks the same), and the code an item is billed under.
 */
import { toCents } from '../../services/ledger/money';
import { fromCents, hasAtMostDecimals } from '../billing/money';

export const STOCK_CATEGORIES = ['medications', 'disposables', 'equipment', 'office_supplies', 'other'] as const;
export type StockCategory = (typeof STOCK_CATEGORIES)[number];

export interface StockItem {
  id: string;
  practiceId: string;
  name: string;
  description: string | null;
  category: string;
  sku: string | null;
  unit: string;
  nappiCode: string | null;
  barcode: string | null;
  group: string | null;
  /** The code the item is billed under when it has no NAPPI code (the tariff link) */
  tariffCode: string | null;
  /** The item's own VAT rate; null = the practice default */
  vatRate: number | null;
  /** Fixed selling price per unit incl VAT; null = the practice's price rule */
  sellingPriceCents: number | null;
  /** Cost per unit excl VAT (the average cost once stock is tracked) */
  unitCostCents: number;
  minimum: number | null;
  maximum: number | null;
  packSize: number | null;
  preferredSupplierId: string | null;
  location: string | null;
  notes: string | null;
  isScheduled: boolean;
  scheduleLabel: string | null;
  defaultDirections: string | null;
  isActive: boolean;
  /** practice_inventory.quantity: the ledger's copy once stock is tracked, typed by hand before */
  quantity: number;
  /** The earliest expiry still on the shelf (the ledger's copy), or the date typed on the old screen */
  expiryDate: string | null;
}

export interface StockItemRow {
  id: string;
  practice_id: string;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  sku?: string | null;
  unit?: string | null;
  nappi_code?: string | null;
  barcode?: string | null;
  item_group?: string | null;
  tariff_code?: string | null;
  vat_rate?: number | string | null;
  selling_price?: number | string | null;
  unit_cost?: number | string | null;
  reorder_level?: number | null;
  max_level?: number | null;
  pack_size?: number | null;
  preferred_supplier_id?: string | null;
  location?: string | null;
  notes?: string | null;
  is_scheduled?: boolean | null;
  schedule_label?: string | null;
  default_directions?: string | null;
  is_active?: boolean | null;
  quantity?: number | null;
  expiry_date?: string | null;
}

const text = (value: string | null | undefined): string | null => (value && value.trim() ? value.trim() : null);
const positiveInt = (value: number | null | undefined): number | null => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null);

export function normalizeStockItem(row: StockItemRow): StockItem {
  return {
    id: row.id,
    practiceId: row.practice_id,
    name: text(row.name) ?? 'Unnamed item',
    description: text(row.description),
    category: text(row.category) ?? 'other',
    sku: text(row.sku),
    unit: text(row.unit) ?? 'each',
    nappiCode: text(row.nappi_code),
    barcode: text(row.barcode),
    group: text(row.item_group),
    tariffCode: text(row.tariff_code),
    vatRate: row.vat_rate === null || row.vat_rate === undefined || row.vat_rate === '' ? null : Number(row.vat_rate),
    sellingPriceCents: row.selling_price === null || row.selling_price === undefined || row.selling_price === '' ? null : toCents(row.selling_price),
    unitCostCents: toCents(row.unit_cost),
    minimum: positiveInt(row.reorder_level),
    maximum: positiveInt(row.max_level),
    packSize: positiveInt(row.pack_size),
    preferredSupplierId: row.preferred_supplier_id ?? null,
    location: text(row.location),
    notes: text(row.notes),
    isScheduled: row.is_scheduled === true,
    scheduleLabel: text(row.schedule_label),
    defaultDirections: text(row.default_directions),
    isActive: row.is_active !== false,
    quantity: typeof row.quantity === 'number' ? row.quantity : 0,
    expiryDate: row.expiry_date ? row.expiry_date.slice(0, 10) : null
  };
}

/** NAPPI codes as stored: letters and digits only, upper case ("700 123-001" -> "700123001"); null when empty */
export function normalizeNappi(value: string | null | undefined): string | null {
  const cleaned = (value ?? '').replace(/[\s-]/g, '').toUpperCase();
  return cleaned ? cleaned : null;
}

export const isValidNappi = (value: string): boolean => /^[0-9A-Z]{6,15}$/.test(value);

/**
 * The code on the invoice line and the claim: a medicine's NAPPI code, else the tariff code the item is billed under,
 * else its own product code. A medicine without a NAPPI code cannot be claimed from a fund, so the item form asks
 * for one.
 */
export function billingCodeFor(item: Pick<StockItem, 'nappiCode' | 'tariffCode' | 'sku'>): string {
  const own = (item.sku ?? '').toUpperCase().replace(/[^A-Z0-9./-]/g, '').slice(0, 20);
  return item.nappiCode ?? item.tariffCode ?? (own || 'STOCK');
}

/** The form as typed (text fields), before it is checked */
export interface ItemDraft {
  id?: string;
  name: string;
  category: string;
  unit: string;
  description: string;
  sku: string;
  group: string;
  nappiCode: string;
  barcode: string;
  tariffCode: string;
  /** '' = the practice default */
  vatRate: string;
  /** '' = the price rule */
  sellingPrice: string;
  /** Cost per unit excl VAT; only for an item without movements */
  unitCost: string;
  minimum: string;
  maximum: string;
  packSize: string;
  preferredSupplierId: string;
  location: string;
  notes: string;
  isScheduled: boolean;
  scheduleLabel: string;
  defaultDirections: string;
  /** New items only */
  openingQuantity: string;
  openingBatch: string;
  openingExpiry: string;
}

export type ItemDraftErrors = Partial<Record<keyof ItemDraft, string>>;

const wholeNumber = (value: string): number | null => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);
/** An amount typed in a form ("12.50", "N$ 1,200"), at most 2 decimals; null when it is not one */
export const parseAmountText = (value: string): number | null => {
  const trimmed = value.trim().replace(/^N\$\s*/i, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && hasAtMostDecimals(parsed, 2) ? parsed : null;
};

/**
 * Checks the item form and builds the stock_save_item payload. `costLocked`: the item has stock movements, so its
 * cost follows the deliveries and is not sent.
 */
export function validateItemDraft(
  draft: ItemDraft,
  options: { practiceId: string; costLocked: boolean }
): { ok: true; payload: Record<string, unknown> } | { ok: false; errors: ItemDraftErrors } {
  const errors: ItemDraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Give the item a name.';
  else if (name.length > 160) errors.name = 'Keep the name to 160 characters.';
  if (!(STOCK_CATEGORIES as readonly string[]).includes(draft.category)) errors.category = 'Choose a category.';
  if (draft.unit.trim().length > 30) errors.unit = 'Keep the unit short, e.g. tablet, ml, box.';

  const nappi = normalizeNappi(draft.nappiCode);
  if (nappi && !isValidNappi(nappi)) errors.nappiCode = 'A NAPPI code is 6 to 15 letters or digits.';
  const tariff = draft.tariffCode.trim().toUpperCase();
  if (tariff && !/^[A-Z0-9./-]{1,20}$/.test(tariff)) errors.tariffCode = 'Up to 20 letters, digits, dots, dashes or slashes.';
  const barcode = draft.barcode.trim();
  if (barcode && (barcode.length < 4 || barcode.length > 40)) errors.barcode = 'A barcode is 4 to 40 characters.';

  const vat = draft.vatRate.trim() === '' ? null : parseAmountText(draft.vatRate);
  if (draft.vatRate.trim() !== '' && (vat === null || vat > 100)) errors.vatRate = 'A VAT rate from 0 to 100%.';
  const price = draft.sellingPrice.trim() === '' ? null : parseAmountText(draft.sellingPrice);
  if (draft.sellingPrice.trim() !== '' && price === null) errors.sellingPrice = 'An amount in N$, e.g. 12.50.';
  const cost = draft.unitCost.trim() === '' ? 0 : parseAmountText(draft.unitCost);
  if (!options.costLocked && cost === null) errors.unitCost = 'An amount in N$, e.g. 2.45.';

  const minimum = draft.minimum.trim() === '' ? null : wholeNumber(draft.minimum);
  if (draft.minimum.trim() !== '' && minimum === null) errors.minimum = 'A whole number.';
  const maximum = draft.maximum.trim() === '' ? null : wholeNumber(draft.maximum);
  if (draft.maximum.trim() !== '' && maximum === null) errors.maximum = 'A whole number.';
  if (minimum !== null && maximum !== null && maximum < minimum) errors.maximum = 'The most to hold cannot be below the minimum.';
  const pack = draft.packSize.trim() === '' ? null : wholeNumber(draft.packSize);
  if (draft.packSize.trim() !== '' && (pack === null || pack < 1)) errors.packSize = 'Units in a pack, e.g. 30.';
  if (draft.defaultDirections.trim().length > 60) errors.defaultDirections = 'Keep the usual directions short, e.g. 1 tds.';

  const opening = draft.openingQuantity.trim() === '' ? 0 : wholeNumber(draft.openingQuantity);
  if (!draft.id && opening === null) errors.openingQuantity = 'A whole number of units.';
  if (!draft.id && draft.openingExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(draft.openingExpiry)) errors.openingExpiry = 'Choose a date.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const optional = (value: string): string | null => (value.trim() ? value.trim() : null);
  const payload: Record<string, unknown> = {
    id: draft.id ?? null,
    practice_id: options.practiceId,
    name,
    category: draft.category,
    unit: optional(draft.unit) ?? 'each',
    description: optional(draft.description),
    sku: optional(draft.sku),
    item_group: optional(draft.group),
    nappi_code: nappi,
    barcode: optional(barcode),
    tariff_code: tariff || null,
    vat_rate: vat,
    selling_price: price,
    reorder_level: minimum,
    max_level: maximum,
    pack_size: pack,
    preferred_supplier_id: optional(draft.preferredSupplierId),
    location: optional(draft.location),
    notes: optional(draft.notes),
    is_scheduled: draft.isScheduled,
    schedule_label: draft.isScheduled ? optional(draft.scheduleLabel) : null,
    default_directions: optional(draft.defaultDirections)
  };
  if (!options.costLocked) payload.unit_cost = cost;
  if (!draft.id) {
    payload.opening_quantity = opening ?? 0;
    payload.opening_batch = optional(draft.openingBatch);
    payload.opening_expiry = optional(draft.openingExpiry);
  }
  return { ok: true, payload };
}

const amountText = (cents: number | null): string => (cents === null ? '' : fromCents(cents).toFixed(2));

/** The form for an item (empty for a new one) */
export function draftFromItem(item: StockItem | null, defaults: { category?: string; unit?: string } = {}): ItemDraft {
  return {
    id: item?.id,
    name: item?.name ?? '',
    category: item?.category ?? defaults.category ?? 'medications',
    unit: item?.unit ?? defaults.unit ?? 'tablet',
    description: item?.description ?? '',
    sku: item?.sku ?? '',
    group: item?.group ?? '',
    nappiCode: item?.nappiCode ?? '',
    barcode: item?.barcode ?? '',
    tariffCode: item?.tariffCode ?? '',
    vatRate: item?.vatRate === null || item?.vatRate === undefined ? '' : String(item.vatRate),
    sellingPrice: amountText(item?.sellingPriceCents ?? null),
    unitCost: item ? amountText(item.unitCostCents) : '',
    minimum: item?.minimum ? String(item.minimum) : '',
    maximum: item?.maximum ? String(item.maximum) : '',
    packSize: item?.packSize ? String(item.packSize) : '',
    preferredSupplierId: item?.preferredSupplierId ?? '',
    location: item?.location ?? '',
    notes: item?.notes ?? '',
    isScheduled: item?.isScheduled ?? false,
    scheduleLabel: item?.scheduleLabel ?? '',
    defaultDirections: item?.defaultDirections ?? '',
    openingQuantity: '',
    openingBatch: '',
    openingExpiry: ''
  };
}
