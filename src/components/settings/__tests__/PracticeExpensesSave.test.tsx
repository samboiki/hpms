/**
 * Settings > Practice > Overhead. A change the access rules refuse changes no row and returns no error: "Expense
 * marked as paid" then showed while the bill stayed unpaid, and the overhead ledger kept it as owed.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  updatedRows: [{ id: 'exp-1' }] as unknown[],
  updates: [] as unknown[],
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}));

vi.mock('react-hot-toast', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', practice_id: 'practice-1', role: 'admin' } })
}));
vi.mock('../../../lib/supabase', () => {
  const rows: Record<string, unknown[]> = {
    branches: [],
    practice_expense_templates: [],
    practice_expenses: [{
      id: 'exp-1', practice_id: 'practice-1', branch_id: null, expense_type: 'rent', expense_category: 'fixed_monthly',
      name: 'Rooms rent', amount: 1000, currency: 'NAD', expense_date: '2026-10-01', status: 'pending', is_recurring: false
    }]
  };
  return {
    supabase: {
      from: (table: string) => {
        let updating = false;
        const chain: Record<string, unknown> = {};
        for (const name of ['select', 'eq', 'order']) chain[name] = () => chain;
        chain.update = (values: unknown) => { updating = true; mocks.updates.push(values); return chain; };
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(
          updating ? { data: mocks.updatedRows, error: null } : { data: rows[table] ?? [], error: null }
        ).then(resolve);
        return chain;
      }
    }
  };
});

import PracticeExpenses from '../PracticeExpenses';

describe('PracticeExpenses mark as paid', () => {
  beforeEach(() => {
    mocks.updatedRows = [{ id: 'exp-1' }];
    mocks.updates = [];
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it('says a refused change was not made instead of "marked as paid"', async () => {
    mocks.updatedRows = [];
    render(<PracticeExpenses />);
    fireEvent.click((await screen.findAllByRole('button', { name: /Mark (expense Rooms rent )?as paid/i }))[0]);
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('marks it paid with today as the paid date when the row changed', async () => {
    render(<PracticeExpenses />);
    fireEvent.click((await screen.findAllByRole('button', { name: /Mark (expense Rooms rent )?as paid/i }))[0]);
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Expense marked as paid'));
    expect(mocks.updates[0]).toMatchObject({ status: 'paid', paid_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });
});
