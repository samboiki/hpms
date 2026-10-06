import { describe, it, expect } from 'vitest';
import { fillPlaceholders, findPlaceholders, formatMessageDate, getSmsLength } from '../messageText';

// These helpers decide what a patient actually receives from the SMS and email modals.
describe('fillPlaceholders', () => {
  it('fills in the real patient and practice details', () => {
    expect(
      fillPlaceholders('Hi {{patientName}}, call {{practicePhone}}.', {
        patientName: 'Maria Shikongo',
        practicePhone: '061 123 456'
      })
    ).toBe('Hi Maria Shikongo, call 061 123 456.');
  });

  it('leaves a variable in place when its value is unknown, so the sender must fill it in instead of the patient getting "call us at ."', () => {
    expect(fillPlaceholders('Call us at {{practicePhone}}.', { practicePhone: '' })).toBe(
      'Call us at {{practicePhone}}.'
    );
    expect(fillPlaceholders('Your appointment is on {{date}}.', {})).toBe('Your appointment is on {{date}}.');
  });

  it('never treats built-in object names as values', () => {
    expect(fillPlaceholders('{{constructor}}', {})).toBe('{{constructor}}');
  });
});

describe('findPlaceholders', () => {
  it('lists every unfilled variable once so the sender is told exactly what to replace', () => {
    expect(findPlaceholders('{{date}} at {{time}} on {{date}}')).toEqual(['{{date}}', '{{time}}']);
  });

  it('skips variables that are filled in later for each recipient of a bulk send', () => {
    expect(findPlaceholders('Hi {{patientName}}, see you on {{date}}', ['patientName'])).toEqual(['{{date}}']);
  });

  it('finds nothing in a finished message, so it can be sent', () => {
    expect(findPlaceholders('Hi Maria, see you on 6 October 2026')).toEqual([]);
  });
});

describe('formatMessageDate', () => {
  it('writes the date day-month-year, so 6 October is never read as 10 June', () => {
    expect(formatMessageDate(new Date(2026, 9, 6))).toBe('6 October 2026');
  });
});

describe('getSmsLength', () => {
  it('charges a plain 160-character message as one SMS', () => {
    expect(getSmsLength('a'.repeat(160))).toEqual({ used: 160, parts: 1, capacity: 160 });
  });

  it('charges longer messages in parts of 153, because each part loses room to the joining header', () => {
    expect(getSmsLength('a'.repeat(161)).parts).toBe(2);
    expect(getSmsLength('a'.repeat(306)).parts).toBe(2);
    // 307 characters used to be shown as 2 SMS (307 / 160) but is charged as 3
    expect(getSmsLength('a'.repeat(307)).parts).toBe(3);
  });

  it('counts a message with an emoji as unicode, which fits only 70 places per SMS', () => {
    const birthday = `Happy Birthday Maria! 🎉 ${'a'.repeat(60)}`;
    expect(birthday.length).toBeGreaterThan(70);
    expect(getSmsLength(birthday).parts).toBe(2);
  });

  it('counts characters such as € and [ twice, since the network sends them with an escape', () => {
    expect(getSmsLength('€5').used).toBe(3);
    expect(getSmsLength(`${'a'.repeat(159)}€`).parts).toBe(2);
  });

  it('keeps accented letters of the SMS alphabet at one place each', () => {
    expect(getSmsLength('é'.repeat(160)).parts).toBe(1);
  });

  it('shows zero parts for an empty message so staff are not told it costs an SMS', () => {
    expect(getSmsLength('')).toEqual({ used: 0, parts: 0, capacity: 160 });
  });
});
