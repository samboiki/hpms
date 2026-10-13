import { describe, it, expect, vi, beforeEach } from 'vitest';

// Each table answers .single() with the row (or "no rows") the test sets
const db = vi.hoisted(() => ({
  rows: {} as Record<string, unknown>,
  fail: false,
  errors: {} as Record<string, { code: string; message: string }>,
}));

vi.mock('../../lib/supabase', () => {
  const makeBuilder = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq']) builder[method] = () => builder;
    builder.single = () => {
      if (db.fail) return Promise.reject(new Error('Network request failed'));
      if (db.errors[table]) return Promise.resolve({ data: null, error: db.errors[table] });
      const row = db.rows[table];
      return Promise.resolve(row ? { data: row, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } });
    };
    return builder;
  };
  return { supabase: { from: (table: string) => makeBuilder(table) } };
});

import { CommunicationStatsService } from '../communicationStatsService';

describe('CommunicationStatsService.getCommunicationStats', () => {
  beforeEach(() => {
    db.rows = {};
    db.fail = false;
    db.errors = {};
  });

  it('reports the real bundle: limit plus purchased top-ups, minus what was used', async () => {
    db.rows.practice_sms_subscriptions = { monthly_limit: 500, additional_sms_purchased: 100, current_usage: 150 };
    db.rows.practice_email_subscriptions = { monthly_limit: 200, additional_emails_purchased: 0, current_usage: 50 };

    const stats = await CommunicationStatsService.getCommunicationStats('practice-1');

    expect(stats.sms).toEqual({ current_usage: 150, monthly_limit: 600, available: 450, percentage_available: 75 });
    expect(stats.email).toEqual({ current_usage: 50, monthly_limit: 200, available: 150, percentage_available: 75 });
    expect(stats.overall_percentage_available).toBe(75);
  });

  it('shows nothing available for a practice without a bundle, instead of an invented 1000 SMS at 100%', async () => {
    const stats = await CommunicationStatsService.getCommunicationStats('practice-1');

    expect(stats.sms).toEqual({ current_usage: 0, monthly_limit: 0, available: 0, percentage_available: 0 });
    expect(stats.email).toEqual({ current_usage: 0, monthly_limit: 0, available: 0, percentage_available: 0 });
  });

  it('never shows a negative balance when usage went over the limit', async () => {
    db.rows.practice_sms_subscriptions = { monthly_limit: 100, additional_sms_purchased: 0, current_usage: 130 };

    const stats = await CommunicationStatsService.getCommunicationStats('practice-1');

    expect(stats.sms.available).toBe(0);
    expect(stats.sms.percentage_available).toBe(0);
  });

  it('fails loudly when the numbers cannot be loaded, instead of returning made-up usage', async () => {
    db.fail = true;
    await expect(CommunicationStatsService.getCommunicationStats('practice-1')).rejects.toThrow('Network request failed');
  });

  // A refused or failed read is not "no bundle": 0% would tell staff they cannot send anything
  it('fails when the database refuses the read, instead of showing 0% available', async () => {
    db.errors = { practice_email_subscriptions: { code: '42501', message: 'permission denied' } };
    await expect(CommunicationStatsService.getCommunicationStats('practice-1')).rejects.toMatchObject({ code: '42501' });
  });
});
