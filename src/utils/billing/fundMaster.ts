/**
 * The Medical aid funds screen in plain rules (tested): what OneHealth support types for a fund, checked the way
 * save_fund_rule checks it (proposals/2026-10-12-fund-master.sql) so a mistake is explained before saving, and a
 * fund's rules and changes in words for everyone who reads them.
 */
import { FUND_RULE_LIMITS, type FundRule } from './fundRules';

/** The edit form as typed */
export interface FundDraft {
  name: string;
  claimsEmail: string;
  claimsPortalUrl: string;
  logoUrl: string;
  deadlineAmount: string;
  deadlineUnit: 'days' | 'months';
  deadlineConfirmed: boolean;
  /** "9", "13 or 14" */
  membershipDigits: string;
  membershipHint: string;
  dependantCodeRequired: boolean;
  /** Empty: the general wait (30 days) */
  paymentTermsDays: string;
}

export type FundDraftField = keyof FundDraft;

/** What is saved (save_fund_rule's arguments, checked) */
export interface FundSave {
  name: string;
  claimsEmail: string | null;
  claimsPortalUrl: string | null;
  logoUrl: string | null;
  deadlineDays: number | null;
  deadlineMonths: number | null;
  deadlineConfirmed: boolean;
  membershipDigits: number[];
  membershipHint: string | null;
  dependantCodeRequired: boolean;
  paymentTermsDays: number | null;
}

/** The fund's own details (medical_aid_providers) */
export interface FundDetails {
  name: string;
  claimsEmail: string | null;
  logoUrl: string | null;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HTTPS = /^https:\/\/\S+$/;
const WHOLE = /^\d{1,4}$/;
const NAME_LENGTH = { min: 2, max: 100 };
const EMAIL_LENGTH = 200;
const PORTAL_LENGTH = 300;
const LOGO_LENGTH = 500;

/** The form filled in with what is in force for the fund */
export function fundDraftFrom(details: FundDetails, rule: FundRule): FundDraft {
  const months = rule.deadline.months;
  return {
    name: details.name,
    claimsEmail: details.claimsEmail ?? '',
    claimsPortalUrl: rule.claimsPortalUrl ?? '',
    logoUrl: details.logoUrl ?? '',
    deadlineAmount: String(months ?? rule.deadline.days ?? ''),
    deadlineUnit: months !== undefined ? 'months' : 'days',
    deadlineConfirmed: rule.confirmed,
    membershipDigits: rule.membershipDigits.join(' or '),
    membershipHint: rule.membershipHint ?? '',
    dependantCodeRequired: rule.dependantCodeRequired,
    paymentTermsDays: rule.paymentTermsDays === null ? '' : String(rule.paymentTermsDays)
  };
}

/**
 * Membership-number lengths as typed: "9", "13 or 14", "13, 14" or "13/14" give the lengths in order; empty gives
 * none (no check); anything else (a word, a length over 20, more than 4 lengths) is null.
 */
export function parseMembershipDigits(text: string): number[] | null {
  const parts = text.trim().split(/\s*(?:,|\/|\bor\b|\s)\s*/i).filter(Boolean);
  const { min, max, count } = FUND_RULE_LIMITS.membershipDigits;
  if (parts.some(part => !WHOLE.test(part))) return null;
  const lengths = [...new Set(parts.map(Number))].sort((a, b) => a - b);
  if (lengths.length > count || lengths.some(length => length < min || length > max)) return null;
  return lengths;
}

/** Checks the form; `save` is null while anything needs fixing (each problem is named on its field) */
export function checkFundDraft(draft: FundDraft): { errors: Partial<Record<FundDraftField, string>>; save: FundSave | null } {
  const errors: Partial<Record<FundDraftField, string>> = {};
  const name = draft.name.trim();
  if (name.length < NAME_LENGTH.min || name.length > NAME_LENGTH.max) errors.name = 'Give the fund\'s name (2 to 100 characters).';

  const email = draft.claimsEmail.trim();
  if (email && (!EMAIL.test(email) || email.length > EMAIL_LENGTH)) errors.claimsEmail = 'Type an email address, for example claims@fund.com.na.';
  const portal = draft.claimsPortalUrl.trim();
  if (portal && (!HTTPS.test(portal) || portal.length > PORTAL_LENGTH)) errors.claimsPortalUrl = 'A web address starting with https://.';
  const logo = draft.logoUrl.trim();
  if (logo && (!HTTPS.test(logo) || logo.length > LOGO_LENGTH)) errors.logoUrl = 'A web address starting with https://.';

  const limits = draft.deadlineUnit === 'months' ? FUND_RULE_LIMITS.deadlineMonths : FUND_RULE_LIMITS.deadlineDays;
  const amountText = draft.deadlineAmount.trim();
  const amount = WHOLE.test(amountText) ? Number(amountText) : NaN;
  if (!(amount >= limits.min && amount <= limits.max)) {
    errors.deadlineAmount = `Whole ${draft.deadlineUnit} from ${limits.min} to ${limits.max}.`;
  }

  const lengths = parseMembershipDigits(draft.membershipDigits);
  if (lengths === null) errors.membershipDigits = 'Lengths in digits, for example 9 or "13 or 14" (at most 4, each up to 20).';
  const hint = draft.membershipHint.trim();
  if (hint.length > FUND_RULE_LIMITS.hintLength) errors.membershipHint = `Keep the hint to ${FUND_RULE_LIMITS.hintLength} characters.`;

  const termsText = draft.paymentTermsDays.trim();
  const terms = termsText === '' ? null : WHOLE.test(termsText) ? Number(termsText) : NaN;
  const termLimits = FUND_RULE_LIMITS.paymentTermsDays;
  if (terms !== null && !(terms >= termLimits.min && terms <= termLimits.max)) {
    errors.paymentTermsDays = `Whole days from ${termLimits.min} to ${termLimits.max}, or leave it empty for 30 days.`;
  }

  if (Object.keys(errors).length > 0 || lengths === null) return { errors, save: null };
  return {
    errors,
    save: {
      name,
      claimsEmail: email || null,
      claimsPortalUrl: portal || null,
      logoUrl: logo || null,
      deadlineDays: draft.deadlineUnit === 'days' ? amount : null,
      deadlineMonths: draft.deadlineUnit === 'months' ? amount : null,
      deadlineConfirmed: draft.deadlineConfirmed,
      membershipDigits: lengths,
      membershipHint: hint || null,
      dependantCodeRequired: draft.dependantCodeRequired,
      paymentTermsDays: terms
    }
  };
}

/** save_fund_rule's named arguments */
export function saveFundRuleArgs(providerId: string, save: FundSave): Record<string, unknown> {
  return {
    p_provider_id: providerId,
    p_name: save.name,
    p_claims_email: save.claimsEmail,
    p_claims_portal_url: save.claimsPortalUrl,
    p_logo_url: save.logoUrl,
    p_deadline_days: save.deadlineDays,
    p_deadline_months: save.deadlineMonths,
    p_deadline_confirmed: save.deadlineConfirmed,
    p_membership_digits: save.membershipDigits,
    p_membership_hint: save.membershipHint,
    p_dependant_code_required: save.dependantCodeRequired,
    p_payment_terms_days: save.paymentTermsDays
  };
}

/** "9 digits", "13 or 14 digits"; null when the fund's lengths are not known */
export function describeMembership(rule: FundRule): string | null {
  return rule.membershipDigits.length > 0 ? `${rule.membershipDigits.join(' or ')} digits` : null;
}

type Values = Record<string, unknown> | null | undefined;

const yesNo = (value: unknown): string => (value === true ? 'yes' : value === false ? 'no' : 'not set');
const days = (value: unknown): string => (typeof value === 'number' ? `${value} days` : 'not set');
const textOf = (value: unknown): string => (typeof value === 'string' && value.trim() ? value.trim() : 'none');
const deadlineOf = (values: Values): string => {
  const months = values?.claim_deadline_months;
  const dayCount = values?.claim_deadline_days;
  if (typeof months === 'number') return `${months} months`;
  return typeof dayCount === 'number' ? `${dayCount} days` : 'not set';
};
const lengthsOf = (value: unknown): string =>
  Array.isArray(value) && value.length > 0 ? `${value.join(' or ')} digits` : 'not set';

const CHANGES: ReadonlyArray<{ label: string; read: (values: Values) => string }> = [
  { label: 'Name', read: values => textOf(values?.name) },
  { label: 'Claims email', read: values => textOf(values?.claims_email) },
  { label: 'Claims portal', read: values => textOf(values?.claims_portal_url) },
  { label: 'Logo', read: values => textOf(values?.logo_url) },
  { label: 'Claim deadline', read: deadlineOf },
  { label: 'Deadline confirmed', read: values => yesNo(values?.deadline_confirmed) },
  { label: 'Membership numbers', read: values => lengthsOf(values?.membership_digits) },
  { label: 'Membership hint', read: values => textOf(values?.membership_hint) },
  { label: 'Dependant code needed', read: values => yesNo(values?.dependant_code_required) },
  { label: 'Payment terms', read: values => days(values?.payment_terms_days) }
];

/** One change in the history in words: "Claim deadline: 120 days to 90 days" per detail that changed */
export function describeFundChange(oldValues: Values, newValues: Values): string[] {
  return CHANGES.flatMap(({ label, read }) => {
    const before = read(oldValues);
    const after = read(newValues);
    return before === after ? [] : [`${label}: ${before} to ${after}`];
  });
}
