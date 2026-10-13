import type { AllocationLine, PayerType, Portion, ReceiptMethod, RefundMethod } from '../../../services/ledgerService';

/**
 * The JSON the receipt RPCs take (proposals/2026-10-07-receipts-and-allocations.sql). Pure, so the
 * screens and the coming remittance import send exactly the same thing. Amounts go as strings
 * with 2 decimals ("123.45"), so no binary rounding happens on the way to numeric(14,2).
 */

export const centsToAmountText = (cents: number): string => {
  if (!Number.isInteger(cents)) throw new RangeError(`Cents must be a whole number: ${String(cents)}`);
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
};

const cleanText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export interface ShortfallLine {
  invoiceId: string;
  amountCents: number;
  reason?: string | null;
  reasonCode?: string | null;
  externalRef?: string | null;
}

export interface WriteOffLine {
  invoiceId: string;
  portion: Portion;
  amountCents: number;
  reasonCode: string;
  reason: string;
  externalRef?: string | null;
}

export interface ReceiptInput {
  practiceId: string;
  payerType: PayerType;
  patientId?: string | null;
  fundName?: string | null;
  payerName?: string | null;
  method: Exclude<ReceiptMethod, 'other' | 'not_recorded'>;
  amountCents: number;
  /** yyyy-MM-dd; today when left out */
  receivedOn?: string | null;
  reference?: string | null;
  notes?: string | null;
  /** manual (Receive payment), batch (a fund's lump sum) or remittance_import */
  source?: 'manual' | 'batch' | 'remittance_import';
  /** Idempotency key: the same key never records a second receipt */
  externalRef?: string | null;
  allocations: ReadonlyArray<AllocationLine & { externalRef?: string | null }>;
  shortfalls?: readonly ShortfallLine[];
  writeOffs?: readonly WriteOffLine[];
}

/**
 * The invoice lines staff chose an allocation to pay (proposals/2026-10-09-allocation-lines.sql); nothing when they
 * chose none, so the database splits it oldest line first
 */
const chosenLines = (line: AllocationLine): { lines?: Array<{ invoice_line_id: string; amount: string }> } => {
  const lines = (line.lines ?? []).filter(entry => entry.amountCents > 0);
  return lines.length > 0 ? { lines: lines.map(entry => ({ invoice_line_id: entry.lineId, amount: centsToAmountText(entry.amountCents) })) } : {};
};

/** ar_post_receipt payload: zero lines are dropped, text is trimmed, amounts are exact */
export function buildReceiptPayload(input: ReceiptInput): Record<string, unknown> {
  return {
    practice_id: input.practiceId,
    payer_type: input.payerType,
    patient_id: input.patientId ?? null,
    fund_name: input.payerType === 'medical_aid' ? cleanText(input.fundName) : null,
    payer_name: input.payerType === 'other' ? cleanText(input.payerName) : null,
    method: input.method,
    amount: centsToAmountText(input.amountCents),
    received_on: input.receivedOn ?? null,
    reference: cleanText(input.reference),
    notes: cleanText(input.notes),
    source: input.source ?? 'manual',
    external_ref: cleanText(input.externalRef),
    allocations: input.allocations
      .filter(line => line.amountCents > 0)
      .map(line => ({
        invoice_id: line.invoiceId,
        portion: line.portion,
        amount: centsToAmountText(line.amountCents),
        external_ref: cleanText(line.externalRef),
        ...chosenLines(line)
      })),
    shortfalls: (input.shortfalls ?? [])
      .filter(line => line.amountCents > 0)
      .map(line => ({
        invoice_id: line.invoiceId,
        amount: centsToAmountText(line.amountCents),
        reason: cleanText(line.reason),
        reason_code: cleanText(line.reasonCode),
        external_ref: cleanText(line.externalRef)
      })),
    write_offs: (input.writeOffs ?? [])
      .filter(line => line.amountCents > 0)
      .map(line => ({
        invoice_id: line.invoiceId,
        portion: line.portion,
        amount: centsToAmountText(line.amountCents),
        reason_code: line.reasonCode,
        reason: cleanText(line.reason),
        external_ref: cleanText(line.externalRef)
      }))
  };
}

export type AdjustmentInput =
  | {
      practiceId: string;
      kind: 'credit_note' | 'write_off' | 'journal' | 'shortfall_transfer' | 'discount';
      invoiceId: string;
      portion: Portion;
      /** Journals: negative takes off what is owed */
      amountCents: number;
      reason: string;
      reasonCode?: string | null;
      effectiveOn?: string | null;
      /** Idempotency key (unique per practice and kind): a small-balance run tags each write-off with its run */
      externalRef?: string | null;
      /** Discounts given as a percentage (10 = 10%); the database checks the amount is that percentage to the cent */
      percent?: number | null;
    }
  | {
      practiceId: string;
      kind: 'refund';
      receiptId: string;
      amountCents: number;
      method: RefundMethod;
      reason: string;
      effectiveOn?: string | null;
    };

/** ar_post_adjustment payload */
export function buildAdjustmentPayload(input: AdjustmentInput): Record<string, unknown> {
  const common = {
    practice_id: input.practiceId,
    kind: input.kind,
    amount: centsToAmountText(input.amountCents),
    reason: input.reason.trim(),
    effective_on: input.effectiveOn ?? null
  };
  if (input.kind === 'refund') {
    return { ...common, receipt_id: input.receiptId, method: input.method };
  }
  return {
    ...common,
    invoice_id: input.invoiceId,
    portion: input.kind === 'shortfall_transfer' ? 'medical_aid' : input.portion,
    reason_code: cleanText(input.reasonCode),
    external_ref: cleanText(input.externalRef),
    ...(input.kind === 'discount' && typeof input.percent === 'number' ? { percent: input.percent.toFixed(2) } : {})
  };
}

/** ar_allocate_receipt lines (allocating credit that is already on a receipt) */
export const buildAllocationLines = (lines: readonly AllocationLine[]): Array<Record<string, unknown>> =>
  lines
    .filter(line => line.amountCents > 0)
    .map(line => ({ invoice_id: line.invoiceId, portion: line.portion, amount: centsToAmountText(line.amountCents), ...chosenLines(line) }));
