/**
 * Keying a medical aid payment line by line (Payments > "Medical aid payment"), the way practices key a fund's
 * remittance: the amount received is the control total, the clerk types what the fund paid on each claim line (0.00
 * when it paid nothing), and the payment can only be posted once the lines, plus any money kept as credit on
 * purpose, add up to that total. The work can be saved and finished later or by a colleague (fund_payment_drafts,
 * proposals/2026-10-08-claims-follow-up.sql). The database posts one receipt with one allocation per invoice: the
 * sum of its keyed lines.
 * Pure (no database, no React): the sheet and the tests use the same rules.
 */
import { parseAmountInput } from '../../../services/ledgerService';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { fundLabel, identifyFund } from '../../../utils/remittance/funds';
import type { ClaimLineOutcome } from '../claims/status';
import { centsToAmountText } from './arPayloads';

/** One claim line the fund was sent (a batch_details row of a sent batch) */
export interface KeyingLine {
  claimLineId: string;
  batchId: string;
  batchNumber: number;
  lineNumber: number;
  /** yyyy-MM-dd */
  serviceDate: string | null;
  tariffCode: string;
  /** What was claimed on the line (claim amount less discount) */
  claimedCents: number;
  /** A line sent again after the fund refused it (claim field 32) */
  resubmitted: boolean;
  /** What the fund answered on it before, when anything came back */
  outcome: ClaimLineOutcome | null;
}

/** One claim: an invoice the fund still owes on, with the lines it was claimed on (none: keyed as a whole) */
export interface KeyingClaim {
  invoiceId: string;
  invoiceNumber: string;
  patientId: string | null;
  patientName: string;
  /** The 7-digit account (patient) reference funds print on remittances */
  accountReference: string | null;
  /** yyyy-MM-dd invoice date */
  dateKey: string | null;
  /** What the fund still owes on the invoice (medical-aid portion) */
  owedCents: number;
  lines: KeyingLine[];
}

export type KeyingMethod = 'medical_aid' | 'eft';

/** A payment being keyed, as typed */
export interface KeyingDraft {
  id: string | null;
  version: number | null;
  fundCode: string | null;
  fundName: string;
  amountText: string;
  receivedOn: string;
  reference: string;
  method: KeyingMethod;
  notes: string;
  /** What the fund paid, as typed, per row key (lineRowKey / wholeClaimKey); a row left empty is not keyed */
  paid: Record<string, string>;
  /** Money not matched to a claim, kept on the receipt as credit on purpose */
  unmatchedText: string;
  /** Invoices whose unpaid rest moves to the patient */
  restToPatient: string[];
}

export const lineRowKey = (line: Pick<KeyingLine, 'claimLineId'>): string => `line:${line.claimLineId}`;
export const wholeClaimKey = (invoiceId: string): string => `invoice:${invoiceId}`;

/** The rows of a claim: its claim lines, or the claim as a whole when it has none */
export const rowKeysOf = (claim: KeyingClaim): string[] =>
  claim.lines.length > 0 ? claim.lines.map(lineRowKey) : [wholeClaimKey(claim.invoiceId)];

export type KeyedAmount = { state: 'empty' } | { state: 'invalid' } | { state: 'ok'; cents: number };

/** "" is not keyed; "0" or "0.00" means the fund paid nothing on the line; otherwise N$ and cents ("1,250.5" works) */
export function parseKeyedAmount(text: string | undefined): KeyedAmount {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { state: 'empty' };
  if (/^(N\$\s*)?0+([.,]0{0,2})?$/i.test(trimmed)) return { state: 'ok', cents: 0 };
  const cents = parseAmountInput(trimmed);
  return cents === null ? { state: 'invalid' } : { state: 'ok', cents };
}

export const emptyDraft = (fundCode: string | null, fundName: string, todayKey: string): KeyingDraft => ({
  id: null,
  version: null,
  fundCode,
  fundName,
  amountText: '',
  receivedOn: todayKey,
  reference: '',
  method: 'medical_aid',
  notes: '',
  paid: {},
  unmatchedText: '',
  restToPatient: []
});

export interface ClaimSummary {
  /** What was keyed on the claim's rows */
  paidCents: number;
  keyedRows: number;
  /** More is keyed than the fund still owes on the invoice */
  overOwed: boolean;
  /** What would move to the patient when "patient pays the rest" is ticked */
  restCents: number;
}

export interface KeyingSummary {
  claims: Map<string, ClaimSummary>;
  /** Rows whose amount could not be read */
  invalidRows: Set<string>;
  keyedCents: number;
  unmatchedCents: number;
  /** The amount received; null while it is empty or cannot be read */
  controlCents: number | null;
  /** Amount received less (keyed lines + credit kept): positive = still to key, negative = keyed too much */
  differenceCents: number | null;
  keyedRows: number;
  /** Why the payment cannot be posted yet, in plain words (empty when it can) */
  problems: string[];
  balanced: boolean;
}

const nadText = (cents: number): string => formatNad(fromCents(Math.abs(cents)));

/** Where the keying stands: per claim, the totals against the control total, and what stops it being posted */
export function summarizeKeying(draft: KeyingDraft, claims: readonly KeyingClaim[]): KeyingSummary {
  const invalidRows = new Set<string>();
  const summaries = new Map<string, ClaimSummary>();
  let keyedCents = 0;
  let keyedRows = 0;
  let overOwed = 0;
  for (const claim of claims) {
    let paidCents = 0;
    let rows = 0;
    for (const key of rowKeysOf(claim)) {
      const amount = parseKeyedAmount(draft.paid[key]);
      if (amount.state === 'invalid') invalidRows.add(key);
      if (amount.state !== 'ok') continue;
      paidCents += amount.cents;
      rows += 1;
    }
    const over = paidCents > Math.max(claim.owedCents, 0);
    if (over) overOwed += 1;
    summaries.set(claim.invoiceId, {
      paidCents,
      keyedRows: rows,
      overOwed: over,
      restCents: Math.max(Math.max(claim.owedCents, 0) - paidCents, 0)
    });
    keyedCents += paidCents;
    keyedRows += rows;
  }
  const unmatched = parseKeyedAmount(draft.unmatchedText);
  const unmatchedCents = unmatched.state === 'ok' ? unmatched.cents : 0;
  const control = parseKeyedAmount(draft.amountText);
  const controlCents = control.state === 'ok' && control.cents > 0 ? control.cents : null;
  const differenceCents = controlCents === null ? null : controlCents - keyedCents - unmatchedCents;

  const problems: string[] = [];
  if (!draft.fundName.trim()) problems.push('Choose the medical aid fund that paid.');
  if (controlCents === null) problems.push(control.state === 'invalid' ? 'Type the amount received like 1250.00.' : 'Type the amount the fund paid (the total on its remittance).');
  if (!draft.receivedOn) problems.push('Choose the date the money came in.');
  if (invalidRows.size > 0) problems.push(`${invalidRows.size} line${invalidRows.size === 1 ? '' : 's'} have an amount that cannot be read.`);
  if (unmatched.state === 'invalid') problems.push('The amount kept as credit cannot be read.');
  if (overOwed > 0) problems.push(`${overOwed} claim${overOwed === 1 ? ' has' : 's have'} more keyed than the fund still owes on it.`);
  if (keyedRows === 0 && unmatchedCents === 0) problems.push('Key what the fund paid on its claim lines.');
  if (differenceCents !== null && differenceCents > 0) problems.push(`${nadText(differenceCents)} of the amount received is not keyed yet.`);
  if (differenceCents !== null && differenceCents < 0) problems.push(`The lines add up to ${nadText(-differenceCents)} more than the amount received.`);
  return {
    claims: summaries,
    invalidRows,
    keyedCents,
    unmatchedCents,
    controlCents,
    differenceCents,
    keyedRows,
    problems,
    balanced: problems.length === 0
  };
}

/**
 * "Paid in full" for one claim: each line gets what was claimed on it, in line order, never more than the fund
 * still owes on the invoice in total (a claim paid in part before only gets the rest); a claim without lines gets
 * what is still owed.
 */
export function paidInFull(claim: KeyingClaim): Record<string, string> {
  let left = Math.max(claim.owedCents, 0);
  if (claim.lines.length === 0) return { [wholeClaimKey(claim.invoiceId)]: centsToAmountText(left) };
  const filled: Record<string, string> = {};
  for (const line of [...claim.lines].sort((a, b) => a.batchNumber - b.batchNumber || a.lineNumber - b.lineNumber)) {
    const cents = Math.min(Math.max(line.claimedCents, 0), left);
    filled[lineRowKey(line)] = centsToAmountText(cents);
    left -= cents;
  }
  return filled;
}

/** The fund_payment_draft_save payload: only the rows keyed with a readable amount, amounts in N$ with 2 decimals */
export function draftPayload(draft: KeyingDraft, practiceId: string, claims: readonly KeyingClaim[]): Record<string, unknown> {
  const lines: Array<{ claim_line_id: string | null; invoice_id: string; paid: string }> = [];
  for (const claim of claims) {
    for (const key of rowKeysOf(claim)) {
      const amount = parseKeyedAmount(draft.paid[key]);
      if (amount.state !== 'ok') continue;
      lines.push({
        claim_line_id: key.startsWith('line:') ? key.slice('line:'.length) : null,
        invoice_id: claim.invoiceId,
        paid: centsToAmountText(amount.cents)
      });
    }
  }
  const control = parseKeyedAmount(draft.amountText);
  const unmatched = parseKeyedAmount(draft.unmatchedText);
  const owing = new Set(claims.map(claim => claim.invoiceId));
  return {
    id: draft.id,
    version: draft.version,
    practice_id: practiceId,
    fund_code: draft.fundCode,
    fund_name: draft.fundName.trim(),
    amount: control.state === 'ok' && control.cents > 0 ? centsToAmountText(control.cents) : null,
    received_on: draft.receivedOn || null,
    reference: draft.reference.trim() || null,
    method: draft.method,
    notes: draft.notes.trim() || null,
    lines,
    unmatched: unmatched.state === 'ok' ? centsToAmountText(unmatched.cents) : '0.00',
    rest_to_patient: draft.restToPatient.filter(invoiceId => owing.has(invoiceId))
  };
}

/** A saved draft as the database returns it */
export interface DraftRow {
  id: string;
  version: number;
  fund_code: string | null;
  fund_name: string;
  amount: number | string | null;
  received_on: string | null;
  reference: string | null;
  method: string;
  notes: string | null;
  lines: unknown;
  unmatched: number | string | null;
  rest_to_patient: string[] | null;
  updated_at: string;
  updated_by: string | null;
  created_by: string | null;
}

const amountText = (value: number | string | null | undefined): string => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number.toFixed(2) : '';
};

/** A saved draft back as typed values; lines the keying screen does not show any more are kept by key */
export function draftFromRow(row: DraftRow): KeyingDraft {
  const paid: Record<string, string> = {};
  for (const line of Array.isArray(row.lines) ? row.lines : []) {
    if (!line || typeof line !== 'object') continue;
    const { claim_line_id: claimLineId, invoice_id: invoiceId, paid: amount } = line as Record<string, unknown>;
    if (typeof invoiceId !== 'string') continue;
    const key = typeof claimLineId === 'string' && claimLineId ? lineRowKey({ claimLineId }) : wholeClaimKey(invoiceId);
    const number = Number(amount);
    paid[key] = Number.isFinite(number) ? number.toFixed(2) : '';
  }
  return {
    id: row.id,
    version: row.version,
    fundCode: row.fund_code,
    fundName: row.fund_name,
    amountText: amountText(row.amount),
    receivedOn: row.received_on ?? '',
    reference: row.reference ?? '',
    method: row.method === 'eft' ? 'eft' : 'medical_aid',
    notes: row.notes ?? '',
    paid,
    unmatchedText: amountText(row.unmatched),
    restToPatient: row.rest_to_patient ?? []
  };
}

/** Keyed so far on a saved draft (lines plus credit kept), for the list of payments being keyed */
export function draftKeyedCents(row: Pick<DraftRow, 'lines' | 'unmatched'>): number {
  let cents = 0;
  for (const line of Array.isArray(row.lines) ? row.lines : []) {
    const amount = parseKeyedAmount(String((line as Record<string, unknown> | null)?.paid ?? ''));
    if (amount.state === 'ok') cents += amount.cents;
  }
  const unmatched = parseKeyedAmount(amountText(row.unmatched));
  return cents + (unmatched.state === 'ok' ? unmatched.cents : 0);
}

/** A fund as medical_aid_providers holds it */
export interface FundRecord {
  id: string;
  name: string;
  short_name: string | null;
  medical_aid_reference: string | null;
}

/** The claim-file code of a fund code or name ("PSEMAS" and "MAG1" are the same fund) */
const codeOf = (value: string | null | undefined): string | null => {
  const text = (value ?? '').trim();
  if (!text) return null;
  return identifyFund(text)?.code ?? text.toUpperCase();
};

/**
 * Which fund a claim belongs to, by the fund's code (MAG1 = PSEMAS, NMC1, NHPM, NAMM, PROS), never by how its name
 * was typed: the code of the batch the claim was sent in, else of the patient's fund on file (by its id), else of
 * the fund name typed on the file when it names a known fund. Null when none of these says (the screens then group
 * it under "Medical aid not recorded"). The name is the fund's own name from the fund list.
 */
export function fundOfClaim(
  source: { batchReference: string | null; providerId: string | null; providerName: string | null },
  funds: readonly FundRecord[]
): { fundCode: string | null; fund: string | null } {
  const provider = source.providerId ? funds.find(fund => fund.id === source.providerId) : undefined;
  const typed = (source.providerName ?? '').trim();
  const fundCode =
    codeOf(source.batchReference) ??
    (provider ? codeOf(provider.medical_aid_reference) ?? identifyFund(provider.name)?.code ?? null : null) ??
    (typed ? identifyFund(typed)?.code ?? codeOf(funds.find(fund => [fund.name, fund.short_name].some(name => name?.trim().toLowerCase() === typed.toLowerCase()))?.medical_aid_reference) : null);
  if (!fundCode) return { fundCode: null, fund: null };
  const named = funds.find(fund => codeOf(fund.medical_aid_reference) === fundCode);
  return { fundCode, fund: named?.name ?? fundLabel(fundCode) };
}

/** Claims matching what the clerk typed: patient name, invoice number or account reference */
export function findClaims(claims: readonly KeyingClaim[], query: string): KeyingClaim[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...claims];
  return claims.filter(claim => {
    const text = [claim.patientName, claim.invoiceNumber, claim.accountReference ?? ''].join(' ').toLowerCase();
    return words.every(word => text.includes(word));
  });
}
