import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PatientPayers } from '../../../../services/payerAccountService';

// Invented accounts and cases only; the service (the database) is a stand-in
const service = vi.hoisted(() => ({
  payers: null as PatientPayers | null,
  notSetUp: false,
  removeInjuryCase: vi.fn(),
  linkPatientToAccount: vi.fn()
}));
vi.mock('../../../../services/payerAccountService', () => {
  class PayersNotSetUpError extends Error {}
  return {
    PayersNotSetUpError,
    isPayersNotSetUp: (error: unknown) => error instanceof PayersNotSetUpError,
    loadPatientPayers: async () => {
      if (service.notSetUp) throw new PayersNotSetUpError('not set up');
      return service.payers;
    },
    removeInjuryCase: service.removeInjuryCase,
    linkPatientToAccount: service.linkPatientToAccount,
    unlinkPatientFromAccount: vi.fn(),
    saveInjuryCase: vi.fn()
  };
});

import PatientPayersRegister from '../PatientPayersRegister';

const account = (id: string, name: string, kind: 'employer' | 'compensation_fund') => ({
  id,
  practiceId: 'pr1',
  kind,
  name,
  accountNumber: `AC-${id}`,
  registrationNumber: null,
  vatNumber: null,
  contactName: null,
  phone: null,
  email: null,
  postalAddress: null,
  town: null,
  region: null,
  notes: null,
  createdAt: null,
  closedAt: null,
  closeReason: null
});

beforeEach(() => {
  service.notSetUp = false;
  service.payers = {
    accounts: [account('emp', 'Test Builders', 'employer'), account('ecf', "Employees' Compensation Fund", 'compensation_fund')],
    memberships: [],
    cases: [
      {
        id: 'case-1',
        patientId: 'p1',
        type: 'injury_on_duty',
        injuryDate: '2026-10-01',
        employerAccountId: 'emp',
        employerName: null,
        employeeNumber: 'E-7',
        claimNumber: 'ECF/7',
        payerAccountId: 'ecf',
        notes: null,
        closedAt: null,
        removedAt: null,
        createdAt: null
      }
    ]
  };
  service.removeInjuryCase.mockReset();
  service.removeInjuryCase.mockResolvedValue(undefined);
  service.linkPatientToAccount.mockReset();
  service.linkPatientToAccount.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

const renderRegister = () =>
  render(
    <MemoryRouter>
      <PatientPayersRegister practiceId="pr1" patientId="p1" />
    </MemoryRouter>
  );

describe("the patient's injury cases and company accounts (A14, A19)", () => {
  // Entered once and reused: the file shows the details the fund asks for, and who pays the case
  it('shows each case with its employer, numbers and payer', async () => {
    renderRegister();
    expect(await screen.findByText('Injury on duty, 1 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Employer Test Builders, employee no E-7, claim no ECF/7')).toBeInTheDocument();
    expect(screen.getByText("Paid by Employees' Compensation Fund")).toBeInTheDocument();
  });

  it('removes a case only with a reason, which the database keeps', async () => {
    renderRegister();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Why the case is removed'), { target: { value: 'Recorded on the wrong file' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(service.removeInjuryCase).toHaveBeenCalledWith('case-1', 'Recorded on the wrong file'));
  });

  it('puts the patient on an employer account with their employee number', async () => {
    renderRegister();
    fireEvent.click(await screen.findByRole('button', { name: /Add to a company account/ }));
    fireEvent.change(screen.getByLabelText('Company account'), { target: { value: 'emp' } });
    fireEvent.change(screen.getByLabelText('Employee number'), { target: { value: 'E-7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(service.linkPatientToAccount).toHaveBeenCalledWith('emp', 'p1', 'E-7'));
  });

  it('says the cases are not set up yet before the database has them', async () => {
    service.notSetUp = true;
    renderRegister();
    expect(await screen.findByText(/not set up in this database yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add case/ })).not.toBeInTheDocument();
  });
});
