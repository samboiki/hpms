import { beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for the query builder that records every call and answers with no rows: nothing reaches a database
const reads = vi.hoisted(() => [] as Array<{ table: string; calls: Array<[string, unknown[]]> }>);
vi.mock('../../lib/supabase', () => {
  const builder = (read: { calls: Array<[string, unknown[]]> }): unknown =>
    new Proxy(
      {},
      {
        get: (_target, method) =>
          method === 'then'
            ? (resolve: (value: unknown) => void) => resolve({ data: [], error: null })
            : (...args: unknown[]) => {
                read.calls.push([String(method), args]);
                return builder(read);
              }
      }
    );
  return {
    supabase: {
      from: (table: string) => {
        const read = { table, calls: [] as Array<[string, unknown[]]> };
        reads.push(read);
        return builder(read);
      }
    }
  };
});
vi.mock('../invoiceContextService', () => ({ loadPracticeStaff: vi.fn(async () => [{ id: 'pr-a', full_name: 'Practitioner A' }]) }));
vi.mock('../icd10Service', () => ({ lookupIcd10Codes: vi.fn(async () => ({ status: 'ready', entries: new Map() })) }));

import { loadFollowUpsDue, loadPeriodVisits, loadTopDiagnoses, periodFilter } from '../encounterAnalyticsService';
import { EXCLUDE_CARRIER_VISITS } from '../../utils/carrierVisits';

const RANGE = { from: '2026-09-13', to: '2026-10-12' };
const callsOf = (table: string) => reads.find((read) => read.table === table)?.calls ?? [];

describe('every analytics read is scoped to the signed-in practice', () => {
  beforeEach(() => {
    reads.length = 0;
  });

  it('the visits: a practice never counts another practice\'s visits', async () => {
    await loadPeriodVisits('practice-1', RANGE);
    expect(callsOf('visits')).toContainEqual(['eq', ['practice_id', 'practice-1']]);
    expect(callsOf('visits')).toContainEqual(['or', [periodFilter(RANGE)]]);
  });

  // A payment plan instalment, a package sale or an opening balance hangs on a cancelled "Not a consultation" row: as a
  // visit it would show as a cancellation nobody made
  it('the visits: rows that only carry invoices are not counted as visits', async () => {
    await loadPeriodVisits('practice-1', RANGE);
    expect(callsOf('visits')).toContainEqual(['or', [EXCLUDE_CARRIER_VISITS]]);
  });

  it('the diagnosis codes: only lines of the practice\'s own invoices, dated in the period', async () => {
    await loadTopDiagnoses('practice-1', RANGE);
    const calls = callsOf('invoice_services');
    expect(String(calls.find(([method]) => method === 'select')?.[1][0])).toContain('invoices_enhanced!inner(');
    expect(calls).toContainEqual(['eq', ['invoice.practice_id', 'practice-1']]);
    expect(calls).toContainEqual(['gte', ['invoice.issue_date', RANGE.from]]);
    expect(calls).toContainEqual(['lte', ['invoice.issue_date', RANGE.to]]);
  });

  it('the follow-ups: only the practice\'s visits that asked for one', async () => {
    await loadFollowUpsDue('practice-1', RANGE, RANGE.to);
    expect(callsOf('visits')).toContainEqual(['eq', ['practice_id', 'practice-1']]);
    expect(callsOf('visits')).toContainEqual(['eq', ['follow_up_required', true]]);
  });
});

describe('which visits a period reads', () => {
  it('takes walk-ins by the day they were seen, since they have no booked day (the diary does the same)', () => {
    expect(periodFilter(RANGE)).toBe(
      'and(scheduled_date.gte.2026-09-13,scheduled_date.lte.2026-10-12),and(scheduled_date.is.null,visit_date.gte.2026-09-13,visit_date.lte.2026-10-12)'
    );
  });
});
