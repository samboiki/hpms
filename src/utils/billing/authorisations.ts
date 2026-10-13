/**
 * Fund pre-authorisations (parity D15, F18): the register of authorisation numbers a fund gave for a patient, and which
 * billing lines carry them (claim field 31). Pure (no database), so the rules are tested directly; the database applies
 * the same rules when an authorisation is saved (save_patient_authorisation fills the lines already billed in its
 * window, proposals/2026-10-12-referrals-and-authorisations.sql).
 *
 * - An authorisation is from one fund (its claim code, for example MAG1), has a number a claim line can carry
 *   (parseAuthorisationNumber, lineSplit.ts: 1 to 21 letters or digits), a first and a last day, and covers every code
 *   or only the codes listed; it may allow a number of visits.
 * - A line gets the number when the patient is claimed from that fund, the line's date is in the window and its code is
 *   covered, and the authorisation is not used up: a visit that already carries the number counts once, another visit
 *   needs a visit left. Several match: a listed code wins over "all codes", then the newest authorisation.
 * - The number stays editable: a line whose number was typed or taken off keeps what staff chose; a line the patient
 *   pays all of is never claimed, so it gets none; a material line (8346) follows the line it belongs to.
 * - An authorisation that ended, has not started or is used up is named, so staff ask the fund before claiming.
 * Explicit .ts imports: the claim modules use these rules too.
 */
import { formatServiceDate, isValidDateKey } from './dates.ts';
import { normalizeFundReference } from './fundPricing.ts';
import { parseAuthorisationNumber, type PaidBy } from './lineSplit.ts';
import { OWN_CODE_PATTERN } from './practiceTariffs.ts';

/** The most codes one authorisation lists (the database refuses more) */
export const MAX_AUTHORISATION_CODES = 50;
export const MAX_VISITS_ALLOWED = 999;
export const MAX_AUTHORISATION_NOTE_LENGTH = 200;

/** An authorisation in the patient's register */
export interface PatientAuthorisation {
  id: string;
  patientId: string;
  /** The fund's claim code (MAG1, NMC1, NHPM, NAMM, PROS) */
  fundReference: string;
  number: string;
  /** yyyy-MM-dd */
  validFrom: string;
  validTo: string;
  allCodes: boolean;
  /** Tariff codes in capitals; empty when it covers every code */
  codes: string[];
  /** null: no limit */
  visitsAllowed: number | null;
  note: string | null;
  /** The quote it was made from */
  quoteId: string | null;
  removedAt: string | null;
  createdAt: string | null;
}

/** What staff type for an authorisation */
export interface AuthorisationDraft {
  fundReference: string;
  number: string;
  validFrom: string;
  validTo: string;
  allCodes: boolean;
  /** As typed: "0190, 0191" */
  codes: string;
  visitsAllowed: string;
  note: string;
  quoteId: string | null;
}

export type AuthorisationField = Exclude<keyof AuthorisationDraft, 'allCodes' | 'quoteId'>;

export interface AuthorisationValues {
  fundReference: string;
  number: string;
  validFrom: string;
  validTo: string;
  allCodes: boolean;
  codes: string[];
  visitsAllowed: number | null;
  note: string | null;
  quoteId: string | null;
}

/** The visits (their ids) whose invoice lines carry each number, by authorisationKey; cancelled invoices left out */
export type AuthorisationUsage = ReadonlyMap<string, ReadonlySet<string>>;

export const NO_USAGE: AuthorisationUsage = new Map();

/** Numbers compare without case and outer spaces */
export const authorisationKey = (number: string | null | undefined): string => (number ?? '').trim().toUpperCase();

const codeKey = (code: string | null | undefined): string => (code ?? '').trim().toUpperCase();

export const emptyAuthorisationDraft = (fundReference: string | null, today: string): AuthorisationDraft => ({
  fundReference: fundReference ?? '',
  number: '',
  validFrom: today,
  validTo: '',
  allCodes: false,
  codes: '',
  visitsAllowed: '',
  note: '',
  quoteId: null
});

export const draftOfAuthorisation = (authorisation: PatientAuthorisation): AuthorisationDraft => ({
  fundReference: authorisation.fundReference,
  number: authorisation.number,
  validFrom: authorisation.validFrom,
  validTo: authorisation.validTo,
  allCodes: authorisation.allCodes,
  codes: authorisation.codes.join(', '),
  visitsAllowed: authorisation.visitsAllowed === null ? '' : String(authorisation.visitsAllowed),
  note: authorisation.note ?? '',
  quoteId: authorisation.quoteId
});

/** Tariff codes as typed ("0190, 0191 0192"): in capitals, each once, in the order typed; those that are not codes apart */
export function parseCodeList(text: string): { codes: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).map(codeKey).filter(Boolean);
  const codes: string[] = [];
  const invalid: string[] = [];
  parts.forEach(part => {
    if (!OWN_CODE_PATTERN.test(part)) {
      if (!invalid.includes(part)) invalid.push(part);
    } else if (!codes.includes(part)) codes.push(part);
  });
  return { codes, invalid };
}

/** Checks an authorisation as typed; the database checks the same again */
export function validateAuthorisationDraft(
  draft: AuthorisationDraft
): { ok: true; value: AuthorisationValues } | { ok: false; errors: Partial<Record<AuthorisationField, string>> } {
  const errors: Partial<Record<AuthorisationField, string>> = {};
  const fund = normalizeFundReference(draft.fundReference);
  if (!/^[A-Z0-9]{2,10}$/.test(fund)) errors.fundReference = 'Choose the fund that gave the authorisation.';
  const number = parseAuthorisationNumber(draft.number);
  if (!number.ok) errors.number = number.message;
  else if (!number.value) errors.number = "Type the fund's authorisation number.";
  if (!isValidDateKey(draft.validFrom.trim())) errors.validFrom = 'Choose the first day it is valid.';
  if (!isValidDateKey(draft.validTo.trim())) errors.validTo = 'Choose the last day it is valid.';
  else if (isValidDateKey(draft.validFrom.trim()) && draft.validTo.trim() < draft.validFrom.trim()) errors.validTo = 'The last day cannot be before the first.';
  const { codes, invalid } = parseCodeList(draft.allCodes ? '' : draft.codes);
  if (!draft.allCodes) {
    if (invalid.length > 0) errors.codes = `Not a tariff code: ${invalid.join(', ')}.`;
    else if (codes.length === 0) errors.codes = 'List the codes it covers, or choose "All codes".';
    else if (codes.length > MAX_AUTHORISATION_CODES) errors.codes = `List at most ${MAX_AUTHORISATION_CODES} codes.`;
  }
  const visitsText = draft.visitsAllowed.trim();
  const visits = visitsText === '' ? null : Number(visitsText);
  if (visits !== null && (!Number.isInteger(visits) || visits < 1 || visits > MAX_VISITS_ALLOWED)) {
    errors.visitsAllowed = `Visits allowed is a whole number from 1 to ${MAX_VISITS_ALLOWED}, or empty for no limit.`;
  }
  const note = draft.note.trim();
  if (note.length > MAX_AUTHORISATION_NOTE_LENGTH) errors.note = `Keep the note to ${MAX_AUTHORISATION_NOTE_LENGTH} characters.`;

  if (Object.keys(errors).length > 0 || !number.ok || !number.value) return { ok: false, errors };
  return {
    ok: true,
    value: {
      fundReference: fund,
      number: number.value,
      validFrom: draft.validFrom.trim(),
      validTo: draft.validTo.trim(),
      allCodes: draft.allCodes,
      codes: draft.allCodes ? [] : codes,
      visitsAllowed: visits,
      note: note || null,
      quoteId: draft.quoteId
    }
  };
}

/**
 * Which visits carry each number, from the patient's invoice lines that have one: a cancelled invoice used nothing, and
 * several lines of one visit count once (save_patient_authorisation counts the same way).
 */
export function authorisationUsageFrom(
  lines: readonly { number: string | null | undefined; visitId: string | null | undefined; cancelled: boolean }[]
): Map<string, Set<string>> {
  const usage = new Map<string, Set<string>>();
  lines.forEach(line => {
    const key = authorisationKey(line.number);
    if (!key || !line.visitId || line.cancelled) return;
    usage.set(key, (usage.get(key) ?? new Set<string>()).add(line.visitId));
  });
  return usage;
}

/** The visits that carry an authorisation's number */
export const visitsUsing =(authorisation: Pick<PatientAuthorisation, 'number'>, usage: AuthorisationUsage): ReadonlySet<string> =>
  usage.get(authorisationKey(authorisation.number)) ?? new Set<string>();

export type AuthorisationState = 'active' | 'not_yet' | 'expired' | 'used_up' | 'removed';

/**
 * Where an authorisation stands on a day for a visit: removed, not started, ended, used up (every visit it allows is
 * taken by other visits), or active. `visitKey` is the visit being billed (null for a new visit or none).
 */
export function authorisationState(
  authorisation: Pick<PatientAuthorisation, 'number' | 'validFrom' | 'validTo' | 'visitsAllowed' | 'removedAt'>,
  onDate: string,
  usage: AuthorisationUsage,
  visitKey: string | null = null
): AuthorisationState {
  if (authorisation.removedAt) return 'removed';
  if (onDate < authorisation.validFrom) return 'not_yet';
  if (onDate > authorisation.validTo) return 'expired';
  const used = visitsUsing(authorisation, usage);
  if (authorisation.visitsAllowed !== null && !(visitKey && used.has(visitKey)) && used.size >= authorisation.visitsAllowed) return 'used_up';
  return 'active';
}

/** True when the authorisation covers a tariff code */
export const coversCode = (authorisation: Pick<PatientAuthorisation, 'allCodes' | 'codes'>, code: string): boolean =>
  authorisation.allCodes || authorisation.codes.includes(codeKey(code));

/** What the authorisation covers, in words: "codes 0190, 0191" or "all codes" */
export const describeCodes = (authorisation: Pick<PatientAuthorisation, 'allCodes' | 'codes'>): string =>
  authorisation.allCodes ? 'all codes' : `${authorisation.codes.length === 1 ? 'code' : 'codes'} ${authorisation.codes.join(', ')}`;

/** The authorisation's window and limits in one line: "1 Oct 2026 to 31 Dec 2026 · codes 0190, 0191 · 2 of 6 visits used" */
export function describeAuthorisation(authorisation: PatientAuthorisation, usage: AuthorisationUsage): string {
  const used = visitsUsing(authorisation, usage).size;
  return [
    `${formatServiceDate(authorisation.validFrom)} to ${formatServiceDate(authorisation.validTo)}`,
    describeCodes(authorisation),
    authorisation.visitsAllowed !== null
      ? `${used} of ${authorisation.visitsAllowed} ${authorisation.visitsAllowed === 1 ? 'visit' : 'visits'} used`
      : used > 0 ? `used on ${used} ${used === 1 ? 'visit' : 'visits'}` : null
  ].filter(Boolean).join(' · ');
}

/** A billing line as the authorisation rules need it (a ServiceSelection has these fields) */
export interface AuthorisationLine {
  id: string;
  code: string;
  /** yyyy-MM-dd; the visit's date when absent */
  serviceDate?: string | null;
  /** The line's own number: a string (typed, or '' when taken off) is kept as it is; absent follows the register */
  authorisationNumber?: string | null;
  paidBy?: PaidBy | null;
  isAutoGenerated?: boolean;
  parentServiceId?: string | null;
}

export interface AuthorisationContext {
  authorisations: readonly PatientAuthorisation[];
  usage: AuthorisationUsage;
  /** The fund the patient is claimed from; null: a private patient (or not known), so no line gets a number */
  fundReference: string | null;
  /** yyyy-MM-dd */
  visitDate: string;
  /** The visit being billed (its id), counted once towards "visits allowed"; null for a visit not saved yet */
  visitKey: string | null;
}

/** A number a line takes from the register (the authorisation it came from; null when it follows its procedure's typed number) */
export interface LineAuthorisation {
  number: string;
  authorisationId: string | null;
}

const lineDate = (line: AuthorisationLine, visitDate: string): string => (line.serviceDate && isValidDateKey(line.serviceDate) ? line.serviceDate : visitDate);

const ownNumber = (line: AuthorisationLine): string | null => (typeof line.authorisationNumber === 'string' ? line.authorisationNumber.trim() : null);

/** The authorisations of the patient's fund that are not removed */
const ofFund = (context: AuthorisationContext): PatientAuthorisation[] => {
  const fund = normalizeFundReference(context.fundReference);
  if (!fund) return [];
  return context.authorisations.filter(authorisation => !authorisation.removedAt && normalizeFundReference(authorisation.fundReference) === fund);
};

/** The best active authorisation for a code on a day: a listed code before "all codes", then the newest */
function bestAuthorisation(candidates: readonly PatientAuthorisation[], code: string, date: string, context: AuthorisationContext): PatientAuthorisation | null {
  const usable = candidates.filter(
    authorisation => coversCode(authorisation, code) && authorisationState(authorisation, date, context.usage, context.visitKey) === 'active'
  );
  usable.sort(
    (a, b) =>
      Number(a.allCodes) - Number(b.allCodes) ||
      b.validFrom.localeCompare(a.validFrom) ||
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '') ||
      a.id.localeCompare(b.id)
  );
  return usable[0] ?? null;
}

/**
 * The numbers lines take from the register: every line that follows the register (no number of its own) and is claimed
 * from the patient's fund, when an active authorisation covers its code on its date. A material line takes its
 * procedure's number, typed or from the register.
 */
export function suggestLineAuthorisations(lines: readonly AuthorisationLine[], context: AuthorisationContext): Map<string, LineAuthorisation> {
  const result = new Map<string, LineAuthorisation>();
  const candidates = ofFund(context);
  if (candidates.length === 0) return result;
  const byId = new Map(lines.map(line => [line.id, line]));
  const follows = (line: AuthorisationLine): boolean => Boolean(line.isAutoGenerated && line.parentServiceId && byId.has(line.parentServiceId));

  lines.forEach(line => {
    if (follows(line) || ownNumber(line) !== null || line.paidBy === 'patient') return;
    const best = bestAuthorisation(candidates, line.code, lineDate(line, context.visitDate), context);
    if (best) result.set(line.id, { number: best.number, authorisationId: best.id });
  });
  lines.forEach(line => {
    if (!follows(line) || ownNumber(line) !== null || line.paidBy === 'patient') return;
    const parent = byId.get(line.parentServiceId as string) as AuthorisationLine;
    const typed = ownNumber(parent);
    if (typed) result.set(line.id, { number: typed, authorisationId: null });
    else if (typed === null && result.has(parent.id)) result.set(line.id, result.get(parent.id) as LineAuthorisation);
  });
  return result;
}

/**
 * Why lines go to the fund without an authorisation they seem to need: an authorisation of the patient's fund covers a
 * line's code, but it ended before the line's date, starts after it, or is used up. Also a typed number of the
 * register used on a day outside its window. One sentence per authorisation, in register order.
 */
export function authorisationNotices(lines: readonly AuthorisationLine[], context: AuthorisationContext): string[] {
  const candidates = ofFund(context);
  if (candidates.length === 0) return [];
  const suggested = suggestLineAuthorisations(lines, context);
  const notices = new Map<string, string>();
  const note = (authorisation: PatientAuthorisation, message: string) => {
    if (!notices.has(authorisation.id)) notices.set(authorisation.id, message);
  };
  lines.forEach(line => {
    if (line.paidBy === 'patient') return;
    const date = lineDate(line, context.visitDate);
    const own = ownNumber(line);
    const covering = own
      ? candidates.filter(authorisation => authorisationKey(authorisation.number) === authorisationKey(own))
      : own === null && !suggested.has(line.id)
        ? candidates.filter(authorisation => coversCode(authorisation, line.code))
        : [];
    covering.forEach(authorisation => {
      const state = authorisationState(authorisation, date, context.usage, context.visitKey);
      if (state === 'expired') {
        note(authorisation, `Authorisation ${authorisation.number} ended on ${formatServiceDate(authorisation.validTo)}: code ${line.code} on ${formatServiceDate(date)} is not covered. Ask ${authorisation.fundReference} to extend it, or record a new one.`);
      } else if (state === 'not_yet') {
        note(authorisation, `Authorisation ${authorisation.number} starts on ${formatServiceDate(authorisation.validFrom)}: code ${line.code} on ${formatServiceDate(date)} is not covered.`);
      } else if (state === 'used_up') {
        const used = visitsUsing(authorisation, context.usage).size;
        note(authorisation, `Authorisation ${authorisation.number} is used up: ${used} of ${authorisation.visitsAllowed} visits. Ask ${authorisation.fundReference} for more visits, or record a new authorisation.`);
      }
    });
  });
  return candidates.filter(authorisation => notices.has(authorisation.id)).map(authorisation => notices.get(authorisation.id) as string);
}

/** A quote and its codes, to start a register entry from its pre-authorisation number */
export interface QuoteForAuthorisation {
  id: string;
  preauthNumber: string | null;
  /** yyyy-MM-dd */
  quoteDate: string;
  validUntil: string;
  codes: readonly string[];
}

/**
 * A register entry from a quote's pre-authorisation number: the quote's codes, from the quote's date to the last day
 * it is valid (staff correct the window to the fund's letter before saving). A number the claim cannot carry (over 21
 * characters, spaces) is refused with the reason: correct it on the quote first.
 */
export function draftFromQuote(quote: QuoteForAuthorisation, fundReference: string | null): { ok: true; draft: AuthorisationDraft } | { ok: false; message: string } {
  const number = parseAuthorisationNumber(quote.preauthNumber ?? '');
  if (!number.ok) return { ok: false, message: `The quote's pre-authorisation number cannot go on a claim: ${number.message}` };
  if (!number.value) return { ok: false, message: 'The quote has no pre-authorisation number yet.' };
  const { codes } = parseCodeList(quote.codes.join(' '));
  return {
    ok: true,
    draft: {
      fundReference: fundReference ?? '',
      number: number.value,
      validFrom: isValidDateKey(quote.quoteDate) ? quote.quoteDate : '',
      validTo: isValidDateKey(quote.validUntil) && (!isValidDateKey(quote.quoteDate) || quote.validUntil >= quote.quoteDate) ? quote.validUntil : '',
      allCodes: codes.length === 0,
      codes: codes.slice(0, MAX_AUTHORISATION_CODES).join(', '),
      visitsAllowed: '',
      note: '',
      quoteId: quote.id
    }
  };
}
