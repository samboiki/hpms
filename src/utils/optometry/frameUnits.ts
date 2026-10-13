/**
 * One barcode per physical frame (optometry_frame_units in proposals/2026-10-13-optometry-frames-and-exam.sql). A
 * frame item (practice_inventory, Frames group) is the model in a colour and size; each frame on the wall is a unit
 * with its own barcode and status: in stock, reserved (for a patient's spectacles or put aside), sold, back to the
 * supplier, or lost or damaged. The database keeps the units in step with the stock ledger (every delivery, sale,
 * return and count moves them) and records who changed each one and when. Pure; tested in __tests__/frameUnits.test.ts.
 */
import { toDateKey } from '../billing/dates';
import { parseAmountText } from '../stock/items';

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const day = (value: unknown): string | null => (typeof value === 'string' ? toDateKey(value) : null);
const one = (value: unknown): Row | null => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === 'object' ? (row as Row) : null;
};
const nameOf = (value: unknown): string | null => text(one(value)?.full_name);

export type FrameUnitStatus = 'in_stock' | 'reserved' | 'sold' | 'returned' | 'written_off';
export const FRAME_UNIT_STATUSES: readonly FrameUnitStatus[] = ['in_stock', 'reserved', 'sold', 'returned', 'written_off'];
export const FRAME_UNIT_STATUS_LABELS: Readonly<Record<FrameUnitStatus, string>> = {
  in_stock: 'In stock',
  reserved: 'Reserved',
  sold: 'Sold',
  returned: 'Back to the supplier',
  written_off: 'Lost or damaged'
};
/** Still in the practice: on the wall or put aside */
export const isOnHandStatus = (status: FrameUnitStatus): boolean => status === 'in_stock' || status === 'reserved';

export interface FrameUnit {
  id: string;
  itemId: string;
  barcode: string;
  status: FrameUnitStatus;
  /** Reserved for, or sold to */
  patientId: string | null;
  /** The patient's spectacles order it is for */
  labOrderId: string | null;
  invoiceId: string | null;
  invoiceLineId: string | null;
  soldOn: string | null;
  soldById: string | null;
  soldBy: string | null;
  receivedDeliveryId: string | null;
  returnedDeliveryId: string | null;
  note: string | null;
  /** The day it got its current status */
  statusOn: string;
  statusChangedBy: string | null;
  statusChangedAt: string;
  createdAt: string;
}

export const FRAME_UNIT_COLUMNS =
  'id, item_id, barcode, status, patient_id, lab_order_id, invoice_id, invoice_line_id, sold_on, sold_by, received_delivery_id, ' +
  'returned_delivery_id, note, status_on, status_changed_at, created_at, ' +
  'changer:users!optometry_frame_units_status_changed_by_fkey(full_name), seller:users!optometry_frame_units_sold_by_fkey(full_name)';

export function toFrameUnit(row: Row): FrameUnit {
  return {
    id: String(row.id),
    itemId: String(row.item_id ?? ''),
    barcode: text(row.barcode) ?? '',
    status: FRAME_UNIT_STATUSES.includes(row.status as FrameUnitStatus) ? (row.status as FrameUnitStatus) : 'in_stock',
    patientId: text(row.patient_id),
    labOrderId: text(row.lab_order_id),
    invoiceId: text(row.invoice_id),
    invoiceLineId: text(row.invoice_line_id),
    soldOn: day(row.sold_on),
    soldById: text(row.sold_by),
    soldBy: nameOf(row.seller),
    receivedDeliveryId: text(row.received_delivery_id),
    returnedDeliveryId: text(row.returned_delivery_id),
    note: text(row.note),
    statusOn: day(row.status_on) ?? '',
    statusChangedBy: nameOf(row.changer),
    statusChangedAt: String(row.status_changed_at ?? ''),
    createdAt: String(row.created_at ?? '')
  };
}

// ---------------------------------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------------------------------

export interface FrameUnitEvent {
  unitId: string;
  status: FrameUnitStatus;
  fromStatus: FrameUnitStatus | null;
  reason: string | null;
  patientId: string | null;
  labOrderId: string | null;
  invoiceId: string | null;
  deliveryId: string | null;
  on: string;
  changedAt: string;
  changedBy: string | null;
}

export const FRAME_EVENT_COLUMNS =
  'unit_id, status, from_status, reason, patient_id, lab_order_id, invoice_id, delivery_id, happened_on, changed_at, ' +
  'changer:users!optometry_frame_unit_events_changed_by_fkey(full_name)';

const statusOf = (value: unknown): FrameUnitStatus | null => (FRAME_UNIT_STATUSES.includes(value as FrameUnitStatus) ? (value as FrameUnitStatus) : null);

export function toFrameUnitEvent(row: Row): FrameUnitEvent {
  return {
    unitId: String(row.unit_id ?? ''),
    status: statusOf(row.status) ?? 'in_stock',
    fromStatus: statusOf(row.from_status),
    reason: text(row.reason),
    patientId: text(row.patient_id),
    labOrderId: text(row.lab_order_id),
    invoiceId: text(row.invoice_id),
    deliveryId: text(row.delivery_id),
    on: day(row.happened_on) ?? '',
    changedAt: String(row.changed_at ?? ''),
    changedBy: nameOf(row.changer)
  };
}

/**
 * A frame's story, oldest first, without the noise of a bill saved again: saving a visit rewrites its invoice lines,
 * so the frame is taken off the invoice and sold on it again a moment later. Such a pair (back from invoice X, then
 * sold on invoice X the same day) is shown as nothing; the first sale stays.
 */
export function unitStory(events: readonly FrameUnitEvent[]): FrameUnitEvent[] {
  const sorted = [...events].sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  const story: FrameUnitEvent[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    const next = sorted[index + 1];
    const resaved =
      event.fromStatus === 'sold' && isOnHandStatus(event.status) && event.invoiceId !== null && next !== undefined &&
      next.status === 'sold' && next.invoiceId === event.invoiceId && next.on === event.on;
    if (resaved) {
      index += 1;
      continue;
    }
    story.push(event);
  }
  return story;
}

// ---------------------------------------------------------------------------------------------------
// Counts, and barcodes against the stock ledger
// ---------------------------------------------------------------------------------------------------

export type UnitCounts = Record<FrameUnitStatus, number>;

export function unitCounts(units: readonly Pick<FrameUnit, 'status'>[]): UnitCounts {
  const counts: UnitCounts = { in_stock: 0, reserved: 0, sold: 0, returned: 0, written_off: 0 };
  for (const unit of units) counts[unit.status] += 1;
  return counts;
}

export interface BarcodeCheck {
  /** Frames on the shelf (the stock ledger) without a barcode yet */
  withoutBarcode: number;
  /** Barcodes in stock beyond what the ledger has on the shelf: some have left (find them, or mark them lost) */
  extraBarcodes: number;
}

/** The ledger is the truth for how many are on the shelf; the barcodes in stock or reserved should be as many. */
export function barcodeCheck(onHand: number, units: readonly Pick<FrameUnit, 'status'>[]): BarcodeCheck {
  const counted = units.filter(unit => isOnHandStatus(unit.status)).length;
  const shelf = Math.max(onHand, 0);
  return { withoutBarcode: Math.max(shelf - counted, 0), extraBarcodes: Math.max(counted - shelf, 0) };
}

// ---------------------------------------------------------------------------------------------------
// What can be done with a frame
// ---------------------------------------------------------------------------------------------------

export type UnitAction = 'hold' | 'release' | 'lost' | 'found' | 'return' | 'seller';

export const UNIT_ACTION_LABELS: Readonly<Record<UnitAction, string>> = {
  hold: 'Put aside',
  release: 'Back on the shelf',
  lost: 'Lost or damaged',
  found: 'Found it',
  return: 'Back to the supplier',
  seller: 'Change who sold it'
};

const ACTIONS_BY_STATUS: Readonly<Record<FrameUnitStatus, readonly UnitAction[]>> = {
  in_stock: ['hold', 'return', 'lost'],
  reserved: ['release', 'return', 'lost'],
  sold: ['seller'],
  // A return is undone by reversing its document on the Stock page (the ledger and the supplier's credit with it)
  returned: [],
  written_off: ['found']
};

/** Writing a frame off or finding it changes the stock count (stock_adjust): practice admins and practitioners, as for any adjustment */
const ADJUSTERS = ['admin', 'doctor'];

export function unitActions(status: FrameUnitStatus, role: string | null | undefined): UnitAction[] {
  return ACTIONS_BY_STATUS[status].filter(action => (action === 'lost' || action === 'found' || action === 'seller' ? ADJUSTERS.includes(role ?? '') : Boolean(role)));
}

// ---------------------------------------------------------------------------------------------------
// Barcodes as scanned or typed
// ---------------------------------------------------------------------------------------------------

/** Letters, digits and dashes, 4 to 40 (the database checks the same; a scanner types them followed by Enter) */
export const BARCODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{3,39}$/;
export const sameBarcode = (a: string, b: string): boolean => a.trim().toUpperCase() === b.trim().toUpperCase();

/** Barcodes scanned one after the other (each scan ends a line) or typed with spaces or commas between them */
export function parseBarcodeList(input: string): { barcodes: string[]; invalid: string[]; repeated: string[] } {
  const parts = input.split(/[\s,;]+/).map(part => part.trim()).filter(Boolean);
  const barcodes: string[] = [];
  const invalid: string[] = [];
  const repeated: string[] = [];
  for (const part of parts) {
    if (!BARCODE_PATTERN.test(part)) invalid.push(part);
    else if (barcodes.some(code => sameBarcode(code, part))) repeated.push(part);
    else barcodes.push(part);
  }
  return { barcodes, invalid, repeated };
}

// ---------------------------------------------------------------------------------------------------
// Receiving frames (with their barcodes) and sending frames back
// ---------------------------------------------------------------------------------------------------

export interface ReceiveLineDraft {
  itemId: string;
  quantity: string;
  /** Cost per frame excl VAT; not asked for consignment frames (they carry no stock value) */
  unitCost: string;
  /** The frames' own barcodes, if they came labelled; empty = the practice's own numbers are given */
  barcodes: string;
}

export interface ReceiveDraft {
  supplierId: string;
  reference: string;
  lines: ReceiveLineDraft[];
}

export type ReceiveLineErrors = Partial<Record<keyof ReceiveLineDraft, string>>;
export interface ReceiveErrors {
  supplierId?: string;
  reference?: string;
  lines?: ReceiveLineErrors[];
  form?: string;
}

export const emptyReceiveLine = (itemId = ''): ReceiveLineDraft => ({ itemId, quantity: '1', unitCost: '', barcodes: '' });

/** Frames received in one delivery at most (a box from the supplier); the stock module takes 100 lines */
export const RECEIVE_LIMITS = { lines: 100, quantity: 500 } as const;

/**
 * Checks a delivery of frames and builds optometry_frames_receive's payload. `consignment` names the frame items the
 * supplier owns until they are sold: their cost is not asked (no stock value, no payable now).
 */
export function validateReceive(
  draft: ReceiveDraft,
  options: { practiceId: string; consignment: ReadonlySet<string> }
): { ok: true; payload: Record<string, unknown>; frames: number } | { ok: false; errors: ReceiveErrors } {
  const errors: ReceiveErrors = {};
  if (!draft.supplierId) errors.supplierId = 'Choose the supplier.';
  if (!draft.reference.trim()) errors.reference = 'Type the number on the supplier\'s invoice or delivery note.';
  else if (draft.reference.trim().length > 60) errors.reference = 'Keep the number to 60 characters.';
  const lines = draft.lines.filter(line => line.itemId || line.barcodes.trim());
  if (lines.length === 0) errors.form = 'Add at least one frame.';
  if (lines.length > RECEIVE_LIMITS.lines) errors.form = `At most ${RECEIVE_LIMITS.lines} lines at a time.`;
  const lineErrors: ReceiveLineErrors[] = [];
  const allBarcodes: string[] = [];
  const parsed = lines.map((line, index) => {
    const own: ReceiveLineErrors = {};
    if (!line.itemId) own.itemId = 'Choose the frame.';
    const quantity = Number(line.quantity.trim());
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > RECEIVE_LIMITS.quantity) own.quantity = `1 to ${RECEIVE_LIMITS.quantity}.`;
    const consignment = options.consignment.has(line.itemId);
    const cost = consignment ? 0 : parseAmountText(line.unitCost);
    if (!consignment && cost === null) own.unitCost = 'The cost per frame, e.g. 450.00.';
    const scanned = parseBarcodeList(line.barcodes);
    if (scanned.invalid.length > 0) own.barcodes = `Not a barcode: ${scanned.invalid.slice(0, 3).join(', ')}.`;
    else if (scanned.repeated.length > 0) own.barcodes = `Scanned twice: ${scanned.repeated.slice(0, 3).join(', ')}.`;
    else if (scanned.barcodes.length > 0 && Number.isInteger(quantity) && scanned.barcodes.length !== quantity) {
      own.barcodes = `${scanned.barcodes.length} barcode${scanned.barcodes.length === 1 ? '' : 's'} for ${quantity} frame${quantity === 1 ? '' : 's'}: scan one per frame, or clear them for the practice's own numbers.`;
    }
    const clash = scanned.barcodes.find(code => allBarcodes.some(other => sameBarcode(other, code)));
    if (clash && !own.barcodes) own.barcodes = `${clash} is on another line too.`;
    allBarcodes.push(...scanned.barcodes);
    lineErrors[index] = own;
    return { item_id: line.itemId, quantity, unit_cost: cost ?? 0, barcodes: scanned.barcodes };
  });
  if (lineErrors.some(line => Object.keys(line).length > 0)) errors.lines = lineErrors;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    frames: parsed.reduce((sum, line) => sum + line.quantity, 0),
    payload: { practice_id: options.practiceId, supplier_id: draft.supplierId, supplier_reference: draft.reference.trim(), lines: parsed }
  };
}

export interface ReturnDraft {
  supplierId: string;
  reference: string;
  reason: string;
  unitIds: string[];
}

export function validateReturn(draft: ReturnDraft, practiceId: string): { ok: true; payload: Record<string, unknown> } | { ok: false; errors: Partial<Record<keyof ReturnDraft, string>> } {
  const errors: Partial<Record<keyof ReturnDraft, string>> = {};
  if (!draft.supplierId) errors.supplierId = 'Choose the supplier the frames go back to.';
  if (!draft.reference.trim()) errors.reference = 'Type the supplier\'s credit note number or your return note number.';
  else if (draft.reference.trim().length > 60) errors.reference = 'Keep the number to 60 characters.';
  if (draft.reason.trim().length < 3) errors.reason = 'Say why they go back, e.g. "slow sellers" or "damaged".';
  else if (draft.reason.trim().length > 300) errors.reason = 'Keep the reason to 300 characters.';
  if (draft.unitIds.length === 0) errors.unitIds = 'Scan or choose at least one frame.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: { practice_id: practiceId, supplier_id: draft.supplierId, supplier_reference: draft.reference.trim(), reason: draft.reason.trim(), unit_ids: [...new Set(draft.unitIds)] }
  };
}
