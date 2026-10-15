import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstallAppDialog from '../InstallAppDialog';
import InstallAppMenuItem from '../InstallAppMenuItem';
import { resetInstallAppForTests, startInstallCapture } from '../installApp';

const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 15; SM-A566B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 15; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function pretend(userAgent: string, { touch = 5, secure = true, standalone = false } = {}) {
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: touch, configurable: true });
  Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: standalone && query.includes('standalone') })) as never;
}

const installEvent = () =>
  Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'accepted' as const })
  });

const BUTTON = /install app/i;
const renderMenu = (onSelect?: () => void) =>
  render(
    <>
      <InstallAppMenuItem className="menu-button" onSelect={onSelect} />
      <InstallAppDialog />
    </>
  );

// The owner wants "Install app" in the avatar menu on his Samsung phone, and to know whether it works on an iPhone. Each device
// has to be told the one thing that works for it.
describe('Install app in the profile menu', () => {
  let stop: () => void;

  beforeEach(() => {
    resetInstallAppForTests();
    stop = startInstallCapture(window);
    pretend(ANDROID_CHROME);
  });
  afterEach(() => stop());

  it('is not shown on a computer (the one-time banner covers it)', () => {
    pretend(DESKTOP_CHROME, { touch: 0 });
    renderMenu();
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull();
  });

  it('is not shown once OneHealth runs as an installed app', () => {
    pretend(ANDROID_CHROME, { standalone: true });
    renderMenu();
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull();
  });

  it('on Android, uses the browser\'s own install prompt: one tap, and the menu closes first', () => {
    const event = installEvent();
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true); // our button, not the browser's mini bar

    const onSelect = vi.fn();
    renderMenu(onSelect);
    fireEvent.click(screen.getByRole('button', { name: BUTTON }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the prompt for the menu even when it fired long before the menu was opened', () => {
    act(() => {
      window.dispatchEvent(installEvent()); // fires at page load; the menu is opened minutes later
    });
    renderMenu();
    expect(screen.getByRole('button', { name: BUTTON })).toHaveAttribute('data-install-app', 'prompt');
  });

  it('shows the steps for an iPhone: Share, Add to Home Screen, Add', async () => {
    pretend(IPHONE_SAFARI);
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: BUTTON }));

    const dialog = await screen.findByRole('dialog', { name: /install onehealth/i });
    expect(dialog).toHaveTextContent('Share');
    expect(dialog).toHaveTextContent('Add to Home Screen');
    expect(dialog).toHaveTextContent('Tap Add');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('on Android before the browser offered its prompt, points to the browser menu and to "Open in Chrome" for links from other apps', async () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: BUTTON }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/three dots/i);
    expect(dialog).toHaveTextContent(/Open in Chrome/i);
  });

  it('in another browser, says to open the page in Chrome or Safari, with a link that opens Chrome and a way to copy the address', async () => {
    pretend(ANDROID_FIREFOX);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: BUTTON }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/cannot install OneHealth/i);
    expect(dialog).toHaveTextContent(/Chrome/);
    expect(dialog).toHaveTextContent(/Safari/);
    expect(screen.getByRole('link', { name: /open in chrome/i }).getAttribute('href')).toMatch(/^intent:\/\/.+package=com\.android\.chrome/);

    fireEvent.click(screen.getByRole('button', { name: /copy address/i }));
    expect(writeText).toHaveBeenCalledWith(window.location.origin);
    expect(await screen.findByRole('button', { name: /address copied/i })).toBeInTheDocument();
  });

  it('does not offer "Open in Chrome" on an iPhone browser that cannot install (Chrome is not what it needs there)', async () => {
    pretend('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.20.109 (iPhone15,2; iOS 18_0)');
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: BUTTON }));
    await screen.findByRole('dialog');
    expect(screen.queryByRole('link', { name: /open in chrome/i })).toBeNull();
  });

  it('closes with Got it and with Escape', async () => {
    pretend(IPHONE_SAFARI);
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: BUTTON }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: BUTTON }));
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('disappears when the app gets installed while the page is open', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: BUTTON })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('button', { name: BUTTON })).toBeNull();
  });
});
