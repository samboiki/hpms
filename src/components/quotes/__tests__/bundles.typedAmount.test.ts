/**
 * A NAMAF code with no fixed amount (priced by rule, at cost or by arrangement; most of the optometry lens catalogue) inside a
 * saved code bundle. Why it matters to a practice: such a code used to be added at N$ 0.00 with only a warning toast, so a busy
 * receptionist could give a lens away, or send the fund a line with no amount. The bundle now asks for the amount when it is
 * used, as visit billing ("Amount when billed") and quotes ("Amount when quoted") do, and never adds the code at N$ 0.
 * Invented codes and amounts.
 */
import { describe, expect, it, vi } from 'vitest';
import { amountsNeeded, applyBundles, previewBundle, type BundleLine } from '../bundles';
import type { LineContext } from '../billingLines';
import { findInvoiceLineProblems } from '../../../services/invoiceService';
import { toCents } from '../../../utils/billing/money';
import { tariff } from './quoteTestTariffs';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const consult = tariff('0190', '520.00', { description: 'Consultation at the rooms' });
const lens = tariff('NP85CZ03D', '0', { description: 'ZEISS officelens Individual 1.5 BlueGuard', no_fixed_amount: true });
const coating = tariff('NP85CZ09C', '0', { description: 'Hard coating', no_fixed_amount: true, can_be_multiplied: 'YES' });
// An ordinary code whose price was left at 0 by mistake: not a NAMAF "no fixed amount", so the tariff warning still applies
const unpriced = tariff('0305', '0', { description: 'Ordinary code priced at zero' });
const tariffs = [consult, lens, coating, unpriced];
const context: LineContext = { tariffs, hasMedicalAid: false, autoInfectionControl: false };

const line = (code: string, quantity = 1, extra: Partial<BundleLine> = {}): BundleLine => ({ code, quantity, tooth: null, notes: null, ...extra });
const spectacles = { name: 'Spectacles', lines: [line('0190'), line('NP85CZ03D')] };

describe('which bundle lines ask for an amount', () => {
  it('asks only for a code the NAMAF list has no fixed amount for, naming it so staff know what to type', () => {
    expect(amountsNeeded([spectacles], tariffs)).toEqual([
      { key: '0:1', bundleName: 'Spectacles', code: 'NP85CZ03D', description: 'ZEISS officelens Individual 1.5 BlueGuard' }
    ]);
  });

  it('does not ask for an ordinary code priced at zero: that keeps the tariff warning, only the NAMAF flag means "type the amount"', () => {
    expect(amountsNeeded([{ name: 'Odd', lines: [line('0305')] }], tariffs)).toEqual([]);
  });

  it("does not ask when the bundle line has a fee of its own: the practice already chose the amount when it saved the bundle", () => {
    expect(amountsNeeded([{ name: 'Lens', lines: [line('NP85CZ03D', 1, { fee: 900 })] }], tariffs)).toEqual([]);
  });

  it('never asks for a stock item: stock is priced from the stock list, whatever the tariff list says about its code', () => {
    expect(amountsNeeded([{ name: 'Stock', lines: [line('NP85CZ03D', 1, { stockItemId: 'item-1' })] }], tariffs)).toEqual([]);
  });
});

describe('using a bundle that holds such a code', () => {
  it('leaves the code out instead of adding it at N$ 0, says so, and still adds the other lines', () => {
    const result = applyBundles([spectacles], [], context);
    expect(result.lines.map(item => item.code)).toEqual(['0190']);
    expect(result.needsAmount).toEqual([{ code: 'NP85CZ03D', message: expect.stringMatching(/no fixed amount.*not added.*type the amount/) }]);
    expect(result.lines.some(item => item.totalPrice === 0)).toBe(false);
  });

  it('bills the amount typed for one unit, times the quantity, and the invoice accepts the line', () => {
    const result = applyBundles([{ name: 'Coated', lines: [line('NP85CZ09C', 2)] }], [], context, {}, { amounts: { '0:0': 1250.5 } });
    expect(result.needsAmount).toEqual([]);
    expect(result.lines.map(item => [item.code, item.unitPrice, item.quantity, item.totalPrice])).toEqual([['NP85CZ09C', 1250.5, 2, 2501]]);
    // No "the price is N$ 0.00" warning: the line does have a price
    expect(result.warnings).toEqual([]);
    expect(findInvoiceLineProblems(result.lines)).toEqual([]);
  });

  it('prices two such codes in one bundle each at its own typed amount, by their place in the bundle', () => {
    const both = { name: 'Lens and coating', lines: [line('NP85CZ03D'), line('NP85CZ09C')] };
    const result = applyBundles([both], [], context, {}, { amounts: { '0:0': 800, '0:1': 120 } });
    expect(result.lines.map(item => [item.code, item.unitPrice])).toEqual([['NP85CZ03D', 800], ['NP85CZ09C', 120]]);
  });

  // The lens must never be given away because someone typed 0, left it empty or mistyped it
  it.each([[0], [-5], [Number.NaN], [1.234], [2_000_000]])('does not take %s as an amount: the code stays unadded and still asks', amount => {
    const result = applyBundles([spectacles], [], context, {}, { amounts: { '0:1': amount } });
    expect(result.lines.map(item => item.code)).toEqual(['0190']);
    expect(result.needsAmount.map(item => item.code)).toEqual(['NP85CZ03D']);
  });

  it("bills the bundle line's fee as the amount without asking, and does not record a change from a list price that never existed", () => {
    const withFee = { name: 'Lens at the practice fee', lines: [line('NP85CZ03D', 1, { fee: 900 })] };
    // No one is signed in here: an ordinary bundle fee would be refused for that, but this fee is the price itself
    const result = applyBundles([withFee], [], context);
    expect(result.needsAmount).toEqual([]);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ code: 'NP85CZ03D', unitPrice: 900, totalPrice: 900 });
    expect(result.lines[0].feeOverride).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it('does not take a fee of N$ 0 on the bundle line as the amount: it asks, because the code must never go on a bill for nothing', () => {
    const zeroFee = { name: 'Lens', lines: [line('NP85CZ03D', 1, { fee: 0 })] };
    expect(amountsNeeded([zeroFee], tariffs).map(need => need.code)).toEqual(['NP85CZ03D']);
    const result = applyBundles([zeroFee], [], context);
    expect(result.lines).toEqual([]);
    expect(result.needsAmount.map(item => item.code)).toEqual(['NP85CZ03D']);
  });

  it('still adds ordinary codes in one step and warns about an ordinary zero price as before', () => {
    const result = applyBundles([{ name: 'Odd', lines: [line('0190'), line('0305')] }], [], context);
    expect(result.needsAmount).toEqual([]);
    expect(result.lines.map(item => item.code)).toEqual(['0190', '0305']);
    expect(result.warnings).toEqual([expect.stringMatching(/Code 0305: the price is N\$ 0\.00/)]);
  });
});

describe('the bundle list preview', () => {
  it('leaves such a code out of the price and flags that an amount is asked for, instead of reporting a code that "cannot be billed"', () => {
    const preview = previewBundle(spectacles, context);
    expect(preview.needsAmount).toBe(true);
    expect(preview.problems).toEqual([]);
    expect(preview.totalCents).toBe(toCents(520));
    expect(preview.lineCount).toBe(1);
  });

  it('does not flag a bundle whose codes all have an amount', () => {
    expect(previewBundle({ name: 'Plain', lines: [line('0190')] }, context).needsAmount).toBe(false);
  });
});
