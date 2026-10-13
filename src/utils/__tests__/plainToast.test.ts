/**
 * Owner decision 13 Oct 2026: plain words everywhere. Many screens pass a database error's own text to toast.error; the
 * staff app's toast layer installs this once so none of it reaches the screen.
 */
import { describe, expect, it, vi } from 'vitest';
import type toast from 'react-hot-toast';
import { installPlainToasts } from '../plainToast';

type ErrorToast = typeof toast.error;

describe('installPlainToasts', () => {
  it('shows the plain version of an error toast that carries database wording', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const shown = vi.fn();
    const target = { error: shown as unknown as ErrorToast };
    installPlainToasts(target);
    target.error('Could not save the quote: new row violates row-level security policy for table "quotes"' as never);
    expect(shown).toHaveBeenCalledWith('Could not save the quote: your account is not permitted to make this change', undefined);
  });

  it('leaves plain messages and toasts built from components exactly as written', () => {
    const shown = vi.fn();
    const target = { error: shown as unknown as ErrorToast };
    installPlainToasts(target);
    target.error('Enter the date of the expense.' as never, { id: 'x' } as never);
    expect(shown).toHaveBeenCalledWith('Enter the date of the expense.', { id: 'x' });
    const element = { type: 'div' };
    target.error(element as never);
    expect(shown).toHaveBeenLastCalledWith(element, undefined);
  });
});
