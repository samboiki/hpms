import { useSyncExternalStore } from 'react';
import { mayHaveUnsavedEdits } from './unsavedEdits';

/**
 * The "A new version of OneHealth is ready" bar: when it shows and what its buttons do. A new release waits until
 * someone chooses to switch (it never reloads over typed work), and the app is never left on an old copy: if the new
 * version does not take over after "Update", everything the browser saved for the app is cleared and it starts fresh.
 */
export type UpdatePhase = 'idle' | 'ready' | 'confirm' | 'updating' | 'later';

/** "Later" hides the bar for this long; the next check after that shows it again */
export const LATER_MS = 10 * 60 * 1000;
/** After "Update": how long the new version gets to take over before the app starts from scratch */
export const TAKE_OVER_WAIT_MS = 8000;

interface UpdateState {
  phase: UpdatePhase;
  laterAt: number;
}

let state: UpdateState = { phase: 'idle', laterAt: 0 };
let applier: (() => Promise<unknown> | unknown) | null = null;
let freshStart: () => unknown = () => forceFreshStart();
let startedByPerson = false;
const listeners = new Set<() => void>();

function change(next: UpdateState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

/** What makes the waiting new version take over (set by the service worker registration) */
export function setUpdateApplier(apply: () => Promise<unknown> | unknown, startFresh: () => unknown = () => forceFreshStart()): void {
  applier = apply;
  freshStart = startFresh;
}

/** A new version is installed and waiting: show the bar (again, if "Later" was chosen long enough ago) */
export function updateWaiting(now: number = Date.now()): void {
  if (state.phase === 'idle') change({ ...state, phase: 'ready' });
  else if (state.phase === 'later' && now - state.laterAt >= LATER_MS) change({ ...state, phase: 'ready' });
}

export function snoozeUpdate(now: number = Date.now()): void {
  if (state.phase === 'ready' || state.phase === 'confirm') change({ phase: 'later', laterAt: now });
}

/** "Update": at once, unless something typed or a full-screen window is open, which asks first */
export function requestUpdate(): void {
  if (state.phase !== 'ready') return;
  if (mayHaveUnsavedEdits()) change({ ...state, phase: 'confirm' });
  else startUpdating();
}

export function confirmUpdate(): void {
  if (state.phase === 'confirm') startUpdating();
}

export function keepWorking(): void {
  if (state.phase === 'confirm') change({ ...state, phase: 'ready' });
}

/** May the page reload now? Always when the person asked for it here; otherwise only with nothing that could be lost. */
export function reloadAllowed(): boolean {
  return startedByPerson || !mayHaveUnsavedEdits();
}

interface FreshStartEnvironment {
  registrations: () => Promise<readonly { unregister: () => Promise<boolean> }[]>;
  cacheNames: () => Promise<string[]>;
  deleteCache: (name: string) => Promise<boolean>;
  reload: () => void;
}

const browserEnvironment = (): FreshStartEnvironment => ({
  registrations: () => navigator.serviceWorker.getRegistrations(),
  cacheNames: () => caches.keys(),
  deleteCache: (name) => caches.delete(name),
  reload: () => window.location.reload()
});

/**
 * The way out of a stuck copy: forget the app's service worker and everything it saved, then load from the server. Patient
 * data is never kept there (only the app's own files), so nothing is lost; the next load stores the new version afresh.
 */
export async function forceFreshStart(env: FreshStartEnvironment = browserEnvironment()): Promise<void> {
  try {
    await Promise.all((await env.registrations()).map((registration) => registration.unregister()));
  } catch {
    // keep going: clearing the saved files is still worth doing
  }
  try {
    await Promise.all((await env.cacheNames()).map((name) => env.deleteCache(name)));
  } catch {
    // keep going: the reload below goes to the server for the page
  }
  env.reload();
}

function startUpdating(): void {
  startedByPerson = true;
  change({ ...state, phase: 'updating' });
  // The page reloads by itself once the new version has taken over; if that does not happen, start from scratch
  window.setTimeout(() => {
    void freshStart();
  }, TAKE_OVER_WAIT_MS);
  Promise.resolve()
    .then(() => applier?.())
    .catch(() => freshStart());
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useUpdatePhase(): UpdatePhase {
  return useSyncExternalStore(subscribe, () => state).phase;
}

/** Tests only */
export function resetAppUpdateForTests(): void {
  state = { phase: 'idle', laterAt: 0 };
  applier = null;
  freshStart = () => forceFreshStart();
  startedByPerson = false;
  listeners.clear();
}
