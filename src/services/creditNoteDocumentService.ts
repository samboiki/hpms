/**
 * Loads a credit note and the invoice it credits and makes its PDF (buildCreditNoteDocument, drawn by the invoice's own
 * text PDF renderer). Read-only. The invoice part comes from loadInvoiceDocumentInput, the one invoice print loader.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { toCents } from '../utils/billing/money';
import { toDateKey } from '../utils/billing/dates';
import { loadInvoiceDocumentInput } from './invoiceDocumentService';
import { buildCreditNoteDocument } from '../components/billing/creditNoteDocument';
import { renderInvoicePdf } from '../components/billing/invoicePdf';
import { loadCreditNoteDetails } from '../components/finance/receipts/creditNoteService';
import { describeReversal } from '../components/finance/claims/claimCorrections';
import type { InvoiceDocument } from '../components/billing/invoiceDocument';

// invoice_adjustments is newer than src/types/database.types.ts
const db = supabase as unknown as SupabaseClient;

/** Saves the credit note's PDF on this device and returns the document drawn. */
export async function downloadCreditNotePdf(adjustmentId: string): Promise<InvoiceDocument> {
  const { data, error } = await db
    .from('invoice_adjustments')
    .select('id, adjustment_number, kind, portion, amount, reason, effective_on, invoice_id, reversed_at, reversal_reason')
    .eq('id', adjustmentId)
    .maybeSingle();
  if (error) throw new Error(`Could not read the credit note: ${error.message}`);
  const row = data as {
    adjustment_number: string; kind: string; portion: 'medical_aid' | 'patient' | null; amount: number | string; reason: string;
    effective_on: string | null; invoice_id: string | null; reversed_at: string | null; reversal_reason: string | null;
  } | null;
  if (!row || row.kind !== 'credit_note' || !row.invoice_id || !row.portion) throw new Error('The credit note could not be found.');

  const [invoice, details] = await Promise.all([loadInvoiceDocumentInput(row.invoice_id), loadCreditNoteDetails(row.invoice_id)]);
  const detail = details?.get(adjustmentId);
  const doc = buildCreditNoteDocument({
    invoice,
    creditNote: {
      number: row.adjustment_number,
      portion: row.portion,
      amountCents: toCents(Number(row.amount) || 0),
      reason: row.reason,
      issuedOn: toDateKey(row.effective_on),
      reversed: row.reversed_at ? { on: toDateKey(new Date(row.reversed_at)), reason: row.reversal_reason ?? '' } : null
    },
    lines: detail?.lines ?? [],
    fundNotes: [...new Set((detail?.reversals ?? []).map(describeReversal))]
  });
  renderInvoicePdf(doc).save(doc.fileName);
  return doc;
}
