/**
 * A NAMAF code without a fixed amount (by rule or at cost) is billed at the amount staff typed. Why it matters: when the
 * visit moves to a practitioner with their own rate, lines from the price list are priced again from the list; a typed
 * amount has no list price to work from, so re-pricing it would drop the line to N$ 0 and the practice would lose the
 * fee. Invented codes and amounts.
 */
import { describe, expect, it } from 'vitest';
import { buildTariffLine, priceLinesAtRate, type VisitTariff } from '../visitBillingLines';

const consult: VisitTariff = { id: 't-0190', code: '0190', description: 'Consultation', price: 500, can_be_multiplied: 'NO', requires_tooth_number: 'NO' };
const atCost: VisitTariff = { id: 't-0201', code: '0201', description: 'Material at cost', price: 0, can_be_multiplied: 'NO', requires_tooth_number: 'NO', no_fixed_amount: true };

describe('lines of codes whose amount was typed', () => {
  it('bills the typed amount, and keeps it when the visit moves to a practitioner at 80% (the list-priced line moves)', () => {
    const typed = buildTariffLine({ ...atCost, price: 350 }, 1, '', false);
    const listed = buildTariffLine(consult, 1, '', false);
    if (!typed.ok || !listed.ok) throw new Error('lines refused');
    expect(typed.service.unitPrice).toBe(350);
    const lines = priceLinesAtRate([typed.service, listed.service], new Set([typed.service.id, listed.service.id]), 80, [consult, atCost], false);
    expect(lines.map(line => [line.code, line.unitPrice])).toEqual([['0201', 350], ['0190', 400]]);
  });
});
