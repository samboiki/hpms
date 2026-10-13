import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const platform = vi.hoisted(() => ({ native: false, name: 'web' }));
const appPlugin = vi.hoisted(() => ({ addListener: vi.fn(), minimizeApp: vi.fn() }));
const splashScreen = vi.hoisted(() => ({ hide: vi.fn() }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => platform.native, getPlatform: () => platform.name }
}));
vi.mock('@capacitor/app', () => ({ App: appPlugin }));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: splashScreen }));

import { initNativeApp } from '../nativeApp';

describe('initNativeApp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    appPlugin.addListener.mockReset().mockResolvedValue({ remove: vi.fn() });
    appPlugin.minimizeApp.mockReset().mockResolvedValue(undefined);
    splashScreen.hide.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // The website and the installable web app must behave exactly as they did before the store apps existed
  it('does nothing in a browser', () => {
    Object.assign(platform, { native: false, name: 'web' });
    initNativeApp();
    vi.runAllTimers();
    expect(appPlugin.addListener).not.toHaveBeenCalled();
    expect(splashScreen.hide).not.toHaveBeenCalled();
  });

  it('hides the splash screen once the app has started, without waiting for the time limit', () => {
    Object.assign(platform, { native: true, name: 'ios' });
    initNativeApp();
    expect(splashScreen.hide).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(splashScreen.hide).toHaveBeenCalledTimes(1);
    expect(appPlugin.addListener).not.toHaveBeenCalled(); // iPhones have no Back button
  });

  it('on Android, Back goes back from a deeper page and leaves the app from the dashboard', () => {
    Object.assign(platform, { native: true, name: 'android' });
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    initNativeApp();
    expect(appPlugin.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
    const onBack = appPlugin.addListener.mock.calls[0][1];

    window.history.pushState({}, '', '/patients');
    onBack({ canGoBack: true });
    expect(historyBack).toHaveBeenCalledTimes(1);
    expect(appPlugin.minimizeApp).not.toHaveBeenCalled();

    window.history.pushState({}, '', '/');
    onBack({ canGoBack: true });
    expect(historyBack).toHaveBeenCalledTimes(1);
    expect(appPlugin.minimizeApp).toHaveBeenCalledTimes(1);
  });
});
