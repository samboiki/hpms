import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { detectIos, getInstallOffer, INSTALL_DISMISSED_KEY, type InstallOffer } from './installPrompt';

/** Chrome/Edge/Android's install event (not yet in the standard DOM types) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const readDismissedAt = (): number | null => {
  try {
    const value = localStorage.getItem(INSTALL_DISMISSED_KEY);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
};

const runsInstalled = (): boolean =>
  Capacitor.isNativePlatform() || // the Android or iOS store app
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Offers to install OneHealth on this phone, tablet or computer, once, in the way the device supports */
const InstallAppBanner: React.FC = () => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(readDismissedAt);
  const [installed, setInstalled] = useState(runsInstalled);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // show our own button instead of the browser's mini bar
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const offer: InstallOffer = getInstallOffer({
    isStandalone: installed,
    isIos: detectIos(navigator.userAgent, navigator.maxTouchPoints || 0),
    hasPromptEvent: promptEvent !== null,
    dismissedAt,
    now: Date.now()
  });
  if (!offer) return null;

  const dismiss = () => {
    const at = Date.now();
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(at));
    } catch {
      // Private browsing: the banner stays hidden for this visit only
    }
    setDismissedAt(at);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    if (outcome === 'dismissed') dismiss();
  };

  return (
    <div
      role="dialog"
      aria-labelledby="install-app-title"
      className="fixed inset-x-3 bottom-3 z-[60] rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/5 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[22rem]"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-start gap-3">
        <img src="/icons/pwa-192x192.png" alt="" className="h-11 w-11 flex-shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p id="install-app-title" className="font-semibold text-gray-900">Install OneHealth</p>
          <p className="mt-0.5 text-sm text-gray-600">
            {offer === 'prompt'
              ? 'Open it from your home screen like any other app: full screen and quicker to start.'
              : 'On this iPhone or iPad, tap Share, then Add to Home Screen.'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          {offer === 'prompt' ? 'Not now' : 'Got it'}
        </button>
        {offer === 'prompt' && (
          <button
            type="button"
            onClick={install}
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
};

export default InstallAppBanner;
