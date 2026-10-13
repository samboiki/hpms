/**
 * The Medical aid funds form. OneHealth support changes rules every practice's claims follow, so the form must never
 * change a rule nobody touched, must explain a mistake before the database refuses it, and the change history must say
 * in plain words what changed. Invented values only.
 */
import { describe, expect, it } from 'vitest';
import { FUND_RULES, getFundRule } from '../fundRules';
import {
  checkFundDraft,
  describeFundChange,
  describeMembership,
  fundDraftFrom,
  parseMembershipDigits,
  saveFundRuleArgs,
  type FundDraft
} from '../fundMaster';

const details = { name: 'Namibia Health Plan', claimsEmail: 'claims@example.invalid', logoUrl: null };
const nhp = getFundRule('NHPM');
const draft = (overrides: Partial<FundDraft> = {}): FundDraft => ({ ...fundDraftFrom(details, nhp), ...overrides });

describe('the fund form', () => {
  // Opening the form and saving without a change must save exactly what is in force (the database then records
  // nothing), for every fund: NHP's 4 calendar months must not turn into 120 days
  it.each(FUND_RULES.map(rule => ({ code: rule.key, rule })))('saves $code unchanged when nothing was touched', ({ rule }) => {
    const { save, errors } = checkFundDraft(fundDraftFrom(details, rule));
    expect(errors).toEqual({});
    expect(save).toEqual({
      name: details.name,
      claimsEmail: details.claimsEmail,
      claimsPortalUrl: null,
      logoUrl: null,
      deadlineDays: rule.deadline.days ?? null,
      deadlineMonths: rule.deadline.months ?? null,
      deadlineConfirmed: rule.confirmed,
      membershipDigits: [...rule.membershipDigits],
      membershipHint: rule.membershipHint,
      dependantCodeRequired: rule.dependantCodeRequired,
      paymentTermsDays: rule.paymentTermsDays
    });
  });

  it('reads membership-number lengths the way support types them', () => {
    expect(parseMembershipDigits('9')).toEqual([9]);
    expect(parseMembershipDigits('13 or 14')).toEqual([13, 14]);
    expect(parseMembershipDigits(' 14, 13 ')).toEqual([13, 14]);
    expect(parseMembershipDigits('13/14')).toEqual([13, 14]);
    expect(parseMembershipDigits('')).toEqual([]);
    expect(parseMembershipDigits('nine')).toBeNull();
    expect(parseMembershipDigits('21')).toBeNull();
    expect(parseMembershipDigits('6 7 8 9 10')).toBeNull();
  });

  // The database refuses these too (save_fund_rule); saying so on the field first saves a confusing error
  it.each([
    { label: 'a name of one letter', overrides: { name: 'N' }, field: 'name' },
    { label: 'an email without @', overrides: { claimsEmail: 'claims.example.invalid' }, field: 'claimsEmail' },
    { label: 'a portal that is not https', overrides: { claimsPortalUrl: 'http://portal.example.invalid' }, field: 'claimsPortalUrl' },
    { label: 'a logo that is not a web address', overrides: { logoUrl: 'logo.png' }, field: 'logoUrl' },
    { label: 'no deadline', overrides: { deadlineAmount: '' }, field: 'deadlineAmount' },
    { label: 'a 0-day deadline', overrides: { deadlineAmount: '0', deadlineUnit: 'days' as const }, field: 'deadlineAmount' },
    { label: 'a 25-month deadline', overrides: { deadlineAmount: '25', deadlineUnit: 'months' as const }, field: 'deadlineAmount' },
    { label: 'a 21-digit length', overrides: { membershipDigits: '21' }, field: 'membershipDigits' },
    { label: 'a hint over 200 characters', overrides: { membershipHint: 'x'.repeat(201) }, field: 'membershipHint' },
    { label: '3-day payment terms', overrides: { paymentTermsDays: '3' }, field: 'paymentTermsDays' }
  ])('names $label on its field and saves nothing', ({ overrides, field }) => {
    const { errors, save } = checkFundDraft(draft(overrides));
    expect(Object.keys(errors)).toEqual([field]);
    expect(save).toBeNull();
  });

  it('saves an unconfirmed deadline in days, empty payment terms as the general wait, and trims what was typed', () => {
    const { save } = checkFundDraft(draft({
      name: '  Namibia Health Plan ',
      deadlineAmount: '90',
      deadlineUnit: 'days',
      deadlineConfirmed: false,
      membershipHint: '  On the front of the card. ',
      paymentTermsDays: ' ',
      claimsEmail: ''
    }));
    expect(save).toMatchObject({
      name: 'Namibia Health Plan',
      deadlineDays: 90,
      deadlineMonths: null,
      deadlineConfirmed: false,
      membershipHint: 'On the front of the card.',
      paymentTermsDays: null,
      claimsEmail: null
    });
  });

  it("passes save_fund_rule's arguments by name", () => {
    const { save } = checkFundDraft(draft());
    expect(saveFundRuleArgs('provider-1', save!)).toEqual({
      p_provider_id: 'provider-1',
      p_name: 'Namibia Health Plan',
      p_claims_email: 'claims@example.invalid',
      p_claims_portal_url: null,
      p_logo_url: null,
      p_deadline_days: null,
      p_deadline_months: 4,
      p_deadline_confirmed: true,
      p_membership_digits: [11],
      p_membership_hint: null,
      p_dependant_code_required: true,
      p_payment_terms_days: 30
    });
  });
});

describe('the fund in words', () => {
  it('describes membership numbers, or says the fund has none set', () => {
    expect(describeMembership(getFundRule('NMC1'))).toBe('9 digits');
    expect(describeMembership({ ...nhp, membershipDigits: [13, 14] })).toBe('13 or 14 digits');
    // PSEMAS: 9 digits on Methealth's statements, 13 or 14 on older cards (claims standard of 13 Oct 2026)
    expect(describeMembership(getFundRule('MAG1'))).toBe('9 or 13 or 14 digits');
    expect(describeMembership({ ...nhp, membershipDigits: [] })).toBeNull();
  });

  // Support must be able to answer "who changed NAMMED's deadline, and from what?" from the history
  it('lists what a change did, detail by detail, and nothing that stayed the same', () => {
    const before = { name: 'Nammed Medical Aid Fund', claims_email: null, claim_deadline_days: 120, claim_deadline_months: null, deadline_confirmed: false, membership_digits: [11], payment_terms_days: 30, dependant_code_required: true };
    const after = { ...before, claims_email: 'claims@example.invalid', claim_deadline_days: null, claim_deadline_months: 4, deadline_confirmed: true, membership_digits: [] };
    expect(describeFundChange(before, after)).toEqual([
      'Claims email: none to claims@example.invalid',
      'Claim deadline: 120 days to 4 months',
      'Deadline confirmed: no to yes',
      'Membership numbers: 11 digits to not set'
    ]);
    expect(describeFundChange(before, before)).toEqual([]);
    expect(describeFundChange(null, { name: 'Example Health Fund', claim_deadline_days: 120 })).toEqual([
      'Name: none to Example Health Fund',
      'Claim deadline: not set to 120 days'
    ]);
  });
});
