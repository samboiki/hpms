import React from 'react';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { formatChange } from './financeFormat';

/**
 * Presentational building blocks for the Finance page, in the same visual language as
 * Patients and Communications (Communication Analytics cards, pills and summaries).
 */

export type Tone = 'cyan' | 'blue' | 'amber' | 'green' | 'red' | 'violet' | 'gray' | 'orange' | 'indigo';

const CHIP_TONES: Record<Tone, string> = {
  cyan: 'bg-cyan-100 text-cyan-600',
  blue: 'bg-blue-100 text-blue-600',
  amber: 'bg-amber-100 text-amber-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  violet: 'bg-violet-100 text-violet-600',
  gray: 'bg-gray-100 text-gray-600',
  orange: 'bg-orange-100 text-orange-600',
  indigo: 'bg-indigo-100 text-indigo-600'
};

const SOFT_TONES: Record<Tone, string> = {
  cyan: 'bg-cyan-50 border-cyan-200 text-cyan-900',
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  green: 'bg-green-50 border-green-200 text-green-900',
  red: 'bg-red-50 border-red-200 text-red-900',
  violet: 'bg-violet-50 border-violet-200 text-violet-900',
  gray: 'bg-gray-50 border-gray-200 text-gray-800',
  orange: 'bg-orange-50 border-orange-200 text-orange-900',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900'
};

export const IconChip: React.FC<{ icon: string; tone?: Tone; className?: string }> = ({ icon, tone = 'cyan', className = '' }) => (
  <div className={`p-2.5 rounded-lg flex-shrink-0 ${CHIP_TONES[tone]} ${className}`}>
    <Icon icon={icon} className="w-5 h-5" aria-hidden="true" />
  </div>
);

interface SectionCardProps {
  title: string;
  subtitle?: React.ReactNode;
  icon: string;
  tone?: Tone;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Card with the Communication Analytics header: icon chip, title, subtitle and actions */
export const SectionCard: React.FC<SectionCardProps> = ({ title, subtitle, icon, tone = 'cyan', actions, children, className = '', bodyClassName = '' }) => (
  <Card className={`bg-white border border-gray-200 shadow-sm ${className}`}>
    <CardHeader className="p-4 sm:px-6 pb-3 border-b border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <IconChip icon={icon} tone={tone} />
          <div className="min-w-0">
            {/* Wraps on phones rather than cutting the title off */}
            <CardTitle className="text-lg leading-snug font-semibold text-gray-900">{title}</CardTitle>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </CardHeader>
    <CardContent className={`p-4 sm:p-6 ${bodyClassName}`}>{children}</CardContent>
  </Card>
);

interface ChangeBadgeProps {
  percent: number | null;
  comparisonLabel: string;
  /** For costs a rise is bad */
  positiveIsGood?: boolean;
}

/** Change vs the comparison period: an arrow icon and sign carry the direction, not colour alone */
export const ChangeBadge: React.FC<ChangeBadgeProps> = ({ percent, comparisonLabel, positiveIsGood = true }) => {
  if (percent === null) {
    return <p className="text-xs text-gray-400 mt-2">Nothing to compare in {comparisonLabel}</p>;
  }
  const flat = Math.abs(percent) < 0.05;
  const good = flat ? null : (percent > 0) === positiveIsGood;
  const classes = good === null ? 'bg-gray-100 text-gray-600' : good ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
  const icon = flat ? 'solar:arrow-right-bold-duotone' : percent > 0 ? 'solar:arrow-right-up-bold-duotone' : 'solar:arrow-right-down-bold-duotone';
  return (
    <p className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
        <Icon icon={icon} className="w-3.5 h-3.5" aria-hidden="true" />
        {formatChange(percent)}
      </span>
      <span className="text-xs text-gray-500">vs {comparisonLabel}</span>
    </p>
  );
};

interface StatTileProps {
  label: string;
  value: string;
  icon: string;
  tone?: Tone;
  caption?: string;
  change?: ChangeBadgeProps;
  footnote?: React.ReactNode;
  onClick?: () => void;
}

/** KPI tile (same shape as the Finance KPI cards); clickable tiles drill into a tab */
export const StatTile: React.FC<StatTileProps> = ({ label, value, icon, tone = 'cyan', caption, change, footnote, onClick }) => {
  const body = (
    <>
      <div className="flex items-center justify-between mb-3">
        <IconChip icon={icon} tone={tone} className="p-2" />
        {caption && <span className="text-xs font-medium text-gray-500">{caption}</span>}
      </div>
      <p className="text-2xl font-bold text-gray-900 break-words">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {change && <ChangeBadge {...change} />}
      {footnote && <div className="text-xs text-gray-500 mt-2">{footnote}</div>}
    </>
  );
  const className = 'bg-white rounded-xl p-5 shadow-sm border border-gray-200 text-left w-full';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} hover:border-cyan-300 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500`}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
};

/** Small tinted tile (Communications "Total Services / Active / Success Rate" row) */
export const MiniStat: React.FC<{ icon: string; label: string; value: string; tone?: Tone }> = ({ icon, label, value, tone = 'cyan' }) => (
  <div className={`text-center p-3 rounded-lg border ${SOFT_TONES[tone]}`}>
    <Icon icon={icon} className="w-6 h-6 mx-auto mb-1 opacity-80" aria-hidden="true" />
    <p className="text-xs text-gray-600">{label}</p>
    <p className="text-lg font-bold text-gray-900">{value}</p>
  </div>
);

/** Highlighted summary line under a chart */
export const SummaryStrip: React.FC<{ children: React.ReactNode; tone?: Tone }> = ({ children, tone = 'cyan' }) => (
  <div className={`mt-4 p-3 rounded-lg border text-sm ${SOFT_TONES[tone]}`}>{children}</div>
);

interface NoticeProps {
  tone?: 'info' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

const NOTICE_STYLES = {
  info: { box: 'bg-blue-50 border-blue-200 text-blue-900', icon: 'solar:info-circle-bold-duotone', iconClass: 'text-blue-600' },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: 'solar:danger-triangle-bold-duotone', iconClass: 'text-amber-600' },
  error: { box: 'bg-red-50 border-red-200 text-red-900', icon: 'solar:danger-circle-bold-duotone', iconClass: 'text-red-600' }
};

export const Notice: React.FC<NoticeProps> = ({ tone = 'info', title, children, action }) => {
  const style = NOTICE_STYLES[tone];
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${style.box}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon icon={style.icon} className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.iconClass}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
      {action}
    </div>
  );
};

export const EmptyState: React.FC<{ icon: string; title: string; message?: React.ReactNode; action?: React.ReactNode; compact?: boolean }> = ({ icon, title, message, action, compact }) => (
  <div className={`text-center border border-dashed border-gray-200 rounded-xl ${compact ? 'py-8 px-4' : 'py-12 px-4'}`}>
    <Icon icon={icon} className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
    <p className="font-medium text-gray-800">{title}</p>
    {message && <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{ title: string; message: string; onRetry?: () => void }> = ({ title, message, onRetry }) => (
  <div className="text-center py-12 px-4" role="alert">
    <Icon icon="solar:danger-triangle-bold-duotone" className="w-12 h-12 text-red-400 mx-auto mb-3" aria-hidden="true" />
    <p className="font-medium text-gray-800 mb-1">{title}</p>
    <p className="text-sm text-gray-500 mb-4 max-w-lg mx-auto break-words">{message}</p>
    {onRetry && (
      <button type="button" onClick={onRetry} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium">
        Retry
      </button>
    )}
  </div>
);

/** Skeleton rows (as on Patients) for a first load */
export const LoadingState: React.FC<{ label: string; rows?: number }> = ({ label, rows = 4 }) => (
  <div className="space-y-3" role="status" aria-live="polite">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 animate-pulse">
        <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-100 rounded w-1/4" />
        </div>
        <div className="hidden md:block h-3 bg-gray-100 rounded w-24" />
      </div>
    ))}
    <span className="sr-only">{label}</span>
  </div>
);

/** Communications-style toggle pill (SMS / Email filters) */
export const FilterPill: React.FC<{ active: boolean; onClick: () => void; icon?: string; children: React.ReactNode; count?: number }> = ({ active, onClick, icon, children, count }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
      active ? 'text-cyan-700 bg-cyan-50 hover:bg-cyan-100 ring-1 ring-cyan-200' : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
    }`}
  >
    {icon && <Icon icon={icon} className="w-3.5 h-3.5" aria-hidden="true" />}
    {children}
    {count !== undefined && <span className="text-gray-400 font-normal">({count})</span>}
  </button>
);

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

/** Communication Analytics inner tab bar (white pill on gray track) */
export function SegmentedTabs<T extends string>({ value, onChange, options, ariaLabel }: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
}) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto" role="tablist" aria-label={ariaLabel}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 min-w-max flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
            value === option.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {option.icon && <Icon icon={option.icon} className="w-4 h-4" aria-hidden="true" />}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const ActionButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  title?: string;
}> = ({ icon, label, onClick, disabled, variant = 'secondary', title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title ?? label}
    className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
      variant === 'primary'
        ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-sm hover:shadow-md'
        : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
    }`}
  >
    <Icon icon={icon} className="w-4 h-4" aria-hidden="true" />
    <span>{label}</span>
  </button>
);

export const LegendItem: React.FC<{ color: string; label: string; value?: string; tint?: string }> = ({ color, label, value, tint = 'bg-gray-50' }) => (
  <div className={`flex items-center justify-between gap-2 p-2 rounded-lg ${tint}`}>
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="text-xs text-gray-700 truncate" title={label}>{label}</span>
    </div>
    {value && <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">{value}</span>}
  </div>
);

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

/** Tooltip card used by every Finance chart (Communication Analytics style) */
export const ChartTooltipCard: React.FC<{ title: string; rows: TooltipRow[] }> = ({ title, rows }) => (
  <div className="bg-white p-3 rounded-lg shadow-xl border border-cyan-200 min-w-[160px]">
    <p className="text-sm font-semibold text-gray-900 mb-2">{title}</p>
    <div className="space-y-1">
      {rows.map(row => (
        <p key={row.label} className="text-xs text-gray-600 flex items-center gap-2">
          {row.color && <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: row.color }} aria-hidden="true" />}
          <span>{row.label}:</span>
          <span className="font-medium text-gray-900 ml-auto pl-2">{row.value}</span>
        </p>
      ))}
    </div>
  </div>
);
