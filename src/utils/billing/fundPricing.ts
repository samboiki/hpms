/**
 * Fund tariff schedules: the price of a code for one patient on one date.
 *
 * Business rules (practice owner: "people must not get wrong prices"):
 * - Every practice type (discipline: dental, GP, urology...) has its practice tariff (practice_tariffs, normally the
 *   NAMAF benchmark of the discipline). Some funds pay their own schedule instead: PSEMAS (fund code MAG1) pays about
 *   61% of the NAMAF 2024 dental benchmark. Those prices are kept in fund_tariffs, per practice type, with the dates
 *   they apply. A practice can also agree prices with a fund as a percentage of a schedule (fund_tariff_contracts).
 * - fundPriceFor(code, practice tariff price, context) is THE price: the fund's price in effect on the service date
 *   when there is one for the code, otherwise the practice tariff. A patient without medical aid, and a fund with
 *   no schedule, get exactly the practice tariff price, untouched.
 * - Most specific first: this practice's own prices for the fund (the patient's plan option, then all plans), this
 *   practice's contract with the fund (a percentage of a base schedule), the fund's schedule for every practice of
 *   the type (plan option, then all plans), the practice tariff.
 * - Within one level the version with the latest effective_from wins, so a new schedule replaces the old one from
 *   its start date. Two versions starting the same day with different prices are ambiguous: the code is refused for
 *   that fund instead of guessed (billing a fund the wrong schedule gets the claim cut). Other practices' rows are
 *   ignored even if they are passed in.
 * - Amounts are whole cents: a contract price is percent x base, rounded half up to the cent.
 *
 * No imports outside src/utils/billing, so the module stays pure and testable.
 */
import { fromCents, hasAtMostDecimals, percentOfCents, toCents } from './money.ts';
import { isValidDateKey, toDateKey } from './dates.ts';
import { parseTariffPrice, type BillableTariff } from './pricing.ts';

/** A fund_tariffs row: one fund's price for one code from a date (practice_id null: every practice of the type). */
export interface FundTariffRow {
  id: string | null;
  practice_id?: string | null;
  fund_reference: string | null;
  /** null: every plan option of the fund */
  plan_option?: string | null;
  code: string | null;
  description?: string | null;
  unit_price: number | string | null;
  effective_from: string | null;
  effective_to?: string | null;
  is_active?: boolean | null;
}

/** A fund_tariff_contracts row: a practice's agreed price for a fund as a percentage of a base schedule. */
export interface FundContractRow {
  id: string | null;
  practice_id: string | null;
  fund_reference: string | null;
  plan_option?: string | null;
  /** null: a percentage of the practice tariff; a fund code: a percentage of that fund's schedule */
  base_fund_reference?: string | null;
  percent: number | string | null;
  effective_from: string | null;
  effective_to?: string | null;
  is_active?: boolean | null;
}

/** The fund prices a practice may use: the fund_tariffs rows of its practice type and its own contracts. */
export interface FundPriceBook {
  rows: readonly FundTariffRow[];
  contracts: readonly FundContractRow[];
}

export const EMPTY_PRICE_BOOK: FundPriceBook = { rows: [], contracts: [] };

/** The patient's fund as pricing needs it. */
export interface PatientFundKey {
  /** medical_aid_providers.medical_aid_reference (the fund code on claims, e.g. MAG1); null when unknown */
  reference: string | null;
  /** The plan option / scheme names on the patient's medical aid record (matched without case) */
  planOptions: readonly string[];
  /** For messages */
  name?: string | null;
}

export interface FundPricingContext {
  /** yyyy-MM-dd */
  serviceDate: string;
  practiceId: string | null;
  /** null: no medical aid */
  fund: PatientFundKey | null;
  book: FundPriceBook;
}

export type FundPriceSource =
  | { kind: 'practice_tariff' }
  | {
      kind: 'fund_schedule';
      fundReference: string;
      planOption: string | null;
      /** True for the practice's own prices, false for the fund's schedule shared by every practice of the type */
      practiceOnly: boolean;
      rowId: string;
      effectiveFrom: string;
    }
  | {
      kind: 'contract';
      fundReference: string;
      planOption: string | null;
      contractId: string;
      percent: number;
      /** null: the practice tariff */
      baseFundReference: string | null;
      baseUnitPrice: number;
      effectiveFrom: string;
    };

export type FundPrice = { ok: true; unitPrice: number; source: FundPriceSource } | { ok: false; message: string };

export const MAX_CONTRACT_PERCENT = 500;

const upper = (value: string | null | undefined): string => (value ?? '').trim().toUpperCase();
const lower = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/** Fund codes compare without case and outer spaces ('mag1 ' = 'MAG1'). */
export const normalizeFundReference = upper;

const inEffect = (from: string | null | undefined, to: string | null | undefined, date: string): string | null => {
  const fromKey = toDateKey(from ?? null);
  const toKey = to ? toDateKey(to) : null;
  if (!fromKey || (to && !toKey) || (toKey && toKey < fromKey)) return null;
  if (date < fromKey || (toKey && date > toKey)) return null;
  return fromKey;
};

const planMatches = (planOption: string | null | undefined, plans: readonly string[]): 'all' | 'plan' | null => {
  const plan = lower(planOption);
  if (!plan) return 'all';
  return plans.includes(plan) ? 'plan' : null;
};

const patientPlans = (fund: PatientFundKey): string[] => [...new Set(fund.planOptions.map(lower).filter(Boolean))];

/** Parses a contract percentage (0 < percent <= 500, at most 2 decimals); null when unusable. */
export function parseContractPercent(value: unknown): number | null {
  const percent = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(percent) || percent <= 0 || percent > MAX_CONTRACT_PERCENT) return null;
  return hasAtMostDecimals(percent, 2) ? percent : null;
}

type Choice<T> = { kind: 'none' } | { kind: 'conflict' } | { kind: 'found'; value: T; from: string };

/** The latest version in effect; two different versions starting the same day are a conflict. */
function latest<T>(candidates: readonly { value: T; from: string; key: string; id: string }[]): Choice<T> {
  if (candidates.length === 0) return { kind: 'none' };
  const newest = candidates.reduce((max, item) => (item.from > max ? item.from : max), candidates[0].from);
  const top = candidates.filter(item => item.from === newest).sort((a, b) => a.id.localeCompare(b.id));
  if (top.some(item => item.key !== top[0].key)) return { kind: 'conflict' };
  return { kind: 'found', value: top[0].value, from: newest };
}

interface RowHit {
  row: FundTariffRow;
  unitPrice: number;
}

/** The fixed fund price for a code at one level (practice-only or shared): plan option first, then all plans. */
function scheduleLevel(
  book: FundPriceBook,
  fundReference: string,
  code: string,
  date: string,
  plans: readonly string[],
  owner: string | null
): Choice<RowHit> {
  const candidates = { plan: [] as { value: RowHit; from: string; key: string; id: string }[], all: [] as { value: RowHit; from: string; key: string; id: string }[] };
  for (const row of book.rows) {
    if (row.is_active === false || !row.id) continue;
    if ((row.practice_id ?? null) !== owner) continue;
    if (upper(row.fund_reference) !== fundReference || upper(row.code) !== code) continue;
    const match = planMatches(row.plan_option, plans);
    if (!match) continue;
    const from = inEffect(row.effective_from, row.effective_to, date);
    if (!from) continue;
    const unitPrice = parseTariffPrice(row.unit_price);
    if (unitPrice === null) continue;
    candidates[match].push({ value: { row, unitPrice }, from, key: String(toCents(unitPrice)), id: row.id });
  }
  const planPick = latest(candidates.plan);
  return planPick.kind === 'none' ? latest(candidates.all) : planPick;
}

interface ContractHit {
  contract: FundContractRow;
  percent: number;
}

function contractLevel(book: FundPriceBook, fundReference: string, date: string, plans: readonly string[], practiceId: string): Choice<ContractHit> {
  const candidates = { plan: [] as { value: ContractHit; from: string; key: string; id: string }[], all: [] as { value: ContractHit; from: string; key: string; id: string }[] };
  for (const contract of book.contracts) {
    if (contract.is_active === false || !contract.id || contract.practice_id !== practiceId) continue;
    if (upper(contract.fund_reference) !== fundReference) continue;
    const match = planMatches(contract.plan_option, plans);
    if (!match) continue;
    const from = inEffect(contract.effective_from, contract.effective_to, date);
    if (!from) continue;
    const percent = parseContractPercent(contract.percent);
    if (percent === null) continue;
    const key = `${percent}|${upper(contract.base_fund_reference)}`;
    candidates[match].push({ value: { contract, percent }, from, key, id: contract.id });
  }
  const planPick = latest(candidates.plan);
  return planPick.kind === 'none' ? latest(candidates.all) : planPick;
}

const conflictMessage = (code: string, fundReference: string): string =>
  `Code ${code} has two different ${fundReference} prices (or contracts) starting on the same day, so it was not priced. Ask an administrator to correct the fund schedule.`;

type Priced = { unitPrice: number; source: FundPriceSource };

/** The fixed price of one owner's rows (this practice, or null for the fund's shared schedule) with its source. */
function scheduleAt(context: FundPricingContext, fundReference: string, code: string, plans: readonly string[], owner: string | null): Choice<Priced> {
  const pick = scheduleLevel(context.book, fundReference, code, context.serviceDate, plans, owner);
  if (pick.kind !== 'found') return pick;
  const { row, unitPrice } = pick.value;
  return {
    kind: 'found',
    from: pick.from,
    value: {
      unitPrice,
      source: {
        kind: 'fund_schedule',
        fundReference,
        planOption: row.plan_option?.trim() || null,
        practiceOnly: owner !== null,
        rowId: String(row.id),
        effectiveFrom: pick.from
      }
    }
  };
}

/** A fund's fixed price for the code: the practice's own rows first, then the fund's shared schedule. */
function fixedFundPrice(context: FundPricingContext, fundReference: string, code: string, plans: readonly string[]): Choice<Priced> {
  if (context.practiceId) {
    const own = scheduleAt(context, fundReference, code, plans, context.practiceId);
    if (own.kind !== 'none') return own;
  }
  return scheduleAt(context, fundReference, code, plans, null);
}

/** The price of the practice's contract with the fund, or none when it has no contract or its base has no price. */
function contractPrice(context: FundPricingContext, practiceId: string, fundReference: string, code: string, plans: readonly string[], practiceUnitPrice: number): Choice<Priced> {
  const contract = contractLevel(context.book, fundReference, context.serviceDate, plans, practiceId);
  if (contract.kind !== 'found') return contract;
  const baseFundReference = upper(contract.value.contract.base_fund_reference) || null;
  let baseUnitPrice: number | null = practiceUnitPrice;
  if (baseFundReference) {
    const base = fixedFundPrice(context, baseFundReference, code, baseFundReference === fundReference ? plans : []);
    if (base.kind === 'conflict') return base;
    baseUnitPrice = base.kind === 'found' ? base.value.unitPrice : null;
  }
  // A contract prices the codes its base prices; other codes fall through to the fund's schedule or the practice tariff
  if (baseUnitPrice === null) return { kind: 'none' };
  return {
    kind: 'found',
    from: contract.from,
    value: {
      unitPrice: fromCents(percentOfCents(toCents(baseUnitPrice), contract.value.percent)),
      source: {
        kind: 'contract',
        fundReference,
        planOption: contract.value.contract.plan_option?.trim() || null,
        contractId: String(contract.value.contract.id),
        percent: contract.value.percent,
        baseFundReference,
        baseUnitPrice,
        effectiveFrom: contract.from
      }
    }
  };
}

/**
 * THE price of `code` for this patient on the service date. `practiceUnitPrice` is the practice tariff price in
 * effect on that date (from selectBillableTariffs). ok=false only when the fund's own prices are ambiguous.
 */
export function fundPriceFor(code: string, practiceUnitPrice: number, context: FundPricingContext): FundPrice {
  const practice: FundPrice = { ok: true, unitPrice: practiceUnitPrice, source: { kind: 'practice_tariff' } };
  const fundReference = upper(context.fund?.reference);
  if (!context.fund || !fundReference || !isValidDateKey(context.serviceDate)) return practice;
  const wanted = upper(code);
  const plans = patientPlans(context.fund);
  const levels: Array<() => Choice<Priced>> = [];
  if (context.practiceId) {
    const practiceId = context.practiceId;
    // 1. This practice's own prices for the fund; 2. its contract with the fund
    levels.push(() => scheduleAt(context, fundReference, wanted, plans, practiceId));
    levels.push(() => contractPrice(context, practiceId, fundReference, wanted, plans, practiceUnitPrice));
  }
  // 3. The fund's schedule for every practice of the type
  levels.push(() => scheduleAt(context, fundReference, wanted, plans, null));
  for (const level of levels) {
    const choice = level();
    if (choice.kind === 'conflict') return { ok: false, message: conflictMessage(wanted, fundReference) };
    if (choice.kind === 'found') return { ok: true, unitPrice: choice.value.unitPrice, source: choice.value.source };
  }
  // 4. The practice tariff
  return practice;
}

/**
 * Whether the patient's fund has prices of its own on the service date (any schedule row or contract): then a code
 * without a fund price is worth a warning, because it goes out at the practice tariff.
 */
export function fundHasPrices(context: FundPricingContext): boolean {
  const fundReference = upper(context.fund?.reference);
  if (!context.fund || !fundReference || !isValidDateKey(context.serviceDate)) return false;
  const plans = patientPlans(context.fund);
  const rowApplies = context.book.rows.some(
    row =>
      row.is_active !== false &&
      upper(row.fund_reference) === fundReference &&
      ((row.practice_id ?? null) === null || row.practice_id === context.practiceId) &&
      planMatches(row.plan_option, plans) !== null &&
      inEffect(row.effective_from, row.effective_to, context.serviceDate) !== null
  );
  const contractApplies =
    context.practiceId !== null &&
    context.book.contracts.some(
      contract =>
        contract.is_active !== false &&
        contract.practice_id === context.practiceId &&
        upper(contract.fund_reference) === fundReference &&
        planMatches(contract.plan_option, plans) !== null &&
        inEffect(contract.effective_from, contract.effective_to, context.serviceDate) !== null
    );
  return rowApplies || contractApplies;
}

/** Plain-language name of where a price came from, for the billing screens. */
export function describePriceSource(source: FundPriceSource): string {
  if (source.kind === 'practice_tariff') return 'practice tariff';
  const plan = source.planOption ? ` (${source.planOption})` : '';
  if (source.kind === 'fund_schedule') {
    return `${source.fundReference}${plan} ${source.practiceOnly ? "practice's agreed price" : 'fund schedule'}`;
  }
  const base = source.baseFundReference ? `the ${source.baseFundReference} schedule` : 'the practice tariff';
  return `${source.fundReference}${plan} contract: ${source.percent}% of ${base}`;
}

/** A billable tariff priced for the patient: the fund price when one applies, or why the code cannot be priced. */
export type PatientTariff = BillableTariff & { priceSource: FundPriceSource; priceProblem: string | null };

/** Prices selectBillableTariffs output for one patient (the selectors' tariff lists). */
export function priceBillableTariffs(tariffs: readonly BillableTariff[], context: FundPricingContext): PatientTariff[] {
  return tariffs.map(tariff => {
    const price = fundPriceFor(tariff.code, tariff.unitPrice, context);
    return price.ok
      ? { ...tariff, unitPrice: price.unitPrice, priceSource: price.source, priceProblem: null }
      : { ...tariff, priceSource: { kind: 'practice_tariff' }, priceProblem: price.message };
  });
}

/** A medical_aid_providers row as needed to find a fund code. */
export interface FundProviderRow {
  id: string;
  name: string | null;
  short_name?: string | null;
  medical_aid_reference: string | null;
}

/**
 * The fund code of a patient's medical aid record: its provider by id, then a provider with the same name or short
 * name, then a fund known by name (e.g. "PSEMAS" is MAG1 on claims). null when none is found: the practice tariff is
 * used. `knownFunds` maps a provider name to a fund code (fundRules.getFundRule).
 */
export function resolveFundReference(
  record: { medical_aid_provider_id?: string | null; provider?: string | null },
  providers: readonly FundProviderRow[],
  knownFund: (providerName: string) => string | null
): string | null {
  const byId = record.medical_aid_provider_id ? providers.find(provider => provider.id === record.medical_aid_provider_id) : undefined;
  if (byId && upper(byId.medical_aid_reference)) return upper(byId.medical_aid_reference);
  const name = lower(record.provider);
  if (name) {
    const byName = providers.find(provider => lower(provider.name) === name || (lower(provider.short_name) !== '' && lower(provider.short_name) === name));
    if (byName && upper(byName.medical_aid_reference)) return upper(byName.medical_aid_reference);
    const known = knownFund(record.provider ?? '');
    if (known) return upper(known);
  }
  return null;
}
