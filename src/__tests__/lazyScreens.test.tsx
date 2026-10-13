/**
 * Staff pages load when first opened (wave 9: on mobile data the first screen downloads only the sign-in screen, the
 * layout and the Dashboard). Every address is opened here through the app's own route table, with the real page code
 * and an empty database, so a page whose code no longer loads, or that crashes on its first screen, fails here instead
 * of on a practice's phone. Who may open what must not change because the code moved: the guards and the old patient
 * link are checked too.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const PRACTICE = '7d1f0b2c-0000-4000-8000-000000000001';

// An empty database: every list is empty and every single row is missing. The signed-in staff member belongs to an
// invented practice; the practice's choice of who opens Finance is set per test.
const db = vi.hoisted(() => {
  const LIST = { data: [], error: null, count: 0, status: 200 };
  const NONE = { data: null, error: null, status: 200 };
  const query = (): unknown => {
    const proxy: unknown = new Proxy(function query() {}, {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'then') return (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) => Promise.resolve(LIST).then(resolve, reject);
        if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve(NONE);
        return () => proxy;
      }
    });
    return proxy;
  };
  const channel: Record<string, unknown> = {};
  Object.assign(channel, { on: () => channel, subscribe: () => channel, unsubscribe: () => Promise.resolve('ok'), send: () => Promise.resolve('ok') });
  const bucket = {
    list: () => Promise.resolve({ data: [], error: null }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
    createSignedUrl: () => Promise.resolve({ data: null, error: null }),
    upload: () => Promise.resolve({ data: null, error: null }),
    remove: () => Promise.resolve({ data: null, error: null }),
    download: () => Promise.resolve({ data: null, error: null })
  };
  const authUser = { id: 'staff-1', email: 'staff@example.test', user_metadata: { practice_id: '7d1f0b2c-0000-4000-8000-000000000001', role: 'admin' } };
  const supabase = {
    from: () => query(),
    rpc: () => query(),
    channel: () => channel,
    removeChannel: () => Promise.resolve('ok'),
    removeAllChannels: () => Promise.resolve([]),
    getChannels: () => [],
    storage: { from: () => bucket },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: authUser }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signOut: () => Promise.resolve({ error: null }),
      refreshSession: () => Promise.resolve({ data: { session: null }, error: null })
    }
  };
  return { supabase, access: { current: {} as Record<string, string[]> } };
});
vi.mock('../lib/supabase', () => ({ supabase: db.supabase, logDatabaseError: () => undefined }));
vi.mock('../services/screenAccessService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/screenAccessService')>()),
  loadScreenAccess: () => Promise.resolve(db.access.current)
}));

// One page's code is held back (as on a slow connection) until the test lets it arrive
const slowPage = vi.hoisted(() => {
  const gate: { open?: () => void } = {};
  const arrived = new Promise<void>((resolve) => { gate.open = () => resolve(); });
  return { arrived, release: () => gate.open?.() };
});
vi.mock('../pages/admin/PracticesManagement', async (importOriginal) => {
  await slowPage.arrived;
  return importOriginal();
});

// Another page's download fails as many times as a test asks (a dropped connection), then works
const brokenPage = vi.hoisted(() => ({ failuresLeft: 0 }));
vi.mock('../pages/admin/SystemBlueprint', async (importOriginal) => {
  if (brokenPage.failuresLeft > 0) {
    brokenPage.failuresLeft -= 1;
    throw new TypeError('Importing a module script failed.');
  }
  return importOriginal();
});

import App from '../App';
import { useAuthStore } from '../stores/authStore';

// jsdom has no ResizeObserver (Finance's charts measure their box with it) and no window.scrollTo
class NoResize {
  observe() { return undefined; }
  unobserve() { return undefined; }
  disconnect() { return undefined; }
}
globalThis.ResizeObserver ??= NoResize as unknown as typeof ResizeObserver;
window.scrollTo = () => undefined;

type Role = 'admin' | 'doctor' | 'nurse' | 'receptionist';
const signIn = (role: Role, isSupport = false) =>
  useAuthStore.setState({
    isAuthenticated: true,
    sessionKind: 'staff',
    user: {
      id: 'staff-1', email: 'staff@example.test', name: 'Invented Staff', role, is_super_admin: isSupport,
      practice_id: PRACTICE, practices: { id: PRACTICE, name: 'Invented Practice' }
    }
  });

// A page that throws while rendering shows here instead of emptying the whole screen
class Crash extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <p>The screen crashed: {this.state.error.message}</p> : this.props.children;
  }
}

const Address = () => {
  const location = useLocation();
  return <output aria-label="address">{`${location.pathname}${location.search}`}</output>;
};

const open = (path: string) =>
  render(
    <Crash>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[path]}>
          <App />
          <Address />
        </MemoryRouter>
      </QueryClientProvider>
    </Crash>
  );

const FOUND = { timeout: 30000 };

afterEach(() => {
  cleanup();
  db.access.current = {};
});

// First in the file: the page's code is held back only the first time it is loaded
describe("while a page's code is on its way", () => {
  // The menu stays usable and the page area shows the usual spinner (as Stock and Optometry always did), instead of the
  // whole screen waiting on a slow connection
  it('the layout shows at once, with the spinner where the page will be', async () => {
    signIn('admin', true);
    open('/admin/practices');
    expect(await screen.findByRole('button', { name: 'Open menu' }, FOUND)).toBeInTheDocument();
    expect(document.querySelector('main .animate-spin')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: /^Practice Management$/ })).toBeNull();

    slowPage.release();
    expect(await screen.findByRole('heading', { name: /^Practice Management$/ }, FOUND)).toBeInTheDocument();
  }, 60000);
});

// Before the pages below: a page's code is kept once it has loaded
describe("when a page's code cannot be downloaded", () => {
  // Not an empty screen: the menu stays, the page area says so, and Try again loads the page without reloading the app
  // (a reload of a deep link is "page not found" on the server until the deployment sends every address to the app)
  it('the page area says it could not load, and Try again opens the page', async () => {
    brokenPage.failuresLeft = 3;
    signIn('admin', true);
    open('/admin/blueprint');
    expect(await screen.findByRole('heading', { name: 'This page could not load' }, FOUND)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the dashboard' })).toHaveAttribute('href', '/');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: /^OneHealth System Blueprint$/ }, FOUND)).toBeInTheDocument();
    expect(screen.queryByText('This page could not load')).toBeNull();
  }, 60000);
});

describe('every staff page still opens at its address now that it loads when first opened', () => {
  // OneHealth support opens every page, so each shows its own heading (an empty practice: no patient, no practice row)
  const PAGES: Array<[string, RegExp]> = [
    ['/patients', /^Patients$/],
    ['/encounters', /^Encounters$/],
    ['/communications', /^Communications Center$/],
    ['/finance', /^Finance$/],
    // Stock and Optometry were already loaded when opened
    // /optometry has no page of its own any more: it opens the same part of Stock (owner, 13 Oct 2026; the redirect is
    // tested in components/optometry/__tests__/OptometryFollowsStock.test.tsx)
    ['/stock', /^Stock$/],
    ['/admin/practices', /^Practice Management$/],
    ['/admin/tariffs', /^Tariffs$/],
    ['/admin/funds', /^Medical aid funds$/],
    ['/admin/blueprint', /^OneHealth System Blueprint$/],
    ['/settings', /^Settings$/]
  ];

  for (const [path, heading] of PAGES) {
    it(`${path} shows its page`, async () => {
      signIn('admin', true);
      open(path);
      expect(await screen.findByRole('heading', { name: heading }, FOUND)).toBeInTheDocument();
      expect(screen.queryByText(/The screen crashed/)).toBeNull();
      expect(screen.getByLabelText('address')).toHaveTextContent(path);
    }, 60000);
  }
});

describe('who may open what is unchanged', () => {
  // A practice that keeps receptionists out of Finance: the page (and its code) is not opened for them
  // (The notice keeps the Finance header, so the page itself is recognised by its section tabs)
  it('a role the practice keeps out of Finance is told to ask the administrator, and gets no Finance page', async () => {
    db.access.current = { finance: ['doctor'] };
    signIn('receptionist');
    open('/finance');
    expect(await screen.findByRole('heading', { name: /Ask your practice administrator for access to Finance/ }, FOUND)).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Finance sections' })).toBeNull();
  }, 60000);

  it('a role the practice lets into Finance opens it', async () => {
    db.access.current = { finance: ['receptionist'] };
    signIn('receptionist');
    open('/finance');
    expect(await screen.findByRole('tablist', { name: 'Finance sections' }, FOUND)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Ask your practice administrator/ })).toBeNull();
  }, 60000);

  // Administrator tools are not for everyone: anyone else gets the ordinary "page not found"
  it('a receptionist opening an administrator page gets "Page not found"', async () => {
    signIn('receptionist');
    open('/admin/funds');
    expect(await screen.findByRole('heading', { name: 'Page not found' }, FOUND)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Medical aid funds/ })).toBeNull();
  }, 60000);
});

// Already loaded when opened before this change; still there with the staff pages split off
describe('the patient-facing screens', () => {
  // A patient signed in with their cell number gets the patient app (first: confirming who they are) and nothing of the
  // staff app
  it('a patient login gets the patient app', async () => {
    useAuthStore.setState({ isAuthenticated: false, user: null, sessionKind: 'patient' });
    open('/');
    expect(await screen.findByRole('heading', { name: 'Confirm who you are' }, FOUND)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull();
  }, 60000);

  // The link in a booking's SMS opens that booking's questions without signing in (an unknown code says so)
  it("a booking's pre-visit link opens without signing in", async () => {
    useAuthStore.setState({ isAuthenticated: false, user: null, sessionKind: null });
    window.history.replaceState(null, '', '/#/q/AAAAAAAAAAAAAAAAAAAAAA');
    try {
      open('/');
      expect(await screen.findByRole('heading', { name: 'This link does not work' }, FOUND)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull();
    } finally {
      window.history.replaceState(null, '', '/');
    }
  }, 60000);
});

describe('old links', () => {
  // Older SMS and e-mail links point at /patients/<id>?visit=<id>: they still open that patient's visit on Patients
  it('an old patient link goes to the Patients page with the patient and the visit to open', async () => {
    signIn('doctor');
    open('/patients/patient-1?visit=visit-1');
    expect(await screen.findByRole('heading', { name: /^Patients$/ }, FOUND)).toBeInTheDocument();
    expect(screen.getByLabelText('address')).toHaveTextContent('/patients?patientId=patient-1&visitId=visit-1&action=edit-visit');
  }, 60000);

  // The old patient page (/patients/<id>/visit/<id>) was removed on the owner's say-so (13 Oct 2026: nothing linked to
  // it); a bookmark of it still opens that patient's visit, on the Patients page, rather than "page not found"
  it('an old patient-page address opens the patient and the visit on the Patients page', async () => {
    signIn('doctor');
    open('/patients/patient-1/visit/visit-1');
    expect(await screen.findByRole('heading', { name: /^Patients$/ }, FOUND)).toBeInTheDocument();
    expect(screen.getByLabelText('address')).toHaveTextContent('/patients?patientId=patient-1&visitId=visit-1&action=edit-visit');
  }, 60000);

  // The billing-workflow and practice-profile pages were removed too (nothing linked to them): their addresses are the
  // ordinary "page not found", with the menu still there
  for (const path of ['/billing/workflow', '/practice-profile']) {
    it(`${path} is "Page not found"`, async () => {
      signIn('admin');
      open(path);
      expect(await screen.findByRole('heading', { name: 'Page not found' }, FOUND)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    }, 60000);
  }
});
