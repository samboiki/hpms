/**
 * A NAMAF code with no fixed amount (priced by rule, at cost or by arrangement) is quoted at the amount staff typed. Why it
 * matters to a practice: accepting the quote and "Use current prices" price every line again from the price list; a code the
 * list has no amount for would drop to N$ 0 and the practice would lose the fee it quoted. A real price on the same code
 * (the fund's, or the practice's own) is not a missing amount and still wins. Invented codes and amounts.
 */
import { describe, expect, it, vi } from 'vitest';
import { estimateQuote, repriceQuoteLines, servicesToQuoteLines } from '../quotes';
import { addTariffLines } from '../billingLines';
import { tariff } from './quoteTestTariffs';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const material = (price: string) => tariff('0201', price, { description: 'Cost of material used in treatment', no_fixed_amount: true });
const quoteAt = (unitPrice: string, quantity = 1) => {
  // The editor adds the code with the typed amount as its price
  const added = addTariffLines([], { code: '0201', quantity, tooth: '' }, { tariffs: [material(unitPrice)], hasMedicalAid: false, autoInfectionControl: false });
  if (added.status !== 'added') throw new Error('line refused');
  return servicesToQuoteLines(added.lines, estimateQuote(added.lines, { hasMedicalAid: false, fundName: null, rates: new Map() }));
};

describe('re-pricing a quote that holds a code with no fixed amount', () => {
  it('keeps the quoted amount when the list still has none, so the invoice bills what the patient was quoted', () => {
    const quoted = quoteAt('850.00');
    expect(quoted[0].unitPrice).toBe(850);
    const repriced = repriceQuoteLines(quoted, { tariffs: [material('0')], hasMedicalAid: false });
    expect(repriced.problems).toEqual([]);
    expect(repriced.changes).toEqual([]);
    expect(repriced.services.map(service => service.unitPrice)).toEqual([850]);
    expect(repriced.newTotalCents).toBe(85000);
  });

  it('keeps it for a quantity of more than one as well', () => {
    const quoted = quoteAt('120.50', 1);
    const repriced = repriceQuoteLines(quoted.map(line => ({ ...line, quantity: 3, totalPrice: 361.5 })), { tariffs: [{ ...material('0'), can_be_multiplied: 'YES' }], hasMedicalAid: false });
    expect(repriced.services.map(service => [service.unitPrice, service.quantity, service.totalPrice])).toEqual([[120.5, 3, 361.5]]);
  });

  it('prices the code from the list once the list (a fund or the practice) has a real price for it, and shows the difference', () => {
    const quoted = quoteAt('850.00');
    const repriced = repriceQuoteLines(quoted, { tariffs: [material('600.00')], hasMedicalAid: false });
    expect(repriced.services.map(service => service.unitPrice)).toEqual([600]);
    expect(repriced.changes).toEqual([expect.objectContaining({ code: '0201', oldUnitPrice: 850, newUnitPrice: 600, differenceCents: -25000 })]);
  });

  it('does not touch an ordinary code whose price is 0 by mistake: it is still priced from the list', () => {
    const quoted = quoteAt('850.00');
    const notNamaf = tariff('0201', '0', { description: 'Cost of material used in treatment' });
    const repriced = repriceQuoteLines(quoted, { tariffs: [notNamaf], hasMedicalAid: false });
    expect(repriced.services.map(service => service.unitPrice)).toEqual([0]);
    expect(repriced.changes).toHaveLength(1);
  });
});
