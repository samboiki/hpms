/**
 * ICD-10 codes at claim review: what each line starts with, and which invoice lines take the codes saved there.
 * Pure, so the rules are tested directly.
 *
 * Start: the codes saved on the batch line, else the suggestion every billing line gets, the practice's usual code for
 * the tariff code first (initialIcd10Draft with icd10Defaults.ts: one rule for billing and claims).
 *
 * Keep: saved codes are copied to the invoice lines the claim lines came from (invoice_services.icd10_primary and
 * icd10_secondary, proposals/2026-10-08-invoice-line-codes.sql), so the invoice, the claim and a later resubmission
 * agree. Changing an invoice line makes the database rebuild the invoice's claim lines (sync_invoice_to_batch): unless
 * the invoice's own batch was sent, it deletes them from every batch and writes them again, from the invoice lines,
 * into the fund's batch whose status is 'active'. So an invoice takes the codes only when that touches no sent batch
 * and keeps its lines in this one:
 * - its own batch was sent (a resubmitted line is in this one): the database leaves every batch as it is;
 * - or it belongs to this batch, this batch is the fund's 'active' one, and no other batch holds its lines.
 * Every coded line of such an invoice is copied, not only the one just edited, and an invoice with a coded line that
 * cannot be copied (no matching invoice line, or codes the fund would refuse) keeps its codes on the claim only: the
 * rebuild would drop that line's codes. Codes are tidied and checked as the visit's Billing tab stores them
 * (icd10CodesOf, validateIcd10Selection; the database refuses other codes).
 */
import { splitDiagnosisCodes } from '../../../utils/billing/claimFile';
import { icd10CodesOf, validateIcd10Selection, type Icd10Selection } from '../../../utils/billing/icd10';
import type { TariffIcd10Defaults } from '../../../utils/billing/icd10Defaults';
import { isDentalPractice } from '../../../utils/billing/tariffRules';
import { initialIcd10Draft } from './buildClaimLines';
import { isOpenBatch } from './status';
import type { BatchDetailRow, BatchHeaderRow, BatchLineSources, Icd10Draft, InvoiceServiceRow } from './types';

type BatchState = Pick<BatchHeaderRow, 'id' | 'status' | 'sent_at'>;

/** The codes each line of a batch starts with; `usualCodes`: the practice's usual code per tariff code, when read */
export function initialDrafts(
  sources: Pick<BatchLineSources, 'details' | 'visits' | 'practiceType'>,
  usualCodes: TariffIcd10Defaults | null
): Record<string, Icd10Draft> {
  const dental = isDentalPractice(sources.practiceType);
  return Object.fromEntries(
    sources.details.map(detail => [
      detail.id,
      initialIcd10Draft(detail, detail.visit_id ? sources.visits.get(detail.visit_id) : undefined, dental, usualCodes)
    ])
  );
}

/** Where an invoice's claim lines are: its own batch (invoices_enhanced.batch_id) and every batch holding its lines */
export interface InvoiceClaimPlace {
  ownBatch: BatchState | null;
  batchIds: readonly string[];
}

/** Why an invoice keeps the codes on the claim only */
export type KeptOnClaimReason = 'unknown' | 'not-linked' | 'other-batch' | 'not-active' | 'no-invoice-line' | 'codes-refused';

export const KEPT_ON_CLAIM_TEXT: Record<KeptOnClaimReason, string> = {
  unknown: 'its batch could not be checked',
  'not-linked': 'the invoice is not linked to this batch',
  'other-batch': 'its lines are in another batch too',
  'not-active': "this batch is not the fund's active batch",
  'no-invoice-line': 'a claim line has no matching invoice line',
  'codes-refused': 'a line has codes the fund would refuse'
};

export interface InvoiceCodeCopy {
  invoiceId: string;
  invoiceNumber: string;
  /** True when the database rebuilds the invoice's claim lines in this batch once its lines change */
  rebuildsClaim: boolean;
  lines: Array<{ invoiceLineId: string; primary: string; secondary: string[] }>;
}

export interface CodeWriteBackPlan {
  copies: InvoiceCodeCopy[];
  kept: Array<{ invoiceNumber: string; reason: KeptOnClaimReason }>;
}

/** Null when the invoice's lines may take codes (see the file comment), else why not */
export function keptOnClaimReason(batch: BatchState, place: InvoiceClaimPlace | undefined): KeptOnClaimReason | null {
  if (!place) return 'unknown';
  if (place.ownBatch && !isOpenBatch(place.ownBatch)) return null;
  if (place.ownBatch?.id !== batch.id) return 'not-linked';
  if (place.batchIds.some(id => id !== batch.id)) return 'other-batch';
  // The database writes the lines into the fund's batch with exactly this status (get_or_create_active_batch_id)
  return batch.status === 'active' ? null : 'not-active';
}

type InvoiceLineCodes = Pick<InvoiceServiceRow, 'id' | 'icd10_primary' | 'icd10_secondary'>;

const storedCodes = (line: InvoiceLineCodes): string =>
  icd10CodesOf({ primary: line.icd10_primary ?? '', secondary: line.icd10_secondary ?? [] }).join('/');

/** Which invoice lines take which codes once the codes in `saved` are saved on the claim lines */
export function planCodeWriteBack(input: {
  batch: BatchState;
  lines: ReadonlyArray<{ key: string; invoiceId: string | null; invoiceNumber: string }>;
  /** The batch lines as loaded: what each claim line held before this save */
  details: ReadonlyArray<Pick<BatchDetailRow, 'id' | 'diagnostic_code'>>;
  /** The codes just saved, by claim line key */
  saved: ReadonlyMap<string, Icd10Selection>;
  /** The invoice line each claim line came from (matchInvoiceServices), by claim line key */
  invoiceLines: ReadonlyMap<string, InvoiceLineCodes>;
  places: ReadonlyMap<string, InvoiceClaimPlace>;
}): CodeWriteBackPlan {
  const plan: CodeWriteBackPlan = { copies: [], kept: [] };
  // Claim review never changes what is behind a batch that was sent
  if (!isOpenBatch(input.batch)) return plan;
  const held = new Map(input.details.map(detail => [detail.id, detail.diagnostic_code]));
  // What the claim line carries after the save: an unsaved draft on another line is not on the claim
  const codesOnClaim = (key: string): string[] => icd10CodesOf(input.saved.get(key) ?? splitDiagnosisCodes(held.get(key)));
  const invoiceIds = [...new Set(input.lines.filter(line => input.saved.has(line.key)).map(line => line.invoiceId))];
  for (const invoiceId of invoiceIds) {
    if (!invoiceId) continue;
    const claimLines = input.lines.filter(line => line.invoiceId === invoiceId);
    const invoiceNumber = claimLines[0].invoiceNumber;
    const place = input.places.get(invoiceId);
    let reason = keptOnClaimReason(input.batch, place);
    const copy: InvoiceCodeCopy = { invoiceId, invoiceNumber, rebuildsClaim: !place?.ownBatch || isOpenBatch(place.ownBatch), lines: [] };
    for (const line of claimLines) {
      if (reason) break;
      const codes = codesOnClaim(line.key);
      if (codes.length === 0) continue;
      const invoiceLine = input.invoiceLines.get(line.key);
      if (validateIcd10Selection({ primary: codes[0], secondary: codes.slice(1) }).errors.length > 0) reason = 'codes-refused';
      else if (!invoiceLine) reason = 'no-invoice-line';
      else if (storedCodes(invoiceLine) !== codes.join('/')) {
        copy.lines.push({ invoiceLineId: invoiceLine.id, primary: codes[0], secondary: codes.slice(1) });
      }
    }
    if (reason) plan.kept.push({ invoiceNumber, reason });
    else if (copy.lines.length > 0) plan.copies.push(copy);
  }
  return plan;
}
