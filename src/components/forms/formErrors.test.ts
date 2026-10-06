import { describe, expect, it } from 'vitest';
import { errorMessage } from './formErrors';

describe('errorMessage', () => {
  it('shows the database reason for Supabase errors, which are plain objects rather than Error instances', () => {
    const supabaseError = { message: 'column "firstName" of relation "patients" does not exist', code: 'PGRST204', details: null };
    expect(errorMessage(supabaseError)).toBe('column "firstName" of relation "patients" does not exist');
  });

  it('shows the message of errors the form throws itself', () => {
    expect(errorMessage(new Error('No practice is assigned to your account.'))).toBe('No practice is assigned to your account.');
  });

  it('falls back to a plain instruction instead of "[object Object]" when there is no readable reason', () => {
    expect(errorMessage({ code: '500' })).toBe('Please try again.');
    expect(errorMessage({ message: '   ' })).toBe('Please try again.');
    expect(errorMessage(undefined, 'Reload the page.')).toBe('Reload the page.');
  });
});
