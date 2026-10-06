import React from 'react';
import { Icon } from '@iconify/react';
import { formatNamibianDollars } from './patientBilling';

export interface OverviewVisitLink {
  id: string;
  /** Main line, e.g. "12 Sep 2026" or "Tue 14 Oct 2026, 09:30" */
  label: string;
  /** Second line, e.g. "Consultation · Dr. Hilma Amalwa" */
  detail?: string;
}

export interface OverviewBalance {
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  amount: number;
  unpaidCount: number;
  overdueCount: number;
}

interface PatientOverviewLinksProps {
  latestVisit: OverviewVisitLink | null;
  upcomingVisit: OverviewVisitLink | null;
  pendingLabCount: number;
  balance: OverviewBalance;
  onOpenVisit: (visitId: string) => void;
  onOpenBilling: () => void;
  onOpenLab: () => void;
  onRetryBalance: () => void;
}

interface TileProps {
  icon: string;
  iconClassName: string;
  title: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  actionLabel?: string;
  onClick?: () => void;
  /** Accessible name of the clickable tile */
  ariaLabel: string;
}

const Tile: React.FC<TileProps> = ({ icon, iconClassName, title, value, detail, actionLabel, onClick, ariaLabel }) => {
  const body = (
    <>
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${iconClassName}`}>
          <Icon icon={icon} className="w-4 h-4" aria-hidden="true" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</span>
      </div>
      <div className="mt-2 text-base font-semibold text-gray-900">{value}</div>
      {detail && <div className="mt-0.5 text-sm text-gray-600 line-clamp-2">{detail}</div>}
      {actionLabel && (
        <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-700">
          {actionLabel}
          <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" aria-hidden="true" />
        </div>
      )}
    </>
  );

  const baseClass = 'text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm';
  if (!onClick) {
    return <div className={baseClass}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${baseClass} transition-all hover:border-purple-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500`}
    >
      {body}
    </button>
  );
};

/** Overview shortcuts: latest visit, money owed, pending labs and the next appointment. */
const PatientOverviewLinks: React.FC<PatientOverviewLinksProps> = ({
  latestVisit,
  upcomingVisit,
  pendingLabCount,
  balance,
  onOpenVisit,
  onOpenBilling,
  onOpenLab,
  onRetryBalance
}) => {
  const balanceTile = (() => {
    if (!balance.hasLoaded && balance.error) {
      return {
        value: 'Could not load',
        detail: 'Click to try again',
        actionLabel: 'Retry',
        onClick: onRetryBalance,
        ariaLabel: 'Balance could not be loaded. Retry'
      };
    }
    if (!balance.hasLoaded) {
      return {
        value: (
          <span className="inline-flex items-center gap-2 text-gray-500">
            <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 animate-spin" aria-hidden="true" />
            Loading...
          </span>
        ),
        detail: undefined,
        actionLabel: 'View billing',
        onClick: onOpenBilling,
        ariaLabel: 'Balance is loading. View billing'
      };
    }
    const amount = formatNamibianDollars(balance.amount);
    return {
      value: balance.amount > 0 ? <span className="text-amber-700">{amount}</span> : 'Nothing owed',
      detail:
        balance.amount > 0
          ? `${balance.unpaidCount} unpaid ${balance.unpaidCount === 1 ? 'invoice' : 'invoices'}${
              balance.overdueCount > 0 ? `, ${balance.overdueCount} overdue` : ''
            }`
          : 'All invoices settled',
      actionLabel: 'View billing',
      onClick: onOpenBilling,
      ariaLabel: balance.amount > 0 ? `Balance due ${amount}. View billing` : 'Nothing owed. View billing'
    };
  })();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Tile
        icon="solar:stethoscope-bold-duotone"
        iconClassName="bg-purple-100 text-purple-600"
        title="Latest visit"
        value={latestVisit ? latestVisit.label : 'No visits yet'}
        detail={latestVisit?.detail}
        actionLabel={latestVisit ? 'Open visit' : undefined}
        onClick={latestVisit ? () => onOpenVisit(latestVisit.id) : undefined}
        ariaLabel={latestVisit ? `Latest visit ${latestVisit.label}. Open visit` : 'No visits yet'}
      />
      <Tile
        icon="solar:wallet-money-bold-duotone"
        iconClassName="bg-amber-100 text-amber-600"
        title="Balance due"
        value={balanceTile.value}
        detail={balanceTile.detail}
        actionLabel={balanceTile.actionLabel}
        onClick={balanceTile.onClick}
        ariaLabel={balanceTile.ariaLabel}
      />
      <Tile
        icon="solar:test-tube-bold-duotone"
        iconClassName="bg-emerald-100 text-emerald-600"
        title="Pending lab requests"
        value={pendingLabCount}
        detail={pendingLabCount > 0 ? 'Awaiting results' : 'None pending'}
        actionLabel="View laboratory"
        onClick={onOpenLab}
        ariaLabel={`${pendingLabCount} pending lab requests. View laboratory`}
      />
      <Tile
        icon="solar:calendar-bold-duotone"
        iconClassName="bg-blue-100 text-blue-600"
        title="Next appointment"
        value={upcomingVisit ? upcomingVisit.label : 'None booked'}
        detail={upcomingVisit?.detail}
        actionLabel={upcomingVisit ? 'Open appointment' : undefined}
        onClick={upcomingVisit ? () => onOpenVisit(upcomingVisit.id) : undefined}
        ariaLabel={upcomingVisit ? `Next appointment ${upcomingVisit.label}. Open appointment` : 'No upcoming appointment'}
      />
    </div>
  );
};

export default PatientOverviewLinks;
