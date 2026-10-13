/**
 * Batch review's checks learned from the funds' answers (src/utils/remittance/preSubmissionChecks.ts), shown on the
 * claim line they concern in plain English: a missing dependant code, a membership number that does not look like
 * the fund's, a line the fund already paid, a resubmission of a final rejection, codes the fund refused together and
 * quantities above what it pays. Errors block sending, warnings do not.
 *
 * They are added to validateClaimBatch's result the way it adds the NAMAF dental rules (per line), and the counts and
 * "can submit" are worked out again, so the numbers on the screen always match the lines. They apply to every
 * discipline: the codes and limits come from the practice's own remittances, not from a dental list. The dental
 * rules stay gated by practice type inside validateClaimBatch.
 */
import type { ClaimLine } from '../../../utils/billing/claimLine';
import type { BatchValidation, ClaimField, ClaimIssue } from '../../../utils/billing/claimValidation';
import {
  checkAlreadyPaid,
  checkDependantCode,
  checkLearnedRules,
  checkMembershipFormat,
  checkResubmission,
  learnFromRemittances,
  type PreSubmissionIssue,
  type RemittanceHistoryLine
} from '../../../utils/remittance/preSubmissionChecks';
import type { ReasonCategory } from '../../../utils/remittance/reasonCodes';

/** An earlier, final rejection of the line a resubmitted claim line replaces. */
export interface EarlierRejection {
  category: ReasonCategory;
  reasonCodes: string[];
  /** True when the member number changed since (a new option or a corrected member): then sending again may work */
  membershipChanged: boolean;
}

export interface PreSendHistory {
  /** What the funds paid and refused before; null when remittances are not set up or could not be read */
  remittanceLines: readonly RemittanceHistoryLine[] | null;
  /** By claim line key (batch_details.id) */
  earlierRejections: ReadonlyMap<string, EarlierRejection>;
}

export interface PreSendIssue extends PreSubmissionIssue {
  field: ClaimField;
}

const withField = (field: ClaimField, issue: PreSubmissionIssue | null): PreSendIssue[] => (issue ? [{ ...issue, field }] : []);

/** Every pre-send issue of a batch's lines. */
export function preSendIssues(lines: readonly ClaimLine[], history: PreSendHistory): PreSendIssue[] {
  const resubmission = (line: ClaimLine): PreSubmissionIssue | null => {
    const earlier = history.earlierRejections.get(line.key);
    return earlier ? checkResubmission(line, earlier, earlier.membershipChanged) : null;
  };
  const issues: PreSendIssue[] = lines.flatMap(line => [
    ...withField('patientName', checkDependantCode(line)),
    ...withField('membershipNumber', checkMembershipFormat(line)),
    ...withField('tariffCode', resubmission(line))
  ]);
  if (history.remittanceLines && history.remittanceLines.length > 0) {
    issues.push(...checkAlreadyPaid(lines, history.remittanceLines).map(issue => ({ ...issue, field: 'tariffCode' as const })));
    const learned = learnFromRemittances(history.remittanceLines);
    issues.push(
      ...checkLearnedRules(lines, learned).map(issue => ({ ...issue, field: (/quantity/i.test(issue.prevents) ? 'quantity' : 'tariffCode') as ClaimField }))
    );
  }
  return issues;
}

/** The issue as shown on the line: the plain-English reason, then the fund answer it avoids. */
export const describePreSendIssue = (issue: PreSubmissionIssue): string => `${issue.message} (Avoids: ${issue.prevents}.)`;

/** validateClaimBatch's result with the pre-send issues added to their lines and the totals worked out again. */
export function mergePreSendIssues(validation: BatchValidation, issues: readonly PreSendIssue[]): BatchValidation {
  if (issues.length === 0) return validation;
  const byLine = new Map<string, PreSendIssue[]>();
  issues.forEach(issue => byLine.set(issue.lineKey, [...(byLine.get(issue.lineKey) ?? []), issue]));
  const lines = validation.lines.map(result => {
    const own = byLine.get(result.key);
    if (!own) return result;
    const asIssues = (severity: ClaimIssue['severity']): ClaimIssue[] =>
      own.filter(issue => issue.severity === severity).map(issue => ({ field: issue.field, severity, message: describePreSendIssue(issue) }));
    return { ...result, errors: [...result.errors, ...asIssues('error')], warnings: [...result.warnings, ...asIssues('warning')] };
  });
  const batchErrors = validation.batchIssues.filter(issue => issue.severity === 'error').length;
  const batchWarnings = validation.batchIssues.filter(issue => issue.severity === 'warning').length;
  const errorCount = lines.reduce((count, line) => count + line.errors.length, 0) + batchErrors;
  const warningCount = lines.reduce((count, line) => count + line.warnings.length, 0) + batchWarnings;
  return {
    ...validation,
    lines,
    errorCount,
    warningCount,
    validLineCount: lines.filter(line => line.errors.length === 0).length,
    canSubmit: errorCount === 0 && lines.length > 0
  };
}
