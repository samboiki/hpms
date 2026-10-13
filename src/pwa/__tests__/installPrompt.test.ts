import { describe, it, expect } from 'vitest';
import { detectIos, getInstallOffer, INSTALL_DISMISS_DAYS } from '../installPrompt';

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
