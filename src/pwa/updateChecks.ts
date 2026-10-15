/**
 * When the app looks for a new release. The browser checks by itself when a page is opened, but a phone keeps the app
 * open in the background for days and an installed app is rarely opened afresh, so those never noticed a deploy (owner,
 * 15 Oct 2026: "nothing was updated"). Checking is one small request for the service worker file (about 10 kB), so it is
 * done when the app comes back to the screen and every few minutes while it is open.
 */
export const CHECK_EVERY_MS = 5 * 60 * 1000;
/** Switching back to the app again and again must not ask the server each time */
export const FOREGROUND_MIN_GAP_MS = 60 * 1000;

interface Registration {
  update: () => Promise<unknown>;
}

interface CheckEnvironment {
  now: () => number;
  setInterval: (handler: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
}

const realEnvironment: CheckEnvironment = {
  now: () => Date.now(),
  setInterval: (handler, ms) => window.setInterval(handler, ms),
  clearInterval: (id) => window.clearInterval(id)
};

/**
 * Checks when the page becomes visible again, when the connection comes back, when a page is restored from the
 * back/forward cache, and every five minutes while it is on screen. `onChecked` runs after each check (success or not),
 * which is where a waiting new version is noticed. Returns a function that stops it.
 */
export function startUpdateChecks(registration: Registration, onChecked: () => void, env: CheckEnvironment = realEnvironment): () => void {
  let lastCheck = -Infinity;
  const check = () => {
    const now = env.now();
    if (now - lastCheck < FOREGROUND_MIN_GAP_MS) return;
    lastCheck = now;
    // Offline, or the server did not answer: nothing to do, the next check tries again
    void registration.update().catch(() => undefined).finally(onChecked);
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') check();
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) check();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', check);
  window.addEventListener('pageshow', onPageShow);
  const timer = env.setInterval(() => {
    if (document.visibilityState === 'visible') check();
  }, CHECK_EVERY_MS);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('online', check);
    window.removeEventListener('pageshow', onPageShow);
    env.clearInterval(timer);
  };
}
