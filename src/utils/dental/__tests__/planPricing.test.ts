import { describe, it, expect } from 'vitest';
import type { LineContext } from '../../../components/quotes/billingLines';
import { describeQuotedLinks } from '../../../components/quotes/quoteLinkedCodes';
import { estimateQuote, repriceQuoteLines, servicesToQuoteLines } from '../../../components/quotes/quotes';
import { NO_CODE_RULES, type CodeRules } from '../../billing/codeRules';
import { dentalTariffs, tariff } from '../../../components/quotes/__tests__/quoteTestTariffs';
import type { ChartEntry, PlanItem } from '../chart';
import { priceVisit, surfacesNote } from '../planPricing';

const tariffs = [
  ...dentalTariffs(),
  tariff('8369', '663.00', { description: 'Resin - three surfaces, posterior', requires_tooth_number: 'YES' }),
  tariff('8411', '4950.00', { description: 'Porcelain veneered crown' })
];

const context = (overrides: Partial<LineContext> = {}): LineContext => ({
  tariffs,
  hasMedicalAid: true,
  autoInfectionControl: true,
  ...overrides
});

let next = 0;
const item = (code: string, tooth: string, surfaces: string | null = null): PlanItem => {
  next += 1;
  const entry: ChartEntry = {
    id: `item-${next}`,
    tooth,
    surfaces,
    work: 'filling',
    status: 'planned',
    tariffCode: code,
    planVisit: 1,
    planOrder: next,
    quoteId: null,
    visitId: null,
    invoiceId: null,
    note: null,
    recordedBy: null,
    recordedAt: '2026-10-01T10:00:00Z',
    statusChangedAt: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null
  };
  return { entry, done: false, billedBy: null, doneDate: null, quote: null };
};

// Business rule: a planned visit costs what its quote and its invoice will cost. The plan uses the visit screens' line
// builder, so 8109 comes once per visit, each restoration brings its 8346 at 10% of its price, and the fund's prices
// apply; the patient is never quoted one amount and billed another.
describe('pricing a planned visit', () => {
  it('prices each item with its 8346 line and the visit with one 8109 line', () => {
    const filling = item('8369', '36', 'MOD');
    const extraction = item('8201', '46');
    const priced = priceVisit(1, [filling, extraction], context({ infectionControlStaff: 2 }));
    expect(priced.lines.map(line => `${line.code} x${line.quantity} ${line.totalPrice.toFixed(2)}`)).toEqual([
      '8109 x2 68.80',
      '8369 x1 663.00',
      '8346 x1 66.30',
      '8201 x1 208.20'
    ]);
    expect(priced.items.get(filling.entry.id)?.totalCents).toBe(72930);
    expect(priced.items.get(extraction.entry.id)?.totalCents).toBe(20820);
    expect(priced.totalCents).toBe(6880 + 72930 + 20820);
    expect(priced.visitLineIds).toHaveLength(1);
  });

  it('carries the tooth and the surfaces on the line, so they reach the quote and the invoice', () => {
    const priced = priceVisit(1, [item('8369', '36', 'MOD')], context());
    const restoration = priced.lines.find(line => line.code === '8369');
    expect(restoration?.teethNumbers).toEqual(['36']);
    expect(restoration?.notes).toBe(surfacesNote('MOD'));
    expect(surfacesNote('MOD')).toBe('Surfaces M O D');
  });

  it('leaves out work whose code cannot be billed today and says why', () => {
    const unknown = item('8999', '36');
    const priced = priceVisit(1, [unknown, item('8201', '46')], context());
    expect(priced.items.get(unknown.entry.id)?.problem).toMatch(/no tariff in effect/);
    expect(priced.lines.map(line => line.code)).toEqual(['8109', '8201']);
  });

  it('adds no 8109 for a practice that does not bill it', () => {
    const priced = priceVisit(1, [item('8201', '46')], context({ autoInfectionControl: false }));
    expect(priced.lines.map(line => line.code)).toEqual(['8201']);
  });

  // The chain plan -> quote -> invoice: a quote made from these lines re-prices to the same total when it becomes an
  // invoice on the same tariffs, so nothing changes on the way
  it('makes lines that a quote turns into an invoice without a price change', () => {
    const priced = priceVisit(1, [item('8369', '36', 'MOD'), item('8411', '46')], context());
    const estimate = estimateQuote(priced.lines, { hasMedicalAid: true, fundName: null, rates: new Map() });
    expect(estimate.totalCents).toBe(priced.totalCents);
    const repriced = repriceQuoteLines(servicesToQuoteLines(priced.lines, estimate), { tariffs, hasMedicalAid: true });
    expect(repriced.problems).toEqual([]);
    expect(repriced.differenceCents).toBe(0);
  });
});

// Business rule: the codes a practice links to a code (Admin > Tariffs) come with planned work exactly as they come
// with a code added to a quote by hand or to the visit, so the plan's quote is not missing what the invoice will bill
// (an extraction's anaesthetic), and the plan's price is still its quote's price.
describe('the practice linked codes in a planned visit', () => {
  const linking = (code: string, quantity: number): CodeRules => ({ ...NO_CODE_RULES, linkedCodes: [{ code, quantity }] });
  const withLink = (to: string, quantity = 1) => tariffs.map(row => (row.code === '8201' ? { ...row, code_rules: linking(to, quantity) } : row));

  it('come right after the work they belong to, priced with it, and the plan says which came', () => {
    const extraction = item('8201', '46');
    const linked = withLink('8145');
    const priced = priceVisit(1, [extraction], context({ tariffs: linked }));
    expect(priced.lines.map(line => line.code)).toEqual(['8109', '8201', '8145']);
    const anaesthetic = priced.lines[2];
    expect(anaesthetic).toMatchObject({ linkedFrom: '8201', parentServiceId: priced.lines[1].id, totalPrice: 40.4 });
    expect(priced.items.get(extraction.entry.id)?.totalCents).toBe(20820 + 4040);
    expect(priced.totalCents).toBe(3440 + 20820 + 4040);
    expect(priced.linked).toEqual([{ from: '8201', codes: ['8145'] }]);
    expect(describeQuotedLinks(priced.linked)).toBe(
      "The quote also has the practice's linked codes: 8145 with 8201. Edit the quote to remove any you do not need."
    );

    // The quote made from the plan keeps them, under the work they came with, at the plan's total
    const estimate = estimateQuote(priced.lines, { hasMedicalAid: true, fundName: null, rates: new Map() });
    expect(estimate.totalCents).toBe(priced.totalCents);
    const quoteLines = servicesToQuoteLines(priced.lines, estimate);
    expect(quoteLines[2]).toMatchObject({ code: '8145', parentLineId: quoteLines[1].id });
    expect(repriceQuoteLines(quoteLines, { tariffs: linked, hasMedicalAid: true }).differenceCents).toBe(0);
  });

  it('leave out a linked code without a price and say so on the work, which is still priced', () => {
    const extraction = item('8201', '46');
    const priced = priceVisit(1, [extraction], context({ tariffs: withLink('8999') }));
    expect(priced.lines.map(line => line.code)).toEqual(['8109', '8201']);
    expect(priced.items.get(extraction.entry.id)).toMatchObject({
      problem: null,
      totalCents: 20820,
      warnings: ["8201 brings 8999, but 8999 has no price for this visit's date, so it was not added."]
    });
    expect(priced.linked).toEqual([]);
  });

  it('change nothing for work whose code has no linked codes', () => {
    const priced = priceVisit(1, [item('8201', '46')], context());
    expect(priced.lines.map(line => line.code)).toEqual(['8109', '8201']);
    expect(priced.linked).toEqual([]);
  });
});
