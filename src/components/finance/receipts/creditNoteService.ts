/**
 * Data access for credit notes line by line (parity D24, F16): an invoice's lines with what is left to credit and
 * whether the fund was sent them, saving a credit note (credit_note_post_lines), and the credited lines and reversals
 * of an invoice's credit notes (the invoice screen and the printed credit note). Everything is in
 * proposals/2026-10-09-claim-corrections.sql; before it is applied the loaders say 'not_set_up' and the invoice keeps
 * the credit note per portion.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { toCents } from '../../../utils/billing/money';
import { toDateKey } from '../../../utils/billing/dates';
import { ArQueryError, isArNotSetUp } from './arService';
import { isCreditBatch, isSentClaimBatch, serviceKeyOf } from '../claims/claimCorrections';
import { loadReversals, type ReversalRow } from '../claims/claimCorrectionsService';
import { isOpenBatch } from '../claims/status';
import type { Portion } from '../../../services/ledgerService';
import type { CreditableLine } from './creditNoteLines';

// The new tables and the RPC are newer than src/types/database.types.ts
const db = supabase as unknown as SupabaseClient;

type DbError = { code?: string; message: string };

const cents = (value: number | string | null | undefined): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? toCents(number) : 0;
};

const check = <T>(label: string, result: { data: T[] | null; error: DbError | null }): T[] => {
  if (result.error) throw new ArQueryError(label, result.error);
  return result.data ?? [];
};

interface InvoiceLineRow {
  id: string;
  code: string | null;
  description: string | null;
  service_date: string | null;
  tooth_number: string | null;
  quantity: number | string | null;
  total_price: number | string | null;
  medical_aid_covered: number | string | null;
  patient_portion: number | string | null;
  system_transaction_number: number | null;
}

interface BatchRow {
  id: string;
  batch_number: number;
  status: string | null;
  sent_at: string | null;
  transaction_type: string | null;
  created_at: string | null;
}

interface CreditLineRow {
  id: string;
  adjustment_id: string;
  invoice_line_id: string | null;
  system_transaction_number: number | null;
  portion: Portion;
  amount: number | string;
  quantity: number | string;
  line_code: string;
  line_description: string | null;
  service_date: string | null;
  tooth_number: string | null;
  unit_price: number | string | null;
}

/** Credit note lines of an invoice, with the ids of the credit notes since reversed */
async function loadCreditLines(invoiceId: string): Promise<{ rows: CreditLineRow[]; reversed: Set<string> }> {
  const rows = check<CreditLineRow>('the credited lines', await db.from('credit_note_lines')
    .select('id, adjustment_id, invoice_line_id, system_transaction_number, portion, amount, quantity, line_code, line_description, service_date, tooth_number, unit_price')
    .eq('invoice_id', invoiceId).order('created_at'));
  const adjustmentIds = [...new Set(rows.map(row => row.adjustment_id))];
  const reversed = adjustmentIds.length === 0 ? [] : check<{ id: string }>('the credit notes', await db.from('invoice_adjustments')
    .select('id').in('id', adjustmentIds).not('reversed_at', 'is', null));
  return { rows, reversed: new Set(reversed.map(row => row.id)) };
}

export type CreditableLoad = { state: 'ready'; lines: CreditableLine[] } | { state: 'not_set_up' };

/**
 * The invoice's lines as the credit note screen offers them: what is left to credit (credit notes not reversed taken
 * off), the sent batch the fund received each line in (its latest claim: a credit on it gets a reversal) and the
 * unsent batch a line still waits in.
 */
export async function loadCreditableLines(invoiceId: string): Promise<CreditableLoad> {
  try {
    const [lineRows, credits, claimRows] = await Promise.all([
      db.from('invoice_services')
        .select('id, code, description, service_date, tooth_number, quantity, total_price, medical_aid_covered, patient_portion, system_transaction_number')
        .eq('invoice_id', invoiceId).order('system_transaction_number', { ascending: true }),
      loadCreditLines(invoiceId),
      db.from('batch_details').select('id, batch_header_id, system_transaction_number').eq('invoice_id', invoiceId)
    ]);
    const lines = check<InvoiceLineRow>('the invoice lines', lineRows);
    const claims = check<{ id: string; batch_header_id: string | null; system_transaction_number: number | null }>('the claim lines', claimRows);
    const batchIds = [...new Set(claims.map(row => row.batch_header_id).filter((id): id is string => !!id))];
    const batches = batchIds.length === 0 ? [] : check<BatchRow>(
      'the claim batches', await db.from('batch_headers').select('id, batch_number, status, sent_at, transaction_type, created_at').in('id', batchIds));
    const batchById = new Map(batches.map(batch => [batch.id, batch]));
    const batchesOf = (key: string | null): BatchRow[] =>
      claims
        .filter(claim => key !== null && serviceKeyOf(invoiceId, claim.system_transaction_number) === key)
        .map(claim => (claim.batch_header_id ? batchById.get(claim.batch_header_id) : undefined))
        .filter((batch): batch is BatchRow => batch !== undefined);

    return {
      state: 'ready',
      lines: lines.map(row => {
        const key = serviceKeyOf(invoiceId, row.system_transaction_number);
        const credited = credits.rows
          .filter(credit => !credits.reversed.has(credit.adjustment_id))
          .filter(credit => credit.invoice_line_id === row.id || (key !== null && serviceKeyOf(invoiceId, credit.system_transaction_number) === key))
          .reduce((sum, credit) => sum + cents(credit.amount), 0);
        const held = batchesOf(key);
        // The latest claim the fund received of this line, and an unsent batch it still waits in
        const sent = held.filter(isSentClaimBatch).sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? ''))[0];
        const waiting = held.find(batch => isOpenBatch(batch) && !isCreditBatch(batch));
        return {
          id: row.id,
          code: (row.code ?? '').trim(),
          description: (row.description ?? '').trim(),
          serviceDate: toDateKey(row.service_date),
          tooth: (row.tooth_number ?? '').trim() || null,
          quantity: Number(row.quantity ?? 1) || 1,
          totalCents: cents(row.total_price),
          medicalAidCents: cents(row.medical_aid_covered),
          patientCents: cents(row.patient_portion),
          creditedCents: credited,
          claimedIn: sent ? { batchId: sent.id, batchNumber: sent.batch_number } : null,
          waitingIn: waiting ? waiting.batch_number : null
        };
      })
    };
  } catch (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up' };
    throw error;
  }
}

export interface SavedCreditNote {
  id: string;
  number: string;
  portion: Portion;
  amountCents: number;
}

/** Saves the credit note: one per portion touched; reversals are queued for lines the fund was sent */
export async function postCreditNoteLines(input: { practiceId: string; invoiceId: string; reason: string; lines: Array<{ invoice_line_id: string; amount: string }> }): Promise<{ creditNotes: SavedCreditNote[]; reversals: number }> {
  const { data, error } = await db.rpc('credit_note_post_lines', {
    p_payload: { practice_id: input.practiceId, invoice_id: input.invoiceId, reason: input.reason.trim(), lines: input.lines }
  });
  if (error) {
    if (isArNotSetUp(error)) throw new Error('Credit notes per line are not set up in this database yet (proposals/2026-10-09-claim-corrections.sql).');
    throw new Error(error.message || 'The credit note could not be saved');
  }
  const result = data as { credit_notes: Array<{ id: string; number: string; portion: Portion; amount: number | string }>; reversals: number };
  return {
    creditNotes: (result.credit_notes ?? []).map(note => ({ id: note.id, number: note.number, portion: note.portion, amountCents: cents(note.amount) })),
    reversals: result.reversals ?? 0
  };
}

/** One credited line, as the credit note shows and prints it */
export interface CreditedLine {
  invoiceLineId: string | null;
  code: string;
  description: string;
  /** yyyy-MM-dd */
  serviceDate: string | null;
  tooth: string | null;
  quantity: number;
  unitPriceCents: number | null;
  amountCents: number;
}

export interface CreditNoteDetail {
  lines: CreditedLine[];
  /** Reversals of claimed lines this credit note asked the fund for */
  reversals: ReversalRow[];
}

/**
 * The lines and reversals of an invoice's credit notes, by credit note (adjustment) id. Credit notes made per portion
 * (before lines) have none. Null while credit notes per line are not set up.
 */
export async function loadCreditNoteDetails(invoiceId: string): Promise<Map<string, CreditNoteDetail> | null> {
  try {
    const [{ rows }, reversals] = await Promise.all([loadCreditLines(invoiceId), loadReversals({ invoiceIds: [invoiceId] })]);
    const details = new Map<string, CreditNoteDetail>();
    const detailOf = (id: string): CreditNoteDetail => {
      const existing = details.get(id) ?? { lines: [], reversals: [] };
      details.set(id, existing);
      return existing;
    };
    rows.forEach(row => detailOf(row.adjustment_id).lines.push({
      invoiceLineId: row.invoice_line_id,
      code: row.line_code,
      description: (row.line_description ?? '').trim(),
      serviceDate: toDateKey(row.service_date),
      tooth: (row.tooth_number ?? '').trim() || null,
      quantity: Number(row.quantity) || 1,
      unitPriceCents: row.unit_price === null ? null : cents(row.unit_price),
      amountCents: cents(row.amount)
    }));
    (reversals ?? []).forEach(reversal => detailOf(reversal.adjustmentId).reversals.push(reversal));
    return details;
  } catch (error) {
    if (isArNotSetUp(error)) return null;
    throw error;
  }
}
