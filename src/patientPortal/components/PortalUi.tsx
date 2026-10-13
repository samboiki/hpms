import React from 'react';
import { Icon } from '@iconify/react';
import type { StatusTone } from '../portalModel';

const TONES: Record<StatusTone, string> = {
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-rose-50 text-rose-800 ring-rose-200',
  gray: 'bg-gray-100 text-gray-700 ring-gray-200',
};

export const StatusPill: React.FC<{ tone: StatusTone; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
    {children}
  </span>
);

export const PageTitle: React.FC<{ icon: string; title: string; subtitle?: string; action?: React.ReactNode }> = ({
  icon,
  title,
  subtitle,
  action,
}) => (
  <div className="flex items-start justify-between gap-3 mb-4">
    <div className="flex items-center gap-3 min-w-0">
      <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700 flex-shrink-0">
        <Icon icon={icon} className="w-6 h-6" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-2xl bg-white border border-gray-100 shadow-sm p-4 ${className}`}>{children}</div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-2">{children}</h2>
);

export const LoadingBlock: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-gray-500" role="status">
    <Icon icon="solar:refresh-circle-bold-duotone" className="w-6 h-6 animate-spin" aria-hidden="true" />
    <span className="text-sm">{label}</span>
  </div>
);

export const EmptyBlock: React.FC<{ icon: string; title: string; children?: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="text-center py-10 px-4">
    <Icon icon={icon} className="w-12 h-12 mx-auto text-gray-300" aria-hidden="true" />
    <p className="mt-3 font-medium text-gray-700">{title}</p>
    {children && <div className="mt-1 text-sm text-gray-500">{children}</div>}
  </div>
);

export const Notice: React.FC<{ tone?: 'info' | 'warning' | 'error' | 'success'; icon?: string; children: React.ReactNode }> = ({
  tone = 'info',
  icon,
  children,
}) => {
  const styles = {
    info: { box: 'bg-sky-50 text-sky-900', icon: 'solar:info-circle-bold-duotone' },
    warning: { box: 'bg-amber-50 text-amber-900', icon: 'solar:danger-triangle-bold-duotone' },
    error: { box: 'bg-rose-50 text-rose-900', icon: 'solar:danger-circle-bold-duotone' },
    success: { box: 'bg-emerald-50 text-emerald-900', icon: 'solar:check-circle-bold-duotone' },
  }[tone];
  return (
    <div className={`flex gap-3 rounded-xl p-4 text-sm ${styles.box}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon icon={icon ?? styles.icon} className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
};

export const ErrorBlock: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <Notice tone="error">
    <p>{message}</p>
    {onRetry && (
      <button type="button" onClick={onRetry} className="font-medium underline">
        Try again
      </button>
    )}
  </Notice>
);

export const NotEnabledBlock: React.FC = () => (
  <EmptyBlock icon="solar:hourglass-bold-duotone" title="Not switched on yet">
    This part of the patient app is not available yet. Please phone the practice.
  </EmptyBlock>
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: string; busy?: boolean };

export const PrimaryButton: React.FC<ButtonProps & { danger?: boolean }> = ({ icon, busy, danger = false, children, className = '', disabled, ...props }) => (
  <button
    type="button"
    {...props}
    disabled={disabled || busy}
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white disabled:opacity-60 ${
      danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-cyan-600 hover:bg-cyan-700'
    } ${className}`}
  >
    {(busy || icon) && (
      <Icon icon={busy ? 'solar:refresh-circle-bold-duotone' : (icon as string)} className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
    )}
    {children}
  </button>
);

export const SecondaryButton: React.FC<ButtonProps> = ({ icon, busy, children, className = '', disabled, ...props }) => (
  <button
    type="button"
    {...props}
    disabled={disabled || busy}
    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60 ${className}`}
  >
    {(busy || icon) && (
      <Icon icon={busy ? 'solar:refresh-circle-bold-duotone' : (icon as string)} className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
    )}
    {children}
  </button>
);

/** A label and value row (details lists). */
export const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0 text-sm">
    <span className="text-gray-500">{label}</span>
    <span className="text-gray-900 text-right break-words min-w-0">{value}</span>
  </div>
);
