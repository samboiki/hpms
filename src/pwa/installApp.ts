import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { getInstallMenuOffer, type InstallMenuOffer } from './installPrompt';

/**
 * One place that holds the browser's install prompt for the whole app. Chrome, Samsung Internet and Edge on Android fire
 * `beforeinstallprompt` once, early, and an event can be used a single time: the banner and the profile menu's
 * "Install app" both use this, so neither misses the event (the menu opens long after it fired) and neither uses it twice.
 */

/** The browser's install event (not yet in the standard DOM types) */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallSnapshot {
  /** The browser handed over its install prompt and it has not been used yet */
  hasPromptEvent: boolean;
  /** The app was installed while this page was open */
  installed: boolean;
  /** The "how to install" steps are showing (iPhone, other browsers) */
  helpOpen: boolean;
}

let promptEvent: BeforeInstallPromptEvent | null = null;
let snapshot: InstallSnapshot = { hasPromptEvent: false, installed: false, helpOpen: false };
const listeners = new Set<() => void>();

function change(patch: Partial<InstallSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

/** Starts listening for the install event; call once at start-up, before the first screen (the event fires early) */
export function startInstallCapture(target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window): () => void {
  const onPrompt = (event: Event) => {
    event.preventDefault(); // our own button instead of the browser's mini bar
    promptEvent = event as BeforeInstallPromptEvent;
    change({ hasPromptEvent: true });
  };
  const onInstalled = () => {
    promptEvent = null;
    change({ hasPromptEvent: false, installed: true, helpOpen: false });
  };
  target.addEventListener('beforeinstallprompt', onPrompt);
  target.addEventListener('appinstalled', onInstalled);
  return () => {
    target.removeEventListener('beforeinstallprompt', onPrompt);
    target.removeEventListener('appinstalled', onInstalled);
  };
}

/** Shows the browser's own install dialog. An event works once, so it is let go before the person answers. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = promptEvent;
  if (!event) return 'unavailable';
  promptEvent = null;
  change({ hasPromptEvent: false });
  try {
    await event.prompt();
    return (await event.userChoice).outcome;
  } catch {
    return 'unavailable';
  }
}

export const openInstallHelp = (): void => change({ helpOpen: true });
export const closeInstallHelp = (): void => change({ helpOpen: false });

/** Running as an installed app: from the home screen, or the Android and iOS store apps */
export function isRunningInstalled(): boolean {
  return (
    Capacitor.isNativePlatform() ||
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** What the profile menu's "Install app" should do on this device right now (null: do not show it) */
export function currentInstallOffer(): InstallMenuOffer | null {
  return getInstallMenuOffer({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    isStandalone: snapshot.installed || isRunningInstalled(),
    isSecure: window.isSecureContext === true,
    hasPromptEvent: snapshot.hasPromptEvent
  });
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useInstallApp(): InstallSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/** Tests only: back to a page that has seen no install event */
export function resetInstallAppForTests(): void {
  promptEvent = null;
  snapshot = { hasPromptEvent: false, installed: false, helpOpen: false };
  listeners.clear();
}
