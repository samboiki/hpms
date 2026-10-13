import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { getBackButtonAction } from './backButton';

/**
 * Behaviour that only applies inside the Android and iOS store apps (Capacitor); the website and the installable
 * web app never run any of it. The rest of the native setup needs no code here:
 * - status bar colours and keeping the page clear of the status bar, notch and navigation bar: capacitor.config.ts
 * - tel:, mailto: and links to other sites open in the phone's dialer, mail app or browser, because Capacitor hands
 *   every navigation away from the app's own pages to the system
 * - no service worker and no "Install OneHealth" banner: src/pwa/
 */
export function initNativeApp(): void {
  if (!Capacitor.isNativePlatform()) return;

  if (Capacitor.getPlatform() === 'android') {
    // Back button and back gesture: one step back, or leave the app from the first screen. Leaving minimizes the
    // app like the Home button does, so the screen and anything typed are still there when staff come back.
    void App.addListener('backButton', ({ canGoBack }) => {
      if (getBackButtonAction(window.location.pathname, canGoBack) === 'go-back') {
        window.history.back();
      } else {
        App.minimizeApp().catch((error: unknown) => console.error('Could not leave the app:', error));
      }
    });
  }

  // The splash screen stays up until the first screen has been rendered (3 seconds at most, capacitor.config.ts)
  window.setTimeout(() => {
    SplashScreen.hide().catch((error: unknown) => console.error('Could not hide the splash screen:', error));
  }, 0);
}
