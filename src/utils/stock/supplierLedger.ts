/**
 * The creditors ledger (L12, R24): what the practice owes each supplier, from the supplier invoices captured as
 * deliveries received on account or recorded for consignment frames sold (one figure per supplier:
 * proposals/2026-10-13-consignment-supplier-ledger.sql), the credits for stock returned, and the payments made. The same
 * rules are in the database (stock_supplier_invoice_owed and stock_pay_supplier, proposals/2026-10-13-stock-stores-and-suppliers.sql):
 *
 * - A supplier invoice owes nothing once its delivery is reversed or its payable is marked paid (by a payment here, or
 *   by hand in Settings > Practice Overhead); otherwise its total less what payments and credits have paid of it.
 * - A payable marked paid in Practice Overhead counts as paid on its paid date for whatever the ledger had not paid of
 *   it ("marked paid outside the ledger"), so both screens agree.
 * - Payments and return credits not yet set against an invoice are credit with the supplier.
 * - Balance = what the invoices still owe - unused credits - payments not yet set against an invoice.
 *
 * Pure: money in whole cents, days as yyyy-MM-dd.
 */
import { addDaysToKey, daysBetweenKeys } from '../billing/dates';
import { AGE_BANDS, ageBandFor, type AgeBand } from '../../services/ledger/receivables';
import { toCents } from '../../services/ledger/money';
import { windhoekClock } from '../patientLists/listDates';

export type PaymentMethod = 'bank_transfer' | 'debit_order' | 'credit_card' | 'cash' | 'cheque' | 'other';

/** The same choices as Settings > Practice Overhead, in plain words */
export const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'bank_transfer', label: 'EFT (bank transfer)' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Card' },
  { value: 'debit_order', label: 'Debit order' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' }
];

export const paymentMethodLabel = (method: string | null | undefined): string =>
  PAYMENT_METHODS.find(option => option.value === method)?.label ?? 'Other';

export interface LedgerDelivery {
  id: string;
  number: string;
  kind: 'received' | 'returned';
  supplierId: string;
  /** The supplier's invoice number (received) or credit note number (returned) */
  supplierReference: string;
  documentDate: string;
  exclVatCents: number;
  vatCents: number;
  inclVatCents: number;
  /** Received with its invoice added to payables: owed on account */
  onAccount: boolean;
  /**
   * The supplier's invoice for consignment frames sold (Optometry > Reports > Consignment; CSG numbers): owed on
   * account like a delivery's invoice, with no stock received on it. Absent or false for a delivery or a return.
   */
  consignment?: boolean;
  expenseId: string | null;
  createdAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}

/** The delivery's payable in practice_expenses */
export interface LedgerPayable {
  status: string;
  paidDate: string | null;
  dueDate: string | null;
}

export interface SupplierPayment {
  id: string;
  number: string;
  supplierId: string;
  paidOn: string;
  amountCents: number;
  method: string;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface SupplierAllocation {
  id: string;
  supplierId: string;
  invoiceId: string;
  paymentId: string | null;
  creditId: string | null;
  amountCents: number;
  createdAt: string;
  reversedAt: string | null;
}

export interface SupplierLedgerData {
  deliveries: readonly LedgerDelivery[];
  /** By expense id */
  payables: ReadonlyMap<string, LedgerPayable>;
  payments: readonly SupplierPayment[];
  allocations: readonly SupplierAllocation[];
}

/** The day (Windhoek) a timestamp falls on */
export const dayOf = (timestamp: string): string => windhoekClock(new Date(timestamp)).dateKey;

const isInvoice = (delivery: LedgerDelivery): boolean => delivery.kind === 'received' && delivery.onAccount;

/** Allocations still standing: not released, and their invoice, payment and credit not reversed */
function standingAllocations(data: SupplierLedgerData): SupplierAllocation[] {
  const reversedDelivery = new Set(data.deliveries.filter(row => row.reversedAt).map(row => row.id));
  const reversedPayment = new Set(data.payments.filter(row => row.reversedAt).map(row => row.id));
  return data.allocations.filter(allocation =>
    !allocation.reversedAt
    && !reversedDelivery.has(allocation.invoiceId)
    && !(allocation.creditId && reversedDelivery.has(allocation.creditId))
    && !(allocation.paymentId && reversedPayment.has(allocation.paymentId)));
}

const sumBy = <T>(rows: readonly T[], value: (row: T) => number): number => rows.reduce((sum, row) => sum + value(row), 0);

export interface InvoiceState {
  delivery: LedgerDelivery;
  /** Paid by payments and credits in the ledger */
  allocatedCents: number;
  /** Paid outside the ledger: the payable was marked paid in Practice Overhead */
  paidOutsideCents: number;
  /** Still owed */
  owedCents: number;
  dueDate: string;
  /** The payable's paid date, when it is marked paid */
  paidOn: string | null;
}

export interface CreditState {
  /** A return (credit note) or a payment */
  kind: 'return' | 'payment';
  id: string;
  number: string;
  date: string;
  createdAt: string;
  /** Not set against an invoice yet */
  unusedCents: number;
}

export interface SupplierAccount {
  supplierId: string;
  invoices: InvoiceState[];
  /** Unused credits (returns and payments), oldest first */
  credits: CreditState[];
  owedCents: number;
  creditCents: number;
  /** owed - credit: what the practice owes the supplier (negative: the supplier owes the practice) */
  balanceCents: number;
}

/** A supplier's invoices, credits and balance, from the ledger rows of that supplier (or of all suppliers) */
export function supplierAccount(supplierId: string, termsDays: number, data: SupplierLedgerData): SupplierAccount {
  const standing = standingAllocations(data).filter(row => row.supplierId === supplierId);
  const deliveries = data.deliveries.filter(row => row.supplierId === supplierId);

  const invoices = deliveries.filter(isInvoice).map((delivery): InvoiceState => {
    const allocatedCents = sumBy(standing.filter(row => row.invoiceId === delivery.id), row => row.amountCents);
    const payable = delivery.expenseId ? data.payables.get(delivery.expenseId) : undefined;
    const markedPaid = (payable?.status ?? '').toLowerCase() === 'paid';
    const reversed = delivery.reversedAt !== null;
    const open = Math.max(delivery.inclVatCents - allocatedCents, 0);
    return {
      delivery,
      allocatedCents,
      paidOutsideCents: !reversed && markedPaid ? open : 0,
      owedCents: reversed || markedPaid ? 0 : open,
      dueDate: payable?.dueDate ?? addDaysToKey(delivery.documentDate, termsDays),
      paidOn: markedPaid ? payable?.paidDate ?? null : null
    };
  }).sort((a, b) => a.delivery.documentDate.localeCompare(b.delivery.documentDate) || a.delivery.createdAt.localeCompare(b.delivery.createdAt));

  const returnCredits = deliveries.filter(row => row.kind === 'returned' && !row.reversedAt).map((row): CreditState => ({
    kind: 'return',
    id: row.id,
    number: row.number,
    date: row.documentDate,
    createdAt: row.createdAt,
    unusedCents: Math.max(row.inclVatCents - sumBy(standing.filter(a => a.creditId === row.id), a => a.amountCents), 0)
  }));
  const paymentCredits = data.payments.filter(row => row.supplierId === supplierId && !row.reversedAt).map((row): CreditState => ({
    kind: 'payment',
    id: row.id,
    number: row.number,
    date: row.paidOn,
    createdAt: row.createdAt,
    unusedCents: Math.max(row.amountCents - sumBy(standing.filter(a => a.paymentId === row.id), a => a.amountCents), 0)
  }));
  const credits = [...returnCredits, ...paymentCredits]
    .filter(row => row.unusedCents > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const owedCents = sumBy(invoices, row => row.owedCents);
  const creditCents = sumBy(credits, row => row.unusedCents);
  return { supplierId, invoices, credits, owedCents, creditCents, balanceCents: owedCents - creditCents };
}

/** The invoices that still owe something, oldest first */
export const openInvoices = (account: SupplierAccount): InvoiceState[] => account.invoices.filter(row => row.owedCents > 0);

// ---------------------------------------------------------------------------------------------
// Paying a supplier
// ---------------------------------------------------------------------------------------------

export interface PaymentPlanLine {
  invoiceId: string;
  owedCents: number;
  fromCreditsCents: number;
  fromPaymentCents: number;
  /** Still owed afterwards */
  leftCents: number;
}

export interface PaymentPlan {
  lines: PaymentPlanLine[];
  creditsUsedCents: number;
  /** What the payment pays of the chosen invoices */
  allocatedCents: number;
  /** What the payment does not need: kept as credit with the supplier */
  onAccountCents: number;
}

/**
 * What a payment will do, as stock_pay_supplier does it: the chosen invoices oldest first, each paid first from the
 * credits not used yet (when asked), then from this payment; what the payment does not need stays on account.
 */
export function planPayment(account: SupplierAccount, chosenIds: ReadonlySet<string>, amountCents: number, useCredits: boolean): PaymentPlan {
  let credits = useCredits ? account.creditCents : 0;
  let payment = Math.max(amountCents, 0);
  const lines: PaymentPlanLine[] = [];
  for (const invoice of openInvoices(account)) {
    if (!chosenIds.has(invoice.delivery.id)) continue;
    let owed = invoice.owedCents;
    const fromCredits = Math.min(owed, credits);
    credits -= fromCredits;
    owed -= fromCredits;
    const fromPayment = Math.min(owed, payment);
    payment -= fromPayment;
    owed -= fromPayment;
    lines.push({ invoiceId: invoice.delivery.id, owedCents: invoice.owedCents, fromCreditsCents: fromCredits, fromPaymentCents: fromPayment, leftCents: owed });
  }
  const creditsUsedCents = sumBy(lines, line => line.fromCreditsCents);
  const allocatedCents = sumBy(lines, line => line.fromPaymentCents);
  return { lines, creditsUsedCents, allocatedCents, onAccountCents: Math.max(amountCents, 0) - allocatedCents };
}

/** The amount that pays the chosen invoices in full, after the credits (what staff usually pay) */
export function amountToSettle(account: SupplierAccount, chosenIds: ReadonlySet<string>, useCredits: boolean): number {
  const owed = sumBy(openInvoices(account).filter(row => chosenIds.has(row.delivery.id)), row => row.owedCents);
  return Math.max(owed - (useCredits ? account.creditCents : 0), 0);
}

/** The oldest open invoices that a typed amount (with the credits) pays, so ticking follows a typed amount */
export function invoicesForAmount(account: SupplierAccount, amountCents: number, useCredits: boolean): Set<string> {
  let left = Math.max(amountCents, 0) + (useCredits ? account.creditCents : 0);
  const chosen = new Set<string>();
  for (const invoice of openInvoices(account)) {
    if (left <= 0) break;
    chosen.add(invoice.delivery.id);
    left -= invoice.owedCents;
  }
  return chosen;
}

// ---------------------------------------------------------------------------------------------
// The statement: every entry on the supplier's account, in date order, with the running balance
// ---------------------------------------------------------------------------------------------

export type EntryKind = 'invoice' | 'invoice_reversed' | 'credit' | 'credit_reversed' | 'payment' | 'payment_reversed' | 'marked_paid';

export const ENTRY_LABELS: Readonly<Record<EntryKind, string>> = {
  invoice: 'Invoice',
  invoice_reversed: 'Invoice reversed',
  credit: 'Credit for stock returned',
  credit_reversed: 'Credit reversed',
  payment: 'Payment',
  payment_reversed: 'Payment reversed',
  marked_paid: 'Marked paid in Practice Overhead'
};

export interface LedgerEntry {
  key: string;
  supplierId: string;
  date: string;
  kind: EntryKind;
  /** Our document: GRV, RET or PAY number */
  document: string;
  /** The supplier's invoice or credit note number, or the payment reference */
  reference: string | null;
  /** + the practice owes more; - it owes less */
  amountCents: number;
  /** The delivery or payment the entry belongs to (for links) */
  deliveryId: string | null;
  paymentId: string | null;
  note: string | null;
  /** For ordering entries of one day */
  at: string;
}

/** The note on a consignment invoice's line of the account, the statement and the transactions report */
export const CONSIGNMENT_INVOICE_NOTE = 'Consignment frames sold';

/** Every entry of the suppliers in `data` (filter by supplier afterwards), unsorted */
export function ledgerEntries(data: SupplierLedgerData, termsOf: (supplierId: string) => number): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const delivery of data.deliveries) {
    if (delivery.kind === 'received' && !delivery.onAccount) continue;
    const invoice = delivery.kind === 'received';
    entries.push({
      key: `${delivery.id}:doc`, supplierId: delivery.supplierId, date: delivery.documentDate, kind: invoice ? 'invoice' : 'credit',
      document: delivery.number, reference: delivery.supplierReference, amountCents: invoice ? delivery.inclVatCents : -delivery.inclVatCents,
      deliveryId: delivery.id, paymentId: null, note: delivery.consignment ? CONSIGNMENT_INVOICE_NOTE : null, at: delivery.createdAt
    });
    if (delivery.reversedAt) {
      entries.push({
        key: `${delivery.id}:rev`, supplierId: delivery.supplierId, date: dayOf(delivery.reversedAt), kind: invoice ? 'invoice_reversed' : 'credit_reversed',
        document: delivery.number, reference: delivery.supplierReference, amountCents: invoice ? -delivery.inclVatCents : delivery.inclVatCents,
        deliveryId: delivery.id, paymentId: null, note: delivery.reversalReason, at: delivery.reversedAt
      });
    }
  }
  for (const payment of data.payments) {
    entries.push({
      key: `${payment.id}:pay`, supplierId: payment.supplierId, date: payment.paidOn, kind: 'payment', document: payment.number,
      reference: payment.reference, amountCents: -payment.amountCents, deliveryId: null, paymentId: payment.id,
      note: paymentMethodLabel(payment.method), at: payment.createdAt
    });
    if (payment.reversedAt) {
      entries.push({
        key: `${payment.id}:rev`, supplierId: payment.supplierId, date: dayOf(payment.reversedAt), kind: 'payment_reversed',
        document: payment.number, reference: payment.reference, amountCents: payment.amountCents, deliveryId: null, paymentId: payment.id,
        note: payment.reversalReason, at: payment.reversedAt
      });
    }
  }
  // Invoices paid in Practice Overhead: the part the ledger had not paid, on the payable's paid date
  const suppliers = new Set(data.deliveries.map(row => row.supplierId));
  for (const supplierId of suppliers) {
    for (const state of supplierAccount(supplierId, termsOf(supplierId), data).invoices) {
      if (state.paidOutsideCents <= 0) continue;
      entries.push({
        key: `${state.delivery.id}:marked`, supplierId, date: state.paidOn ?? state.delivery.documentDate, kind: 'marked_paid',
        document: state.delivery.number, reference: state.delivery.supplierReference, amountCents: -state.paidOutsideCents,
        deliveryId: state.delivery.id, paymentId: null, note: null, at: `${state.paidOn ?? state.delivery.documentDate}T23:59:59Z`
      });
    }
  }
  return entries;
}

const byDate = (a: LedgerEntry, b: LedgerEntry): number => a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || a.key.localeCompare(b.key);

export interface Statement {
  fromKey: string;
  toKey: string;
  openingCents: number;
  lines: Array<LedgerEntry & { balanceCents: number }>;
  closingCents: number;
  /** In the period: invoices, credits and payments (each net of its reversals) */
  invoicedCents: number;
  creditedCents: number;
  paidCents: number;
}

/** A supplier statement for a period (both days included): the balance brought forward, the entries, the balance */
export function statementFor(entries: readonly LedgerEntry[], fromKey: string, toKey: string): Statement {
  const sorted = [...entries].sort(byDate);
  const openingCents = sumBy(sorted.filter(entry => entry.date < fromKey), entry => entry.amountCents);
  let balance = openingCents;
  const lines = sorted.filter(entry => entry.date >= fromKey && entry.date <= toKey).map(entry => {
    balance += entry.amountCents;
    return { ...entry, balanceCents: balance };
  });
  const total = (kinds: EntryKind[]) => sumBy(lines.filter(line => kinds.includes(line.kind)), line => line.amountCents);
  return {
    fromKey,
    toKey,
    openingCents,
    lines,
    closingCents: balance,
    invoicedCents: total(['invoice', 'invoice_reversed']),
    creditedCents: -total(['credit', 'credit_reversed']),
    paidCents: -total(['payment', 'payment_reversed', 'marked_paid'])
  };
}

// ---------------------------------------------------------------------------------------------
// The age analysis (R24)
// ---------------------------------------------------------------------------------------------

export type BandCents = Record<AgeBand, number>;
const zeroBands = (): BandCents => Object.fromEntries(AGE_BANDS.map(band => [band.key, 0])) as BandCents;

export interface SupplierAgeRow {
  supplierId: string;
  name: string;
  /** What the open invoices still owe, by the age of each invoice (from its date) */
  bands: BandCents;
  owedCents: number;
  /** Unused credits and payments not yet set against an invoice */
  creditCents: number;
  /** owed - credit */
  balanceCents: number;
  /** Owed on invoices past their due date (the supplier's terms) */
  overdueCents: number;
  openInvoices: number;
}

export interface SupplierAgeAnalysis {
  rows: SupplierAgeRow[];
  totals: Omit<SupplierAgeRow, 'supplierId' | 'name'>;
}

/** What is owed to each supplier as at a day, in the age bands of the debtors' age analysis (current to 180+ days) */
export function supplierAgeAnalysis(
  suppliers: ReadonlyArray<{ id: string; name: string; paymentTermsDays: number }>,
  data: SupplierLedgerData,
  asOfKey: string
): SupplierAgeAnalysis {
  const rows = suppliers.map((supplier): SupplierAgeRow => {
    const account = supplierAccount(supplier.id, supplier.paymentTermsDays, data);
    const bands = zeroBands();
    let overdueCents = 0;
    const open = openInvoices(account);
    for (const invoice of open) {
      bands[ageBandFor(Math.max(daysBetweenKeys(invoice.delivery.documentDate, asOfKey), 0))] += invoice.owedCents;
      if (invoice.dueDate < asOfKey) overdueCents += invoice.owedCents;
    }
    return {
      supplierId: supplier.id,
      name: supplier.name,
      bands,
      owedCents: account.owedCents,
      creditCents: account.creditCents,
      balanceCents: account.balanceCents,
      overdueCents,
      openInvoices: open.length
    };
  }).filter(row => row.owedCents !== 0 || row.creditCents !== 0)
    .sort((a, b) => b.balanceCents - a.balanceCents || a.name.localeCompare(b.name));

  const totals = { bands: zeroBands(), owedCents: 0, creditCents: 0, balanceCents: 0, overdueCents: 0, openInvoices: 0 };
  for (const row of rows) {
    for (const band of AGE_BANDS) totals.bands[band.key] += row.bands[band.key];
    totals.owedCents += row.owedCents;
    totals.creditCents += row.creditCents;
    totals.balanceCents += row.balanceCents;
    totals.overdueCents += row.overdueCents;
    totals.openInvoices += row.openInvoices;
  }
  return { rows, totals };
}

// ---------------------------------------------------------------------------------------------
// VAT on purchases (R24): only what supplier documents record
// ---------------------------------------------------------------------------------------------

export interface VatMonth {
  month: string;
  purchasesExclCents: number;
  purchasesVatCents: number;
  /** Returns (credit notes), excl. VAT, positive */
  creditsExclCents: number;
  creditsVatCents: number;
  /** purchases VAT - credits VAT */
  netVatCents: number;
}

/**
 * VAT paid to suppliers (input VAT) per month: on every delivery received (on account or not) less the VAT on stock
 * returned; a reversed document counts against the month it was reversed in. Patient invoices carry no VAT figure yet
 * (an owner decision), so this is the purchases side only, not a VAT return.
 */
export function vatOnPurchases(deliveries: readonly LedgerDelivery[], fromKey: string, toKey: string): { months: VatMonth[]; total: VatMonth } {
  const months = new Map<string, VatMonth>();
  const add = (date: string, received: boolean, sign: 1 | -1, delivery: LedgerDelivery) => {
    if (date < fromKey || date > toKey) return;
    const month = date.slice(0, 7);
    const row = months.get(month) ?? { month, purchasesExclCents: 0, purchasesVatCents: 0, creditsExclCents: 0, creditsVatCents: 0, netVatCents: 0 };
    if (received) {
      row.purchasesExclCents += sign * delivery.exclVatCents;
      row.purchasesVatCents += sign * delivery.vatCents;
    } else {
      row.creditsExclCents += sign * delivery.exclVatCents;
      row.creditsVatCents += sign * delivery.vatCents;
    }
    row.netVatCents = row.purchasesVatCents - row.creditsVatCents;
    months.set(month, row);
  };
  for (const delivery of deliveries) {
    const received = delivery.kind === 'received';
    add(delivery.documentDate, received, 1, delivery);
    if (delivery.reversedAt) add(dayOf(delivery.reversedAt), received, -1, delivery);
  }
  const sorted = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
  const total = sorted.reduce<VatMonth>((sum, row) => ({
    month: 'Total',
    purchasesExclCents: sum.purchasesExclCents + row.purchasesExclCents,
    purchasesVatCents: sum.purchasesVatCents + row.purchasesVatCents,
    creditsExclCents: sum.creditsExclCents + row.creditsExclCents,
    creditsVatCents: sum.creditsVatCents + row.creditsVatCents,
    netVatCents: sum.netVatCents + row.netVatCents
  }), { month: 'Total', purchasesExclCents: 0, purchasesVatCents: 0, creditsExclCents: 0, creditsVatCents: 0, netVatCents: 0 });
  return { months: sorted, total };
}

// ---------------------------------------------------------------------------------------------
// Rows from the database (numeric columns arrive as strings)
// ---------------------------------------------------------------------------------------------

type Num = number | string | null | undefined;

export interface LedgerDeliveryRow {
  id: string;
  number: string;
  kind: string;
  supplier_id: string;
  supplier_reference: string;
  document_date: string;
  total_excl_vat: Num;
  vat_amount: Num;
  total_incl_vat: Num;
  on_account?: boolean | null;
  consignment?: boolean | null;
  expense_id?: string | null;
  created_at: string;
  reversed_at?: string | null;
  reversal_reason?: string | null;
}

/** The columns before proposals/2026-10-13-consignment-supplier-ledger.sql (read while `consignment` does not exist) */
export const LEDGER_DELIVERY_BASE_COLUMNS =
  'id, number, kind, supplier_id, supplier_reference, document_date, total_excl_vat, vat_amount, total_incl_vat, on_account, expense_id, created_at, reversed_at, reversal_reason';

export const LEDGER_DELIVERY_COLUMNS = `${LEDGER_DELIVERY_BASE_COLUMNS}, consignment`;

export const normalizeLedgerDelivery = (row: LedgerDeliveryRow): LedgerDelivery => ({
  id: row.id,
  number: row.number,
  kind: row.kind === 'returned' ? 'returned' : 'received',
  supplierId: row.supplier_id,
  supplierReference: row.supplier_reference,
  documentDate: row.document_date.slice(0, 10),
  exclVatCents: toCents(row.total_excl_vat),
  vatCents: toCents(row.vat_amount),
  inclVatCents: toCents(row.total_incl_vat),
  onAccount: row.on_account === true,
  consignment: row.consignment === true,
  expenseId: row.expense_id ?? null,
  createdAt: row.created_at,
  reversedAt: row.reversed_at ?? null,
  reversalReason: row.reversal_reason?.trim() || null
});

export interface SupplierPaymentRow {
  id: string;
  number: string;
  supplier_id: string;
  paid_on: string;
  amount: Num;
  method: string;
  reference?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  reversed_at?: string | null;
  reversal_reason?: string | null;
}

export const SUPPLIER_PAYMENT_COLUMNS =
  'id, number, supplier_id, paid_on, amount, method, reference, notes, created_by, created_at, reversed_at, reversal_reason';

export const normalizeSupplierPayment = (row: SupplierPaymentRow): SupplierPayment => ({
  id: row.id,
  number: row.number,
  supplierId: row.supplier_id,
  paidOn: row.paid_on.slice(0, 10),
  amountCents: toCents(row.amount),
  method: row.method,
  reference: row.reference?.trim() || null,
  notes: row.notes?.trim() || null,
  createdBy: row.created_by ?? null,
  createdAt: row.created_at,
  reversedAt: row.reversed_at ?? null,
  reversalReason: row.reversal_reason?.trim() || null
});

export interface SupplierAllocationRow {
  id: string;
  supplier_id: string;
  invoice_id: string;
  payment_id?: string | null;
  credit_id?: string | null;
  amount: Num;
  created_at: string;
  reversed_at?: string | null;
}

export const SUPPLIER_ALLOCATION_COLUMNS = 'id, supplier_id, invoice_id, payment_id, credit_id, amount, created_at, reversed_at';

export const normalizeSupplierAllocation = (row: SupplierAllocationRow): SupplierAllocation => ({
  id: row.id,
  supplierId: row.supplier_id,
  invoiceId: row.invoice_id,
  paymentId: row.payment_id ?? null,
  creditId: row.credit_id ?? null,
  amountCents: toCents(row.amount),
  createdAt: row.created_at,
  reversedAt: row.reversed_at ?? null
});
