import { describe, it, expect } from 'vitest';
import {
  EMPTY_PRICE_BOOK,
  describePriceSource,
  fundHasPrices,
  fundPriceFor,
  parseContractPercent,
  priceBillableTariffs,
  resolveFundReference,
  type FundContractRow,
  type FundPriceBook,
  type FundPricingContext,
  type FundTariffRow,
  type PatientFundKey
} from '../fundPricing';
import { selectBillableTariffs, type TariffRow } from '../pricing';
import { getFundRule } from '../fundRules';
import { REAL_PRICES, intBetween, pick, seededRandom } from './generators';

const PRACTICE = 'practice-a';
const OTHER_PRACTICE = 'practice-b';
let nextId = 0;
const id = (): string => `row-${(nextId += 1).toString().padStart(5, '0')}`;

const row = (code: string, unitPrice: number | string, overrides: Partial<FundTariffRow> = {}): FundTariffRow => ({
  id: id(),
  practice_id: null,
  fund_reference: 'MAG1',
  plan_option: null,
  code,
  unit_price: unitPrice,
  effective_from: '2023-12-13',
  effective_to: null,
  is_active: true,
  ...overrides
});

const contract = (percent: number | string, overrides: Partial<FundContractRow> = {}): FundContractRow => ({
  id: id(),
  practice_id: PRACTICE,
  fund_reference: 'NHPM',
  plan_option: null,
  base_fund_reference: null,
  percent,
  effective_from: '2026-01-01',
  effective_to: null,
  is_active: true,
  ...overrides
});

const psemas: PatientFundKey = { reference: 'MAG1', planOptions: [] };
const nmc: PatientFundKey = { reference: 'NMC1', planOptions: ['Essential'] };

const context = (fund: PatientFundKey | null, book: FundPriceBook, serviceDate = '2026-10-07', practiceId: string | null = PRACTICE): FundPricingContext => ({
  serviceDate,
  practiceId,
  fund,
  book
});

const priceOf = (code: string, practicePrice: number, ctx: FundPricingContext) => {
  const result = fundPriceFor(code, practicePrice, ctx);
  if (!result.ok) throw new Error(result.message);
  return result;
};

// The PSEMAS dental schedule derived from the practice's 2023-2025 claims (aggregates), next to the NAMAF 2025 prices
// the practice tariff holds. PSEMAS paid these on 95-100% of each code's lines; NAMAF prices sent to PSEMAS were cut.
const PSEMAS_BOOK: FundPriceBook = {
  rows: [row('8101', '148.30'), row('8109', '20.00'), row('8369', '386.10'), row('8370', 421.4)],
  contracts: []
};

// Business rule: patients without medical aid, and patients whose fund has no schedule, must be billed exactly the
// practice tariff - this change may not move a single cent for them.
describe('fundPriceFor leaves the practice tariff untouched when no fund schedule applies', () => {
  it('bills a private patient and a fund without a schedule at the practice tariff', () => {
    expect(priceOf('8369', 663, context(null, PSEMAS_BOOK))).toEqual({ ok: true, unitPrice: 663, source: { kind: 'practice_tariff' } });
    expect(priceOf('8369', 663, context(nmc, PSEMAS_BOOK))).toEqual({ ok: true, unitPrice: 663, source: { kind: 'practice_tariff' } });
    expect(priceOf('8369', 663, context({ reference: null, planOptions: [] }, PSEMAS_BOOK)).unitPrice).toBe(663);
    expect(priceOf('8369', 663, context(psemas, EMPTY_PRICE_BOOK)).unitPrice).toBe(663);
  });

  // 20,000 generated visits: random practice prices (real NAMAF values and awkward cents), random dates, random books
  // full of other funds' and other practices' rows. Not one may change for a private patient or an unscheduled fund.
  it('returns the practice price unchanged in 20,000 generated cases', () => {
    const random = seededRandom(20261007);
    const funds = ['MAG1', 'NHPM', 'PROS', 'NAMM'];
    const codes = ['8101', '8104', '8109', '8110', '8145', '8159', '8201', '8346', '8367', '8369', '0190', '0191'];
    for (let index = 0; index < 20000; index += 1) {
      const rows: FundTariffRow[] = Array.from({ length: intBetween(random, 0, 12) }, () =>
        row(pick(random, codes), (intBetween(random, 0, 200000) / 100).toFixed(2), {
          fund_reference: pick(random, funds),
          practice_id: random() < 0.3 ? OTHER_PRACTICE : null,
          plan_option: random() < 0.2 ? 'Essential' : null,
          effective_from: `${intBetween(random, 2023, 2027)}-0${intBetween(random, 1, 9)}-1${intBetween(random, 0, 9)}`
        })
      );
      // Contracts belong to the practice but for other funds than the patient's
      const contracts = random() < 0.3 ? [contract(intBetween(random, 50, 150), { fund_reference: pick(random, funds) })] : [];
      const practicePrice = random() < 0.5 ? pick(random, REAL_PRICES) : intBetween(random, 0, 9999999) / 100;
      const date = `${intBetween(random, 2023, 2027)}-${String(intBetween(random, 1, 12)).padStart(2, '0')}-${String(intBetween(random, 1, 28)).padStart(2, '0')}`;
      const fund = random() < 0.5 ? null : { reference: random() < 0.5 ? 'NMC1' : null, planOptions: ['Essential'] };
      const result = fundPriceFor(pick(random, codes), practicePrice, context(fund, { rows, contracts }, date));
      expect(result).toEqual({ ok: true, unitPrice: practicePrice, source: { kind: 'practice_tariff' } });
    }
  }, 30_000);

  // The tariff lists of the selectors go through priceBillableTariffs: for these patients the list must come back
  // identical, price for price.
  it('returns the same billable tariff list for a private patient (every real price)', () => {
    const rows: TariffRow[] = REAL_PRICES.map((price, index) => ({ id: `t${index}`, code: String(8100 + index), price, effective_from: '2025-01-01' }));
    const { tariffs } = selectBillableTariffs(rows, '2026-10-07');
    const priced = priceBillableTariffs(tariffs, context(null, PSEMAS_BOOK));
    expect(priced).toEqual(tariffs.map(tariff => ({ ...tariff, priceSource: { kind: 'practice_tariff' }, priceProblem: null })));
  });
});

// Business rule: PSEMAS (MAG1) pays its own lower dental tariff; a PSEMAS claim at the NAMAF price is cut on assessment.
describe('fundPriceFor bills the fund its own price', () => {
  it('prices a PSEMAS patient from the PSEMAS schedule and names the source', () => {
    const ctx = context(psemas, PSEMAS_BOOK);
    expect(priceOf('8369', 663, ctx).unitPrice).toBe(386.1);
    expect(priceOf('8101', 254.7, ctx).unitPrice).toBe(148.3);
    expect(priceOf('8109', 34.4, ctx).unitPrice).toBe(20);
    expect(priceOf(' 8370 ', 723.6, ctx).unitPrice).toBe(421.4);
    expect(describePriceSource(priceOf('8369', 663, ctx).source)).toBe('MAG1 fund schedule');
  });

  it('falls back to the practice tariff for a code the fund schedule does not list', () => {
    expect(priceOf('8110', 76.8, context(psemas, PSEMAS_BOOK))).toMatchObject({ unitPrice: 76.8, source: { kind: 'practice_tariff' } });
    expect(fundHasPrices(context(psemas, PSEMAS_BOOK))).toBe(true);
    expect(fundHasPrices(context(nmc, PSEMAS_BOOK))).toBe(false);
  });

  it('matches the fund code without case or spaces', () => {
    expect(priceOf('8369', 663, context({ reference: ' mag1 ', planOptions: [] }, PSEMAS_BOOK)).unitPrice).toBe(386.1);
  });
});

// Business rule: schedules change on a date (NAMAF on 1 January). The price is the one in effect on the service date,
// the newest version wins from its start, and an ambiguous price is refused rather than guessed.
describe('effective dates and versions', () => {
  const book: FundPriceBook = {
    rows: [
      row('8369', '386.10', { effective_from: '2023-12-13' }),
      row('8369', '405.40', { effective_from: '2027-01-01' }),
      row('8101', '148.30', { effective_from: '2023-12-13', effective_to: '2025-12-31' }),
      row('8110', '44.70', { is_active: false })
    ],
    contracts: []
  };

  it('uses the version in effect on the service date', () => {
    expect(priceOf('8369', 663, context(psemas, book, '2026-12-31')).unitPrice).toBe(386.1);
    expect(priceOf('8369', 663, context(psemas, book, '2027-01-01')).unitPrice).toBe(405.4);
    expect(priceOf('8369', 663, context(psemas, book, '2023-12-12')).unitPrice).toBe(663);
  });

  it('stops a version on its end date and ignores inactive rows', () => {
    expect(priceOf('8101', 254.7, context(psemas, book, '2025-12-31')).unitPrice).toBe(148.3);
    expect(priceOf('8101', 254.7, context(psemas, book, '2026-01-01')).unitPrice).toBe(254.7);
    expect(priceOf('8110', 76.8, context(psemas, book)).unitPrice).toBe(76.8);
  });

  it('refuses two different prices that start on the same day, but accepts a repeated identical row', () => {
    const conflicting = { rows: [row('8369', '386.10'), row('8369', '390.00')], contracts: [] };
    expect(fundPriceFor('8369', 663, context(psemas, conflicting))).toEqual({ ok: false, message: expect.stringMatching(/8369 has two different MAG1 prices/) });
    const repeated = { rows: [row('8369', '386.10'), row('8369', 386.1)], contracts: [] };
    expect(priceOf('8369', 663, context(psemas, repeated)).unitPrice).toBe(386.1);
  });

  it('ignores rows without a usable price or date instead of billing them', () => {
    const broken = { rows: [row('8369', 'abc'), row('8369', '-5'), row('8369', '400.00', { effective_from: null })], contracts: [] };
    expect(priceOf('8369', 663, context(psemas, broken)).unitPrice).toBe(663);
  });
});

// Business rule: a fund can pay a different price on some plan options, and a practice can agree its own prices with a
// fund. The most specific price wins; another practice's agreement never applies here.
describe('plan options and practice-specific prices', () => {
  const book: FundPriceBook = {
    rows: [
      row('8101', '254.70', { fund_reference: 'NMC1' }),
      row('8101', '230.00', { fund_reference: 'NMC1', plan_option: 'essential' }),
      row('8101', '200.00', { fund_reference: 'NMC1', plan_option: 'Comprehensive' }),
      row('8104', '120.00', { fund_reference: 'NMC1', practice_id: PRACTICE }),
      row('8104', '100.00', { fund_reference: 'NMC1', practice_id: OTHER_PRACTICE }),
      row('8104', '130.00', { fund_reference: 'NMC1' })
    ],
    contracts: []
  };

  it("uses the patient's plan option price before the fund's all-plans price (plan names compare without case)", () => {
    expect(priceOf('8101', 254.7, context(nmc, book)).unitPrice).toBe(230);
    expect(priceOf('8101', 254.7, context({ reference: 'NMC1', planOptions: ['Standard'] }, book)).unitPrice).toBe(254.7);
    expect(priceOf('8101', 254.7, context(nmc, book)).source).toMatchObject({ kind: 'fund_schedule', planOption: 'essential' });
  });

  it("uses this practice's own price before the fund's shared schedule, and never another practice's", () => {
    expect(priceOf('8104', 137.4, context(nmc, book)).source).toMatchObject({ practiceOnly: true });
    expect(priceOf('8104', 137.4, context(nmc, book)).unitPrice).toBe(120);
    expect(priceOf('8104', 137.4, context(nmc, book, '2026-10-07', OTHER_PRACTICE)).unitPrice).toBe(100);
    expect(priceOf('8104', 137.4, context(nmc, book, '2026-10-07', 'practice-c')).unitPrice).toBe(130);
    expect(priceOf('8104', 137.4, context(nmc, book, '2026-10-07', null)).unitPrice).toBe(130);
  });
});

// Business rule: a contract priced as a percentage of a schedule (Eminance: "contract % x scheme rate"), in whole cents.
describe('contracts: a percentage of the practice tariff or of a fund schedule', () => {
  const nhp: PatientFundKey = { reference: 'NHPM', planOptions: [] };

  it('prices a percentage of the practice tariff, rounded half up to the cent', () => {
    const book = { rows: [], contracts: [contract(90)] };
    expect(priceOf('8369', 663, context(nhp, book))).toMatchObject({ unitPrice: 596.7, source: { kind: 'contract', percent: 90, baseUnitPrice: 663 } });
    // 33.33% of 100.01 = 33.333333 -> 33.33; 12.5% of 0.20 = 0.025 -> 0.03 (half up, never float drift)
    expect(priceOf('8101', 100.01, context(nhp, { rows: [], contracts: [contract('33.33')] })).unitPrice).toBe(33.33);
    expect(priceOf('8101', 0.2, context(nhp, { rows: [], contracts: [contract(12.5)] })).unitPrice).toBe(0.03);
    expect(describePriceSource(priceOf('8369', 663, context(nhp, book)).source)).toBe('NHPM contract: 90% of the practice tariff');
  });

  it("prices a percentage of another fund's schedule and leaves codes that schedule lacks to the next rule", () => {
    const book = { rows: [...PSEMAS_BOOK.rows, row('8110', '70.00', { fund_reference: 'NHPM' })], contracts: [contract(110, { base_fund_reference: 'MAG1' })] };
    expect(priceOf('8369', 663, context(nhp, book)).unitPrice).toBe(424.71); // 110% of 386.10
    expect(priceOf('8110', 76.8, context(nhp, book)).unitPrice).toBe(70); // not in the PSEMAS schedule: NHP's own schedule
    expect(priceOf('8159', 410.3, context(nhp, book)).unitPrice).toBe(410.3); // in neither: the practice tariff
  });

  it("applies only to its own practice, its dates and the patient's plan; a plan contract wins", () => {
    const book = {
      rows: [],
      contracts: [
        contract(90, { effective_to: '2026-12-31' }),
        contract(80, { plan_option: 'Gold' }),
        contract(70, { practice_id: OTHER_PRACTICE })
      ]
    };
    expect(priceOf('8369', 663, context(nhp, book)).unitPrice).toBe(596.7);
    expect(priceOf('8369', 663, context({ reference: 'NHPM', planOptions: ['gold'] }, book)).unitPrice).toBe(530.4);
    expect(priceOf('8369', 663, context(nhp, book, '2027-01-01')).unitPrice).toBe(663);
    expect(priceOf('8369', 663, context(nhp, book, '2025-12-31')).unitPrice).toBe(663);
  });

  it("puts the practice's own fixed price before its contract, and its contract before the fund's shared schedule", () => {
    const book = {
      rows: [row('8369', '500.00', { fund_reference: 'NHPM' }), row('8101', '200.00', { fund_reference: 'NHPM', practice_id: PRACTICE })],
      contracts: [contract(90)]
    };
    expect(priceOf('8101', 254.7, context(nhp, book)).unitPrice).toBe(200);
    expect(priceOf('8369', 663, context(nhp, book)).unitPrice).toBe(596.7);
  });

  // Eminance's contract: the practice's agreed percentage of the fund's own rate (the "scheme rate")
  it("prices a percentage of the fund's own schedule without pricing itself", () => {
    const book = { rows: [row('8369', '400.00', { fund_reference: 'NHPM' })], contracts: [contract(110, { base_fund_reference: 'NHPM' })] };
    expect(priceOf('8369', 663, context(nhp, book))).toMatchObject({ unitPrice: 440, source: { kind: 'contract', baseUnitPrice: 400 } });
    expect(priceOf('8101', 254.7, context(nhp, book)).unitPrice).toBe(254.7);
  });

  it('refuses two different contracts that start on the same day', () => {
    const book = { rows: [], contracts: [contract(90), contract(95)] };
    expect(fundPriceFor('8369', 663, context(nhp, book))).toMatchObject({ ok: false });
  });

  it('reads percentages from 0.01 to 500 with at most two decimals', () => {
    expect(parseContractPercent('33.33')).toBe(33.33);
    expect(parseContractPercent(500)).toBe(500);
    [0, -1, 500.01, '12.345', 'abc', '', null].forEach(value => expect(parseContractPercent(value)).toBeNull());
  });
});

// Business rule: the fund code comes from the patient's provider (claims use the same code). Older patient records name
// the provider in text only, e.g. "PSEMAS", which is MAG1 on claims.
describe('resolveFundReference', () => {
  const providers = [
    { id: 'p1', name: 'PSEMAS', short_name: 'PSEMAS', medical_aid_reference: 'MAG1' },
    { id: 'p2', name: 'Namibia Medical Care', short_name: 'NMC', medical_aid_reference: 'nmc1' },
    { id: 'p3', name: 'Old Fund', short_name: null, medical_aid_reference: null }
  ];
  const knownFund = (name: string): string | null => {
    const rule = getFundRule(null, name);
    return rule.configured ? rule.references[0] ?? null : null;
  };

  it('uses the provider id, then the provider name or short name, then a known fund name', () => {
    expect(resolveFundReference({ medical_aid_provider_id: 'p2', provider: 'whatever' }, providers, knownFund)).toBe('NMC1');
    expect(resolveFundReference({ provider: ' nmc ' }, providers, knownFund)).toBe('NMC1');
    expect(resolveFundReference({ provider: 'Public Service Employees Medical Aid Scheme' }, [], knownFund)).toBe('MAG1');
  });

  it('returns null (practice tariff) when the fund cannot be identified', () => {
    expect(resolveFundReference({ medical_aid_provider_id: 'p3', provider: 'Old Fund' }, providers, knownFund)).toBeNull();
    expect(resolveFundReference({ provider: '' }, providers, knownFund)).toBeNull();
    expect(resolveFundReference({}, providers, knownFund)).toBeNull();
  });
});

describe('priceBillableTariffs', () => {
  it('marks a code whose fund price is ambiguous instead of pricing it', () => {
    const { tariffs } = selectBillableTariffs([{ id: 't1', code: '8369', price: 663 }], '2026-10-07');
    const [priced] = priceBillableTariffs(tariffs, context(psemas, { rows: [row('8369', '386.10'), row('8369', '1.00')], contracts: [] }));
    expect(priced.priceProblem).toMatch(/two different MAG1 prices/);
    expect(priced.unitPrice).toBe(663);
  });
});
