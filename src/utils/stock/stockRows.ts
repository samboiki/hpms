/**
 * Rows of the stock tables (proposals/2026-10-07-dispensing-and-stock.sql) as the screens use them: amounts in
 * cents, dates as yyyy-MM-dd, empty text as null. Numeric columns arrive from the API as strings.
 */
import { toCents } from '../../services/ledger/money';
import { MOVEMENT_KINDS, type MovementKind } from './ledger';
import { priceRuleFromJson, DEFAULT_PRICE_RULE, type PriceRule } from './pricing';
import type { PricingRules } from './pricingRules';
import type { DispensingRecord } from './repeats';

type Num = number | string | null | undefined;

const text = (value: string | null | undefined): string | null => (value && value.trim() ? value.trim() : null);
const day = (value: string | null | undefined): string | null => (value ? value.slice(0, 10) : null);
const centsOrNull = (value: Num): number | null => (value === null || value === undefined || value === '' ? null : toCents(value));
const int = (value: Num): number => {
  const parsed = typeof value === 'number' ? value : parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

export interface StockSettings {
  dispensingEnabled: boolean;
  defaultVatRate: number;
  priceRule: PriceRule;
  /** False when the stored rule could not be read (the default is shown and the admin is asked to save it again) */
  priceRuleReadable: boolean;
  scriptValidMonths: number;
  labelNote: string | null;
  /**
   * The medicine price tiers and the material rule (pricingRules.ts, stock_pricing_rules); absent: every item is priced
   * by the bands, as before proposals/2026-10-13-billing-extras.sql
   */
  pricing?: PricingRules;
  /** False when a stored tier or material rule could not be read (items are priced as if it were not set) */
  pricingReadable?: boolean;
  /** False until proposals/2026-10-13-billing-extras.sql is applied: the tiers and the material rule cannot be saved */
  pricingSetUp?: boolean;
  /** Each medicine's fund reference price per unit in cents (item id -> cents) */
  referencePrices?: ReadonlyMap<string, number>;
  /**
   * Settings > Practice > VAT (src/utils/billing/vat.ts): only a VAT-registered practice adds VAT to what it sells.
   * Absent or false: selling prices carry no VAT. Deliveries keep the supplier's VAT either way.
   */
  vatRegistered?: boolean;
}

export const DEFAULT_STOCK_SETTINGS: StockSettings = {
  dispensingEnabled: false,
  defaultVatRate: 15,
  priceRule: DEFAULT_PRICE_RULE,
  priceRuleReadable: true,
  scriptValidMonths: 6,
  labelNote: null
};

export interface StockSettingsRow {
  dispensing_enabled?: boolean | null;
  default_vat_rate?: Num;
  price_rule?: unknown;
  script_valid_months?: number | null;
  label_note?: string | null;
}

/** A practice without a settings row has the defaults: dispensing off, VAT 15 %, prices at cost */
export function normalizeSettings(row: StockSettingsRow | null): StockSettings {
  if (!row) return DEFAULT_STOCK_SETTINGS;
  const rule = priceRuleFromJson(row.price_rule);
  return {
    dispensingEnabled: row.dispensing_enabled === true,
    defaultVatRate: row.default_vat_rate === null || row.default_vat_rate === undefined ? 15 : Number(row.default_vat_rate),
    priceRule: rule ?? DEFAULT_PRICE_RULE,
    priceRuleReadable: rule !== null,
    scriptValidMonths: typeof row.script_valid_months === 'number' ? row.script_valid_months : 6,
    labelNote: text(row.label_note)
  };
}

// ---------------------------------------------------------------------------------------------
// Movements
// ---------------------------------------------------------------------------------------------

export interface StockMovement {
  id: string;
  itemId: string;
  kind: MovementKind;
  quantity: number;
  valueCents: number;
  vatCents: number | null;
  batchNo: string | null;
  expiryDate: string | null;
  reasonCode: string | null;
  reason: string | null;
  occurredOn: string;
  documentRef: string | null;
  deliveryId: string | null;
  invoiceId: string | null;
  invoiceLineId: string | null;
  creditNoteId: string | null;
  patientId: string | null;
  practitionerId: string | null;
  dispensingId: string | null;
  countId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface StockMovementRow {
  id: string;
  item_id: string;
  kind: string;
  quantity: Num;
  value: Num;
  vat_amount?: Num;
  batch_no?: string | null;
  expiry_date?: string | null;
  reason_code?: string | null;
  reason?: string | null;
  occurred_on: string;
  document_ref?: string | null;
  delivery_id?: string | null;
  invoice_id?: string | null;
  invoice_line_id?: string | null;
  credit_note_id?: string | null;
  patient_id?: string | null;
  practitioner_id?: string | null;
  dispensing_id?: string | null;
  count_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

export const MOVEMENT_COLUMNS =
  'id, item_id, kind, quantity, value, vat_amount, batch_no, expiry_date, reason_code, reason, occurred_on, document_ref, delivery_id, ' +
  'invoice_id, invoice_line_id, credit_note_id, patient_id, practitioner_id, dispensing_id, count_id, created_by, created_at';

/** Null for a row of an unknown kind (a newer database), which the screens then leave out rather than mislabel */
export function normalizeMovement(row: StockMovementRow): StockMovement | null {
  if (!(MOVEMENT_KINDS as readonly string[]).includes(row.kind)) return null;
  return {
    id: row.id,
    itemId: row.item_id,
    kind: row.kind as MovementKind,
    quantity: int(row.quantity),
    valueCents: toCents(row.value),
    vatCents: centsOrNull(row.vat_amount),
    batchNo: text(row.batch_no),
    expiryDate: day(row.expiry_date),
    reasonCode: text(row.reason_code),
    reason: text(row.reason),
    occurredOn: day(row.occurred_on) ?? '',
    documentRef: text(row.document_ref),
    deliveryId: row.delivery_id ?? null,
    invoiceId: row.invoice_id ?? null,
    invoiceLineId: row.invoice_line_id ?? null,
    creditNoteId: row.credit_note_id ?? null,
    patientId: row.patient_id ?? null,
    practitionerId: row.practitioner_id ?? null,
    dispensingId: row.dispensing_id ?? null,
    countId: row.count_id ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at
  };
}

/** One item's on hand and value from the stock_item_levels view */
export interface ItemLevelRow {
  item_id: string;
  on_hand: Num;
  value: Num;
  last_movement_on?: string | null;
  last_received_on?: string | null;
}

export interface ItemLevel {
  onHand: number;
  valueCents: number;
  lastMovementOn: string | null;
  lastReceivedOn: string | null;
}

export const normalizeLevel = (row: ItemLevelRow): ItemLevel => ({
  onHand: int(row.on_hand),
  valueCents: toCents(row.value),
  lastMovementOn: day(row.last_movement_on),
  lastReceivedOn: day(row.last_received_on)
});

// ---------------------------------------------------------------------------------------------
// Suppliers, deliveries, orders
// ---------------------------------------------------------------------------------------------

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  accountNumber: string | null;
  vatNumber: string | null;
  paymentTermsDays: number;
  notes: string | null;
  isActive: boolean;
}

export interface SupplierRow {
  id: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  account_number?: string | null;
  vat_number?: string | null;
  payment_terms_days?: number | null;
  notes?: string | null;
  is_active?: boolean | null;
}

export const normalizeSupplier = (row: SupplierRow): Supplier => ({
  id: row.id,
  name: text(row.name) ?? 'Unnamed supplier',
  contactName: text(row.contact_name),
  phone: text(row.phone),
  email: text(row.email),
  accountNumber: text(row.account_number),
  vatNumber: text(row.vat_number),
  paymentTermsDays: typeof row.payment_terms_days === 'number' ? row.payment_terms_days : 30,
  notes: text(row.notes),
  isActive: row.is_active !== false
});

export interface Delivery {
  id: string;
  number: string;
  kind: 'received' | 'returned';
  supplierId: string;
  supplierReference: string;
  documentDate: string;
  exclVatCents: number;
  vatCents: number;
  inclVatCents: number;
  /** A supplier's invoice for consignment frames sold (Optometry): on account, with no stock received on it */
  consignment?: boolean;
  expenseId: string | null;
  orderId: string | null;
  reason: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface DeliveryRow {
  id: string;
  number: string;
  kind: string;
  supplier_id: string;
  supplier_reference: string;
  document_date: string;
  total_excl_vat: Num;
  vat_amount: Num;
  total_incl_vat: Num;
  consignment?: boolean | null;
  expense_id?: string | null;
  order_id?: string | null;
  reason?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  reversed_at?: string | null;
  reversal_reason?: string | null;
}

export const normalizeDelivery = (row: DeliveryRow): Delivery => ({
  id: row.id,
  number: row.number,
  kind: row.kind === 'returned' ? 'returned' : 'received',
  supplierId: row.supplier_id,
  supplierReference: row.supplier_reference,
  documentDate: day(row.document_date) ?? '',
  exclVatCents: toCents(row.total_excl_vat),
  vatCents: toCents(row.vat_amount),
  inclVatCents: toCents(row.total_incl_vat),
  consignment: row.consignment === true,
  expenseId: row.expense_id ?? null,
  orderId: row.order_id ?? null,
  reason: text(row.reason),
  notes: text(row.notes),
  createdBy: row.created_by ?? null,
  createdAt: row.created_at,
  reversedAt: row.reversed_at ?? null,
  reversalReason: text(row.reversal_reason)
});

export interface OrderLine {
  itemId: string;
  name: string;
  unit: string;
  nappiCode: string | null;
  quantity: number;
  unitCostCents: number;
}

export interface SupplierOrder {
  id: string;
  number: string;
  supplierId: string;
  orderedOn: string;
  lines: OrderLine[];
  notes: string | null;
  status: 'ordered' | 'received' | 'cancelled';
  receivedDeliveryId: string | null;
  cancelReason: string | null;
  createdAt: string;
}

export interface SupplierOrderRow {
  id: string;
  number: string;
  supplier_id: string;
  ordered_on: string;
  lines: unknown;
  notes?: string | null;
  status: string;
  received_delivery_id?: string | null;
  cancel_reason?: string | null;
  created_at: string;
}

export function normalizeOrder(row: SupplierOrderRow): SupplierOrder {
  const lines = Array.isArray(row.lines) ? row.lines : [];
  return {
    id: row.id,
    number: row.number,
    supplierId: row.supplier_id,
    orderedOn: day(row.ordered_on) ?? '',
    lines: lines.flatMap((line: Record<string, unknown>): OrderLine[] =>
      typeof line?.item_id === 'string'
        ? [{
            itemId: line.item_id,
            name: typeof line.name === 'string' ? line.name : 'Item',
            unit: typeof line.unit === 'string' ? line.unit : '',
            nappiCode: typeof line.nappi_code === 'string' ? line.nappi_code : null,
            quantity: int(line.quantity as Num),
            unitCostCents: toCents(line.unit_cost)
          }]
        : []),
    notes: text(row.notes),
    status: row.status === 'received' || row.status === 'cancelled' ? row.status : 'ordered',
    receivedDeliveryId: row.received_delivery_id ?? null,
    cancelReason: text(row.cancel_reason),
    createdAt: row.created_at
  };
}

// ---------------------------------------------------------------------------------------------
// Stock counts and valuations
// ---------------------------------------------------------------------------------------------

export interface StockCount {
  id: string;
  number: string;
  group: string | null;
  note: string | null;
  status: 'counting' | 'posted' | 'cancelled';
  startedAt: string;
  /** Who started it (users.id) */
  startedBy?: string | null;
  closedAt: string | null;
  /** Who posted or cancelled it (users.id) */
  closedBy?: string | null;
  cancelReason: string | null;
  valueChangeCents: number | null;
}

export interface StockCountRow {
  id: string;
  number: string;
  item_group?: string | null;
  note?: string | null;
  status: string;
  started_at: string;
  started_by?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  cancel_reason?: string | null;
  value_change?: Num;
}

export const COUNT_COLUMNS = 'id, number, item_group, note, status, started_at, started_by, closed_at, closed_by, cancel_reason, value_change';

export const normalizeCount = (row: StockCountRow): StockCount => ({
  id: row.id,
  number: row.number,
  group: text(row.item_group),
  note: text(row.note),
  status: row.status === 'posted' || row.status === 'cancelled' ? row.status : 'counting',
  startedAt: row.started_at,
  startedBy: row.started_by ?? null,
  closedAt: row.closed_at ?? null,
  closedBy: row.closed_by ?? null,
  cancelReason: text(row.cancel_reason),
  valueChangeCents: centsOrNull(row.value_change)
});

export interface CountLineRow {
  item_id: string;
  expected: Num;
  counted: Num;
  counted_by?: string | null;
  counted_at?: string | null;
}

export interface Valuation {
  id: string;
  asAt: string;
  kind: 'month_end' | 'manual';
  totalCents: number;
  itemCount: number;
  lines: Array<{ itemId: string; name: string; unit: string; onHand: number; valueCents: number }>;
  takenAt: string;
}

export interface ValuationRow {
  id: string;
  as_at: string;
  kind: string;
  total_value: Num;
  item_count: Num;
  lines: unknown;
  taken_at: string;
}

export const normalizeValuation = (row: ValuationRow): Valuation => ({
  id: row.id,
  asAt: day(row.as_at) ?? '',
  kind: row.kind === 'month_end' ? 'month_end' : 'manual',
  totalCents: toCents(row.total_value),
  itemCount: int(row.item_count),
  lines: (Array.isArray(row.lines) ? row.lines : []).flatMap((line: Record<string, unknown>) =>
    typeof line?.item_id === 'string'
      ? [{
          itemId: line.item_id,
          name: typeof line.name === 'string' ? line.name : 'Item',
          unit: typeof line.unit === 'string' ? line.unit : '',
          onHand: int(line.on_hand as Num),
          valueCents: toCents(line.value)
        }]
      : []),
  takenAt: row.taken_at
});

// ---------------------------------------------------------------------------------------------
// Dispensing
// ---------------------------------------------------------------------------------------------

export interface DispensingRow {
  id: string;
  number: string;
  patient_id: string;
  visit_id?: string | null;
  item_id: string;
  quantity: Num;
  directions: string;
  directions_code?: string | null;
  prescribed_as?: string | null;
  days_supply?: number | null;
  repeats_allowed?: number | null;
  repeat_of?: string | null;
  is_chronic?: boolean | null;
  valid_until?: string | null;
  prescriber_id?: string | null;
  billed?: boolean | null;
  unit_price?: Num;
  dispensed_on: string;
  created_at: string;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

export const DISPENSING_COLUMNS =
  'id, number, patient_id, visit_id, item_id, quantity, directions, directions_code, prescribed_as, days_supply, repeats_allowed, ' +
  'repeat_of, is_chronic, valid_until, prescriber_id, billed, unit_price, dispensed_on, created_at, cancelled_at, cancel_reason';

export const normalizeDispensing = (row: DispensingRow): DispensingRecord => ({
  id: row.id,
  number: row.number,
  patientId: row.patient_id,
  visitId: row.visit_id ?? null,
  itemId: row.item_id,
  quantity: int(row.quantity),
  directions: row.directions,
  directionsCode: text(row.directions_code),
  prescribedAs: text(row.prescribed_as),
  daysSupply: typeof row.days_supply === 'number' ? row.days_supply : null,
  repeatsAllowed: typeof row.repeats_allowed === 'number' ? row.repeats_allowed : 0,
  repeatOf: row.repeat_of ?? null,
  isChronic: row.is_chronic === true,
  validUntil: day(row.valid_until),
  prescriberId: row.prescriber_id ?? null,
  billed: row.billed !== false,
  unitPriceCents: centsOrNull(row.unit_price),
  dispensedOn: day(row.dispensed_on) ?? '',
  createdAt: row.created_at,
  cancelledAt: row.cancelled_at ?? null,
  cancelReason: text(row.cancel_reason)
});
