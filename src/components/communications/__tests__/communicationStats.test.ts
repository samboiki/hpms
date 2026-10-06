import { describe, it, expect } from 'vitest';
import {
  bundleUsage,
  messageTypeBreakdown,
  percentOf,
  summarizeEmail,
  summarizeSms
} from '../communicationStats';

// The Communications dashboard used to show invented figures ("142 SMS", "96% success rate",
// random daily charts, a 2000-SMS limit for practices without a bundle). These helpers are now
// the only source of its numbers, so they must reflect the practice's real logs and say
// "nothing yet" instead of inventing a rate.

describe('percentOf', () => {
  it('gives no rate when nothing was sent, so the screen says "none sent" rather than 0% or 100%', () => {
    expect(percentOf(0, 0)).toBeNull();
  });

  it('rounds to one decimal, like the other dashboard percentages', () => {
    expect(percentOf(2, 3)).toBe(66.7);
  });
});

describe('summarizeSms', () => {
  it('counts SMS accepted by the provider (sent or delivered) as successful and blocked SMS as failed', () => {
    const sms = summarizeSms({ total: 10, sent: 6, delivered: 2, failed: 1, blocked: 1, byType: {} });
    expect(sms.succeeded).toBe(8);
    expect(sms.failed).toBe(2);
    expect(sms.successRate).toBe(80);
  });

  it('shows zeros and no rate when the SMS log could not be read, never sample figures', () => {
    expect(summarizeSms(null)).toMatchObject({ total: 0, succeeded: 0, failed: 0, successRate: null, types: [] });
  });
});

describe('summarizeEmail', () => {
  it('measures opens against emails that actually went out, not against bounces or failures', () => {
    const email = summarizeEmail({
      total: 10, sent: 4, delivered: 2, opened: 1, clicked: 1, bounced: 1, failed: 1, spam: 0, byType: {}
    });
    expect(email.succeeded).toBe(8);
    expect(email.opened).toBe(2); // a clicked email was opened too
    expect(email.openRate).toBe(25);
    expect(email.failed).toBe(2);
  });

  it('has no open rate when no email went out', () => {
    const email = summarizeEmail({
      total: 2, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 1, failed: 1, spam: 0, byType: {}
    });
    expect(email.openRate).toBeNull();
  });
});

describe('messageTypeBreakdown', () => {
  it('lists the real message types, most used first, in plain words for clinic staff', () => {
    expect(messageTypeBreakdown({ invoice: 2, appointment_reminder: 5, null: 1, lab_results: 0 })).toEqual([
      { type: 'appointment_reminder', label: 'Appointment reminder', count: 5 },
      { type: 'invoice', label: 'Invoice', count: 2 },
      { type: 'null', label: 'Other', count: 1 }
    ]);
  });
});

describe('bundleUsage', () => {
  it('reports "no bundle" instead of inventing a limit when the practice has no active bundle', () => {
    expect(bundleUsage(undefined)).toEqual({ used: 0, limit: 0, hasBundle: false, percentUsed: 0 });
  });

  it('keeps the usage bar at 100% when a bundle is overused', () => {
    expect(bundleUsage({ monthly_limit: 100, current_usage: 130 }).percentUsed).toBe(100);
  });
});
