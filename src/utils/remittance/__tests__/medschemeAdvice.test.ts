/**
 * Medscheme remittance advices and monthly statements (NHP, NAMMED). The payment reference is the
 * key the bank statement and idempotent posting rely on, so it must come from the Payment Summary
 * even where the claim pages wrap it. Values are invented.
 */
import { describe, expect, it } from 'vitest';
import { parseMedschemeAdvice } from '../medschemeAdvice';
import { reconciliationStatus } from '../parseRemittance';
import { paymentKeyOf } from '../posting';
import { medschemeAdvice, type MedschemeLine } from './fixtures';

const block = (lines: Array<Partial<MedschemeLine>>, first: Partial<MedschemeLine> = {}): MedschemeLine[] =>
  lines.map((line, index) => ({
    date: '22/09/2026', tariff: '0190', benefit: 'GEN', charged: 52000, paid: 52000,
    ...(index === 0 ? { member: '00000111222', memberName: 'MR A EXAMPLE', dependant: '01', ref: '0000101', ...first } : {}),
    ...line
  }));

describe('Medscheme remittance advice (new layout)', () => {
  const pages = medschemeAdvice({
    scheme: 'Namibia Health Plan',
    documentDate: '29/09/2026',
    payments: [{
      reference: 'NHP0000001-000042',
      date: '02/10/2026',
      wrapReference: true,
      pages: [[
        ...block([{}, { tariff: '0308', charged: 18000, paid: 18000, remarks: '505/5302' }, { tariff: '0109', charged: 4000, paid: 0, benefit: '', tariffAmount: 0, remarks: '514/5302' }]),
        ...block([{ tariff: '1201', charged: 31000, paid: 25000, tariffAmount: 25000, remarks: '535' }], { member: '00000333444', dependant: '00', ref: '0000202' })
      ]]
    }],
    remarkLegend: { '505': 'Paid from savings', '514': 'Benefit limit reached', '535': 'Reduced to scheme rate', '5302': 'Claim line without ICD-10 code' }
  });

  it('reads each line under its claim block: member, dependant code, practice reference, code, amounts and remark codes', () => {
    const [doc] = parseMedschemeAdvice(pages);
    expect(doc.lines).toHaveLength(4);
    expect(doc.lines[1]).toMatchObject({ memberNumber: '00000111222', dependantCode: '01', practiceReference: '0000101', serviceDate: '2026-09-22', tariffRaw: '0308', claimedCents: 18000, paidCents: 18000, reasonCodes: ['505', '5302'], status: 'paid' });
    expect(doc.lines[2]).toMatchObject({ claimedCents: 4000, paidCents: 0, status: 'rejected', reasonCodes: ['514', '5302'] });
    expect(doc.lines[3]).toMatchObject({ memberNumber: '00000333444', dependantCode: '00', claimedCents: 31000, tariffCents: 25000, paidCents: 25000, status: 'part_paid' });
  });

  it('takes the payment reference from the Payment Summary, because the claim pages wrap it over two rows', () => {
    const [doc] = parseMedschemeAdvice(pages);
    expect(doc.paymentReference).toBe('NHP0000001-000042');
    expect(doc).toMatchObject({ fundCode: 'NHPM', kind: 'payment', paymentDate: '2026-10-02', documentDate: '2026-09-29', totalPaidCents: 52000 + 18000 + 0 + 25000 });
  });

  it('adds up against the block credits, the ACB payment, the totals row and the Payment Summary', () => {
    const [doc] = parseMedschemeAdvice(pages);
    expect(doc.checks.map(check => check.label)).toEqual(expect.arrayContaining(['ACB payment row', 'Payment Summary amount', 'Claim 1 credit', 'Totals row: paid to practice', 'Claims processed']));
    expect(reconciliationStatus(doc).ok).toBe(true);
  });

  it("does not read the page-1 transaction summary's ACB row as a second payment", () => {
    expect(parseMedschemeAdvice(pages)).toHaveLength(1);
  });

  it('explains remark codes with the wording printed on the advice', () => {
    const [doc] = parseMedschemeAdvice(pages);
    expect(doc.lines[2].reasonTexts).toEqual(['Benefit limit reached', 'Claim line without ICD-10 code']);
  });

  it('stops a misread from being posted: a Payment Summary amount that differs from the lines fails', () => {
    const tampered = medschemeAdvice({ scheme: 'NAMMED Medical Aid Fund', documentDate: '29/09/2026', summaryAmountOverride: 100, payments: [{ reference: 'NMD0000001-00007', date: '02/10/2026', pages: [block([{}])] }] });
    const [doc] = parseMedschemeAdvice(tampered);
    expect(doc.fundCode).toBe('NAMM');
    expect(reconciliationStatus(doc).ok).toBe(false);
  });

  it('merges a claim block that continues on the next page (no credit there) before checking its credit', () => {
    const split = medschemeAdvice({
      scheme: 'Namibia Health Plan', documentDate: '29/09/2026',
      payments: [{
        reference: 'NHP0000001-000043', date: '02/10/2026',
        pages: [
          // The block's credit covers all three lines, the third of which is printed on the next page
          block([{}, { tariff: '0308', charged: 18000, paid: 18000 }], { credit: 74000 }),
          // The same block on the next page: member and reference repeated, no credit
          [{ member: '00000111222', memberName: 'MR A EXAMPLE', dependant: '01', ref: '0000101', date: '22/09/2026', tariff: '0109', charged: 4000, paid: 4000, noCredit: true }]
        ]
      }]
    });
    const [doc] = parseMedschemeAdvice(split);
    expect(doc.lines).toHaveLength(3);
    expect(doc.checks.find(check => check.label === 'Claim 1 credit')).toMatchObject({ expectedCents: 74000, actualCents: 74000, ok: true });
    expect(doc.checks.some(check => check.label === 'Claim 2 credit')).toBe(false);
    expect(reconciliationStatus(doc).ok).toBe(true);
  });

  it('reads money the fund paid to the member, which the patient then owes the practice', () => {
    const toMember = medschemeAdvice({ scheme: 'Namibia Health Plan', documentDate: '29/09/2026', payments: [{ reference: 'NHP0000001-000044', date: '02/10/2026', pages: [block([{}, { tariff: '0308', charged: 18000, paid: 0, paidToMember: 18000 }])] }] });
    const [doc] = parseMedschemeAdvice(toMember);
    expect(doc.lines[1]).toMatchObject({ paidCents: 0, paidToMemberCents: 18000, status: 'paid' });
  });
});

describe('Medscheme monthly statement (old layout)', () => {
  const pages = medschemeAdvice({
    title: 'Monthly Statement',
    layout: 'old',
    scheme: 'Namibia Health Plan',
    documentDate: '30/09/2026',
    payments: [
      { reference: 'NHP0000001-000040', date: '11/09/2026', pages: [block([{}, { tariff: '0308', charged: 18000, paid: 18000 }], { patientName: 'Anna', schemeRef: 'EDI0000000101' })] },
      { reference: 'NHP0000001-000041', date: '18/09/2026', pages: [block([{ tariff: '1201', charged: 31000, paid: 0, benefit: '', remarks: '24' }], { member: '00000555666', patientName: 'Ben', schemeRef: 'NAM0000000202', ref: '0000303' })] }
    ],
    remarkLegend: { '24': 'Not covered by the plan' }
  });

  it("splits a month's statement into its payments, each with its own lines and reference", () => {
    const docs = parseMedschemeAdvice(pages);
    expect(docs).toHaveLength(2);
    expect(docs.map(doc => doc.paymentReference)).toEqual(['NHP0000001-000040', 'NHP0000001-000041']);
    expect(docs.map(doc => doc.lines.length)).toEqual([2, 1]);
    expect(docs.every(doc => doc.kind === 'month_summary' && doc.format === 'medscheme_monthly')).toBe(true);
    expect(docs.every(doc => reconciliationStatus(doc).ok)).toBe(true);
  });

  it("keeps the patient's name and the scheme's own claim reference of the old layout", () => {
    const [first, second] = parseMedschemeAdvice(pages);
    expect(first.lines[0]).toMatchObject({ patientName: 'Anna', fundClaimRef: 'EDI0000000101', memberName: 'MR A EXAMPLE', dependantCode: null });
    expect(second.lines[0]).toMatchObject({ patientName: 'Ben', practiceReference: '0000303', reasonCodes: ['24'], status: 'rejected' });
  });

  it('gives a payment the same posting key in the monthly statement as in its remittance advice, so it is posted once', () => {
    const [monthly] = parseMedschemeAdvice(pages);
    const advice = parseMedschemeAdvice(medschemeAdvice({ scheme: 'Namibia Health Plan', documentDate: '08/09/2026', payments: [{ reference: 'NHP0000001-000040', date: '11/09/2026', pages: [block([{}])] }] }))[0];
    expect(paymentKeyOf(monthly)).toBe(paymentKeyOf(advice));
    expect(paymentKeyOf(monthly)).toBe('medscheme:NHP0000001-000040');
  });
});
