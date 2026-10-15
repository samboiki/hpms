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

/**
 * The "Install app" item in the profile menu (owner, 15 Oct 2026: on a phone it should be there, not only a banner that
 * shows once). It is for phones and tablets; a computer keeps the banner. What the item does depends on the browser:
 * - prompt: Chrome, Samsung Internet or Edge on Android handed over its install prompt; one tap installs it as a real app
 * - ios-steps: an iPhone or iPad browser, where installing is Share > Add to Home Screen (no prompt exists)
 * - browser-menu: Chrome, Samsung Internet or Edge on Android before they offered the prompt (or inside another app's
 *   tab, such as a link opened from WhatsApp, where the menu says "Open in Chrome" first)
 * - open-elsewhere: any other browser (Firefox, Opera, another app's own browser): open it in Chrome or Safari instead
 * Nothing is offered when the app already runs installed, or over plain http (a browser only installs secure sites).
 */
export type InstallBrowser = 'chrome' | 'samsung' | 'edge' | 'ios-browser' | 'other';
export type InstallMenuOffer = 'prompt' | 'ios-steps' | 'browser-menu' | 'open-elsewhere';

export interface InstallMenuContext {
  userAgent: string;
  maxTouchPoints: number;
  /** The app already runs installed (home screen icon, or the Android and iOS store apps) */
  isStandalone: boolean;
  /** https or localhost: a browser installs nothing else */
  isSecure: boolean;
  /** A `beforeinstallprompt` event has been captured and not used yet */
  hasPromptEvent: boolean;
}

/** Phone or tablet (iPadOS reports itself as a Mac, but with a touch screen) */
export function isPhoneOrTablet(userAgent: string, maxTouchPoints: number): boolean {
  return /Android|iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Which kind of browser this is, as far as installing goes (read from the user agent) */
export function detectInstallBrowser(userAgent: string, maxTouchPoints: number): InstallBrowser {
  if (detectIos(userAgent, maxTouchPoints)) {
    // The browser inside Instagram, Facebook, the Google app and the like has no Add to Home Screen
    return /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|GSA\/|Twitter/.test(userAgent) ? 'other' : 'ios-browser';
  }
  if (/Android/.test(userAgent)) {
    // "; wv)" is an app's own web view (it cannot install anything)
    if (/; wv\)|FBAN|FBAV|Instagram|Line\//.test(userAgent)) return 'other';
    if (/SamsungBrowser/.test(userAgent)) return 'samsung';
    if (/EdgA\//.test(userAgent)) return 'edge';
    if (/Firefox|OPR\/|Opera|OPT\/|UCBrowser|DuckDuckGo|MiuiBrowser|HuaweiBrowser|Vivaldi/.test(userAgent)) return 'other';
    if (/Chrome\//.test(userAgent)) return 'chrome';
  }
  return 'other';
}

/** Android: the link that opens this page in Chrome (for a page opened inside another app, or in a browser that cannot install) */
export function chromeIntentUrl(page: { host: string; pathname: string; search: string }): string {
  return `intent://${page.host}${page.pathname}${page.search}#Intent;scheme=https;package=com.android.chrome;end`;
}

export function getInstallMenuOffer(context: InstallMenuContext): InstallMenuOffer | null {
  if (!isPhoneOrTablet(context.userAgent, context.maxTouchPoints) || context.isStandalone || !context.isSecure) return null;
  if (context.hasPromptEvent) return 'prompt';
  const browser = detectInstallBrowser(context.userAgent, context.maxTouchPoints);
  if (detectIos(context.userAgent, context.maxTouchPoints)) return browser === 'ios-browser' ? 'ios-steps' : 'open-elsewhere';
  return browser === 'other' ? 'open-elsewhere' : 'browser-menu';
}
