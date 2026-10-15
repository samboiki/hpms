import React from 'react';
import { Icon } from '@iconify/react';
import { currentInstallOffer, openInstallHelp, promptInstall, useInstallApp } from './installApp';

interface InstallAppMenuItemProps {
  /** The look of the menu this sits in (each profile menu styles its own buttons) */
  className: string;
  iconClassName?: string;
  /** Called first: the menu closes, so the browser's prompt or the steps show over the page */
  onSelect?: () => void;
}

/**
 * "Install app" in a profile menu (owner, 15 Oct 2026). On a phone or tablet it installs OneHealth like any other app:
 * one tap on Android (the browser's own prompt), short steps on an iPhone or iPad, and a plain explanation in browsers
 * that cannot. Not shown on a computer, nor once the app is installed (installPrompt.ts decides).
 */
const InstallAppMenuItem: React.FC<InstallAppMenuItemProps> = ({ className, iconClassName = 'h-5 w-5', onSelect }) => {
  useInstallApp(); // shows or hides again when the browser's install prompt arrives, or the app gets installed
  const offer = currentInstallOffer();
  if (!offer) return null;
  return (
    <button
      type="button"
      data-install-app={offer}
      onClick={() => {
        onSelect?.();
        if (offer === 'prompt') void promptInstall();
        else openInstallHelp();
      }}
      className={className}
    >
      <Icon icon="solar:download-square-bold-duotone" className={iconClassName} aria-hidden="true" />
      Install app
    </button>
  );
};

export default InstallAppMenuItem;
