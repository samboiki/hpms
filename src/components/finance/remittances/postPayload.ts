/**
 * The JSON the remittance RPCs take (proposals/2026-10-07-remittances.sql), built from the parsed
 * document and the posting plan. Pure, so what is sent can be tested: amounts go as text with 2
 * decimals (no binary rounding on the way to numeric(14,2)), and every allocation carries the id
 * of the remittance line it pays, which is how a receipt is traced back to the fund's line.
 */
import { buildReceiptPayload, centsToAmountText } from '../receipts/arPayloads';
import type { LineMatch, MatchResult } from '../../../utils/remittance/matching';
import type { PostingPlan } from '../../../utils/remittance/posting';
import { paymentKeyOf } from '../../../utils/remittance/posting';
import { displayTariff } from '../../../utils/remittance/text';
import { REMITTANCE_PARSER_VERSION, type RemittanceDocument } from '../../../utils/remittance/types';
import { reconciliationStatus } from '../../../utils/remittance/parseRemittance';

const amount = (cents: number | null | undefined): string | null => (cents === null || cents === undefined ? null : centsToAmountText(cents));

/** remittance_save_document payload */
export function buildSavePayload(input: {
  practiceId: string;
  fileName: string;
  sha256: string;
  partNumber: number;
  doc: RemittanceDocument;
}): Record<string, unknown> {
  const { doc } = input;
  return {
    practice_id: input.practiceId,
    file_name: input.fileName,
    file_sha256: input.sha256,
    part_number: input.partNumber,
    format: doc.format,
    kind: doc.kind,
    administrator: doc.administrator,
    fund_code: doc.fundCode,
    fund_name: doc.fundName,
    practice_number_on_doc: doc.practiceNumber,
    payment_reference: doc.paymentReference,
    statement_number: doc.statementNumber,
    payment_key: paymentKeyOf(doc),
    document_date: doc.documentDate,
    payment_date: doc.paymentDate,
    total_paid: amount(doc.totalPaidCents),
    total_claimed: amount(doc.totalClaimedCents),
    bank_account_last4: doc.bankAccountLast4,
    reconciled: reconciliationStatus(doc).ok,
    reconciliation: doc.checks.map(check => ({ label: check.label, expected: check.expectedCents, actual: check.actualCents, ok: check.ok, unit: check.unit ?? 'cents' })),
    reason_legend: doc.reasonLegend,
    warnings: doc.warnings,
    parser_version: REMITTANCE_PARSER_VERSION,
    lines: doc.lines.map(line => ({
      seq: line.seq,
      page: line.page,
      member_number: line.memberNumber,
      dependant_code: line.dependantCode,
      patient_name: line.patientName,
      member_name: line.memberName,
      practice_reference: line.practiceReference,
      invoice_reference: line.invoiceReference,
      service_date: line.serviceDate,
      tariff_code: line.tariffRaw ? displayTariff(line.tariffRaw) : null,
      description: line.description,
      quantity: line.quantity,
      claimed: amount(line.claimedCents),
      tariff_amount: amount(line.tariffCents),
      paid: amount(line.paidCents),
      member_portion: amount(line.memberPortionCents),
      levy: amount(line.levyCents),
      member_not_liable: amount(line.memberNotLiableCents),
      paid_to_member: amount(line.paidToMemberCents),
      line_status: line.status,
      reason_codes: line.reasonCodes,
      reason_texts: line.reasonTexts,
      fund_claim_ref: line.fundClaimRef,
      system_transaction_number: line.systemTransactionNumber
    }))
  };
}

/** How a line's match is stored: exact, likely, confirmed (a person agreed) or unmatched */
export function storedMatchStatus(match: LineMatch | undefined, confirmed: boolean): 'exact' | 'likely' | 'confirmed' | 'unmatched' {
  if (!match || !match.invoiceId || match.confidence === 'none') return 'unmatched';
  if (match.confidence === 'exact') return 'exact';
  return confirmed ? 'confirmed' : 'likely';
}

const isConfirmed = (matches: MatchResult, confirmedGroups: ReadonlySet<string>, match: LineMatch | undefined): boolean => {
  if (!match) return false;
  return confirmedGroups.has(match.groupKey) || !!matches.groups.find(group => group.key === match.groupKey)?.manual;
};

/** remittance_save_matches payload */
export function buildMatchesPayload(matches: MatchResult, confirmedGroups: ReadonlySet<string>, lineIds: Readonly<Record<number, string>>): Array<Record<string, unknown>> {
  return matches.lines
    .filter(match => !!lineIds[match.seq])
    .map(match => ({
      line_id: lineIds[match.seq],
      match_status: storedMatchStatus(match, isConfirmed(matches, confirmedGroups, match)),
      match_rule: match.rule,
      claim_line_ids: match.claimLineIds,
      invoice_id: match.invoiceId,
      patient_id: match.patientId
    }));
}

export interface PostContext {
  practiceId: string;
  documentId: string;
  /** seq -> remittance_lines.id */
  lineIds: Readonly<Record<number, string>>;
  /** The fund as the practice records it (medical_aid_providers.name), for the receipt */
  fundName: string;
  doc: RemittanceDocument;
  matches: MatchResult;
  confirmedGroups: ReadonlySet<string>;
  plan: PostingPlan;
}

/** remittance_post_document payload: receipt (or adjustments), reversals, line results, queue items, settled rejections */
export function buildPostPayload(context: PostContext): Record<string, unknown> {
  const { plan, lineIds, doc, documentId, matches, confirmedGroups } = context;
  const lineId = (seq: number): string => {
    const id = lineIds[seq];
    if (!id) throw new Error(`Line ${seq} has not been saved yet`);
    return id;
  };
  const shortfalls = plan.shortfalls.map(item => ({
    invoiceId: item.invoiceId,
    amountCents: item.amountCents,
    reason: item.reason,
    reasonCode: 'remittance',
    externalRef: `remittance:${documentId}:${item.invoiceId}`
  }));
  const writeOffs = plan.writeOffs.map(item => ({
    invoiceId: item.invoiceId,
    portion: 'medical_aid' as const,
    amountCents: item.amountCents,
    reasonCode: item.writeOffCode ?? 'other',
    reason: item.reason,
    externalRef: `remittance:${documentId}:${item.invoiceId}:${item.writeOffCode ?? 'other'}`
  }));

  const receipt = plan.mode === 'receipt'
    ? buildReceiptPayload({
      practiceId: context.practiceId,
      payerType: 'medical_aid',
      fundName: context.fundName,
      method: 'medical_aid',
      amountCents: plan.receiptAmountCents,
      receivedOn: doc.paymentDate,
      reference: doc.paymentReference ?? doc.statementNumber,
      notes: `Remittance import: ${doc.fundName ?? doc.fundCode ?? 'medical aid'} ${doc.paymentReference ?? doc.statementNumber ?? ''}`.trim(),
      source: 'remittance_import',
      externalRef: paymentKeyOf(doc),
      allocations: plan.allocations.map(item => ({ invoiceId: item.invoiceId, portion: 'medical_aid' as const, amountCents: item.amountCents, externalRef: lineId(item.seq) })),
      shortfalls,
      writeOffs
    })
    : null;

  const adjustments = receipt
    ? []
    : [
      ...writeOffs.map(item => ({ kind: 'write_off', invoice_id: item.invoiceId, portion: 'medical_aid', amount: centsToAmountText(item.amountCents), reason: item.reason, reason_code: item.reasonCode, external_ref: item.externalRef })),
      ...shortfalls.map(item => ({ kind: 'shortfall_transfer', invoice_id: item.invoiceId, amount: centsToAmountText(item.amountCents), reason: item.reason, reason_code: item.reasonCode, external_ref: item.externalRef }))
    ];

  const matchBySeq = new Map(matches.lines.map(match => [match.seq, match]));
  return {
    receipt,
    adjustments,
    reversals: plan.reversals.map(item => ({ adjustment_id: item.adjustmentId, reason: item.reason })),
    lines: plan.lineResults.map(result => {
      const match = matchBySeq.get(result.seq);
      return {
        line_id: lineId(result.seq),
        posting_status: result.status,
        allocated: centsToAmountText(result.allocatedCents),
        shortfall: centsToAmountText(result.shortfallCents),
        written_off: centsToAmountText(result.writtenOffCents),
        match_status: storedMatchStatus(match, isConfirmed(matches, confirmedGroups, match)),
        match_rule: match?.rule ?? null,
        claim_line_ids: match?.claimLineIds ?? [],
        invoice_id: match?.invoiceId ?? null,
        patient_id: match?.patientId ?? null
      };
    }),
    rejections: plan.rejections.map(item => ({
      line_id: lineId(item.seq),
      invoice_id: item.invoiceId,
      claim_line_id: item.claimLineId,
      patient_id: item.patientId,
      category: item.category,
      suggested_action: item.suggestedAction,
      plain_reason: item.plainReason,
      fix_hint: item.fixHint,
      fund_reason: item.fundReason,
      reason_codes: item.reasonCodes,
      at_stake: centsToAmountText(Math.max(item.atStakeCents, 0)),
      follow_up_on: item.followUpOn,
      resubmit_by: item.resubmitBy,
      needs_approval: item.needsApproval,
      supersedes_id: item.supersedesId
    })),
    resolves: plan.resolves.map(item => ({ rejection_id: item.rejectionId, line_id: lineId(item.seq) }))
  };
}
