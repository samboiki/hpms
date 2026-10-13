/**
 * Linked codes on a quote (parity D13): a code added to a quote brings the codes the practice linked to it, exactly as
 * on a visit. What matters to a practice: the quote the patient agrees to holds the lines the invoice will get (the
 * consumables of a procedure are never left off the estimate), never billed twice, and staff can see and remove them
 * before saving.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ServiceSelection } from '../../../types/billing';
import { NO_CODE_RULES, type CodeRules } from '../../../utils/billing/codeRules';
import { describeAddedLinks, type RuledVisitTariff } from '../../visits/linkedCodeLines';
import { addTariffLines, removeLine, type LineContext } from '../billingLines';
import { applyBundles, type CodeBundle } from '../bundles';
import { quoteLinesToServices, servicesToQuoteLines, estimateQuote } from '../quotes';
import { withLinkedCodes } from '../quoteLinkedCodes';

// billingLines reaches invoiceService's pure line checks only; nothing here may reach the database
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const tariff = (code: string, price: string, overrides: Partial<RuledVisitTariff> = {}): RuledVisitTariff => ({
  id: `t-${code}`,
  code,
  description: `Service ${code}`,
  price,
  can_be_multiplied: 'YES',
  requires_tooth_number: 'NO',
  is_active: true,
  ...overrides
});
const linking = (...links: Array<[string, number]>): CodeRules => ({ ...NO_CODE_RULES, linkedCodes: links.map(([code, quantity]) => ({ code, quantity })) });

// A GP's list: a procedure that brings its dressing twice, the dressing, and a consultation
const GP_TARIFFS = [tariff('0300', '400.00', { code_rules: linking(['0201', 2]) }), tariff('0201', '35.50'), tariff('0190', '520.00')];
const GP: LineContext = { tariffs: GP_TARIFFS, hasMedicalAid: false, autoInfectionControl: false };
const OPTIONS = { hasMedicalAid: false, dental: false };

/** What the quote editor does when staff add a code from the search: the line, then its linked codes */
const addCode = (lines: ServiceSelection[], code: string, context: LineContext = GP) => {
  const outcome = addTariffLines(lines, { code, quantity: 1 }, context);
  if (outcome.status !== 'added') throw new Error(`expected ${code} to be added`);
  return withLinkedCodes(lines, outcome.lines, context.tariffs, { hasMedicalAid: context.hasMedicalAid, dental: context.autoInfectionControl });
};

describe('a code added to a quote brings its linked codes', () => {
  it('adds them right after the code, priced from their own tariff, marked with the code they came with', () => {
    const withConsult = addCode([], '0190').services;
    const result = addCode(withConsult, '0300');
    expect(result.services.map(line => line.code)).toEqual(['0190', '0300', '0201']);
    expect(result.services[2]).toMatchObject({ code: '0201', quantity: 2, unitPrice: 35.5, totalPrice: 71, linkedFrom: '0300', parentServiceId: result.services[1].id });
    expect(describeAddedLinks(result.added)).toBe('Also added: 0201 x2 with 0300. Remove any you do not need before saving.');
    // The estimate the patient sees includes them: 520 + 400 + 71
    expect(estimateQuote(result.services, { hasMedicalAid: false, fundName: null, rates: new Map() }).totalCents).toBe(99100);
  });

  // A bundle may hold the linked code already: it is never billed twice
  it('adds each code of a bundle its linked codes once, and not a code the bundle has already', () => {
    const bundle: CodeBundle = {
      id: 'bundle-1', practiceId: 'practice-1', name: 'Procedure', colour: 'cyan', description: null, sortOrder: 0, presetKey: null, updatedAt: null,
      lines: [{ code: '0300', quantity: 1, tooth: null, notes: null }, { code: '0201', quantity: 1, tooth: null, notes: null }]
    };
    const applied = applyBundles([bundle], [], GP);
    const result = withLinkedCodes([], applied.lines, GP_TARIFFS, OPTIONS);
    expect(result.services.map(line => line.code)).toEqual(['0300', '0201']);
    expect(result.added).toEqual([]);
  });

  // The lines a saved quote opens with are the quote's own: opening it again must not add anything
  it("brings nothing for the lines the quote had already, or when nothing new was added", () => {
    const quoted = addCode([], '0300').services;
    expect(withLinkedCodes(quoted, quoted, GP_TARIFFS, OPTIONS)).toEqual({ services: quoted, added: [], problems: [] });
    const reopened = quoteLinesToServices(servicesToQuoteLines(quoted, estimateQuote(quoted, { hasMedicalAid: false, fundName: null, rates: new Map() })), GP_TARIFFS, false);
    const withConsult = addCode(reopened, '0190');
    expect(withConsult.services.map(line => line.code)).toEqual(['0300', '0201', '0190']);
  });

  it('says why a linked code could not come with it, and still adds the code', () => {
    const tariffs = [tariff('0300', '400.00', { code_rules: linking(['0999', 1]) })];
    const result = addCode([], '0300', { ...GP, tariffs });
    expect(result.services.map(line => line.code)).toEqual(['0300']);
    expect(result.problems).toEqual(["0300 brings 0999, but 0999 has no price for this visit's date, so it was not added."]);
  });
});

describe('removing lines from a quote', () => {
  it('removes a linked line on its own, and the code takes the lines it brought with it', () => {
    const lines = addCode(addCode([], '0190').services, '0300').services;
    const dressing = lines.find(line => line.code === '0201');
    expect(removeLine(lines, dressing?.id ?? '').map(line => line.code)).toEqual(['0190', '0300']);
    const procedure = lines.find(line => line.code === '0300');
    expect(removeLine(lines, procedure?.id ?? '').map(line => line.code)).toEqual(['0190']);
  });

  // As on a visit: once saved and opened again the lines are the quote's own lines, so removing the code leaves them
  it('keeps the lines of a saved quote when their code is removed later, as a visit does', () => {
    const quoted = addCode([], '0300').services;
    const reopened = quoteLinesToServices(servicesToQuoteLines(quoted, estimateQuote(quoted, { hasMedicalAid: false, fundName: null, rates: new Map() })), GP_TARIFFS, false);
    const procedure = reopened.find(line => line.code === '0300');
    const after = removeLine(reopened, procedure?.id ?? '');
    expect(after.map(line => line.code)).toEqual(['0201']);
    expect(after[0].parentServiceId).toBeUndefined();
  });
});
