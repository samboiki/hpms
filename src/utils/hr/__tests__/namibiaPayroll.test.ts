import { describe, it, expect } from 'vitest';
import { annualIncomeTax, monthlyPaye, socialSecurityContribution, applyNamibianStatutoryDeductions } from '../namibiaPayroll';

const october2026 = new Date(2026, 9, 31);

describe('annualIncomeTax (NamRA table from 1 March 2024)', () => {
  it.each([
    [100_000, 0], // the first N$100,000 is tax free
    [150_000, 9_000], // 18% of the N$50,000 above 100,000
    [200_000, 21_500], // 9,000 + 25% of 50,000
    [350_000, 59_000],
    [600_000, 130_000], // 115,000 + 30% of 50,000
    [1_000_000, 253_000], // 205,000 + 32% of 150,000
    [2_000_000, 595_500] // 429,000 + 37% of 450,000
  ])('taxes N$%i a year at N$%i', (income, tax) => {
    expect(annualIncomeTax(income)).toBe(tax);
  });

  it('is continuous at each bracket edge, so a raise never lowers take-home pay', () => {
    for (const edge of [100_000, 150_000, 350_000, 550_000, 850_000, 1_550_000]) {
      expect(annualIncomeTax(edge + 1) - annualIncomeTax(edge)).toBeLessThan(1);
    }
  });
});

describe('monthlyPaye', () => {
  it('annualises the month: N$ 20,000 a month is taxed as N$ 240,000 a year', () => {
    const result = monthlyPaye({ taxableMonthlyEarnings: 20_000, monthlyRetirementContributions: 0, payPeriodEnd: october2026 });
    expect(result?.annualTax).toBe(31_500); // 9,000 + 25% of 90,000
    expect(result?.amount).toBe(2_625);
  });

  it('lets pension contributions reduce taxable pay, up to N$ 150,000 a year', () => {
    const withPension = monthlyPaye({ taxableMonthlyEarnings: 20_000, monthlyRetirementContributions: 1_500, payPeriodEnd: october2026 });
    expect(withPension?.annualTaxableIncome).toBe(222_000);
    const capped = monthlyPaye({ taxableMonthlyEarnings: 100_000, monthlyRetirementContributions: 20_000, payPeriodEnd: october2026 });
    expect(capped?.annualTaxableIncome).toBe(1_050_000); // 1,200,000 less the 150,000 cap, not less 240,000
  });

  it('charges no PAYE below the N$ 100,000 a year threshold', () => {
    expect(monthlyPaye({ taxableMonthlyEarnings: 8_000, monthlyRetirementContributions: 0, payPeriodEnd: october2026 })?.amount).toBe(0);
  });

  it('refuses periods before the table applies instead of using the wrong one', () => {
    expect(monthlyPaye({ taxableMonthlyEarnings: 20_000, monthlyRetirementContributions: 0, payPeriodEnd: new Date(2024, 1, 29) })).toBeNull();
  });
});

describe('socialSecurityContribution', () => {
  it('is 0.9% of the basic wage, capped at the N$ 11,000 ceiling from March 2025 (N$ 99)', () => {
    expect(socialSecurityContribution(8_000, october2026)).toBe(72);
    expect(socialSecurityContribution(25_000, october2026)).toBe(99);
  });

  it('uses the old N$ 9,000 ceiling (N$ 81) before March 2025', () => {
    expect(socialSecurityContribution(25_000, new Date(2025, 1, 28))).toBe(81);
  });
});

describe('applyNamibianStatutoryDeductions', () => {
  it('replaces typed-in PAYE and SSC lines with calculated ones and adds the employer SSC contribution', () => {
    const result = applyNamibianStatutoryDeductions({
      basicSalary: 12_000,
      earnings: [{ name: 'Housing Allowance', amount: 2_400 }, { name: 'Overtime (3 h at 150%)', amount: 276.92 }],
      deductions: [
        { name: 'Tax (PAYE)', amount: 1_800 }, // a fixed amount someone typed in
        { name: 'Social Security', amount: 1_020 }, // far above the legal maximum of N$ 99
        { name: 'Pension Contribution', amount: 840 }
      ],
      payPeriodEnd: october2026
    });
    // Taxable: 12,000 + 2,400 + 276.92 = 14,676.92 a month; less pension 840 -> 13,836.92 x 12 = 166,043.04
    // Tax: 9,000 + 25% of 16,043.04 = 13,010.76 a year -> 1,084.23 a month
    expect(result.deductions).toEqual([
      { name: 'Pension Contribution', amount: 840 },
      { name: 'Tax (PAYE)', code: 'PAYE', amount: 1_084.23 },
      { name: 'Social Security (SSC)', code: 'SSC', amount: 99 }
    ]);
    expect(result.earnings[result.earnings.length - 1]).toEqual({ name: 'Social Security (employer)', code: 'SSC_EMPLOYER', amount: 99, isCompanyContribution: true });
  });

  it('does not tax company contributions or earnings marked non-taxable', () => {
    const result = applyNamibianStatutoryDeductions({
      basicSalary: 10_000,
      earnings: [{ name: 'Medical aid (employer)', amount: 3_000, isCompanyContribution: true }, { name: 'Travel reimbursement', amount: 5_000, taxable: false }],
      deductions: [],
      payPeriodEnd: october2026
    });
    expect(result.paye?.annualTaxableIncome).toBe(120_000);
  });

  it('lowers taxable pay and the Social Security basis by unpaid leave, which is pay not earned', () => {
    const result = applyNamibianStatutoryDeductions({
      basicSalary: 10_000,
      earnings: [],
      deductions: [{ name: 'Unpaid Leave Deduction', code: 'UNPAID_LEAVE', amount: 4_000 }],
      payPeriodEnd: october2026
    });
    expect(result.paye?.annualTaxableIncome).toBe(72_000); // (10,000 - 4,000) x 12
    expect(result.deductions.find(line => line.code === 'SSC')?.amount).toBe(54); // 0.9% of 6,000
  });

  it('keeps a configured PAYE line for periods without a tax table rather than dropping tax', () => {
    const result = applyNamibianStatutoryDeductions({
      basicSalary: 12_000,
      earnings: [],
      deductions: [{ name: 'Tax (PAYE)', amount: 1_500 }],
      payPeriodEnd: new Date(2024, 0, 31)
    });
    expect(result.deductions.find(line => line.name === 'Tax (PAYE)')?.amount).toBe(1_500);
  });
});
