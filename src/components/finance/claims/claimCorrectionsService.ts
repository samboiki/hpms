/**
 * Data access for claims after sending (parity D23, F9, F16): reversals and where they stand (claim_reversal_states),
 * putting a fund's reversals in its credit file, correcting a sent line and sending unpaid lines again, and the rows the
 * "Unpaid lines" list and "Correct and resend" need. Every write is one RPC of proposals/2026-10-09-claim-corrections.sql,
 * which checks the caller and every rule again. Before that file is applied the loaders return null ("not set up").
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { toCents } from '../../../utils/billing/money';
import { toDateKey } from '../../../utils/billing/dates';
import { ArQueryError, isArNotSetUp } from '../receipts/arService';
import { loadLineOutcomes } from './claimsService';
import { sentFileFields } from './claimReport';
import { loadPractitionerBilling } from '../../../services/practitionerBillingService';
import { isCreditBatch, isReversalState, isSentClaimBatch, serviceKeyOf, type CorrectionBilling, type ReversalState, type SentClaimLine, type UnpaidLinesInput } from './claimCorrections';
import { isOpenBatch, type ClaimLineOutcome } from './status';
import type { BatchHeaderRow } from './types';

// The tables, view and functions are newer than src/types/database.types.ts
const db = supabase as unknown as SupabaseClient;
const CHUNK = 100;

type DbError = { code?: string; message: string };
type Rows<T> = PromiseLike<{ data: T[] | null; error: DbError | null }>;

async function inChunks<T>(ids: readonly string[], label: string, query: (chunk: string[]) => Rows<T>): Promise<T[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows: T[] = [];
  for (let start = 0; start < unique.length; start += CHUNK) {
    const { data, error } = await query(unique.slice(start, start + CHUNK));
    if (error) throw new ArQueryError(label, error);
    rows.push(...(data ?? []));
  }
  return rows;
}

const cents = (value: number | string | null | undefined): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? toCents(number) : 0;
};

async function rpc<T>(name: string, args: Record<string, unknown>, action: string): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) {
    if (isArNotSetUp(error)) throw new Error('Claim corrections are not set up in this database yet (proposals/2026-10-09-claim-corrections.sql).');
    throw new Error(error.message || `${action} failed`);
  }
  return data as T;
}

// ---------------------------------------------------------------------------------------------
// Reversals
// ---------------------------------------------------------------------------------------------

/** A credit on a line the fund was sent, and where its reversal stands */
export interface ReversalRow {
  id: string;
  adjustmentId: string;
  /** The credit note's number (CN-) */
  creditNoteNumber: string;
  invoiceId: string;
  patientId: string | null;
  /** The claim line the fund received, and its batch */
  claimLineId: string;
  claimBatchId: string;
  claimBatchNumber: number | null;
  fundReference: string;
  amountCents: number;
  lineCode: string;
  /** The credit file it went into (batch with transaction type C), and its line there */
  creditBatchId: string | null;
  creditBatchNumber: number | null;
  creditSentAt: string | null;
  creditLineId: string | null;
  state: ReversalState;
}

interface RawReversal {
  id: string;
  adjustment_id: string;
  adjustment_number: string | null;
  invoice_id: string;
  patient_id: string | null;
  claim_line_id: string;
  claim_batch_id: string;
  claim_batch_number: number | null;
  fund_reference: string;
  amount: number | string;
  line_code: string | null;
  batch_id: string | null;
  credit_batch_number: number | null;
  credit_sent_at: string | null;
  batch_line_id: string | null;
  state: string;
}

const REVERSAL_COLUMNS =
  'id, adjustment_id, adjustment_number, invoice_id, patient_id, claim_line_id, claim_batch_id, claim_batch_number, fund_reference, amount, line_code, batch_id, credit_batch_number, credit_sent_at, batch_line_id, state';

const toReversal = (row: RawReversal): ReversalRow | null =>
  isReversalState(row.state)
    ? {
        id: row.id,
        adjustmentId: row.adjustment_id,
        creditNoteNumber: row.adjustment_number ?? '',
        invoiceId: row.invoice_id,
        patientId: row.patient_id,
        claimLineId: row.claim_line_id,
        claimBatchId: row.claim_batch_id,
        claimBatchNumber: row.claim_batch_number,
        fundReference: row.fund_reference,
        amountCents: cents(row.amount),
        lineCode: (row.line_code ?? '').trim(),
        creditBatchId: row.batch_id,
        creditBatchNumber: row.credit_batch_number,
        creditSentAt: row.credit_sent_at,
        creditLineId: row.batch_line_id,
        state: row.state
      }
    : null;

export type ReversalFilter =
  | { practiceQueued: string }
  | { claimBatchIds: readonly string[] }
  | { creditBatchIds: readonly string[] }
  | { invoiceIds: readonly string[] };

/**
 * Reversals by what they belong to: a practice's queued ones (waiting for a credit file), the claim batches whose
 * lines they reverse, the credit files they went into, or invoices. Null while the corrections are not set up.
 */
export async function loadReversals(filter: ReversalFilter): Promise<ReversalRow[] | null> {
  try {
    let rows: RawReversal[];
    if ('practiceQueued' in filter) {
      const { data, error } = await db.from('claim_reversal_states').select(REVERSAL_COLUMNS)
        .eq('practice_id', filter.practiceQueued).eq('state', 'queued').order('created_at').limit(1000);
      if (error) throw new ArQueryError('the reversals waiting to be sent', error);
      rows = (data ?? []) as RawReversal[];
    } else {
      const [column, ids] = 'claimBatchIds' in filter
        ? ['claim_batch_id', filter.claimBatchIds] as const
        : 'creditBatchIds' in filter ? ['batch_id', filter.creditBatchIds] as const : ['invoice_id', filter.invoiceIds] as const;
      rows = await inChunks<RawReversal>(ids, 'the reversals', chunk => db.from('claim_reversal_states').select(REVERSAL_COLUMNS).in(column, chunk) as unknown as Rows<RawReversal>);
    }
    return rows.map(toReversal).filter((row): row is ReversalRow => row !== null);
  } catch (error) {
    if (isArNotSetUp(error)) return null;
    throw error;
  }
}

export interface CreditFileResult {
  batchId: string | null;
  batchNumber: number | null;
  added: number;
  removed: number;
}

/** Puts the fund's waiting reversals in its credit file (made if needed); the file is then sent from Claims like any batch */
export async function makeCreditFile(practiceId: string, fundReference: string): Promise<CreditFileResult> {
  const result = await rpc<{ batch_id: string | null; batch_number: number | null; added: number; removed: number }>(
    'claim_reversals_to_batch', { p_practice_id: practiceId, p_fund: fundReference }, 'Making the credit file');
  return { batchId: result.batch_id, batchNumber: result.batch_number, added: result.added ?? 0, removed: result.removed ?? 0 };
}

// ---------------------------------------------------------------------------------------------
// Sending lines again
// ---------------------------------------------------------------------------------------------

export interface ResentLine {
  fromLineId: string;
  batchId: string;
  batchNumber: number | null;
  lineId: string;
}

/** Corrects a sent line and sends it again (claim field 32 R): the copy waits in the fund's open batch */
export async function correctClaimLine(lineId: string, changes: Record<string, unknown>, note: string | null): Promise<ResentLine & { invoiceLineUpdated: boolean }> {
  const result = await rpc<{ batch_id: string; batch_number: number | null; line_id: string; invoice_line_updated: boolean }>(
    'claim_line_correct', { p_line_id: lineId, p_changes: changes, p_note: note }, 'Correcting the claim line');
  return { fromLineId: lineId, batchId: result.batch_id, batchNumber: result.batch_number, lineId: result.line_id, invoiceLineUpdated: !!result.invoice_line_updated };
}

/** Sends chosen unpaid lines again (claim field 32 R); lines that may not go again come back with the reason */
export async function resendClaimLines(lineIds: readonly string[], note: string | null): Promise<{ resent: ResentLine[]; skipped: Array<{ lineId: string; reason: string }> }> {
  const result = await rpc<{
    resent: Array<{ from_line_id: string; batch_id: string; batch_number: number | null; line_id: string }>;
    skipped: Array<{ line_id: string; reason: string }>;
  }>('claim_lines_resend', { p_line_ids: [...lineIds], p_note: note }, 'Sending the lines again');
  return {
    resent: (result.resent ?? []).map(row => ({ fromLineId: row.from_line_id, batchId: row.batch_id, batchNumber: row.batch_number, lineId: row.line_id })),
    skipped: (result.skipped ?? []).map(row => ({ lineId: row.line_id, reason: row.reason }))
  };
}

// ---------------------------------------------------------------------------------------------
// What "Unpaid lines" reads
// ---------------------------------------------------------------------------------------------

interface DetailRow {
  id: string;
  batch_header_id: string;
  transaction_number_in_batch: number;
  invoice_id: string | null;
  invoice_number: string | null;
  patient_id: string | null;
  patient_name: string | null;
  system_transaction_number: number | null;
  bhf_tariff_code: string | null;
  service_amount: number | string | null;
  discount_amount: number | string | null;
  service_date: string | null;
}

const DETAIL_COLUMNS =
  'id, batch_header_id, transaction_number_in_batch, invoice_id, invoice_number, patient_id, patient_name, system_transaction_number, bhf_tariff_code, service_amount, discount_amount, service_date';

/** A batch row as the follow-up screens read it, with the claim file's own values where the batch kept its file */
function toSentLine(row: DetailRow, batch: BatchHeaderRow | undefined): SentClaimLine {
  const file = batch ? sentFileFields(batch).get(row.transaction_number_in_batch) : undefined;
  const fileAmount = file ? Number(file[13]) : Number.NaN;
  return {
    id: row.id,
    batchId: row.batch_header_id,
    lineNumber: row.transaction_number_in_batch,
    invoiceId: row.invoice_id,
    invoiceNumber: (row.invoice_number ?? '').trim(),
    patientId: row.patient_id,
    patientName: ((file?.[10] ?? row.patient_name) ?? '').trim(),
    systemTransactionNumber: row.system_transaction_number,
    tariffCode: ((file?.[12] ?? row.bhf_tariff_code) ?? '').trim(),
    amountCents: Number.isFinite(fileAmount) ? toCents(fileAmount) : Math.max(cents(row.service_amount) - cents(row.discount_amount), 0),
    serviceDate: toDateKey(file?.[16] ?? row.service_date ?? null)
  };
}

export interface UnpaidLineSources extends Omit<UnpaidLinesInput, 'settings' | 'today'> {
  /** True when credit notes per line can be read (the corrections are set up) */
  correctionsReady: boolean;
}

/**
 * Everything unpaidLines needs for a practice: the lines of its sent claim batches (all of them, so a line sent again
 * later replaces the earlier one), what the funds answered, what they still owe per invoice, the services already
 * waiting in an open batch and those with a medical-aid credit note.
 */
export async function loadUnpaidLineSources(practiceId: string, batches: readonly BatchHeaderRow[]): Promise<UnpaidLineSources> {
  const sent = batches.filter(isSentClaimBatch);
  const open = batches.filter(batch => isOpenBatch(batch) && !isCreditBatch(batch));
  const batchById = new Map(batches.map(batch => [batch.id, batch]));
  const [sentRows, openRows, outcomeRows] = await Promise.all([
    inChunks<DetailRow>(sent.map(batch => batch.id), 'the sent claim lines', chunk =>
      db.from('batch_details').select(DETAIL_COLUMNS).in('batch_header_id', chunk) as unknown as Rows<DetailRow>),
    inChunks<Pick<DetailRow, 'batch_header_id' | 'invoice_id' | 'system_transaction_number'>>(open.map(batch => batch.id), 'the lines waiting to be sent', chunk =>
      db.from('batch_details').select('batch_header_id, invoice_id, system_transaction_number').in('batch_header_id', chunk) as unknown as Rows<Pick<DetailRow, 'batch_header_id' | 'invoice_id' | 'system_transaction_number'>>),
    loadLineOutcomes(sent.map(batch => batch.id))
  ]);
  const lines = sentRows.map(row => toSentLine(row, batchById.get(row.batch_header_id)));
  const invoiceIds = [...new Set(lines.map(line => line.invoiceId).filter((id): id is string => !!id))];

  const outcomes = new Map<string, ClaimLineOutcome>([...(outcomeRows ?? new Map()).values()].map(row => [row.claimLineId, row.outcome]));
  const waiting = new Map<string, number>();
  openRows.forEach(row => {
    const key = serviceKeyOf(row.invoice_id, row.system_transaction_number);
    const batch = batchById.get(row.batch_header_id);
    if (key && batch) waiting.set(key, batch.batch_number);
  });

  let medicalAidOwed: Map<string, number> | null = new Map();
  try {
    const balances = await inChunks<{ invoice_id: string; medical_aid_outstanding: number | string | null }>(invoiceIds, 'what the funds still owe', chunk =>
      db.from('ar_invoice_balances').select('invoice_id, medical_aid_outstanding').eq('practice_id', practiceId).in('invoice_id', chunk) as unknown as Rows<{ invoice_id: string; medical_aid_outstanding: number | string | null }>);
    balances.forEach(row => medicalAidOwed?.set(row.invoice_id, cents(row.medical_aid_outstanding)));
  } catch (error) {
    if (!isArNotSetUp(error)) throw error;
    medicalAidOwed = null;
  }

  const credited = new Set<string>();
  let correctionsReady = true;
  try {
    type CreditRow = { invoice_id: string; system_transaction_number: number | null; adjustment_id: string };
    const creditRows = await inChunks<CreditRow>(invoiceIds, 'the credit notes', chunk =>
      db.from('credit_note_lines').select('invoice_id, system_transaction_number, adjustment_id').eq('practice_id', practiceId).eq('portion', 'medical_aid').in('invoice_id', chunk) as unknown as Rows<CreditRow>);
    const reversed = new Set((await inChunks<{ id: string }>(creditRows.map(row => row.adjustment_id), 'the credit notes', chunk =>
      db.from('invoice_adjustments').select('id').not('reversed_at', 'is', null).in('id', chunk) as unknown as Rows<{ id: string }>)).map(row => row.id));
    creditRows.forEach(row => {
      const key = serviceKeyOf(row.invoice_id, row.system_transaction_number);
      if (key && !reversed.has(row.adjustment_id)) credited.add(key);
    });
  } catch (error) {
    if (!isArNotSetUp(error)) throw error;
    correctionsReady = false;
  }

  return { batches, lines, outcomes, medicalAidOwed, waiting, credited, correctionsReady };
}

// ---------------------------------------------------------------------------------------------
// What "Correct and resend" offers
// ---------------------------------------------------------------------------------------------

export interface PersonOption {
  id: string;
  name: string;
}

/**
 * The patients of the practice on the same membership number (the family the claim may be for), the practice's
 * practitioners with an HPCNA number (the claim names the treating practitioner by it), and who bills under which
 * practice number (null when it cannot be read: the confirmation then does not name the number; the database still
 * applies the rule).
 */
export async function loadCorrectionChoices(
  practiceId: string,
  membershipNumber: string
): Promise<{ family: PersonOption[]; practitioners: PersonOption[]; billing: CorrectionBilling | null }> {
  const typed = membershipNumber.trim();
  const normalized = typed.replace(/[\s/-]/g, '').toUpperCase();
  const [aid, staff, partners, practice] = await Promise.all([
    // The claim line carries the number as the medical aid record holds it (commas taken out)
    normalized
      ? db.from('medical_aid_details').select('patient_id, membership_number').in('membership_number', [...new Set([typed, normalized])]).limit(50)
      : Promise.resolve({ data: [], error: null }),
    db.from('users').select('id, full_name, hpcsa_number, is_active').eq('practice_id', practiceId).order('full_name'),
    loadPractitionerBilling(practiceId),
    db.from('practices').select('practice_number').eq('id', practiceId).maybeSingle()
  ]);
  const practiceNumber = practice.error ? null : ((practice.data as { practice_number?: string | null } | null)?.practice_number ?? '').trim() || null;
  const billing: CorrectionBilling | null = partners.status === 'error' || !practiceNumber ? null : { billing: partners.billing, practiceNumber };
  if (staff.error) throw new Error(`Could not load the practitioners: ${staff.error.message}`);
  const familyIds = ((aid.error ? [] : aid.data) ?? [])
    .filter(row => String(row.membership_number ?? '').replace(/[\s/-]/g, '').toUpperCase() === normalized)
    .map(row => String(row.patient_id ?? ''))
    .filter(Boolean);
  const { data: patients, error: patientsError } = familyIds.length > 0
    ? await db.from('patients').select('id, first_name, last_name').eq('practice_id', practiceId).in('id', familyIds)
    : { data: [], error: null };
  if (patientsError) throw new Error(`Could not load the family: ${patientsError.message}`);
  return {
    family: ((patients ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>)
      .map(row => ({ id: row.id, name: [row.first_name, row.last_name].map(part => (part ?? '').trim()).filter(Boolean).join(' ') || 'Unnamed patient' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    practitioners: ((staff.data ?? []) as Array<{ id: string; full_name: string | null; hpcsa_number: string | null; is_active: boolean | null }>)
      .filter(row => (row.hpcsa_number ?? '').trim() && row.is_active !== false)
      .map(row => ({ id: row.id, name: (row.full_name ?? '').trim() || 'Practitioner' })),
    billing
  };
}
