/**
 * Settings > Documents: the practice's licences, certificates and policies. The database lets administrators and
 * doctors add and remove them; a receptionist was offered Upload anyway and got "Failed to upload some files" (with the
 * file left behind in storage). A list that failed to load read as "No documents found", and Delete was a button that
 * could never be pressed.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

type TestUser = { id: string; name: string; email: string; role: string; practice_id: string } | null;

const mocks = vi.hoisted(() => ({
  user: null as TestUser,
  loadError: null as null | { message: string },
  documents: [] as unknown[],
  updates: [] as Array<Record<string, unknown>>,
  updatedRows: [{ id: 'doc-1' }] as unknown[]
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = { user: mocks.user, updateUser: vi.fn(), logout: vi.fn() };
    return selector ? selector(state) : state;
  }
}));
vi.mock('../stores/themeStore', () => ({
  useTheme: () => ({
    currentTheme: { id: 'default', name: 'Default', description: 'Clean', colors: { primary: { from: '#000', to: '#111' } }, gradients: { sidebar: 'from-cyan-500 to-blue-600' } },
    themes: [],
    setTheme: vi.fn(),
    loadThemeFromDatabase: vi.fn()
  })
}));
vi.mock('../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const name of ['select', 'insert', 'delete', 'eq', 'neq', 'in', 'or', 'is', 'order', 'limit']) chain[name] = self;
    let updating = false;
    chain.update = (values: Record<string, unknown>) => {
      mocks.updates.push(values);
      updating = true;
      return chain;
    };
    chain.single = () => Promise.resolve({ data: null, error: null });
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      const result = updating
        ? { data: mocks.updatedRows, error: null }
        : table === 'practice_documents'
          ? { data: mocks.loadError ? null : mocks.documents, error: mocks.loadError }
          : { data: [], error: null };
      return Promise.resolve(result).then(resolve, reject);
    };
    return chain;
  };
  return { supabase: { from: (table: string) => builder(table), rpc: () => builder('rpc'), auth: { updateUser: vi.fn() } } };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('../components/dashboard/FloatingVisitTracker', () => ({ default: () => null }));
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

const staff = (role: string): TestUser => ({ id: 'u1', name: 'Test Staff Member', email: 'staff@example.test', role, practice_id: 'practice-1' });
const licence = { id: 'doc-1', name: 'Practice licence', file_path: 'practice-1/practice-documents/licence.pdf', file_size: 2048, document_type: 'other', created_at: '2026-10-01T08:00:00Z' };

const renderDocuments = () => {
  window.history.pushState({}, '', '/settings?tab=documents');
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
};

beforeEach(() => {
  mocks.user = staff('admin');
  mocks.loadError = null;
  mocks.documents = [licence];
  mocks.updates = [];
  mocks.updatedRows = [{ id: 'doc-1' }];
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
  vi.restoreAllMocks();
});

describe('Settings > Documents', () => {
  it('a receptionist can read the documents but is not offered Upload or Remove', async () => {
    mocks.user = staff('receptionist');
    renderDocuments();
    expect(await screen.findByText('Practice licence')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload Documents/ })).toBeDisabled();
    expect(screen.getByText('Only administrators and doctors can add practice documents')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Practice licence' })).toBeDisabled();
  });

  it('says the list could not be loaded instead of "No documents found"', async () => {
    mocks.loadError = { message: 'network down' };
    renderDocuments();
    expect(await screen.findByText('The documents could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('No documents found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('an administrator removes a document (kept, marked inactive) after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDocuments();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Practice licence' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('"Practice licence" was removed'));
    expect(mocks.updates).toEqual([{ is_active: false }]);
  });

  it('does not say "removed" when the database changed nothing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.updatedRows = [];
    renderDocuments();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Practice licence' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
});
