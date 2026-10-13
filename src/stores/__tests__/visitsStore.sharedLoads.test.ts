import { describe, it, expect, vi, beforeEach } from 'vitest';

// Counts the visit loads that reach the database
const db = vi.hoisted(() => ({ visitLoads: 0 }));

vi.mock('../../lib/supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'or', 'order', 'limit', 'gte', 'lte', 'neq']) builder[method] = () => builder;
  builder.then = (resolve: (v: unknown) => unknown) => {
    db.visitLoads += 1;
    return Promise.resolve({ data: [], error: null }).then(resolve);
  };
  return { supabase: { from: () => builder, channel: () => ({ on: () => ({ subscribe: () => ({}) }) }) } };
});

import { useVisitsStore } from '../visitsStore';

const DAY = { date: '2026-10-13', practiceId: '7d1f0b2c-0000-4000-8000-000000000001' };

describe('visitsStore.fetchVisits shares a load asked for twice at once', () => {
  beforeEach(() => {
    db.visitLoads = 0;
  });

  it('reads the day once when the diary and the visit tracker ask for it together as the Dashboard opens', async () => {
    const { fetchVisits } = useVisitsStore.getState();
    await Promise.all([fetchVisits({ ...DAY }), fetchVisits({ ...DAY })]);
    expect(db.visitLoads).toBe(1);
  });

  it('reads afresh when asked again after the first load finished (a refresh after a save is never stale)', async () => {
    const { fetchVisits } = useVisitsStore.getState();
    await fetchVisits({ ...DAY });
    await fetchVisits({ ...DAY });
    expect(db.visitLoads).toBe(2);
  });

  it('never shares a load between different days', async () => {
    const { fetchVisits } = useVisitsStore.getState();
    await Promise.all([fetchVisits({ ...DAY }), fetchVisits({ ...DAY, date: '2026-10-14' })]);
    expect(db.visitLoads).toBe(2);
  });
});
