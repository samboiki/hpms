/**
 * Saving an employee's remuneration replaces their benefits and deductions with the ticked ones. When the current ones
 * could not be loaded nothing is ticked, so saving would switch every benefit and deduction off: the window says so and
 * saves nothing.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
  configsError: null as null | { message: string },
  writes: [] as string[]
}));

vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'admin-1', role: 'admin', practice_id: 'practice-1', name: 'Test Admin' } })
}));
vi.mock('../../../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const name of ['select', 'eq', 'in', 'order', 'limit']) chain[name] = self;
    for (const name of ['update', 'insert', 'upsert', 'delete']) {
      chain[name] = () => {
        mocks.writes.push(`${name} ${table}`);
        return chain;
      };
    }
    const row = table === 'users' ? { id: 'staff-1', full_name: 'Test Nurse' } : null;
    const result = () =>
      table === 'employee_salary_configurations' && mocks.configsError
        ? { data: null, error: mocks.configsError }
        : { data: table === 'employee_salaries' ? null : [], error: null };
    chain.single = () => Promise.resolve({ data: row, error: null });
    chain.maybeSingle = () => Promise.resolve({ data: table === 'employee_salaries' ? { basic_salary: 12000 } : null, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
    return chain;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { toast, default: toast };
});

import toast from 'react-hot-toast';
import { EnhancedEmployeeRemunerationModal } from '../EnhancedEmployeeRemunerationModal';

const renderModal = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EnhancedEmployeeRemunerationModal isOpen onClose={vi.fn()} userId="staff-1" userName="Test Nurse" />
    </QueryClientProvider>
  );

beforeEach(() => {
  mocks.configsError = null;
  mocks.writes = [];
  vi.mocked(toast.error).mockClear();
});

describe('saving remuneration after the current benefits and deductions failed to load', () => {
  it('says why and changes nothing', async () => {
    mocks.configsError = { message: 'network error' };
    renderModal();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('could not be loaded')));
    const save = await screen.findByRole('button', { name: 'Save Configuration' });
    await waitFor(() => expect(save).toBeEnabled());
    vi.mocked(toast.error).mockClear();
    fireEvent.click(save);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('nothing can be saved yet')));
    expect(mocks.writes).toEqual([]);
  });

  it('saves once they have loaded', async () => {
    renderModal();
    const save = await screen.findByRole('button', { name: 'Save Configuration' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(mocks.writes).toContain('insert employee_salaries'));
  });
});
