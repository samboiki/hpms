import { dateKeyFrom } from './dates';
import {
  ADJUSTMENT_LABELS,
  RECEIPT_METHOD_LABELS,
  type ArAdjustment,
  type ArAllocation,
  type ArReceipt,
  type PortionCents
} from './arModel';
import { coverCodes } from './allocationLines';
import { discountReasonText } from './discounts';

// ---------------------------------------------------------------------------------------------
// Patient account statement: invoices, receipts and adjustments in date order with a running
// balance per portion. Built by replaying the entries, so a reversal shows on the day it was made
// and the closing balance always equals what the invoices still owe less the credit on account.
// ---------------------------------------------------------------------------------------------

export interface StatementInvoice {
  id: string;
  invoiceNumber: string;
  /** yyyy-MM-dd */
  dateKey: string | null;
  billed: PortionCents;
  cancelled: boolean;
  /** On a family statement: whose invoice it is (shown after the invoice number) */
  patientLabel?: string | null;
  /** The funds' authorisation numbers on the invoice's lines (parity D15), shown with the invoice */
  authorisations?: readonly string[];
}

export interface StatementInput {
  patientId: string;
  /** A family account: the patients the account holder (patientId) pays for. Their own receipts are the account's too */
  memberIds?: readonly string[];
  invoices: readonly StatementInvoice[];
  /** The patient's own receipts and any receipt with an allocation to the patient's invoices */
  receipts: readonly ArReceipt[];
  allocations: readonly ArAllocation[];
  /** Adjustments of the patient's invoices and refunds of the patient's receipts */
  adjustments: readonly ArAdjustment[];
}

export type StatementLineKind =
  | 'opening'
  | 'invoice'
  | 'receipt'
  | 'payment'
  | 'credit_used'
  | 'payment_reversed'
  | 'receipt_reversed'
  | 'credit_note'
  | 'write_off'
  | 'journal'
  | 'shortfall_transfer'
  | 'refund'
  | 'adjustment_reversed'
  | 'discount';

export interface StatementBalance {
  medicalAid: number;
  patient: number;
  /** Money received and not yet allocated (credit on the account) */
  credit: number;
  /** medicalAid + patient - credit: what the account owes overall */
  total: number;
}

export interface StatementLine {
  key: string;
  dateKey: string;
  kind: StatementLineKind;
  reference: string;
  description: string;
  /** A payment: the invoice line codes it covered ("0190, 8101"), when known */
  covered?: string;
  /** An invoice: the authorisation numbers on its lines, when any */
  authorisations?: string[];
  /**
   * The records the line is about, so a statement on screen can open them: the account's invoice it is on (an
   * invoice, a credit note, discount, write-off, correction or transfer on it, a payment of it) and the receipt it
   * comes from (a receipt, a payment, credit used, a refund and their reversals). Never on a printed statement.
   */
  invoiceId?: string;
  receiptId?: string;
  /** Changes in cents: positive means more is owed (or more credit held) */
  medicalAid: number;
  patient: number;
  credit: number;
  balance: StatementBalance;
}

export interface Statement {
  lines: StatementLine[];
  closing: StatementBalance;
}

interface PendingLine {
  dateKey: string;
  /** Tie-breaker within a day: when it was recorded */
  at: string;
  order: number;
  kind: StatementLineKind;
  reference: string;
  description: string;
  covered?: string;
  authorisations?: string[];
  invoiceId?: string;
  receiptId?: string;
  medicalAid: number;
  patient: number;
  credit: number;
}

/** The invoice line codes these allocations covered ("0190, 8101"); empty when not known */
const coveredBy = (allocations: readonly ArAllocation[]): string => coverCodes(allocations.flatMap(allocation => allocation.covers ?? []));

const ORDER: Record<StatementLineKind, number> = {
  opening: 0,
  invoice: 1,
  journal: 2,
  shortfall_transfer: 3,
  receipt: 4,
  payment: 5,
  credit_used: 6,
  credit_note: 7,
  discount: 8,
  write_off: 9,
  refund: 10,
  payment_reversed: 11,
  receipt_reversed: 12,
  adjustment_reversed: 13
};

/** "authorisation 12345" / "authorisations 12345, 67890"; empty without any */
const authorisationText = (numbers: readonly string[]): string =>
  numbers.length === 0 ? '' : `, authorisation${numbers.length === 1 ? '' : 's'} ${numbers.join(', ')}`;

const balanceOf = (medicalAid: number, patient: number, credit: number): StatementBalance => ({
  medicalAid,
  patient,
  credit,
  total: medicalAid + patient - credit
});

/**
 * Builds the statement. A receipt from the patient (or paid on their account) shows once, with
 * what it paid on each portion and what stayed as credit; a medical aid's lump sum shows only the
 * part paid on this patient's invoices. Pass `fromKey` to start at a date with an opening balance.
 */
export function buildStatement(input: StatementInput, options: { fromKey?: string | null } = {}): Statement {
  const invoiceNumbers = new Map(input.invoices.map(invoice => [invoice.id, invoice.invoiceNumber]));
  const accountPatients = new Set([input.patientId, ...(input.memberIds ?? [])]);
  const ownReceipts = new Map(input.receipts.filter(receipt => !!receipt.patientId && accountPatients.has(receipt.patientId)).map(receipt => [receipt.id, receipt]));
  const allReceipts = new Map(input.receipts.map(receipt => [receipt.id, receipt]));
  const pending: PendingLine[] = [];
  const invoiceLabel = (invoiceId: string | null) => (invoiceId && invoiceNumbers.get(invoiceId)) || 'another invoice';

  for (const invoice of input.invoices) {
    if (invoice.cancelled || !invoice.dateKey) continue;
    const authorisations = [...new Set((invoice.authorisations ?? []).map(number => number.trim()).filter(Boolean))];
    pending.push({
      dateKey: invoice.dateKey, at: '', order: ORDER.invoice, kind: 'invoice', reference: invoice.invoiceNumber,
      description: `Invoice ${invoice.invoiceNumber}${invoice.patientLabel ? ` (${invoice.patientLabel})` : ''}${authorisationText(authorisations)}`,
      ...(authorisations.length > 0 ? { authorisations } : {}),
      invoiceId: invoice.id,
      medicalAid: invoice.billed.medical_aid, patient: invoice.billed.patient, credit: 0
    });
  }

  // Own receipts: one line with the allocations posted with it (same transaction, same created_at)
  for (const receipt of ownReceipts.values()) {
    const postedWith = input.allocations.filter(allocation => allocation.receiptId === receipt.id && allocation.createdAt === receipt.createdAt);
    const onAccount = postedWith.filter(a => invoiceNumbers.has(a.invoiceId));
    const medicalAid = onAccount.filter(a => a.portion === 'medical_aid').reduce((sum, a) => sum + a.amountCents, 0);
    const patient = onAccount.filter(a => a.portion === 'patient').reduce((sum, a) => sum + a.amountCents, 0);
    const allocatedWith = postedWith.reduce((sum, a) => sum + a.amountCents, 0);
    // What it paid on this account's invoice lines (a fund's lump sum: only this patient's lines)
    const covered = coveredBy(onAccount);
    pending.push({
      dateKey: receipt.receivedOn ?? dateKeyFrom(receipt.createdAt) ?? '0000-00-00',
      at: receipt.createdAt ?? '',
      order: ORDER.receipt,
      kind: 'receipt',
      reference: receipt.number,
      description: `Receipt ${receipt.number} (${RECEIPT_METHOD_LABELS[receipt.method].toLowerCase()})${receipt.payerType === 'medical_aid' && receipt.fundName ? `, paid by ${receipt.fundName}` : ''}${covered ? `, for ${covered}` : ''}`,
      ...(covered ? { covered } : {}),
      receiptId: receipt.id,
      medicalAid: -medicalAid,
      patient: -patient,
      credit: receipt.amountCents - allocatedWith
    });
    if (receipt.reversal) {
      // Its allocations still standing are reversed with it (they go back onto the invoices) and
      // whatever credit it still held disappears, so the account owes the full receipt again
      const reversedAt = receipt.reversal.at;
      const standingBefore = (entry: { reversal: { at: string } | null }) => !entry.reversal || entry.reversal.at >= reversedAt;
      const withReceipt = input.allocations.filter(a => a.receiptId === receipt.id && standingBefore(a));
      const ma = withReceipt.filter(a => a.portion === 'medical_aid' && invoiceNumbers.has(a.invoiceId)).reduce((sum, a) => sum + a.amountCents, 0);
      const pt = withReceipt.filter(a => a.portion === 'patient' && invoiceNumbers.has(a.invoiceId)).reduce((sum, a) => sum + a.amountCents, 0);
      const allocatedBefore = withReceipt.reduce((sum, a) => sum + a.amountCents, 0);
      const refundedBefore = input.adjustments
        .filter(d => d.kind === 'refund' && d.receiptId === receipt.id && standingBefore(d))
        .reduce((sum, d) => sum + d.amountCents, 0);
      pending.push({
        dateKey: dateKeyFrom(reversedAt) ?? '0000-00-00',
        at: reversedAt,
        order: ORDER.receipt_reversed,
        kind: 'receipt_reversed',
        reference: receipt.number,
        description: `Receipt ${receipt.number} reversed: ${receipt.reversal.reason}`,
        receiptId: receipt.id,
        medicalAid: ma,
        patient: pt,
        credit: -(receipt.amountCents - allocatedBefore - refundedBefore)
      });
    }
  }

  // Allocations not posted with their receipt line
  for (const allocation of input.allocations) {
    if (!invoiceNumbers.has(allocation.invoiceId) && !ownReceipts.has(allocation.receiptId)) continue;
    const receipt = allReceipts.get(allocation.receiptId);
    const own = ownReceipts.has(allocation.receiptId);
    const onThisAccount = invoiceNumbers.has(allocation.invoiceId);
    const portionDelta = (sign: 1 | -1) => ({
      medicalAid: onThisAccount && allocation.portion === 'medical_aid' ? sign * allocation.amountCents : 0,
      patient: onThisAccount && allocation.portion === 'patient' ? sign * allocation.amountCents : 0
    });
    const reference = receipt?.number ?? 'Receipt';
    // The payment opens its receipt; the invoice it paid only when that invoice is this account's
    const records = { receiptId: allocation.receiptId, ...(onThisAccount ? { invoiceId: allocation.invoiceId } : {}) };
    const postedWithReceipt = own && receipt !== undefined && allocation.createdAt === receipt.createdAt;
    if (!postedWithReceipt) {
      const covered = onThisAccount ? coveredBy([allocation]) : '';
      pending.push({
        dateKey: dateKeyFrom(allocation.createdAt) ?? receipt?.receivedOn ?? '0000-00-00',
        at: allocation.createdAt ?? '',
        order: own ? ORDER.credit_used : ORDER.payment,
        kind: own ? 'credit_used' : 'payment',
        reference,
        description: (own
          ? `Credit from ${reference} used for invoice ${invoiceLabel(allocation.invoiceId)}`
          : `${receipt?.payerType === 'medical_aid' ? receipt.fundName ?? 'Medical aid' : receipt?.payerName ?? 'Payment'} paid invoice ${invoiceLabel(allocation.invoiceId)} (${reference})`)
          + (covered ? `, for ${covered}` : ''),
        ...(covered ? { covered } : {}),
        ...records,
        ...portionDelta(-1),
        credit: own ? -allocation.amountCents : 0
      });
    }
    // A reversal on its own (the receipt's own reversal line covers allocations reversed with it)
    const reversedWithReceipt = own && receipt?.reversal && allocation.reversal?.at === receipt.reversal.at;
    if (allocation.reversal && !reversedWithReceipt) {
      pending.push({
        dateKey: dateKeyFrom(allocation.reversal.at) ?? '0000-00-00',
        at: allocation.reversal.at,
        order: ORDER.payment_reversed,
        kind: 'payment_reversed',
        reference,
        description: `Payment ${reference} taken off invoice ${invoiceLabel(allocation.invoiceId)}: ${allocation.reversal.reason}`,
        ...records,
        ...portionDelta(1),
        credit: own ? allocation.amountCents : 0
      });
    }
  }

  for (const adjustment of input.adjustments) {
    const isRefund = adjustment.kind === 'refund';
    if (isRefund ? !(adjustment.receiptId && ownReceipts.has(adjustment.receiptId)) : !(adjustment.invoiceId && invoiceNumbers.has(adjustment.invoiceId))) continue;
    const effect = { medicalAid: 0, patient: 0, credit: 0 };
    if (isRefund) effect.credit = -adjustment.amountCents;
    else if (adjustment.kind === 'shortfall_transfer') {
      effect.medicalAid = -adjustment.amountCents;
      effect.patient = adjustment.amountCents;
    } else if (adjustment.portion) {
      const delta = adjustment.kind === 'journal' ? adjustment.amountCents : -adjustment.amountCents;
      if (adjustment.portion === 'medical_aid') effect.medicalAid = delta;
      else effect.patient = delta;
    }
    const subject = isRefund
      ? `${ADJUSTMENT_LABELS.refund} ${adjustment.number}${adjustment.method ? ` (${RECEIPT_METHOD_LABELS[adjustment.method].toLowerCase()})` : ''}`
      : `${ADJUSTMENT_LABELS[adjustment.kind]} ${adjustment.number} on invoice ${invoiceLabel(adjustment.invoiceId)}`;
    // A discount says why it was given in the practice's words ("Discount DS-000001 on invoice INV-1: Pensioner")
    const reason = adjustment.kind === 'discount' ? discountReasonText(adjustment) : adjustment.reason;
    // A refund opens the receipt it paid back; every other adjustment the invoice it is on
    const records = isRefund ? { receiptId: adjustment.receiptId ?? undefined } : { invoiceId: adjustment.invoiceId ?? undefined };
    pending.push({
      dateKey: adjustment.effectiveOn ?? dateKeyFrom(adjustment.createdAt) ?? '0000-00-00',
      at: adjustment.createdAt ?? '',
      order: ORDER[adjustment.kind],
      kind: adjustment.kind,
      reference: adjustment.number,
      description: reason ? `${subject}: ${reason}` : subject,
      ...records,
      ...effect
    });
    if (adjustment.reversal) {
      pending.push({
        dateKey: dateKeyFrom(adjustment.reversal.at) ?? '0000-00-00',
        at: adjustment.reversal.at,
        order: ORDER.adjustment_reversed,
        kind: 'adjustment_reversed',
        reference: adjustment.number,
        description: `${ADJUSTMENT_LABELS[adjustment.kind]} ${adjustment.number} reversed: ${adjustment.reversal.reason}`,
        ...records,
        medicalAid: -effect.medicalAid,
        patient: -effect.patient,
        credit: -effect.credit
      });
    }
  }

  pending.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.at.localeCompare(b.at) || a.order - b.order || a.reference.localeCompare(b.reference));

  const lines: StatementLine[] = [];
  let medicalAid = 0, patient = 0, credit = 0;
  const fromKey = options.fromKey ?? null;
  let openingDone = fromKey === null;
  pending.forEach((line, index) => {
    if (!openingDone && fromKey !== null && line.dateKey >= fromKey) {
      lines.push({
        key: 'opening', dateKey: fromKey, kind: 'opening', reference: '', description: 'Balance brought forward',
        medicalAid, patient, credit, balance: balanceOf(medicalAid, patient, credit)
      });
      openingDone = true;
    }
    medicalAid += line.medicalAid;
    patient += line.patient;
    credit += line.credit;
    if (fromKey !== null && line.dateKey < fromKey) return;
    lines.push({
      key: `${line.kind}-${line.reference}-${index}`,
      dateKey: line.dateKey,
      kind: line.kind,
      reference: line.reference,
      description: line.description,
      ...(line.covered ? { covered: line.covered } : {}),
      ...(line.authorisations ? { authorisations: line.authorisations } : {}),
      ...(line.invoiceId ? { invoiceId: line.invoiceId } : {}),
      ...(line.receiptId ? { receiptId: line.receiptId } : {}),
      medicalAid: line.medicalAid,
      patient: line.patient,
      credit: line.credit,
      balance: balanceOf(medicalAid, patient, credit)
    });
  });
  if (!openingDone && fromKey !== null) {
    lines.push({
      key: 'opening', dateKey: fromKey, kind: 'opening', reference: '', description: 'Balance brought forward',
      medicalAid, patient, credit, balance: balanceOf(medicalAid, patient, credit)
    });
  }
  return { lines, closing: balanceOf(medicalAid, patient, credit) };
}

/**
 * What a statement line opens on screen: the payment it comes from (a receipt, a fund's payment, credit used, a refund
 * and their reversals), else the invoice it is on (the invoice, a credit note, discount, write-off, correction or
 * transfer). The balance brought forward opens nothing.
 */
export function statementLineOpens(line: Pick<StatementLine, 'invoiceId' | 'receiptId'>): { kind: 'receipt' | 'invoice'; id: string } | null {
  if (line.receiptId) return { kind: 'receipt', id: line.receiptId };
  if (line.invoiceId) return { kind: 'invoice', id: line.invoiceId };
  return null;
}
