/**
 * "How did you hear about us?" (owner's decision, 13 Oct 2026; parity R26). The answer is optional and feeds the
 * monthly marketing count, so a skipped question must save nothing (not a made-up answer), "Other" words must never
 * outlive a changed answer, and the app's list must be exactly the database's check list (a key the database refuses
 * would make every registration with it fail).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NO_REFERRAL_ANSWER,
  REFERRAL_OTHER_MAX_LENGTH,
  REFERRAL_SOURCES,
  describeReferralAnswer,
  referralAnswerFrom,
  referralColumns
} from '../referralSource';

describe('saving the answer', () => {
  it('saves nothing when reception skipped the question, so the report counts it as not answered', () => {
    expect(referralColumns(NO_REFERRAL_ANSWER)).toEqual({ referral_source: null, referral_source_other: null });
  });

  it('keeps the typed words only for Other, so a changed answer leaves no stale words behind', () => {
    expect(referralColumns({ source: 'friend_family', other: 'church notice board' }))
      .toEqual({ referral_source: 'friend_family', referral_source_other: null });
    expect(referralColumns({ source: 'other', other: '  church   notice board ' }))
      .toEqual({ referral_source: 'other', referral_source_other: 'church notice board' });
  });

  it('trims Other to the length the database accepts, so a long answer cannot make the save fail', () => {
    const saved = referralColumns({ source: 'other', other: 'x'.repeat(200) });
    expect(saved.referral_source_other).toHaveLength(REFERRAL_OTHER_MAX_LENGTH);
  });

  it('saves Other without words as plain Other (the database refuses empty words)', () => {
    expect(referralColumns({ source: 'other', other: '   ' })).toEqual({ referral_source: 'other', referral_source_other: null });
  });
});

describe('reading the answer back', () => {
  it('shows an unknown stored value as not answered instead of breaking the form', () => {
    expect(referralAnswerFrom({ referral_source: 'billboard', referral_source_other: 'x' })).toEqual(NO_REFERRAL_ANSWER);
    expect(referralAnswerFrom(null)).toEqual(NO_REFERRAL_ANSWER);
  });

  it('describes Other with its words for the patient list', () => {
    expect(describeReferralAnswer({ source: 'other', other: 'Church notice board' })).toBe('Other: Church notice board');
    expect(describeReferralAnswer({ source: 'walk_in', other: '' })).toBe('Walk-in or signage');
    expect(describeReferralAnswer(NO_REFERRAL_ANSWER)).toBeNull();
  });
});

describe('the list of answers', () => {
  it('offers the eight answers the owner chose, Other last', () => {
    expect(REFERRAL_SOURCES).toHaveLength(8);
    expect(REFERRAL_SOURCES[REFERRAL_SOURCES.length - 1]).toBe('other');
  });

  it('is exactly the database check list in the proposal, so no answer is refused on save', () => {
    const sql = readFileSync(resolve(__dirname, '../../../../proposals/2026-10-13-patient-photo-and-referral-source.sql'), 'utf8');
    const check = /referral_source IN \(([^)]*)\)/.exec(sql)?.[1] ?? '';
    const keys = [...check.matchAll(/'([a-z_]+)'/g)].map(match => match[1]);
    expect(keys).toEqual([...REFERRAL_SOURCES]);
  });
});
