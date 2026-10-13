/**
 * Settings: each person's own account (details, password) and, for administrators, the practice's people and the
 * move over from Eminance. What a person may change here decides who can do what in the practice, so the role
 * gates and the password rules are tested; the database and the heavy sections are replaced.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

type TestUser = { id: string; name: string; email: string; role: string; practice_id: string; avatar?: string } | null;

const mocks = vi.hoisted(() => {
  const theme = (id: string, name: string, description: string) => ({
    id,
    name,
    description,
    colors: { primary: { from: '#01b9d4', to: '#0891b2' } },
    gradients: { sidebar: 'from-cyan-500 to-blue-600' }
  });
  return {
    user: null as TestUser,
    themes: [theme('default', 'Default', 'Clean and professional'), theme('purple', 'Purple', 'Modern and vibrant')],
    setTheme: vi.fn(),
    updatePassword: vi.fn(),
    checkPassword: vi.fn(),
    endCheckSession: vi.fn(),
    createClient: vi.fn(),
    listFactors: vi.fn(),
    signOutOthers: vi.fn()
  };
});

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = { user: mocks.user, updateUser: vi.fn(), logout: vi.fn() };
    return selector ? selector(state) : state;
  }
}));
vi.mock('../stores/themeStore', () => ({
  useTheme: () => ({ currentTheme: mocks.themes[0], themes: mocks.themes, setTheme: mocks.setTheme, loadThemeFromDatabase: vi.fn() })
}));
vi.mock('../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('../lib/supabase', () => {
  const builder = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'or', 'is', 'order', 'limit']) chain[name] = self;
    chain.single = () => Promise.resolve({ data: null, error: null });
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return chain;
  };
  return { supabase: { from: () => builder(), rpc: () => builder(), auth: { updateUser: mocks.updatePassword, signOut: mocks.signOutOthers, mfa: { listFactors: mocks.listFactors } } } };
});
// The throwaway client that checks the current password
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('../components/dashboard/FloatingVisitTracker', () => ({ default: () => null }));
// The practice's sections are tested on their own; here only which one opens
vi.mock('../components/settings/PracticeInventory', () => ({ default: () => <p>The practice inventory list</p> }));
// Icons are decorative here; a real icon fetches its shape on a timer that can outlive the test
vi.mock('@iconify/react', async (importOriginal) => ({ ...(await importOriginal<typeof import('@iconify/react')>()), Icon: () => null }));
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { toast, default: toast };
});
vi.mock('framer-motion', () => {
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return { motion: new Proxy({}, { get: () => Plain }), AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import toast from 'react-hot-toast';
import Settings from '../pages/Settings';
import { practiceInventoryLink } from '../components/billing/invoiceLinks';

const staff = (role: string): TestUser => ({ id: 'u1', name: 'Test Staff Member', email: 'staff@example.test', role, practice_id: 'practice-1' });

const renderSettings = (url = '/settings') => {
  // The page reads ?tab= from the address bar
  window.history.pushState({}, '', url);
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
};

const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent?.trim());

beforeEach(() => {
  mocks.user = staff('doctor');
  mocks.setTheme.mockReset();
  mocks.updatePassword.mockReset().mockResolvedValue({ error: null });
  mocks.checkPassword.mockReset().mockResolvedValue({ error: null });
  mocks.endCheckSession.mockReset().mockResolvedValue({ error: null });
  mocks.createClient.mockReset().mockImplementation(() => ({ auth: { signInWithPassword: mocks.checkPassword, signOut: mocks.endCheckSession } }));
  mocks.listFactors.mockReset().mockResolvedValue({ data: { all: [], totp: [], phone: [] }, error: null });
  mocks.signOutOthers.mockReset().mockResolvedValue({ error: null });
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('Account', () => {
  it('opens on the signed-in person\'s own details', () => {
    renderSettings();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Account/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Full Name')).toHaveValue('Test Staff Member');
    expect(screen.getByLabelText('Email Address')).toHaveValue('staff@example.test');
  });

  // A receptionist must not be able to make herself an administrator; the email is the sign-in
  it('cannot change the person\'s own name, sign-in email or role: an administrator does that in Users', () => {
    renderSettings();
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Email Address')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Role')).toBeDisabled();
    expect(screen.getByLabelText('Role')).toHaveValue('doctor');
    expect(screen.getByText(/ask a practice administrator \(Settings > Users\)/)).toBeInTheDocument();
  });

  // Keyboard users close the profile card the way they close it on every other page
  it('the profile card under the picture closes with Escape', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }));
    expect(screen.getByRole('heading', { name: 'User Profile' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'User Profile' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open profile menu' })).toHaveFocus();
  });

  it('still opens while the signed-in person is loading', () => {
    mocks.user = null;
    renderSettings();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });
});

describe('sections by role', () => {
  // The import writes patients, accounts and balances into the practice (the database checks the role too)
  it('administrators get Users and "Move over from Eminance"', () => {
    mocks.user = staff('admin');
    renderSettings();
    expect(tabNames()).toEqual(expect.arrayContaining(['Users', 'Move over from Eminance']));
    expect(tabNames()).not.toContain('My HR');
  });

  it('other staff get "My HR" for their own leave and payslips, and no Eminance import', () => {
    renderSettings();
    expect(tabNames()).toContain('My HR');
    expect(tabNames()).not.toContain('Users');
    expect(tabNames()).not.toContain('Move over from Eminance');
  });

  // Stock says "Your current list is in Settings > Practice > Inventory": the link must open that list, not the profile
  it('a link that names a part of a section (Settings > Practice > Inventory) opens that part', async () => {
    mocks.user = staff('admin');
    renderSettings(practiceInventoryLink());
    expect(screen.getByRole('tab', { name: /Practice/ })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('The practice inventory list')).toBeInTheDocument();
  });

  it('a link to a section (?tab=system) opens that section', () => {
    renderSettings('/settings?tab=system');
    expect(screen.getByRole('tab', { name: /System/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Color Themes')).toBeInTheDocument();
    expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
  });

  // A reload or a copied link must open the tab the person was on, not Account
  it('names the open section in the address when another section is chosen', () => {
    renderSettings('/settings?tab=practice&section=inventory');
    fireEvent.click(screen.getByRole('tab', { name: /System/ }));
    expect(window.location.search).toBe('?tab=system');
  });
});

describe('System: the practice\'s colour theme', () => {
  it('lists every theme with what it looks like and marks the one in use', () => {
    renderSettings('/settings?tab=system');
    for (const theme of mocks.themes) {
      expect(screen.getByRole('heading', { name: theme.name })).toBeInTheDocument();
      expect(screen.getAllByText(theme.description).length).toBeGreaterThan(0);
    }
    // One theme in use, the other offered
    expect(screen.getAllByText('ACTIVE')).toHaveLength(1);
    expect(screen.getAllByText('SELECT')).toHaveLength(1);
    expect(screen.getByText('Active: Default')).toBeInTheDocument();
  });

  // Saved with the practice id, so everyone in the practice gets the same colours
  it('applies a chosen theme and saves it for the practice', () => {
    renderSettings('/settings?tab=system');
    fireEvent.click(screen.getByText('Purple'));
    expect(mocks.setTheme).toHaveBeenCalledWith('purple', 'practice-1');
  });

  // The new colours show at once; without this message they went back on the next load with no reason given
  it('says so when the practice\'s theme could not be saved', async () => {
    mocks.setTheme.mockResolvedValue(false);
    renderSettings('/settings?tab=system');
    fireEvent.click(screen.getByText('Purple'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The colour theme could not be saved for the practice. Please try again.'));
  });
});

describe('Account > Security: changing one\'s own password', () => {
  const openSecurity = () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
  };
  const fill = (current: string, next: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: current } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: next } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: confirm } });
  };
  const update = () => fireEvent.click(screen.getByRole('button', { name: /Update Password/ }));
  const nothingSent = () => {
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  };

  it('offers Update Password only once all three fields are filled in', () => {
    openSecurity();
    expect(screen.getByRole('button', { name: /Update Password/ })).toBeDisabled();
    fill('old-test-pass', 'new-test-pass', '');
    expect(screen.getByRole('button', { name: /Update Password/ })).toBeDisabled();
    fill('old-test-pass', 'new-test-pass', 'new-test-pass');
    expect(screen.getByRole('button', { name: /Update Password/ })).toBeEnabled();
  });

  it('refuses a new password shorter than 8 characters, before anything is sent', () => {
    openSecurity();
    // 7 characters
    fill('old-test-pass', 'pass-07', 'pass-07');
    update();
    expect(screen.getByRole('alert')).toHaveTextContent('Your new password must be at least 8 characters.');
    nothingSent();
  });

  it('refuses when the two new passwords differ (a typing slip would lock the person out)', () => {
    openSecurity();
    fill('old-test-pass', 'new-test-pass', 'new-test-pas');
    update();
    expect(screen.getByRole('alert')).toHaveTextContent('The new passwords do not match.');
    nothingSent();
  });

  it('refuses a new password that is the same as the current one', () => {
    openSecurity();
    fill('same-test-pass', 'same-test-pass', 'same-test-pass');
    update();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a password that is different from your current one.');
    nothingSent();
  });

  // Someone at a computer left signed in must not be able to take the account over
  it('checks the current password first: a wrong one changes nothing', async () => {
    mocks.checkPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    openSecurity();
    fill('wrong-test-pass', 'new-test-pass', 'new-test-pass');
    update();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your current password is incorrect.');
    expect(mocks.checkPassword).toHaveBeenCalledWith({ email: 'staff@example.test', password: 'wrong-test-pass' });
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  // A lost connection or too many tries is not a wrong password: saying so sends people to reset a good password
  it('says the current password could not be checked when the check itself failed', async () => {
    mocks.checkPassword.mockResolvedValue({ error: { message: 'Failed to fetch' } });
    openSecurity();
    fill('old-test-pass', 'new-test-pass', 'new-test-pass');
    update();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('could not be checked');
    expect(alert).not.toHaveTextContent('incorrect');
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  it('with the right current password, sets the new one without touching the signed-in session', async () => {
    openSecurity();
    // 8 characters: the shortest allowed
    fill('old-test-pass', 'pass-008', 'pass-008');
    update();

    await waitFor(() => expect(mocks.updatePassword).toHaveBeenCalledWith({ password: 'pass-008' }));
    // The check runs on its own client that keeps no session (only its options are looked at here), and only that
    // check's session is ended
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.createClient.mock.calls[0][2]).toEqual(expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) }));
    expect(mocks.endCheckSession).toHaveBeenCalledWith({ scope: 'local' });
    expect(toast.success).toHaveBeenCalledWith('Your password has been updated');
    // Nothing typed stays on the screen
    await waitFor(() => expect(screen.getByLabelText('Current Password')).toHaveValue(''));
    expect(screen.getByLabelText('New Password')).toHaveValue('');
    expect(screen.getByLabelText('Confirm Password')).toHaveValue('');
  });
});

// Owner decision 13 Oct 2026: the security block shows only what is true (no invented session list or a 2FA that
// says "enabled" for everyone), using Supabase Auth's own two-step sign-in and "sign out of other devices"
describe('Account > Security: two-step sign-in and other devices', () => {
  const openSecurity = () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
  };

  it('says two-step sign-in is off when no authenticator app is linked, and offers to set it up', async () => {
    openSecurity();
    expect(await screen.findByText(/Two-step sign-in is off/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Set up two-step sign-in/ })).toBeInTheDocument();
    expect(screen.queryByText(/San Francisco|New York/)).not.toBeInTheDocument();
  });

  it('says it is on when an authenticator app is linked', async () => {
    mocks.listFactors.mockResolvedValue({ data: { all: [], totp: [{ id: 'f1', factor_type: 'totp', status: 'verified', created_at: '2026-10-01T08:00:00Z' }], phone: [] }, error: null });
    openSecurity();
    expect(await screen.findByText(/Two-step sign-in is on/)).toBeInTheDocument();
    expect(screen.getByText(/added 1 Oct 2026/)).toBeInTheDocument();
  });

  it('signs out the other devices only, keeping this one signed in', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    openSecurity();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of all other devices' }));
    await waitFor(() => expect(mocks.signOutOthers).toHaveBeenCalledWith({ scope: 'others' }));
  });
});
