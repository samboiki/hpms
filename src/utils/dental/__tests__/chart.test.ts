import { describe, it, expect } from 'vitest';
import { buildChart, describeWork, toBilledLines, toothSummary, type BilledLine, type ChartChange, type ChartEntry, type QuoteRef } from '../chart';

let next = 0;
const line = (overrides: Partial<BilledLine> = {}): BilledLine => {
  next += 1;
  return {
    key: `line-${next}`,
    invoiceId: 'invoice-1',
    invoiceNumber: 'INV2610001',
    visitId: 'visit-1',
    date: '2026-03-03',
    code: '8369',
    description: 'Resin - three surfaces, posterior',
    teeth: ['36'],
    cancelled: false,
    ...overrides
  };
};

const entry = (overrides: Partial<ChartEntry> = {}): ChartEntry => {
  next += 1;
  return {
    id: `entry-${next}`,
    tooth: '36',
    surfaces: null,
    work: 'filling',
    status: 'existing',
    tariffCode: null,
    planVisit: null,
    planOrder: null,
    quoteId: null,
    visitId: null,
    invoiceId: null,
    note: null,
    recordedBy: 'A practitioner',
    recordedAt: '2026-10-01T10:00:00Z',
    statusChangedAt: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    ...overrides
  };
};

const planned = (overrides: Partial<ChartEntry> = {}): ChartEntry =>
  entry({ status: 'planned', tariffCode: '8369', surfaces: 'MOD', planVisit: 1, planOrder: 1, ...overrides });

const toothOf = (model: ReturnType<typeof buildChart>, tooth = '36') => model.teeth.get(tooth);
const nowOf = (model: ReturnType<typeof buildChart>, tooth = '36') =>
  (toothOf(model, tooth)?.now ?? []).map(work => `${describeWork(work)} ${work.status}`);

// Business rule: every billed line with a tooth number is already history the chart can show, dated by the service
// (the line's own date, else its visit's), so the chart is useful before anything is charted.
describe('billed lines with teeth', () => {
  it('dates lines by the service, splits claim-file teeth and keeps cancelled invoices apart', () => {
    const { lines, unplaced } = toBilledLines(
      [
        { id: 'inv-1', invoice_number: 'INV1', visit_id: 'v1', issue_date: '2026-02-01', created_at: '2026-02-01T08:00:00Z', payment_status: 'paid' },
        { id: 'inv-2', invoice_number: 'INV2', visit_id: null, issue_date: '2026-04-01', created_at: '2026-04-01T08:00:00Z', payment_status: 'cancelled' }
      ],
      [
        { id: 's1', invoice_id: 'inv-1', code: '8369', description: 'Resin', tooth_number: '36' },
        { id: 's2', invoice_id: 'inv-1', code: '8201', description: 'Extraction', tooth_number: '1112', service_date: '2026-02-03' },
        { id: 's3', invoice_id: 'inv-2', code: '8367', description: 'Resin', tooth_number: '19' },
        { id: 's4', invoice_id: 'inv-2', code: '8367', description: 'Resin', tooth_number: '46' }
      ],
      [{ id: 'v1', visit_date: '2026-02-02' }]
    );
    expect(lines.map(item => [item.key, item.date, item.teeth.join(','), item.cancelled])).toEqual([
      ['s1', '2026-02-02', '36', false],
      ['s2', '2026-02-03', '11,12', false],
      ['s4', '2026-04-01', '46', true]
    ]);
    expect(unplaced).toBe(1);
  });
});

// Business rule: what is on a tooth now. An extraction leaves it missing (a fund pended a restoration on a tooth it
// knew was extracted), a crown covers the fillings under it, a new filling replaces the one on the same surfaces.
describe('what is on a tooth now', () => {
  it('shows billed work: an extraction makes the tooth missing', () => {
    const model = buildChart({ billed: [line({ code: '8201', description: 'Single tooth extraction' })], entries: [] });
    expect(toothOf(model)?.missing).toBe(true);
    expect(nowOf(model)).toEqual(['Missing done']);
  });

  it('knows the number of surfaces of a billed filling even without the surfaces themselves', () => {
    const model = buildChart({ billed: [line({ code: '8369' })], entries: [] });
    expect(nowOf(model)).toEqual(['Filling (3 surfaces) done']);
  });

  it('lets a crown replace the fillings under it', () => {
    const model = buildChart({
      billed: [line({ code: '8369', date: '2025-01-10' }), line({ code: '8411', description: 'Porcelain veneered crown', date: '2026-01-10' })],
      entries: []
    });
    expect(nowOf(model)).toEqual(['Crown done']);
  });

  it('keeps fillings on different surfaces and replaces the one a new filling covers', () => {
    const model = buildChart({
      billed: [],
      entries: [
        entry({ surfaces: 'O', recordedAt: '2026-01-01T09:00:00Z' }),
        entry({ surfaces: 'D', recordedAt: '2026-01-01T09:05:00Z' }),
        entry({ surfaces: 'MO', recordedAt: '2026-06-01T09:00:00Z' })
      ]
    });
    expect(nowOf(model)).toEqual(['Filling D existing', 'Filling M O existing']);
  });

  it('keeps an implant in the place of a missing tooth', () => {
    const model = buildChart({
      billed: [line({ code: '8194', description: 'Placement of single osseo-integrated implant', date: '2026-05-01' })],
      entries: [entry({ work: 'missing', recordedAt: '2025-03-01T09:00:00Z' })]
    });
    expect(nowOf(model)).toEqual(['Missing existing', 'Implant done']);
    expect(toothOf(model)?.missing).toBe(true);
  });

  it('shows existing work marked defective, and says how it was first recorded', () => {
    const work = entry({ surfaces: 'MO', status: 'defective', statusChangedAt: '2026-10-05T09:00:00Z' });
    const changes: ChartChange[] = [
      { id: 'c1', entryId: work.id, action: 'recorded', fromStatus: null, toStatus: 'existing', quoteId: null, reason: null, changedBy: 'A practitioner', changedAt: work.recordedAt },
      { id: 'c2', entryId: work.id, action: 'status', fromStatus: 'existing', toStatus: 'defective', quoteId: null, reason: null, changedBy: 'A practitioner', changedAt: '2026-10-05T09:00:00Z' }
    ];
    const model = buildChart({ billed: [], entries: [work], changes });
    expect(nowOf(model)).toEqual(['Filling M O defective']);
    expect(toothOf(model)?.events.map(event => event.text)).toEqual(['Filling M O marked defective', 'Filling M O recorded as existing']);
  });

  it('leaves an entry made in error out of the chart but crossed out in the history', () => {
    const mistake = entry({ tooth: '46', work: 'missing', voidedAt: '2026-10-02T09:00:00Z', voidReason: 'Wrong tooth' });
    const model = buildChart({ billed: [], entries: [mistake] });
    expect(nowOf(model, '46')).toEqual([]);
    expect(toothOf(model, '46')?.events[0].struck).toBe(true);
  });

  it('never shows work from a cancelled invoice, only a crossed-out history line', () => {
    const model = buildChart({ billed: [line({ code: '8201', cancelled: true })], entries: [] });
    expect(nowOf(model)).toEqual([]);
    expect(toothOf(model)?.events.map(event => [event.struck, event.text])).toEqual([[true, '8201 Resin - three surfaces, posterior (invoice cancelled)']]);
  });
});

// Business rule: planned work is done when it was billed on its tooth: the invoice is the proof, nobody has to tick
// it off, and the chart then shows it as work on the tooth (with the surfaces that were planned).
describe('planned work becoming done', () => {
  it('is done when its code is billed on its tooth on or after the day it was planned', () => {
    const item = planned({ recordedAt: '2026-10-01T10:00:00Z' });
    const billed = line({ date: '2026-10-07', invoiceId: 'invoice-7' });
    const model = buildChart({ billed: [billed], entries: [item] });
    expect(model.planItems.map(plan => [plan.done, plan.billedBy?.key, plan.doneDate])).toEqual([[true, billed.key, '2026-10-07']]);
    expect(toothOf(model)?.plan).toEqual([]);
    // Shown once, with the planned surfaces (not again as a billed filling of unknown surfaces)
    expect(nowOf(model)).toEqual(['Filling M O D done']);
  });

  it('is not done by the same work billed before it was planned', () => {
    const model = buildChart({ billed: [line({ date: '2026-09-30' })], entries: [planned()] });
    expect(model.planItems[0].done).toBe(false);
    expect(toothOf(model)?.plan).toHaveLength(1);
    expect(nowOf(model)).toEqual(['Filling (3 surfaces) done']);
  });

  it('goes back on the plan when the invoice is cancelled', () => {
    const model = buildChart({ billed: [line({ date: '2026-10-07', cancelled: true })], entries: [planned()] });
    expect(model.planItems[0].done).toBe(false);
  });

  it('is done by the invoice its quote became, whatever that invoice is dated', () => {
    const quote: QuoteRef = { id: 'quote-1', quoteNumber: 'Q2026-0001', status: 'converted', convertedInvoiceId: 'invoice-9' };
    const model = buildChart({
      billed: [line({ date: '2026-09-30', invoiceId: 'invoice-9' })],
      entries: [planned({ quoteId: 'quote-1' })],
      quotes: [quote]
    });
    expect(model.planItems[0].done).toBe(true);
    expect(model.planItems[0].quote?.quoteNumber).toBe('Q2026-0001');
  });

  it('lets one billed line complete one planned item only', () => {
    const first = planned({ recordedAt: '2026-10-01T10:00:00Z' });
    const second = planned({ recordedAt: '2026-10-01T11:00:00Z', planOrder: 2 });
    const model = buildChart({ billed: [line({ date: '2026-10-07' })], entries: [first, second] });
    expect(model.planItems.map(plan => [plan.entry.id, plan.done])).toEqual([
      [first.id, true],
      [second.id, false]
    ]);
  });

  it('can be marked done by hand when the work was billed differently', () => {
    const model = buildChart({ billed: [], entries: [planned({ status: 'done', statusChangedAt: '2026-10-07T12:00:00Z' })] });
    expect(model.planItems[0]).toMatchObject({ done: true, billedBy: null, doneDate: '2026-10-07' });
    expect(nowOf(model)).toEqual(['Filling M O D done']);
  });

  it('drops work taken off the plan from the plan and the chart', () => {
    const model = buildChart({ billed: [], entries: [planned({ status: 'removed' })] });
    expect(toothOf(model)?.plan).toEqual([]);
    expect(nowOf(model)).toEqual([]);
  });
});

// Business rule: screen readers hear what a sighted user sees on the tooth.
describe('tooth summary', () => {
  it('says what is on the tooth and what is planned', () => {
    const model = buildChart({ billed: [line({ code: '8339', description: 'First canal - molars' })], entries: [planned({ tariffCode: '8411', work: 'crown', surfaces: null })] });
    expect(toothSummary(toothOf(model))).toBe('Root canal; 1 planned');
    expect(toothSummary(undefined)).toBe('nothing recorded');
  });
});
