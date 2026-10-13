import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { withTimeout } from '../../../services/financialKpiService';
import { toDateKey } from '../../../utils/billing/dates';
import { toCents } from '../../../utils/billing/money';
import { isClaimLineOutcome, isOpenBatch, type ClaimLineOutcome } from '../claims/status';
import { isArNotSetUp, type FundClaim } from './arService';
import type { DraftRow, KeyingClaim, KeyingLine } from './fundPaymentKeying';

/**
 * Supabase access for keying a fund payment line by line: the claim lines of the fund's open claims, and the drafts
 * (fund_payment_drafts and its three functions, proposals/2026-10-08-claims-follow-up.sql). Every write is one RPC;
 * the database checks the practice, the version and, when posting, that the lines add up to the amount received.
 */
const db = supabase as unknown as SupabaseClient;
const TIMEOUT_MS = 25000;
const ID_CHUNK = 100;

export const KEYING_NOT_SET_UP_MESSAGE =
  'Keying a fund payment line by line is not set up in this database yet (proposals/2026-10-08-claims-follow-up.sql).';

/** Someone else saved the payment after it was opened: open it again to carry on from their version */
export class DraftConflictError extends Error {}

const timed = <T>(task: PromiseLike<T>, label: string): Promise<T> =>
  withTimeout(Promise.resolve(task), TIMEOUT_MS, `${label} took too long. Check your connection and try again.`);

const chunks = <T>(items: readonly T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += ID_CHUNK) out.push(items.slice(i, i + ID_CHUNK));
  return out;
};

async function selectIn<T>(table: string, columns: string, column: string, ids: readonly string[], label: string): Promise<T[]> {
  const rows: T[] = [];
  for (const chunk of chunks([...new Set(ids.filter(Boolean))])) {
    const { data, error } = await timed(db.from(table).select(columns).in(column, chunk), `Loading ${label}`);
    if (error) throw Object.assign(new Error(`Could not load ${label}: ${error.message}`), { code: error.code });
    rows.push(...((data ?? []) as unknown as T[]));
  }
  return rows;
}

const cents = (value: number | string | null | undefined): number => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? toCents(number) : 0;
};

interface DetailRow {
  id: string;
  batch_header_id: string | null;
  invoice_id: string | null;
  transaction_number_in_batch: number;
  service_date: string | null;
  bhf_tariff_code: string | null;
  service_amount: number | string | null;
  discount_amount: number | string | null;
  resubmission_flag: string | null;
  system_patient_reference_number: string | null;
}

/**
 * The fund's open claims with the lines they were claimed on: the lines of batches already sent (a line sent again
 * after a refusal shows too, marked). A claim with no sent lines (claimed from the old system, or not sent yet) is
 * keyed as a whole. What the fund answered before on a line comes with it when the answers are set up.
 */
export async function loadKeyingClaims(claims: readonly FundClaim[]): Promise<KeyingClaim[]> {
  const invoiceIds = claims.map(claim => claim.invoiceId);
  const details = await selectIn<DetailRow>(
    'batch_details',
    'id, batch_header_id, invoice_id, transaction_number_in_batch, service_date, bhf_tariff_code, service_amount, discount_amount, resubmission_flag, system_patient_reference_number',
    'invoice_id',
    invoiceIds,
    'the claim lines'
  );
  const batches = await selectIn<{ id: string; batch_number: number; status: string | null; sent_at: string | null }>(
    'batch_headers', 'id, batch_number, status, sent_at', 'id', details.map(detail => detail.batch_header_id ?? ''), 'the claim batches'
  );
  const sentBatch = new Map(batches.filter(batch => !isOpenBatch(batch)).map(batch => [batch.id, batch]));
  const sentLines = details.filter(detail => detail.batch_header_id && sentBatch.has(detail.batch_header_id));

  let outcomes = new Map<string, ClaimLineOutcome>();
  try {
    const rows = await selectIn<{ claim_line_id: string; outcome: string }>(
      'claim_line_outcomes', 'claim_line_id, outcome', 'claim_line_id', sentLines.map(line => line.id), "the funds' answers"
    );
    outcomes = new Map(rows.filter(row => isClaimLineOutcome(row.outcome)).map(row => [row.claim_line_id, row.outcome as ClaimLineOutcome]));
  } catch (error) {
    if (!isArNotSetUp(error)) throw error;
  }

  const linesByInvoice = new Map<string, KeyingLine[]>();
  const referenceByInvoice = new Map<string, string>();
  for (const detail of details) {
    if (detail.invoice_id && detail.system_patient_reference_number) referenceByInvoice.set(detail.invoice_id, detail.system_patient_reference_number.trim());
  }
  for (const detail of sentLines) {
    const batch = sentBatch.get(detail.batch_header_id as string);
    if (!detail.invoice_id || !batch) continue;
    const line: KeyingLine = {
      claimLineId: detail.id,
      batchId: batch.id,
      batchNumber: batch.batch_number,
      lineNumber: detail.transaction_number_in_batch,
      serviceDate: toDateKey(detail.service_date),
      tariffCode: (detail.bhf_tariff_code ?? '').trim(),
      claimedCents: Math.max(cents(detail.service_amount) - cents(detail.discount_amount), 0),
      resubmitted: (detail.resubmission_flag ?? '').trim().toUpperCase() === 'R',
      outcome: outcomes.get(detail.id) ?? null
    };
    linesByInvoice.set(detail.invoice_id, [...(linesByInvoice.get(detail.invoice_id) ?? []), line]);
  }

  return claims.map(claim => ({
    invoiceId: claim.invoiceId,
    invoiceNumber: claim.invoiceNumber,
    patientId: claim.patientId,
    patientName: claim.patientName,
    accountReference: referenceByInvoice.get(claim.invoiceId) ?? null,
    dateKey: claim.dateKey,
    owedCents: claim.medicalAidOwedCents,
    lines: (linesByInvoice.get(claim.invoiceId) ?? []).sort((a, b) => a.batchNumber - b.batchNumber || a.lineNumber - b.lineNumber)
  }));
}

const DRAFT_COLUMNS = 'id, version, fund_code, fund_name, amount, received_on, reference, method, notes, lines, unmatched, rest_to_patient, updated_at, updated_by, created_by';

/** The payments being keyed in the practice, last saved first; 'not_set_up' before the drafts table exists */
export async function loadDrafts(practiceId: string): Promise<{ state: 'ready' | 'not_set_up'; drafts: DraftRow[] }> {
  const { data, error } = await timed(
    db.from('fund_payment_drafts').select(DRAFT_COLUMNS).eq('practice_id', practiceId).eq('status', 'draft').order('updated_at', { ascending: false }).limit(50),
    'Loading the payments being keyed'
  );
  if (error) {
    if (isArNotSetUp(error)) return { state: 'not_set_up', drafts: [] };
    throw new Error(`Could not load the payments being keyed: ${error.message}`);
  }
  return { state: 'ready', drafts: (data ?? []) as unknown as DraftRow[] };
}

/** One draft as it is now (to carry on from a colleague's version) */
export async function loadDraft(draftId: string): Promise<DraftRow | null> {
  const { data, error } = await timed(db.from('fund_payment_drafts').select(DRAFT_COLUMNS).eq('id', draftId).eq('status', 'draft').limit(1), 'Loading the payment');
  if (error) throw new Error(`Could not load the payment: ${error.message}`);
  return ((data ?? [])[0] as unknown as DraftRow | undefined) ?? null;
}

async function callRpc<T>(name: string, args: Record<string, unknown>, action: string): Promise<T> {
  const { data, error } = await withTimeout(
    Promise.resolve(db.rpc(name, args)),
    TIMEOUT_MS,
    `${action} took too long. Check Finance before trying again: it may have been saved.`
  );
  if (error) {
    if (isArNotSetUp(error)) throw new Error(KEYING_NOT_SET_UP_MESSAGE);
    if (error.code === '40001') throw new DraftConflictError(error.message);
    throw new Error(error.message || `${action} failed`);
  }
  return data as T;
}

export interface SavedDraft {
  id: string;
  version: number;
  updated_at: string;
}

export const saveDraft = (payload: Record<string, unknown>) =>
  callRpc<SavedDraft>('fund_payment_draft_save', { p_draft: payload }, 'Saving the payment');

export const discardDraft = (draftId: string, version: number) =>
  callRpc<{ id: string; status: string }>('fund_payment_draft_discard', { p_draft_id: draftId, p_version: version }, 'Discarding the payment');

export interface PostedFundPayment {
  draft_id: string;
  already_posted: boolean;
  receipt_id: string;
  receipt_number: string;
  allocated?: number | string | null;
  unallocated?: number | string | null;
  batches_moved?: number;
}

export const postDraft = (draftId: string, version: number) =>
  callRpc<PostedFundPayment>('fund_payment_draft_post', { p_draft_id: draftId, p_version: version }, 'Posting the payment');
