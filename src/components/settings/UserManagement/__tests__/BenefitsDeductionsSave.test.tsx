/**
 * Settings > Users > Benefits and deductions. A change the access rules refuse (only administrators and doctors may
 * change them) changes no row and returns no error: "Deactivated - no longer applied to new payslips" then showed
 * while the item stayed on every payslip.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
  changedRows: [{ id: 'benefit-1' }] as unknown[],
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}));

vi.mock('react-hot-toast', () => ({ default: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', role: 'nurse', practice_id: 'practice-1' } })
}));
vi.mock('../../../../lib/supabase', () => {
  const benefit = {
    id: 'benefit-1', practice_id: 'practice-1', name: 'Housing allowance', code: 'HOUSE', type: 'fixed', value: 500,
    base_calculation: 'basic_salary', is_active: true, is_recurring: true, is_company_contribution: false
  };
  return {
    supabase: {
      from: (table: string) => {
        let writing = false;
        const chain: Record<string, unknown> = {};
        for (const name of ['select', 'eq', 'order']) chain[name] = () => chain;
        for (const name of ['update', 'delete']) chain[name] = () => { writing = true; return chain; };
        chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(
          writing ? { data: mocks.changedRows, error: null } : { data: table === 'benefits' ? [benefit] : [], error: null }
        ).then(resolve);
        return chain;
      }
    }
  };
});

import { EnhancedBenefitsDeductionsManager } from '../EnhancedBenefitsDeductionsManager';

const renderManager = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <EnhancedBenefitsDeductionsManager />
  </QueryClientProvider>
);

describe('benefits and deductions: changes the database refused', () => {
  beforeEach(() => {
    mocks.changedRows = [{ id: 'benefit-1' }];
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it('says a refused deactivation was not made', async () => {
    mocks.changedRows = [];
    renderManager();
    fireEvent.click(await screen.findByTitle('Deactivate'));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('confirms a deactivation that changed the row', async () => {
    renderManager();
    fireEvent.click(await screen.findByTitle('Deactivate'));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Deactivated - no longer applied to new payslips'));
  });
});
