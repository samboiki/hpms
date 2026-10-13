import { describe, it, expect } from 'vitest';
import {
  DEFAULT_AUTOMATION,
  isQuietTime,
  isScheduledRunDue,
  parseAutomation,
  periodKeyFor,
  validateAutomation,
  type ListAutomationSettings
} from '../listAutomation';

const at = (hhmm: string, dateKey = '2026-10-07') => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return { dateKey, minutes: hours * 60 + minutes };
};

const daily: ListAutomationSettings = {
  ...DEFAULT_AUTOMATION,
  template: 'Hi {{first_name}}',
  schedule: 'daily',
  sendTime: '09:00'
};

describe('isQuietTime', () => {
  it('keeps patients from getting messages in the evening and at night (19:00 to 08:00)', () => {
    expect(isQuietTime(at('20:00').minutes, '19:00', '08:00')).toBe(true);
    expect(isQuietTime(at('02:00').minutes, '19:00', '08:00')).toBe(true);
    expect(isQuietTime(at('07:59').minutes, '19:00', '08:00')).toBe(true);
  });

  it('allows sending from the end of quiet hours until they start', () => {
    expect(isQuietTime(at('08:00').minutes, '19:00', '08:00')).toBe(false);
    expect(isQuietTime(at('18:59').minutes, '19:00', '08:00')).toBe(false);
  });

  it('supports a quiet window inside one day (e.g. a lunch break) and treats equal times as "off"', () => {
    expect(isQuietTime(at('12:30').minutes, '12:00', '13:00')).toBe(true);
    expect(isQuietTime(at('13:00').minutes, '12:00', '13:00')).toBe(false);
    expect(isQuietTime(at('03:00').minutes, '00:00', '00:00')).toBe(false);
  });
});

describe('isScheduledRunDue', () => {
  it('sends a daily list once its time has passed, and not before', () => {
    expect(isScheduledRunDue(daily, true, null, at('08:59'))).toBe(false);
    expect(isScheduledRunDue(daily, true, null, at('09:00'))).toBe(true);
    expect(isScheduledRunDue(daily, true, null, at('15:00'))).toBe(true);
  });

  it('runs a list only once a day', () => {
    expect(isScheduledRunDue(daily, true, '2026-10-07', at('09:15'))).toBe(false);
    expect(isScheduledRunDue(daily, true, '2026-10-06', at('09:15'))).toBe(true);
  });

  it('never sends automatically while automatic sending is off or the list is "Send now" only', () => {
    expect(isScheduledRunDue(daily, false, null, at('10:00'))).toBe(false);
    expect(isScheduledRunDue({ ...daily, schedule: 'manual' }, true, null, at('10:00'))).toBe(false);
  });

  it('holds a run that was missed during the day once quiet hours start', () => {
    expect(isScheduledRunDue(daily, true, '2026-10-06', at('19:30'))).toBe(false);
  });
});

describe('validateAutomation', () => {
  it('refuses a send time inside quiet hours and says which hours those are', () => {
    const result = validateAutomation({ ...daily, sendTime: '20:00' }, true);
    expect(result).toEqual({
      ok: false,
      error: '20:00 is inside your quiet hours (19:00 to 08:00). Choose a later or earlier time.'
    });
  });

  it('will not switch on automatic sending without a message to send', () => {
    expect(validateAutomation({ ...daily, template: '   ' }, true).ok).toBe(false);
    expect(validateAutomation({ ...daily, template: '' }, false).ok).toBe(true);
  });

  it('keeps messages to at most 4 SMS so a list send does not use a bundle up by surprise', () => {
    expect(validateAutomation({ ...daily, template: 'a'.repeat(613) }, false).ok).toBe(false);
  });

  it('needs a daily or birthday time before sending can be automatic', () => {
    expect(validateAutomation({ ...daily, schedule: 'manual' }, true).ok).toBe(false);
  });

  it('rejects times that are not real clock times', () => {
    expect(validateAutomation({ ...daily, sendTime: '9am' }, false).ok).toBe(false);
    expect(validateAutomation({ ...daily, quietEnd: '24:00' }, false).ok).toBe(false);
  });
});

describe('parseAutomation', () => {
  it('falls back to safe defaults for settings that were never saved or are damaged', () => {
    expect(parseAutomation(null)).toEqual(DEFAULT_AUTOMATION);
    expect(parseAutomation({ schedule: 'hourly', sendTime: '25:00', repeat: 'year', template: 'Hi' })).toEqual({
      ...DEFAULT_AUTOMATION,
      repeat: 'year',
      template: 'Hi'
    });
  });
});

describe('periodKeyFor', () => {
  it('uses the year for birthdays, so a patient greeted this year is not greeted again until next year', () => {
    expect(periodKeyFor('year', '2026-10-07')).toBe('2026');
    expect(periodKeyFor('year', '2027-10-07')).toBe('2027');
  });

  it('has one key per day, week and month, and a single key for "only once"', () => {
    expect(periodKeyFor('day', '2026-10-07')).toBe('2026-10-07');
    expect(periodKeyFor('week', '2026-10-07')).toBe('2026-W41');
    expect(periodKeyFor('month', '2026-10-07')).toBe('2026-10');
    expect(periodKeyFor('ever', '2026-10-07')).toBe('once');
    expect(periodKeyFor('ever', '2030-01-01')).toBe('once');
  });
});
