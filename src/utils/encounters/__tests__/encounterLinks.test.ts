import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENCOUNTERS_PLACE,
  diaryDayLink,
  encountersPath,
  readEncountersPlace,
  readVisitFocus,
  safeEncountersReturn
} from '../encounterLinks';

describe("Encounters' address", () => {
  it('keeps the tab, the view and the period, so the way back from a figure lands on the same figures', () => {
    const place = { tab: 'analytics', view: 'diagnoses', period: '3m' } as const;
    const path = encountersPath(place);
    expect(path).toBe('/encounters?tab=analytics&view=diagnoses&period=3m');
    expect(readEncountersPlace(new URLSearchParams(path.split('?')[1]))).toEqual(place);
  });

  it('opens the encounters list by default (the sidebar link) and ignores anything it does not know', () => {
    expect(readEncountersPlace(new URLSearchParams())).toEqual(DEFAULT_ENCOUNTERS_PLACE);
    expect(readEncountersPlace(new URLSearchParams('tab=geographic&view=insights&period=1y'))).toEqual(DEFAULT_ENCOUNTERS_PLACE);
  });
});

describe('the diary day, with the way back', () => {
  it('opens the day and carries the way back to the figures', () => {
    const back = encountersPath({ tab: 'analytics', view: 'visits', period: '7d' });
    const link = diaryDayLink('2026-10-07', back);
    const params = new URLSearchParams(link.split('?')[1]);
    expect(link.startsWith('/?')).toBe(true);
    expect(params.get('diaryDate')).toBe('2026-10-07');
    expect(safeEncountersReturn(params.get('returnTo'))).toBe(back);
  });

  // The figure counts every practitioner's bookings; a doctor's diary would open on their own column only
  it("opens the day on every practitioner's column, as the figure counted them all", () => {
    const params = new URLSearchParams(diaryDayLink('2026-10-07', '/encounters').split('?')[1]);
    expect(params.get('diaryPractitioner')).toBe('all');
    expect(params.get('diaryShow')).toBeNull();
  });

  it('only ever leads back into Encounters, so a crafted link cannot send staff to another page or site', () => {
    expect(safeEncountersReturn('/encounters')).toBe('/encounters');
    for (const value of ['/patients?patientId=1', 'https://example.invalid/encounters', '//example.invalid', '/encounters/../settings', '/encounters?tab=a b', '', null]) {
      expect(safeEncountersReturn(value)).toBeNull();
    }
  });
});

describe('the visits a figure opened', () => {
  it('travels with the history entry and is read back only when it has the right shape', () => {
    const focus = { label: 'No-shows, 13 Sep-12 Oct 2026', visitIds: ['v1', 'v2'] };
    expect(readVisitFocus({ visitFocus: focus })).toEqual(focus);
    expect(readVisitFocus(null)).toBeNull();
    expect(readVisitFocus({ visitFocus: { label: 'Seen', visitIds: [1, 2] } })).toBeNull();
    expect(readVisitFocus({ visitFocus: { visitIds: ['v1'] } })).toBeNull();
  });
});
