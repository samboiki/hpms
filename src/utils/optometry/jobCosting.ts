/**
 * Job costing for spectacles: each lab order (the job) against the price the patient was charged. The price is the
 * invoice of the visit the order is billed at; the costs are the frame (from the stock ledger, or the amount owed for
 * a consignment frame), the lenses (the lab's invoice for the job) and the practice's own labour. Stock lines (the
 * frame) are priced with VAT included (the stock module's rule), so their VAT is taken off to compare like with
 * like; fees are as invoiced. Pure; tested in __tests__/jobCosting.test.ts.
 */
import type { LabOrderStatus } from './labOrders';

export interface JobInvoiceLine {
  totalCents: number;
  /** A stock line's VAT rate (its price includes VAT); null for a fee */
  vatRate: number | null;
}

export interface JobInput {
  orderId: string;
  orderNo: number;
  patientId: string;
  orderedOn: string;
  status: LabOrderStatus;
  lensCostCents: number | null;
  labourCostCents: number | null;
  labInvoiceRef: string | null;
  invoice: { id: string; number: string; lines: readonly JobInvoiceLine[] } | null;
  /** The frame's cost on that invoice: the ledger's value of the frame sold, or what is owed for a consignment frame */
  frameCostCents: number;
}

export type JobGap = 'invoice' | 'lens_cost' | 'labour';
export const JOB_GAP_LABELS: Readonly<Record<JobGap, string>> = {
  invoice: 'no invoice for the visit',
  lens_cost: 'lab cost not entered',
  labour: 'labour not entered'
};

export interface JobRow {
  orderId: string;
  orderNo: number;
  patientId: string;
  orderedOn: string;
  status: LabOrderStatus;
  invoiceId: string | null;
  invoiceNumber: string | null;
  labInvoiceRef: string | null;
  priceCents: number;
  frameCostCents: number;
  lensCostCents: number | null;
  labourCostCents: number | null;
  costCents: number;
  profitCents: number;
  /** Profit as a share of the price, 0..1 (null without a price) */
  margin: number | null;
  gaps: JobGap[];
}

export interface JobCosting {
  rows: JobRow[];
  priceCents: number;
  frameCostCents: number;
  lensCostCents: number;
  labourCostCents: number;
  costCents: number;
  profitCents: number;
  margin: number | null;
  /** Jobs still missing a cost or the invoice (their profit is overstated until filled in) */
  incomplete: number;
}

/** A price that includes VAT, without it: rounded to the cent, half up */
export const withoutVat = (cents: number, rate: number): number => (rate > 0 ? Math.round((cents * 100) / (100 + rate)) : cents);

export function jobRow(input: JobInput): JobRow {
  const priceCents = input.invoice
    ? input.invoice.lines.reduce((sum, line) => sum + (line.vatRate === null ? line.totalCents : withoutVat(line.totalCents, line.vatRate)), 0)
    : 0;
  const costCents = input.frameCostCents + (input.lensCostCents ?? 0) + (input.labourCostCents ?? 0);
  const gaps: JobGap[] = [];
  if (!input.invoice) gaps.push('invoice');
  if (input.lensCostCents === null) gaps.push('lens_cost');
  if (input.labourCostCents === null) gaps.push('labour');
  return {
    orderId: input.orderId,
    orderNo: input.orderNo,
    patientId: input.patientId,
    orderedOn: input.orderedOn,
    status: input.status,
    invoiceId: input.invoice?.id ?? null,
    invoiceNumber: input.invoice?.number ?? null,
    labInvoiceRef: input.labInvoiceRef,
    priceCents,
    frameCostCents: input.frameCostCents,
    lensCostCents: input.lensCostCents,
    labourCostCents: input.labourCostCents,
    costCents,
    profitCents: priceCents - costCents,
    margin: priceCents > 0 ? (priceCents - costCents) / priceCents : null,
    gaps
  };
}

/** Every job of the period (cancelled orders left out), newest first, with the totals */
export function jobCosting(inputs: readonly JobInput[]): JobCosting {
  const rows = inputs
    .filter(input => input.status !== 'cancelled')
    .map(jobRow)
    .sort((a, b) => b.orderedOn.localeCompare(a.orderedOn) || b.orderNo - a.orderNo);
  const sum = (pick: (row: JobRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const priceCents = sum(row => row.priceCents);
  const costCents = sum(row => row.costCents);
  return {
    rows,
    priceCents,
    frameCostCents: sum(row => row.frameCostCents),
    lensCostCents: sum(row => row.lensCostCents ?? 0),
    labourCostCents: sum(row => row.labourCostCents ?? 0),
    costCents,
    profitCents: priceCents - costCents,
    margin: priceCents > 0 ? (priceCents - costCents) / priceCents : null,
    incomplete: rows.filter(row => row.gaps.length > 0).length
  };
}

export interface CostsDraft {
  lensCost: string;
  labourCost: string;
  labInvoiceRef: string;
}

const amount = (input: string): number | null | 'bad' => {
  const cleaned = input.trim().replace(/^N\$\s*/i, '').replace(/,/g, '');
  if (cleaned === '') return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return 'bad';
  return Number(cleaned);
};

/** The lab's charge for the lenses and the practice's labour on one job; empty boxes stay "not entered" */
export function validateCosts(draft: CostsDraft): { ok: true; payload: Record<string, unknown> } | { ok: false; errors: Partial<Record<keyof CostsDraft, string>> } {
  const errors: Partial<Record<keyof CostsDraft, string>> = {};
  const lens = amount(draft.lensCost);
  const labour = amount(draft.labourCost);
  if (lens === 'bad') errors.lensCost = 'An amount in N$ excl. VAT, e.g. 850.00.';
  if (labour === 'bad') errors.labourCost = 'An amount in N$, e.g. 150.00.';
  if (draft.labInvoiceRef.trim().length > 40) errors.labInvoiceRef = 'Keep the number to 40 characters.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, payload: { lens_cost: lens, labour_cost: labour, lab_invoice_ref: draft.labInvoiceRef.trim() || null } };
}
