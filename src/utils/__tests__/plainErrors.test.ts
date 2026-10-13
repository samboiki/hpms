/**
 * Owner decision 13 Oct 2026: errors in plain words everywhere. Staff cannot act on the database's own wording, so it
 * never reaches the screen (support finds it in the console); the screen says what happened and what to do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { looksTechnical, plainErrorMessage, plainErrorReason, plainErrorText, plainWords } from '../plainErrors';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

// Shaped like supabase-js errors (code, details, hint), with invented table and column names
const dbError = (code: string, message: string) => ({ code, message, details: null, hint: null });

describe('plainErrorReason: database errors become plain words', () => {
  it('a refusal by the access rules says the account may not do it, not "violates row-level security policy"', () => {
    expect(plainErrorReason(dbError('42501', 'new row violates row-level security policy for table "widgets"')))
      .toBe('your account is not permitted to make this change.');
  });

  it('a missing table, column or function says that part is not set up yet (the app runs before its SQL is applied)', () => {
    for (const code of ['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205']) {
      expect(plainErrorReason(dbError(code, 'column "made_up" does not exist'))).toBe('this part of OneHealth is not set up yet. Please contact support.');
    }
  });

  it('a duplicate says the record already exists instead of naming the database key', () => {
    expect(plainErrorReason(dbError('23505', 'duplicate key value violates unique constraint "widgets_name_key"')))
      .toBe('a record with these details already exists.');
  });

  it('deleting something still in use says other records use it', () => {
    expect(plainErrorReason(dbError('23503', 'update or delete on table "widgets" violates foreign key constraint "x" on table "y"')))
      .toBe('other records still use it, so it cannot be removed.');
  });

  it('a missing required value, a value not allowed and a badly formatted value each say so', () => {
    expect(plainErrorReason(dbError('23502', 'null value in column "name" violates not-null constraint'))).toBe('a required detail is missing.');
    expect(plainErrorReason(dbError('23514', 'new row violates check constraint "amount_positive"'))).toBe('one of the values is not allowed.');
    expect(plainErrorReason(dbError('22P02', 'invalid input syntax for type uuid: "abc"'))).toBe('one of the values is not in the right format.');
  });

  it('a lost connection says to check the internet, not "TypeError: Failed to fetch"', () => {
    expect(plainErrorReason({ message: 'TypeError: Failed to fetch', details: 'x', hint: '', code: '' }))
      .toBe('there is no connection to OneHealth. Check the internet connection and try again.');
  });

  it('an expired sign-in asks the person to sign in again', () => {
    expect(plainErrorReason(dbError('PGRST301', 'JWT expired'))).toBe('your sign-in has expired. Please sign in again.');
  });

  it('an unknown technical error gives no reason, so the screen shows only what failed', () => {
    expect(plainErrorReason(dbError('XX000', 'internal error at line 4 in plpgsql function foo()'))).toBeNull();
  });
});

describe('plainErrorReason: messages written for staff pass through', () => {
  it("keeps the app's own messages (they are already plain words)", () => {
    expect(plainErrorReason(new Error('Enter the date of the expense.'))).toBe('Enter the date of the expense.');
  });

  it("keeps the refusals our own database functions raise in words (P0001, the practice's protected columns)", () => {
    expect(plainErrorReason(dbError('P0001', 'Only a practice administrator can change these settings.')))
      .toBe('Only a practice administrator can change these settings.');
    expect(plainErrorReason({ code: '42501', message: "Only a practice administrator can change the practice's name, type, numbers or bank details.", details: null, hint: 'practice_protected_columns' }))
      .toBe("Only a practice administrator can change the practice's name, type, numbers or bank details.");
  });

  it('still hides a P0001 that reads like technical text', () => {
    expect(plainErrorReason(dbError('P0001', 'relation "widgets" does not exist'))).toBe('this part of OneHealth is not set up yet. Please contact support.');
  });

  it('a supabase-js error object is never mistaken for an app message, even though it extends Error', () => {
    const error = Object.assign(new Error('column "made_up" of relation "widgets" does not exist'), { name: 'PostgrestError', code: '42703', details: null, hint: null });
    expect(plainErrorReason(error)).toBe('this part of OneHealth is not set up yet. Please contact support.');
  });

  it('nothing readable gives no reason', () => {
    expect(plainErrorReason(undefined)).toBeNull();
    expect(plainErrorReason({})).toBeNull();
    expect(plainErrorReason('   ')).toBeNull();
  });
});

describe('plainErrorMessage', () => {
  it('puts the plain reason after what failed', () => {
    expect(plainErrorMessage(dbError('42501', 'permission denied for table widgets'), 'Failed to save expense'))
      .toBe('Failed to save expense: your account is not permitted to make this change.');
  });

  it('shows only what failed when the reason is technical, and keeps the technical text for support in the console', () => {
    const error = dbError('XX000', 'cache lookup failed for type 12345');
    expect(plainErrorMessage(error, 'Failed to save expense')).toBe('Failed to save expense');
    expect(console.warn).toHaveBeenCalledWith('[OneHealth] Failed to save expense:', error);
  });

  it('shows a message written for staff on its own', () => {
    expect(plainErrorMessage(new Error('Select a branch first.'), 'Failed to save expense')).toBe('Select a branch first.');
  });
});

describe('looksTechnical', () => {
  it('spots database and programming wording, not ordinary sentences', () => {
    expect(looksTechnical('column "x" does not exist')).toBe(true);
    expect(looksTechnical("Cannot read properties of undefined (reading 'id')")).toBe(true);
    expect(looksTechnical('Enter the patient\'s date of birth.')).toBe(false);
  });
});

describe('plainWords: messages that carry the database wording inside them', () => {
  it("keeps the app's plain lead-in and replaces the database's part", () => {
    expect(plainWords('Could not load the remittances: relation "public.widgets" does not exist'))
      .toBe('Could not load the remittances: this part of OneHealth is not set up yet. Please contact support');
  });

  it('drops a technical aside in brackets and keeps the rest of the sentence', () => {
    expect(plainWords('Earlier answers could not be read (permission denied for table widgets), so the checks were skipped.'))
      .toBe('Earlier answers could not be read, so the checks were skipped.');
  });

  it('keeps plain sentences that follow the technical part', () => {
    expect(plainWords('Could not check batch 12: cache lookup failed for type 9. Nothing was changed.'))
      .toBe('Could not check batch 12: please try again. Nothing was changed.');
    expect(plainWords('TypeError: Failed to fetch; the amounts are not shown.'))
      .toBe('There is no connection to OneHealth. Check the internet connection and try again; the amounts are not shown.');
  });

  it('ends as the original did, so a message put inside a longer sentence gets no double full stop', () => {
    expect(plainWords('new row violates row-level security policy for table "widgets"')).toBe('Your account is not permitted to make this change');
    expect(plainWords('new row violates row-level security policy for table "widgets".')).toBe('Your account is not permitted to make this change.');
  });

  it('returns plain text unchanged and a plain instruction for nothing at all', () => {
    expect(plainWords('Enter the date of the expense.')).toBe('Enter the date of the expense.');
    expect(plainWords(undefined)).toBe('Something went wrong. Please try again.');
  });
});

describe('plainErrorText (screens that showed error.message)', () => {
  it("shows the app's own message, a plain sentence for a database error, and the fallback for nothing", () => {
    expect(plainErrorText(new Error('Choose a fund first.'), 'Could not save.')).toBe('Choose a fund first.');
    expect(plainErrorText({ code: '42501', message: 'permission denied for table widgets', details: null }, 'Could not save.'))
      .toBe('Your account is not permitted to make this change.');
    expect(plainErrorText(null, 'Could not save.')).toBe('Could not save.');
  });
});
