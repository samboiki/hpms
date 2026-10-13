import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FundMemberRow, FundProvider } from '../../../../utils/accounts/fundMoves';

// Invented patients and funds only; the service (and so the database) is a stand-in
const service = vi.hoisted(() => ({
  members: [] as FundMemberRow[],
  providers: [] as FundProvider[],
  movesNotSetUp: false,
  applyFundMove: vi.fn()
}));
vi.mock('../../../../services/fundMoveService', () => {
  class FundMovesNotSetUpError extends Error {}
  return {
    FundMovesNotSetUpError,
    loadFundMembers: async () => service.members,
    loadFundProviders: async () => service.providers,
    loadFundOptions: async () => ['Plus', 'Standard'],
    loadFundMoves: async () => {
      if (service.movesNotSetUp) throw new FundMovesNotSetUpError('not set up');
      return [];
    },
    applyFundMove: service.applyFundMove
  };
});
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FundMoveDialog } from '../FundMoveDialog';

const member = (id: string, name: string, planType: string, relationship = 'self', providerId: string | null = 'fund-a'): FundMemberRow => ({
  medicalAidId: `aid-${id}`,
  patientId: `patient-${id}`,
  patientName: name,
  provider: providerId === 'fund-b' ? 'Fund B' : 'Fund A',
  scheme: planType,
  planType,
  providerId,
  relationship
});

beforeEach(() => {
  service.providers = [
    { id: 'fund-a', name: 'Fund A', reference: 'FA01' },
    { id: 'fund-b', name: 'Fund B', reference: 'FB01' }
  ];
  service.members = [
    member('1', 'Test Alpha', 'Standard'),
    member('2', 'Test Bravo', 'Standard', 'child'),
    member('3', 'Test Charlie', 'Gold'),
    member('4', 'Test Delta', 'Plus', 'self', 'fund-b')
  ];
  service.movesNotSetUp = false;
  service.applyFundMove.mockReset();
  service.applyFundMove.mockResolvedValue({ moveId: 'move-1', moved: 1, claimsMoved: 2, skipped: [] });
});
afterEach(() => cleanup());

const openOnFundA = async () => {
  render(<FundMoveDialog practiceId="practice-1" onClose={vi.fn()} onPatientsChanged={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText('Patients on'), { target: { value: 'id:fund-a' } });
};

describe('Move to another fund (A21)', () => {
  // A fund merging an option moves exactly the patients the administrator saw and ticked, and each file keeps why
  it('moves only the ticked patients of the chosen option, with what the list showed and the reason', async () => {
    const onPatientsChanged = vi.fn();
    render(<FundMoveDialog practiceId="practice-1" onClose={vi.fn()} onPatientsChanged={onPatientsChanged} />);
    fireEvent.change(await screen.findByLabelText('Patients on'), { target: { value: 'id:fund-a' } });
    fireEvent.click(screen.getByRole('button', { name: /Standard/ }));
    const list = screen.getByRole('list');
    expect(within(list).getByText('Test Alpha')).toBeInTheDocument();
    expect(within(list).queryByText('Test Charlie')).not.toBeInTheDocument();
    // Bravo stays where they are
    fireEvent.click(within(list).getByRole('checkbox', { name: /Test Bravo/ }));
    fireEvent.change(screen.getByLabelText('Fund'), { target: { value: 'fund-b' } });
    fireEvent.change(screen.getByLabelText('Option'), { target: { value: 'Plus' } });
    fireEvent.change(screen.getByLabelText('Why they move'), { target: { value: 'Standard merged into Plus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move 1 patient' }));
    expect(screen.getByText(/Claims already sent to a fund stay as they are/)).toBeInTheDocument();
    const moveButtons = screen.getAllByRole('button', { name: 'Move 1 patient' });
    fireEvent.click(moveButtons[moveButtons.length - 1]);

    await waitFor(() => expect(service.applyFundMove).toHaveBeenCalledTimes(1));
    const [practiceId, payload] = service.applyFundMove.mock.calls[0];
    expect(practiceId).toBe('practice-1');
    expect(payload).toEqual({
      reason: 'Standard merged into Plus',
      from_label: 'Fund A, option Standard',
      to: { provider_id: 'fund-b', option: 'Plus' },
      patients: [{ patient_id: 'patient-1', medical_aid_id: 'aid-1', expected: { provider: 'Fund A', plan_type: 'Standard', medical_aid_provider_id: 'fund-a' } }]
    });
    expect(await screen.findByText(/1 patient moved; 2 claims not sent yet went to the new fund's batch/)).toBeInTheDocument();
    expect(onPatientsChanged).toHaveBeenCalled();
  });

  it('asks for the reason before anything can be moved', async () => {
    await openOnFundA();
    fireEvent.change(screen.getByLabelText('Fund'), { target: { value: 'fund-b' } });
    expect(screen.getByRole('button', { name: 'Move 3 patients' })).toBeDisabled();
    expect(screen.getByText(/Say why the patients move/)).toBeInTheDocument();
  });

  it('leaves out patients already on the fund and option they would move to', async () => {
    await openOnFundA();
    fireEvent.change(screen.getByLabelText('Fund'), { target: { value: 'fund-a' } });
    fireEvent.change(screen.getByLabelText('Option'), { target: { value: 'gold' } });
    const list = screen.getByRole('list');
    expect(within(list).queryByText('Test Charlie')).not.toBeInTheDocument();
    expect(within(list).getAllByRole('checkbox')).toHaveLength(2);
  });

  it('says the move is not set up yet before the SQL exists, and moves nothing', async () => {
    service.movesNotSetUp = true;
    await openOnFundA();
    expect(await screen.findByText(/not set up in this database yet/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Fund'), { target: { value: 'fund-b' } });
    fireEvent.change(screen.getByLabelText('Why they move'), { target: { value: 'Fund closed' } });
    expect(screen.getByRole('button', { name: 'Move 3 patients' })).toBeDisabled();
  });
});
