/**
 * Claims after they were sent (parity D23, F9, F16): which sent lines a fund has not paid and may get again, what a
 * "Correct and resend" changes, and where a reversal stands. Pure (no database): claimCorrectionsService loads the
 * rows. The database decides again when a line is sent (claim_line_resend_blocker, claim_line_correct and
 * claim_lines_resend in proposals/2026-10-09-claim-corrections.sql), so these rules only decide what the screens offer.
 */
import { checkClaimDeadline, getFundRule } from '../../../utils/billing/fundRules';
import { daysBetweenKeys, formatServiceDate, isValidDateKey, toDateKey } from '../../../utils/billing/dates';
import { isReversalTransactionType } from '../../../utils/billing/claimFile';
import { icd10CodesOf, normalizeIcd10, validateIcd10Selection, type Icd10Selection } from '../../../utils/billing/icd10';
import { parseAuthorisationNumber } from '../../../utils/billing/lineSplit';
import { billingPracticeNumber, type PractitionerBillingMap } from '../../../utils/billing/practitionerBilling';
import { fundCodeOf, silentDaysFor, type SilentFundDays } from './batchFollowUp';
import { isOpenBatch, type ClaimLineOutcome } from './status';
import type { BatchHeaderRow } from './types';

/** A credit file (header transaction type C): reversals of lines the fund was claimed before */
export const isCreditBatch = (batch: Pick<BatchHeaderRow, 'transaction_type'>): boolean => isReversalTransactionType(batch.transaction_type);

/** A batch of claims that went to the fund (sent, and not a credit file) */
export const isSentClaimBatch = (batch: Pick<BatchHeaderRow, 'status' | 'sent_at' | 'transaction_type'>): boolean =>
  !isOpenBatch(batch) && !isCreditBatch(batch);

/** One service of one invoice, as claim lines and credit notes know it (invoice + system transaction number) */
export const serviceKeyOf = (invoiceId: string | null | undefined, systemTransactionNumber: number | null | undefined): string | null =>
  invoiceId && systemTransactionNumber !== null && systemTransactionNumber !== undefined ? `${invoiceId}|${systemTransactionNumber}` : null;

/** A line of a sent claim batch, as the follow-up screens need it */
export interface SentClaimLine {
  /** batch_details.id */
  id: string;
  batchId: string;
  lineNumber: number;
  invoiceId: string | null;
  invoiceNumber: string;
  patientId: string | null;
  /** The name the claim carried */
  patientName: string;
  systemTransactionNumber: number | null;
  tariffCode: string;
  amountCents: number;
  /** yyyy-MM-dd */
  serviceDate: string | null;
}

export interface UnpaidLinesInput {
  /** The practice's batches (sent claim batches are followed up; open ones hold lines waiting to go) */
  batches: readonly BatchHeaderRow[];
  /** Lines of the practice's sent claim batches */
  lines: readonly SentClaimLine[];
  /** What the fund answered per claim line (claim_line_outcomes); a line missing here has no answer */
  outcomes: ReadonlyMap<string, ClaimLineOutcome>;
  /** What the funds still owe per invoice (medical aid portion, cents); null when it could not be read */
  medicalAidOwed: ReadonlyMap<string, number> | null;
  /** Services already waiting in an open batch (serviceKeyOf), with that batch's number */
  waiting: ReadonlyMap<string, number>;
  /** Services with a medical-aid credit note (serviceKeyOf) */
  credited: ReadonlySet<string>;
  settings: SilentFundDays;
  /** yyyy-MM-dd */
  today: string;
}

export interface UnpaidLine {
  line: SentClaimLine;
  batch: BatchHeaderRow;
  /** The fund's claim-file code (MAG1, NMC1, NHPM, NAMM, PROS) */
  fundCode: string;
  daysSinceSent: number;
  /** 'none': nothing came back; 'waiting': pended or acknowledged, not paid */
  outcome: 'none' | 'waiting';
  /** Why it cannot go again from here, in words; null when it can be selected */
  blocker: string | null;
}

/** The day a timestamp fell on in the practice's (the browser's) calendar */
const dayOf = (timestamp: string | null): string | null => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? toDateKey(timestamp) : toDateKey(date);
};

/**
 * The sent claim lines the fund has not paid (no answer, or pended) after the wait set for it (practice_settings
 * silent_fund_days: 30 days, PSEMAS 60), the latest claim of each service only, on invoices the fund still owes.
 * Lines that cannot go again from here say why (already waiting in an open batch, credited, or past the fund's
 * deadline, which would stop the whole batch at the claim check). Refused lines are not listed: the rejection queue
 * holds them with the fund's reason. Oldest first within each fund.
 */
export function unpaidLines(input: UnpaidLinesInput): UnpaidLine[] {
  const batchById = new Map(input.batches.map(batch => [batch.id, batch]));
  // The latest sent claim of each service: a line sent again replaces the one before it
  const latestByService = new Map<string, { id: string; sentAt: string }>();
  for (const line of input.lines) {
    const batch = batchById.get(line.batchId);
    const key = serviceKeyOf(line.invoiceId, line.systemTransactionNumber);
    if (!batch || !key || !isSentClaimBatch(batch)) continue;
    const sentAt = batch.sent_at ?? batch.created_at ?? '';
    const current = latestByService.get(key);
    if (!current || sentAt > current.sentAt) latestByService.set(key, { id: line.id, sentAt });
  }

  const result: UnpaidLine[] = [];
  for (const line of input.lines) {
    const batch = batchById.get(line.batchId);
    const key = serviceKeyOf(line.invoiceId, line.systemTransactionNumber);
    if (!batch || !key || !isSentClaimBatch(batch) || latestByService.get(key)?.id !== line.id) continue;
    const sentDay = dayOf(batch.sent_at);
    if (!sentDay) continue;
    const daysSinceSent = daysBetweenKeys(sentDay, input.today);
    if (daysSinceSent < silentDaysFor(batch.medical_aid_reference, input.settings)) continue;
    const answer = input.outcomes.get(line.id);
    if (answer === 'paid' || answer === 'part_paid' || answer === 'rejected') continue;
    // An invoice the fund owes nothing on any more (paid another way, credited or written off) is not chased
    if (input.medicalAidOwed && line.invoiceId && (input.medicalAidOwed.get(line.invoiceId) ?? 0) <= 0) continue;

    const waitingIn = input.waiting.get(key);
    const rule = getFundRule(batch.medical_aid_reference);
    const deadline = checkClaimDeadline(line.serviceDate, input.today, rule);
    const blocker = waitingIn !== undefined
      ? `Already sent again: it waits in batch ${waitingIn}`
      : input.credited.has(key)
        ? 'It has a credit note: check the invoice before claiming it again'
        // Only a deadline confirmed with the fund stops a line going again (NAMMED's and Prosperity's are guesses)
        : deadline.status === 'expired' && rule.confirmed
          ? `Past the fund's deadline (last day ${formatServiceDate(deadline.lastDay)}): the fund would refuse it`
          : deadline.status === 'invalid'
            ? 'Its service date is missing, so the fund would refuse it'
            : null;
    result.push({ line, batch, fundCode: fundCodeOf(batch.medical_aid_reference), daysSinceSent, outcome: answer === 'waiting' ? 'waiting' : 'none', blocker });
  }
  return result.sort((a, b) => a.fundCode.localeCompare(b.fundCode) || b.daysSinceSent - a.daysSinceSent || a.line.lineNumber - b.line.lineNumber);
}

/** What the fund received on a line, as "Correct and resend" shows it */
export interface SentLineValues {
  /** yyyy-MM-dd */
  serviceDate: string | null;
  patientId: string | null;
  icd10: readonly string[];
  practitionerId: string | null;
  authorisationNumber: string;
  /** The practice number the line was billed under (claim field 29), when known */
  practiceNumber?: string | null;
}

/**
 * The practitioner a claim line was claimed under (the invoice line's own, else the invoice's), the one rule the claim
 * file and the database share: claim_line_correct starts from it, so "Correct and send again" offers it as sent and
 * choosing it again is no change.
 */
export { claimedPractitionerOf } from '../../../utils/billing/claimLine';

/** Who bills under which number (practitioner_billing) and the practice's own number: the partner-billing rule's inputs */
export interface CorrectionBilling {
  billing: PractitionerBillingMap;
  practiceNumber: string | null;
}

/** What staff typed in "Correct and resend" */
export interface CorrectionDraft {
  serviceDate: string;
  patientId: string;
  icd10: Icd10Selection;
  practitionerId: string;
  authorisationNumber: string;
}

export type CorrectionField = 'service_date' | 'patient_id' | 'icd10' | 'practitioner_id' | 'authorisation_number';

export interface CorrectionPlan {
  /** The changes claim_line_correct receives: only what differs from what the fund received */
  changes: Partial<Record<CorrectionField, string | string[]>>;
  /** Plain words for each change, for the confirmation */
  changed: string[];
  errors: string[];
}

const sameCodes = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((code, index) => normalizeIcd10(code) === normalizeIcd10(b[index] ?? ''));

/**
 * The changes a correction sends (only what differs from the claim the fund received), and what is wrong with the draft.
 * A date in the future, ICD-10 codes the claim check would refuse, or an authorisation number the claim file cannot
 * carry are errors: the corrected line must pass the claim check, or the fund's next batch cannot be sent.
 * Another practitioner also moves the line's practice number (claim field 29) by the partner-billing rule: their own
 * number when they have one, else the practice's (billingPracticeNumber). The database sets it (claim_line_correct);
 * `billing` only lets the confirmation say so.
 */
export function correctionPlan(
  sent: SentLineValues,
  draft: CorrectionDraft,
  today: string,
  names: { patient?: string; practitioner?: string } = {},
  billing: CorrectionBilling | null = null
): CorrectionPlan {
  const changes: CorrectionPlan['changes'] = {};
  const changed: string[] = [];
  const errors: string[] = [];

  const date = draft.serviceDate.trim();
  if (!isValidDateKey(date)) errors.push('Choose the date of service.');
  else if (date > today) errors.push('The date of service cannot be in the future.');
  else if (date !== sent.serviceDate) {
    changes.service_date = date;
    changed.push(`Date ${formatServiceDate(sent.serviceDate)} to ${formatServiceDate(date)}`);
  }

  if (draft.patientId && draft.patientId !== sent.patientId) {
    changes.patient_id = draft.patientId;
    changed.push(`Claimed for ${names.patient ?? 'another member of the family'}`);
  }

  const codes = icd10CodesOf(draft.icd10);
  const icd = validateIcd10Selection(draft.icd10);
  if (codes.length === 0) errors.push('A claim needs at least one ICD-10 code.');
  else if (icd.errors.length > 0) errors.push(...icd.errors);
  else if (!sameCodes(codes, sent.icd10)) {
    changes.icd10 = codes;
    changed.push(`ICD-10 ${sent.icd10.length > 0 ? sent.icd10.join(', ') : 'none'} to ${codes.join(', ')}`);
  }

  if (draft.practitionerId && draft.practitionerId !== sent.practitionerId) {
    changes.practitioner_id = draft.practitionerId;
    changed.push(`Practitioner ${names.practitioner ? `now ${names.practitioner}` : 'changed'}`);
    const bills = billing ? billingPracticeNumber(draft.practitionerId, billing.billing, billing.practiceNumber) : null;
    const before = (sent.practiceNumber ?? '').trim();
    if (bills?.number && before && bills.number !== before) {
      changed.push(`Billed under ${bills.own ? 'their own practice number' : "the practice's number"} ${bills.number}, not ${before}`);
    }
  }

  const authorisation = parseAuthorisationNumber(draft.authorisationNumber);
  if (!authorisation.ok) errors.push(authorisation.message);
  else if ((authorisation.value ?? '') !== sent.authorisationNumber.trim()) {
    changes.authorisation_number = authorisation.value ?? '';
    changed.push(authorisation.value ? `Authorisation ${authorisation.value}` : 'Authorisation number taken off');
  }

  if (errors.length === 0 && changed.length === 0) errors.push('Nothing was changed: correct the date, dependant, ICD-10 codes, practitioner or authorisation.');
  return { changes, changed, errors };
}

/** Where a reversal stands (the claim_reversal_states view) */
export type ReversalState = 'queued' | 'in_file' | 'sent' | 'cancelled';

export const isReversalState = (value: unknown): value is ReversalState =>
  value === 'queued' || value === 'in_file' || value === 'sent' || value === 'cancelled';

/** Where one reversal stands, in a sentence (the credit note on screen and on paper) */
export function describeReversal(row: { state: ReversalState; creditBatchNumber: number | null; creditSentAt: string | null }): string {
  switch (row.state) {
    case 'queued':
      return 'The fund is told with a reversal in its next credit file (not sent yet).';
    case 'in_file':
      return `The fund is told with a reversal in credit file ${row.creditBatchNumber ?? ''} (not sent yet).`;
    case 'sent':
      return `The fund was told with a reversal in credit file ${row.creditBatchNumber ?? ''}${row.creditSentAt ? `, sent ${formatServiceDate(dayOf(row.creditSentAt))}` : ''}.`;
    default:
      return 'The reversal was cancelled: the credit note was reversed before it was sent.';
  }
}

/** Each state as a word with its icon and colour, so it never relies on colour alone */
export const REVERSAL_STATE_META: Record<ReversalState, { label: string; chip: string; icon: string }> = {
  queued: { label: 'Reversal waiting to be sent', chip: 'bg-amber-100 text-amber-800', icon: 'solar:hourglass-bold-duotone' },
  in_file: { label: 'Reversal in a credit file, not sent yet', chip: 'bg-blue-100 text-blue-800', icon: 'solar:document-add-bold-duotone' },
  sent: { label: 'Reversal sent to the fund', chip: 'bg-green-100 text-green-800', icon: 'solar:check-circle-bold-duotone' },
  cancelled: { label: 'Reversal cancelled (credit note reversed)', chip: 'bg-gray-100 text-gray-700', icon: 'solar:close-circle-bold-duotone' }
};
