/**
 * Loading a screen's code again when it did not arrive: a connection that dropped on mobile data, or a release that
 * went live after the app was opened (the code is loaded when a screen is first opened, see lazyScreen.tsx).
 *
 * Chrome remembers a code file that failed for as long as the app stays open: asking for the same file again fails at
 * once, without reaching the network. So a retry asks for that file under a new address (?retry=...), which the browser
 * does fetch. Files the screen shares with other screens are not asked for again: when one of those failed, only
 * opening the app afresh brings it back, and the screen keeps saying it could not load.
 */

/** Two more tries, after 0.4 and 1.2 seconds */
export const RETRY_DELAYS_MS: readonly number[] = [400, 1200];

/** A screen's code could not be loaded, even after trying again (`reason`: the last failure) */
export class CodeLoadError extends Error {
  readonly reason: unknown;

  constructor(reason: unknown) {
    super('The code of this screen could not be loaded.');
    this.name = 'CodeLoadError';
    this.reason = reason;
  }
}

/** The file a failed import names: Chrome, Edge and Firefox put its address in the message (Safari does not) */
export function failedModuleUrl(error: unknown): string | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const match = /https?:\/\/[^\s?#'"]+\.m?js/.exec(message);
  return match ? match[0] : null;
}

export interface RetryOptions<T> {
  delaysMs?: readonly number[];
  wait?: (ms: number) => Promise<void>;
  /** Imports a code file by its address (tests replace it) */
  importUrl?: (url: string) => Promise<T>;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const importByUrl = <T>(url: string): Promise<T> => import(/* @vite-ignore */ url);

/** `load` (a screen's dynamic import), tried again after a short wait when it fails; CodeLoadError when every try failed */
export async function loadWithRetry<T>(load: () => Promise<T>, options: RetryOptions<T> = {}): Promise<T> {
  const { delaysMs = RETRY_DELAYS_MS, wait = pause, importUrl = importByUrl } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    try {
      if (attempt === 0) return await load();
      await wait(delaysMs[attempt - 1]);
      const url = failedModuleUrl(lastError);
      return url ? await importUrl(`${url}?retry=${Date.now()}-${attempt}`) : await load();
    } catch (error) {
      lastError = error;
    }
  }
  throw new CodeLoadError(lastError);
}
