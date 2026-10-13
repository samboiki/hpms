/**
 * A payslip is a legal record handed to staff and their bank. It used to print an invented practice address
 * ("P.O Box 51454 Windhoek") and "Windhoek, Namibia" as every employee's address; it now prints the practice's and the
 * employee's own addresses, or says they were not provided.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { PayslipPreview } from '../PayslipPreview';

const payslip = (extra: Partial<React.ComponentProps<typeof PayslipPreview>['payslipData']> = {}) => ({
  employeeName: 'Test Employee',
  employeeId: 'EMP00001',
  payPeriod: 'October 2026',
  payDate: '31 Oct 2026',
  basicSalary: 10000,
  earnings: [],
  deductions: [],
  currency: 'NAD',
  companyName: 'Example Practice',
  ...extra
});

describe('PayslipPreview addresses', () => {
  it('prints the practice\'s and the employee\'s own addresses', () => {
    render(<PayslipPreview payslipData={payslip({ companyAddress: '12 Example Street, Otjiwarongo', employeeAddress: '4 Sample Road, Rundu' })} />);
    expect(screen.getByText('12 Example Street, Otjiwarongo')).toBeInTheDocument();
    expect(screen.getByText('4 Sample Road, Rundu')).toBeInTheDocument();
  });

  it('says "Not provided" when an address is missing, never an invented one', () => {
    render(<PayslipPreview payslipData={payslip()} />);
    expect(screen.queryByText(/51454/)).not.toBeInTheDocument();
    expect(screen.queryByText('Windhoek, Namibia')).not.toBeInTheDocument();
    // Practice address, employee address and the three bank fields
    expect(screen.getAllByText('Not provided')).toHaveLength(5);
  });
});
