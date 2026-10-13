import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

// No database in unit tests
vi.mock('../../lib/supabase', () => ({ supabase: { from: fromMock } }));

import { PRACTICE_OVERVIEW_COLUMNS, countByPractice, loadPracticeOverview, windhoekMonthRange } from '../practiceOverviewService';
import { EXCLUDE_CARRIER_VISITS } from '../../utils/carrierVisits';

type Result = { data?: unknown; error?: unknown; count?: number | null };

/** A PostgREST query stand-in that records its calls; awaiting it gives the result. */
function query(result: Result, log: Array<[string, unknown[]]>) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'or', 'order', 'not', 'gte', 'lt']) {
    builder[method] = (...args: unknown[]) => {
      log.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, count: null, ...result }).then(resolve, reject);
  return builder;
}

const calls: Record<string, Array<Array<[string, unknown[]]>>> = {};

/** Answers per table; patients and visits answer per practice id (the eq filter). */
function database(answers: { practices: Result; users: Result; patients?: Record<string, Result>; visits?: Record<string, Result> }) {
  fromMock.mockImplementation((table: string) => {
    const log: Array<[string, unknown[]]> = [];
    (calls[table] ??= []).push(log);
    if (table === 'practices' || table === 'users') return query(answers[table], log);
    // Resolve after the filters ran, from the practice id the query was filtered on
    const perPractice = (table === 'patients' ? answers.patients : answers.visits) ?? {};
    const builder = query({}, log);
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const practiceId = log.find(([method, args]) => method === 'eq' && args[0] === 'practice_id')?.[1][1] as string;
      return Promise.resolve({ data: null, error: null, count: null, ...(perPractice[practiceId] ?? {}) }).then(resolve, reject);
    };
    return builder;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(calls)) delete calls[key];
});

describe('the practice list never carries secrets to the browser', () => {
  // practices rows hold bank details, a Gmail refresh token and an admin password column: the cards need none
  it('reads only the columns the cards show', () => {
    const columns = PRACTICE_OVERVIEW_COLUMNS.split(',').map((column) => column.trim());
    expect(columns).not.toContain('*');
    for (const secret of ['account_number', 'branch_code', 'gmail_refresh_token', 'gmail_settings', 'admin_password']) {
      expect(columns).not.toContain(secret);
    }
  });
});

describe('counting', () => {
  it('counts the rows of each practice and ignores rows without one', () => {
    expect(countByPractice([{ practice_id: 'a' }, { practice_id: 'a' }, { practice_id: 'b' }, { practice_id: null }, null])).toEqual({ a: 2, b: 1 });
    expect(countByPractice(undefined)).toEqual({});
  });

  // Visit dates are Windhoek dates: at 23:30 UTC on 31 October it is already 1 November in Windhoek
  it('takes "this month" in Windhoek, not in the browser or server time zone', () => {
    expect(windhoekMonthRange(new Date('2026-10-31T23:30:00Z'))).toEqual(['2026-11-01', '2026-12-01']);
    expect(windhoekMonthRange(new Date('2026-12-15T08:00:00Z'))).toEqual(['2026-12-01', '2027-01-01']);
  });
});

describe('loading the overview', () => {
  it('counts patients and this month\'s bookings only where staff work', async () => {
    database({
      practices: {
        data: [
          { id: 'clinic', name: 'Kalahari Family Practice', status: 'active', created_at: '2026-01-01' },
          { id: 'listing', name: 'Directory listing', status: 'lead', created_at: '2025-01-01' },
        ],
      },
      users: { data: [{ practice_id: 'clinic' }, { practice_id: 'clinic' }] },
      patients: { clinic: { count: 120 } },
      visits: { clinic: { count: 45 } },
    });

    const overview = await loadPracticeOverview(new Date('2026-10-08T10:00:00Z'));

    expect(calls.practices[0]).toContainEqual(['select', [PRACTICE_OVERVIEW_COLUMNS]]);
    expect(overview.find((p) => p.id === 'clinic')).toMatchObject({ total_users: 2, total_patients: 120, appointments_this_month: 45 });
    expect(overview.find((p) => p.id === 'listing')).toMatchObject({ total_users: 0, total_patients: 0, appointments_this_month: 0 });
    // One patient count and one booking count, both for the practice with staff, bookings within October only
    expect(calls.patients).toHaveLength(1);
    expect(calls.visits).toHaveLength(1);
    expect(calls.visits[0]).toContainEqual(['gte', ['visit_date', '2026-10-01']]);
    expect(calls.visits[0]).toContainEqual(['lt', ['visit_date', '2026-11-01']]);
    // A payment plan instalment or package sale hangs on a row that is not a booking: support must not see it as one
    expect(calls.visits[0]).toContainEqual(['or', [EXCLUDE_CARRIER_VISITS]]);
  });

  // A count that failed is unknown, not zero: "0 patients" would misstate a practice that is in use
  it('shows a failed count as unknown', async () => {
    database({
      practices: { data: [{ id: 'clinic', name: 'Kalahari Family Practice', created_at: '2026-01-01' }] },
      users: { data: [{ practice_id: 'clinic' }] },
      patients: { clinic: { error: { message: 'timeout' } } },
      visits: { clinic: { count: 3 } },
    });
    const [clinic] = await loadPracticeOverview(new Date('2026-10-08T10:00:00Z'));
    expect(clinic.total_patients).toBeNull();
    expect(clinic.appointments_this_month).toBe(3);
  });

  it('fails loudly when the practices cannot be read', async () => {
    database({ practices: { error: { message: 'permission denied for table practices' } }, users: { data: [] } });
    await expect(loadPracticeOverview()).rejects.toThrow('permission denied for table practices');
  });
});
