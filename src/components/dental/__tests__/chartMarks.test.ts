import { describe, it, expect } from 'vitest';
import { buildChart, type BilledLine, type ChartEntry } from '../../../utils/dental/chart';
import { marksFor } from '../chartMarks';

const billed = (code: string, date: string): BilledLine => ({
  key: `${code}-${date}`,
  invoiceId: 'invoice-1',
  invoiceNumber: 'INV2610001',
  visitId: 'visit-1',
  date,
  code,
  description: '',
  teeth: ['36'],
  cancelled: false
});

const entry = (overrides: Partial<ChartEntry>): ChartEntry => ({
  id: overrides.id ?? 'entry-1',
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
  recordedBy: null,
  recordedAt: '2026-10-01T10:00:00Z',
  statusChangedAt: null,
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
  ...overrides
});

const marksOf = (billedLines: BilledLine[], entries: ChartEntry[]) => marksFor(buildChart({ billed: billedLines, entries }).teeth.get('36'));

// Business rule: a glance at the chart must show what needs doing. Work there, defective work and work to do are
// drawn apart (solid, cross-hatched, striped), work to do over what is there; a billed filling without known surfaces
// is a dot, never a guessed surface.
describe('what the chart draws on a tooth', () => {
  it('marks defective work and existing work on their own surfaces', () => {
    const marks = marksOf([], [entry({ id: 'a', surfaces: 'MO', status: 'defective' }), entry({ id: 'b', surfaces: 'D', recordedAt: '2026-10-01T10:05:00Z' })]);
    expect(marks.surfaces).toEqual({ M: 'defective', O: 'defective', D: 'work' });
  });

  it('draws planned work over the work that is there', () => {
    const marks = marksOf([], [entry({ id: 'a', surfaces: 'O' }), entry({ id: 'p', surfaces: 'MOD', status: 'planned', tariffCode: '8369', planVisit: 1 })]);
    expect(marks.surfaces).toEqual({ M: 'planned', O: 'planned', D: 'planned' });
  });

  it('shows a billed filling of unknown surfaces as a dot, and a planned extraction as a cross to do', () => {
    const marks = marksOf([billed('8369', '2026-03-03')], [entry({ id: 'x', work: 'extraction', status: 'planned', tariffCode: '8201', planVisit: 1 })]);
    expect(marks.surfaces).toEqual({});
    expect(marks.unknownFilling).toBe('work');
    expect(marks.extraction).toBe(true);
  });

  it('marks a missing tooth, a crown and a root canal', () => {
    expect(marksOf([billed('8201', '2024-03-03')], []).missing).toBe(true);
    const crowned = marksOf([billed('8339', '2025-02-10'), billed('8411', '2025-03-15')], []);
    expect([crowned.rootCanal, crowned.crown]).toEqual(['work', 'work']);
  });
});
