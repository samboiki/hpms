import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import type { PeriodRanges, PeriodSelection } from '../../services/ledgerService';
import { PeriodSelector } from './PeriodSelector';
import { formatTimestamp } from './financeFormat';

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face';

interface FinanceHeaderProps {
  period: PeriodSelection;
  ranges: PeriodRanges;
  onPeriodChange: (selection: PeriodSelection) => void;
  /** The period does not apply to the Batches tab */
  showPeriod: boolean;
  loadedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

/** Page header in the Communications / Patients style: icon, title, period, refresh, profile */
export const FinanceHeader: React.FC<FinanceHeaderProps> = ({ period, ranges, onPeriodChange, showPeriod, loadedAt, refreshing, onRefresh }) => {
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const anchor = avatarRef.current?.getBoundingClientRect();

  // Below lg the menu button lives in the app bar (Layout), so the title block can use the full width
  return (
    <div className="py-1 md:py-2">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex-none p-2.5 md:p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg">
            <Icon icon="solar:wallet-money-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-800">Finance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Billing, collections, ledgers and medical aid claims</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {showPeriod && <PeriodSelector value={period} ranges={ranges} onChange={onPeriodChange} />}
          {showPeriod && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              title={loadedAt ? `Last updated ${formatTimestamp(loadedAt)}` : 'Refresh'}
              className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-cyan-300 transition-colors disabled:opacity-60"
            >
              <Icon icon="solar:refresh-bold-duotone" className={`w-4 h-4 text-cyan-600 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">{refreshing ? 'Updating...' : 'Refresh'}</span>
            </button>
          )}

          {user && (
            <div className="relative hidden lg:block">
              <button ref={avatarRef} type="button" onClick={() => setMenuOpen(!menuOpen)} className="relative group focus:outline-none" aria-label="Open profile menu">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
                <div className="absolute -inset-1 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full opacity-50" />
                <div className="relative h-16 w-16 rounded-full overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                  <img
                    src={user.avatar || FALLBACK_AVATAR}
                    alt={user.name}
                    className="h-full w-full object-cover"
                    onError={event => { event.currentTarget.src = FALLBACK_AVATAR; }}
                  />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {menuOpen && user && createPortal(
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998]" onClick={() => setMenuOpen(false)} />
          <div
            style={{
              position: 'fixed',
              top: anchor ? anchor.bottom + 16 : 80,
              right: anchor ? window.innerWidth - anchor.right : 24,
              zIndex: 99999
            }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-[320px]"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">User Profile</h3>
              <button type="button" onClick={() => setMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close profile menu">
                <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" aria-hidden="true" />
              </button>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6">
              <p className="text-base font-semibold text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500 break-words">{user.email}</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white mt-1">
                {user.role}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void logout();
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Icon icon="solar:logout-3-bold-duotone" className="w-5 h-5" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
