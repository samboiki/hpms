/**
 * Settings > Users > (a staff member) > Payroll > Salary Details. An administrator looking at one person must be able to
 * set up that person's salary from there, and the sample payslip must never pass off the basic salary alone (no PAYE,
 * Social Security or deductions) as an estimate when the calculation fails.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
  salaries: [] as unknown[],
  calculatePayroll: vi.fn()
}));

vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'admin-1', role: 'admin', practice_id: 'practice-1', name: 'Test Admin', practices: { id: 'practice-1', name: 'Example Practice' } }
  })
}));
vi.mock('../../../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const name of ['select', 'eq', 'neq', 'in', 'or', 'order', 'limit', 'gte', 'lte', 'is']) chain[name] = self;
    const result = () => ({ data: table === 'employee_salaries' ? mocks.salaries : [], error: null });
    chain.single = () => Promise.resolve({ data: null, error: null });
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
    return chain;
  };
  return { supabase: { from: (table: string) => builder(table), rpc: () => builder('rpc') } };
});
vi.mock('../../../../services/payrollService', () => ({
  PayrollService: {
    calculatePayroll: mocks.calculatePayroll,
    getEmployeesDueForBonus: vi.fn().mockResolvedValue([]),
    getPayslipWithItems: vi.fn()
  }
}));
vi.mock('../../../../services/stock/stockService', () => ({
  loadPracticeHeading: vi.fn().mockResolvedValue({ name: 'Example Practice', phone: null, address: '1 Example Street, Windhoek' })
}));
// The windows opened from here are tested on their own: only whether (and for whom) they open
vi.mock('../EnhancedEmployeeRemunerationModal', () => ({
  EnhancedEmployeeRemunerationModal: ({ userName }: { userName: string }) => <p>Salary setup for {userName}</p>
}));
vi.mock('../EnhancedPayslipGenerationModal', () => ({ EnhancedPayslipGenerationModal: () => null }));
vi.mock('../EnhancedBenefitsDeductionsManager', () => ({ EnhancedBenefitsDeductionsManager: () => null }));
vi.mock('../PayslipAdjustments', () => ({ PayslipAdjustments: () => null }));

import { PayrollManagement } from '../PayrollManagement';

const salaryRow = {
  id: 'salary-1',
  user_id: 'staff-1',
  basic_salary: 12000,
  currency: 'NAD',
  effective_from: '2026-01-01',
  is_active: true,
  user: { full_name: 'Test Nurse', email: 'nurse@example.test', is_active: true, address: '2 Sample Road, Windhoek' }
};

const renderPayroll = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PayrollManagement selectedUserId="staff-1" selectedUserName="Test Nurse" isTeamView={false} practiceId="practice-1" />
    </QueryClientProvider>
  );

beforeEach(() => {
  mocks.salaries = [];
  mocks.calculatePayroll.mockReset();
});

describe('one staff member\'s Salary Details', () => {
  it('without a salary, offers the administrator to set it up for that person', async () => {
    renderPayroll();
    fireEvent.click(screen.getByRole('button', { name: /Salary Details/ }));
    expect(await screen.findByText('No salary configured yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Employee Salary' }));
    expect(screen.getByText('Salary setup for Test Nurse')).toBeInTheDocument();
  });

  it('says the estimate could not be worked out instead of a payslip without tax and deductions', async () => {
    mocks.salaries = [salaryRow];
    mocks.calculatePayroll.mockRejectedValue(new Error('calculation failed'));
    renderPayroll();
    fireEvent.click(screen.getByRole('button', { name: /Salary Details/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The estimate could not be worked out.');
    expect(screen.queryByText('Net Pay')).not.toBeInTheDocument();
  });
});
