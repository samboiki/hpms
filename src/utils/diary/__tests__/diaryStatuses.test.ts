import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DIARY_STATUS_COLOURS,
  DIARY_STATUS_COLOUR_STYLES,
  DIARY_STATUSES_MAX,
  countByDiaryStatus,
  diaryStatusChoices,
  normalizeDiaryStatusRow,
  shownDiaryStatus,
  sortDiaryStatuses,
  validateDiaryStatus,
  type DiaryStatus
} from '../diaryStatuses';
import { STAGE_LABELS, VISIT_STAGES } from '../../visitStage';

// An invented practice's own statuses
const status = (id: string, name: string, stage: DiaryStatus['stage'], extra: Partial<DiaryStatus> = {}): DiaryStatus => ({
  id,
  name,
  colour: 'blue',
  stage,
  isActive: true,
  ...extra
});
const XRAY = status('s-xray', 'Waiting for X-ray', 'checked-in', { colour: 'amber' });
const NO_ANSWER = status('s-call', 'Called, no answer', 'scheduled', { colour: 'red' });
const CONFIRMED = status('s-conf', 'Confirmed by phone', 'scheduled', { colour: 'green' });
const OLD = status('s-old', 'Old label', 'scheduled', { isActive: false });
const STATUSES = [XRAY, NO_ANSWER, CONFIRMED, OLD];

const booked = { status: 'scheduled' };
const checkedIn = { status: 'scheduled', is_checked_in: true };
const completed = { status: 'completed', is_checked_in: true };

describe('shownDiaryStatus (the label on a diary card)', () => {
  it("shows the practice's own words while the booking is at the status's stage", () => {
    expect(shownDiaryStatus(STATUSES, { ...checkedIn, diary_status_id: 's-xray' })).toBe(XRAY);
  });

  // A "Waiting for X-ray" label left on a finished visit would tell reception the patient is still waiting
  it('hides a status once the booking has moved on to another stage', () => {
    expect(shownDiaryStatus(STATUSES, { ...completed, diary_status_id: 's-xray' })).toBeNull();
    expect(shownDiaryStatus(STATUSES, { ...checkedIn, diary_status_id: 's-call' })).toBeNull();
  });

  it('keeps showing a removed status on the bookings that already have it, so their history does not change', () => {
    expect(shownDiaryStatus(STATUSES, { ...booked, diary_status_id: 's-old' })).toBe(OLD);
  });

  it("shows nothing for a booking without a status, or with one the practice doesn't have", () => {
    expect(shownDiaryStatus(STATUSES, booked)).toBeNull();
    expect(shownDiaryStatus(STATUSES, { ...booked, diary_status_id: 'someone-elses' })).toBeNull();
  });
});

describe('diaryStatusChoices (what visit actions offer)', () => {
  it("offers only the statuses of the booking's current stage, so no choice contradicts where the patient is", () => {
    expect(diaryStatusChoices(STATUSES, booked).map((item) => item.name)).toEqual(['Called, no answer', 'Confirmed by phone']);
    expect(diaryStatusChoices(STATUSES, checkedIn)).toEqual([XRAY]);
    expect(diaryStatusChoices(STATUSES, completed)).toEqual([]);
  });

  it('never offers a removed status again', () => {
    expect(diaryStatusChoices(STATUSES, booked).some((item) => item.id === 's-old')).toBe(false);
  });
});

describe('validateDiaryStatus (Diary settings, before the database checks the same)', () => {
  it('accepts a trimmed name, a colour and a stage', () => {
    expect(validateDiaryStatus({ name: '  Waiting for results ', colour: 'teal', stage: 'checked-in' }, STATUSES)).toEqual({
      ok: true,
      value: { name: 'Waiting for results', colour: 'teal', stage: 'checked-in' }
    });
  });

  // Two statuses called the same would make the diary and the report ambiguous
  it('refuses a name already in use, whatever its capitals, but allows the name of a removed status', () => {
    const result = validateDiaryStatus({ name: 'called, NO answer', colour: 'red', stage: 'scheduled' }, STATUSES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('There is already a status called "called, NO answer".');
    expect(validateDiaryStatus({ name: 'Old label', colour: 'red', stage: 'scheduled' }, STATUSES).ok).toBe(true);
  });

  it('lets a status keep its own name when it is edited', () => {
    expect(validateDiaryStatus({ name: 'Called, no answer', colour: 'pink', stage: 'scheduled' }, STATUSES, 's-call').ok).toBe(true);
  });

  it('says what is missing in plain words', () => {
    const result = validateDiaryStatus({ name: ' ', colour: 'black', stage: 'ready' }, []);
    expect(result).toEqual({
      ok: false,
      errors: ['Name the status, for example "Waiting for X-ray".', 'Choose a colour.', 'Choose the step of the visit the status belongs to.']
    });
  });

  it('stops at the same number of statuses as the database (a list nobody can scan is no help at the desk)', () => {
    const many = Array.from({ length: DIARY_STATUSES_MAX }, (_, index) => status(`s${index}`, `Status ${index}`, 'scheduled'));
    expect(validateDiaryStatus({ name: 'One more', colour: 'blue', stage: 'scheduled' }, many).ok).toBe(false);
    expect(validateDiaryStatus({ name: 'Status 1', colour: 'red', stage: 'scheduled' }, many, 's1').ok).toBe(true);
  });
});

describe('normalizeDiaryStatusRow and sortDiaryStatuses', () => {
  it('reads a row and drops one with an unknown stage rather than guessing where it belongs', () => {
    expect(normalizeDiaryStatusRow({ id: 'a', name: ' Late ', colour: 'orange', stage: 'checked-in', is_active: true })).toEqual({
      id: 'a',
      name: 'Late',
      colour: 'orange',
      stage: 'checked-in',
      isActive: true
    });
    expect(normalizeDiaryStatusRow({ id: 'b', name: 'X', colour: 'blue', stage: 'ready' })).toBeNull();
  });

  it('lists statuses in the order of the visit, then by name', () => {
    expect(sortDiaryStatuses([XRAY, NO_ANSWER, CONFIRMED]).map((item) => item.id)).toEqual(['s-call', 's-conf', 's-xray']);
  });
});

describe('countByDiaryStatus (the diary report)', () => {
  it("counts each booking under the last status it was given, and lists the practice's statuses even at 0", () => {
    const counts = countByDiaryStatus(
      [
        { id: 'v1', statusId: 's-call' },
        { id: 'v2', statusId: 's-call' },
        { id: 'v3', statusId: 's-xray' },
        { id: 'v4', statusId: null },
        { id: 'v5', statusId: 'unknown' }
      ],
      STATUSES
    );
    expect(counts.map((count) => [count.status.name, count.bookingIds])).toEqual([
      ['Called, no answer', ['v1', 'v2']],
      ['Confirmed by phone', []],
      ['Waiting for X-ray', ['v3']]
    ]);
  });

  it('includes a removed status only when bookings of the period have it', () => {
    const counts = countByDiaryStatus([{ id: 'v9', statusId: 's-old' }], STATUSES);
    expect(counts.find((count) => count.status.id === 's-old')?.bookingIds).toEqual(['v9']);
  });
});

describe('the lists the database checks too', () => {
  const sql = readFileSync('proposals/2026-10-12-diary-statuses-and-types.sql', 'utf8');
  const quoted = (items: readonly string[]) => items.map((item) => `'${item}'`).join(', ');

  // The database refuses anything else: a colour or stage only the app knew would fail to save
  it('are the same colours and stages as the SQL proposal', () => {
    expect(sql).toContain(`colour IN (${quoted(DIARY_STATUS_COLOURS)})`);
    expect(sql).toContain(`stage IN (${quoted(VISIT_STAGES)})`);
  });

  it('give every colour a style and every stage a label', () => {
    expect(DIARY_STATUS_COLOURS.every((colour) => DIARY_STATUS_COLOUR_STYLES[colour].chip.length > 0)).toBe(true);
    expect(Object.keys(STAGE_LABELS).sort()).toEqual([...VISIT_STAGES].sort());
  });
});
