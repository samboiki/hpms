import { describe, expect, it, vi } from 'vitest';
import { CodeLoadError, failedModuleUrl, loadWithRetry, RETRY_DELAYS_MS } from '../loadWithRetry';

// A screen's code as importing its file gives it; the waits are skipped
const PAGE = { default: () => null };
const noWait = () => Promise.resolve();
// Safari's words for a download that failed: no file is named, so the import itself is tried again
const safariFailure = () => new TypeError('Importing a module script failed.');

describe('loadWithRetry', () => {
  // A connection that drops for a moment on mobile data must not leave staff without the page they opened
  it('gives the page when the first try fails and the next one works, after a short wait', async () => {
    const load = vi.fn().mockRejectedValueOnce(safariFailure()).mockResolvedValue(PAGE);
    const wait = vi.fn(noWait);
    await expect(loadWithRetry(load, { wait })).resolves.toBe(PAGE);
    expect(load).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(RETRY_DELAYS_MS[0]);
  });

  it('loads a page that arrives the first time without waiting at all', async () => {
    const load = vi.fn().mockResolvedValue(PAGE);
    const wait = vi.fn(noWait);
    await expect(loadWithRetry(load, { wait })).resolves.toBe(PAGE);
    expect(wait).not.toHaveBeenCalled();
  });

  // Chrome remembers a file that failed and fails it again without asking the network, so the retry asks for the same
  // file under a new address (checked in Chrome: the same address is never fetched again, a new one is)
  it('asks again for the file Chrome reported as failed, under a new address', async () => {
    const load = vi.fn().mockRejectedValue(new TypeError('Failed to fetch dynamically imported module: https://app.example.test/assets/Patients-Ab12.js'));
    const importUrl = vi.fn().mockResolvedValue(PAGE);
    await expect(loadWithRetry(load, { wait: noWait, importUrl })).resolves.toBe(PAGE);
    expect(load).toHaveBeenCalledTimes(1);
    expect(importUrl).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/app\.example\.test\/assets\/Patients-Ab12\.js\?retry=\d+-1$/));
  });

  // The screen then says it could not load (lazyScreen.tsx); only this error is shown that way
  it('tries three times in all, then says the code could not be loaded, keeping the last failure', async () => {
    const last = safariFailure();
    const load = vi.fn().mockRejectedValueOnce(safariFailure()).mockRejectedValueOnce(safariFailure()).mockRejectedValue(last);
    const failure = await loadWithRetry(load, { wait: noWait }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CodeLoadError);
    expect((failure as CodeLoadError).reason).toBe(last);
    expect(load).toHaveBeenCalledTimes(1 + RETRY_DELAYS_MS.length);
  });
});

describe('failedModuleUrl', () => {
  it("reads the file from Chrome's, Edge's and Firefox's messages, without an earlier retry mark", () => {
    const file = 'https://app.example.test/assets/Finance-Cd34.js';
    expect(failedModuleUrl(new TypeError(`Failed to fetch dynamically imported module: ${file}`))).toBe(file);
    expect(failedModuleUrl(new TypeError(`error loading dynamically imported module: ${file}`))).toBe(file);
    expect(failedModuleUrl(new TypeError(`Failed to fetch dynamically imported module: ${file}?retry=1760350000000-1`))).toBe(file);
  });

  it("finds no file in Safari's message, or in something that is not an error", () => {
    expect(failedModuleUrl(safariFailure())).toBeNull();
    expect(failedModuleUrl(undefined)).toBeNull();
  });
});
