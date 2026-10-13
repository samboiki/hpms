import { supabase } from '../lib/supabase';
import { isOpenBatch } from '../components/finance/claims/claimsService';
import { formatServiceDate } from './billing/dates';

/**
 * Why a visit's invoice can't simply be edited:
 * - 'paid' and 'claim-sent': money or a claim has left the practice; real practices correct these with a credit note.
 * - 'in-open-batch': medical aid invoices join the fund's unsent claim batch automatically, and the batch keeps its
 *   own copy of every billing line, so the lines must not change underneath it. The visit itself can still be reopened.
 */
export type InvoiceLock = 'paid' | 'claim-sent' | 'in-open-batch' | null;

interface InvoiceForLock {
  payment_status?: string | null;
  batch_id?: string | null;
}

interface BatchForLock {
  status: string | null;
  sent_at: string | null;
  batch_number?: number | null;
}

/** The sent claim batch an invoice is in: what the fund received. */
export interface SentClaim {
  batchId: string;
  /** batch_headers.batch_number; null when the batch could not be read */
  batchNumber: number | null;
  /** When the batch was sent; null when not known */
  sentAt: string | null;
}

/** The sent batch the invoice was claimed in, or null when it is in no batch or in one not sent yet. */
export function sentClaimOf(invoice: InvoiceForLock, batch?: BatchForLock | null): SentClaim | null {
  if (!invoice.batch_id) return null;
  // A batch we can't read is treated as sent, as for the lock
  if (batch && isOpenBatch(batch)) return null;
  return { batchId: invoice.batch_id, batchNumber: batch?.batch_number ?? null, sentAt: batch?.sent_at ?? null };
}

/**
 * What an invoice editing screen says before a change to a claimed invoice is saved. Since 2026-10-08 the database
 * leaves an invoice in a sent batch exactly as the fund received it (sync_invoice_to_batch,
 * proposals/2026-10-08-claim-sent-batches.sql), so no change reaches the fund by itself.
 */
export function claimedInvoiceNotice(claim: SentClaim): string {
  const batch = claim.batchNumber !== null ? `batch ${claim.batchNumber}` : 'a claim batch';
  const sentOn = claim.sentAt ? formatServiceDate(new Date(claim.sentAt)) : '-';
  return `Already claimed in ${batch}${sentOn !== '-' ? ` on ${sentOn}` : ''}: this change is not sent to the fund. Use a credit note, or correct the line in its batch and send it again.`;
}

export function getInvoiceLock(invoice: InvoiceForLock, batch?: BatchForLock | null): InvoiceLock {
  // 'partial' is set by receipts: money was received against the invoice, so it is locked like a paid one
  if (invoice.payment_status === 'paid' || invoice.payment_status === 'partial') return 'paid';
  if (!invoice.batch_id) return null;
  // A batch we can't read is treated as sent, so an unknown state never unlocks an invoice
  return batch && isOpenBatch(batch) ? 'in-open-batch' : 'claim-sent';
}

/** True when the visit can't go back from Completed: the invoice is paid or its claim was sent. */
export const blocksReopen = (lock: InvoiceLock): boolean => lock === 'paid' || lock === 'claim-sent';

/** Why the invoice is locked and what to do instead; callers say which action was refused. */
export const INVOICE_LOCK_MESSAGES: Record<Exclude<InvoiceLock, null>, string> = {
  paid: 'Money was already received against the invoice. Correct it with a credit note.',
  'claim-sent': 'The invoice was already sent to the medical aid. Correct it with a credit note.',
  'in-open-batch': 'The invoice is waiting in an unsent medical aid claim batch. Remove it from the batch in Finance > Batches first.'
};

/** Loads the visit's invoices with the lock that applies to each one, and the sent batch each was claimed in. */
export async function loadVisitInvoiceLocks(visitId: string): Promise<Array<{ id: string; lock: InvoiceLock; claim: SentClaim | null }>> {
  return loadLocks('visit_id', visitId);
}

/** Loads the lock that applies to one invoice (null when it is unlocked or no longer exists). */
export async function loadInvoiceLock(invoiceId: string): Promise<InvoiceLock> {
  return (await loadLocks('id', invoiceId))[0]?.lock ?? null;
}

async function loadLocks(column: 'id' | 'visit_id', value: string): Promise<Array<{ id: string; lock: InvoiceLock; claim: SentClaim | null }>> {
  const { data: invoices, error } = await supabase
    .from('invoices_enhanced')
    .select('id, payment_status, batch_id')
    .eq(column, value);
  if (error) throw error;

  const batchIds = [...new Set((invoices || []).map(invoice => invoice.batch_id).filter((id): id is string => !!id))];
  let batches: Array<BatchForLock & { id: string }> = [];
  if (batchIds.length > 0) {
    const { data, error: batchError } = await supabase
      .from('batch_headers')
      .select('id, status, sent_at, batch_number')
      .in('id', batchIds);
    if (batchError) throw batchError;
    batches = data || [];
  }

  return (invoices || []).map(invoice => {
    const batch = batches.find(item => item.id === invoice.batch_id);
    return { id: invoice.id, lock: getInvoiceLock(invoice, batch), claim: sentClaimOf(invoice, batch) };
  });
}
