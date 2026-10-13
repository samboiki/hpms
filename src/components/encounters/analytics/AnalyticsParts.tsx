import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { formatCount } from '../../finance/financeFormat';
import { visitsText } from './analyticsPalette';

/**
 * The building blocks of Encounters > Analytics, in the page's own look (release 645b348): white bordered cards with
 * a gradient icon box, the Quick Stats tiles and the grey loading, error and empty states. The chart palette is in
 * analyticsPalette.ts.
 */

/** A card of the analytics: a gradient icon box and title in a light header, the content below */
export const DashboardSection: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
  iconColor?: string;
  actions?: React.ReactNode;
}> = ({ title, icon, children, iconColor = 'from-cyan-500 to-blue-500', actions }) => (
  <Card className="shadow-sm border-gray-200 overflow-hidden">
    <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 bg-gradient-to-br ${iconColor} rounded-lg shadow-sm`}>
            <Icon icon={icon} className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
        </div>
        {actions}
      </div>
    </CardHeader>
    <CardContent className="p-6">{children}</CardContent>
  </Card>
);

/** The charts' tooltip: the label, then each series with its colour */
export const RichTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number | string; color: string }>; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-xl border border-gray-200"
    >
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-sm text-gray-600">{entry.name}:</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </motion.div>
  );
};

/** A column's heading: "Quick Stats", "Filters" */
export const ColumnHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">{children}</h3>
);

export interface QuickStat {
  label: string;
  count: number;
  /** Solar bold-duotone icon and its colour, e.g. "text-cyan-500" */
  icon: string;
  iconColor: string;
  /** Small text top right, e.g. the period "30D" */
  caption?: string;
  /** Says more on hover, e.g. what "Not marked" means */
  hint?: string;
  /** Opens the visits it counts; a tile with none has nothing to open */
  onOpen?: () => void;
}

/** A Quick Stats tile: icon and caption, the figure, its name. A tile with visits opens them. */
export const QuickStatTile: React.FC<QuickStat> = ({ label, count, icon, iconColor, caption, hint, onOpen }) => {
  const body = (
    <>
      <span className="flex items-center justify-between mb-2">
        <Icon icon={icon} className={`w-6 h-6 ${iconColor}`} aria-hidden="true" />
        {caption && <span className="text-xs text-gray-500">{caption}</span>}
      </span>
      <span className="block text-xl font-bold text-gray-900">{formatCount(count)}</span>
      <span className="block text-xs text-gray-600 mt-1">{label}</span>
    </>
  );
  const look = 'block w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-left';
  if (!onOpen || count === 0) {
    return (
      <div className={look} title={hint}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      title={hint}
      aria-label={`${label}: ${visitsText(count)}. Open them in the encounters list.`}
      className={`${look} hover:shadow-md transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500`}
    >
      {body}
    </button>
  );
};

/** A small coloured figure under a chart: "Most visits", "Total visits"... */
export const InsightTile: React.FC<{ label: string; value: string; note: string; tone: 'cyan' | 'blue' | 'red' }> = ({ label, value, note, tone }) => {
  // Written out in full so Tailwind keeps the classes
  const look = {
    cyan: ['bg-cyan-50 border-cyan-100', 'text-cyan-600', 'text-cyan-700', 'text-cyan-500'],
    blue: ['bg-blue-50 border-blue-100', 'text-blue-600', 'text-blue-700', 'text-blue-500'],
    red: ['bg-red-50 border-red-100', 'text-red-600', 'text-red-700', 'text-red-500']
  }[tone];
  return (
    <div className={`text-center p-3 rounded-lg border ${look[0]}`}>
      <p className={`text-xs mb-1 ${look[1]}`}>{label}</p>
      <p className={`text-sm font-bold break-words ${look[2]}`}>{value}</p>
      <p className={`text-xs ${look[3]}`}>{note}</p>
    </div>
  );
};

export interface OpenableRow {
  key: string;
  /** Plain text: "Practitioner A", "Tue 6 Oct 2026" */
  name: string;
  /** Short text on the button: "6 Oct" */
  short: string;
  count: number;
}

/**
 * What a chart shows, as buttons: read out by screen readers, and shown under the chart while the keyboard is in it
 * (a chart's bars and points take a click or a tap, not the keyboard). Mouse users never see it.
 */
export const ChartKeys: React.FC<{ rows: OpenableRow[]; label: string; action: string; onOpen: (key: string) => void }> = ({ rows, label, action, onOpen }) => (
  <ul aria-label={label} className="sr-only focus-within:not-sr-only focus-within:mt-4 focus-within:flex focus-within:flex-wrap focus-within:gap-2">
    {rows.map((row) => (
      <li key={row.key}>
        <button
          type="button"
          onClick={() => onOpen(row.key)}
          aria-label={`${row.name}: ${visitsText(row.count)}. ${action}`}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          {row.short}: {formatCount(row.count)}
        </button>
      </li>
    ))}
  </ul>
);

/** While figures load: the spinner of the analytics */
export const AnalyticsLoading: React.FC<{ label: string; tall?: boolean }> = ({ label, tall = true }) => (
  <div role="status" className={`flex items-center justify-center ${tall ? 'h-96' : 'py-10'}`}>
    <div className="text-center">
      <div className="animate-spin motion-reduce:animate-none rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4" aria-hidden="true"></div>
      <p className="text-gray-600">{label}</p>
    </div>
  </div>
);

/** Figures that could not be loaded: what went wrong and Retry */
export const AnalyticsError: React.FC<{ title: string; message: string; onRetry: () => void; tall?: boolean }> = ({ title, message, onRetry, tall = true }) => (
  <div role="alert" className={`flex items-center justify-center ${tall ? 'h-96' : 'py-10'}`}>
    <div className="text-center">
      <Icon icon="solar:danger-triangle-bold-duotone" className="w-12 h-12 text-red-500 mx-auto mb-4" aria-hidden="true" />
      <p className="text-red-600 mb-1 font-medium">{title}</p>
      <p className="text-sm text-gray-600 mb-4">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
      >
        Retry
      </button>
    </div>
  </div>
);

/** Nothing to count: a calm icon and one helpful sentence */
export const AnalyticsEmpty: React.FC<{ icon: string; title: string; message: string; iconColor?: string; tall?: boolean }> = ({
  icon,
  title,
  message,
  iconColor = 'text-gray-400',
  tall = true
}) => (
  <div className={`flex items-center justify-center text-center ${tall ? 'h-96' : 'py-8'}`}>
    <div className="max-w-md">
      <Icon icon={icon} className={`w-12 h-12 mx-auto mb-2 ${iconColor}`} aria-hidden="true" />
      <p className="text-gray-700 font-medium">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{message}</p>
    </div>
  </div>
);
