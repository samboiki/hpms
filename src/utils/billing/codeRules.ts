/**
 * What happens when a practice bills a tariff code (parity E9, D13, O2): the practice's own rules per code, for every
 * discipline, kept in practice_tariff_rules (proposals/2026-10-13-tariff-code-rules.sql) and set on Admin > Tariffs >
 * Practice tariff. Each rule does something where staff bill:
 * - needs the fund's authorisation number: a medical aid line of the code without one is flagged on the visit (funds
 *   refuse such lines);
 * - includes lab work / charged by time: the line asks staff to note the lab and its slip number, or the time it took,
 *   in the line's note (printed on the invoice) until they do; a claim gives the fund the minutes noted on a line
 *   charged by time (serviceTime.ts, claim field 18);
 * - a recall after a number of months: when the code is invoiced, staff are offered a recall for the patient on that
 *   date (recallOffer.tsx: one tap to set it, one to skip; a skip is remembered for the visit and code);
 * - a default place of service: fills the visit's place of service (claim field 42) when the visit has none;
 * - linked codes: the codes it brings with it, each with a quantity, added to the visit with it (linkedCodeLines.ts);
 *   staff see them before saving and can remove any.
 * "Do not claim" is not kept here: it is the practice's existing "Who pays: patient pays all" for the code (the
 * tariff_portions setting, lineSplit.ts), which keeps the code's lines out of every claim (invoice_services.paid_by,
 * honoured by sync_invoice_to_batch). The rules form shows it with the others and saves it there.
 * Dental practices keep their built-in linked codes (8346 after a restoration, 8109 once per visit: tariffRules.ts),
 * so those two cannot be linked again.
 * Pure: no database or React.
 */
import { addMonthsToKey, isValidDateKey } from './dates.ts';
import { MAX_QUANTITY } from './pricing.ts';
import { OWN_CODE_PATTERN } from './practiceTariffs.ts';
import { INFECTION_CONTROL_CODE, MATERIAL_FACTOR_CODE } from './tariffRules.ts';
import { parsePlaceOfService, placeOfServiceLabel } from './visitClaimDetails.ts';
import { minutesFromNote } from './serviceTime.ts';
import { RECALL_LIMITS, tidyRecallReason } from '../patientLists/recalls.ts';

/** A code that comes with another one, and how many of it */
export interface LinkedCode {
  code: string;
  /** Per line of the code; a code billed once per line comes as that many lines */
  quantity: number;
}

/** One code's rules as billing uses them */
export interface CodeRules {
  needsAuthorisation: boolean;
  labWork: boolean;
  timeBased: boolean;
  /** Months after the service the patient is recalled; null: no recall */
  recallMonths: number | null;
  /** What the recall is for; null: the code's description */
  recallReason: string | null;
  /** Two-digit PHISC place of service (claim field 42) the visit takes when it has none */
  placeOfService: string | null;
  linkedCodes: LinkedCode[];
}

export const NO_CODE_RULES: CodeRules = {
  needsAuthorisation: false,
  labWork: false,
  timeBased: false,
  recallMonths: null,
  recallReason: null,
  placeOfService: null,
  linkedCodes: []
};

/** The database's limits (save_practice_tariff_rules): the form says the same before anything is sent */
export const CODE_RULE_LIMITS = { recallMonthsMax: 60, linkedMax: 10, quantityMax: MAX_QUANTITY } as const;

/** The codes the app's dental rules add by themselves: never linked again in a dental practice */
const DENTAL_AUTOMATIC_CODES: readonly string[] = [MATERIAL_FACTOR_CODE, INFECTION_CONTROL_CODE];

export const codeKey = (code: string | null | undefined): string => (code ?? '').trim().toUpperCase();

export const hasAnyRule = (rules: CodeRules | null | undefined): boolean =>
  Boolean(
    rules &&
      (rules.needsAuthorisation || rules.labWork || rules.timeBased || rules.recallMonths !== null || rules.placeOfService || rules.linkedCodes.length > 0)
  );

// ---------------------------------------------------------------------------------------------------
// Reading the stored rules
// ---------------------------------------------------------------------------------------------------

/** A practice_tariff_rules row as PostgREST returns it */
export interface CodeRulesRow {
  code: string | null;
  needs_authorisation?: boolean | null;
  lab_work?: boolean | null;
  time_based?: boolean | null;
  recall_months?: number | null;
  recall_reason?: string | null;
  place_of_service?: string | null;
  linked_codes?: unknown;
}

const wholeNumber = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isInteger(number) ? number : null;
};

/** The linked codes as stored: anything unreadable is left out, so billing never adds a line it cannot explain */
export function parseLinkedCodes(value: unknown): LinkedCode[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const raw = (item as { code?: unknown }).code;
    const code = codeKey(typeof raw === 'string' ? raw : '');
    const quantity = wholeNumber((item as { quantity?: unknown }).quantity);
    if (!OWN_CODE_PATTERN.test(code) || seen.has(code) || quantity === null || quantity < 1 || quantity > MAX_QUANTITY) return [];
    seen.add(code);
    return [{ code, quantity }];
  });
}

/** One stored row as rules; null for a row without a usable code */
export function codeRulesFromRow(row: CodeRulesRow): { code: string; rules: CodeRules } | null {
  const code = codeKey(row.code);
  if (!OWN_CODE_PATTERN.test(code)) return null;
  const months = wholeNumber(row.recall_months);
  const recallMonths = months !== null && months >= 1 && months <= CODE_RULE_LIMITS.recallMonthsMax ? months : null;
  const reason = recallMonths !== null && typeof row.recall_reason === 'string' ? tidyRecallReason(row.recall_reason) : '';
  const place = parsePlaceOfService(row.place_of_service ?? null);
  return {
    code,
    rules: {
      needsAuthorisation: row.needs_authorisation === true,
      labWork: row.lab_work === true,
      timeBased: row.time_based === true,
      recallMonths,
      recallReason: reason.length >= RECALL_LIMITS.reasonMin ? reason : null,
      placeOfService: place.ok ? place.value : null,
      linkedCodes: parseLinkedCodes(row.linked_codes).filter(link => link.code !== code)
    }
  };
}

/** Every stored row by code */
export function codeRulesMap(rows: readonly CodeRulesRow[]): Map<string, CodeRules> {
  const map = new Map<string, CodeRules>();
  rows.forEach(row => {
    const read = codeRulesFromRow(row);
    if (read && hasAnyRule(read.rules)) map.set(read.code, read.rules);
  });
  return map;
}

/** Tariff rows with their code's rules attached (code_rules), as the visit screens bill from them */
export function withCodeRules<T extends { code: string | null }>(rows: readonly T[], rules: ReadonlyMap<string, CodeRules>): Array<T & { code_rules: CodeRules | null }> {
  return rows.map(row => ({ ...row, code_rules: rules.get(codeKey(row.code)) ?? null }));
}

/** A tariff as the rules are looked up on it */
export interface RuledTariff {
  code: string;
  description?: string | null;
  code_rules?: CodeRules | null;
}

/** The rules of a code among the tariffs; null when it has none */
export function rulesFor(tariffs: readonly RuledTariff[], code: string): CodeRules | null {
  const key = codeKey(code);
  return tariffs.find(tariff => codeKey(tariff.code) === key)?.code_rules ?? null;
}

// ---------------------------------------------------------------------------------------------------
// The rules form
// ---------------------------------------------------------------------------------------------------

/** What an administrator types for one code */
export interface CodeRulesDraft {
  needsAuthorisation: boolean;
  labWork: boolean;
  timeBased: boolean;
  /** Months as typed; empty for no recall */
  recallMonths: string;
  recallReason: string;
  placeOfService: string;
  linkedCodes: Array<{ code: string; quantity: string }>;
}

export const draftOfCodeRules = (rules: CodeRules | null | undefined): CodeRulesDraft => ({
  needsAuthorisation: rules?.needsAuthorisation ?? false,
  labWork: rules?.labWork ?? false,
  timeBased: rules?.timeBased ?? false,
  recallMonths: rules?.recallMonths ? String(rules.recallMonths) : '',
  recallReason: rules?.recallReason ?? '',
  placeOfService: rules?.placeOfService ?? '',
  linkedCodes: (rules?.linkedCodes ?? []).map(link => ({ code: link.code, quantity: String(link.quantity) }))
});

export interface CodeRulesContext {
  /** Dental practices: 8346 and 8109 come from the app's dental rules */
  dental: boolean;
  /** The codes billed on today's date, to say when a linked code has no price yet */
  billableCodes?: ReadonlySet<string>;
}

/**
 * Checks one code's rules as typed. Errors stop the save (each a plain sentence); warnings only inform (a linked code
 * that is not in the practice's list today is added once it is). An empty linked-code row is ignored.
 */
export function checkCodeRulesDraft(
  code: string,
  draft: CodeRulesDraft,
  context: CodeRulesContext
): { ok: true; rules: CodeRules; warnings: string[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const own = codeKey(code);

  let recallMonths: number | null = null;
  if (draft.recallMonths.trim() !== '') {
    const months = Number(draft.recallMonths.trim());
    if (Number.isInteger(months) && months >= 1 && months <= CODE_RULE_LIMITS.recallMonthsMax) recallMonths = months;
    else errors.push(`A recall is a whole number of months, 1 to ${CODE_RULE_LIMITS.recallMonthsMax}, after the visit.`);
  }
  const reason = tidyRecallReason(draft.recallReason);
  if (recallMonths !== null && reason !== '' && (reason.length < RECALL_LIMITS.reasonMin || reason.length > RECALL_LIMITS.reasonMax)) {
    errors.push(`Say what the recall is for in ${RECALL_LIMITS.reasonMin} to ${RECALL_LIMITS.reasonMax} characters, or leave it empty to use the code's description.`);
  }

  const place = parsePlaceOfService(draft.placeOfService);
  if (!place.ok) errors.push(place.message);

  const rows = draft.linkedCodes.filter(row => row.code.trim() !== '' || row.quantity.trim() !== '');
  const linkedCodes: LinkedCode[] = [];
  const dentalAutomatic = context.dental && DENTAL_AUTOMATIC_CODES.includes(own);
  if (dentalAutomatic && rows.length > 0) {
    errors.push(`${own} is added by the app's dental rules, so it cannot bring other codes. Link them to the procedure instead.`);
  }
  if (rows.length > CODE_RULE_LIMITS.linkedMax) errors.push(`A code brings at most ${CODE_RULE_LIMITS.linkedMax} other codes.`);
  rows.forEach(row => {
    const linked = codeKey(row.code);
    if (!OWN_CODE_PATTERN.test(linked)) {
      errors.push(`"${row.code.trim()}" is not a code: 1 to 10 letters or digits, as on the claim.`);
      return;
    }
    if (linked === own) {
      errors.push('A code cannot bring itself.');
      return;
    }
    if (context.dental && DENTAL_AUTOMATIC_CODES.includes(linked)) {
      errors.push(`${linked} is added by the app's dental rules already; leave it out.`);
      return;
    }
    if (linkedCodes.some(link => link.code === linked)) {
      errors.push(`${linked} is listed twice.`);
      return;
    }
    const quantity = row.quantity.trim() === '' ? 1 : Number(row.quantity.trim());
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > CODE_RULE_LIMITS.quantityMax) {
      errors.push(`The quantity of ${linked} is a whole number from 1 to ${CODE_RULE_LIMITS.quantityMax}.`);
      return;
    }
    if (context.billableCodes && !context.billableCodes.has(linked)) {
      warnings.push(`${linked} is not in your tariff list today: it is added with ${own} once it has a price.`);
    }
    linkedCodes.push({ code: linked, quantity });
  });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    warnings,
    rules: {
      needsAuthorisation: draft.needsAuthorisation,
      labWork: draft.labWork,
      timeBased: draft.timeBased,
      recallMonths,
      recallReason: recallMonths !== null && reason !== '' ? reason : null,
      placeOfService: place.ok ? place.value : null,
      linkedCodes
    }
  };
}

/** The save_practice_tariff_rules argument for checked rules */
export const codeRulesPayload = (rules: CodeRules) => ({
  needs_authorisation: rules.needsAuthorisation,
  lab_work: rules.labWork,
  time_based: rules.timeBased,
  recall_months: rules.recallMonths,
  recall_reason: rules.recallMonths !== null ? rules.recallReason : null,
  place_of_service: rules.placeOfService,
  linked_codes: rules.linkedCodes.map(link => ({ code: link.code, quantity: link.quantity }))
});

// ---------------------------------------------------------------------------------------------------
// In words
// ---------------------------------------------------------------------------------------------------

/** "6 months", "1 year", "18 months", "2 years" */
export function describeMonths(months: number): string {
  if (months % 12 === 0) return months === 12 ? '1 year' : `${months / 12} years`;
  return months === 1 ? '1 month' : `${months} months`;
}

/** "0201", "0201 x2" */
export const describeLinkedCode = (link: LinkedCode): string => (link.quantity > 1 ? `${link.code} x${link.quantity}` : link.code);

/** The rules in a few words each, for the tariff list ("Authorisation", "Recall in 6 months", "Brings 0201") */
export function describeCodeRules(rules: CodeRules | null | undefined): string[] {
  if (!rules) return [];
  const words: string[] = [];
  if (rules.needsAuthorisation) words.push('Authorisation');
  if (rules.labWork) words.push('Lab work');
  if (rules.timeBased) words.push('By time');
  if (rules.recallMonths !== null) words.push(`Recall in ${describeMonths(rules.recallMonths)}`);
  if (rules.placeOfService) words.push(`Place of service ${rules.placeOfService}`);
  if (rules.linkedCodes.length > 0) words.push(`Brings ${rules.linkedCodes.map(describeLinkedCode).join(', ')}`);
  return words;
}

/** The place of service in words for a hint ("11: Practitioner's rooms or a clinic") */
export const describePlaceOfService = (place: string): string => {
  const label = placeOfServiceLabel(place);
  return label ? `${place}: ${label}` : place;
};

// ---------------------------------------------------------------------------------------------------
// On the visit's billing lines
// ---------------------------------------------------------------------------------------------------

/** A billing line as the notices read it */
export interface RuleLine {
  code: string;
  paidBy?: string;
  authorisationNumber?: string;
  notes?: string;
}

/**
 * True when the note says how long the service took ("45 minutes", "1 hour", "1.5 h", "30 min"): exactly when the
 * claim can give the fund those minutes (serviceTime.ts)
 */
export const mentionsTime = (text: string | null | undefined): boolean => minutesFromNote(text) !== null;

/**
 * What a line still needs because of its code's rules, in plain words; empty when nothing. The fund's authorisation
 * number matters only on a medical aid line the fund is asked to pay (not a "patient pays all" line); the line's own
 * number or one it takes from the patient's authorisations (`registerAuthorisation`) both count.
 */
export function lineRuleNotices(
  line: RuleLine,
  rules: CodeRules | null | undefined,
  context: { hasMedicalAid: boolean; registerAuthorisation?: string | null }
): string[] {
  if (!rules) return [];
  const notices: string[] = [];
  const note = line.notes?.trim() ?? '';
  const ownNumber = line.authorisationNumber?.trim() ?? '';
  const registerNumber = line.authorisationNumber === undefined ? context.registerAuthorisation?.trim() ?? '' : '';
  if (rules.needsAuthorisation && context.hasMedicalAid && line.paidBy !== 'patient' && !ownNumber && !registerNumber) {
    notices.push(`${line.code} needs the fund's authorisation number: add it under Change, or the fund may refuse the line.`);
  }
  if (rules.labWork && !note) {
    notices.push(`${line.code} includes lab work: note the lab and its slip number under Change (it prints on the invoice).`);
  }
  if (rules.timeBased && !mentionsTime(note)) {
    notices.push(`${line.code} is charged by time: note how long it took under Change, for example "45 minutes" (it prints on the invoice).`);
  }
  return notices;
}

/**
 * The place of service a visit takes from its lines: the first line whose code has one (lines in the order added).
 * Null when none of the codes has one.
 */
export function placeOfServiceFor(lines: readonly { code: string }[], tariffs: readonly RuledTariff[]): { code: string; place: string } | null {
  for (const line of lines) {
    const place = rulesFor(tariffs, line.code)?.placeOfService;
    if (place) return { code: codeKey(line.code), place };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------
// Recalls offered when a code is invoiced (parity O2)
// ---------------------------------------------------------------------------------------------------

export interface RecallSuggestion {
  code: string;
  /** yyyy-MM-dd: the service date plus the code's months */
  dueOn: string;
  reason: string;
  months: number;
}

/** What a recall from a code is for: the practice's words, else the code's description, else "Check-up" */
const recallReasonOf = (rules: CodeRules, description: string | null | undefined): string => {
  const own = rules.recallReason ? tidyRecallReason(rules.recallReason) : '';
  if (own.length >= RECALL_LIMITS.reasonMin) return own.slice(0, RECALL_LIMITS.reasonMax);
  const fromDescription = tidyRecallReason(description ?? '');
  return fromDescription.length >= RECALL_LIMITS.reasonMin ? fromDescription.slice(0, RECALL_LIMITS.reasonMax).trim() : 'Check-up';
};

/**
 * The recalls to offer for an invoice's lines: one per code with a recall, dated the line's service date (else the
 * visit's) plus the code's months. A date already past, or more than five years ahead (the recall limit), is not
 * offered. The same date and reason twice is offered once; soonest first.
 */
export function recallSuggestions(
  lines: readonly { code: string; serviceDate?: string }[],
  tariffs: readonly RuledTariff[],
  context: { visitDate: string; today: string }
): RecallSuggestion[] {
  const latest = addMonthsToKey(context.today, RECALL_LIMITS.yearsAhead * 12);
  const suggestions: RecallSuggestion[] = [];
  lines.forEach(line => {
    const key = codeKey(line.code);
    const tariff = tariffs.find(item => codeKey(item.code) === key);
    const rules = tariff?.code_rules;
    if (!rules?.recallMonths) return;
    const from = line.serviceDate && isValidDateKey(line.serviceDate) ? line.serviceDate : context.visitDate;
    if (!isValidDateKey(from)) return;
    const dueOn = addMonthsToKey(from, rules.recallMonths);
    if (dueOn < context.today || dueOn > latest) return;
    const reason = recallReasonOf(rules, tariff?.description);
    if (suggestions.some(item => item.dueOn === dueOn && item.reason.toLowerCase() === reason.toLowerCase())) return;
    suggestions.push({ code: key, dueOn, reason, months: rules.recallMonths });
  });
  return suggestions.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.code.localeCompare(b.code));
}

/**
 * The suggestions the patient does not have yet: a recall for the same reason that is still to come (open or booked,
 * dated today or later) means it is already set, for example from an earlier save of the same visit.
 */
export function withoutKnownRecalls(
  suggestions: readonly RecallSuggestion[],
  recalls: readonly { reason: string; dueOn: string; status: string }[],
  today: string
): RecallSuggestion[] {
  const coming = recalls.filter(recall => (recall.status === 'open' || recall.status === 'booked') && recall.dueOn >= today);
  return suggestions.filter(suggestion => !coming.some(recall => recall.reason.trim().toLowerCase() === suggestion.reason.toLowerCase()));
}
