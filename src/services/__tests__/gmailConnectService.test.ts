import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, invokeMock } = vi.hoisted(() => ({ fromMock: vi.fn(), invokeMock: vi.fn() }));

// No database or edge function in unit tests
vi.mock('../../lib/supabase', () => ({ supabase: { from: fromMock, functions: { invoke: invokeMock } } }));

import {
  GMAIL_CONNECTION_COLUMNS,
  completeGmailConnect,
  describeGoogleCallbackError,
  gmailConnectionFromRow,
  loadGmailConnection,
  loadGoogleClientId,
  readGmailCallback,
  saveGoogleOAuthApp,
  startGmailConnect,
} from '../gmailConnectService';

/** A PostgREST query stand-in: every filter returns itself and awaiting it gives the result. */
function query(result: { data?: unknown; error?: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle', 'insert', 'update', 'upsert']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject);
  return { builder, calls };
}

/** How supabase-js reports an edge function's non-2xx answer: the Response is in error.context */
const httpError = (status: number, body: unknown) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the browser reads no Gmail secret', () => {
  // Every staff member of the practice can read practice_oauth_credentials: with the tokens they could send email as
  // the practice from anywhere. After proposals/2026-10-08-oauth-secrets-columns.sql a select('*') would even fail.
  it('reads only the address, dates, permissions and profile of the connected account', () => {
    const columns = GMAIL_CONNECTION_COLUMNS.split(',').map((column) => column.trim());
    expect(columns).toEqual(['email', 'scopes', 'connected_at', 'last_used_at', 'metadata']);
    expect(columns).not.toContain('refresh_token');
    expect(columns).not.toContain('access_token');
  });

  it('loads the latest connection of the practice with those columns', async () => {
    const read = query({
      data: [{ email: 'reception@example.test', scopes: ['https://www.googleapis.com/auth/gmail.send'], connected_at: '2026-10-08T09:00:00Z', last_used_at: null, metadata: { name: 'Front Desk' } }],
    });
    fromMock.mockReturnValue(read.builder);
    const connection = await loadGmailConnection('practice-1');
    expect(fromMock).toHaveBeenCalledWith('practice_oauth_credentials');
    expect(read.calls).toContainEqual(['select', [GMAIL_CONNECTION_COLUMNS]]);
    expect(read.calls).toContainEqual(['eq', ['practice_id', 'practice-1']]);
    expect(read.calls).toContainEqual(['order', ['connected_at', { ascending: false }]]);
    expect(connection).toEqual({
      email: 'reception@example.test',
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      connectedAt: '2026-10-08T09:00:00Z',
      lastUsedAt: null,
      name: 'Front Desk',
      picture: null,
    });
  });

  // Whether Gmail is set up is told by the Client ID alone (it is public anyway: it is in Google's sign-in address)
  it('checks the practice Google app by its Client ID only', async () => {
    const read = query({ data: { client_id: 'client-1.apps.example' } });
    fromMock.mockReturnValue(read.builder);
    expect(await loadGoogleClientId('practice-1')).toBe('client-1.apps.example');
    expect(fromMock).toHaveBeenCalledWith('practice_oauth_apps');
    expect(read.calls).toContainEqual(['select', ['client_id']]);
  });

  it('has no connection without an address, and none without a practice', async () => {
    expect(gmailConnectionFromRow({ email: '', connected_at: '2026-10-08' })).toBeNull();
    expect(await loadGmailConnection(null)).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('saving the practice Google app', () => {
  const app = { clientId: 'client-1.apps.example', clientSecret: 'typed-secret', redirectUri: 'https://app.onehealthsystems.com/settings' };

  // Signed-in users may write the client secret but not read it back; Postgres refuses an upsert to them (it reads
  // what it would overwrite), so saving must be a plain update or insert (rehearsed against the column grants)
  it('updates the existing app and never upserts', async () => {
    const lookup = query({ data: { id: 'app-1' } });
    const write = query({});
    fromMock.mockReturnValueOnce(lookup.builder).mockReturnValueOnce(write.builder);
    await saveGoogleOAuthApp('practice-1', app);
    expect(lookup.calls).toContainEqual(['select', ['id']]);
    expect(write.calls.map(([method]) => method)).toEqual(['update', 'eq']);
    expect(write.calls[0][1][0]).toMatchObject({ client_id: 'client-1.apps.example', client_secret: 'typed-secret' });
    expect(write.calls).toContainEqual(['eq', ['id', 'app-1']]);
  });

  it('inserts the first app of a practice', async () => {
    const write = query({});
    fromMock.mockReturnValueOnce(query({ data: null }).builder).mockReturnValueOnce(write.builder);
    await saveGoogleOAuthApp('practice-1', app);
    expect(write.calls.map(([method]) => method)).toEqual(['insert']);
    expect(write.calls[0][1][0]).toMatchObject({ practice_id: 'practice-1', provider: 'google', client_secret: 'typed-secret' });
  });

  it('reports a refused save', async () => {
    fromMock.mockReturnValueOnce(query({ data: { id: 'app-1' } }).builder).mockReturnValueOnce(query({ error: { message: 'permission denied' } }).builder);
    await expect(saveGoogleOAuthApp('practice-1', app)).rejects.toThrow('permission denied');
  });
});

describe('starting a Gmail connection', () => {
  // The server builds the Google address with a state it signed; the browser sends no secret, only where to return
  it('asks the function for the Google address and returns it', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth?state=s' }, error: null });
    const start = await startGmailConnect('practice-1', 'https://app.onehealthsystems.com');
    expect(invokeMock).toHaveBeenCalledWith('exchange-oauth-code', {
      body: { action: 'start', provider: 'google', practice_id: 'practice-1', redirect_uri: 'https://app.onehealthsystems.com/settings' },
    });
    expect(start).toEqual({ ok: true, url: 'https://accounts.google.com/o/oauth2/v2/auth?state=s' });
  });

  // The browser only ever follows the function to Google's own sign-in page
  it('refuses to go anywhere but Google', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, authorization_url: 'https://evil.example/login' }, error: null });
    expect((await startGmailConnect('practice-1', 'https://app.onehealthsystems.com')).ok).toBe(false);
  });

  it("shows the function's reason when it refuses (for example a receptionist)", async () => {
    invokeMock.mockResolvedValue({ data: null, error: httpError(403, { success: false, error: 'Only a practice administrator or doctor can connect the practice Gmail.' }) });
    expect(await startGmailConnect('practice-1', 'https://app.onehealthsystems.com')).toEqual({
      ok: false,
      message: 'Only a practice administrator or doctor can connect the practice Gmail.',
    });
  });

  // Until the release deploys the new function, the old one answers "Missing required parameters": say what is needed
  it('says when the updated function is not deployed yet', async () => {
    invokeMock.mockResolvedValue({ data: null, error: httpError(400, { success: false, error: 'Missing required parameters' }) });
    const start = await startGmailConnect('practice-1', 'https://app.onehealthsystems.com');
    expect(start).toEqual({ ok: false, message: 'Gmail cannot be connected until OneHealth deploys the updated exchange-oauth-code function.' });
  });

  it('needs a practice', async () => {
    expect((await startGmailConnect(null, 'https://app.onehealthsystems.com')).ok).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('finishing a Gmail connection', () => {
  it('reads what Google put on the return address', () => {
    expect(readGmailCallback('?code=4%2Fabc&state=p.s&scope=x')).toEqual({ kind: 'code', code: '4/abc', state: 'p.s' });
    expect(readGmailCallback('?error=access_denied&state=p.s')).toEqual({ kind: 'error', error: 'access_denied' });
    // Without a state the parameters are not from a Gmail sign-in
    expect(readGmailCallback('?code=4%2Fabc')).toBeNull();
    expect(readGmailCallback('?tab=social')).toBeNull();
    expect(describeGoogleCallbackError('access_denied')).toBe('Google sign-in was cancelled, so Gmail was not connected.');
  });

  // The server exchanges the code with the stored secret; the browser sends only the code and the signed state
  it('hands the code and state to the function and gets the address back', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, email: 'reception@example.test' }, error: null });
    const result = await completeGmailConnect({ code: 'code-1', state: 'p.s' });
    expect(invokeMock).toHaveBeenCalledWith('exchange-oauth-code', { body: { action: 'exchange', provider: 'google', code: 'code-1', state: 'p.s' } });
    expect(result).toEqual({ ok: true, email: 'reception@example.test' });
  });

  // Google's code works once: React runs effects twice in development, and a second exchange would fail
  it('sends a code to the server only once', async () => {
    invokeMock.mockResolvedValue({ data: { success: true, email: 'reception@example.test' }, error: null });
    const [first, second] = await Promise.all([completeGmailConnect({ code: 'code-2', state: 'p.s' }), completeGmailConnect({ code: 'code-2', state: 'p.s' })]);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("passes on the function's reason when it refuses the sign-in", async () => {
    invokeMock.mockResolvedValue({ data: null, error: httpError(400, { success: false, error: 'The Google sign-in took longer than 10 minutes. Please connect Gmail again.' }) });
    expect(await completeGmailConnect({ code: 'code-3', state: 'p.s' })).toEqual({
      ok: false,
      message: 'The Google sign-in took longer than 10 minutes. Please connect Gmail again.',
    });
  });
});
