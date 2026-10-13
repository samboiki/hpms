/**
 * Frames are stock items (practice_inventory in the "Frames" group) with a brand, model, colour and size kept beside
 * them (optometry_frames). Deliveries, stock takes, valuation and the sale on an invoice are the stock module's, so
 * a frame needs nothing new there; its status comes from its stock movements and the open lab orders that use it.
 * Pure; tested in __tests__/frames.test.ts.
 */
import { parseAmountText, validateItemDraft, type ItemDraft, type ItemDraftErrors } from '../stock/items';
import type { StockMovement } from '../stock/stockRows';

export const FRAME_GROUP = 'Frames';

export interface FrameDetails {
  brand: string;
  model: string;
  colour: string | null;
  /** As printed on the temple, e.g. "52-18-140" (eye size, bridge, temple length) */
  size: string | null;
}

/** The stock item's name: "Ray-Ban RB5154 Black 51-21-145" (stock lists, invoice lines and reports show it). */
export const frameName = (details: FrameDetails): string =>
  [details.brand, details.model, details.colour, details.size].map(part => (part ?? '').trim()).filter(Boolean).join(' ').slice(0, 160);

export interface FrameDraft {
  id?: string;
  brand: string;
  model: string;
  colour: string;
  size: string;
  barcode: string;
  /** The code the frame is billed under, chosen from the practice's tariff list */
  tariffCode: string;
  /** Cost per frame excl VAT; only while the frame has no stock movements */
  costPrice: string;
  /** Fixed selling price incl VAT; empty = the practice's price rule */
  sellingPrice: string;
  /** New frames only: how many are on the shelf now */
  openingQuantity: string;
  supplierId: string;
  location: string;
  notes: string;
  /** The supplier owns these frames until they are sold (consignment): no stock value, owed once sold */
  consignment: boolean;
  /** What the practice pays the supplier per frame sold (excl VAT) */
  consignmentCost: string;
}

export type FrameDraftErrors = Partial<Record<keyof FrameDraft, string>>;

/** What optometry_save_frame takes besides the frame's details (proposals/2026-10-13-optometry-frames-and-exam.sql) */
export interface FrameConsignmentPayload {
  consignment: boolean;
  consignment_cost: number | null;
}

export const emptyFrameDraft = (): FrameDraft => ({
  brand: '',
  model: '',
  colour: '',
  size: '',
  barcode: '',
  tariffCode: '',
  costPrice: '',
  sellingPrice: '',
  openingQuantity: '1',
  supplierId: '',
  location: '',
  notes: '',
  consignment: false,
  consignmentCost: ''
});

const ITEM_ERROR_FIELDS: Partial<Record<keyof ItemDraft, keyof FrameDraft>> = {
  name: 'brand',
  barcode: 'barcode',
  tariffCode: 'tariffCode',
  sellingPrice: 'sellingPrice',
  unitCost: 'costPrice',
  openingQuantity: 'openingQuantity',
  location: 'location',
  notes: 'notes'
};

/**
 * Checks the frame form. The stock item is checked by the stock module's own rules (validateItemDraft, the same as
 * stock_save_item), so a frame is a stock item like any other: category "other", sold per frame, in the Frames group.
 * A consignment frame belongs to its supplier (who must be named) and carries no stock value: its cost is what the
 * practice owes the supplier once it is sold.
 */
export function validateFrameDraft(
  draft: FrameDraft,
  options: { practiceId: string; costLocked: boolean }
): { ok: true; item: Record<string, unknown>; frame: FrameDetails; consignment: FrameConsignmentPayload } | { ok: false; errors: FrameDraftErrors } {
  const errors: FrameDraftErrors = {};
  let consignmentCost: number | null = null;
  if (draft.consignment) {
    if (!draft.supplierId) errors.supplierId = 'A consignment frame belongs to its supplier: choose the supplier.';
    consignmentCost = parseAmountText(draft.consignmentCost);
    if (consignmentCost === null) errors.consignmentCost = 'What you pay the supplier per frame sold, e.g. 450.00.';
  }
  const brand = draft.brand.trim();
  const model = draft.model.trim();
  if (!brand) errors.brand = 'Type the brand.';
  else if (brand.length > 60) errors.brand = 'Keep the brand to 60 characters.';
  if (!model) errors.model = 'Type the model.';
  else if (model.length > 60) errors.model = 'Keep the model to 60 characters.';
  if (draft.colour.trim().length > 30) errors.colour = 'Keep the colour to 30 characters.';
  if (draft.size.trim().length > 20) errors.size = 'Keep the size short, e.g. 52-18-140.';

  const details: FrameDetails = { brand, model, colour: draft.colour.trim() || null, size: draft.size.trim() || null };
  const itemDraft: ItemDraft = {
    id: draft.id,
    name: frameName(details),
    category: 'other',
    unit: 'each',
    description: '',
    sku: '',
    group: FRAME_GROUP,
    nappiCode: '',
    barcode: draft.barcode,
    tariffCode: draft.tariffCode,
    vatRate: '',
    sellingPrice: draft.sellingPrice,
    // The supplier's frames carry no stock value (the database sets the same)
    unitCost: draft.consignment ? '0' : draft.costPrice,
    minimum: '',
    maximum: '',
    packSize: '',
    preferredSupplierId: draft.supplierId,
    location: draft.location,
    notes: draft.notes,
    isScheduled: false,
    scheduleLabel: '',
    defaultDirections: '',
    openingQuantity: draft.openingQuantity,
    openingBatch: '',
    openingExpiry: ''
  };
  const item = validateItemDraft(itemDraft, { practiceId: options.practiceId, costLocked: options.costLocked });
  if (!item.ok) {
    for (const [field, message] of Object.entries(item.errors as ItemDraftErrors)) {
      const target = ITEM_ERROR_FIELDS[field as keyof ItemDraft];
      if (target && message && !errors[target]) errors[target] = message;
    }
  }
  if (Object.keys(errors).length > 0 || !item.ok) return { ok: false, errors };
  return { ok: true, item: item.payload, frame: details, consignment: { consignment: draft.consignment, consignment_cost: draft.consignment ? consignmentCost : null } };
}

// ---------------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------------

export type FrameStatus = 'in_stock' | 'on_order' | 'sold' | 'none';
export const FRAME_STATUS_LABELS: Readonly<Record<FrameStatus, string>> = {
  in_stock: 'In stock',
  on_order: 'On order for a patient',
  sold: 'Sold',
  none: 'None in stock'
};

/** Frames billed on invoices, net of lines taken off again (stock movements "sold" and "back from an invoice"). */
export function soldUnits(movements: readonly Pick<StockMovement, 'kind' | 'quantity'>[]): number {
  const net = movements.reduce((sum, movement) => (movement.kind === 'sold' || movement.kind === 'sale_reversed' ? sum + movement.quantity : sum), 0);
  return Math.max(0, -net);
}

export interface FrameCounts {
  /** On hand in the stock ledger */
  onHand: number;
  /** Open lab orders (not collected or cancelled) that use this frame */
  onOrder: number;
  sold: number;
}

/**
 * A frame's status: in stock while more are on hand than are promised to open orders, on order while a patient's
 * order uses it, sold once billed and nothing else is waiting, else none in stock. A frame on a patient's order
 * stays on hand until its invoice is saved, so it is not counted as free stock.
 */
export function frameStatus(counts: FrameCounts): FrameStatus {
  if (counts.onHand > counts.onOrder) return 'in_stock';
  if (counts.onOrder > 0) return 'on_order';
  return counts.sold > 0 ? 'sold' : 'none';
}
