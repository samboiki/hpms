import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { computeDeliveryStatistics, type NotificationDelivery } from '../notificationDeliveryService';

// Every tracking row is created with all four channels set to false
const row = (overrides: Partial<NotificationDelivery> = {}): NotificationDelivery => ({
  id: 'd1',
  notification_id: 'n1',
  in_app_delivered: false,
  email_delivered: false,
  sms_delivered: false,
  push_delivered: false,
  created_at: '2026-10-06T08:00:00Z',
  updated_at: '2026-10-06T08:00:00Z',
  ...overrides,
});

describe('computeDeliveryStatistics', () => {
  it('counts a delivered SMS-only notification as a full success, not as three failed channels', () => {
    const stats = computeDeliveryStatistics([row({ sms_delivered: true, sms_delivered_at: '2026-10-06T08:00:05Z' })]);

    expect(stats.byStatus).toEqual({ successful: 1, partial: 0, failed: 0 });
    expect(stats.byChannel.sms).toEqual({ sent: 1, delivered: 1, failureRate: 0 });
    // Channels that were never used must not show as 100% failed
    expect(stats.byChannel.email.sent).toBe(0);
    expect(stats.byChannel.email.failureRate).toBe(0);
    expect(stats.byChannel.push.sent).toBe(0);
    expect(stats.byChannel.inApp.sent).toBe(0);
  });

  it('counts a failed SMS (with a failure reason) as failed', () => {
    const stats = computeDeliveryStatistics([row({ sms_failure_reason: 'Invalid number' })]);

    expect(stats.byStatus).toEqual({ successful: 0, partial: 0, failed: 1 });
    expect(stats.byChannel.sms).toEqual({ sent: 1, delivered: 0, failureRate: 100 });
  });

  it('counts a notification as partial when one channel worked and another failed', () => {
    const stats = computeDeliveryStatistics([row({ sms_delivered: true, email_failure_reason: 'Mailbox full' })]);

    expect(stats.byStatus).toEqual({ successful: 0, partial: 1, failed: 0 });
    expect(stats.byChannel.email.failureRate).toBe(100);
  });

  it('leaves notifications without any outcome yet out of success and failure', () => {
    const stats = computeDeliveryStatistics([row()]);

    expect(stats.total).toBe(1);
    expect(stats.byStatus).toEqual({ successful: 0, partial: 0, failed: 0 });
  });

  it('counts email opens and clicks on delivered emails', () => {
    const stats = computeDeliveryStatistics([
      row({ email_delivered: true, email_opened_at: '2026-10-06T09:00:00Z', email_clicked_at: '2026-10-06T09:01:00Z' }),
      row({ id: 'd2', email_delivered: true }),
    ]);

    expect(stats.byChannel.email).toEqual({ sent: 2, delivered: 2, opened: 1, clicked: 1, failureRate: 0 });
  });
});
