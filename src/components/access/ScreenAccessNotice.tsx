/**
 * What the Finance or Stock route shows instead of the screen: "Ask your practice administrator" when the practice
 * has not given this person's role access (Settings > Users > Screen access), a spinner while that choice is read,
 * and "Try again" when it could not be read. Links into Finance and Stock from other screens (an invoice on a
 * patient's Billing tab, a claim batch, a stock item) land here too, so they explain instead of breaking.
 */
import React, { useId } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { PageHeader, PageShell } from '../layout/PageHeader';
// The app's action colour (cyan) for buttons, shared with the stock and optometry screens
import { PRIMARY, SECONDARY } from '../stock/stockUi';
import { screenDetails, type GuardedScreen, type ScreenGate } from '../../utils/auth/screenAccess';

/** A page that follows a screen's access without being one (the Optometry page follows Stock): its own header */
export interface FollowingPage {
  label: string;
  icon: string;
  subtitle: string;
}

interface ScreenAccessNoticeProps {
  screen: GuardedScreen;
  gate: Exclude<ScreenGate, 'open'>;
  onRetry: () => void;
  /** Shown instead of the screen's own name and header, with a line saying whose access the page follows */
  page?: FollowingPage;
}

export const ScreenAccessNotice: React.FC<ScreenAccessNoticeProps> = ({ screen, gate, onRetry, page }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const headingId = useId();
  const { label: screenLabel, icon, holds } = screenDetails(screen);
  const label = page?.label ?? screenLabel;

  if (gate === 'checking') {
    return (
      <div role="status" className="flex min-h-[60vh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600 motion-reduce:animate-none" aria-hidden="true" />
        <span className="sr-only">Checking who can open {label}...</span>
      </div>
    );
  }

  const closed = gate === 'closed';
  // An address typed in, or opened in a new tab, has no screen in the app to go back to
  const canGoBack = closed && location.key !== 'default';

  return (
    <PageShell>
      {page
        ? <PageHeader icon={page.icon} title={page.label} subtitle={page.subtitle} />
        : <PageHeader section={screen} icon={icon} title={label} subtitle={`${holds.charAt(0).toUpperCase()}${holds.slice(1)}.`} />}
      <section aria-labelledby={headingId} className="flex justify-center py-6 md:py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
            <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="h-7 w-7 text-gray-500" aria-hidden="true" />
          </div>
          <h2 id={headingId} className="mt-4 text-lg font-semibold text-gray-900">
            {closed ? `Ask your practice administrator for access to ${label}` : `Could not check your access to ${label}`}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {closed
              ? page
                ? `The ${page.label} page opens for the roles that open ${screenLabel}. An administrator can give your role access to ${screenLabel} in Settings > Users > Screen access.`
                : `Your practice chooses which roles open ${label}. An administrator can give your role access in Settings > Users > Screen access.`
              : 'Check the connection and try again.'}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {!closed && (
              <button type="button" onClick={onRetry} className={PRIMARY}>
                Try again
              </button>
            )}
            {canGoBack && (
              <button type="button" onClick={() => navigate(-1)} className={PRIMARY}>
                Go back
              </button>
            )}
            <button type="button" onClick={() => navigate('/')} className={closed && !canGoBack ? PRIMARY : SECONDARY}>
              Open the dashboard
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  );
};

export default ScreenAccessNotice;
