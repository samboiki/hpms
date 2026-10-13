import { describe, expect, it } from 'vitest';
import {
  EVERYONE_ON_THE_DAY,
  diaryDayParams,
  focusOnBooking,
  focusedDiaryView,
  readDiaryDayFocus,
  withoutDiaryDayLink
} from '../diaryDayFocus';

const COLUMNS = ['dr-1', 'dr-2', 'nurse-1'];

describe('a diary link that keeps its booking in view', () => {
  // A doctor's diary opens on their own column: a link to a colleague's booking opened a day that hid it
  it("carries the booking's practitioner and, for a cancelled booking, the cancelled ones", () => {
    const params = diaryDayParams('2026-10-08', focusOnBooking({ practitionerId: 'dr-2', cancelled: true }));
    expect(params.toString()).toBe('diaryDate=2026-10-08&diaryPractitioner=dr-2&diaryShow=cancelled');
    expect(readDiaryDayFocus(params)).toEqual({ practitionerId: 'dr-2', showCancelled: true });
  });

  it('asks for every practitioner for a booking without one, or a figure of everyone\'s bookings', () => {
    expect(readDiaryDayFocus(diaryDayParams('2026-10-08', focusOnBooking({ practitionerId: null, cancelled: false })))).toEqual(EVERYONE_ON_THE_DAY);
    expect(diaryDayParams('2026-10-08', EVERYONE_ON_THE_DAY).get('diaryPractitioner')).toBe('all');
  });

  it('leaves older links (the day only) as they were: the diary opens as it always does', () => {
    expect(diaryDayParams('2026-10-08').toString()).toBe('diaryDate=2026-10-08');
    expect(readDiaryDayFocus(new URLSearchParams('diaryDate=2026-10-08'))).toBeNull();
  });

  it('drops the day and the focus once read, so Back or a refresh does not jump there again', () => {
    const params = new URLSearchParams('tab=x&diaryDate=2026-10-08&diaryPractitioner=dr-2&diaryShow=cancelled');
    expect(withoutDiaryDayLink(params).toString()).toBe('tab=x');
  });
});

describe('whose columns the diary shows on arrival', () => {
  it("adds the booking's practitioner beside the doctor's own column, in column order", () => {
    expect(focusedDiaryView(['nurse-1'], { practitionerId: 'dr-2', showCancelled: false }, COLUMNS)).toEqual(['dr-2', 'nurse-1']);
  });

  it("keeps the user's own choice when it already shows the practitioner, or everyone", () => {
    const own = ['dr-1'];
    expect(focusedDiaryView(own, { practitionerId: 'dr-1', showCancelled: false }, COLUMNS)).toBe(own);
    expect(focusedDiaryView([], { practitionerId: 'dr-2', showCancelled: false }, COLUMNS)).toEqual([]);
  });

  it('shows every practitioner for a booking without one, which only the full diary shows', () => {
    expect(focusedDiaryView(['dr-1'], EVERYONE_ON_THE_DAY, COLUMNS)).toEqual([]);
  });
});
