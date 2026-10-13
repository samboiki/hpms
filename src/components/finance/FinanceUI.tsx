import React from 'react';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { StatTile as Tile } from '../ui/StatTile';
import { ICON_TONES, type TileTone } from '../ui/tileTones';
import { formatChange } from './financeFormat';

/**
 * Presentational building blocks for the Finance page, in the same visual language as
 * Patients and Communications (Communication Analytics cards, pills and summaries).
 */

export type Tone = TileTone;

const SOFT_TONES: Record<Tone, string> = {
  cyan: 'bg-cyan-50 border-cyan-200 text-cyan-900',
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  green: 'bg-green-50 border-green-200 text-green-900',
  red: 'bg-red-50 border-red-200 text-red-900',
  violet: 'bg-violet-50 border-violet-200 text-violet-900',
  gray: 'bg-gray-50 border-gray-200 text-gray-800',
  orange: 'bg-orange-50 border-orange-200 text-orange-900',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
  slate: 'bg-slate-50 border-slate-200 text-slate-900'
};

export const IconChip: React.FC<{ icon: string; tone?: Tone; className?: string }> = ({ icon, tone = 'cyan', className = '' }) => (
  <div className={`p-2.5 rounded-lg flex-shrink-0 ${ICON_TONES[tone]} ${className}`}>
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
    return <p className="text-xs text-gray-400">Nothing to compare in {comparisonLabel}</p>;
  }
  const flat = Math.abs(percent) < 0.05;
  const good = flat ? null : (percent > 0) === positiveIsGood;
  const classes = good === null ? 'bg-gray-100 text-gray-600' : good ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
  const icon = flat ? 'solar:arrow-right-bold-duotone' : percent > 0 ? 'solar:arrow-right-up-bold-duotone' : 'solar:arrow-right-down-bold-duotone';
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums ${classes}`}>
        <Icon icon={icon} className="w-3.5 h-3.5" aria-hidden="true" />
        {formatChange(percent)}
      </span>
      <span className="text-gray-500">vs {comparisonLabel}</span>
    </p>
  );
};

/**
 * Gradient pairs of the Dashboard's number cards (dashboard/PremiumStatCard.tsx). The owner asked (13 October 2026)
 * for Finance's number cards to follow those cards: same glass tint, gradient icon tile, bold figure, small trend
 * and two little bars, at the Dashboard's size.
 */
const TONE_GRADIENTS: Record<Tone, string> = {
  cyan: 'from-cyan-500 to-blue-500',
  blue: 'from-blue-500 to-indigo-600',
  green: 'from-emerald-500 to-teal-600',
  amber: 'from-amber-500 to-orange-500',
  orange: 'from-amber-500 to-red-500',
  red: 'from-red-500 to-rose-600',
  violet: 'from-violet-500 to-purple-600',
  indigo: 'from-indigo-500 to-purple-600',
  gray: 'from-gray-400 to-gray-500',
  slate: 'from-slate-500 to-slate-700'
};

const RUBIK: React.CSSProperties = { fontFamily: 'Rubik, sans-serif' };
const GOOD_BAR = '#10B981';
const BAD_BAR = '#EF4444';

/** The Dashboard's figure size; long amounts step down so a row of four (or five dense cards) never cuts one off */
export function figureSize(value: string, dense?: boolean): string {
  const length = value.length;
  if (dense) return length <= 12 ? 'text-lg' : length <= 14 ? 'text-base' : 'text-sm';
  return length <= 13 ? 'text-2xl' : length <= 15 ? 'text-xl' : 'text-lg';
}

/** Change vs the comparison period in the Dashboard's trend style: a dot and an arrow, then the comparison */
const Trend: React.FC<ChangeBadgeProps & { dense?: boolean }> = ({ percent, comparisonLabel, positiveIsGood = true, dense }) => {
  if (percent === null) {
    return <div className="mt-1 text-xs font-light text-gray-500" style={RUBIK}>Nothing to compare in {comparisonLabel}</div>;
  }
  const flat = Math.abs(percent) < 0.05;
  const good = flat ? null : (percent > 0) === positiveIsGood;
  const dot = good === null ? 'bg-gray-400' : good ? 'bg-emerald-500' : 'bg-red-500';
  const arrowColour = good === null ? 'text-gray-500' : good ? 'text-emerald-600' : 'text-red-600';
  return (
    <div className="mt-1 [@container(min-width:19rem)]:text-right" style={RUBIK}>
      <div className="flex items-center gap-1.5 [@container(min-width:19rem)]:justify-end">
        <span className={`h-1.5 w-1.5 flex-none rounded-full ${dot}`} aria-hidden="true" />
        <span className="whitespace-nowrap text-xs font-medium tabular-nums">
          <span className={arrowColour} aria-hidden="true">{flat ? '→' : percent > 0 ? '↗' : '↘'}</span>
          <span className="ml-1 text-gray-700">{formatChange(percent)}</span>
        </span>
      </div>
      {!dense && <div className="mt-0.5 text-xs font-light text-[#4f575e]">vs {comparisonLabel}</div>}
    </div>
  );
};

/** Two parts of a whole, e.g. what was collected and what is unpaid, as the Dashboard draws them: two small bars */
export interface StatMeter {
  /** The part named first, 0..1 */
  share: number | null;
  label: string;
  /** What the rest is called */
  rest: string;
  /** Whether a bigger first part is good (collected) or bad (past due), for the colours */
  shareIsGood: boolean;
}

const MeterBars: React.FC<StatMeter> = ({ share, label, rest, shareIsGood }) => {
  if (share === null || !Number.isFinite(share)) return null;
  const first = Math.round(Math.min(1, Math.max(0, share)) * 100);
  const second = 100 - first;
  const bars = [
    { value: first, colour: shareIsGood ? GOOD_BAR : BAD_BAR },
    { value: second, colour: shareIsGood ? BAD_BAR : GOOD_BAR }
  ];
  return (
    <div className="flex flex-wrap items-end gap-x-1 gap-y-0.5 tabular-nums" style={RUBIK}>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <span className="text-xs font-bold text-gray-700">{first}%</span>
      <span className="flex h-6 items-end gap-0.5" aria-hidden="true">
        {bars.map((bar, index) => (
          <span key={index} className="block w-1 overflow-hidden rounded-full bg-gray-200" style={{ height: `${Math.max(8, bar.value * 0.25)}px` }}>
            <span className="block h-full w-full rounded-full" style={{ backgroundColor: bar.colour }} />
          </span>
        ))}
      </span>
      <span className="text-xs font-bold text-gray-700">{second}%</span>
      <span className="text-xs font-medium text-gray-600">{rest}</span>
    </div>
  );
};

/** The Dashboard card's glass tint and its fine marks, in the card's own colour */
const CardGlass: React.FC<{ gradient: string; dense?: boolean }> = ({ gradient, dense }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.15] transition-opacity duration-300 group-hover:opacity-[0.2]`} />
    <div className="absolute inset-0 bg-gradient-to-tl from-gray-50/40 via-transparent to-gray-100/30 opacity-60" />
    {!dense && (
      <>
        <div className={`absolute right-3 top-2 h-0.5 w-12 rounded-full bg-gradient-to-r ${gradient} opacity-[0.3]`} />
        <div className={`absolute right-5 top-4 h-0.5 w-8 rounded-full bg-gradient-to-r ${gradient} opacity-[0.2]`} />
        <div className={`absolute right-1 top-3 h-2 w-2 rounded-full bg-gradient-to-r ${gradient} opacity-[0.25]`} />
        <div className={`absolute right-8 top-5 h-1 w-1 rounded-full bg-gradient-to-r ${gradient} opacity-[0.4]`} />
        <div className={`absolute bottom-2 left-2 h-8 w-0.5 rounded-full bg-gradient-to-b ${gradient} opacity-[0.2]`} />
        <div className={`absolute bottom-4 left-4 h-6 w-0.5 rounded-full bg-gradient-to-b ${gradient} opacity-[0.15]`} />
        <div className={`absolute bottom-6 left-3 h-4 w-0.5 rounded-full bg-gradient-to-b ${gradient} opacity-[0.25]`} />
        <div className={`absolute left-1/3 top-8 h-1.5 w-1.5 rotate-45 rounded-full bg-gradient-to-r ${gradient} opacity-[0.2]`} />
        <div className={`absolute bottom-8 right-1/3 h-1 w-1 rounded-full bg-gradient-to-r ${gradient} opacity-[0.3]`} />
      </>
    )}
    <div className="absolute left-0 right-0 top-0 h-8 rounded-t-xl bg-gradient-to-b from-white/30 to-transparent opacity-60" />
    {!dense && (
      <div
        className={`absolute bottom-0 left-1/2 h-3 w-16 -translate-x-1/2 bg-gradient-to-t ${gradient} opacity-[0.3] transition-opacity duration-300 group-hover:opacity-[0.5]`}
        style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 100%, 0% 100%)' }}
      />
    )}
    <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-xl bg-gradient-to-r ${gradient} opacity-[0.25] transition-opacity duration-300 group-hover:opacity-[0.4]`} />
    <div className="absolute inset-0 rounded-xl border border-gray-300/50 transition-colors duration-300 group-hover:border-gray-400/60" />
  </div>
);

interface StatTileProps {
  label: string;
  value: string;
  icon: string;
  tone?: Tone;
  /** A short line under the title, e.g. "33 invoices" or "As at 12 Oct 2026" */
  caption?: string;
  change?: ChangeBadgeProps;
  footnote?: React.ReactNode;
  /** Two parts of the figure, e.g. collected and unpaid, drawn as the Dashboard's two small bars */
  meter?: StatMeter | null;
  /** Five cards to a row (Invoicing): a smaller card so the amounts still fit */
  dense?: boolean;
  /** Opens what the card counts, or (with pressed) filters the list below to it */
  onClick?: () => void;
  /** A card that filters a list: true while its filter is in force */
  pressed?: boolean;
}

/**
 * Finance's number card, in the style of the Dashboard's number cards (the owner, 13 October 2026: "follow
 * something similar... clean, premium, professional"): the icon tile and title on the left, the bold figure on the
 * right once the card is wide enough (under the title on a narrower card), the trend under the figure and the two
 * small bars at the bottom. A negative amount is red. The figure keeps one piece, so it reads whole aloud.
 */
export const StatTile: React.FC<StatTileProps> = ({ label, value, icon, tone = 'cyan', caption, change, footnote, meter, dense, onClick, pressed }) => {
  const gradient = TONE_GRADIENTS[tone];
  const negative = value.trim().startsWith('-');
  const footnoteUnderFigure = !change && footnote;
  const showMeter = meter && meter.share !== null && Number.isFinite(meter.share);
  const card = (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-200/50 bg-gray-100 text-left shadow-lg transition-all duration-300 group-hover:shadow-xl [container-type:inline-size] ${
        dense ? 'min-h-[7rem] p-3' : 'min-h-[9rem] p-4 sm:p-5'
      }`}
    >
      <CardGlass gradient={gradient} dense={dense} />
      <div className="relative z-10 flex flex-col gap-2 [@container(min-width:19rem)]:flex-row [@container(min-width:19rem)]:items-start [@container(min-width:19rem)]:justify-between [@container(min-width:19rem)]:gap-3">
        <div className="flex min-w-0 items-center gap-3 [@container(min-width:19rem)]:flex-1">
          <div className={`flex-none rounded-xl bg-gradient-to-br ${gradient} shadow-md transition-all duration-300 group-hover:shadow-lg ${dense ? 'p-2' : 'p-2.5'}`}>
            <Icon icon={icon} className={`${dense ? 'h-4 w-4' : 'h-5 w-5'} text-white`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className={`font-semibold leading-tight text-gray-800 ${dense ? 'text-sm' : 'text-base'}`} style={RUBIK}>{label}</h3>
            {caption && <p className="mt-0.5 text-xs text-gray-500" style={RUBIK}>{caption}</p>}
          </div>
        </div>
        <div className="min-w-0 [@container(min-width:19rem)]:flex-none [@container(min-width:19rem)]:text-right">
          <div className={`whitespace-nowrap font-bold leading-tight tabular-nums ${negative ? 'text-red-600' : 'text-gray-800'} ${figureSize(value, dense)}`} style={RUBIK}>
            {value}
          </div>
          {footnoteUnderFigure && <div className="mt-0.5 text-xs font-light text-[#4f575e]" style={RUBIK}>{footnote}</div>}
          {change && <Trend {...change} dense={dense} />}
        </div>
      </div>
      {(showMeter || (change && footnote)) && (
        <div className="relative z-20 mt-auto space-y-1 pt-3">
          {showMeter && meter && <MeterBars {...meter} />}
          {change && footnote && <div className="text-xs text-gray-600" style={RUBIK}>{footnote}</div>}
        </div>
      )}
    </div>
  );
  if (!onClick) return <div className="group h-full">{card}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`group block h-full w-full rounded-xl text-left transition-transform duration-300 motion-safe:hover:-translate-y-px motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 ${
        pressed ? 'ring-2 ring-cyan-500 ring-offset-2' : ''
      }`}
    >
      {card}
    </button>
  );
};

/** Small tinted tile (Communications "Total Services / Active / Success Rate" row): the shared StatTile, compact */
export const MiniStat: React.FC<{ icon: string; label: string; value: string; tone?: Tone }> = ({ icon, label, value, tone = 'cyan' }) => (
  <Tile compact icon={icon} label={label} value={value} tone={tone} />
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
