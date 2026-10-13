/**
 * Settings > Practice > Practice Overhead (owner decisions 13 Oct 2026): the tiles add up THIS MONTH by default, with a
 * month picker to look back and the practice's own default period; and only administrators get the edit buttons.
 * Before, the tiles added every expense ever recorded, so "Fixed Monthly" grew month after month.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  role: 'admin',
  savedPeriod: null as unknown,
  upserts: [] as unknown[]
}));

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', practice_id: 'practice-1', role: mocks.role } })
}));
vi.mock('../../../lib/supabase', () => {
  // Invented expenses: rent in October and September 2026
  const expense = (id: string, name: string, amount: number, date: string) => ({
    id, practice_id: 'practice-1', branch_id: null, expense_type: 'rent', expense_category: 'fixed_monthly',
    name, amount, currency: 'NAD', expense_date: date, status: 'pending', is_recurring: false
  });
  const rows: Record<string, unknown[]> = {
    branches: [],
    practice_expense_templates: [],
    practice_expenses: [expense('e1', 'October rent', 1000, '2026-10-01'), expense('e2', 'September rent', 700, '2026-09-01')]
  };
  return {
    supabase: {
      from: (table: string) => {
        const chain: Record<string, unknown> = {};
        for (const name of ['select', 'eq', 'order', 'limit']) chain[name] = () => chain;
        chain.upsert = (values: unknown) => { mocks.upserts.push(values); return Promise.resolve({ error: null }); };
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(
          table === 'practice_settings'
            ? { data: mocks.savedPeriod ? [{ setting_value: mocks.savedPeriod }] : [], error: null }
            : { data: rows[table] ?? [], error: null }
        ).then(resolve);
        return chain;
      }
    }
  };
});

import PracticeExpenses from '../PracticeExpenses';

const totalTile = () => screen.getByText('Total Active').parentElement as HTMLElement;

describe('Practice Overhead tiles', () => {
  beforeEach(() => {
    // 13 Oct 2026, midday in Windhoek
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 13, 10)));
    mocks.role = 'admin';
    mocks.savedPeriod = null;
    mocks.upserts = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('add up this month only when the practice has not chosen a default', async () => {
    render(<PracticeExpenses />);
    expect(await screen.findByText('Totals for October 2026')).toBeInTheDocument();
    expect(within(totalTile()).getByText(/1,000\.00/)).toBeInTheDocument();
    // The list below still shows every expense
    expect(screen.getByText('September rent')).toBeInTheDocument();
  });

  it("open on the period the administrators saved, and all time adds up everything", async () => {
    mocks.savedPeriod = { period: 'all' };
    render(<PracticeExpenses />);
    expect(await screen.findByText('Totals for All time')).toBeInTheDocument();
    expect(within(totalTile()).getByText(/1,700\.00/)).toBeInTheDocument();
  });

  it('let an administrator save the period on show as the default', async () => {
    render(<PracticeExpenses />);
    await screen.findByText('Totals for October 2026');
    fireEvent.change(screen.getByLabelText('Period the totals cover'), { target: { value: 'financial_year' } });
    expect(screen.getByText('Totals for Financial year March 2026 to February 2027')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open on this period by default' }));
    await vi.waitFor(() => expect(mocks.upserts).toHaveLength(1));
    expect(mocks.upserts[0]).toMatchObject({ practice_id: 'practice-1', setting_key: 'overhead_default_period', setting_value: { period: 'financial_year' } });
  });

  it('show staff who are not administrators the same figures without add, edit, delete or default buttons', async () => {
    mocks.role = 'receptionist';
    render(<PracticeExpenses />);
    await screen.findByText('Totals for October 2026');
    expect(screen.getByText('October rent')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Expense/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Templates/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete expense/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Period the totals cover'), { target: { value: 'all' } });
    expect(screen.queryByRole('button', { name: 'Open on this period by default' })).not.toBeInTheDocument();
  });
});
