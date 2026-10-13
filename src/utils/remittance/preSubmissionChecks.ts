/**
 * Checks to run on claim lines BEFORE they are sent, learned from what the funds rejected.
 *
 * The claim screen already checks ICD-10 codes, tooth numbers, duplicates within an invoice and
 * deadlines (src/utils/billing/claimValidation.ts). These add what only the funds' answers teach:
 *   dependant code  a dependant claimed without a dependant code is not found or matches several
 *                   people (Methealth 4; NHP "not registered" / "matched more than one beneficiary")
 *   membership      a membership number that does not look like the fund's (Methealth 4)
 *   already paid    a line the fund already paid (Methealth 18, Medscheme 23)
 *   resubmission    a line rejected for a reason a correction cannot change (467 option pays network
 *                   providers only, 375/24/8600 not covered, 246/514 limits) resent unchanged: rejected
 *                   again, as NMC did with 45 lines in one batch
 *   combinations    two codes on one visit that this fund already refused together (202)
 *   quantities      more units of a code per visit than this fund has ever paid, for a code it
 *                   rejected for quantity before (175)
 * They work for every discipline: codes and limits are learned from the practice's own remittances,
 * not from a dental list. Each issue names the fund code it prevents.
 */
import { isDependantRelationship, type ClaimLine } from '../billing/claimLine';
import { getFundRule } from '../billing/fundRules';
import { toCents } from '../billing/money';
import { identifyFund } from './funds';
import { numberKey, tariffKey } from './text';
import type { ReasonCategory } from './reasonCodes';

export interface PreSubmissionIssue {
  /** ClaimLine.key */
  lineKey: string;
  severity: 'error' | 'warning';
  /** The fund codes or messages this prevents */
  prevents: string;
  message: string;
}

const issue = (lineKey: string, severity: PreSubmissionIssue['severity'], prevents: string, message: string): PreSubmissionIssue => ({ lineKey, severity, prevents, message });

/** A dependant (spouse, child) must be claimed with the fund's dependant code ("01 JOHN"), unless the fund's rules say not */
export function checkDependantCode(line: ClaimLine): PreSubmissionIssue | null {
  if (!isDependantRelationship(line.relationshipToMainMember)) return null;
  if (!getFundRule(line.fundReference).dependantCodeRequired) return null;
  if (/^\d{2}\s/.test(line.patientName.trim())) return null;
  return issue(line.key, 'warning', 'Methealth 4; NHP "not registered" / "matched more than one beneficiary"',
    'This patient is a dependant but has no dependant code. Add the code from the membership card to the medical aid details, or the fund may not find the patient.');
}

/**
 * A membership number that does not look like the fund's: the lengths are the fund's rule (seen on every claim the
 * fund accepted: NMC 9 digits, NHP and NAMMED 11; kept on Administration > Medical aid funds). No lengths: no check.
 */
export function checkMembershipFormat(line: ClaimLine): PreSubmissionIssue | null {
  const rule = getFundRule(line.fundReference);
  const lengths = rule.membershipDigits;
  if (lengths.length === 0) return null;
  const digits = line.membershipNumber.replace(/\D/g, '');
  if (lengths.includes(digits.length) && digits.length === line.membershipNumber.replace(/[\s-]/g, '').length) return null;
  return issue(line.key, 'warning', 'Methealth 4 (patient not found)',
    `${rule.label} membership numbers have ${lengths.join(' or ')} digits; "${line.membershipNumber}" does not look like one. ${rule.membershipHint ?? 'Check it against the card.'}`);
}

/** What a remittance said about one line, as stored after import (no names needed) */
export interface RemittanceHistoryLine {
  fundCode: string | null;
  patientReference: string | null;
  memberNumber: string | null;
  serviceDate: string | null;
  tariffCode: string | null;
  claimedCents: number | null;
  paidCents: number;
  /** The deciding reason's category ('write_off' for 202-type refusals, 'hold' for quantity limits ...) */
  category: ReasonCategory | null;
  reasonCodes: string[];
}

const visitKey = (fund: string | null, reference: string | null, member: string | null, date: string | null): string =>
  `${identifyFund(fund)?.code ?? fund ?? ''}|${numberKey(reference)}|${numberKey(member)}|${date ?? ''}`;

const lineKeyOf = (fund: string | null, reference: string | null, member: string | null, date: string | null, tariff: string | null, cents: number | null) =>
  `${visitKey(fund, reference, member, date)}|${tariffKey(tariff)}|${cents ?? ''}`;

/** A line the fund already paid is not claimed again */
export function checkAlreadyPaid(lines: readonly ClaimLine[], history: readonly RemittanceHistoryLine[]): PreSubmissionIssue[] {
  const paid = new Map<string, number>();
  for (const entry of history) {
    if (entry.paidCents <= 0) continue;
    const key = lineKeyOf(entry.fundCode, entry.patientReference, entry.memberNumber, entry.serviceDate, entry.tariffCode, entry.claimedCents);
    paid.set(key, (paid.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const issues: PreSubmissionIssue[] = [];
  for (const line of lines) {
    const key = lineKeyOf(line.fundReference, line.patientReference, line.membershipNumber, line.serviceDate, line.tariffCode, Number.isFinite(line.amount) ? toCents(line.amount) : null);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count <= (paid.get(key) ?? 0)) {
      issues.push(issue(line.key, 'error', 'Methealth 18, Medscheme 23 (already paid)', `The fund already paid code ${line.tariffCode} for this patient on ${line.serviceDate ?? 'this date'}. Remove the line unless it is a second, different service.`));
    }
  }
  return issues;
}

/** Categories a corrected claim cannot change: resending them unchanged is rejected again */
const FINAL_CATEGORIES: readonly ReasonCategory[] = ['patient_liable', 'write_off', 'duplicate'];

/**
 * A resubmitted line (field 32 set) whose earlier rejection was final may only go again when the
 * membership changed (a new option, a corrected member): otherwise it is rejected again.
 */
export function checkResubmission(line: ClaimLine, earlier: { category: ReasonCategory; reasonCodes: string[] } | null, membershipChanged: boolean): PreSubmissionIssue | null {
  if (!line.resubmissionFlag || !earlier || !FINAL_CATEGORIES.includes(earlier.category) || membershipChanged) return null;
  const codes = earlier.reasonCodes.join('/') || 'its earlier reason';
  return issue(line.key, 'error', `Rejected again (${codes})`,
    `The fund refused this line for a reason a correction cannot change (${codes}). Bill the patient or write it off instead of resubmitting, unless the membership has changed.`);
}

export interface LearnedRules {
  /** fund|codeA|codeB (codes sorted) the fund refused together */
  combinations: Set<string>;
  /** fund|code -> the most units of the code per visit the fund has paid, for codes refused for quantity */
  quantityLimits: Map<string, number>;
}

/**
 * Learns, per fund, which code pairs were refused together (202-type: category write_off with
 * other codes on the same visit) and the highest quantity per visit paid for codes refused for
 * quantity (175-type: category hold with a quantity reason).
 */
export function learnFromRemittances(history: readonly RemittanceHistoryLine[]): LearnedRules {
  const byVisit = new Map<string, RemittanceHistoryLine[]>();
  for (const entry of history) {
    const key = visitKey(entry.fundCode, entry.patientReference, entry.memberNumber, entry.serviceDate);
    byVisit.set(key, [...(byVisit.get(key) ?? []), entry]);
  }
  const combinations = new Set<string>();
  const refusedForQuantity = new Set<string>();
  const paidUnits = new Map<string, number>();
  for (const visit of byVisit.values()) {
    const fund = identifyFund(visit[0].fundCode)?.code ?? visit[0].fundCode ?? '';
    const unitsPaid = new Map<string, number>();
    for (const entry of visit) {
      const code = tariffKey(entry.tariffCode);
      if (entry.paidCents > 0) unitsPaid.set(code, (unitsPaid.get(code) ?? 0) + 1);
      if (entry.category === 'write_off' && entry.reasonCodes.some(reason => reason === '202')) {
        for (const other of visit) {
          const otherCode = tariffKey(other.tariffCode);
          if (other === entry || other.paidCents <= 0 || otherCode === code) continue;
          combinations.add([fund, ...[code, otherCode].sort()].join('|'));
        }
      }
      if (entry.category === 'hold' && entry.reasonCodes.some(reason => reason === '175')) refusedForQuantity.add(`${fund}|${code}`);
    }
    unitsPaid.forEach((units, code) => {
      const key = `${fund}|${code}`;
      paidUnits.set(key, Math.max(paidUnits.get(key) ?? 0, units));
    });
  }
  const quantityLimits = new Map<string, number>();
  refusedForQuantity.forEach(key => quantityLimits.set(key, paidUnits.get(key) ?? 0));
  return { combinations, quantityLimits };
}

/** The lines of each visit against what the fund refused before */
export function checkLearnedRules(lines: readonly ClaimLine[], learned: LearnedRules): PreSubmissionIssue[] {
  const issues: PreSubmissionIssue[] = [];
  const visits = new Map<string, ClaimLine[]>();
  for (const line of lines) {
    const key = `${line.invoiceId ?? line.key}|${line.serviceDate ?? ''}`;
    visits.set(key, [...(visits.get(key) ?? []), line]);
  }
  for (const visit of visits.values()) {
    const fund = identifyFund(visit[0].fundReference)?.code ?? visit[0].fundReference;
    const codes = [...new Set(visit.map(line => tariffKey(line.tariffCode)))];
    for (let i = 0; i < codes.length; i += 1) {
      for (let j = i + 1; j < codes.length; j += 1) {
        const pair = [codes[i], codes[j]].sort();
        if (!learned.combinations.has([fund, ...pair].join('|'))) continue;
        const flagged = visit.find(line => tariffKey(line.tariffCode) === pair[1]) ?? visit[0];
        issues.push(issue(flagged.key, 'warning', 'Methealth 202 (may not be charged together)',
          `This fund refused codes ${pair[0]} and ${pair[1]} together before, and the patient may not be charged for the refused one. Check the NAMAF rule before sending both.`));
      }
    }
    const units = new Map<string, { count: number; line: ClaimLine }>();
    for (const line of visit) {
      const code = tariffKey(line.tariffCode);
      const entry = units.get(code) ?? { count: 0, line };
      entry.count += Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 1;
      units.set(code, entry);
    }
    units.forEach((entry, code) => {
      const limit = learned.quantityLimits.get(`${fund}|${code}`);
      if (limit === undefined || entry.count <= limit) return;
      issues.push(issue(entry.line.key, 'warning', 'Methealth 175 (quantity limit)',
        limit > 0
          ? `This fund has paid at most ${limit} of code ${entry.line.tariffCode} per visit and refused more for quantity before. Add a motivation or expect the extra to be refused.`
          : `This fund refused code ${entry.line.tariffCode} for quantity before. Add a motivation or check the fund's limit.`));
    });
  }
  return issues;
}
