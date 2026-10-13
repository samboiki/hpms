import { describe, it, expect } from 'vitest';
import {
  NOT_RUNNING_NOTICE,
  SCHEDULER_NOT_RUNNING_NOTICE,
  automationStatsLine,
  automationStatusFromRpc,
  processorHealth,
  scheduleState,
  type AutomationStatus
} from '../processorHealth';

const NOW = new Date('2026-10-08T10:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const status = (overrides: Partial<AutomationStatus> = {}): AutomationStatus => ({
  ...automationStatusFromRpc({}),
  ...overrides
});

describe('the screen never pretends the sender runs', () => {
  // Nothing in the database runs on a schedule (no pg_cron): only the scheduler calling the sender sends anything.
  // A practice that switched an automation on must be told when that is not happening
  it('says the scheduler must be started when the sender has never run', () => {
    const health = processorHealth({ setUp: true, status: status(), anyOn: true, now: NOW });
    expect(health).toMatchObject({ state: 'not_running', notice: NOT_RUNNING_NOTICE });
    expect(NOT_RUNNING_NOTICE).toBe('Automations are switched on but not running yet: OneHealth support must start the scheduler');
  });

  it('says so when the sender has not run for more than a day', () => {
    expect(processorHealth({ setUp: true, status: status({ processorLastRunAt: hoursAgo(25) }), anyOn: true, now: NOW }).state).toBe('not_running');
    expect(processorHealth({ setUp: true, status: status({ processorLastRunAt: hoursAgo(0.2) }), anyOn: true, now: NOW }).state).toBe('running');
  });

  // A quiet practice (no new patients today) is not a broken scheduler: the run itself is the proof, not the
  // practice's last message
  it('does not raise the alarm for a quiet practice while the sender keeps running', () => {
    const health = processorHealth({
      setUp: true,
      status: status({ processorLastRunAt: hoursAgo(0.1), lastProcessedAt: hoursAgo(24 * 9) }),
      anyOn: true,
      now: NOW
    });
    expect(health.state).toBe('running');
  });

  it('warns when this practice\'s messages have waited more than a day although the sender runs', () => {
    const health = processorHealth({
      setUp: true,
      status: status({ processorLastRunAt: hoursAgo(0.1), waitingDue: 3, oldestWaitingSince: hoursAgo(30) }),
      anyOn: true,
      now: NOW
    });
    expect(health.state).toBe('waiting');
  });

  it('has nothing to warn about while nothing is switched on', () => {
    expect(processorHealth({ setUp: true, status: status(), anyOn: false, now: NOW }).state).toBe('idle');
  });

  // Before the database update, switching on would only save a row: the screen says it is not set up instead
  it('says the automations are not set up before the database update', () => {
    expect(processorHealth({ setUp: false, status: null, anyOn: true, now: NOW }).state).toBe('not_set_up');
  });
});

describe('what the sender did, per automation', () => {
  it('reads the counts the database returns and treats anything missing as nothing yet', () => {
    const parsed = automationStatusFromRpc({
      processor_last_run_at: '2026-10-08T09:55:00Z',
      waiting_due: '2',
      automations: {
        'welcome-new-patient': { sent_30d: 12, not_sent_30d: 2, last_sent_at: '2026-10-07T12:05:00Z', not_sent_reasons: [{ reason: 'Not sent: no cell number', count: 2 }] }
      }
    });
    expect(parsed.waitingDue).toBe(2);
    expect(parsed.automations['welcome-new-patient'].sent30d).toBe(12);
    expect(parsed.automations['appointment-confirmation']).toEqual({ sent30d: 0, notSent30d: 0, lastSentAt: null, notSentReasons: [] });
  });

  // Real counts only (the old cards showed invented ones), with the main reason a message did not go
  it('says how many went, how many did not and why, day-first', () => {
    const line = automationStatsLine({ sent30d: 12, notSent30d: 2, lastSentAt: '2026-10-07T12:05:00', notSentReasons: [{ reason: 'Not sent: no cell number', count: 2 }] });
    expect(line).toBe('12 messages sent in the last 30 days, 2 not sent (mostly: no cell number). Last sent 7 Oct 2026, 12:05.');
    expect(automationStatsLine({ sent30d: 0, notSent30d: 0, lastSentAt: null, notSentReasons: [] })).toBe('Nothing sent in the last 30 days.');
  });
});

describe('a switch that is on is not proof that anything runs', () => {
  // The diary reminders and the lists' automatic SMS have their own switches; only a recorded run shows that a
  // scheduler calls them. A practice relying on "on" would believe patients were reminded when nobody was.
  it('calls a switched-on job not running until a run is recorded, in the owner\'s words', () => {
    expect(scheduleState(true, null, NOW)).toBe('not_running');
    expect(SCHEDULER_NOT_RUNNING_NOTICE).toBe('On, but not running yet: OneHealth support must start the scheduler');
  });

  it('calls it running while it ran within the last day, and not running again after a silent day', () => {
    expect(scheduleState(true, hoursAgo(0.25), NOW)).toBe('running');
    expect(scheduleState(true, hoursAgo(23), NOW)).toBe('running');
    expect(scheduleState(true, hoursAgo(25), NOW)).toBe('not_running');
    expect(scheduleState(true, 'not a date', NOW)).toBe('not_running');
  });

  it('has nothing to say about a job that is switched off, however long ago it ran', () => {
    expect(scheduleState(false, null, NOW)).toBe('off');
    expect(scheduleState(false, hoursAgo(1), NOW)).toBe('off');
  });
});
