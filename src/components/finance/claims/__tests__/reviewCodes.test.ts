/**
 * ICD-10 codes at claim review. A claim without the right code is not paid, and the practice's usual code per tariff
 * code saves typing the same code on every line. Codes fixed at claim review must also reach the invoice line:
 * otherwise the printed invoice disagrees with the claim, and the next time the invoice changes the database rebuilds
 * the claim lines from the invoice lines and the fixed codes are gone. A batch the fund already has is never
 * rewritten. Invented values only.
 */
import { describe, it, expect } from 'vitest';
import { toTariffIcd10Defaults } from '../../../../utils/billing/icd10Defaults';
import { initialDrafts, keptOnClaimReason, planCodeWriteBack, type InvoiceClaimPlace } from '../reviewCodes';
import type { BatchDetailRow, InvoiceServiceRow, VisitRow } from '../types';

// Only the fields claim review reads for the codes
const detail = (overrides: Partial<BatchDetailRow>): BatchDetailRow =>
  ({ id: 'd1', invoice_id: 'inv-a', visit_id: null, bhf_tariff_code: '0190', diagnostic_code: null, ...overrides }) as BatchDetailRow;

describe('the codes a claim line starts with', () => {
  const usual = toTariffIcd10Defaults([{ tariff_code: '0190', icd10_code: 'j06.9' }]);
  const sources = (details: BatchDetailRow[]) => ({ details, visits: new Map<string, VisitRow>(), practiceType: 'General Practice' });

  it("offers the practice's usual code for the tariff code, still to be confirmed by the doctor", () => {
    expect(initialDrafts(sources([detail({})]), usual).d1).toEqual({ primary: 'J06.9', secondary: [], confirmed: false, source: 'usual-for-code' });
  });

  it('never replaces codes already on the claim line', () => {
    const drafts = initialDrafts(sources([detail({ diagnostic_code: 'I10/E11.9' })]), usual);
    expect(drafts.d1).toEqual({ primary: 'I10', secondary: ['E11.9'], confirmed: true, source: 'saved' });
  });

  it('suggests nothing of its own when the usual codes could not be read', () => {
    expect(initialDrafts(sources([detail({})]), null).d1).toMatchObject({ primary: '', confirmed: false, source: 'none' });
  });
});

const openBatch = { id: 'b-open', status: 'active', sent_at: null };
const sentBatch = { id: 'b-sent', status: 'sent', sent_at: '2026-09-01T10:00:00Z' };
const inThisBatch: InvoiceClaimPlace = { ownBatch: openBatch, batchIds: ['b-open'] };

const invoiceLine = (id: string, codes: string[] = []): Pick<InvoiceServiceRow, 'id' | 'icd10_primary' | 'icd10_secondary'> => ({
  id,
  icd10_primary: codes[0] ?? null,
  icd10_secondary: codes.slice(1)
});

/** Two claim lines of invoice A (d1, d2) and one of invoice B (d3) */
const plan = (overrides: Partial<Parameters<typeof planCodeWriteBack>[0]> = {}) =>
  planCodeWriteBack({
    batch: openBatch,
    lines: [
      { key: 'd1', invoiceId: 'inv-a', invoiceNumber: 'A-001' },
      { key: 'd2', invoiceId: 'inv-a', invoiceNumber: 'A-001' },
      { key: 'd3', invoiceId: 'inv-b', invoiceNumber: 'B-002' }
    ],
    details: [detail({ id: 'd1' }), detail({ id: 'd2' }), detail({ id: 'd3', invoice_id: 'inv-b' })],
    saved: new Map([['d1', { primary: 'J06.9', secondary: ['I10'] }]]),
    invoiceLines: new Map([
      ['d1', invoiceLine('svc-1')],
      ['d2', invoiceLine('svc-2')],
      ['d3', invoiceLine('svc-3')]
    ]),
    places: new Map([['inv-a', inThisBatch], ['inv-b', inThisBatch]]),
    ...overrides
  });

describe('putting codes saved at claim review on the invoice lines', () => {
  it('puts them on the invoice line the claim line came from, main code first', () => {
    expect(plan()).toEqual({
      copies: [{ invoiceId: 'inv-a', invoiceNumber: 'A-001', rebuildsClaim: true, lines: [{ invoiceLineId: 'svc-1', primary: 'J06.9', secondary: ['I10'] }] }],
      kept: []
    });
  });

  // The database rebuilds all of the invoice's claim lines from its invoice lines: a line coded only on the claim
  // would come back without codes
  it("also copies the codes the invoice's other claim lines hold, and leaves other invoices alone", () => {
    const result = plan({ details: [detail({ id: 'd1' }), detail({ id: 'd2', diagnostic_code: 'K02.1' }), detail({ id: 'd3', invoice_id: 'inv-b', diagnostic_code: 'K04.0' })] });
    expect(result.copies).toHaveLength(1);
    expect(result.copies[0].lines.map(line => [line.invoiceLineId, line.primary])).toEqual([['svc-1', 'J06.9'], ['svc-2', 'K02.1']]);
  });

  it('does not rewrite an invoice line that already has the codes', () => {
    expect(plan({ invoiceLines: new Map([['d1', invoiceLine('svc-1', ['J06.9', 'I10'])]]) })).toEqual({ copies: [], kept: [] });
  });

  // A resubmitted line sits in this batch while its invoice belongs to the batch the fund answered: the database then
  // rewrites no batch at all, so only the invoice changes
  it('copies to the invoice of a resubmitted line without touching the sent batch it belongs to', () => {
    const result = plan({ places: new Map([['inv-a', { ownBatch: sentBatch, batchIds: ['b-sent', 'b-open'] }]]) });
    expect(result.copies).toEqual([expect.objectContaining({ invoiceId: 'inv-a', rebuildsClaim: false })]);
  });

  it('writes nothing from a batch that was sent', () => {
    expect(plan({ batch: sentBatch })).toEqual({ copies: [], kept: [] });
  });
});

describe('codes that stay on the claim only', () => {
  // The database would delete the invoice's lines from every batch, a sent one included
  it('when another batch also holds the invoice lines', () => {
    expect(plan({ places: new Map([['inv-a', { ownBatch: openBatch, batchIds: ['b-open', 'b-sent'] }]]) })).toEqual({
      copies: [],
      kept: [{ invoiceNumber: 'A-001', reason: 'other-batch' }]
    });
  });

  // The database writes the lines into the fund's batch whose status is 'active': they would leave this batch
  it("when this batch is not the fund's active batch", () => {
    const ready = { ...openBatch, status: 'ready' };
    expect(keptOnClaimReason(ready, { ownBatch: ready, batchIds: ['b-open'] })).toBe('not-active');
    expect(keptOnClaimReason(openBatch, inThisBatch)).toBeNull();
  });

  // Its claim lines would be rebuilt wherever the database puts the invoice, and an unread place is not known to be safe
  it('when the invoice is not linked to this batch, or where it is claimed could not be read', () => {
    expect(keptOnClaimReason(openBatch, { ownBatch: null, batchIds: ['b-open'] })).toBe('not-linked');
    expect(keptOnClaimReason(openBatch, { ownBatch: { id: 'b-other', status: 'active', sent_at: null }, batchIds: ['b-open'] })).toBe('not-linked');
    expect(keptOnClaimReason(openBatch, undefined)).toBe('unknown');
  });

  // Copying the other lines would rebuild the claim and drop that line's codes
  it('when a coded line of the invoice has no invoice line, or codes the fund would refuse', () => {
    expect(plan({ invoiceLines: new Map([['d1', invoiceLine('svc-1')]]), details: [detail({ id: 'd1' }), detail({ id: 'd2', diagnostic_code: 'K02.1' })] }).kept).toEqual([
      { invoiceNumber: 'A-001', reason: 'no-invoice-line' }
    ]);
    expect(plan({ details: [detail({ id: 'd1' }), detail({ id: 'd2', diagnostic_code: 'W19' })] }).kept).toEqual([
      { invoiceNumber: 'A-001', reason: 'codes-refused' }
    ]);
  });

});
