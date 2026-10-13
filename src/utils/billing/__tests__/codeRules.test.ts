/**
 * A practice's rules per tariff code (parity E9, D13, O2): what staff are told and offered when they bill a code. Each
 * test says why the rule matters to a practice.
 */
import { describe, expect, it } from 'vitest';
import {
  NO_CODE_RULES,
  checkCodeRulesDraft,
  codeRulesFromRow,
  codeRulesMap,
  codeRulesPayload,
  describeCodeRules,
  draftOfCodeRules,
  lineRuleNotices,
  mentionsTime,
  placeOfServiceFor,
  recallSuggestions,
  withCodeRules,
  withoutKnownRecalls,
  type CodeRules,
  type CodeRulesDraft
} from '../codeRules';

const rules = (overrides: Partial<CodeRules> = {}): CodeRules => ({ ...NO_CODE_RULES, ...overrides });
const draft = (overrides: Partial<CodeRulesDraft> = {}): CodeRulesDraft => ({ ...draftOfCodeRules(null), ...overrides });

describe('reading the stored rules', () => {
  // Billing must never add a line it cannot explain: an unreadable linked code is dropped, not guessed
  it('keeps only readable linked codes, once each, and never the code itself', () => {
    const read = codeRulesFromRow({
      code: ' 0190 ',
      linked_codes: [{ code: '0201', quantity: 2 }, { code: '0201', quantity: 1 }, { code: 'bad code', quantity: 1 }, { code: '0190', quantity: 1 }, { code: '0202', quantity: 0 }, 'x']
    });
    expect(read?.code).toBe('0190');
    expect(read?.rules.linkedCodes).toEqual([{ code: '0201', quantity: 2 }]);
  });

  // A recall reason only means something with a recall date to go with it
  it('drops a recall reason without a recall, and a place of service the fund would refuse', () => {
    const read = codeRulesFromRow({ code: '0190', recall_months: null, recall_reason: 'Check-up', place_of_service: '99', lab_work: true });
    expect(read?.rules).toEqual(rules({ labWork: true }));
  });

  it('maps the rows by code and leaves out codes without any rule', () => {
    const map = codeRulesMap([{ code: '0190', needs_authorisation: true }, { code: '0191' }, { code: null, lab_work: true }]);
    expect([...map.keys()]).toEqual(['0190']);
  });

  // The visit screens read rules from the tariff rows they bill from, so a code in lower case still finds its rules
  it('attaches each code its rules on the tariff rows', () => {
    const rows = withCodeRules([{ code: '0190' }, { code: '8101' }], new Map([['0190', rules({ timeBased: true })]]));
    expect(rows.map(row => row.code_rules?.timeBased ?? null)).toEqual([true, null]);
  });
});

describe('the rules form', () => {
  it('saves what was typed, tidied, with an empty linked row ignored', () => {
    const checked = checkCodeRulesDraft(
      '0190',
      draft({
        needsAuthorisation: true,
        recallMonths: '6',
        recallReason: '  6-monthly   check-up ',
        placeOfService: '11',
        linkedCodes: [{ code: '0201', quantity: '2' }, { code: '', quantity: '' }]
      }),
      { dental: false }
    );
    expect(checked).toEqual({
      ok: true,
      warnings: [],
      rules: rules({ needsAuthorisation: true, recallMonths: 6, recallReason: '6-monthly check-up', placeOfService: '11', linkedCodes: [{ code: '0201', quantity: 2 }] })
    });
  });

  // Each refusal is what the database would refuse, said before anything is sent
  it.each([
    ['a recall longer than five years', draft({ recallMonths: '61' }), /1 to 60/],
    ['a one-letter recall reason', draft({ recallMonths: '6', recallReason: 'x' }), /2 to 120 characters/],
    ['a place of service outside the fund list', draft({ placeOfService: '99' }), /two-digit code from the fund list/],
    ['a code that brings itself', draft({ linkedCodes: [{ code: '0190', quantity: '1' }] }), /cannot bring itself/],
    ['the same linked code twice', draft({ linkedCodes: [{ code: '0201', quantity: '1' }, { code: '0201', quantity: '2' }] }), /listed twice/],
    ['a quantity of 0', draft({ linkedCodes: [{ code: '0201', quantity: '0' }] }), /whole number from 1 to 99/],
    ['something that is not a code', draft({ linkedCodes: [{ code: 'a b', quantity: '1' }] }), /is not a code/]
  ])('refuses %s', (_label, typed, message) => {
    const checked = checkCodeRulesDraft('0190', typed, { dental: false });
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.errors.join(' ')).toMatch(message);
  });

  // Dental keeps its built-in 8346 (after a restoration) and 8109 (per visit): linking them again would bill them twice
  it("refuses linking 8346 or 8109 in a dental practice, but not in a GP's, where they are ordinary codes", () => {
    const linked = draft({ linkedCodes: [{ code: '8346', quantity: '1' }] });
    expect(checkCodeRulesDraft('8341', linked, { dental: true }).ok).toBe(false);
    expect(checkCodeRulesDraft('8109', draft({ linkedCodes: [{ code: '8110', quantity: '1' }] }), { dental: true }).ok).toBe(false);
    expect(checkCodeRulesDraft('0190', linked, { dental: false }).ok).toBe(true);
  });

  it('warns, without refusing, when a linked code has no price today', () => {
    const checked = checkCodeRulesDraft('0190', draft({ linkedCodes: [{ code: '0299', quantity: '1' }] }), { dental: false, billableCodes: new Set(['0190']) });
    expect(checked.ok && checked.warnings[0]).toMatch(/0299 is not in your tariff list today/);
  });

  it('sends the database the shape save_practice_tariff_rules reads', () => {
    expect(codeRulesPayload(rules({ labWork: true, recallMonths: null, recallReason: 'left over', linkedCodes: [{ code: '0201', quantity: 1 }] }))).toEqual({
      needs_authorisation: false,
      lab_work: true,
      time_based: false,
      recall_months: null,
      recall_reason: null,
      place_of_service: null,
      linked_codes: [{ code: '0201', quantity: 1 }]
    });
  });

  it('says the rules in a few plain words for the tariff list', () => {
    expect(
      describeCodeRules(rules({ needsAuthorisation: true, recallMonths: 24, placeOfService: '11', linkedCodes: [{ code: '0201', quantity: 1 }, { code: '0202', quantity: 2 }] }))
    ).toEqual(['Authorisation', 'Recall in 2 years', 'Place of service 11', 'Brings 0201, 0202 x2']);
  });
});

describe("the notices on a visit's billing line", () => {
  const authorisation = rules({ needsAuthorisation: true });

  // Funds refuse a line that needs pre-authorisation and has no number; a private patient's line is never claimed
  it("flags a medical aid line without the fund's authorisation number, and only that one", () => {
    expect(lineRuleNotices({ code: '3001' }, authorisation, { hasMedicalAid: true })[0]).toMatch(/needs the fund's authorisation number/);
    expect(lineRuleNotices({ code: '3001' }, authorisation, { hasMedicalAid: false })).toEqual([]);
    expect(lineRuleNotices({ code: '3001', authorisationNumber: 'AUTH123' }, authorisation, { hasMedicalAid: true })).toEqual([]);
    expect(lineRuleNotices({ code: '3001' }, authorisation, { hasMedicalAid: true, registerAuthorisation: 'REG9' })).toEqual([]);
    // The patient pays all of it: nothing goes to the fund, so no number is needed
    expect(lineRuleNotices({ code: '3001', paidBy: 'patient' }, authorisation, { hasMedicalAid: true })).toEqual([]);
  });

  it('still flags a line whose number staff emptied, even when the patient has an authorisation on file', () => {
    expect(lineRuleNotices({ code: '3001', authorisationNumber: '' }, authorisation, { hasMedicalAid: true, registerAuthorisation: 'REG9' })).toHaveLength(1);
  });

  // The lab's slip and the time taken go on the invoice; the reminder stays until the note says them
  it('asks for the lab slip and the time until the line note has them', () => {
    const both = rules({ labWork: true, timeBased: true });
    expect(lineRuleNotices({ code: '0201' }, both, { hasMedicalAid: false })).toHaveLength(2);
    expect(lineRuleNotices({ code: '0201', notes: 'Lab: Smile Lab slip 1234' }, both, { hasMedicalAid: false })).toHaveLength(1);
    expect(lineRuleNotices({ code: '0201', notes: 'Smile Lab slip 1234, 45 minutes' }, both, { hasMedicalAid: false })).toEqual([]);
  });

  it.each(['45 minutes', '30 min', '1 hour', '1.5 h', '2hrs'])('reads "%s" as a time', text => expect(mentionsTime(text)).toBe(true));
  it.each(['slip 45', 'Smile Lab', ''])('does not read "%s" as a time', text => expect(mentionsTime(text)).toBe(false));

  it("takes the visit's place of service from the first new code that has one", () => {
    const tariffs = [
      { code: '0190', code_rules: rules({ linkedCodes: [{ code: '0201', quantity: 1 }] }) },
      { code: '0191', code_rules: rules({ placeOfService: '21' }) },
      { code: '0192', code_rules: rules({ placeOfService: '11' }) }
    ];
    expect(placeOfServiceFor([{ code: '0190' }, { code: '0191' }, { code: '0192' }], tariffs)).toEqual({ code: '0191', place: '21' });
    expect(placeOfServiceFor([{ code: '0190' }], tariffs)).toBeNull();
  });
});

describe('recalls offered when a code is invoiced (O2)', () => {
  const tariffs = [
    { code: '8159', description: 'Scale and polish', code_rules: rules({ recallMonths: 6 }) },
    { code: '0190', description: 'Consultation', code_rules: rules({ recallMonths: 12, recallReason: 'Annual check-up' }) },
    { code: '8101', description: 'Examination', code_rules: null }
  ];

  // The date comes from the code's interval, counted from the day of the service
  it("dates each recall from the line's service date plus the code's months, soonest first", () => {
    const offered = recallSuggestions([{ code: '0190' }, { code: '8159', serviceDate: '2026-10-01' }, { code: '8101' }], tariffs, {
      visitDate: '2026-10-12',
      today: '2026-10-12'
    });
    expect(offered).toEqual([
      { code: '8159', dueOn: '2027-04-01', reason: 'Scale and polish', months: 6 },
      { code: '0190', dueOn: '2027-10-12', reason: 'Annual check-up', months: 12 }
    ]);
  });

  // A visit captured late must not offer a recall date that has already passed
  it('offers nothing for a recall date that has passed, and one recall for the same code twice', () => {
    expect(recallSuggestions([{ code: '8159' }], tariffs, { visitDate: '2025-01-10', today: '2026-10-12' })).toEqual([]);
    expect(recallSuggestions([{ code: '8159' }, { code: '8159' }], tariffs, { visitDate: '2026-10-12', today: '2026-10-12' })).toHaveLength(1);
  });

  // Saving the same visit again must not ask again once the recall is set
  it('leaves out a recall the patient already has coming for the same reason', () => {
    const offered = recallSuggestions([{ code: '8159' }], tariffs, { visitDate: '2026-10-12', today: '2026-10-12' });
    expect(withoutKnownRecalls(offered, [{ reason: 'scale and polish', dueOn: '2027-04-12', status: 'open' }], '2026-10-12')).toEqual([]);
    // A recall the patient came back for is done: the next one is offered
    expect(withoutKnownRecalls(offered, [{ reason: 'Scale and polish', dueOn: '2026-10-12', status: 'seen' }], '2026-10-12')).toHaveLength(1);
  });
});
