import { supabase } from '../lib/supabase';
import { isOpenBatch } from '../components/finance/claims/claimsService';

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
}

export function getInvoiceLock(invoice: InvoiceForLock, batch?: BatchForLock | null): InvoiceLock {
  if (invoice.payment_status === 'paid') return 'paid';
  if (!invoice.batch_id) return null;
  // A batch we can't read is treated as sent, so an unknown state never unlocks an invoice
  return batch && isOpenBatch(batch) ? 'in-open-batch' : 'claim-sent';
}

/** True when the visit can't go back from Completed: the invoice is paid or its claim was sent. */
export const blocksReopen = (lock: InvoiceLock): boolean => lock === 'paid' || lock === 'claim-sent';

/** Why the invoice is locked and what to do instead; callers say which action was refused. */
export const INVOICE_LOCK_MESSAGES: Record<Exclude<InvoiceLock, null>, string> = {
  paid: 'The invoice is already paid. Correct it with a credit note.',
  'claim-sent': 'The invoice was already sent to the medical aid. Correct it with a credit note.',
  'in-open-batch': 'The invoice is waiting in an unsent medical aid claim batch. Remove it from the batch in Finance > Batches first.'
};

/** Loads the visit's invoices with the lock that applies to each one. */
export async function loadVisitInvoiceLocks(visitId: string): Promise<Array<{ id: string; lock: InvoiceLock }>> {
  return loadLocks('visit_id', visitId);
}

/** Loads the lock that applies to one invoice (null when it is unlocked or no longer exists). */
export async function loadInvoiceLock(invoiceId: string): Promise<InvoiceLock> {
  return (await loadLocks('id', invoiceId))[0]?.lock ?? null;
}

async function loadLocks(column: 'id' | 'visit_id', value: string): Promise<Array<{ id: string; lock: InvoiceLock }>> {
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
      .select('id, status, sent_at')
      .in('id', batchIds);
    if (batchError) throw batchError;
    batches = data || [];
  }

  return (invoices || []).map(invoice => ({
    id: invoice.id,
    lock: getInvoiceLock(invoice, batches.find(batch => batch.id === invoice.batch_id))
  }));
}
