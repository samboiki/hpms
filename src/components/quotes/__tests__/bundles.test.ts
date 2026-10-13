import { describe, it, expect, vi } from 'vitest';
import {
  DENTAL_STARTER_BUNDLES,
  MAX_BUNDLE_LINES,
  applyBundles,
  bundleSavePayload,
  checkBundleAgainstTariffs,
  describeApplication,
  emptyBundleDraft,
  presetToDraft,
  previewBundle,
  starterBundlesFor,
  teethNeeded,
  toCodeBundles,
  validateBundleDraft,
  type BundleDraft,
  type BundleLine,
  type StockLineOutcome
} from '../bundles';
import type { LineContext } from '../billingLines';
import { findInvoiceLineProblems } from '../../../services/invoiceService';
import { formatNad, sumCents, toCents } from '../../../utils/billing/money';
import { dentalTariffs, raisedTariffs } from './quoteTestTariffs';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const tariffs = dentalTariffs();
const context = (overrides: Partial<LineContext> = {}): LineContext => ({
  tariffs,
  hasMedicalAid: true,
  autoInfectionControl: true,
  ...overrides
});
const line = (code: string, quantity = 1, tooth: string | null = null): BundleLine => ({ code, quantity, tooth, notes: null });
const bundle = (name: string, lines: BundleLine[]) => ({ name, lines });
const codes = (lines: readonly { code: string }[]) => lines.map(item => item.code);
const count = (lines: readonly { code: string }[], code: string) => lines.filter(item => item.code === code).length;

const extraction = bundle('Extraction', [line('8145'), line('8201'), line('8110')]);
const filling = bundle('Filling', [line('8145'), line('8367'), line('8110')]);
const teethFor = (...pairs: [string, string][]) => Object.fromEntries(pairs);

// Business rule: codes charged once per visit are billed once per visit, however the lines get there:
// the fund pays infection control, sterilised instruments and local anaesthetic once per visit, and a
// second line would be rejected or clawed back.
describe('applyBundles: per-visit codes are added once', () => {
  it('two bundles that both contain infection control add it once, because the fund pays it once per visit', () => {
    const checkUp = bundle('Check-up', [line('8109'), line('8101')]);
    const clean = bundle('Clean', [line('8109'), line('8159')]);
    const result = applyBundles([checkUp, clean], [], context());
    expect(count(result.lines, '8109')).toBe(1);
    expect(codes(result.lines)).toEqual(['8109', '8101', '8159']);
    expect(result.skipped).toEqual([{ code: '8109', reason: expect.stringMatching(/charged once per visit/) }]);
  });

  it('an extraction and a filling on one visit share one anaesthetic, one instrument pack and one 8109', () => {
    const result = applyBundles([extraction, filling], [], context(), teethFor(['0:1', '48'], ['1:1', '16']));
    expect(count(result.lines, '8145')).toBe(1);
    expect(count(result.lines, '8110')).toBe(1);
    expect(count(result.lines, '8109')).toBe(1);
    expect(codes(result.lines)).toEqual(['8109', '8145', '8201', '8110', '8367', '8346']);
    expect(result.problems).toEqual([]);
    expect(findInvoiceLineProblems(result.lines)).toEqual([]);
  });

  it('keeps the larger quantity when bundles ask for different amounts of a per-visit code, whatever their order', () => {
    const twoCarpules = bundle('Surgical extraction', [line('8145', 2), line('8201')]);
    const oneCarpule = bundle('Filling', [line('8145', 1), line('8367')]);
    const teeth = teethFor(['0:1', '38'], ['1:1', '26']);
    const forwards = applyBundles([twoCarpules, oneCarpule], [], context(), teeth);
    const backwards = applyBundles([oneCarpule, twoCarpules], [], context(), teethFor(['0:1', '26'], ['1:1', '38']));
    expect(forwards.lines.find(item => item.code === '8145')).toMatchObject({ quantity: 2, totalPrice: 80.8 });
    expect(backwards.lines.find(item => item.code === '8145')).toMatchObject({ quantity: 2, totalPrice: 80.8 });
  });

  it('does not add a per-visit code the visit already has, and never changes the existing line', () => {
    const visit = applyBundles([bundle('Anaesthetic', [line('8145', 3)])], [], context()).lines;
    const result = applyBundles([extraction], visit, context(), teethFor(['0:1', '48']));
    expect(result.lines.filter(item => item.code === '8145')).toEqual(visit.filter(item => item.code === '8145'));
    expect(result.skipped.map(item => item.code)).toEqual(['8145']);
    expect(describeApplication(result, formatNad)).toMatch(/Added 2 lines \(N\$ 285\.00\)\. 8145 is charged once per visit/);
  });
});

// Business rule: a bundle never stores a price. The practice raises its tariffs every year; a bundle made
// last year must bill this year's prices without anyone editing it.
describe('prices come from the tariffs in effect when the bundle is used', () => {
  const checkUp = bundle('Check-up', [line('8101'), line('8159'), line('8110')]);

  it('bills the same bundle at the new prices after a tariff increase', () => {
    const before = applyBundles([checkUp], [], context());
    const after = applyBundles([checkUp], [], context({ tariffs: raisedTariffs(tariffs, 1.1) }));
    expect(before.lines.map(item => item.unitPrice)).toEqual([34.4, 254.7, 410.3, 76.8]);
    expect(after.lines.map(item => item.unitPrice)).toEqual([37.84, 280.17, 451.33, 84.48]);
  });

  it('saves only codes, quantities, teeth and notes for the lines: there is no price to go stale', () => {
    const payload = bundleSavePayload('practice-1', { ...emptyBundleDraft(), name: 'Check-up', lines: checkUp.lines });
    payload.p_lines.forEach(saved => expect(Object.keys(saved).sort()).toEqual(['code', 'notes', 'quantity', 'tooth_number']));
    expect(JSON.stringify(payload)).not.toMatch(/price/i);
  });
});

// Business rule: a tooth code needs its tooth on the claim; when a bundle does not fix the tooth, staff
// are asked for it when they use the bundle, and the line is not added without one.
describe('teeth', () => {
  it('lists the lines that need a tooth when the bundle is used', () => {
    expect(teethNeeded([extraction], tariffs)).toEqual([
      { key: '0:1', bundleName: 'Extraction', code: '8201', description: 'Single tooth extraction' }
    ]);
    expect(teethNeeded([bundle('Wisdom tooth', [line('8201', 1, '38')])], tariffs)).toEqual([]);
  });

  it('reports a line whose tooth is missing and still adds the others', () => {
    const result = applyBundles([extraction], [], context());
    expect(codes(result.lines)).toEqual(['8109', '8145', '8110']);
    expect(result.problems).toEqual([{ code: '8201', message: expect.stringMatching(/needs a tooth number/) }]);
  });

  it('uses the tooth chosen when the bundle is used', () => {
    const result = applyBundles([extraction], [], context(), teethFor(['0:1', '48']));
    expect(result.lines.find(item => item.code === '8201')?.teethNumbers).toEqual(['48']);
  });
});

describe('lines that cannot be billed', () => {
  it('reports a code that is no longer in the tariff list and adds the rest', () => {
    const result = applyBundles([bundle('Old', [line('8101'), line('9999')])], [], context());
    expect(codes(result.lines)).toEqual(['8109', '8101']);
    expect(result.problems).toEqual([{ code: '9999', message: expect.stringMatching(/9999 has no tariff in effect/) }]);
  });

  it('warns when a code without a tooth ends up on the visit twice (two examinations is usually a mistake)', () => {
    const result = applyBundles([bundle('A', [line('8101')]), bundle('B', [line('8101')])], [], context());
    expect(result.warnings).toContain('8101 is now on this visit 2 times. Check that it should be charged more than once.');
  });
});

describe('previewBundle', () => {
  it('shows the price of everything the bundle adds today, including the automatic 8109 and 8346', () => {
    const preview = previewBundle(filling, context());
    const lines = applyBundles([filling], [], context(), teethFor(['0:1', '16'])).lines;
    expect(preview).toMatchObject({ lineCount: 5, needsTooth: true, problems: [] });
    expect(preview.totalCents).toBe(sumCents(lines.map(item => toCents(item.totalPrice))));
    expect(preview.totalCents).toBe(toCents(34.4 + 40.4 + 448.7 + 76.8 + 44.87));
  });
});

// Business rule: a bundle is checked when it is saved, not when a receptionist uses it with a patient
// waiting: wrong codes, 8346 on its own, impossible quantities and per-visit codes listed twice.
describe('validateBundleDraft and checkBundleAgainstTariffs', () => {
  const draft = (lines: BundleLine[], overrides: Partial<BundleDraft> = {}): BundleDraft => ({
    ...emptyBundleDraft(),
    name: 'Bundle',
    lines,
    ...overrides
  });

  it('accepts a normal bundle', () => {
    expect(validateBundleDraft(draft([line('8101'), line('8107', 2)]))).toEqual([]);
  });

  it('names every problem', () => {
    const errors = validateBundleDraft(
      draft([line(''), line('8346'), line('8107', 0), line('8201', 1, '19'), line('8145'), line('8145')], { name: ' ' })
    );
    expect(errors).toEqual([
      'Give the bundle a name.',
      'Line 1: enter a tariff code (letters and digits, no spaces).',
      'Line 2 (8346): 8346 is added automatically with restorative procedures; remove this line.',
      'Line 3 (8107): the quantity must be more than 0 and at most 99, with at most 2 decimals.',
      'Line 4 (8201): "19" is not a valid tooth number (FDI 11-48, or 51-85 for milk teeth).',
      '8145 is charged once per visit: list it only once.'
    ]);
  });

  it('limits the number of lines', () => {
    expect(validateBundleDraft(draft(Array.from({ length: MAX_BUNDLE_LINES + 1 }, () => line('8107'))))).toContain(
      `A bundle can have at most ${MAX_BUNDLE_LINES} lines.`
    );
  });

  it('checks codes and quantity rules against the tariff list in effect', () => {
    expect(checkBundleAgainstTariffs([line('8101'), line('8888'), line('8110', 2), line('8107', 3)], tariffs)).toEqual([
      'Line 2 (8888): 8888 is not in the tariff list in effect today. Check the code.',
      'Line 3 (8110): 8110 is billed once per line, so its quantity must be 1. Add another line for another unit.'
    ]);
  });
});

// Business rule: the starter bundles are suggestions for a dental practice to review, never used until
// someone saves them, and they must be valid bundles that bill correctly with the real 2025 tariffs.
describe('starter suggestions', () => {
  it('are offered to dental practices only', () => {
    expect(starterBundlesFor('dental')).toBe(DENTAL_STARTER_BUNDLES);
    expect(starterBundlesFor('Dental ')).toBe(DENTAL_STARTER_BUNDLES);
    expect(starterBundlesFor('medical')).toEqual([]);
    expect(starterBundlesFor(null)).toEqual([]);
  });

  it.each(DENTAL_STARTER_BUNDLES.map(preset => [preset.name, preset] as const))('%s is a valid bundle that bills cleanly', (_name, preset) => {
    const draft = presetToDraft(preset);
    expect(draft).toMatchObject({ id: null, presetKey: preset.key });
    expect(validateBundleDraft(draft)).toEqual([]);
    expect(checkBundleAgainstTariffs(draft.lines, tariffs)).toEqual([]);
    const teeth = Object.fromEntries(teethNeeded([draft], tariffs).map(need => [need.key, '16']));
    const result = applyBundles([draft], [], context(), teeth);
    expect(result.problems).toEqual([]);
    expect(findInvoiceLineProblems(result.lines)).toEqual([]);
  });

  it('leave 8109 out (added once per visit automatically) and never list 8346', () => {
    DENTAL_STARTER_BUNDLES.forEach(preset => {
      expect(codes(preset.lines)).not.toContain('8109');
      expect(codes(preset.lines)).not.toContain('8346');
    });
  });

  it('copies the preset, so editing the draft does not change the suggestion', () => {
    const draft = presetToDraft(DENTAL_STARTER_BUNDLES[0]);
    draft.lines[0].quantity = 5;
    expect(DENTAL_STARTER_BUNDLES[0].lines[0].quantity).toBe(1);
  });
});

describe('toCodeBundles', () => {
  it('orders lines by line number, reads numeric strings and falls back to a known colour', () => {
    const [read] = toCodeBundles(
      [{ id: 'b1', practice_id: 'p1', name: 'Check-up', colour: 'purple', description: ' ', sort_order: null, preset_key: null, updated_at: null }],
      [
        { bundle_id: 'b1', line_no: 2, code: '8159', quantity: '1.00', tooth_number: null, notes: null },
        { bundle_id: 'b1', line_no: 1, code: ' 8101 ', quantity: 1, tooth_number: ' ', notes: ' First ' }
      ]
    );
    expect(read).toMatchObject({
      colour: 'cyan',
      description: null,
      lines: [
        { code: '8101', quantity: 1, tooth: null, notes: 'First' },
        { code: '8159', quantity: 1, tooth: null, notes: null }
      ]
    });
  });
});

// Parity D12 (Eminance macros): a bundle line can carry a fixed diagnosis, its own fee and a stock item, and a
// bundle can need the fund's authorisation number. Each one saves typing on every visit and must reach the claim.
describe('bundle extras: ICD-10, fee, stock items and the authorisation number', () => {
  const by = { by: 'user-1', at: '2026-10-12T08:00:00.000Z' };

  // The fund pays only lines with a diagnosis: the bundle's code becomes the line's main ICD-10 code
  it("starts the bundle's own line with its fixed ICD-10 code, never the automatic 8109 line", () => {
    const result = applyBundles([bundle('Check-up', [{ ...line('8101'), icd10: 'z01.2' }])], [], context(), {}, by);
    expect(result.lines.find(item => item.code === '8101')?.icd10Codes).toEqual(['Z01.2']);
    expect(result.lines.find(item => item.code === '8109')?.icd10Codes).toBeUndefined();
  });

  // A bundle fee is a changed fee like one typed by hand: the invoice keeps why, the price before, who and when
  it("bills the bundle's fee as a changed fee naming the bundle, and its 8346 follows the new price", () => {
    const result = applyBundles([bundle('Pensioner filling', [{ ...line('8367', 1, '16'), fee: 400 }])], [], context(), {}, by);
    const filling = result.lines.find(item => item.code === '8367');
    expect(filling).toMatchObject({ unitPrice: 400, totalPrice: 400, feeOverride: { reason: 'Bundle "Pensioner filling"', fromUnitPrice: 448.7, by: 'user-1' } });
    expect(result.lines.find(item => item.code === '8346')).toMatchObject({ unitPrice: 40 });
    expect(findInvoiceLineProblems(result.lines)).toEqual([]);
  });

  // Without knowing who bills, a fee change cannot be recorded: the price list's price is billed and staff are told
  it('keeps the price list price, with a warning, when nobody is signed in', () => {
    const result = applyBundles([bundle('Fee', [{ ...line('8101'), fee: 200 }])], [], context());
    expect(result.lines.find(item => item.code === '8101')?.unitPrice).toBe(254.7);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/fee N\$ 200\.00 was not used/)]));
  });

  // A stock line is priced as "From stock" prices it, so the units come off stock when the visit is saved
  it('adds a stock item through the stock pricing, and reports an item that cannot be priced instead of guessing', () => {
    const stockLine = (itemId: string, quantity: number): StockLineOutcome =>
      itemId === 'item-1'
        ? { ok: true, service: { id: 'stock-line', tariffId: 'item-1', code: '7012345', description: 'Paracetamol 500mg', category: 'Medicine', unitPrice: 12.5, quantity, totalPrice: 12.5 * quantity, canBeMultiplied: true } }
        : { ok: false, message: 'gone' };
    const stockBundle = bundle('Pain', [line('8104'), { ...line('7012345', 2), stockItemId: 'item-1' }, { ...line('7099999'), stockItemId: 'item-2' }]);
    const result = applyBundles([stockBundle], [], context(), {}, { ...by, stockLine });
    expect(result.lines.find(item => item.tariffId === 'item-1')).toMatchObject({ quantity: 2, totalPrice: 25 });
    expect(result.problems).toEqual([{ code: '7099999', message: 'gone' }]);
    // Without stock pricing nothing is added for a stock line
    expect(applyBundles([stockBundle], [], context()).problems.map(problem => problem.code)).toEqual(['7012345', '7099999']);
    // A stock item is never looked up in the tariff list and never asks for a tooth
    expect(checkBundleAgainstTariffs(stockBundle.lines, tariffs)).toEqual([]);
    expect(teethNeeded([stockBundle], tariffs)).toEqual([]);
  });

  // The claim carries the authorisation number per line: every line the bundle adds gets it, lines already there do not
  it('puts the authorisation number on every line the bundle added, and only those', () => {
    const existing = applyBundles([bundle('First', [line('8104')])], [], context()).lines;
    const result = applyBundles([bundle('Surgery', [line('8201', 1, '38'), line('8145')])], existing, context(), {}, { ...by, authorisationNumber: ' AUTH-9 ' });
    expect(result.added.length).toBeGreaterThan(0);
    result.added.forEach(item => expect(item.authorisationNumber).toBe('AUTH-9'));
    existing.forEach(item => expect(result.lines.find(other => other.id === item.id)?.authorisationNumber).toBeUndefined());
  });

  it('refuses an external-cause ICD-10 code, a fee in fractions of a cent and stock in part units', () => {
    const draft = (lines: BundleLine[]): BundleDraft => ({ ...emptyBundleDraft(), name: 'Extras', lines });
    expect(validateBundleDraft(draft([{ ...line('8101'), icd10: 'W01.0' }]))).toEqual([expect.stringMatching(/cannot be the main code/)]);
    expect(validateBundleDraft(draft([{ ...line('8101'), fee: 10.005 }]))).toEqual([expect.stringMatching(/fee must be an amount/)]);
    expect(validateBundleDraft(draft([{ ...line('7012345', 1.5), stockItemId: 'item-1' }]))).toEqual([expect.stringMatching(/whole units/)]);
  });

  // The database keeps the extras; a plain line still saves only its code, quantity, tooth and note
  it('saves the extras only when set, and reads them back', () => {
    const payload = bundleSavePayload('practice-1', {
      ...emptyBundleDraft(),
      name: 'Extras',
      needsAuthorisation: true,
      lines: [{ ...line('8101'), icd10: 'j06.9', fee: 300 }, { ...line('7012345', 2), stockItemId: 'item-1' }, line('8110')]
    });
    expect(payload.p_bundle).toMatchObject({ needs_authorisation: true });
    expect(payload.p_lines).toEqual([
      { code: '8101', quantity: 1, tooth_number: null, notes: null, icd10_code: 'J06.9', fee: 300 },
      { code: '7012345', quantity: 2, tooth_number: null, notes: null, stock_item_id: 'item-1' },
      { code: '8110', quantity: 1, tooth_number: null, notes: null }
    ]);
    const [read] = toCodeBundles(
      [{ id: 'b1', practice_id: 'p1', name: 'Extras', colour: 'cyan', description: null, sort_order: 0, preset_key: null, updated_at: null, needs_authorisation: true }],
      [
        { bundle_id: 'b1', line_no: 1, code: '8101', quantity: 1, tooth_number: null, notes: null, icd10_code: 'J06.9', fee: '300.00', stock_item_id: null },
        { bundle_id: 'b1', line_no: 2, code: '7012345', quantity: 2, tooth_number: null, notes: null, icd10_code: null, fee: null, stock_item_id: 'item-1' }
      ]
    );
    expect(read).toMatchObject({ needsAuthorisation: true, lines: [{ icd10: 'J06.9', fee: 300 }, { stockItemId: 'item-1' }] });
    expect(read.lines[1]).not.toHaveProperty('fee');
  });

  it('shows the bundle fee in the preview total', () => {
    expect(previewBundle(bundle('Fee', [{ ...line('8159'), fee: 300 }]), context({ autoInfectionControl: false })).totalCents).toBe(30_000);
  });
});
