/**
 * The stock ledger as the screens need it: what each kind of movement means in plain words, the value of taking
 * units off (or putting them back) at the average cost, running balances, and which batches are probably still on
 * the shelf. The same value rules are in the database (stock_issue_value / stock_gain_value in
 * proposals/2026-10-07-dispensing-and-stock.sql); the screens use these to show what a change will do before it is
 * saved. Money in whole cents.
 */
import { daysBetweenKeys } from '../billing/dates';

export type MovementKind =
  | 'opening'
  | 'received'
  | 'returned'
  | 'delivery_reversed'
  | 'sold'
  | 'sale_reversed'
  | 'dispensed'
  | 'dispense_reversed'
  | 'adjusted'
  | 'counted'
  | 'transfer_out'
  | 'transfer_in';

export const MOVEMENT_KINDS: readonly MovementKind[] = [
  'opening', 'received', 'returned', 'delivery_reversed', 'sold', 'sale_reversed', 'dispensed', 'dispense_reversed', 'adjusted', 'counted',
  'transfer_out', 'transfer_in'
];

/**
 * Stock moved between the practice's own stores (proposals/2026-10-13-stock-stores-and-suppliers.sql): it nets to
 * nothing for the practice as a whole, so practice-wide reports such as the scheduled-medicine register can leave it out.
 */
export const isTransferMovement = (kind: MovementKind): boolean => kind === 'transfer_out' || kind === 'transfer_in';

/** What each movement was, as staff say it */
export const MOVEMENT_LABELS: Readonly<Record<MovementKind, string>> = {
  opening: 'Opening balance',
  received: 'Delivery received',
  returned: 'Returned to supplier',
  delivery_reversed: 'Delivery reversed',
  sold: 'Billed on an invoice',
  sale_reversed: 'Back from an invoice',
  dispensed: 'Dispensed (not billed)',
  dispense_reversed: 'Dispensing cancelled',
  adjusted: 'Adjustment',
  counted: 'Stock count',
  transfer_out: 'Moved out (transfer)',
  transfer_in: 'Moved in (transfer)'
};

export type AdjustmentReason = 'damaged' | 'expired' | 'lost' | 'used_in_practice' | 'sample' | 'found' | 'correction' | 'other';

/** Reasons for an adjustment, with the way stock usually moves for each (the screen suggests the sign) */
export const ADJUSTMENT_REASONS: ReadonlyArray<{ code: AdjustmentReason; label: string; direction: 'out' | 'in' | 'either' }> = [
  { code: 'damaged', label: 'Broken or damaged', direction: 'out' },
  { code: 'expired', label: 'Expired', direction: 'out' },
  { code: 'lost', label: 'Lost or missing', direction: 'out' },
  { code: 'used_in_practice', label: 'Used in the practice', direction: 'out' },
  { code: 'sample', label: 'Free sample given or received', direction: 'either' },
  { code: 'found', label: 'Found', direction: 'in' },
  { code: 'correction', label: 'Correction', direction: 'either' },
  { code: 'other', label: 'Other', direction: 'either' }
];

export const adjustmentReasonLabel = (code: string | null | undefined): string =>
  ADJUSTMENT_REASONS.find(reason => reason.code === code)?.label ?? 'Adjustment';

/** On hand and value of one item, from the ledger */
export interface StockLevel {
  onHand: number;
  /** Value at cost, excl VAT */
  valueCents: number;
  /** The item's recorded cost per unit (practice_inventory.unit_cost), used when nothing is on hand */
  unitCostCents: number;
}

/** Average cost per unit in cents (may have fractions of a cent), or null when nothing is on hand */
export function averageCostCents(level: StockLevel): number | null {
  if (level.onHand > 0 && level.valueCents > 0) return level.valueCents / level.onHand;
  return level.unitCostCents > 0 ? level.unitCostCents : null;
}

/**
 * The value (cents, positive) of taking `quantity` units off: the average cost of what is on hand, all of the value
 * when the last units go (so exactly zero is left), the recorded cost for units beyond what is on hand.
 */
export function issueValueCents(level: StockLevel, quantity: number): number {
  if (quantity <= 0) return 0;
  if (level.onHand > 0 && level.valueCents >= 0) {
    if (quantity >= level.onHand) return level.valueCents + (quantity - level.onHand) * level.unitCostCents;
    return Math.round((level.valueCents * quantity) / level.onHand);
  }
  return quantity * level.unitCostCents;
}

/** The value (cents, positive) of putting `quantity` units on: the average cost on hand, else the recorded cost */
export function gainValueCents(level: StockLevel, quantity: number): number {
  if (quantity <= 0) return 0;
  if (level.onHand > 0 && level.valueCents > 0) return Math.round((level.valueCents * quantity) / level.onHand);
  return quantity * level.unitCostCents;
}

export interface LedgerEntry {
  id: string;
  kind: MovementKind;
  quantity: number;
  valueCents: number;
  occurredOn: string;
  createdAt: string;
}

/** Entries in the order they happened (day, then when they were recorded) with the balance after each */
export function withRunningBalance<T extends LedgerEntry>(entries: readonly T[], opening = 0): Array<T & { balance: number }> {
  let balance = opening;
  return [...entries]
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map(entry => {
      balance += entry.quantity;
      return { ...entry, balance };
    });
}

export interface BatchIn {
  batchNo: string | null;
  expiryDate: string | null;
  /** Units of this batch received (less returned or reversed) */
  quantity: number;
}

/**
 * The batches probably still on the shelf: assuming the earliest expiry is used first, what is on hand is the latest
 * expiring stock. Each batch shows how many of its units are probably left. Batches without an expiry date count as
 * the latest. An estimate (issues do not record a batch), which is what decides the item's "expires soon".
 */
export function batchesOnHand(batches: readonly BatchIn[], onHand: number): Array<BatchIn & { left: number }> {
  if (onHand <= 0) return [];
  const merged = new Map<string, BatchIn>();
  for (const batch of batches) {
    const key = `${batch.expiryDate ?? ''}|${batch.batchNo ?? ''}`;
    const current = merged.get(key);
    merged.set(key, current ? { ...current, quantity: current.quantity + batch.quantity } : { ...batch });
  }
  const latestFirst = [...merged.values()]
    .filter(batch => batch.quantity > 0)
    .sort((a, b) => (b.expiryDate ?? '9999-12-31').localeCompare(a.expiryDate ?? '9999-12-31'));
  const out: Array<BatchIn & { left: number }> = [];
  let remaining = onHand;
  for (const batch of latestFirst) {
    if (remaining <= 0) break;
    const left = Math.min(batch.quantity, remaining);
    out.push({ ...batch, left });
    remaining -= left;
  }
  return out.sort((a, b) => (a.expiryDate ?? '9999-12-31').localeCompare(b.expiryDate ?? '9999-12-31'));
}

export type ExpiryState = 'expired' | 'soon' | 'ok';

/** Expired from the day after its date; "soon" within `withinDays` (default 90, a quarter's notice to use or return it) */
export function expiryState(expiryDate: string | null, todayKey: string, withinDays = 90): ExpiryState | null {
  if (!expiryDate) return null;
  if (expiryDate < todayKey) return 'expired';
  return daysBetweenKeys(todayKey, expiryDate) <= withinDays ? 'soon' : 'ok';
}
