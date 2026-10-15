import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';
import { setUpdateApplier, updateWaiting } from './appUpdate';
import { trackTypedFields } from './unsavedEdits';
import { startUpdateChecks } from './updateChecks';
import { createUpdateHandlers } from './updateHandlers';

/** A page this young that nobody has touched has nothing to lose: a new version already waiting is switched to at once */
const FRESH_PAGE_MS = 4000;

/** Whether anyone has touched the page yet */
function watchFirstTouch(): () => boolean {
  let touched = false;
  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  const mark = () => {
    touched = true;
    events.forEach((name) => window.removeEventListener(name, mark, true));
  };
  events.forEach((name) => window.addEventListener(name, mark, true));
  return () => touched;
}

/**
 * Lets the app start offline and be installed, and keeps every open or installed copy on the newest release (a phone
 * kept the app open for days and never noticed a deploy: owner, 15 Oct 2026). A new release is looked for when the app
 * comes back to the screen and every few minutes (updateChecks.ts); when one is waiting, the "A new version is ready"
 * bar (UpdateBar.tsx) offers it. A page is never reloaded over typed work: the bar asks first, and a page opened afresh
 * switches by itself before anyone starts.
 */
export function registerServiceWorker(): void {
  // The Android and iOS store apps load these files from the phone itself: a service worker could only serve stale copies
  if (import.meta.env.DEV || Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return;

  trackTypedFields();
  const touched = watchFirstTouch();
  const updateServiceWorker = registerSW({
    ...createUpdateHandlers({
      applyNow: () => updateServiceWorker(true),
      reload: () => window.location.reload(),
      isFreshPage: () => performance.now() < FRESH_PAGE_MS && !touched()
    }),
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      startUpdateChecks(registration, () => {
        if (registration.waiting) updateWaiting();
      });
    },
    onRegisterError(error) {
      console.error('Offline support could not start:', error);
    }
  });
  setUpdateApplier(() => updateServiceWorker(true));
}
