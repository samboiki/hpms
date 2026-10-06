/**
 * When to offer "Install OneHealth" and how. Pure, so the rules can be tested without a browser.
 *
 * - Chrome, Edge and Android fire `beforeinstallprompt`; the app keeps that event and shows its own Install button.
 * - iPhones and iPads never fire it: installing is Share > Add to Home Screen (Safari, and Chrome or Edge since
 *   iOS 16.4), so the banner says exactly that.
 * - Nothing is offered when the app already runs installed, or for 30 days after someone chose "Not now".
 */
export const INSTALL_DISMISS_DAYS = 30;
export const INSTALL_DISMISSED_KEY = 'onehealth-install-dismissed-at';

export type InstallOffer = 'prompt' | 'ios-instructions' | null;

export interface InstallContext {
  /** The app is already running as an installed app */
  isStandalone: boolean;
  /** iPhone or iPad, where installing is done from the Share menu */
  isIos: boolean;
  /** A `beforeinstallprompt` event has been captured */
  hasPromptEvent: boolean;
  /** When "Not now" was last chosen (ms since epoch), if ever */
  dismissedAt: number | null;
  now: number;
}

export function getInstallOffer(context: InstallContext): InstallOffer {
  if (context.isStandalone) return null;
  if (context.dismissedAt !== null && context.now - context.dismissedAt < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000) return null;
  if (context.hasPromptEvent) return 'prompt';
  if (context.isIos) return 'ios-instructions';
  return null;
}

/** iPhone or iPad (iPadOS reports itself as a Mac, but with a touch screen) */
export function detectIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
