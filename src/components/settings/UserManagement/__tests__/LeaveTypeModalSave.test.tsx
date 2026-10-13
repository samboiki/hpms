/**
 * Leave types decide how many days staff may take. A change the database refused used to show "Leave type updated
 * successfully", and a new type whose staff balances failed showed the warning and then "created successfully" as well.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  updatedRows: [] as unknown[],
  balanceError: null as null | { message: string }
}));

vi.mock('../../../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const name of ['eq', 'order', 'limit', 'update']) chain[name] = self;
    chain.select = () => chain;
    chain.insert = () => Promise.resolve({ error: table === 'leave_balances' ? mocks.balanceError : null });
    chain.single = () =>
      Promise.resolve({ data: table === 'users' ? { practice_id: 'practice-1' } : { id: 'type-new' }, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: table === 'leave_types' ? mocks.updatedRows : [{ id: 'staff-1' }], error: null }).then(resolve, reject);
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => builder(table),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'admin-1' } } }) }
    }
  };
});
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { toast, default: toast };
});

import { toast } from 'react-hot-toast';
import LeaveTypeModal from '../LeaveTypeModal';

const existing = {
  id: 'type-1', name: 'Annual Leave', code: 'AL', days_per_year: 15, is_paid: true, carryover_allowed: false,
  max_carryover_days: 0, requires_approval: true, min_notice_days: 1, supporting_documents_required: false,
  description: '', color: '#10B981'
};

const submit = () => fireEvent.submit(document.querySelector('form') as HTMLFormElement);

beforeEach(() => {
  mocks.updatedRows = [];
  mocks.balanceError = null;
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe('saving a leave type', () => {
  it('does not say "updated" when the database changed nothing', async () => {
    const onSuccess = vi.fn();
    render(<LeaveTypeModal isOpen onClose={vi.fn()} onSuccess={onSuccess} existingLeaveType={existing} />);
    submit();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('could not be changed')));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('says "updated" when the change was saved', async () => {
    mocks.updatedRows = [{ id: 'type-1' }];
    render(<LeaveTypeModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} existingLeaveType={existing} />);
    submit();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Leave type updated successfully'));
  });

  it('a new type whose staff balances failed shows only the warning', async () => {
    mocks.balanceError = { message: 'insert refused' };
    render(<LeaveTypeModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Leave Type Name/), { target: { value: 'Study Leave' } });
    fireEvent.change(screen.getByLabelText(/Code/), { target: { value: 'STUDY' } });
    fireEvent.change(screen.getByLabelText(/Days per Year/), { target: { value: '5' } });
    submit();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('staff leave balances could not be set up'), expect.anything()));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
