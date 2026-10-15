import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { APP_COLOR } from '../config/sectionColors';
import { closeInstallHelp, currentInstallOffer, useInstallApp } from './installApp';
import { chromeIntentUrl } from './installPrompt';

/** A numbered ring around the button or row a step points at */
const Hint: React.FC<{ number: number; children: React.ReactNode }> = ({ number, children }) => (
  <span className="relative flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-purple-50 text-purple-600 ring-2 ring-purple-500">
    {children}
    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[0.65rem] font-bold text-white">{number}</span>
  </span>
);

const Step: React.FC<{ number: number; children: React.ReactNode }> = ({ number, children }) => (
  <li className="flex gap-3">
    <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gradient-to-br ${APP_COLOR.from} ${APP_COLOR.to} text-xs font-bold text-white`} aria-hidden="true">
      {number}
    </span>
    <span>{children}</span>
  </li>
);

const PICTURE = 'mt-4 space-y-2 rounded-xl bg-gray-50 p-3';
const BAR = 'flex items-center justify-between rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200';

/** A small picture of the iPhone's browser bar and the Share sheet's row, with the two buttons ringed */
const IosPicture: React.FC = () => (
  <div className={PICTURE} aria-hidden="true">
    <div className={`${BAR} text-gray-400`}>
      <Icon icon="solar:alt-arrow-left-bold-duotone" className="h-6 w-6" />
      <Icon icon="solar:alt-arrow-right-bold-duotone" className="h-6 w-6" />
      <Hint number={1}>
        <Icon icon="solar:upload-square-bold-duotone" className="h-6 w-6" />
      </Hint>
      <Icon icon="solar:book-bookmark-bold-duotone" className="h-6 w-6" />
      <Icon icon="solar:documents-bold-duotone" className="h-6 w-6" />
    </div>
    <div className={`${BAR} py-2.5 text-sm text-gray-800`}>
      <span>Add to Home Screen</span>
      <Hint number={2}>
        <Icon icon="solar:add-square-bold-duotone" className="h-6 w-6" />
      </Hint>
    </div>
  </div>
);

/** A small picture of an Android browser's address bar with its three dots, and the menu's Install app row */
const MenuPicture: React.FC = () => (
  <div className={PICTURE} aria-hidden="true">
    <div className={BAR}>
      <span className="truncate text-sm text-gray-500">{window.location.host}</span>
      <Hint number={1}>
        <Icon icon="solar:menu-dots-bold-duotone" className="h-6 w-6 rotate-90" />
      </Hint>
    </div>
    <div className={`${BAR} py-2.5 text-sm text-gray-800`}>
      <span>Install app</span>
      <Hint number={2}>
        <Icon icon="solar:download-square-bold-duotone" className="h-6 w-6" />
      </Hint>
    </div>
  </div>
);

/**
 * The steps for installing OneHealth where the browser has no one-tap install (opened from "Install app" in the profile
 * menu): an iPhone or iPad (Share, then Add to Home Screen), Android before the browser offered its prompt, and other
 * browsers, which are told to open the page in Chrome or Safari. Words are plain; the picture is Solar icons only.
 */
const InstallAppDialog: React.FC = () => {
  const { helpOpen } = useInstallApp();
  const offer = helpOpen ? currentInstallOffer() : null;
  const showing = offer !== null && offer !== 'prompt';
  const titleId = useId();
  const doneRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Installed in the meantime, or the browser's own prompt arrived: the steps are no longer needed
    if (helpOpen && !showing) closeInstallHelp();
  }, [helpOpen, showing]);

  useEffect(() => {
    if (!showing) return;
    doneRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeInstallHelp();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showing]);

  if (!showing) return null;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const onAndroid = /Android/.test(navigator.userAgent);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[99998] bg-black/20 backdrop-blur-sm" onClick={closeInstallHelp} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 z-[99999] max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Icon icon="solar:smartphone-bold-duotone" className="h-6 w-6 text-purple-600" aria-hidden="true" />
            Install OneHealth
          </h2>
          <button type="button" onClick={closeInstallHelp} className="rounded-full p-2 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400" aria-label="Close">
            <Icon icon="solar:close-circle-bold-duotone" className="h-5 w-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        {offer === 'ios-steps' && (
          <>
            <p className="text-sm text-gray-600">Then OneHealth opens full screen from your home screen, like any other app.</p>
            <IosPicture />
            <ol className="mt-4 space-y-3 text-sm text-gray-700">
              <Step number={1}>
                Tap the <strong>Share</strong> button in your browser&apos;s bar (the square with an arrow pointing up). On an iPad it is at the top of the screen.
              </Step>
              <Step number={2}>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </Step>
              <Step number={3}>
                Tap <strong>Add</strong>.
              </Step>
            </ol>
            <p className="mt-3 text-xs text-gray-500">Do not see Add to Home Screen? Open this page in Safari.</p>
          </>
        )}

        {offer === 'browser-menu' && (
          <>
            <p className="text-sm text-gray-700">
              Open your browser&apos;s menu (the three dots), then tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </p>
            <MenuPicture />
            <p className="mt-3 text-xs text-gray-500">
              Opened from WhatsApp or another app? Tap the three dots, then <strong>Open in Chrome</strong> (or Open in browser), and do this there.
            </p>
          </>
        )}

        {offer === 'open-elsewhere' && (
          <>
            <p className="text-sm text-gray-700">
              This browser cannot install OneHealth. Open this page in <strong>Chrome</strong> on Android, or <strong>Safari</strong> on an iPhone or iPad, then choose <strong>Install app</strong> from your profile menu.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {onAndroid && (
                <a
                  href={chromeIntentUrl(window.location)}
                  className="inline-flex min-h-[2.5rem] items-center gap-2 rounded-xl bg-purple-50 px-4 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                >
                  <Icon icon="solar:global-bold-duotone" className="h-5 w-5" aria-hidden="true" />
                  Open in Chrome
                </a>
              )}
              <button
                type="button"
                onClick={copyAddress}
                className="inline-flex min-h-[2.5rem] items-center gap-2 rounded-xl bg-gray-100 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                <Icon icon={copied ? 'solar:check-circle-bold-duotone' : 'solar:link-round-bold-duotone'} className="h-5 w-5" aria-hidden="true" />
                {copied ? 'Address copied' : 'Copy address'}
              </button>
            </div>
          </>
        )}

        <button
          ref={doneRef}
          type="button"
          onClick={closeInstallHelp}
          className={`mt-5 w-full rounded-xl bg-gradient-to-r px-4 py-3 font-semibold text-white shadow-lg transition-shadow hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 ${APP_COLOR.from} ${APP_COLOR.to}`}
        >
          Got it
        </button>
      </div>
    </>,
    document.body
  );
};

export default InstallAppDialog;
