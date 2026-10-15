import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHECK_EVERY_MS, FOREGROUND_MIN_GAP_MS, startUpdateChecks } from '../updateChecks';

// The owner's phone kept the app open and never noticed a deploy. A release has to be looked for when the app comes back to the
// screen and every few minutes, not only when a page happens to be opened afresh.
describe('startUpdateChecks', () => {
  let clock = 0;
  let intervalHandler: (() => void) | null = null;
  let intervalMs = 0;
  const clearInterval = vi.fn();
  const env = {
    now: () => clock,
    setInterval: (handler: () => void, ms: number) => {
      intervalHandler = handler;
      intervalMs = ms;
      return 7;
    },
    clearInterval
  };
  let visibility: DocumentVisibilityState = 'visible';
  let stop: () => void;
  let update: ReturnType<typeof vi.fn>;
  let onChecked: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clock = 10_000_000;
    intervalHandler = null;
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    update = vi.fn().mockResolvedValue(undefined);
    onChecked = vi.fn();
    clearInterval.mockClear();
    stop = startUpdateChecks({ update }, onChecked, env);
  });
  afterEach(() => stop());

  const backToTheApp = () => document.dispatchEvent(new Event('visibilitychange'));

  it('looks for a new version when the app comes back to the screen', async () => {
    backToTheApp();
    expect(update).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(onChecked).toHaveBeenCalledTimes(1));
  });

  it('does not ask the server while the app is in the background', () => {
    visibility = 'hidden';
    backToTheApp();
    expect(update).not.toHaveBeenCalled();
  });

  it('checks at most once a minute, however often the person switches back and forth', () => {
    backToTheApp();
    clock += FOREGROUND_MIN_GAP_MS - 1;
    backToTheApp();
    expect(update).toHaveBeenCalledTimes(1);
    clock += 1;
    backToTheApp();
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('also checks when the connection comes back, and when a page returns from the back/forward cache', () => {
    window.dispatchEvent(new Event('online'));
    expect(update).toHaveBeenCalledTimes(1);

    clock += FOREGROUND_MIN_GAP_MS;
    const restored = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(restored, 'persisted', { value: true });
    window.dispatchEvent(restored);
    expect(update).toHaveBeenCalledTimes(2);

    clock += FOREGROUND_MIN_GAP_MS;
    const freshLoad = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(freshLoad, 'persisted', { value: false });
    window.dispatchEvent(freshLoad); // a normal load: the browser checks by itself
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('checks every five minutes while the app is open on the screen, and not while it is hidden', () => {
    expect(intervalMs).toBe(CHECK_EVERY_MS);
    expect(CHECK_EVERY_MS).toBe(5 * 60 * 1000);

    clock += CHECK_EVERY_MS;
    intervalHandler?.();
    expect(update).toHaveBeenCalledTimes(1);

    clock += CHECK_EVERY_MS;
    visibility = 'hidden';
    intervalHandler?.();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('shrugs off a failed check (offline) and still looks for an already waiting version afterwards', async () => {
    update.mockRejectedValueOnce(new Error('offline'));
    backToTheApp();
    await vi.waitFor(() => expect(onChecked).toHaveBeenCalledTimes(1));
  });

  it('stops listening when told to', () => {
    stop();
    backToTheApp();
    window.dispatchEvent(new Event('online'));
    expect(update).not.toHaveBeenCalled();
    expect(clearInterval).toHaveBeenCalledWith(7);
  });
});
