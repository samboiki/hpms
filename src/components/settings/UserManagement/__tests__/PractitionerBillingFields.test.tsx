import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

// The service is replaced: nothing here reaches the database. A partner's invented own number, at 120%
const service = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn()
}));
vi.mock('../../../../services/practitionerBillingService', () => ({
  PRACTITIONER_BILLING_NOT_SET_UP: 'Billing per practitioner is not set up yet.',
  loadPractitionerBillingFor: service.load,
  savePractitionerBilling: service.save
}));
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import PractitionerBillingFields from '../PractitionerBillingFields';
import { usePractitionerBillingDraft } from '../usePractitionerBillingDraft';

const Harness: React.FC<{ role: string; canEdit: boolean }> = ({ role, canEdit }) => {
  const draft = usePractitionerBillingDraft('partner-1');
  return <PractitionerBillingFields draft={draft} role={role} canEdit={canEdit} />;
};

beforeEach(() => {
  service.load.mockReset().mockResolvedValue({ status: 'ready', value: { practiceNumber: '0999888777666', ratePercent: 120 } });
  service.save.mockReset().mockImplementation(async (_id: string, values: unknown) => values);
});

// Business rule (D31): a partner's own practice number decides who the fund pays for their lines, and their rate what
// patients and funds are billed; an administrator sets both on the practitioner's profile, others only see them
describe("a practitioner's billing on their staff profile", () => {
  it('shows the saved number and rate, in words, to an administrator who can change them', async () => {
    render(<Harness role="doctor" canEdit />);
    expect(await screen.findByLabelText('Own practice number')).toHaveValue('0999888777666');
    expect(screen.getByLabelText('Rate (% of the price list)')).toHaveValue('120');
    expect(screen.getByText(/Their lines are priced at 120% of the price list\./)).toBeInTheDocument();
  });

  it('says what is wrong with a mistyped number before anything is saved', async () => {
    render(<Harness role="doctor" canEdit />);
    fireEvent.change(await screen.findByLabelText('Own practice number'), { target: { value: 'PR12345' } });
    expect(screen.getByRole('alert')).toHaveTextContent('A practice number has 7 to 15 digits');
  });

  it('is read-only for staff who are not administrators, and not shown for reception', async () => {
    const { unmount } = render(<Harness role="nurse" canEdit={false} />);
    expect(await screen.findByLabelText('Own practice number')).toBeDisabled();
    expect(screen.getByText("Only the practice's administrators change these.")).toBeInTheDocument();
    unmount();
    render(<Harness role="receptionist" canEdit />);
    await waitFor(() => expect(service.load).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Billing')).toBeNull();
  });

  it('says so before the database is set up', async () => {
    service.load.mockResolvedValue({ status: 'not_set_up' });
    render(<Harness role="doctor" canEdit />);
    expect(await screen.findByText('Billing per practitioner is not set up yet.')).toBeInTheDocument();
  });

  // Clearing both fields puts the partner back on the practice's number and the price list; 100% is the list itself
  it('saves only what changed, and an empty number or 100% as none', async () => {
    const { result } = renderHook(() => usePractitionerBillingDraft('partner-1'));
    await waitFor(() => expect(result.current.load.status).toBe('ready'));
    await act(() => result.current.save());
    expect(service.save).not.toHaveBeenCalled();
    act(() => {
      result.current.setNumberText(' ');
      result.current.setRateText('100');
    });
    await act(() => result.current.save());
    expect(service.save).toHaveBeenCalledWith('partner-1', { practiceNumber: null, ratePercent: null });
  });
});
