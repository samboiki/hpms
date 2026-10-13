import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { fromMock, invokeMock, navigate } = vi.hoisted(() => ({ fromMock: vi.fn(), invokeMock: vi.fn(), navigate: vi.fn() }));

// No database, edge function or router in unit tests
vi.mock('../../../lib/supabase', () => ({ supabase: { from: fromMock, functions: { invoke: invokeMock } } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import UniversalCallback from '../UniversalCallback';

const returnTo = (search: string) => window.history.replaceState({}, '', `/api/oauth/callback${search}`);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('finishing a Gmail sign-in on the callback page', () => {
  // The page used to read practice_oauth_apps.client_secret and exchange the code itself, so every administrator's
  // browser held the practice's Google secret and the account's tokens. Now the server does the exchange.
  it('hands the code and the signed state to the server and reads no table', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, email: 'reception@example.test' }, error: null });
    returnTo('?code=4%2Fone-time&state=signed.state&scope=gmail.send');
    render(<UniversalCallback />);
    expect(await screen.findByText('Gmail connected successfully for reception@example.test!')).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith('exchange-oauth-code', {
      body: { action: 'exchange', provider: 'google', code: '4/one-time', state: 'signed.state' },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("shows the server's reason when it refuses the sign-in", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('non-2xx'), {
        context: new Response(JSON.stringify({ success: false, error: 'This Google sign-in was started by someone else. Please connect Gmail yourself.' }), { status: 403 }),
      }),
    });
    returnTo('?code=4%2Fanother&state=signed.state');
    render(<UniversalCallback />);
    expect(await screen.findByText('This Google sign-in was started by someone else. Please connect Gmail yourself.')).toBeInTheDocument();
  });

  // Cancelling at Google sends no code: nothing reaches the server
  it('says the sign-in was cancelled without calling the server', async () => {
    returnTo('?error=access_denied&state=signed.state');
    render(<UniversalCallback />);
    expect(await screen.findByText('Google sign-in was cancelled, so Gmail was not connected.')).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
