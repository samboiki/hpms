import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const invoke = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));
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

import FollowUpAutomationMonitor from '../FollowUpAutomationMonitor';

afterEach(cleanup);

describe('Encounters > Automations queue status', () => {
  // The queue is run by OneHealth's scheduler with its service key: a "Process Queue" press from the app was always
  // refused, so the owner had the dead button removed (13 Oct 2026). The screen only shows the queue.
  it('offers no button that would try to run the queue from the browser', async () => {
    render(<FollowUpAutomationMonitor />);
    expect(await screen.findByText('Automation Queue Status')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Process Queue/ })).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});
