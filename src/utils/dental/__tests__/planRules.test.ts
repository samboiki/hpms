import { describe, it, expect } from 'vitest';
import type { LineContext } from '../../../components/quotes/billingLines';
import { dentalTariffs, tariff } from '../../../components/quotes/__tests__/quoteTestTariffs';
import { buildChart, type BilledLine, type ChartEntry, type PlanItem } from '../chart';
import { priceVisit } from '../planPricing';
import { checkPlannedVisit, checkPlannedWork } from '../planRules';

const today = '2026-10-07';

const billedLine = (code: string, date: string, tooth = '36'): BilledLine => ({
  key: `${code}-${date}-${tooth}`,
  invoiceId: 'invoice-1',
  invoiceNumber: 'INV2610001',
  visitId: 'visit-1',
  date,
  code,
  description: '',
  teeth: [tooth],
  cancelled: false
});

const recordOf = (billed: BilledLine[], tooth = '36') => buildChart({ billed, entries: [] }).teeth.get(tooth);

const planItem = (code: string, tooth = '36', id = `plan-${code}-${tooth}`): PlanItem => {
  const entry: ChartEntry = {
    id,
    tooth,
    surfaces: null,
    work: 'filling',
    status: 'planned',
    tariffCode: code,
    planVisit: 1,
    planOrder: 1,
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

const check = (code: string, surfaces: string | null, options: { tooth?: string; billed?: BilledLine[]; openPlan?: PlanItem[] } = {}) =>
  checkPlannedWork(
    { tooth: options.tooth ?? '36', code, work: 'filling', surfaces },
    { record: recordOf(options.billed ?? [], options.tooth ?? '36'), openPlan: options.openPlan ?? [], today }
  ).map(issue => issue.message);

// Business rule: funds assess "tariff not applicable to the tooth type": anterior resin codes (8351-8354) on a back
// tooth, posterior codes on a front tooth. Said before the quote, it costs nothing to fix.
describe('the code must fit the tooth', () => {
  it('warns about a front-tooth code on a back tooth and the other way round', () => {
    expect(check('8352', 'MO')).toEqual([expect.stringMatching(/8352 is for front teeth/)]);
    expect(check('8368', 'MI', { tooth: '11' })).toEqual([expect.stringMatching(/8368 is for back teeth/)]);
    expect(check('8368', 'MO')).toEqual([]);
  });
});

// Business rule: a restoration code is for a number of surfaces (8368 two, 8370 four or more); a different number
// marked means the wrong code is billed.
describe('surfaces and code agree', () => {
  it('warns when the surfaces marked do not match the code', () => {
    expect(check('8369', 'MO')).toEqual([expect.stringMatching(/8369 is for 3 surfaces, but 2 are marked \(M O\)/)]);
    expect(check('8370', 'MODB')).toEqual([]);
    expect(check('8370', 'MO')).toEqual([expect.stringMatching(/4 or more surfaces/)]);
    expect(check('8369', null)).toEqual([]);
  });
});

// Business rule: a fund pended a restoration because "tooth has been extracted previously"; the chart knows.
describe('work on a missing tooth', () => {
  it('warns when the tooth was extracted, with the date', () => {
    expect(check('8368', 'MO', { billed: [billedLine('8201', '2024-03-03')] })).toEqual([expect.stringMatching(/missing since 3 Mar 2024/)]);
  });
});

// Business rule: NAMAF pays a posterior restoration once per tooth; 288 of the practice's restorations were on a tooth
// restored within the year before. The practitioner is told before quoting, not after the fund refuses.
describe('a second posterior restoration', () => {
  it('warns within a year of the last one and not after', () => {
    expect(check('8368', 'MO', { billed: [billedLine('8369', '2026-02-01')] })).toEqual([expect.stringMatching(/had a back-tooth restoration \(8369\) on 1 Feb 2026/)]);
    expect(check('8368', 'MO', { billed: [billedLine('8369', '2025-01-01')] })).toEqual([]);
  });
});

describe('the same work planned twice', () => {
  it('warns when the code is already planned on the tooth', () => {
    expect(check('8368', 'MO', { openPlan: [planItem('8368')] })).toEqual([expect.stringMatching(/already planned on tooth 36/)]);
    expect(check('8368', 'MO', { openPlan: [planItem('8368', '46')] })).toEqual([]);
  });

  // A three-canal molar is 8339 for the first canal and 8340 for each of the two others
  it('does not call a second "each additional canal" a duplicate', () => {
    const extraCanal = checkPlannedWork(
      { tooth: '36', code: '8340', work: 'root_canal', surfaces: null },
      { record: undefined, openPlan: [planItem('8340')], today }
    );
    expect(extraCanal).toEqual([]);
  });
});

// Business rule: the NAMAF rules across a visit's lines are the claim check's own (checkTariffRules); a planned visit
// gets them before it is quoted, tied to the item that breaks them.
describe('the rules across a planned visit', () => {
  const context: LineContext = {
    tariffs: [...dentalTariffs(), tariff('8368', '540.00', { description: 'Resin - two surfaces, posterior', requires_tooth_number: 'YES' })],
    hasMedicalAid: true,
    autoInfectionControl: true
  };

  it('ties a second posterior restoration on the same tooth to its item', () => {
    const first = planItem('8368', '36', 'first');
    const second = planItem('8367', '36', 'second');
    const issues = checkPlannedVisit(priceVisit(1, [first, second], context), today);
    expect(issues).toEqual([expect.objectContaining({ itemId: 'second', severity: 'warning', message: expect.stringMatching(/posterior restoration/) })]);
  });

  it('makes work that cannot be priced an error', () => {
    const issues = checkPlannedVisit(priceVisit(1, [planItem('8999', '36', 'unknown')], context), today);
    expect(issues).toEqual([expect.objectContaining({ itemId: 'unknown', severity: 'error' })]);
  });
});
