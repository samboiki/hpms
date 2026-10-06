import { describe, it, expect } from 'vitest';
import { MATERIAL_FACTOR_PERCENT, computeLine, materialFactorUnitPrice, verifyLineAmounts } from '../pricing';
import { REAL_PRICES, divHalfUp } from './generators';

const centsOf = (price: number): number => Math.round(Number(`${price}e2`));

// Business rule: 8346 (restorative material) is 10% of its procedure's unit price, rounded half-up to
// the cent before it is multiplied, so the material line is exactly unit x quantity. Screens that kept
// the unrounded 10% (N$ 13.545 for a N$ 135.45 procedure) saved totals that invoiceService now refuses,
// and each screen had its own copy of the percentage.
describe('materialFactorUnitPrice', () => {
  it('is 10% of the procedure price, to the cent', () => {
    expect(MATERIAL_FACTOR_PERCENT).toBe(10);
    expect(materialFactorUnitPrice(373.9)).toBe(37.39);
    expect(materialFactorUnitPrice(135.45)).toBe(13.55);
    expect(materialFactorUnitPrice(0)).toBe(0);
  });

  const cases = REAL_PRICES.flatMap(price => [1, 2, 3, 5, 12].map(quantity => ({ price, quantity })));

  it.each(cases)('N$ $price x $quantity gives a material line invoiceService accepts', ({ price, quantity }) => {
    const unit = materialFactorUnitPrice(price);
    expect(unit).toBe(divHalfUp(centsOf(price) * MATERIAL_FACTOR_PERCENT, 100) / 100);
    const line = computeLine({ code: '8346', unitPrice: unit, quantity, multiplyRule: 'YES', hasMedicalAid: false });
    expect(line.ok).toBe(true);
    expect(verifyLineAmounts(line.unitPrice, quantity, line.total).ok).toBe(true);
  });
});
