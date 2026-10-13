import { describe, it, expect, vi } from 'vitest';
import {
  QUOTE_STATUSES,
  canChangeStatus,
  canSendQuote,
  defaultValidUntil,
  effectiveQuoteStatus,
  estimateQuote,
  formatDayFirst,
  quoteActions,
  quoteEmailContent,
  quoteLinesToServices,
  quoteSmsText,
  fundRatesFromTariffs,
  repriceQuoteLines,
  servicesToQuoteLines,
  toQuoteLineRecord,
  validateQuoteHeader,
  validityNote,
  type EstimateContext,
  type FundRate,
  type QuoteLineRecord
} from '../quotes';
import { applyBundles, type BundleLine } from '../bundles';
import { priceForPatient, toInvoiceServiceRow } from '../../visits/visitBillingLines';
import type { FundPriceBook, FundTariffRow } from '../../../utils/billing/fundPricing';
import { findInvoiceLineProblems } from '../../../services/invoiceService';
import { fromCents, sumCents, toCents } from '../../../utils/billing/money';
import { REAL_PRICES, intBetween, pick, seededRandom } from '../../../utils/billing/__tests__/generators';
import type { ServiceSelection } from '../../../types/billing';
import { dentalTariffs, raisedTariffs, tariff } from './quoteTestTariffs';

// invoiceService is imported only for its pure line check; nothing here may reach the database
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const tariffs = dentalTariffs();
const line = (code: string, quantity = 1, tooth: string | null = null): BundleLine => ({ code, quantity, tooth, notes: null });
const lineContext = { tariffs, hasMedicalAid: true, autoInfectionControl: true };
const noRates = (hasMedicalAid = true): EstimateContext => ({ hasMedicalAid, fundName: 'Namibia Medical Care', rates: new Map() });
const rates = (...items: FundRate[]): EstimateContext => ({
  hasMedicalAid: true,
  fundName: 'Namibia Medical Care',
  rates: new Map(items.map(rate => [rate.code, rate]))
});
const covered = (code: string, coveredAmount: number): FundRate => ({ code, coveredAmount, patientCopayPercent: null });

/** A treatment plan built with the visit screens' line builder: check-up, two X-rays and a filling. */
const planLines = (): ServiceSelection[] =>
  applyBundles(
    [
      { name: 'Check-up', lines: [line('8101'), line('8159'), line('8107', 2)] },
      { name: 'Filling', lines: [line('8145'), line('8367', 1, '16'), line('8110')] }
    ],
    [],
    lineContext
  ).lines;

const quoteOf = (services: ServiceSelection[], context: EstimateContext = noRates()): QuoteLineRecord[] =>
  servicesToQuoteLines(services, estimateQuote(services, context));

const cents = (values: readonly number[]) => sumCents(values.map(toCents));

// Business rule: a quote is only binding while it is valid. A draft or sent quote is expired from the day
// after "valid until", so nobody accepts or sends old prices; an accepted quote stays accepted.
describe('statuses and expiry', () => {
  it('expires draft and sent quotes the day after "valid until", not on it', () => {
    expect(effectiveQuoteStatus('sent', '2026-10-07', '2026-10-07')).toBe('sent');
    expect(effectiveQuoteStatus('sent', '2026-10-06', '2026-10-07')).toBe('expired');
    expect(effectiveQuoteStatus('draft', '2026-10-06', '2026-10-07')).toBe('expired');
  });

  it('never expires a quote the patient accepted, declined or that became an invoice', () => {
    expect(effectiveQuoteStatus('accepted', '2026-01-01', '2026-10-07')).toBe('accepted');
    expect(effectiveQuoteStatus('declined', '2026-01-01', '2026-10-07')).toBe('declined');
    expect(effectiveQuoteStatus('converted', '2026-01-01', '2026-10-07')).toBe('converted');
  });

  it('does not expire a quote whose date cannot be read (shown as it is stored)', () => {
    expect(effectiveQuoteStatus('sent', '', '2026-10-07')).toBe('sent');
  });

  it('keeps an invoiced quote final and lets only an accepted quote become an invoice', () => {
    QUOTE_STATUSES.forEach(status => expect(canChangeStatus('converted', status)).toBe(false));
    QUOTE_STATUSES.forEach(status => expect(canChangeStatus(status, 'converted')).toBe(status === 'accepted'));
    expect(canChangeStatus('declined', 'accepted')).toBe(false);
    expect(canChangeStatus('declined', 'draft')).toBe(true);
    expect(canChangeStatus('sent', 'draft')).toBe(true);
  });

  it('offers the actions that fit: no accepting or sending an expired quote, deleting only drafts', () => {
    expect(quoteActions('draft', 'draft')).toEqual(['edit', 'mark_sent', 'accept', 'decline', 'delete']);
    expect(quoteActions('sent', 'sent')).toEqual(['edit', 'accept', 'decline']);
    expect(quoteActions('sent', 'expired')).toEqual(['edit', 'decline']);
    expect(quoteActions('draft', 'expired')).toEqual(['edit', 'decline', 'delete']);
    expect(quoteActions('accepted', 'accepted')).toEqual(['convert', 'decline']);
    expect(quoteActions('declined', 'declined')).toEqual(['reopen']);
    expect(quoteActions('converted', 'converted')).toEqual([]);
    expect(canSendQuote('sent', 'expired')).toBe(false);
    expect(canSendQuote('accepted', 'accepted')).toBe(true);
  });

  it('is valid for 90 days by default and warns when that crosses into next year (tariffs change on 1 January)', () => {
    expect(defaultValidUntil('2026-10-07')).toBe('2027-01-05');
    expect(validityNote('2026-10-07', '2027-01-05')).toMatch(/1 January/);
    expect(validityNote('2026-03-01', '2026-05-30')).toBeNull();
  });

  it('refuses a validity date before the quote date and a quote without lines', () => {
    const header = { quoteDate: '2026-10-07', validUntil: '2026-10-01', preauthNumber: '', fundReference: '', notes: '' };
    expect(validateQuoteHeader(header, 0)).toEqual(['"Valid until" cannot be before the quote date.', 'Add at least one code.']);
    expect(validateQuoteHeader({ ...header, validUntil: '2026-10-07' }, 3)).toEqual([]);
  });

  it('writes dates day first, as they are written in Namibia', () => {
    expect(formatDayFirst('2027-01-05')).toBe('05/01/2027');
    expect(formatDayFirst(null)).toBe('-');
  });
});

// Business rule: the estimate may only promise what the practice knows the fund pays. Where the rate is
// known the line is split; where it is not, the patient sees the full amount as their portion and the
// quote says why. Fund and patient portions always add up to the line, to the cent.
describe('estimateQuote', () => {
  const services = planLines();

  it('puts everything on a private patient', () => {
    const estimate = estimateQuote(services, noRates(false));
    expect(estimate).toMatchObject({ basis: 'private', fundCents: 0, patientCents: estimate.totalCents });
    expect(estimate.note).toMatch(/No medical aid/);
  });

  it('shows the full amount as the patient portion when no fund rate is known, and says so', () => {
    const estimate = estimateQuote(services, noRates());
    expect(estimate).toMatchObject({ basis: 'no_rates', fundCents: 0, patientCents: estimate.totalCents });
    expect(estimate.note).toMatch(/no Namibia Medical Care rates on file.*pre-authorisation/);
  });

  it('splits known codes at the fund rate per unit, never more than the line, and names the unknown codes', () => {
    const exam = { code: '8101', quantity: 1, totalPrice: 254.7 };
    const xrays = { code: '8107', quantity: 2, totalPrice: 270.8 };
    const scale = { code: '8159', quantity: 1, totalPrice: 410.3 };
    const estimate = estimateQuote([exam, xrays, scale], rates(covered('8101', 500), covered('8107', 100)));
    expect(estimate.lines).toEqual([
      { fundCents: 25470, patientCents: 0, basis: 'fund_rate' }, // rate above the price: the fund pays the price
      { fundCents: 20000, patientCents: 7080, basis: 'fund_rate' }, // N$ 100 x 2 films
      { fundCents: 0, patientCents: 41030, basis: 'no_rate' }
    ]);
    expect(estimate.basis).toBe('some_rates');
    expect(estimate.unknownCodes).toEqual(['8159']);
    expect(estimate.note).toMatch(/no Namibia Medical Care rate for 8159/);
  });

  it('applies a co-payment percentage when that is what the practice knows', () => {
    const estimate = estimateQuote([{ code: '8159', quantity: 1, totalPrice: 410.3 }], rates({ code: '8159', coveredAmount: null, patientCopayPercent: 20 }));
    expect(estimate).toMatchObject({ basis: 'all_rates', fundCents: 32824, patientCents: 8206 });
  });

  it('always adds up: fund + patient = total, per line and overall (3,000 generated quotes)', () => {
    const random = seededRandom(20261007);
    for (let run = 0; run < 3000; run += 1) {
      const lines = Array.from({ length: intBetween(random, 1, 6) }, () => {
        const unit = pick(random, REAL_PRICES);
        const quantity = intBetween(random, 1, 7);
        return { code: pick(random, ['8101', '8107', '8159', '8145']), quantity, totalPrice: fromCents(toCents(unit) * quantity) };
      });
      const context = rates(
        covered('8101', pick(random, REAL_PRICES)),
        { code: '8107', coveredAmount: null, patientCopayPercent: intBetween(random, 0, 100) },
        covered('8145', pick(random, REAL_PRICES))
      );
      const estimate = estimateQuote(lines, context);
      estimate.lines.forEach((item, index) => {
        expect(item.fundCents + item.patientCents).toBe(toCents(lines[index].totalPrice));
        expect(item.fundCents).toBeGreaterThanOrEqual(0);
        expect(item.patientCents).toBeGreaterThanOrEqual(0);
      });
      expect(estimate.fundCents + estimate.patientCents).toBe(estimate.totalCents);
    }
  });
});

// Business rule: the estimate promises cover only where the practice knows the fund's own price. PSEMAS pays its own
// schedule, so a PSEMAS patient's lines priced from it are the fund's portion; a code billed at the practice tariff
// (no PSEMAS price) stays on the patient. The old source, medical_aid_service_prices, only ever held demo rows.
describe('fundRatesFromTariffs (the fund schedule replaces medical_aid_service_prices)', () => {
  const fundRow = (code: string, unitPrice: string): FundTariffRow => ({
    id: `fund-${code}`,
    practice_id: null,
    fund_reference: 'MAG1',
    code,
    unit_price: unitPrice,
    effective_from: '2023-12-13'
  });
  const book: FundPriceBook = { rows: [fundRow('8101', '148.30'), fundRow('8109', '20.00'), fundRow('8367', '261.30')], contracts: [] };
  const psemas = { reference: 'MAG1', planOptions: [], name: 'PSEMAS' };
  const psemasTariffs = priceForPatient(tariffs, '2026-10-07', { practiceId: 'practice-1', fund: psemas, book });

  it('knows the rate of every code priced from the fund schedule, and of 8346 with its restoration', () => {
    const rates = fundRatesFromTariffs(psemasTariffs);
    expect([...rates.keys()].sort()).toEqual(['8101', '8109', '8346', '8367']);
    expect(rates.get('8101')).toEqual({ code: '8101', coveredAmount: 148.3, patientCopayPercent: null });
    expect(rates.get('8346')).toEqual({ code: '8346', coveredAmount: null, patientCopayPercent: 0 });
  });

  it('estimates a PSEMAS filling: the fund pays its scheduled lines, the patient the codes it has no price for', () => {
    const services = applyBundles([{ name: 'Filling', lines: [line('8367', 1, '16'), line('8110')] }], [], {
      ...lineContext,
      tariffs: psemasTariffs,
      infectionControlStaff: 2
    }).lines;
    expect(services.map(item => [item.code, item.quantity, item.totalPrice])).toEqual([
      ['8109', 2, 40],
      ['8367', 1, 261.3],
      ['8346', 1, 26.13],
      ['8110', 1, 76.8]
    ]);
    const estimate = estimateQuote(services, { hasMedicalAid: true, fundName: 'PSEMAS', rates: fundRatesFromTariffs(psemasTariffs) });
    expect(estimate).toMatchObject({ fundCents: 32743, patientCents: 7680, basis: 'some_rates', unknownCodes: ['8110'] });
  });

  it('knows no rates for a private patient or a fund without a schedule, as before', () => {
    expect(fundRatesFromTariffs(tariffs).size).toBe(0);
    const nmc = priceForPatient(tariffs, '2026-10-07', { practiceId: 'practice-1', fund: { reference: 'NMC1', planOptions: [] }, book });
    expect(fundRatesFromTariffs(nmc).size).toBe(0);
    expect(nmc).toEqual(tariffs);
  });
});

// Business rule: the quote and the invoice it becomes must agree to the cent when the tariffs have not
// changed. Both are built by the same line builder, and invoiceService prices every row with computeLine.
describe('a quote converts to an invoice with the same total', () => {
  it.each([true, false])('medical aid patient: %s', hasMedicalAid => {
    const services = applyBundles(
      [
        { name: 'Check-up', lines: [line('8101'), line('8159'), line('8107', 2)] },
        { name: 'Filling', lines: [line('8145'), line('8367', 1, '16'), line('8110')] }
      ],
      [],
      { ...lineContext, hasMedicalAid }
    ).lines;
    const quoteLines = quoteOf(services, noRates(hasMedicalAid));
    const quoteTotalCents = cents(quoteLines.map(item => item.totalPrice));

    const repriced = repriceQuoteLines(quoteLines, { tariffs, hasMedicalAid });
    expect(repriced.problems).toEqual([]);
    expect(repriced.changes).toEqual([]);
    expect(findInvoiceLineProblems(repriced.services)).toEqual([]);

    const invoiceRows = repriced.services.map(service => toInvoiceServiceRow(service, 'invoice-1', hasMedicalAid));
    expect(cents(invoiceRows.map(row => row.total_price as number))).toBe(quoteTotalCents);
    expect(repriced.newTotalCents).toBe(quoteTotalCents);
    expect(invoiceRows.map(row => [row.code, row.quantity, row.tooth_number])).toEqual(
      quoteLines.map(item => [item.code, item.quantity, item.toothNumbers.join(',') || null])
    );
  });

  it('holds for 500 generated treatment plans at real 2025 prices', () => {
    const random = seededRandom(7102026);
    for (let run = 0; run < 500; run += 1) {
      const priced = tariffs.map(row => (row.code === '8346' ? row : { ...row, price: pick(random, REAL_PRICES).toFixed(2) }));
      const context = { tariffs: priced, hasMedicalAid: random() < 0.5, autoInfectionControl: true };
      const lines = Array.from({ length: intBetween(random, 1, 5) }, () => {
        const code = pick(random, ['8101', '8104', '8107', '8131', '8145', '8159', '8201', '8367']);
        const multipliable = code === '8107' || code === '8145';
        return line(code, multipliable ? intBetween(random, 1, 4) : 1, code === '8201' || code === '8367' ? pick(random, ['11', '16', '36', '48']) : null);
      });
      const services = applyBundles([{ name: 'Plan', lines }], [], context).lines;
      const quoteLines = quoteOf(services, noRates(context.hasMedicalAid));
      const repriced = repriceQuoteLines(quoteLines, context);
      expect(repriced.problems).toEqual([]);
      const invoiceTotal = cents(repriced.services.map(service => toInvoiceServiceRow(service, 'i', context.hasMedicalAid).total_price as number));
      expect(invoiceTotal).toBe(cents(quoteLines.map(item => item.totalPrice)));
    }
  });
});

// Business rule: an accepted quote is invoiced at the tariffs in effect on the day of treatment. Prices
// that changed since the quote are shown line by line before the invoice is created; a code that can no
// longer be billed stops the invoice instead of being billed at the old price.
describe('repriceQuoteLines (conversion)', () => {
  const quoteLines = quoteOf(planLines());

  it('prices every line at the new tariffs and shows each difference', () => {
    const raised = raisedTariffs(tariffs, 1.1);
    const repriced = repriceQuoteLines(quoteLines, { tariffs: raised, hasMedicalAid: true });
    expect(repriced.problems).toEqual([]);
    const price = (code: string) => repriced.services.find(service => service.code === code)?.unitPrice;
    expect(price('8109')).toBe(37.84);
    expect(price('8367')).toBe(493.57);
    expect(price('8346')).toBe(49.36); // follows its filling: 10% of 493.57, rounded to the cent
    expect(repriced.changes.map(change => change.code).sort()).toEqual(['8101', '8107', '8109', '8110', '8145', '8159', '8346', '8367']);
    const xrays = repriced.changes.find(change => change.code === '8107');
    expect(xrays).toMatchObject({ quantity: 2, oldUnitPrice: 135.4, newUnitPrice: 148.94, oldTotal: 270.8, newTotal: 297.88, differenceCents: 2708 });
    expect(repriced.differenceCents).toBe(repriced.newTotalCents - repriced.oldTotalCents);
    expect(repriced.differenceCents).toBe(sumCents(repriced.changes.map(change => change.differenceCents)));
    expect(findInvoiceLineProblems(repriced.services)).toEqual([]);
  });

  it('keeps the tooth, the quantity and the line ids, so the invoice matches the quote line for line', () => {
    const repriced = repriceQuoteLines(quoteLines, { tariffs: raisedTariffs(tariffs, 1.1), hasMedicalAid: true });
    expect(repriced.services.map(service => service.id)).toEqual(quoteLines.map(item => item.id));
    expect(repriced.services.find(service => service.code === '8367')?.teethNumbers).toEqual(['16']);
    expect(repriced.services.find(service => service.code === '8346')?.parentServiceId).toBe(
      repriced.services.find(service => service.code === '8367')?.id
    );
  });

  it('stops on a code that is no longer billable instead of using the quoted price', () => {
    const withoutScale = tariffs.filter(row => row.code !== '8159');
    const repriced = repriceQuoteLines(quoteLines, { tariffs: withoutScale, hasMedicalAid: true });
    expect(repriced.problems).toEqual([expect.stringMatching(/Code 8159 .*no tariff in effect/)]);
    expect(repriced.services.map(service => service.code)).not.toContain('8159');
  });

  it('stops when the tariff no longer allows the quoted quantity', () => {
    const filmsOncePerLine = tariffs.map(row => (row.code === '8107' ? { ...row, can_be_multiplied: 'NO' } : row));
    expect(repriceQuoteLines(quoteLines, { tariffs: filmsOncePerLine, hasMedicalAid: true }).problems).toEqual([
      expect.stringMatching(/8107 is billed once per line/)
    ]);
  });

  it('stops on an 8346 line whose procedure is gone', () => {
    const orphan = quoteLines.filter(item => item.code !== '8367');
    expect(repriceQuoteLines(orphan, { tariffs, hasMedicalAid: true }).problems).toEqual([expect.stringMatching(/8346 material line has no procedure/)]);
  });
});

describe('quoteLinesToServices (editing a saved quote)', () => {
  it('keeps the quoted prices even after a tariff increase: the patient was given those prices', () => {
    const saved = quoteOf(planLines());
    const services = quoteLinesToServices(saved, raisedTariffs(tariffs, 1.1), true);
    expect(services.map(service => service.totalPrice)).toEqual(saved.map(item => item.totalPrice));
    expect(services.find(service => service.code === '8109')).toMatchObject({ isRequired: true, isAutoGenerated: true });
    expect(services.find(service => service.code === '8107')?.canBeMultiplied).toBe(true);
    expect(services.find(service => service.code === '8110')?.canBeMultiplied).toBe(false);
  });

  it('reads database rows (numeric strings, comma-separated teeth)', () => {
    expect(
      toQuoteLineRecord({
        id: 'l1', line_no: 3, tariff_id: null, code: ' 8367 ', description: null, quantity: '1.00', unit_price: '448.70',
        total_price: '448.70', tooth_numbers: '16, 17', notes: ' ', is_auto_generated: null, parent_line_id: null,
        medical_aid_estimate: '0', patient_estimate: '448.70', estimate_basis: 'odd'
      })
    ).toMatchObject({ code: '8367', description: '8367', quantity: 1, unitPrice: 448.7, toothNumbers: ['16', '17'], notes: null, isAutoGenerated: false, estimateBasis: 'no_rate' });
  });
});

// Business rule: quote messages go through the centralized gateways as plain text the patient understands.
// The SMS stays in the GSM alphabet and two parts at most; it only states a patient share the practice knows.
describe('messages to the patient', () => {
  const base = {
    practiceName: 'Smile Dental Windhoek',
    practicePhone: '061 123 456',
    patientFirstName: 'Maria',
    quoteNumber: 'Q2026-0003',
    totalCents: 123450,
    patientCents: 23450,
    validUntil: '2027-01-05'
  };

  it('states the total, the number and the validity day first', () => {
    expect(quoteSmsText({ ...base, basis: 'private' })).toBe(
      'Hi Maria, Smile Dental Windhoek: your treatment estimate Q2026-0003 is N$ 1,234.50. Valid until 05/01/2027. Questions? Call 061 123 456.'
    );
  });

  it('gives the patient share only when every fund rate is known', () => {
    expect(quoteSmsText({ ...base, basis: 'all_rates' })).toMatch(/your estimated share after medical aid: N\$ 234\.50/);
    expect(quoteSmsText({ ...base, basis: 'no_rates' })).toMatch(/what your medical aid pays is not confirmed yet/);
    expect(quoteSmsText({ ...base, basis: 'some_rates' })).not.toMatch(/N\$ 234\.50/);
  });

  it('stays ASCII and within two SMS parts with long names', () => {
    const message = quoteSmsText({
      ...base,
      basis: 'no_rates',
      practiceName: 'Dr Ndapewa’s Family Dental & Implant Centre of Excellence, Eros Park',
      patientFirstName: 'Josephine-Ndeshipanda Amutenya'
    });
    expect(message).toMatch(/^[\x20-\x7E]+$/);
    expect(message.length).toBeLessThanOrEqual(306);
  });

  it('escapes names and notes in the email so they cannot inject HTML', () => {
    const { subject, html, text } = quoteEmailContent({
      practiceName: 'Smile <Dental>',
      practicePhone: '061 123 456',
      practiceEmail: null,
      patientName: '<script>alert(1)</script>',
      quote: {
        quoteNumber: 'Q2026-0003', quoteDate: '2026-10-07', validUntil: '2027-01-05', subtotal: 1234.5,
        medicalAidEstimate: 0, patientEstimate: 1234.5, estimateNote: 'Ask "the fund"', preauthNumber: null
      },
      lines: [{ code: '8101', description: 'Exam & charting', quantity: 1, totalPrice: 254.7 }]
    });
    expect(subject).toBe('Treatment estimate Q2026-0003 from Smile <Dental>');
    expect(html).not.toMatch(/<script>/);
    expect(html).toMatch(/&lt;script&gt;/);
    expect(html).toMatch(/Exam &amp; charting/);
    expect(html).toMatch(/valid until 05\/01\/2027/);
    expect(text).toMatch(/Total: N\$ 1,234\.50/);
  });
});

describe('servicesToQuoteLines', () => {
  it('numbers lines in screen order and keeps links, teeth and the estimate of each line', () => {
    const services = planLines();
    const quoteLines = quoteOf(services, rates(covered('8101', 200)));
    expect(quoteLines.map(item => item.lineNo)).toEqual(services.map((_, index) => index + 1));
    const exam = quoteLines.find(item => item.code === '8101');
    expect(exam).toMatchObject({ medicalAidEstimate: 200, patientEstimate: 54.7, estimateBasis: 'fund_rate' });
    const material = quoteLines.find(item => item.code === '8346');
    expect(material?.parentLineId).toBe(quoteLines.find(item => item.code === '8367')?.id);
    expect(quoteLines.find(item => item.code === '8367')?.toothNumbers).toEqual(['16']);
  });

  it('drops a link to a line that is not in this quote, because the database only accepts links within the quote', () => {
    const withoutExam = planLines().filter(service => service.code !== '8101'); // 8109 was added with the exam
    expect(quoteOf(withoutExam).find(item => item.code === '8109')?.parentLineId).toBeNull();
  });

  it('keeps codes from other practice types as they are', () => {
    const medical = applyBundles([{ name: 'Consult', lines: [line('0190')] }], [], { tariffs: [tariff('0190', '520.00')], hasMedicalAid: false, autoInfectionControl: false }).lines;
    expect(quoteOf(medical, noRates(false)).map(item => [item.code, item.totalPrice, item.patientEstimate])).toEqual([['0190', 520, 520]]);
  });
});
