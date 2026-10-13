/**
 * What a fund's reason code means and what the practice should do about it.
 *
 * Every line the fund did not pay in full gets a category, and the category decides the posting:
 *   info            a note only (paid from savings, ...): nothing to do
 *   duplicate       already paid on an earlier remittance: nothing to post, nothing to bill
 *   fixable         a mistake on the claim (membership, dependant, tooth, diagnosis code, authorisation):
 *                   correct the claim line and resubmit it; never bill the patient for it
 *   hold            the fund may still pay (pended, quantity limits are often reviewed): keep it on the
 *                   fund and follow up; never bill the patient yet
 *   patient_liable  the fund will not pay and the patient may be charged (benefit exhausted, not
 *                   covered, network option)
 *   write_off       the fund will not pay AND the patient may not be charged (NAMAF combination
 *                   rule 202): a contractual write-off
 *   rate_shortfall  the fund paid its own rate: bill the patient or write off, by fund agreement
 *   review          a code this catalogue does not know: a person decides
 *
 * The codes come from the remittances analysed for the practice (Methealth: NMC, PSEMAS; Medscheme:
 * NHP, NAMMED). They are fund codes, not discipline codes: a GP's or specialist's remittance uses the
 * same lists. A code not listed here is classified from the wording printed on the document; that is
 * only a suggestion, so it never charges a patient or writes anything off without a person.
 */
import type { Administrator } from './types';

export type ReasonCategory = 'info' | 'duplicate' | 'fixable' | 'hold' | 'patient_liable' | 'write_off' | 'rate_shortfall' | 'review';

export type SuggestedAction = 'none' | 'resubmit' | 'wait' | 'bill_patient' | 'write_off' | 'review';

export interface ReasonRule {
  category: ReasonCategory;
  /** Plain English: what happened */
  meaning: string;
  /** What to do */
  action: string;
  /** True for notes that do not stop payment when the line was paid (e.g. no ICD-10 code in 2024) */
  informationalWhenPaid?: boolean;
}

export interface ReasonEntry extends ReasonRule {
  code: string;
  administrator: Exclude<Administrator, 'switchon' | 'unknown'>;
}

const methealth = (code: string, rule: ReasonRule): ReasonEntry => ({ code, administrator: 'methealth', ...rule });
const medscheme = (code: string, rule: ReasonRule): ReasonEntry => ({ code, administrator: 'medscheme', ...rule });

export const REASON_CATALOGUE: readonly ReasonEntry[] = [
  methealth('4', { category: 'fixable', meaning: 'The fund has no record of this patient as a member or dependant.', action: 'Check the membership number and dependant code against the card or with the fund, correct them and resubmit. These are usually paid after correction.' }),
  methealth('18', { category: 'duplicate', meaning: 'Already paid on an earlier statement.', action: 'Nothing to do: the earlier payment covers it. The patient may not be billed.' }),
  methealth('149', { category: 'patient_liable', meaning: 'Part paid from a booster or extra benefit; the rest is not covered.', action: 'Bill the patient for the balance.' }),
  methealth('172', { category: 'fixable', meaning: 'The fund records this tooth as already extracted.', action: 'Check the tooth number. Correct it and resubmit, or send the fund a motivation if it is right.' }),
  methealth('175', { category: 'hold', meaning: 'The quantity limit for this code was exceeded.', action: 'These are often reviewed and paid on a later statement. Wait; if still unpaid, send a motivation or bill the patient as the fund allows.' }),
  methealth('202', { category: 'write_off', meaning: 'These codes may not be charged together under the NAMAF billing rules, and the patient may not be charged either.', action: 'Write it off. Check the code combination before billing next time.' }),
  methealth('246', { category: 'patient_liable', meaning: "The family's overall annual limit has been reached.", action: 'Tell the patient and bill them.' }),
  methealth('375', { category: 'patient_liable', meaning: 'The fund does not cover this service or procedure (an exclusion).', action: 'Bill the patient.' }),
  methealth('388', { category: 'fixable', meaning: 'Possibly a duplicate item within the same claim.', action: 'If the items are different, add what tells them apart (tooth number, modifier or a note) and resubmit; otherwise remove the duplicate.' }),
  methealth('442', { category: 'fixable', meaning: 'The code is not valid for this tooth type.', action: 'Correct the tooth number or the code and resubmit.' }),
  methealth('467', { category: 'patient_liable', meaning: "The member's option pays only preferred or network providers.", action: 'Bill the patient. Do not resubmit unless the membership or option has changed.' }),

  medscheme('23', { category: 'duplicate', meaning: 'Duplicate of a line already processed.', action: 'Nothing to do if the earlier line was paid. The patient may not be billed.' }),
  medscheme('24', { category: 'patient_liable', meaning: "Not covered by the member's plan.", action: 'Bill the patient.' }),
  medscheme('153', { category: 'fixable', meaning: 'The tooth number is invalid.', action: 'Correct the tooth number and resubmit.' }),
  medscheme('154', { category: 'fixable', meaning: 'The tooth number is missing.', action: 'Add the tooth number and resubmit.' }),
  medscheme('504', { category: 'info', meaning: "Part paid from the member's savings or roll-over (the practice was paid in full).", action: 'Nothing to do.' }),
  medscheme('505', { category: 'info', meaning: "Paid from the member's savings or roll-over.", action: 'Nothing to do.' }),
  medscheme('514', { category: 'patient_liable', meaning: 'The benefit limit has been used up.', action: 'Bill the patient for what the fund did not pay.' }),
  medscheme('535', { category: 'rate_shortfall', meaning: "Reduced to the scheme's rate.", action: "Bill the patient for the difference or write it off, as the practice's agreement with the fund says." }),
  medscheme('5302', { category: 'fixable', meaning: 'No ICD-10 diagnosis code on the line.', action: 'Add the ICD-10 code and resubmit. Funds reject lines without one from 2025.', informationalWhenPaid: true }),
  medscheme('8600', { category: 'patient_liable', meaning: 'There is no benefit for this service.', action: 'Bill the patient.' })
];

/**
 * Wording -> category, for codes not in the catalogue and for documents that give text only (the
 * NHP acknowledgement, the assessment CSV notes). Checked in this order; the first match wins.
 */
const WORDING_RULES: ReadonlyArray<{ pattern: RegExp } & ReasonRule> = [
  { pattern: /already (been )?paid|previously paid|duplicate of a (line|claim) already/i, category: 'duplicate', meaning: 'The fund says this was already paid.', action: 'Find the earlier payment. The patient may not be billed.' },
  { pattern: /cannot be (charged|claimed|billed) together|not (be )?charged together|may not be charged|member not liable/i, category: 'write_off', meaning: 'The fund says this may not be charged, to the fund or to the patient.', action: 'Write it off, or ask the fund if the rule does not apply.' },
  { pattern: /must be (billed|charged|claimed) together/i, category: 'fixable', meaning: 'This code must be claimed together with another code.', action: 'Add the missing code to the claim and resubmit.' },
  { pattern: /without diagnosis|no diagnosis|icd-?10|diagnosis code/i, category: 'fixable', meaning: 'The ICD-10 diagnosis code is missing or not accepted.', action: 'Add or correct the ICD-10 code and resubmit.', informationalWhenPaid: true },
  { pattern: /tooth/i, category: 'fixable', meaning: 'The tooth number is missing or not valid for this code.', action: 'Add or correct the tooth number and resubmit.' },
  { pattern: /more than one (of the member'?s )?beneficiar/i, category: 'fixable', meaning: "The patient matched more than one of the member's dependants.", action: "Send the dependant code with the patient's full name and date of birth, then resubmit." },
  { pattern: /not (a )?registered|not on (the )?(fund|register)|unknown (member|beneficiary|dependant)|invalid (member|membership|dependant)/i, category: 'fixable', meaning: 'The fund cannot find this patient as a member or dependant.', action: 'Check the membership number and dependant code, correct them and resubmit.' },
  { pattern: /authori[sz]ation|pre-?auth/i, category: 'fixable', meaning: 'The fund needs an authorisation number for this service.', action: 'Get the authorisation number from the fund and resubmit with it.' },
  { pattern: /modifier cannot be reimbursed|procedure code has been rejected/i, category: 'fixable', meaning: 'Rejected because the line it belongs to was rejected.', action: 'Fix the main line and resubmit both.' },
  { pattern: /possible duplicate|duplicate item/i, category: 'fixable', meaning: 'Possibly a duplicate item within the claim.', action: 'Add what tells the items apart (tooth number, modifier or a note) and resubmit, or remove the duplicate.' },
  { pattern: /held for manual|manual intervention|for assessment|pended|under review/i, category: 'hold', meaning: 'The fund is still assessing this line.', action: 'Wait for the next remittance.' },
  { pattern: /quantity|maximum (number|qty)|frequency/i, category: 'hold', meaning: 'A quantity or frequency limit was exceeded.', action: 'Often reviewed and paid later. Wait; if still unpaid, send a motivation or bill the patient as the fund allows.' },
  { pattern: /preferred provider|network|designated service provider|\bdsp\b/i, category: 'patient_liable', meaning: "The member's option pays only its own network or preferred providers.", action: 'Bill the patient. Do not resubmit unless the membership changed.' },
  { pattern: /not covered|exclu|no benefit|not approved for/i, category: 'patient_liable', meaning: "The member's plan does not cover this service.", action: 'Bill the patient.' },
  { pattern: /limit|exhausted|exceeded|depleted|insufficient funds/i, category: 'patient_liable', meaning: 'A benefit limit has been reached.', action: 'Tell the patient and bill them.' },
  { pattern: /scheme rate|reduced to|tariff (rate|amount)|above tariff/i, category: 'rate_shortfall', meaning: "The fund paid its own rate.", action: "Bill the patient for the difference or write it off, as the practice's agreement with the fund says." },
  { pattern: /stale|older than|out of time|late submission|submission period/i, category: 'write_off', meaning: 'The claim reached the fund after its deadline.', action: 'Write it off as a missed deadline (claim_expired), unless the fund accepts a late motivation.' },
  { pattern: /savings|roll-?over/i, category: 'info', meaning: "Paid from the member's savings.", action: 'Nothing to do.' }
];

export type ReasonSource = 'catalogue' | 'wording' | 'unknown';

export interface ClassifiedReason extends ReasonRule {
  code: string | null;
  /** The fund's own words, when printed */
  fundText: string | null;
  source: ReasonSource;
}

const UNKNOWN: ReasonRule = {
  category: 'review',
  meaning: 'The fund gave a reason this system does not know yet.',
  action: "Read the fund's wording and decide: resubmit, bill the patient, write off or wait."
};

/** One code (with the fund's wording when known): the catalogue first, then the wording */
export function classifyReason(
  administrator: Administrator,
  code: string | null,
  fundText: string | null = null
): ClassifiedReason {
  const cleanCode = code ? code.trim().replace(/^0+(?=\d)/, '') : null;
  const entry = cleanCode ? REASON_CATALOGUE.find(item => item.code === cleanCode && item.administrator === administrator) : undefined;
  if (entry) return { ...entry, code: cleanCode, fundText, source: 'catalogue' };
  if (fundText) {
    const rule = WORDING_RULES.find(item => item.pattern.test(fundText));
    if (rule) {
      return {
        category: rule.category,
        meaning: rule.meaning,
        action: rule.action,
        informationalWhenPaid: rule.informationalWhenPaid,
        code: cleanCode,
        fundText,
        source: 'wording'
      };
    }
  }
  return { ...UNKNOWN, code: cleanCode, fundText, source: 'unknown' };
}

/** Which reason decides a line with several: the one that is safest to act on goes first */
export const CATEGORY_PRECEDENCE: readonly ReasonCategory[] = [
  'duplicate',      // nothing to post: never charge anyone twice
  'write_off',      // the patient may never be charged, whatever else is printed
  'review',         // an unknown reason must be read by a person before anyone is billed
  'patient_liable', // the fund will not pay: fixing the claim would not change that
  'fixable',
  'hold',
  'rate_shortfall',
  'info'
];

export interface LineReason {
  /** The deciding reason (null when the line has no reason at all) */
  primary: ClassifiedReason | null;
  all: ClassifiedReason[];
}

/**
 * The reasons on a line, classified, with the deciding one first. A line that was paid ignores
 * notes that do not stop payment (no ICD-10 code in 2024, paid from savings).
 */
export function classifyLineReasons(
  administrator: Administrator,
  codes: readonly string[],
  texts: readonly string[],
  legend: Readonly<Record<string, string>>,
  linePaidInFull: boolean
): LineReason {
  const all: ClassifiedReason[] = codes.map(code => classifyReason(administrator, code, legend[code.replace(/^0+(?=\d)/, '')] ?? legend[code] ?? null));
  // Text-only reasons (no code) are classified from their wording
  if (codes.length === 0) texts.forEach(text => all.push(classifyReason(administrator, null, text)));
  const relevant = linePaidInFull ? all.filter(reason => reason.category !== 'info' && !reason.informationalWhenPaid) : all;
  const ranked = [...relevant].sort((a, b) => CATEGORY_PRECEDENCE.indexOf(a.category) - CATEGORY_PRECEDENCE.indexOf(b.category));
  return { primary: ranked[0] ?? null, all };
}

export const CATEGORY_LABELS: Record<ReasonCategory, string> = {
  info: 'Note only',
  duplicate: 'Already paid',
  fixable: 'Fix and resubmit',
  hold: 'Fund may still pay',
  patient_liable: 'Patient pays',
  write_off: 'Write off (patient may not be charged)',
  rate_shortfall: 'Fund paid its own rate',
  review: 'Needs a decision'
};

export const SUGGESTED_ACTION: Record<ReasonCategory, SuggestedAction> = {
  info: 'none',
  duplicate: 'none',
  fixable: 'resubmit',
  hold: 'wait',
  patient_liable: 'bill_patient',
  write_off: 'write_off',
  rate_shortfall: 'bill_patient',
  review: 'review'
};

/**
 * Whether staff may ever move this line to the patient's account. Never for a line the fund says the
 * patient may not be charged for (202-type rules) or that was already paid; the database refuses it
 * too (proposals/2026-10-07-remittances.sql, claim_rejection_act).
 */
export const patientMayBeBilled = (category: ReasonCategory): boolean => category !== 'write_off' && category !== 'duplicate';
