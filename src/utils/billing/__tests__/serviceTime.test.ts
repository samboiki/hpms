/**
 * How long a service took, read from the line's note, for codes a practice charges by time. The minutes go to the fund
 * on the claim (field 18), so a note must never be read as a time it does not say, and a slip of the keyboard (a day or
 * more) must never be sent as minutes.
 */
import { describe, expect, it } from 'vitest';
import { MAX_SERVICE_MINUTES, minutesFromNote } from '../serviceTime';
import { mentionsTime } from '../codeRules';

describe('the minutes a note gives', () => {
  it.each([
    ['45 minutes', 45],
    ['30 min', 30],
    ['1 hour', 60],
    ['1.5 h', 90],
    ['1,5 hours', 90],
    ['2hrs', 120],
    ['1 hour 30 minutes', 90],
    ['Smile Lab slip 1234, 45 minutes', 45],
    ['0.33 h', 20]
  ])('reads "%s" as %i minutes', (note, minutes) => expect(minutesFromNote(note)).toBe(minutes));

  // A slip number, a lab name or an empty note is not a time: the visit keeps asking, the claim sends the quantity
  it.each(['slip 45', 'Smile Lab', '', '0 minutes', '1h30', null, undefined])('reads no time in %j', note => expect(minutesFromNote(note)).toBeNull());

  it('never reads a day or more as minutes', () => {
    expect(minutesFromNote('24 hours')).toBe(MAX_SERVICE_MINUTES);
    expect(minutesFromNote('25 hours')).toBeNull();
  });

  // The visit's reminder ("note how long it took") goes away exactly when the claim can send the minutes
  it('agrees with the reminder on the visit', () => {
    for (const note of ['45 minutes', '1 hour 30 minutes', 'slip 45', '0 minutes', '25 hours', '']) {
      expect(mentionsTime(note)).toBe(minutesFromNote(note) !== null);
    }
  });
});
