import { describe, it, expect } from 'vitest';
import {
  chromeIntentUrl,
  detectInstallBrowser,
  detectIos,
  getInstallMenuOffer,
  getInstallOffer,
  INSTALL_DISMISS_DAYS,
  isPhoneOrTablet,
  type InstallMenuContext
} from '../installPrompt';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 7, 8, 0);
const base = { isStandalone: false, isIos: false, hasPromptEvent: false, dismissedAt: null, now };

// Staff and patients should be offered the installed app once, in the way their phone supports, and never nagged.
describe('getInstallOffer', () => {
  it('offers the Install button when the browser supports it (Chrome, Edge, Android)', () => {
    expect(getInstallOffer({ ...base, hasPromptEvent: true })).toBe('prompt');
  });

  it('explains Share > Add to Home Screen on an iPhone, which has no install button', () => {
    expect(getInstallOffer({ ...base, isIos: true })).toBe('ios-instructions');
  });

  it('offers nothing when the app is already installed', () => {
    expect(getInstallOffer({ ...base, isStandalone: true, hasPromptEvent: true })).toBeNull();
    expect(getInstallOffer({ ...base, isStandalone: true, isIos: true })).toBeNull();
  });

  it('stays quiet for 30 days after "Not now", then offers again', () => {
    const dismissedAt = now - (INSTALL_DISMISS_DAYS - 1) * DAY;
    expect(getInstallOffer({ ...base, hasPromptEvent: true, dismissedAt })).toBeNull();
    expect(getInstallOffer({ ...base, hasPromptEvent: true, dismissedAt: now - (INSTALL_DISMISS_DAYS + 1) * DAY })).toBe('prompt');
  });

  it('offers nothing on browsers that cannot install (no prompt event, not an iPhone or iPad)', () => {
    expect(getInstallOffer(base)).toBeNull();
  });
});

describe('detectIos', () => {
  const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const iphoneChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
  const ipadOs = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const androidChrome = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

  it('recognises iPhones in Safari and in Chrome (both add apps from the Share menu since iOS 16.4)', () => {
    expect(detectIos(iphoneSafari, 5)).toBe(true);
    expect(detectIos(iphoneChrome, 5)).toBe(true);
  });

  it('recognises an iPad, which reports itself as a Mac but has a touch screen', () => {
    expect(detectIos(ipadOs, 5)).toBe(true);
    expect(detectIos(ipadOs, 0)).toBe(false); // a real Mac
  });

  it('does not treat Android as iOS', () => {
    expect(detectIos(androidChrome, 5)).toBe(false);
  });
});

// The owner asked for "Install app" in the avatar menu on his phone (Samsung Galaxy A56: Samsung Internet or Chrome, often
// reached from a link inside WhatsApp). What the item does has to be right for each browser, or he taps it and nothing works.
describe('getInstallMenuOffer', () => {
  const samsungInternet = 'Mozilla/5.0 (Linux; Android 15; SAMSUNG SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36';
  const chromeAndroid = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  const edgeAndroid = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 EdgA/130.0.0.0';
  const firefoxAndroid = 'Mozilla/5.0 (Android 15; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';
  const operaAndroid = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 OPR/85.0.0.0';
  const androidWebView = 'Mozilla/5.0 (Linux; Android 15; SM-A566B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36';
  const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const iphoneChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1';
  const iphoneInstagram = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.20.109 (iPhone15,2; iOS 18_0; en_NA; en; scale=3.00; 1170x2532)';
  const ipadSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const desktopChrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

  const device = (userAgent: string, over: Partial<InstallMenuContext> = {}): InstallMenuContext => ({
    userAgent,
    maxTouchPoints: 5,
    isStandalone: false,
    isSecure: true,
    hasPromptEvent: false,
    ...over
  });

  it('installs with one tap in Samsung Internet, Chrome and Edge on Android once the browser has handed over its prompt', () => {
    for (const userAgent of [samsungInternet, chromeAndroid, edgeAndroid]) {
      expect(getInstallMenuOffer(device(userAgent, { hasPromptEvent: true }))).toBe('prompt');
    }
  });

  it('points to the browser menu when Android has not offered the prompt (or the link was opened inside another app, where Chrome is only a custom tab)', () => {
    for (const userAgent of [samsungInternet, chromeAndroid, edgeAndroid]) {
      expect(getInstallMenuOffer(device(userAgent))).toBe('browser-menu');
    }
  });

  it('gives an iPhone or iPad its steps (Share, Add to Home Screen): iOS has no install prompt to call', () => {
    for (const userAgent of [iphoneSafari, iphoneChrome]) {
      expect(getInstallMenuOffer(device(userAgent))).toBe('ios-steps');
    }
    expect(getInstallMenuOffer(device(ipadSafari))).toBe('ios-steps'); // iPadOS says it is a Mac, but has a touch screen
  });

  it('tells other browsers to open the page in Chrome or Safari, where installing works', () => {
    for (const userAgent of [firefoxAndroid, operaAndroid, androidWebView, iphoneInstagram]) {
      expect(getInstallMenuOffer(device(userAgent))).toBe('open-elsewhere');
    }
  });

  it('is for phones and tablets: a computer keeps the one-time banner, so no menu item there', () => {
    expect(getInstallMenuOffer(device(desktopChrome, { maxTouchPoints: 0, hasPromptEvent: true }))).toBeNull();
    expect(getInstallMenuOffer(device(ipadSafari, { maxTouchPoints: 0 }))).toBeNull(); // a real Mac
  });

  it('is gone once the app runs installed, whatever the browser says', () => {
    expect(getInstallMenuOffer(device(chromeAndroid, { isStandalone: true, hasPromptEvent: true }))).toBeNull();
    expect(getInstallMenuOffer(device(iphoneSafari, { isStandalone: true }))).toBeNull();
  });

  it('is hidden over plain http, because no browser installs an insecure site', () => {
    expect(getInstallMenuOffer(device(chromeAndroid, { isSecure: false, hasPromptEvent: true }))).toBeNull();
  });
});

describe('detectInstallBrowser and isPhoneOrTablet', () => {
  it('tells apart the browsers that can install from the ones that must be left', () => {
    expect(detectInstallBrowser('Mozilla/5.0 (Linux; Android 15; SAMSUNG SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36', 5)).toBe('samsung');
    expect(detectInstallBrowser('Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', 5)).toBe('chrome');
    expect(detectInstallBrowser('Mozilla/5.0 (Android 15; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', 5)).toBe('other');
    expect(detectInstallBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 5)).toBe('ios-browser');
  });

  it('counts an Android tablet and an iPad as tablets, and a desktop as neither', () => {
    expect(isPhoneOrTablet('Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 5)).toBe(true);
    expect(isPhoneOrTablet('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 0)).toBe(false);
  });
});

describe('chromeIntentUrl', () => {
  it('builds the Android link that opens the same page in Chrome, for a page opened inside WhatsApp or another browser', () => {
    expect(chromeIntentUrl({ host: 'app.onehealthsystems.com', pathname: '/', search: '' })).toBe(
      'intent://app.onehealthsystems.com/#Intent;scheme=https;package=com.android.chrome;end'
    );
    expect(chromeIntentUrl({ host: 'app.onehealthsystems.com', pathname: '/patients', search: '?tour=dashboard' })).toContain('/patients?tour=dashboard#Intent');
  });
});
