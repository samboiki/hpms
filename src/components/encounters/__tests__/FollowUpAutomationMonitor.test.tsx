import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// The queue's function takes only the scheduler's service key: a press from the app is refused (invoke never throws)
const invoke = vi.hoisted(() => vi.fn(async () => ({ data: null, error: { message: 'Only the platform may run the queue' } })));
vi.mock('../../../lib/supabase', () => {
  const query = (): unknown =>
    new Proxy(
      {},
      {
        get: (_target, key) =>
          key === 'then' ? (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) : () => query()
      }
    );
  const channel = { on: () => channel, subscribe: () => ({ unsubscribe: () => undefined }) };
  return { supabase: { from: () => query(), channel: () => channel, functions: { invoke } } };
});
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast }));

import FollowUpAutomationMonitor from '../FollowUpAutomationMonitor';

afterEach(cleanup);

describe('Encounters > Automations > Process Queue', () => {
  // The press was refused every time and the screen said nothing, so it looked like the queue had run
  it('says the scheduler sends the queue when the press is refused', async () => {
    render(<FollowUpAutomationMonitor />);
    fireEvent.click(screen.getByRole('button', { name: /Process Queue/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/sent by OneHealth's scheduler/), expect.anything()));
    expect(invoke).toHaveBeenCalledWith('process-automation-queue');
  });
});
