/**
 * The funds' claim rules come from the fund master (medical_aid_fund_rules, kept by OneHealth support) once it is read,
 * and from the app's own values until then. Claims must keep working without the table, a support change must reach
 * every claim check, and a row the checks cannot trust must never replace a good rule. Invented values only.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FUND_RULE,
  FUND_RULES,
  deadlineCaveat,
  fundRuleFromRow,
  fundRulesFromRows,
  fundRulesInForce,
  getFundRule,
  setFundRulesInForce,
  type FundRuleRow
} from '../fundRules';

const row = (overrides: Partial<FundRuleRow>): FundRuleRow => ({
  medical_aid_reference: 'NAMM',
  claim_deadline_days: 120,
  claim_deadline_months: null,
  deadline_confirmed: false,
  claims_portal_url: null,
  membership_digits: [11],
  membership_hint: null,
  dependant_code_required: true,
  payment_terms_days: 30,
  ...overrides
});

afterEach(() => setFundRulesInForce(null));

describe('the built-in fund rules (the fund master seed)', () => {
  // These are the values the claims screens used before the fund master; the table was seeded with the same, so
  // applying it changed nothing for a practice until support changes a fund
  it('keeps NHP, NMC and PSEMAS deadlines confirmed and NAMMED and Prosperity as unconfirmed guesses', () => {
    const summary = FUND_RULES.map(rule => [rule.key, rule.deadline, rule.confirmed, rule.membershipDigits, rule.paymentTermsDays]);
    expect(summary).toEqual([
      ['NHPM', { months: 4 }, true, [11], 30],
      ['NMC1', { days: 120 }, true, [9], 30],
      ['MAG1', { days: 180 }, true, [], 60],
      ['NAMM', { days: 120 }, false, [11], 30],
      ['PROS', { days: 120 }, false, [], 30]
    ]);
    expect(FUND_RULES.every(rule => rule.dependantCodeRequired && rule.configured)).toBe(true);
  });

  // Pricing turns a fund named on a patient file into its claim code with references[0] ("PSEMAS" is MAG1)
  it('lists each fund\'s claim code first among the codes that mean it', () => {
    expect(getFundRule('PSEMAS').references[0]).toBe('MAG1');
    expect(getFundRule(null, 'Namibia Health Plan').references).toEqual(['NHPM', 'NHP']);
  });

  it('says why a deadline only warns', () => {
    expect(deadlineCaveat(getFundRule('NMC1'))).toBeNull();
    expect(deadlineCaveat(getFundRule('NAMM'))).toBe('not confirmed with the fund');
    expect(deadlineCaveat(DEFAULT_FUND_RULE)).toBe('assumed: no deadline is known for this fund');
  });
});

describe('rules from the fund master table', () => {
  // Support confirmed NAMMED's deadline at 90 days: every claim check of every practice must use it, found by the
  // fund's code or another name for the same fund
  it('puts a changed row in force for every claim check, found by code, other code or name', () => {
    setFundRulesInForce(fundRulesFromRows([row({ claim_deadline_days: 90, deadline_confirmed: true, membership_hint: 'Eleven digits on the front of the card.' })]));
    for (const rule of [getFundRule('NAMM'), getFundRule('NMD'), getFundRule(null, 'Nammed Medical Aid Fund')]) {
      expect(rule).toMatchObject({ key: 'NAMM', deadline: { days: 90 }, confirmed: true, membershipHint: 'Eleven digits on the front of the card.' });
    }
    // Funds without a row keep the built-in rule
    expect(getFundRule('MAG1').deadline).toEqual({ days: 180 });
  });

  it('goes back to the built-in rules when the table cannot be read, so claims keep working', () => {
    setFundRulesInForce(fundRulesFromRows([row({ claim_deadline_days: 90, deadline_confirmed: true })]));
    setFundRulesInForce(null);
    expect(fundRulesInForce()).toBe(FUND_RULES);
    expect(getFundRule('NAMM')).toMatchObject({ deadline: { days: 120 }, confirmed: false });
  });

  // A row without a usable deadline must not replace a good rule: a wrong deadline blocks payable claims or lets
  // refused ones through
  it.each([
    { label: 'no deadline', overrides: { claim_deadline_days: null } },
    { label: 'days and months', overrides: { claim_deadline_months: 4 } },
    { label: 'a 0-day deadline', overrides: { claim_deadline_days: 0 } },
    { label: 'a code that is not a claim code', overrides: { medical_aid_reference: 'NAMMED FUND' } }
  ])('ignores a row with $label and keeps the built-in rule', ({ overrides }) => {
    expect(fundRuleFromRow(row(overrides))).toBeNull();
    setFundRulesInForce(fundRulesFromRows([row({ ...overrides, deadline_confirmed: true })]));
    expect(getFundRule('NAMM')).toMatchObject({ deadline: { days: 120 }, confirmed: false });
  });

  it('reads months, sorted lengths, a portal and payment terms; drops what the checks cannot use', () => {
    const rule = fundRuleFromRow(row({
      claim_deadline_days: null,
      claim_deadline_months: 3,
      membership_digits: [14, 13, 13],
      claims_portal_url: 'https://claims.example.invalid',
      payment_terms_days: 45
    }));
    expect(rule).toMatchObject({ deadline: { months: 3 }, membershipDigits: [13, 14], claimsPortalUrl: 'https://claims.example.invalid', paymentTermsDays: 45 });
    // An insecure portal link, impossible terms or lengths are left out rather than shown or used
    expect(fundRuleFromRow(row({ claims_portal_url: 'http://claims.example.invalid', payment_terms_days: 3, membership_digits: [0] })))
      .toMatchObject({ claimsPortalUrl: null, paymentTermsDays: null, membershipDigits: [] });
  });

  // A fund support sets up later (not one the app knows by name) still gets its rule, named after the fund
  it('adds a rule for a fund the app does not know, named by its provider', () => {
    setFundRulesInForce(fundRulesFromRows([row({ medical_aid_reference: 'ZZFD', deadline_confirmed: true })], new Map([['ZZFD', 'Example Health Fund']])));
    expect(getFundRule('zzfd')).toMatchObject({ key: 'ZZFD', label: 'Example Health Fund', references: ['ZZFD'], configured: true });
    expect(getFundRule('XYZ9')).toBe(DEFAULT_FUND_RULE);
  });
});
