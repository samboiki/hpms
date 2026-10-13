import { fromCents, toAmount, toCents } from './money';
import { isInRange, type DateRange } from './dates';
import { invoiceDateKey, isRevenueInvoice, summarizeRevenue, type LedgerInvoice } from './invoices';

// ---------------------------------------------------------------------------------------------
// Revenue by tariff code (invoice line items)
// ---------------------------------------------------------------------------------------------

export interface RawLineItemRow {
  invoice_id?: string | null;
  code?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  total_price?: number | string | null;
  /** An amount on invoice_services; older rows may hold a boolean */
  medical_aid_covered?: number | string | boolean | null;
  patient_portion?: number | string | null;
}

export interface LedgerLineItem {
  invoiceId: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  medicalAid: number;
  patient: number;
}

export function normalizeLineItem(row: RawLineItemRow): LedgerLineItem | null {
  if (!row.invoice_id) return null;
  const quantityValue = toAmount(row.quantity);
  const quantity = quantityValue > 0 ? quantityValue : 1;
  const unitPrice = toAmount(row.unit_price);
  const hasTotal = row.total_price !== null && row.total_price !== undefined && row.total_price !== '';
  const totalCents = hasTotal ? toCents(row.total_price) : Math.round(quantity * toCents(row.unit_price));
  const covered = row.medical_aid_covered;
  const coveredCents = typeof covered === 'boolean' ? (covered ? totalCents : 0) : toCents(covered);
  const medicalAidCents = totalCents <= 0 ? 0 : Math.min(Math.max(coveredCents, 0), totalCents);
  return {
    invoiceId: row.invoice_id,
    code: (row.code ?? '').trim().toUpperCase(),
    description: (row.description ?? '').trim(),
    quantity,
    unitPrice,
    total: fromCents(totalCents),
    medicalAid: fromCents(medicalAidCents),
    patient: fromCents(totalCents - medicalAidCents)
  };
}

export interface TariffRevenueRow {
  code: string;
  description: string;
  quantity: number;
  revenue: number;
  medicalAid: number;
  patient: number;
  invoiceCount: number;
  /** Share of all line-item revenue in the range (0..1) */
  share: number;
}

/** Ids of invoices that count as revenue in a range (uncancelled, invoice date in range). */
export const revenueInvoiceIds = (invoices: LedgerInvoice[], range: DateRange): Set<string> =>
  new Set(invoices.filter(inv => isRevenueInvoice(inv) && isInRange(invoiceDateKey(inv), range)).map(inv => inv.id));

/** Line-item revenue per tariff code for invoices billed in the range, largest first. */
export function revenueByTariffCode(lines: LedgerLineItem[], invoices: LedgerInvoice[], range: DateRange): TariffRevenueRow[] {
  const eligible = revenueInvoiceIds(invoices, range);
  const groups = new Map<string, { code: string; description: string; quantity: number; cents: number; medicalAid: number; invoices: Set<string> }>();
  let totalCents = 0;
  for (const line of lines) {
    if (!eligible.has(line.invoiceId)) continue;
    const key = line.code || `desc:${line.description.toLowerCase()}`;
    const group = groups.get(key) ?? { code: line.code, description: line.description, quantity: 0, cents: 0, medicalAid: 0, invoices: new Set<string>() };
    if (!group.description && line.description) group.description = line.description;
    group.quantity += line.quantity;
    group.cents += toCents(line.total);
    group.medicalAid += toCents(line.medicalAid);
    group.invoices.add(line.invoiceId);
    groups.set(key, group);
    totalCents += toCents(line.total);
  }
  return [...groups.values()]
    .map(group => ({
      code: group.code,
      description: group.description || 'No description',
      quantity: group.quantity,
      revenue: fromCents(group.cents),
      medicalAid: fromCents(group.medicalAid),
      patient: fromCents(group.cents - group.medicalAid),
      invoiceCount: group.invoices.size,
      share: totalCents === 0 ? 0 : group.cents / totalCents
    }))
    .sort((a, b) => b.revenue - a.revenue || a.code.localeCompare(b.code));
}

export interface LineItemReconciliation {
  invoiceTotal: number;
  lineTotal: number;
  /** invoiceTotal - lineTotal (tax, adjustments, or invoices without line items) */
  difference: number;
  invoicesWithoutLines: number;
}

/** Compare line-item revenue with invoice totals for the same invoices. */
export function reconcileLineItems(lines: LedgerLineItem[], invoices: LedgerInvoice[], range: DateRange): LineItemReconciliation {
  const eligible = revenueInvoiceIds(invoices, range);
  const withLines = new Set<string>();
  let lineCents = 0;
  for (const line of lines) {
    if (!eligible.has(line.invoiceId)) continue;
    lineCents += toCents(line.total);
    withLines.add(line.invoiceId);
  }
  const invoiceCents = toCents(summarizeRevenue(invoices, range).billed);
  return {
    invoiceTotal: fromCents(invoiceCents),
    lineTotal: fromCents(lineCents),
    difference: fromCents(invoiceCents - lineCents),
    invoicesWithoutLines: [...eligible].filter(id => !withLines.has(id)).length
  };
}
