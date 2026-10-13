/**
 * Matching remittance lines to the practice's own claim lines (what was sent in the claim files).
 *
 * Funds do not send back the practice's invoice or line numbers; they echo the 7-digit patient
 * reference (claim field 4), the membership number, the service date, the tariff code and the amount
 * claimed. A SwitchOn report echoes the invoice reference instead (claim field 24, made by
 * claimInvoiceReference, so it is compared through that same function).
 *
 * Step 1, the visit: remittance lines are grouped per patient and service date, and each group is
 * compared with the claimed visits (invoice + service date) of the same fund:
 *   exact   reference + membership number + service date (plus the dependant code or a clear name
 *           match when a family had several patients that day): exactly one visit
 *   likely  only the reference or only the membership number matches the date; a name match within
 *           3 days; several visits fit equally; or staff picked the invoice
 *   none    nothing fits (e.g. a claim sent from the old system before go-live)
 * Step 2, the line, within the visit:
 *   exact   same tariff (leading zeros ignored) and same amount; or one unit of a quantity line the
 *           fund split into single items (quantity 2 of N$ 50 comes back as two lines of N$ 25); or
 *           a line plus the add-on lines right after it, paid as one line (Medscheme folds a material
 *           factor or modifier into its procedure line)
 *   likely  same tariff with a different amount (re-priced), or a line that was not on the claim
 * A line is exact only when both its visit and its line match are exact. Nothing "likely" is posted
 * until a person confirms it.
 *
 * Re-adjudication: each claim line carries what earlier remittances did with it, so a payment for a
 * line rejected before settles that rejection, and a line the fund marks "already paid" is linked to
 * the earlier payment instead of being paid twice.
 *
 * Nothing here assumes a discipline: any code, any quantity, tooth numbers optional.
 */
import { claimInvoiceReference } from '../billing/claimLine';
import { daysBetweenKeys } from '../billing/dates';
import { sameFund } from './funds';
import { nameSimilarity, numberKey, tariffKey } from './text';
import type { LineStatus, RemittanceDocument, RemittanceLine } from './types';

export type MatchConfidence = 'exact' | 'likely' | 'none';

export type RejectionStatus = 'open' | 'waiting' | 'resubmitted' | 'billed_patient' | 'written_off' | 'resolved_by_payment' | 'closed';

/** The latest rejection-queue item for a claim line (or for the line it was resubmitted from) */
export interface RejectionRef {
  id: string;
  status: RejectionStatus;
  /** The shortfall transfer or write-off staff posted for it, if any */
  adjustmentId: string | null;
  adjustmentKind: 'shortfall_transfer' | 'write_off' | null;
  adjustmentCents: number;
}

/** What earlier imports did with a claim line */
export interface ClaimLineHistory {
  /** Paid by remittances already posted */
  paidCents: number;
  lastStatus: LineStatus | null;
  rejection: RejectionRef | null;
}

/** One claim line as it was sent to the fund */
export interface ClaimCandidate {
  claimLineId: string;
  batchId: string | null;
  fundCode: string | null;
  invoiceId: string | null;
  invoiceNumber: string;
  patientId: string | null;
  patientName: string;
  /** The patient reference sent in field 4 */
  patientReference: string;
  membershipNumber: string;
  dependantCode: string | null;
  serviceDate: string | null;
  tariffCode: string;
  quantity: number;
  amountCents: number;
  toothNumbers: string;
  /** Line number in its batch: the order lines were sent in */
  lineNumber: number;
  history?: ClaimLineHistory | null;
}

export interface LineMatch {
  seq: number;
  confidence: MatchConfidence;
  /** How it was matched, in words */
  rule: string;
  groupKey: string;
  invoiceId: string | null;
  patientId: string | null;
  claimLineIds: string[];
  /** One unit of a quantity line the fund split: unit k of n */
  split: { unit: number; of: number } | null;
  /** The claim line was already paid by an earlier remittance */
  alreadyPaid: boolean;
  /** The rejection-queue item of the matched claim line, if it has one */
  rejection: RejectionRef | null;
  notes: string[];
}

export interface VisitOption {
  invoiceId: string;
  invoiceNumber: string;
  patientId: string | null;
  patientName: string;
  serviceDate: string | null;
  claimedCents: number;
  score: number;
}

export interface VisitGroup {
  key: string;
  seqs: number[];
  /** The remittance's own identifiers for the group (shown to staff) */
  label: { patientName: string | null; memberNumber: string | null; reference: string | null; serviceDate: string | null };
  confidence: MatchConfidence;
  rule: string;
  invoiceId: string | null;
  patientId: string | null;
  /** Staff chose the invoice (counts as a confirmation) */
  manual: boolean;
  /** Visits that could be this one, best first, for the picker */
  options: VisitOption[];
}

export interface MatchResult {
  lines: LineMatch[];
  groups: VisitGroup[];
}

export interface MatchOverrides {
  /** groupKey -> the invoice staff chose, or null to leave the group unmatched */
  invoiceByGroup?: Readonly<Record<string, string | null>>;
}

interface Visit {
  key: string;
  invoiceId: string | null;
  invoiceNumber: string;
  invoiceRefKey: string;
  patientId: string | null;
  patientName: string;
  refKey: string;
  memberKey: string;
  dependantCode: string | null;
  serviceDate: string | null;
  fundCode: string | null;
  lines: ClaimCandidate[];
  claimedCents: number;
}

const DUPLICATE_CODES = new Set(['18', '23']);
const NAME_DATE_WINDOW_DAYS = 3;
const SWITCH_WINDOW_DAYS = 180;

const personOf = (line: RemittanceLine): string =>
  line.dependantCode ? `dep:${line.dependantCode}` : line.patientName ? `name:${line.patientName.toUpperCase().replace(/[^A-Z]/g, '')}` : '';

/** The visit a remittance line belongs to: patient reference, member, person and date */
export function groupKeyOf(line: RemittanceLine): string {
  if (line.invoiceReference) return `inv:${numberKey(line.invoiceReference)}|${line.serviceDate ?? ''}`;
  const ref = numberKey(line.practiceReference);
  const member = numberKey(line.memberNumber);
  if (!ref && !member && !line.serviceDate) return `line:${line.seq}`;
  return `${ref}|${member}|${personOf(line)}|${line.serviceDate ?? ''}`;
}

function buildVisits(candidates: readonly ClaimCandidate[]): Visit[] {
  const visits = new Map<string, Visit>();
  for (const candidate of candidates) {
    const key = `${candidate.invoiceId ?? `line:${candidate.claimLineId}`}|${candidate.serviceDate ?? ''}`;
    let visit = visits.get(key);
    if (!visit) {
      visit = {
        key,
        invoiceId: candidate.invoiceId,
        invoiceNumber: candidate.invoiceNumber,
        invoiceRefKey: numberKey(claimInvoiceReference(candidate.invoiceNumber)),
        patientId: candidate.patientId,
        patientName: candidate.patientName,
        refKey: numberKey(candidate.patientReference),
        memberKey: numberKey(candidate.membershipNumber),
        dependantCode: candidate.dependantCode,
        serviceDate: candidate.serviceDate,
        fundCode: candidate.fundCode,
        lines: [],
        claimedCents: 0
      };
      visits.set(key, visit);
    }
    visit.lines.push(candidate);
    visit.claimedCents += candidate.amountCents;
  }
  for (const visit of visits.values()) visit.lines.sort((a, b) => a.lineNumber - b.lineNumber);
  return [...visits.values()];
}

interface Fit {
  visit: Visit;
  level: 0 | 2 | 4 | 5;
  score: number;
  rule: string;
  depMatch: boolean | null;
  name: number;
}

const tariffOverlap = (lines: readonly RemittanceLine[], visit: Visit): number => {
  if (lines.length === 0) return 0;
  const codes = new Set(visit.lines.map(line => tariffKey(line.tariffCode)));
  return lines.filter(line => codes.has(tariffKey(line.tariffRaw))).length / lines.length;
};

const daysApart = (a: string | null, b: string | null): number | null => (a && b ? Math.abs(daysBetweenKeys(a, b)) : null);

function fitOf(lines: readonly RemittanceLine[], visit: Visit): Fit {
  const first = lines[0];
  const none: Fit = { visit, level: 0, score: 0, rule: '', depMatch: null, name: 0 };
  const name = nameSimilarity(first.patientName, visit.patientName);

  // A SwitchOn claim: the invoice reference, on or after the service date
  if (first.invoiceReference) {
    const refKey = numberKey(first.invoiceReference);
    if (!refKey || refKey !== visit.invoiceRefKey) return none;
    const gap = first.serviceDate && visit.serviceDate ? daysBetweenKeys(visit.serviceDate, first.serviceDate) : null;
    if (gap !== null && (gap < 0 || gap > SWITCH_WINDOW_DAYS)) return none;
    const amountsAgree = first.claimedCents !== null && first.claimedCents === visit.claimedCents;
    return {
      visit,
      level: amountsAgree ? 2 : 4,
      score: (amountsAgree ? 10 : 6) + name,
      rule: amountsAgree ? 'invoice reference and amount' : 'invoice reference only (amount differs)',
      depMatch: null,
      name
    };
  }

  const refKey = numberKey(first.practiceReference);
  const memberKey = numberKey(first.memberNumber);
  const refMatch = !!refKey && (refKey === visit.refKey || refKey === visit.invoiceRefKey);
  const memberMatch = !!memberKey && memberKey === visit.memberKey;
  const gap = daysApart(first.serviceDate, visit.serviceDate);
  const sameDate = gap === 0;
  const depMatch = first.dependantCode && visit.dependantCode ? first.dependantCode === visit.dependantCode : null;
  if (depMatch === false && sameDate && refMatch && memberMatch) {
    // Same family, same day, another dependant: only a weak candidate
    return { visit, level: 5, score: 1 + name, rule: 'same family and date, other dependant', depMatch, name };
  }
  const overlap = tariffOverlap(lines, visit);
  let level: Fit['level'] = 0;
  let rule = '';
  if (sameDate && refMatch && (memberMatch || !memberKey)) {
    level = 2;
    rule = memberKey ? 'reference, member number and date' : 'reference and date';
  } else if (sameDate && (refMatch || memberMatch)) {
    level = 4;
    rule = refMatch ? 'reference and date (member number differs)' : 'member number and date (reference differs)';
  } else if (gap !== null && gap <= NAME_DATE_WINDOW_DAYS && name >= 0.5 && (refMatch || memberMatch) && overlap >= 0.5) {
    level = 5;
    rule = 'name and a date within 3 days';
  } else if (sameDate && name >= 0.75 && overlap >= 0.8) {
    level = 5;
    rule = 'name, date and codes (no reference or member number)';
  }
  if (level === 0) return none;
  const base = level === 2 ? 10 : level === 4 ? 6 : 3;
  return { visit, level, score: base + (depMatch ? 2 : 0) + name + overlap, rule, depMatch, name };
}

interface Slot {
  candidate: ClaimCandidate;
  used: boolean;
  /** Units not yet matched (a quantity line the fund splits into single items) */
  unitsLeft: number;
  units: number;
}

interface Assignment {
  claimLineIds: string[];
  exact: boolean;
  rule: string;
  split: { unit: number; of: number } | null;
  arbitrary: boolean;
}

const unitsOf = (candidate: ClaimCandidate): number => (Number.isInteger(candidate.quantity) && candidate.quantity > 1 ? candidate.quantity : 1);

/** The amount of one unit of a quantity line (null for quantity 1) */
const unitCents = (candidate: ClaimCandidate): number | null => (unitsOf(candidate) > 1 ? Math.round(candidate.amountCents / unitsOf(candidate)) : null);

const untouched = (slot: Slot): boolean => !slot.used && slot.unitsLeft === slot.units;

/** True when earlier remittances already paid the whole claim line */
const paidBefore = (candidate: ClaimCandidate): boolean => candidate.amountCents > 0 && (candidate.history?.paidCents ?? 0) >= candidate.amountCents;

/** Lines of one remittance visit onto the claim lines of one claimed visit */
function assignLines(lines: readonly RemittanceLine[], visit: Visit): Map<number, Assignment> {
  const slots: Slot[] = visit.lines.map(candidate => ({ candidate, used: false, unitsLeft: unitsOf(candidate), units: unitsOf(candidate) }));
  const result = new Map<number, Assignment>();
  const pending = lines.filter(line => line.tariffRaw !== null);
  const sameCode = (slot: Slot, line: RemittanceLine) => tariffKey(slot.candidate.tariffCode) === tariffKey(line.tariffRaw);

  // Lower is better: "already paid" goes with the line that was paid, a payment with a line still
  // unpaid, and a rejection first with the line that has no tooth number (when a tooth is the issue)
  const rankFor = (line: RemittanceLine) => (slot: Slot): number => {
    const duplicate = line.reasonCodes.some(code => DUPLICATE_CODES.has(code.replace(/^0+(?=d)/, '')));
    const wasPaid = paidBefore(slot.candidate);
    let rank = 0;
    if (duplicate) rank += wasPaid ? 0 : 10;
    else if (line.paidCents > 0) rank += wasPaid ? 10 : 0;
    if ((line.status === 'rejected' || line.status === 'pended') && slot.candidate.toothNumbers.trim()) rank += 1;
    return rank;
  };

  // A: same code and amount
  for (const line of pending) {
    const options = slots.filter(slot => untouched(slot) && sameCode(slot, line) && slot.candidate.amountCents === line.claimedCents);
    if (options.length === 0) continue;
    const rank = rankFor(line);
    options.sort((a, b) => rank(a) - rank(b) || a.candidate.lineNumber - b.candidate.lineNumber);
    options[0].used = true;
    result.set(line.seq, { claimLineIds: [options[0].candidate.claimLineId], exact: true, rule: 'same code and amount', split: null, arbitrary: options.length > 1 });
  }
  // B: one unit of a quantity line the fund split into single items (within a cent of rounding)
  for (const line of pending) {
    if (result.has(line.seq) || line.claimedCents === null) continue;
    const claimed = line.claimedCents;
    const slot = slots.find(item => !item.used && item.unitsLeft > 0 && sameCode(item, line) && unitCents(item.candidate) !== null
      && Math.abs((unitCents(item.candidate) ?? 0) - claimed) <= 1);
    if (!slot) continue;
    const unit = slot.units - slot.unitsLeft + 1;
    slot.unitsLeft -= 1;
    result.set(line.seq, { claimLineIds: [slot.candidate.claimLineId], exact: true, rule: `unit ${unit} of ${slot.units} (the fund split the quantity)`, split: { unit, of: slot.units }, arbitrary: false });
  }
  // C: a line paid together with the add-on lines that follow it (material factor, modifier)
  for (const line of pending) {
    if (result.has(line.seq) || line.claimedCents === null) continue;
    const claimed = line.claimedCents;
    for (let index = 0; index < slots.length; index += 1) {
      const head = slots[index];
      if (!untouched(head) || !sameCode(head, line)) continue;
      let total = head.candidate.amountCents;
      const group = [head];
      for (let next = index + 1; next < slots.length && group.length < 3 && total < claimed; next += 1) {
        if (!untouched(slots[next])) break;
        total += slots[next].candidate.amountCents;
        group.push(slots[next]);
      }
      if (group.length > 1 && total === claimed) {
        group.forEach(slot => { slot.used = true; });
        result.set(line.seq, { claimLineIds: group.map(slot => slot.candidate.claimLineId), exact: true, rule: 'the line and its add-on line(s) paid as one', split: null, arbitrary: false });
        break;
      }
    }
  }
  // D: same code, different amount (re-priced)
  for (const line of pending) {
    if (result.has(line.seq)) continue;
    const slot = slots.find(item => untouched(item) && sameCode(item, line));
    if (!slot) continue;
    slot.used = true;
    result.set(line.seq, { claimLineIds: [slot.candidate.claimLineId], exact: false, rule: 'same code, different amount', split: null, arbitrary: false });
  }
  return result;
}

/** Remittance lines -> claim lines, with a confidence for each */
export function matchRemittance(doc: RemittanceDocument, candidates: readonly ClaimCandidate[], overrides: MatchOverrides = {}): MatchResult {
  const pool = candidates.filter(candidate => !doc.fundCode || !candidate.fundCode || sameFund(doc.fundCode, candidate.fundCode));
  const visits = buildVisits(pool);
  const byDate = new Map<string, Visit[]>();
  for (const visit of visits) {
    const key = visit.serviceDate ?? '';
    byDate.set(key, [...(byDate.get(key) ?? []), visit]);
  }
  const nearVisits = (date: string | null, wide: boolean): Visit[] => {
    if (!date) return visits;
    if (wide) return visits.filter(visit => visit.serviceDate !== null && Math.abs(daysBetweenKeys(date, visit.serviceDate)) <= SWITCH_WINDOW_DAYS);
    return visits.filter(visit => visit.serviceDate !== null && Math.abs(daysBetweenKeys(date, visit.serviceDate)) <= NAME_DATE_WINDOW_DAYS);
  };
  const candidateById = new Map(pool.map(candidate => [candidate.claimLineId, candidate]));

  const groupsInOrder: string[] = [];
  const linesByGroup = new Map<string, RemittanceLine[]>();
  for (const line of doc.lines) {
    const key = groupKeyOf(line);
    if (!linesByGroup.has(key)) {
      linesByGroup.set(key, []);
      groupsInOrder.push(key);
    }
    linesByGroup.get(key)?.push(line);
  }

  const matches: LineMatch[] = [];
  const groups: VisitGroup[] = [];
  for (const key of groupsInOrder) {
    const lines = linesByGroup.get(key) ?? [];
    const first = lines[0];
    const nearby = first.invoiceReference ? nearVisits(first.serviceDate, true) : nearVisits(first.serviceDate, false);
    const fits = nearby.map(visit => fitOf(lines, visit)).filter(fit => fit.level > 0).sort((a, b) => b.score - a.score);
    const options: VisitOption[] = fits.slice(0, 6).filter(fit => fit.visit.invoiceId).map(fit => ({
      invoiceId: fit.visit.invoiceId as string,
      invoiceNumber: fit.visit.invoiceNumber,
      patientId: fit.visit.patientId,
      patientName: fit.visit.patientName,
      serviceDate: fit.visit.serviceDate,
      claimedCents: fit.visit.claimedCents,
      score: Math.round(fit.score * 10) / 10
    }));

    let chosen: Visit | null = null;
    let confidence: MatchConfidence = 'none';
    let rule = 'no claim found with this reference, member number and date';
    let manual = false;
    const override = overrides.invoiceByGroup ? overrides.invoiceByGroup[key] : undefined;
    if (override !== undefined) {
      manual = true;
      if (override === null) {
        rule = 'left unmatched by staff';
      } else {
        const ofInvoice = visits.filter(visit => visit.invoiceId === override);
        chosen = ofInvoice.find(visit => visit.serviceDate === first.serviceDate) ?? ofInvoice[0] ?? null;
        confidence = chosen ? 'likely' : 'none';
        rule = chosen ? 'invoice chosen by staff' : 'the chosen invoice has no claim lines for this fund';
      }
    } else if (fits.length > 0) {
      const best = fits[0];
      const rivals = fits.filter(fit => fit !== best && fit.level === best.level);
      chosen = best.visit;
      rule = best.rule;
      if (best.level === 2 && rivals.length === 0) {
        confidence = 'exact';
      } else if (best.level === 2 && rivals.every(rival => (best.depMatch === true && rival.depMatch === false) || (best.name >= 0.75 && rival.name <= 0.25))) {
        confidence = 'exact';
        rule = `${best.rule}; ${best.depMatch ? 'dependant code' : 'patient name'} tells the family members apart`;
      } else {
        confidence = 'likely';
        if (rivals.length > 0) rule = `${best.rule}; ${rivals.length + 1} claims fit, check the patient`;
      }
    }

    groups.push({
      key,
      seqs: lines.map(line => line.seq),
      label: { patientName: first.patientName, memberNumber: first.memberNumber, reference: first.practiceReference ?? first.invoiceReference, serviceDate: first.serviceDate },
      confidence,
      rule,
      invoiceId: chosen?.invoiceId ?? null,
      patientId: chosen?.patientId ?? null,
      manual,
      options
    });

    const assignments = chosen && !first.invoiceReference ? assignLines(lines, chosen) : new Map<number, Assignment>();
    for (const line of lines) {
      if (!chosen) {
        matches.push({ seq: line.seq, confidence: 'none', rule, groupKey: key, invoiceId: null, patientId: null, claimLineIds: [], split: null, alreadyPaid: false, rejection: null, notes: [] });
        continue;
      }
      if (first.invoiceReference) {
        // A claim-level report: the whole invoice
        matches.push({
          seq: line.seq, confidence, rule, groupKey: key, invoiceId: chosen.invoiceId, patientId: chosen.patientId,
          claimLineIds: chosen.lines.map(candidate => candidate.claimLineId), split: null, alreadyPaid: false, rejection: null, notes: []
        });
        continue;
      }
      const assignment = assignments.get(line.seq);
      const notes: string[] = [];
      if (!assignment) notes.push('This line is not on the claim that was sent (or its code differs).');
      if (assignment?.arbitrary) notes.push('Several identical claim lines: the first open one was used.');
      const claimLines = (assignment?.claimLineIds ?? []).map(id => candidateById.get(id)).filter((item): item is ClaimCandidate => !!item);
      const alreadyPaid = claimLines.length > 0 && claimLines.every(paidBefore);
      const rejection = claimLines.map(item => item.history?.rejection ?? null).find((item): item is RejectionRef => !!item) ?? null;
      if (alreadyPaid && line.paidCents > 0) notes.push('An earlier remittance already paid this claim line.');
      if (rejection && line.paidCents > 0 && rejection.status !== 'resolved_by_payment' && rejection.status !== 'closed') notes.push('This pays a line the fund rejected before.');
      const lineConfidence: MatchConfidence = confidence === 'exact' && assignment?.exact ? 'exact' : 'likely';
      matches.push({
        seq: line.seq,
        confidence: lineConfidence,
        rule: assignment ? `${rule}; ${assignment.rule}` : `${rule}; line not found on the claim`,
        groupKey: key,
        invoiceId: chosen.invoiceId,
        patientId: chosen.patientId,
        claimLineIds: assignment?.claimLineIds ?? [],
        split: assignment?.split ?? null,
        alreadyPaid,
        rejection,
        notes
      });
    }
  }
  matches.sort((a, b) => a.seq - b.seq);
  return { lines: matches, groups };
}

export interface MatchSummary {
  exact: number;
  likely: number;
  none: number;
}

export function summarizeMatches(result: MatchResult): MatchSummary {
  return result.lines.reduce<MatchSummary>((summary, line) => {
    summary[line.confidence] += 1;
    return summary;
  }, { exact: 0, likely: 0, none: 0 });
}
