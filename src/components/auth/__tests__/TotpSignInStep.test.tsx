/**
 * Owner decision 13 Oct 2026: two-step sign-in must be real. After a right password, an account with an
 * authenticator app is only signed in once the app's code is accepted.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ verify: vi.fn() }));

vi.mock('../../../services/mfaService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/mfaService')>()),
  verifySignInCode: mocks.verify
}));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

import { TotpSignInStep } from '../TotpSignInStep';

beforeEach(() => mocks.verify.mockReset());

describe('the second step of a sign-in', () => {
  it('a wrong code does not sign in and says what to do', async () => {
    mocks.verify.mockResolvedValue({ ok: false, message: 'That code is not right or has run out.' });
    const onVerified = vi.fn();
    render(<TotpSignInStep onVerified={onVerified} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Code from your authenticator app'), { target: { value: '123 456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not right');
    expect(mocks.verify).toHaveBeenCalledWith('123456');
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('the right code finishes the sign-in', async () => {
    mocks.verify.mockResolvedValue({ ok: true });
    const onVerified = vi.fn().mockResolvedValue(undefined);
    render(<TotpSignInStep onVerified={onVerified} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Code from your authenticator app'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
  });

  it('"Use a different account" leaves the half-finished sign-in', () => {
    const onCancel = vi.fn().mockResolvedValue(undefined);
    render(<TotpSignInStep onVerified={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use a different account' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
