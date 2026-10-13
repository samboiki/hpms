/**
 * Settings > Practice > Departments. Staff belong to a department by its name, so renaming a department used to leave
 * every member behind (the department showed no staff, they showed a department that no longer exists). And a change
 * the access rules refused (only administrators and doctors may change departments) changes no row and returns no
 * error, so it used to say "Department updated successfully".
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  updatedRows: [{ id: 'dep-1' }] as unknown[],
  writes: [] as Array<{ table: string; values: unknown; filters: unknown[][] }>,
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}));

vi.mock('react-hot-toast', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', practice_id: 'practice-1', role: 'admin' } })
}));
vi.mock('../../../lib/supabase', () => {
  const rows: Record<string, unknown[]> = {
    departments: [{ id: 'dep-1', practice_id: 'practice-1', name: 'Front desk', is_active: true, created_at: '', updated_at: '' }],
    users: [{ id: 'u2', full_name: 'Staff Member', department: 'Front desk', is_active: true }]
  };
  return {
    supabase: {
      from: (table: string) => {
        let write: { table: string; values: unknown; filters: unknown[][] } | null = null;
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.order = () => chain;
        chain.eq = (...args: unknown[]) => { write?.filters.push(args); return chain; };
        chain.update = (values: unknown) => {
          write = { table, values, filters: [] };
          mocks.writes.push(write);
          return chain;
        };
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(
          write && table === 'departments' ? { data: mocks.updatedRows, error: null }
            : write ? { data: null, error: null }
              : { data: rows[table], error: null }
        ).then(resolve);
        return chain;
      }
    }
  };
});

import DepartmentManagement from '../DepartmentManagement';

async function renameTo(name: string) {
  render(<DepartmentManagement />);
  fireEvent.click(await screen.findByLabelText('Edit department Front desk'));
  fireEvent.change(screen.getByLabelText(/Department Name/), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: /Update Department/ }));
}

describe('DepartmentManagement save', () => {
  beforeEach(() => {
    mocks.updatedRows = [{ id: 'dep-1' }];
    mocks.writes = [];
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it('moves the staff of a renamed department to the new name', async () => {
    await renameTo('Reception');
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Department updated successfully'));
    const staffMove = mocks.writes.find(w => w.table === 'users');
    expect(staffMove?.values).toEqual({ department: 'Reception' });
    expect(staffMove?.filters).toContainEqual(['department', 'Front desk']);
    expect(staffMove?.filters).toContainEqual(['practice_id', 'practice-1']);
  });

  it('says the change was not saved when the database changed no row', async () => {
    mocks.updatedRows = [];
    await renameTo('Reception');
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.writes.some(w => w.table === 'users')).toBe(false);
  });
});
