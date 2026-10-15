import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAppUpdateForTests, setUpdateApplier, useUpdatePhase } from '../appUpdate';
import { mayHaveUnsavedEdits } from '../unsavedEdits';
import { createUpdateHandlers } from '../updateHandlers';

vi.mock('../unsavedEdits', () => ({ mayHaveUnsavedEdits: vi.fn(() => false) }));
const hasEdits = vi.mocked(mayHaveUnsavedEdits);

// Opening the app again must be enough to get the newest version, and nothing may ever reload a page over typed work.
describe('createUpdateHandlers', () => {
  let applyNow: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;
  let fresh: boolean;
  const phase = () => renderHook(() => useUpdatePhase());
  const handlers = () => createUpdateHandlers({ applyNow, reload, isFreshPage: () => fresh });

  beforeEach(() => {
    resetAppUpdateForTests();
    setUpdateApplier(() => undefined, () => undefined);
    hasEdits.mockReturnValue(false);
    applyNow = vi.fn().mockResolvedValue(undefined);
    reload = vi.fn();
    fresh = true;
  });

  it('switches to a waiting new version at once on a page that was only just opened, with no bar to tap', () => {
    const { result } = phase();
    handlers().onNeedRefresh();
    expect(applyNow).toHaveBeenCalledTimes(1);
    expect(result.current).toBe('idle');
  });

  it('shows the bar instead on a page already in use (the person is in the middle of something)', () => {
    fresh = false;
    const { result } = phase();
    act(() => handlers().onNeedRefresh());
    expect(applyNow).not.toHaveBeenCalled();
    expect(result.current).toBe('ready');
  });

  it('shows the bar, not a silent switch, when something is already typed on a fresh page', () => {
    hasEdits.mockReturnValue(true);
    const { result } = phase();
    act(() => handlers().onNeedRefresh());
    expect(applyNow).not.toHaveBeenCalled();
    expect(result.current).toBe('ready');
  });

  it('loads the new version after another window of the app switched to it, when nothing could be lost', () => {
    handlers().onNeedReload();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload over typed work when another window switched; the bar offers it instead', () => {
    hasEdits.mockReturnValue(true);
    const { result } = phase();
    act(() => handlers().onNeedReload());
    expect(reload).not.toHaveBeenCalled();
    expect(result.current).toBe('ready');
  });
});
