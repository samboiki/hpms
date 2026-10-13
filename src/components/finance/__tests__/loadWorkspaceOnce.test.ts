import { beforeEach, describe, expect, it, vi } from 'vitest';

const loader = vi.hoisted(() => ({ calls: 0, resolvers: [] as Array<(value: unknown) => void> }));

vi.mock('../financeData', () => ({
  financeRequestKey: (r: { practiceId: string; windowStartKey: string; lineItemRange: { startKey: string; endKey: string } }) =>
    [r.practiceId, r.windowStartKey, r.lineItemRange.startKey, r.lineItemRange.endKey].join('|'),
  loadFinanceWorkspace: () => {
    loader.calls += 1;
    return new Promise(resolve => loader.resolvers.push(resolve));
  }
}));

import { loadWorkspaceOnce } from '../useFinanceWorkspace';

const request = (practiceId = 'practice-a') => ({
  practiceId,
  windowStartKey: '2025-11-01',
  lineItemRange: { startKey: '2026-10-01', endKey: '2026-10-31' }
});

describe('loadWorkspaceOnce', () => {
  beforeEach(() => {
    loader.resolvers.splice(0).forEach(resolve => resolve({}));
    loader.calls = 0;
  });

  it('shares one running load between two mounts, so Finance reads every invoice once, not twice', async () => {
    const first = loadWorkspaceOnce(request());
    const second = loadWorkspaceOnce(request());
    expect(loader.calls).toBe(1);
    expect(second).toBe(first);
  });

  it('starts a fresh load on refresh after a save, so the saved change is never missed', () => {
    loadWorkspaceOnce(request());
    loadWorkspaceOnce(request(), true);
    expect(loader.calls).toBe(2);
  });

  it('never shares a load between practices (data stays with its practice)', () => {
    loadWorkspaceOnce(request('practice-a'));
    loadWorkspaceOnce(request('practice-b'));
    expect(loader.calls).toBe(2);
  });

  it('loads again once the earlier load has finished, so returning to Finance shows current figures', async () => {
    const first = loadWorkspaceOnce(request());
    loader.resolvers.shift()?.({});
    await first;
    loadWorkspaceOnce(request());
    expect(loader.calls).toBe(2);
  });
});
