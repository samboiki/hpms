/**
 * The funds' claim rules come from the fund master (medical_aid_fund_rules, kept by OneHealth support) once it is read,
 * and from the app's own values until then. Claims must keep working without the table, a support change must reach
 * every claim check, and a row the checks cannot trust must never replace a good rule. Invented values only.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FUND_RULE,
  FUND_RULES,
  checkClaimDeadline,
  deadlineCaveat,
  deadlineFromService,
  describeDeadline,
  fundRuleFromRow,
  fundRulesFromRows,
  fundRulesInForce,
  getFundRule,
  lastSubmissionDay,
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

describe('the built-in fund rules (the claims standard researched 13 Oct 2026)', () => {
  // The owner asked for researched deadlines and member formats (decisions of 13 Oct 2026). Sources: NHP's notice and
  // User Guide 2026 and the Nammed member guide (last day of the 4th month after the service month), Methealth's
  // "Claim submission period" (NMC 120, PSEMAS 180 calendar days). Prosperity publishes nothing: the Napotel booklet
  // it administers says 4 months, so it stays unconfirmed (flagged, never blocked)
  it('keeps the published deadlines confirmed and Prosperity, with no published rule, unconfirmed', () => {
    const summary = FUND_RULES.map(rule => [rule.key, rule.deadline, rule.confirmed, rule.membershipDigits, rule.paymentTermsDays]);
    expect(summary).toEqual([
      ['NHPM', { months: 4, monthEnd: true }, true, [11], 30],
      ['NMC1', { days: 120 }, true, [9], 30],
      ['MAG1', { days: 180 }, true, [9, 13, 14], 60],
      ['NAMM', { months: 4, monthEnd: true }, true, [11], 30],
      ['PROS', { months: 4 }, false, [6], 30]
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
    expect(deadlineCaveat(getFundRule('PROS'))).toBe('not confirmed with the fund');
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
    expect(getFundRule('NAMM')).toMatchObject({ deadline: { months: 4, monthEnd: true }, confirmed: true });
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
    setFundRulesInForce(fundRulesFromRows([row({ ...overrides, deadline_confirmed: false })]));
    expect(getFundRule('NAMM')).toMatchObject({ deadline: { months: 4, monthEnd: true }, confirmed: true });
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

describe('counting to the end of the month (NHP and NAMMED, the claims standard of 13 Oct 2026)', () => {
  // Nammed member guide and NHP's notice: "not later than the last day of the fourth month following the month in
  // which the service was rendered" (the Medical Aid Funds Regulations 1997, regulation 7(1)(a), use the same words).
  // Counting 4 months from the day blocked claims these funds must still pay: 10 Jan would have closed on 10 May.
  it('gives a January visit until 31 May, whatever its day', () => {
    for (const code of ['NHPM', 'NAMM']) {
      const rule = getFundRule(code);
      expect(lastSubmissionDay('2026-01-10', rule)).toBe('2026-05-31');
      expect(lastSubmissionDay('2026-01-31', rule)).toBe('2026-05-31');
    }
  });

  // NHP User Guide 2026: "The claim run-off period for treatment up to 31 December will extend to 30 April"
  it('runs December claims to 30 April of the next year, and counts February in a leap year', () => {
    expect(lastSubmissionDay('2026-12-31', getFundRule('NHPM'))).toBe('2027-04-30');
    expect(lastSubmissionDay('2027-10-05', getFundRule('NAMM'))).toBe('2028-02-29');
  });

  it('still blocks the day after, because the deadline is confirmed', () => {
    expect(checkClaimDeadline('2026-01-10', '2026-05-31', getFundRule('NAMM')).status).toBe('expiring');
    expect(checkClaimDeadline('2026-01-10', '2026-06-01', getFundRule('NAMM'))).toMatchObject({ status: 'expired', lastDay: '2026-05-31' });
  });

  // Support keeps the deadline in the fund master in months; the fund's way of counting must survive the table
  it('counts the fund master\'s months to the month end for these funds only', () => {
    expect(fundRuleFromRow(row({ claim_deadline_days: null, claim_deadline_months: 4 }))?.deadline).toEqual({ months: 4, monthEnd: true });
    expect(fundRuleFromRow(row({ medical_aid_reference: 'PROS', claim_deadline_days: null, claim_deadline_months: 4 }))?.deadline).toEqual({ months: 4 });
    expect(lastSubmissionDay('2026-01-10', getFundRule('PROS'))).toBe('2026-05-10');
  });

  it('says it in words staff can act on', () => {
    expect(describeDeadline(getFundRule('NHPM'))).toBe('4 months to month-end');
    expect(deadlineFromService(getFundRule('NHPM'))).toBe('to the end of the 4th month after the service month');
    expect(deadlineFromService(getFundRule('NMC1'))).toBe('120 days from the service date');
  });
});

describe('Methealth funds count calendar days (claims standard of 13 Oct 2026)', () => {
  // Methealth "Claim submission period": NMC 120 and PSEMAS 180 calendar days from the date of service, weekends
  // and public holidays included; later claims are rejected
  it('closes NMC after 120 and PSEMAS after 180 calendar days', () => {
    expect(lastSubmissionDay('2026-01-10', getFundRule('NMC1'))).toBe('2026-05-10');
    expect(lastSubmissionDay('2026-01-10', getFundRule('PSEMAS'))).toBe('2026-07-09');
  });
});

describe('membership numbers only warn (claims standard of 13 Oct 2026)', () => {
  // No fund publishes a number format: PSEMAS statements show 9 digits, older PSEMAS cards 13 or 14, accepted
  // Prosperity claims 6. A wrong guess must never stop registration or a claim, so these are lengths for a warning
  it('accepts every PSEMAS length seen and explains the old and new numbers', () => {
    const rule = getFundRule('MAG1');
    expect(rule.membershipDigits).toEqual([9, 13, 14]);
    expect(rule.membershipHint).toMatch(/9 digits.*13 or 14/);
    expect(getFundRule('PROS').membershipHint).toMatch(/not confirmed/);
  });
});
