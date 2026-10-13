import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { PatientPayers } from '../../../services/payerAccountService';

// Invented accounts and cases only; the service (the database) is a stand-in
const service = vi.hoisted(() => ({
  payers: null as PatientPayers | null,
  notSetUp: false,
  /** Reads that fail before one works (a dropped connection) */
  failures: 0,
  visitRow: null as { visitId: string; accountId: string | null; caseId: string | null } | null,
  setVisitPayer: vi.fn()
}));
vi.mock('../../../services/payerAccountService', () => {
  class PayersNotSetUpError extends Error {}
  return {
    PayersNotSetUpError,
    isPayersNotSetUp: (error: unknown) => error instanceof PayersNotSetUpError,
    loadPatientPayers: async () => {
      if (service.notSetUp) throw new PayersNotSetUpError('not set up');
      if (service.failures > 0) {
        service.failures -= 1;
        throw new Error('Failed to fetch');
      }
      return service.payers;
    },
    loadVisitPayer: async () => service.visitRow,
    setVisitPayer: service.setVisitPayer
  };
});

import { useVisitPayer } from '../useVisitPayer';
import VisitPayerCard from '../VisitPayerCard';

const account = (id: string, name: string, kind: 'employer' | 'compensation_fund' = 'employer') => ({
  id,
  practiceId: 'practice-1',
  kind,
  name,
  accountNumber: 'AC-0001',
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
  service.failures = 0;
  service.visitRow = null;
  service.payers = {
    accounts: [account('acc-1', 'Test Builders'), account('fund-1', "Employees' Compensation Fund", 'compensation_fund')],
    memberships: [{ id: 'm1', accountId: 'acc-1', patientId: 'patient-1', employeeNumber: null, linkedAt: null, unlinkedAt: null, unlinkReason: null }],
    cases: [
      {
        id: 'case-1',
        patientId: 'patient-1',
        type: 'injury_on_duty',
        injuryDate: '2026-10-01',
        employerAccountId: 'acc-1',
        employerName: null,
        employeeNumber: null,
        claimNumber: null,
        payerAccountId: 'fund-1',
        notes: null,
        closedAt: null,
        removedAt: null,
        createdAt: null
      }
    ]
  };
  service.setVisitPayer.mockReset();
  service.setVisitPayer.mockResolvedValue({ changed: true, invoices: 1 });
});
afterEach(() => cleanup());

const Harness: React.FC = () => {
  const state = useVisitPayer({ practiceId: 'practice-1', patientId: 'patient-1', visitId: 'visit-1' });
  return <VisitPayerCard state={state} />;
};

describe('who pays for a visit (A14, A19)', () => {
  it("offers the patient, the company the patient is on and the patient's open case", async () => {
    render(<Harness />);
    const select = await screen.findByLabelText('Who pays for this visit');
    expect([...(select as HTMLSelectElement).options].map(option => option.textContent)).toEqual([
      'The patient',
      'Test Builders',
      'Injury on duty, 1 Oct 2026'
    ]);
    fireEvent.change(select, { target: { value: 'case:case-1' } });
    expect(screen.getByText(/Billed to Employees' Compensation Fund under the case/)).toBeInTheDocument();
  });

  // The invoice is made after this save and follows it: billed to an account, all of it is private (nothing claimed)
  it("saves a changed choice before the invoice and says the invoice is then the account's", async () => {
    const { result } = renderHook(() => useVisitPayer({ practiceId: 'practice-1', patientId: 'patient-1', visitId: 'visit-1' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setChoice({ mode: 'account', accountId: 'acc-1' }));
    let saved: { problem: string | null; billsAccount: boolean } | undefined;
    await act(async () => {
      saved = await result.current.save('visit-1');
    });
    expect(service.setVisitPayer).toHaveBeenCalledWith('visit-1', { mode: 'account', accountId: 'acc-1' });
    expect(saved).toEqual({ problem: null, billsAccount: true });
  });

  it('keeps the invoice with what is saved when the database refuses the change (a claim already sent)', async () => {
    service.setVisitPayer.mockRejectedValue(new Error('This invoice was already sent to the fund, so who pays it stays as it is'));
    const { result } = renderHook(() => useVisitPayer({ practiceId: 'practice-1', patientId: 'patient-1', visitId: 'visit-1' }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.setChoice({ mode: 'account', accountId: 'acc-1' }));
    let saved: { problem: string | null; billsAccount: boolean } | undefined;
    await act(async () => {
      saved = await result.current.save('visit-1');
    });
    expect(saved).toEqual({ problem: 'This invoice was already sent to the fund, so who pays it stays as it is', billsAccount: false });
  });

  it('does nothing and shows nothing before the database has accounts and cases', async () => {
    service.notSetUp = true;
    const { result } = renderHook(() => useVisitPayer({ practiceId: 'practice-1', patientId: 'patient-1', visitId: 'visit-1' }));
    await waitFor(() => expect(result.current.status).toBe('not_set_up'));
    expect(result.current.shown).toBe(false);
    expect(await result.current.save('visit-1')).toEqual({ problem: null, billsAccount: false });
    expect(service.setVisitPayer).not.toHaveBeenCalled();
  });

  it('shows nothing for a patient with no company account and no case', async () => {
    service.payers = { accounts: [], memberships: [], cases: [] };
    const { container } = render(<Harness />);
    await waitFor(() => expect(service.payers).not.toBeNull());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });

  // A visit billed to a company account or case had its invoice rewritten as a medical aid invoice (to be claimed) when
  // who pays could not be read as the visit opened, or was still being read when Update was pressed
  it("reads who pays again at save when it could not be read on opening, so an account visit stays the account's", async () => {
    service.failures = 1;
    service.visitRow = { visitId: 'visit-1', accountId: 'acc-1', caseId: null };
    const { result } = renderHook(() => useVisitPayer({ practiceId: 'practice-1', patientId: 'patient-1', visitId: 'visit-1' }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.shown).toBe(true);
    let saved: { problem: string | null; billsAccount: boolean } | undefined;
    await act(async () => {
      saved = await result.current.save('visit-1');
    });
    expect(saved).toEqual({ problem: null, billsAccount: true });
    expect(service.setVisitPayer).not.toHaveBeenCalled();
  });

  it('says plainly on the card when who pays could not be read, instead of hiding it', async () => {
    service.failures = 1;
    render(<Harness />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Who pays for this visit could not be read. It is read again when the visit is saved');
    expect(screen.queryByLabelText('Who pays for this visit')).toBeNull();
  });

  it('names the problem when it still cannot be read at save', async () => {
    service.failures = 2;
    const { result } = renderHook(() => useVisitPayer({ practiceId: 'practice-1', patientId: 'patient-1', visitId: 'visit-1' }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    let saved: { problem: string | null; billsAccount: boolean } | undefined;
    await act(async () => {
      saved = await result.current.save('visit-1');
    });
    expect(saved?.problem).toMatch(/could not be read, so check that its invoice is billed to the right account/);
  });
});
