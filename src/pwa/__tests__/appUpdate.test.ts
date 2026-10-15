import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirmUpdate,
  forceFreshStart,
  keepWorking,
  LATER_MS,
  reloadAllowed,
  requestUpdate,
  resetAppUpdateForTests,
  setUpdateApplier,
  snoozeUpdate,
  TAKE_OVER_WAIT_MS,
  updateWaiting,
  useUpdatePhase
} from '../appUpdate';
import { mayHaveUnsavedEdits } from '../unsavedEdits';

vi.mock('../unsavedEdits', () => ({ mayHaveUnsavedEdits: vi.fn(() => false) }));
const hasEdits = vi.mocked(mayHaveUnsavedEdits);

// "A new version is ready" has to reach every open copy, but never at the cost of a doctor's typed work, and the app must
// never stay on an old copy because the switch quietly failed.
describe('the update bar', () => {
  let apply: ReturnType<typeof vi.fn>;
  let freshStart: ReturnType<typeof vi.fn>;
  const phase = () => renderHook(() => useUpdatePhase());

  beforeEach(() => {
    vi.useFakeTimers();
    resetAppUpdateForTests();
    hasEdits.mockReturnValue(false);
    apply = vi.fn().mockResolvedValue(undefined);
    freshStart = vi.fn();
    setUpdateApplier(apply, freshStart);
  });
  afterEach(() => vi.useRealTimers());

  it('shows nothing until a new version is waiting, then offers it', () => {
    const { result } = phase();
    expect(result.current).toBe('idle');
    act(() => updateWaiting());
    expect(result.current).toBe('ready');
  });

  it('Update switches at once when nothing could be lost: the waiting version takes over', async () => {
    const { result } = phase();
    act(() => updateWaiting());
    act(() => requestUpdate());
    expect(result.current).toBe('updating');
    await vi.advanceTimersByTimeAsync(0);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('Update asks first when something is typed or a full-screen window is open, and does nothing until the person agrees', async () => {
    hasEdits.mockReturnValue(true);
    const { result } = phase();
    act(() => updateWaiting());
    act(() => requestUpdate());
    expect(result.current).toBe('confirm');
    await vi.advanceTimersByTimeAsync(0);
    expect(apply).not.toHaveBeenCalled();

    act(() => keepWorking());
    expect(result.current).toBe('ready'); // "Not yet": the work stays, the bar stays

    act(() => requestUpdate());
    act(() => confirmUpdate());
    expect(result.current).toBe('updating');
    await vi.advanceTimersByTimeAsync(0);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('"Later" hides the bar, and the next check ten minutes on brings it back (a phone is used all day)', () => {
    const { result } = phase();
    act(() => updateWaiting(0));
    act(() => snoozeUpdate(0));
    expect(result.current).toBe('later');

    act(() => updateWaiting(LATER_MS - 1)); // a check a little early: still hidden
    expect(result.current).toBe('later');

    act(() => updateWaiting(LATER_MS));
    expect(result.current).toBe('ready');
  });

  it('only reloads on its own when nothing could be lost; a reload the person asked for here always goes ahead', () => {
    hasEdits.mockReturnValue(true);
    expect(reloadAllowed()).toBe(false); // another window updated while this one has typed work

    hasEdits.mockReturnValue(false);
    expect(reloadAllowed()).toBe(true);

    hasEdits.mockReturnValue(true);
    act(() => updateWaiting());
    act(() => requestUpdate());
    act(() => confirmUpdate());
    expect(reloadAllowed()).toBe(true); // they chose "Update anyway"
  });

  it('starts from scratch if the new version has not taken over after eight seconds (the phone is never stuck on an old copy)', async () => {
    act(() => updateWaiting());
    act(() => requestUpdate());
    await vi.advanceTimersByTimeAsync(TAKE_OVER_WAIT_MS - 1);
    expect(freshStart).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(freshStart).toHaveBeenCalledTimes(1);
  });

  it('starts from scratch straight away if asking the new version to take over fails', async () => {
    apply.mockRejectedValue(new Error('no worker'));
    act(() => updateWaiting());
    act(() => requestUpdate());
    await vi.advanceTimersByTimeAsync(0);
    expect(freshStart).toHaveBeenCalledTimes(1);
  });
});

describe('forceFreshStart', () => {
  it('forgets the worker and every file the browser saved for the app, then loads from the server', async () => {
    const calls: string[] = [];
    await forceFreshStart({
      registrations: async () => [{ unregister: async () => (calls.push('unregister'), true) }, { unregister: async () => (calls.push('unregister'), true) }],
      cacheNames: async () => ['workbox-precache-v2', 'google-fonts'],
      deleteCache: async (name) => (calls.push(`delete ${name}`), true),
      reload: () => calls.push('reload')
    });
    expect(calls).toEqual(['unregister', 'unregister', 'delete workbox-precache-v2', 'delete google-fonts', 'reload']);
  });

  it('still clears the files and reloads when the worker cannot be reached', async () => {
    const calls: string[] = [];
    await forceFreshStart({
      registrations: async () => {
        throw new Error('blocked');
      },
      cacheNames: async () => ['workbox-precache-v2'],
      deleteCache: async (name) => (calls.push(`delete ${name}`), true),
      reload: () => calls.push('reload')
    });
    expect(calls).toEqual(['delete workbox-precache-v2', 'reload']);
  });
});
