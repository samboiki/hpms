import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorMessage } from './formErrors';

// Owner decision 13 Oct 2026: plain words everywhere. The forms used to show the database's own wording on purpose;
// staff cannot act on 'column "firstName" of relation "patients" does not exist', so it now goes to the console.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorMessage', () => {
  it("never shows the database's wording for Supabase errors (plain objects, not Error instances)", () => {
    const supabaseError = { message: 'column "firstName" of relation "patients" does not exist', code: 'PGRST204', details: null };
    expect(errorMessage(supabaseError)).toBe('this part of OneHealth is not set up yet. Please contact support.');
  });

  it('turns a refusal by the access rules into words staff can act on', () => {
    const refused = { message: 'new row violates row-level security policy for table "vitals"', code: '42501', details: null };
    expect(errorMessage(refused)).toBe('your account is not permitted to make this change.');
  });

  it('keeps the plain instruction for a technical error with no plain reason, and logs it for support', () => {
    const error = { message: 'cache lookup failed for type 99', code: 'XX000', details: null };
    expect(errorMessage(error)).toBe('Please try again.');
    expect(console.warn).toHaveBeenCalled();
  });

  it('shows the message of errors the form throws itself (already plain words)', () => {
    expect(errorMessage(new Error('No practice is assigned to your account.'))).toBe('No practice is assigned to your account.');
  });

  it('falls back to a plain instruction instead of "[object Object]" when there is no readable reason', () => {
    expect(errorMessage({ code: '500' })).toBe('Please try again.');
    expect(errorMessage({ message: '   ' })).toBe('Please try again.');
    expect(errorMessage(undefined, 'Reload the page.')).toBe('Reload the page.');
  });
});
