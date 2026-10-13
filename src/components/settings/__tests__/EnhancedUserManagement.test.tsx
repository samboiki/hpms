/**
 * Settings > Users for an administrator. Finance's "Manage payroll" and the payroll automation card say
 * "Settings > Users > Payroll": the link must open Payroll, not the team overview. And a person just invited must show
 * in the team list without reloading the page.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({ teamLoads: 0 }));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'admin-1', role: 'admin', practice_id: 'practice-1', name: 'Test Admin' } })
}));
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('../../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    let teamList = false;
    const self = () => chain;
    for (const name of ['eq', 'in', 'lte', 'gte', 'limit']) chain[name] = self;
    chain.select = (columns?: string) => {
      teamList = table === 'users' && typeof columns === 'string' && columns.includes('full_name');
      return chain;
    };
    chain.order = () => {
      if (teamList) mocks.teamLoads += 1;
      return chain;
    };
    chain.single = () => Promise.resolve({ data: null, error: null });
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null, count: 0 }).then(resolve, reject);
    return chain;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});
vi.mock('../UserManagement/PayrollManagement', () => ({ PayrollManagement: () => <p>Payroll stub</p> }));
vi.mock('../UserManagement/LeaveManagement', () => ({ LeaveManagement: () => <p>Leave stub</p> }));
vi.mock('../UserManagement/ExcelTimesheetManagement', () => ({ ExcelTimesheetManagement: () => <p>Timesheets stub</p> }));
vi.mock('../UserManagement/TeamOverview', () => ({ TeamOverview: () => <p>Team overview stub</p> }));
vi.mock('../UserManagement/UserOverview', () => ({ UserOverview: () => null }));
vi.mock('../UserManagement/EditUserModal', () => ({ EditUserModal: () => null }));
vi.mock('../UserManagement/DeleteUserModal', () => ({ DeleteUserModal: () => null }));
vi.mock('../UserManagement/AddUserModal', () => ({
  AddUserModal: ({ onClose }: { onClose: () => void }) => <button type="button" onClick={onClose}>Close the invitation</button>
}));
vi.mock('framer-motion', () => {
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return { motion: new Proxy({}, { get: () => Plain }), AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import { EnhancedUserManagement } from '../EnhancedUserManagement';
import { payrollLink } from '../../billing/invoiceLinks';

const renderUsers = (url = '/settings?tab=users') => {
  window.history.pushState({}, '', url);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EnhancedUserManagement />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  mocks.teamLoads = 0;
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('Settings > Users', () => {
  it('opens on the team overview by default', () => {
    renderUsers();
    expect(screen.getByText('Team overview stub')).toBeInTheDocument();
  });

  it('opens Payroll from a link that names it ("Manage payroll", the payroll automation)', () => {
    renderUsers(payrollLink());
    expect(screen.getByText('Payroll stub')).toBeInTheDocument();
    expect(screen.queryByText('Team overview stub')).not.toBeInTheDocument();
  });

  it('reloads the team list when the invitation window closes, so the invited person shows', async () => {
    renderUsers();
    await waitFor(() => expect(mocks.teamLoads).toBe(1));
    fireEvent.click(screen.getAllByRole('button', { name: /Invite staff member/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Close the invitation' }));
    await waitFor(() => expect(mocks.teamLoads).toBe(2));
  });
});
