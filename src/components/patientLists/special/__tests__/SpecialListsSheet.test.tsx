import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PracticeCase } from '../../../../services/payerAccountService';

// Invented patients only; the services (the database) are stand-ins
const service = vi.hoisted(() => ({
  cases: [] as PracticeCase[],
  flagsNotSetUp: false,
  loadReferredPatients: vi.fn()
}));
vi.mock('../../../../services/payerAccountService', () => ({
  isPayersNotSetUp: () => false,
  loadPracticeCases: async () => service.cases,
  loadPayerAccounts: async () => [{ id: 'fund', name: "Employees' Compensation Fund" }]
}));
vi.mock('../../../../services/specialListsService', () => {
  class ListNotSetUpError extends Error {}
  return {
    ListNotSetUpError,
    loadHandedOverAccounts: async () => {
      if (service.flagsNotSetUp) throw new ListNotSetUpError('Account flags');
      return [{ patientId: 'p2', name: 'Test Bravo', setAt: '2026-10-01T10:00:00+02:00', reason: 'No payment after reminders', owedCents: 45000, people: 2 }];
    },
    loadReferredPatients: service.loadReferredPatients
  };
});

import { SpecialListsSheet } from '../SpecialListsSheet';

const renderSheet = () =>
  render(
    <MemoryRouter>
      <SpecialListsSheet open onClose={vi.fn()} practiceId="practice-1" />
    </MemoryRouter>
  );

beforeEach(() => {
  service.flagsNotSetUp = false;
  service.cases = [
    {
      injuryCase: {
        id: 'c1',
        patientId: 'p1',
        type: 'injury_on_duty',
        injuryDate: '2026-10-01',
        employerAccountId: null,
        employerName: 'Test Mining',
        employeeNumber: 'E-1',
        claimNumber: 'ECF/1',
        payerAccountId: 'fund',
        notes: null,
        closedAt: null,
        removedAt: null,
        createdAt: null
      },
      patientName: 'Test Alpha',
      visitCount: 1,
      lastVisit: '2026-10-02'
    }
  ];
  service.loadReferredPatients.mockReset();
  service.loadReferredPatients.mockResolvedValue({
    patients: [{ referralId: 'r1', patientId: 'p3', name: 'Test Charlie', referringName: 'Dr T Example', referralDate: '2026-10-10', validUntil: null, reason: null }],
    more: false
  });
});
afterEach(() => cleanup());

describe('Messages > Lists > Special lists (R29)', () => {
  it("lists the open injury cases with who pays, each opening the patient's billing", async () => {
    renderSheet();
    const name = await screen.findByRole('link', { name: 'Test Alpha' });
    expect(name).toHaveAttribute('href', expect.stringContaining('tab=billing'));
    expect(screen.getByText(/Paid by Employees' Compensation Fund/)).toBeInTheDocument();
    expect(screen.getByText('Employer Test Mining, employee no E-1, claim no ECF/1')).toBeInTheDocument();
  });

  it('switches to the accounts handed over, and to the referred patients of the last 30 days', async () => {
    renderSheet();
    fireEvent.change(screen.getByLabelText('List'), { target: { value: 'handed_over' } });
    expect(await screen.findByRole('link', { name: 'Test Bravo' })).toBeInTheDocument();
    expect(screen.getByText(/2 patients on the account/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('List'), { target: { value: 'referred' } });
    expect(await screen.findByRole('link', { name: 'Test Charlie' })).toBeInTheDocument();
    expect(service.loadReferredPatients).toHaveBeenCalledWith('practice-1', expect.objectContaining({ to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
  });

  it('says a list is not set up yet instead of showing a database error', async () => {
    service.flagsNotSetUp = true;
    renderSheet();
    fireEvent.change(screen.getByLabelText('List'), { target: { value: 'handed_over' } });
    expect(await screen.findByText('Account flags are not set up in this database yet.')).toBeInTheDocument();
  });
});
