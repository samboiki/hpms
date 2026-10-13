/**
 * Encounters > Automations: the "create follow-up visits automatically" switch and the follow-up templates. A change
 * the database refused (no row changed, no error) showed "Automation enabled" and flipped the switch, which was off
 * again on the next load.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({ changedRows: [] as unknown[] }));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1', role: 'receptionist', practice_id: 'practice-1' } })
}));
vi.mock('../../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    let updating = false;
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'order', 'limit', 'in']) chain[name] = () => chain;
    chain.update = () => {
      updating = true;
      return chain;
    };
    chain.single = () => Promise.resolve({ data: { is_follow_up_automation_enabled: false }, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(updating ? { data: mocks.changedRows, error: null } : { data: table === 'follow_up_templates' ? [] : [], error: null }).then(resolve, reject);
    return chain;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), loading: vi.fn() });
  return { toast, default: toast };
});

import toast from 'react-hot-toast';
import FollowUpAutomation from '../FollowUpAutomation';

beforeEach(() => {
  mocks.changedRows = [];
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe('the automatic follow-up visits switch', () => {
  it('does not say "enabled" when the database changed nothing', async () => {
    render(<FollowUpAutomation />);
    const toggle = await screen.findByLabelText('Create follow-up visits automatically');
    fireEvent.click(toggle);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(toggle).not.toBeChecked();
  });

  it('says "enabled" when the change was saved', async () => {
    mocks.changedRows = [{ id: 'practice-1' }];
    render(<FollowUpAutomation />);
    fireEvent.click(await screen.findByLabelText('Create follow-up visits automatically'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Automation enabled'));
  });
});
