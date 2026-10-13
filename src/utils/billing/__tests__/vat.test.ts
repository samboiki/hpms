/**
 * VAT rules (owner decision, 13 Oct 2026): a practice says whether it is VAT registered; only then do VAT-able stock
 * items (frames, over-the-counter medicines) carry VAT, and services never do. Invented numbers.
 */
import { describe, expect, it } from 'vitest';
import {
  NOT_VAT_REGISTERED,
  checkVatSettings,
  isVatable,
  lineVatRate,
  parseVatSettings,
  summariseVat,
  vatInCents,
  vatSettingsJson
} from '../vat';
import { DEFAULT_PRICE_RULE, priceStockLine } from '../../stock/pricing';

const registered = { registered: true, vatNumber: '1234567-01-5' };

describe('the VAT setting', () => {
  it('counts a practice as not registered until it says so, so no VAT is charged by surprise', () => {
    expect(parseVatSettings(null)).toEqual(NOT_VAT_REGISTERED);
    expect(parseVatSettings('not json')).toEqual(NOT_VAT_REGISTERED);
    expect(parseVatSettings({ registered: false, vat_number: '123' })).toEqual(NOT_VAT_REGISTERED);
    expect(parseVatSettings(JSON.stringify(vatSettingsJson(registered)))).toEqual(registered);
  });

  it('needs the VAT number of a registered practice, because every tax invoice prints it', () => {
    expect(checkVatSettings({ registered: true, vatNumber: ' ' }).error).toMatch(/Type the VAT number/);
    expect(checkVatSettings({ registered: true, vatNumber: '12<script>' }).ok).toBe(false);
    expect(checkVatSettings(registered).ok).toBe(true);
    expect(checkVatSettings({ registered: false, vatNumber: '' }).ok).toBe(true);
  });
});

describe('which lines carry VAT', () => {
  it('is VAT-able stock only, and only for a registered practice: services are exempt', () => {
    expect(lineVatRate(registered, { vatRate: null })).toBe(15);
    expect(lineVatRate(registered, { vatRate: 0 })).toBe(0);
    expect(lineVatRate(registered, null)).toBe(0);
    expect(lineVatRate(NOT_VAT_REGISTERED, { vatRate: 15 })).toBe(0);
    expect(isVatable({ vatRate: null })).toBe(true);
    expect(isVatable({ vatRate: 0 })).toBe(false);
  });

  it('finds the VAT in a price exactly as the stock price rule split it, so invoices and stock never disagree', () => {
    for (const cents of [115, 23000, 99999, 1]) {
      const priced = priceStockLine({ quantity: 1, lineCostCents: null, vatRate: 15, rule: DEFAULT_PRICE_RULE, fixedUnitPriceCents: cents });
      expect(vatInCents(cents, 15)).toBe(priced?.vatCents);
    }
    expect(vatInCents(-23000, 15)).toBe(-3000);
    expect(vatInCents(23000, 0)).toBe(0);
  });

  it('adds up a document line by line, keeping exempt services apart', () => {
    expect(summariseVat([{ totalCents: 115000, rate: 15 }, { totalCents: 45000, rate: 0 }])).toEqual({
      totalCents: 160000,
      vatableCents: 115000,
      exemptCents: 45000,
      vatCents: 15000,
      exclVatCents: 145000,
      rates: [15]
    });
  });
});
