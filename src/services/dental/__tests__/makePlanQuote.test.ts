/**
 * "Make a quote" on the dental treatment plan (makePlanQuote): the draft quote it saves holds the codes the practice
 * linked to the planned work, as a quote made by hand does, and tells the screen which came, so staff can be told and
 * take any off. Invented practice, patient and work; nothing reaches the database.
 */
import { describe, expect, it, vi } from 'vitest';
import { dentalTariffs } from '../../../components/quotes/__tests__/quoteTestTariffs';
import type { QuoteSaveInput } from '../../../components/quotes/quoteService';
import { NO_CODE_RULES } from '../../../utils/billing/codeRules';
import { EMPTY_PRICE_BOOK } from '../../../utils/billing/fundPricing';
import { sumCents, toCents } from '../../../utils/billing/money';
import type { PlanItem } from '../../../utils/dental/chart';

const saved = vi.hoisted(() => ({ inputs: [] as unknown[] }));
vi.mock('../../../lib/supabase', () => ({ supabase: { rpc: () => Promise.resolve({ data: null, error: null }) } }));
vi.mock('../../../components/quotes/quoteService', async () => {
  const actual = await vi.importActual<typeof import('../../../components/quotes/quoteService')>('../../../components/quotes/quoteService');
  return {
    ...actual,
    saveQuote: vi.fn(async (input: unknown) => {
      saved.inputs.push(input);
      return 'quote-9';
    })
  };
});

import { makePlanQuote, type PlanPricing } from '../dentalChartService';

// The practice links its local anaesthetic (8145) to an extraction (8201)
const tariffs = dentalTariffs().map(row => (row.code === '8201' ? { ...row, code_rules: { ...NO_CODE_RULES, linkedCodes: [{ code: '8145', quantity: 1 }] } } : row));
const fund = { hasMedicalAid: false, fundName: null, scheme: null, membershipNumber: null, pricingFund: null, ratesError: null };
const pricing = {
  tariffSet: { practiceId: 'practice-1', practiceType: 'dental', rows: [], book: EMPTY_PRICE_BOOK, bookError: null, infectionControlStaff: 1 },
  fund,
  billable: tariffs,
  serviceDate: '2026-10-13',
  context: { tariffs, hasMedicalAid: false, autoInfectionControl: true, infectionControlStaff: 1 }
} as unknown as PlanPricing;

const extraction: PlanItem = {
  entry: {
    id: 'entry-1',
    tooth: '46',
    surfaces: null,
    work: 'extraction',
    status: 'planned',
    tariffCode: '8201',
    planVisit: 1,
    planOrder: 1,
    quoteId: null,
    visitId: null,
    invoiceId: null,
    note: null,
    recordedBy: null,
    recordedAt: '2026-10-13T08:00:00Z',
    statusChangedAt: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null
  },
  done: false,
  billedBy: null,
  doneDate: null,
  quote: null
} as PlanItem;

describe('a quote made from the treatment plan', () => {
  it('holds the linked codes under the work they came with, and says which came', async () => {
    const result = await makePlanQuote({ practiceId: 'practice-1', patientId: 'patient-1', visit: 1, items: [extraction], pricing });
    expect(result).toEqual({ quoteId: 'quote-9', linkError: null, linked: [{ from: '8201', codes: ['8145'] }] });

    const input = saved.inputs[0] as QuoteSaveInput;
    expect(input.lines.map(line => line.code)).toEqual(['8109', '8201', '8145']);
    expect(input.lines[2].parentLineId).toBe(input.lines[1].id);
    // The quote's total is the sum of the lines it holds (save_quote adds them up): 34.40 + 208.20 + 40.40
    expect(sumCents(input.lines.map(line => toCents(line.totalPrice)))).toBe(28300);
  });
});
