import { describe, expect, it } from 'vitest';
import { jobCosting, jobRow, validateCosts, withoutVat, type JobInput } from '../jobCosting';

const job = (values: Partial<JobInput>): JobInput => ({
  orderId: 'o1', orderNo: 1, patientId: 'p1', orderedOn: '2026-10-05', status: 'collected', lensCostCents: 80000, labourCostCents: 15000,
  labInvoiceRef: 'L-1', frameCostCents: 45000,
  invoice: { id: 'i1', number: 'INV-1', lines: [{ totalCents: 115000, vatRate: 15 }, { totalCents: 180000, vatRate: null }] },
  ...values
});

// Business rule: the owner wants to know what each pair of spectacles earned: the price against the frame, the
// lenses from the lab and the practice's labour; a frame's price includes VAT (the stock rule), its cost does not
describe('job costing', () => {
  it('takes the VAT off stock lines only and works out the profit and margin', () => {
    expect(withoutVat(115000, 15)).toBe(100000);
    const row = jobRow(job({}));
    expect(row).toMatchObject({ priceCents: 280000, costCents: 140000, profitCents: 140000, margin: 0.5, gaps: [], invoiceNumber: 'INV-1' });
  });

  it('says what is missing, so an unfinished job is not read as pure profit', () => {
    const row = jobRow(job({ lensCostCents: null, invoice: null }));
    expect(row.gaps).toEqual(['invoice', 'lens_cost']);
    expect(row).toMatchObject({ priceCents: 0, margin: null, profitCents: -60000 });
  });

  it('leaves cancelled orders out and adds up the rest, newest first', () => {
    const report = jobCosting([
      job({ orderId: 'a', orderNo: 1, orderedOn: '2026-10-01' }),
      job({ orderId: 'b', orderNo: 2, orderedOn: '2026-10-09', labourCostCents: null }),
      job({ orderId: 'c', orderNo: 3, status: 'cancelled' })
    ]);
    expect(report.rows.map(row => row.orderId)).toEqual(['b', 'a']);
    expect(report).toMatchObject({ priceCents: 560000, frameCostCents: 90000, lensCostCents: 160000, labourCostCents: 15000, costCents: 265000, profitCents: 295000, incomplete: 1 });
  });
});

describe('entering a job\'s costs', () => {
  it('keeps empty boxes as not entered and refuses what is not an amount', () => {
    expect(validateCosts({ lensCost: 'N$ 1,250.50', labourCost: '', labInvoiceRef: ' HOYA-77 ' })).toEqual({
      ok: true,
      payload: { lens_cost: 1250.5, labour_cost: null, lab_invoice_ref: 'HOYA-77' }
    });
    expect(validateCosts({ lensCost: '12.345', labourCost: 'abc', labInvoiceRef: '' })).toMatchObject({ ok: false, errors: { lensCost: expect.any(String), labourCost: expect.any(String) } });
  });
});
