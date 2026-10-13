/**
 * Posting rules: what each remittance line does to the practice's accounts.
 *
 * One receipt per payment (ar_post_receipt, source remittance_import, idempotent by the payment's
 * reference), with:
 *   - an allocation per paid line to the invoice's medical aid portion (the line id as reference);
 *   - a shortfall transfer per invoice for what the patient must now pay;
 *   - a write-off per invoice for what may not be charged to anyone (needs an admin or doctor);
 * and a rejection-queue item for every line that was not paid and needs someone to act.
 *
 * The rules, line by line (the reason decides, never the "member portion" column):
 *   paid in full                         allocate
 *   paid in full, part paid to member    allocate; the part the fund paid the member moves to the patient
 *   part paid, patient liable (514, 149, 246 ...)  allocate; the rest moves to the patient
 *   part paid, may not be charged (202)  allocate; the rest is written off, never billed
 *   part paid, rate shortfall (535, or paid exactly the fund's tariff)
 *                                        allocate; the rest is billed or written off by fund policy
 *                                        (PSEMAS: write off; private funds: bill the patient)
 *   part paid, PSEMAS 5% co-payment      allocate; the 5% moves to the patient (fund policy)
 *   part paid, fixable / fund may still pay / unknown reason
 *                                        allocate; the rest stays on the fund and is queued
 *   not paid                             the rejection queue: fix and resubmit, wait, bill the
 *                                        patient, write off, or decide (unknown reasons)
 *   not paid, already paid (18, 23)      nothing, when an earlier payment is on record; else queued
 *   no confirmed match                   the money stays on the receipt unallocated (suspense)
 *   a negative line (the fund took money back)  queued for a person; never automatic
 * A wording-only reason (a code this system does not know) is a suggestion: it can queue a line,
 * never charge a patient or write anything off by itself.
 *
 * Every amount is capped by what the invoice's medical aid portion still owes (the database refuses
 * more); what cannot be allocated stays on the receipt as credit, to allocate later.
 */
import { addDaysToKey, isValidDateKey } from '../billing/dates';
import { getFundRule, lastSubmissionDay } from '../billing/fundRules';
import type { MatchResult, LineMatch } from './matching';
import { reconciliationStatus } from './parseRemittance';
import {
  classifyLineReasons,
  patientMayBeBilled,
  SUGGESTED_ACTION,
  type ClassifiedReason,
  type ReasonCategory,
  type SuggestedAction
} from './reasonCodes';
import type { RemittanceDocument, RemittanceLine } from './types';

// ---------------------------------------------------------------------------------------------
// Fund policy (the practice's agreements; defaults from the analysis of its 2024 remittances)
// ---------------------------------------------------------------------------------------------

export interface FundPolicy {
  /** Claimed above the fund's own rate (code 535, or paid exactly the fund's tariff) */
  rateShortfall: 'bill_patient' | 'write_off';
  /** A fixed member co-payment the fund deducts with no code (PSEMAS: 5% on many codes) */
  coPayment: 'bill_patient' | 'write_off' | 'review';
  coPaymentPercent: number | null;
  /** Days to wait for a pended or "fund may still pay" line before following up (about 3 payment runs) */
  holdDays: number;
}

export const DEFAULT_POLICY: FundPolicy = { rateShortfall: 'bill_patient', coPayment: 'review', coPaymentPercent: null, holdDays: 30 };

export const FUND_POLICIES: Readonly<Record<string, FundPolicy>> = {
  // PSEMAS pays its own (lower) tariff: billing members above it is not done; 5% is a member co-payment
  MAG1: { rateShortfall: 'write_off', coPayment: 'bill_patient', coPaymentPercent: 5, holdDays: 21 },
  NMC1: { rateShortfall: 'bill_patient', coPayment: 'review', coPaymentPercent: null, holdDays: 42 },
  NHPM: { rateShortfall: 'bill_patient', coPayment: 'review', coPaymentPercent: null, holdDays: 21 },
  NAMM: { rateShortfall: 'bill_patient', coPayment: 'review', coPaymentPercent: null, holdDays: 21 }
};

export const policyFor = (fundCode: string | null | undefined): FundPolicy => (fundCode && FUND_POLICIES[fundCode]) || DEFAULT_POLICY;

// ---------------------------------------------------------------------------------------------
// One line
// ---------------------------------------------------------------------------------------------

export type LineOutcome = 'allocate' | 'queue' | 'duplicate' | 'suspense' | 'record' | 'none';

export type WriteOffCode = 'scheme_rate' | 'other';

export interface QueueDraft {
  category: ReasonCategory;
  suggestedAction: SuggestedAction;
  /** Plain English: what happened */
  plainReason: string;
  /** What to do */
  fixHint: string;
  /** The fund's own wording */
  fundReason: string | null;
  reasonCodes: string[];
  /** Money still at stake on the line */
  atStakeCents: number;
  /** Follow up on (hold) */
  followUpOn: string | null;
  /** The fund's deadline for a corrected claim */
  resubmitBy: string | null;
  /** A write-off that waits for an admin or doctor */
  needsApproval: boolean;
}

export interface LineDecision {
  seq: number;
  outcome: LineOutcome;
  /** Money to allocate to the invoice (before capping by what is owed) */
  allocateCents: number;
  /** To move to the patient */
  shortfallCents: number;
  shortfallReason: string | null;
  /** To write off */
  writeOffCents: number;
  writeOffCode: WriteOffCode | null;
  writeOffReason: string | null;
  queue: QueueDraft | null;
  reason: ClassifiedReason | null;
  /** In plain words, for the review screen */
  explanation: string;
}

export interface DecisionContext {
  doc: Pick<RemittanceDocument, 'kind' | 'administrator' | 'fundCode' | 'reasonLegend' | 'paymentDate' | 'documentDate'>;
  match: LineMatch | null;
  /** A "likely" match staff confirmed */
  confirmed: boolean;
  policy: FundPolicy;
  /** Money moves only for a payment (or a monthly statement whose payment was not posted) */
  postsMoney: boolean;
}

const nad = (cents: number): string => `N$ ${(cents / 100).toFixed(2)}`;

const codesText = (reason: ClassifiedReason | null): string => (reason?.code ? `code ${reason.code}` : 'no code');

function queueFrom(line: RemittanceLine, reason: ClassifiedReason | null, ctx: DecisionContext, atStakeCents: number, override?: Partial<QueueDraft>): QueueDraft {
  const category = override?.category ?? reason?.category ?? 'review';
  const baseDate = ctx.doc.paymentDate ?? ctx.doc.documentDate;
  const followUpOn = category === 'hold' && baseDate && isValidDateKey(baseDate) ? addDaysToKey(baseDate, ctx.policy.holdDays) : null;
  const resubmitBy = category === 'fixable' && line.serviceDate ? lastSubmissionDay(line.serviceDate, getFundRule(ctx.doc.fundCode)) : null;
  return {
    category,
    suggestedAction: SUGGESTED_ACTION[category],
    plainReason: reason?.meaning ?? 'The fund did not pay this line and gave no reason.',
    fixHint: reason?.action ?? 'Ask the fund why it was not paid.',
    fundReason: [...new Set([...line.reasonTexts, reason?.fundText ?? ''].filter(Boolean))].join(' / ') || null,
    reasonCodes: [...line.reasonCodes],
    atStakeCents,
    followUpOn,
    resubmitBy,
    needsApproval: false,
    ...override
  };
}

const decision = (seq: number, outcome: LineOutcome, explanation: string, reason: ClassifiedReason | null, extra: Partial<LineDecision> = {}): LineDecision => ({
  seq,
  outcome,
  allocateCents: 0,
  shortfallCents: 0,
  shortfallReason: null,
  writeOffCents: 0,
  writeOffCode: null,
  writeOffReason: null,
  queue: null,
  reason,
  explanation,
  ...extra
});

/** What one line does, by the rules above (before capping by what invoices owe) */
export function decideLine(line: RemittanceLine, ctx: DecisionContext): LineDecision {
  const claimed = Math.max(line.claimedCents ?? 0, 0);
  const paid = line.paidCents;
  const toMember = Math.max(line.paidToMemberCents, 0);
  const paidInFull = claimed > 0 && paid + toMember >= claimed;
  const { primary } = classifyLineReasons(ctx.doc.administrator, line.reasonCodes, line.reasonTexts, ctx.doc.reasonLegend, paidInFull);
  const matched = !!ctx.match?.invoiceId && (ctx.match.confidence === 'exact' || ctx.confirmed);

  // Responses before payment: record the outcome, queue what was rejected or pended
  if (!ctx.postsMoney) {
    if (line.status === 'rejected') {
      return decision(line.seq, 'queue', `Not accepted by the fund (${codesText(primary)}).`, primary, { queue: queueFrom(line, primary, ctx, claimed) });
    }
    if (line.status === 'pended') {
      const reason = primary ?? null;
      return decision(line.seq, 'queue', 'Pended: the fund is still assessing it.', reason, { queue: queueFrom(line, reason, ctx, claimed, { category: 'hold', suggestedAction: 'wait' }) });
    }
    return decision(line.seq, 'record', line.status === 'part_paid' ? 'Accepted in part: the payment will show what the patient owes.' : 'Accepted: payment to follow.', primary);
  }

  if (paid < 0) {
    return decision(line.seq, 'queue', `The fund took back ${nad(-paid)} on this line. Reverse the earlier payment by hand.`, primary, {
      queue: queueFrom(line, primary, ctx, -paid, { category: 'review', suggestedAction: 'review', plainReason: 'The fund took money back on this line (a recovery).', fixHint: 'Find the earlier payment of this line and reverse that allocation; the money is not on this receipt.' })
    });
  }
  if (claimed === 0 && paid === 0) return decision(line.seq, 'none', 'Nothing claimed and nothing paid.', primary);

  if (!matched) {
    if (paid > 0) {
      return decision(line.seq, 'suspense', `${nad(paid)} stays on the receipt as unallocated credit until the line is matched to a claim.`, primary);
    }
    return decision(line.seq, 'queue', 'Not paid, and not matched to a claim yet.', primary, { queue: queueFrom(line, primary, ctx, claimed) });
  }

  if (primary?.category === 'duplicate' && paid === 0) {
    if (ctx.match?.alreadyPaid) return decision(line.seq, 'duplicate', 'Already paid on an earlier remittance: nothing to post.', primary);
    return decision(line.seq, 'queue', 'The fund says it already paid this line, but no earlier payment is recorded here.', primary, {
      queue: queueFrom(line, primary, ctx, claimed, { category: 'review', suggestedAction: 'review', fixHint: 'Find the earlier payment (it may be from before OneHealth); the patient may not be billed for it.' })
    });
  }

  if (paid === 0) {
    if (toMember > 0) {
      return decision(line.seq, 'allocate', `The fund paid ${nad(toMember)} to the member: the patient pays the practice.`, primary, {
        shortfallCents: toMember,
        shortfallReason: 'The medical aid paid this to the member; the patient pays the practice'
      });
    }
    if (line.status === 'pended') {
      return decision(line.seq, 'queue', 'Pended by the fund.', primary, { queue: queueFrom(line, primary, ctx, claimed, { category: 'hold', suggestedAction: 'wait' }) });
    }
    return decision(line.seq, 'queue', `Not paid (${codesText(primary)}).`, primary, { queue: queueFrom(line, primary, ctx, claimed) });
  }

  if (ctx.match?.alreadyPaid) {
    return decision(line.seq, 'suspense', `An earlier remittance already paid this line: ${nad(paid)} stays as credit until someone checks it.`, primary);
  }

  // Paid (in full or in part) from here
  const policy = ctx.policy;
  const allocate = paid;
  const rest = Math.max(claimed - paid - toMember, 0);
  const memberShare: Partial<LineDecision> = toMember > 0
    ? { shortfallCents: toMember, shortfallReason: 'The medical aid paid part of this line to the member; the patient pays the practice' }
    : {};
  if (rest === 0) {
    return decision(line.seq, 'allocate', toMember > 0 ? `Paid; ${nad(toMember)} went to the member and moves to the patient.` : 'Paid in full.', primary, { allocateCents: allocate, ...memberShare });
  }

  const allocateWith = (extra: Partial<LineDecision>, explanation: string): LineDecision =>
    decision(line.seq, 'allocate', explanation, primary, {
      allocateCents: allocate,
      ...memberShare,
      ...extra,
      shortfallCents: (memberShare.shortfallCents ?? 0) + (extra.shortfallCents ?? 0)
    });
  const queueRest = (category: ReasonCategory, explanation: string, override?: Partial<QueueDraft>): LineDecision =>
    allocateWith({ queue: queueFrom(line, primary, ctx, rest, { category, suggestedAction: SUGGESTED_ACTION[category], ...override }) }, explanation);
  const rateShortfall = (): LineDecision =>
    policy.rateShortfall === 'write_off'
      ? allocateWith({ writeOffCents: rest, writeOffCode: 'scheme_rate', writeOffReason: 'The medical aid paid its own rate; the difference is not billed (practice policy)' }, `Paid at the fund's rate; ${nad(rest)} above it is written off (practice policy).`)
      : allocateWith({ shortfallCents: rest, shortfallReason: 'The medical aid paid its own rate; the difference is for the patient' }, `Paid at the fund's rate; ${nad(rest)} above it moves to the patient (practice policy).`);

  const category = primary?.category ?? null;
  const fromCatalogue = primary?.source === 'catalogue';

  if (category === 'write_off' && fromCatalogue) {
    return allocateWith({ writeOffCents: rest, writeOffCode: 'other', writeOffReason: `Fund ${codesText(primary)}: may not be charged to the fund or the patient` }, `Part paid; ${nad(rest)} may not be charged to anyone and is written off.`);
  }
  if (category === 'patient_liable' && fromCatalogue) {
    return allocateWith({ shortfallCents: rest, shortfallReason: `Not paid by the medical aid (${codesText(primary)}): ${primary?.meaning ?? ''}`.trim() }, `Part paid; ${nad(rest)} moves to the patient (${codesText(primary)}).`);
  }
  if (category === 'rate_shortfall' && fromCatalogue) return rateShortfall();
  if (category === 'fixable' || category === 'hold') {
    return queueRest(category, `Part paid; ${nad(rest)} stays on the fund (${codesText(primary)}).`);
  }
  if (category && category !== 'info') {
    // Known only from the wording, or unknown: a person decides
    return queueRest(category === 'duplicate' ? 'review' : category, `Part paid; ${nad(rest)} needs a decision (${codesText(primary)}).`);
  }

  // No reason given (or notes only): the funds' known patterns. Paid exactly the fund's own (lower)
  // tariff is a rate shortfall; a fixed share deducted from a line the fund rates in full is the
  // member's co-payment (PSEMAS 5%)
  if (line.tariffCents !== null && paid === line.tariffCents && line.tariffCents < claimed) return rateShortfall();
  const coPayment = policy.coPaymentPercent !== null && rest === Math.round((claimed * policy.coPaymentPercent) / 100)
    && (line.tariffCents === null || line.tariffCents >= claimed);
  if (coPayment && policy.coPayment === 'bill_patient') {
    return allocateWith({ shortfallCents: rest, shortfallReason: `Member co-payment of ${policy.coPaymentPercent}% deducted by the medical aid` }, `Paid less the ${policy.coPaymentPercent}% member co-payment: ${nad(rest)} moves to the patient.`);
  }
  if (coPayment && policy.coPayment === 'write_off') {
    return allocateWith({ writeOffCents: rest, writeOffCode: 'other', writeOffReason: `Member co-payment of ${policy.coPaymentPercent}% not collected (practice policy)` }, `Paid less the ${policy.coPaymentPercent}% co-payment: ${nad(rest)} is written off (practice policy).`);
  }
  return queueRest('review', `Paid ${nad(rest)} less than claimed without a reason.`, {
    plainReason: 'The fund paid less than claimed and gave no reason.',
    fixHint: 'Ask the fund why, then bill the patient, write it off or claim the rest again.'
  });
}

// ---------------------------------------------------------------------------------------------
// The whole document
// ---------------------------------------------------------------------------------------------

export interface InvoiceBalance {
  /** What the invoice's medical aid portion still owes */
  medicalAidOutstandingCents: number;
  /** What the patient portion still owes */
  patientOutstandingCents: number;
}

export interface PostingInput {
  doc: RemittanceDocument;
  matches: MatchResult;
  /** Group keys whose "likely" match staff confirmed (a picked invoice counts as confirmed) */
  confirmedGroups: ReadonlySet<string>;
  balances: Readonly<Record<string, InvoiceBalance>>;
  policy: FundPolicy;
  canApproveWriteOffs: boolean;
  /** yyyy-MM-dd */
  today: string;
  /** This payment was already posted (e.g. from its remittance advice): record lines only */
  paymentAlreadyPosted: boolean;
}

export interface PlannedAllocation {
  seq: number;
  invoiceId: string;
  amountCents: number;
}

export interface PlannedAdjustment {
  invoiceId: string;
  amountCents: number;
  reason: string;
  writeOffCode?: WriteOffCode;
  seqs: number[];
}

export interface PlannedRejection extends QueueDraft {
  seq: number;
  invoiceId: string | null;
  patientId: string | null;
  claimLineId: string | null;
  claimedCents: number;
  paidCents: number;
  /** The earlier queue item of the same claim line this one replaces (rejected again) */
  supersedesId: string | null;
}

export interface PlannedReversal {
  adjustmentId: string;
  kind: 'shortfall_transfer' | 'write_off';
  invoiceId: string;
  amountCents: number;
  reason: string;
}

export type PostingStatus = 'allocated' | 'shortfall' | 'written_off' | 'queued' | 'held' | 'suspense' | 'duplicate' | 'recorded' | 'no_action';

export interface LineResult {
  seq: number;
  status: PostingStatus;
  allocatedCents: number;
  shortfallCents: number;
  writtenOffCents: number;
  suspenseCents: number;
}

export interface PostingPlan {
  /** receipt: a payment to post; record: outcomes only (responses, or a payment already posted) */
  mode: 'receipt' | 'record';
  receiptAmountCents: number;
  allocations: PlannedAllocation[];
  shortfalls: PlannedAdjustment[];
  writeOffs: PlannedAdjustment[];
  rejections: PlannedRejection[];
  /** Earlier rejections this payment settles */
  resolves: Array<{ rejectionId: string; seq: number }>;
  /** Earlier shortfalls or write-offs to undo because the fund paid after all */
  reversals: PlannedReversal[];
  decisions: LineDecision[];
  lineResults: LineResult[];
  totals: {
    allocatedCents: number;
    suspenseCents: number;
    shortfallCents: number;
    writeOffCents: number;
    toResubmit: number;
    onHold: number;
    toBill: number;
    toWriteOff: number;
    toReview: number;
    duplicates: number;
  };
  /** Why it cannot be posted now (empty when it can) */
  blockers: string[];
  warnings: string[];
}

const UNSETTLED = new Set(['open', 'waiting', 'resubmitted', 'billed_patient', 'written_off']);

/** The full plan for one document: what will be posted, queued and settled */
export function buildPostingPlan(input: PostingInput): PostingPlan {
  const { doc, matches, confirmedGroups, balances, policy, canApproveWriteOffs, today } = input;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const carriesMoney = doc.kind === 'payment' || doc.kind === 'month_summary';
  const postsMoney = carriesMoney && !input.paymentAlreadyPosted;
  const receiptAmount = postsMoney ? Math.max(doc.totalPaidCents ?? 0, 0) : 0;

  const reconciliation = reconciliationStatus(doc);
  if (!reconciliation.ok && reconciliation.message) blockers.push(reconciliation.message);
  if (postsMoney && receiptAmount > 0) {
    if (!doc.paymentDate) blockers.push('The payment date could not be read from the document.');
    else if (doc.paymentDate > today) blockers.push(`The fund pays this on ${doc.paymentDate}. Post it on or after that day, when the money is in the bank.`);
  }
  if (carriesMoney && input.paymentAlreadyPosted) warnings.push('This payment was already posted from another file: its lines are recorded only, no money is posted again.');

  const matchBySeq = new Map(matches.lines.map(match => [match.seq, match]));
  const groupConfirmed = (match: LineMatch | undefined): boolean => {
    if (!match) return false;
    const group = matches.groups.find(item => item.key === match.groupKey);
    return confirmedGroups.has(match.groupKey) || !!group?.manual;
  };

  const remaining = new Map<string, InvoiceBalance>();
  const owed = (invoiceId: string): InvoiceBalance => {
    if (!remaining.has(invoiceId)) {
      const balance = balances[invoiceId];
      remaining.set(invoiceId, { medicalAidOutstandingCents: Math.max(balance?.medicalAidOutstandingCents ?? 0, 0), patientOutstandingCents: Math.max(balance?.patientOutstandingCents ?? 0, 0) });
      if (!balance) warnings.push('An invoice has no balance on record (it may be cancelled): money for it stays unallocated.');
    }
    return remaining.get(invoiceId) as InvoiceBalance;
  };

  // A monthly statement repeating a payment already posted (from its advice) only records its lines:
  // queueing them again would put every rejection in the queue twice
  const repeatsPostedPayment = carriesMoney && input.paymentAlreadyPosted;
  const decisions = doc.lines.map(line => {
    if (repeatsPostedPayment) return decision(line.seq, 'record', 'This payment was already posted from another file.', null);
    const match = matchBySeq.get(line.seq) ?? null;
    return decideLine(line, { doc, match, confirmed: groupConfirmed(match ?? undefined), policy, postsMoney });
  });

  // Settle earlier rejections first: undoing a shortfall or write-off gives the fund's portion back
  const resolves: PostingPlan['resolves'] = [];
  const reversals: PlannedReversal[] = [];
  if (postsMoney) {
    for (const item of decisions) {
      const match = matchBySeq.get(item.seq);
      const rejection = match?.rejection;
      if (item.allocateCents <= 0 || !match?.invoiceId || !rejection || !UNSETTLED.has(rejection.status)) continue;
      if (resolves.some(resolve => resolve.rejectionId === rejection.id)) continue;
      resolves.push({ rejectionId: rejection.id, seq: item.seq });
      if (!rejection.adjustmentId || !rejection.adjustmentKind || rejection.adjustmentCents <= 0) continue;
      const balance = owed(match.invoiceId);
      if (rejection.adjustmentKind === 'shortfall_transfer') {
        if (balance.patientOutstandingCents >= rejection.adjustmentCents) {
          reversals.push({ adjustmentId: rejection.adjustmentId, kind: 'shortfall_transfer', invoiceId: match.invoiceId, amountCents: rejection.adjustmentCents, reason: 'The medical aid paid this line after all' });
          balance.patientOutstandingCents -= rejection.adjustmentCents;
          balance.medicalAidOutstandingCents += rejection.adjustmentCents;
        } else {
          warnings.push('A line billed to a patient was paid by the fund after all, but the patient has paid already: refund the patient or allocate the credit by hand.');
        }
      } else if (canApproveWriteOffs) {
        reversals.push({ adjustmentId: rejection.adjustmentId, kind: 'write_off', invoiceId: match.invoiceId, amountCents: rejection.adjustmentCents, reason: 'The medical aid paid this line after all' });
        balance.medicalAidOutstandingCents += rejection.adjustmentCents;
      } else {
        warnings.push('A written-off line was paid after all. Only an admin or doctor can undo the write-off; until then its money stays unallocated.');
      }
    }
  }

  let receiptLeft = receiptAmount;
  const allocations: PlannedAllocation[] = [];
  const lineResults = new Map<number, LineResult>();
  const result = (seq: number): LineResult => {
    if (!lineResults.has(seq)) lineResults.set(seq, { seq, status: 'no_action', allocatedCents: 0, shortfallCents: 0, writtenOffCents: 0, suspenseCents: 0 });
    return lineResults.get(seq) as LineResult;
  };

  // 1. Allocations, in document order, never more than owed or than the receipt has left
  for (const item of decisions) {
    const match = matchBySeq.get(item.seq);
    const line = doc.lines.find(entry => entry.seq === item.seq);
    const paid = Math.max(line?.paidCents ?? 0, 0);
    const lineResult = result(item.seq);
    if (!postsMoney) continue;
    if (item.outcome === 'allocate' && match?.invoiceId && item.allocateCents > 0) {
      const balance = owed(match.invoiceId);
      const owedBefore = balance.medicalAidOutstandingCents;
      const receiptBefore = receiptLeft;
      const amount = Math.min(item.allocateCents, owedBefore, receiptBefore);
      if (amount > 0) {
        allocations.push({ seq: item.seq, invoiceId: match.invoiceId, amountCents: amount });
        balance.medicalAidOutstandingCents -= amount;
        receiptLeft -= amount;
      }
      lineResult.allocatedCents = amount;
      lineResult.suspenseCents = Math.max(item.allocateCents - amount, 0);
      if (amount < item.allocateCents) {
        warnings.push(receiptBefore < Math.min(item.allocateCents, owedBefore)
          ? 'The payment is less than the lines it pays (the fund took money back on another line): part of a line stays unallocated.'
          : 'More was paid than the invoice still owed the medical aid: the extra stays on the receipt as credit.');
      }
    } else if (paid > 0) {
      lineResult.suspenseCents = paid;
    }
  }

  // 2. Write-offs (may not be charged to anyone), then 3. shortfalls (the patient pays), per invoice
  const shortfalls = new Map<string, PlannedAdjustment>();
  const writeOffs = new Map<string, PlannedAdjustment>();
  const rejections: PlannedRejection[] = [];
  const queueLine = (item: LineDecision, draft: QueueDraft) => {
    const match = matchBySeq.get(item.seq);
    const line = doc.lines.find(entry => entry.seq === item.seq);
    const earlier = match?.rejection && (match.rejection.status === 'open' || match.rejection.status === 'waiting' || match.rejection.status === 'resubmitted') ? match.rejection.id : null;
    rejections.push({
      ...draft,
      seq: item.seq,
      invoiceId: match?.invoiceId ?? null,
      patientId: match?.patientId ?? null,
      claimLineId: match?.claimLineIds[0] ?? null,
      claimedCents: Math.max(line?.claimedCents ?? 0, 0),
      paidCents: line?.paidCents ?? 0,
      supersedesId: earlier
    });
  };

  for (const item of decisions) {
    const match = matchBySeq.get(item.seq);
    const lineResult = result(item.seq);
    if (postsMoney && item.writeOffCents > 0 && match?.invoiceId) {
      if (!canApproveWriteOffs) {
        queueLine(item, {
          ...queueFromDecision(item, 'write_off'),
          atStakeCents: item.writeOffCents,
          needsApproval: true
        });
      } else {
        const balance = owed(match.invoiceId);
        const amount = Math.min(item.writeOffCents, balance.medicalAidOutstandingCents);
        if (amount > 0) {
          const key = `${match.invoiceId}|${item.writeOffCode ?? 'other'}`;
          const entry = writeOffs.get(key) ?? { invoiceId: match.invoiceId, amountCents: 0, reason: item.writeOffReason ?? 'Not paid by the medical aid', writeOffCode: item.writeOffCode ?? 'other', seqs: [] };
          entry.amountCents += amount;
          entry.seqs.push(item.seq);
          writeOffs.set(key, entry);
          balance.medicalAidOutstandingCents -= amount;
          lineResult.writtenOffCents = amount;
        }
      }
    }
  }
  for (const item of decisions) {
    const match = matchBySeq.get(item.seq);
    const lineResult = result(item.seq);
    if (postsMoney && item.shortfallCents > 0 && match?.invoiceId) {
      const balance = owed(match.invoiceId);
      const amount = Math.min(item.shortfallCents, balance.medicalAidOutstandingCents);
      if (amount > 0) {
        const entry = shortfalls.get(match.invoiceId) ?? { invoiceId: match.invoiceId, amountCents: 0, reason: item.shortfallReason ?? 'Not paid by the medical aid', seqs: [] };
        entry.amountCents += amount;
        entry.seqs.push(item.seq);
        if (entry.reason !== item.shortfallReason && item.shortfallReason) entry.reason = 'Not paid by the medical aid (several reasons; see the remittance)';
        shortfalls.set(match.invoiceId, entry);
        balance.medicalAidOutstandingCents -= amount;
        lineResult.shortfallCents = amount;
      }
    }
    if (item.queue) queueLine(item, item.queue);
  }

  // Line statuses
  for (const item of decisions) {
    const lineResult = result(item.seq);
    const queued = rejections.find(entry => entry.seq === item.seq);
    if (queued) lineResult.status = queued.category === 'hold' ? 'held' : 'queued';
    else if (item.outcome === 'duplicate') lineResult.status = 'duplicate';
    else if (!postsMoney) lineResult.status = item.outcome === 'none' ? 'no_action' : 'recorded';
    else if (lineResult.writtenOffCents > 0) lineResult.status = 'written_off';
    else if (lineResult.shortfallCents > 0) lineResult.status = 'shortfall';
    else if (lineResult.allocatedCents > 0) lineResult.status = 'allocated';
    else if (lineResult.suspenseCents > 0) lineResult.status = 'suspense';
  }

  const allocated = allocations.reduce((sum, item) => sum + item.amountCents, 0);
  const shortfallList = [...shortfalls.values()];
  const writeOffList = [...writeOffs.values()];
  const count = (predicate: (item: PlannedRejection) => boolean) => rejections.filter(predicate).length;
  if (postsMoney && receiptAmount > 0 && allocated === 0) warnings.push('None of this payment can be allocated yet: confirm matches, or post it and allocate the credit later.');
  if (!canApproveWriteOffs && rejections.some(item => item.needsApproval)) warnings.push('Write-offs need an admin or doctor: they are put in the rejection queue for one of them to approve.');

  return {
    mode: postsMoney && receiptAmount > 0 ? 'receipt' : 'record',
    receiptAmountCents: receiptAmount,
    allocations,
    shortfalls: shortfallList,
    writeOffs: writeOffList,
    rejections,
    resolves,
    reversals,
    decisions,
    lineResults: [...lineResults.values()].sort((a, b) => a.seq - b.seq),
    totals: {
      allocatedCents: allocated,
      suspenseCents: Math.max(receiptAmount - allocated, 0),
      shortfallCents: shortfallList.reduce((sum, item) => sum + item.amountCents, 0),
      writeOffCents: writeOffList.reduce((sum, item) => sum + item.amountCents, 0),
      toResubmit: count(item => item.suggestedAction === 'resubmit'),
      onHold: count(item => item.suggestedAction === 'wait'),
      toBill: count(item => item.suggestedAction === 'bill_patient'),
      toWriteOff: count(item => item.suggestedAction === 'write_off'),
      toReview: count(item => item.suggestedAction === 'review'),
      duplicates: decisions.filter(item => item.outcome === 'duplicate').length
    },
    blockers,
    warnings: [...new Set(warnings)]
  };
}

/** A queue item for a decision whose write-off has to wait for an approver */
function queueFromDecision(item: LineDecision, category: ReasonCategory): QueueDraft {
  return {
    category,
    suggestedAction: SUGGESTED_ACTION[category],
    plainReason: item.reason?.meaning ?? 'The fund will not pay this, and the patient may not be charged.',
    fixHint: 'An admin or doctor approves the write-off.',
    fundReason: item.reason?.fundText ?? null,
    reasonCodes: item.reason?.code ? [item.reason.code] : [],
    atStakeCents: item.writeOffCents,
    followUpOn: null,
    resubmitBy: null,
    needsApproval: true
  };
}

/** Guard used by the screens and the database alike: a line may be billed to the patient only for these reasons */
export const mayBillPatient = (category: ReasonCategory): boolean => patientMayBeBilled(category);

/**
 * The key that makes posting a payment idempotent (receipts.external_ref): the same payment read
 * from a remittance advice and from the monthly statement gets the same key, so it is posted once.
 * Medscheme: the ACB payment reference. Methealth: fund + statement number. Null for documents
 * without money or without a reference (the file hash is used then).
 */
export function paymentKeyOf(doc: Pick<RemittanceDocument, 'kind' | 'administrator' | 'fundCode' | 'fundName' | 'statementNumber' | 'paymentReference'>): string | null {
  if (doc.kind !== 'payment' && doc.kind !== 'month_summary') return null;
  if (doc.administrator === 'methealth') {
    const number = doc.statementNumber ?? doc.paymentReference;
    return number ? `methealth:${(doc.fundCode ?? doc.fundName ?? 'fund').toUpperCase()}:${number.trim()}` : null;
  }
  return doc.paymentReference ? `${doc.administrator}:${doc.paymentReference.trim().toUpperCase()}` : null;
}
