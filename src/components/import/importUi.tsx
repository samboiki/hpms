import React from 'react';
import { Icon } from '@iconify/react';
import { count, groupByReason, type ListedRow } from './importText';

/** Rows shown at most per list: the rest are counted (the full list is in the file the practice exported) */
const SHOWN = 100;

const rowText = (row: ListedRow): string =>
  [row.line ? `Line ${row.line}` : null, row.account ? `Account ${row.account}` : null].filter(Boolean).join(' · ');

const Rows: React.FC<{ rows: readonly ListedRow[]; showReason: boolean }> = ({ rows, showReason }) => (
  <>
    <ul className="divide-y divide-gray-100 text-sm">
      {rows.slice(0, SHOWN).map(row => (
        <li key={row.key} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="font-medium text-gray-900 sm:w-56 sm:flex-none sm:truncate" title={row.label}>{row.label}</span>
          <span className="text-xs text-gray-500 sm:w-48 sm:flex-none">{rowText(row)}</span>
          {showReason && row.reason && <span className="min-w-0 text-gray-700">{row.reason}</span>}
        </li>
      ))}
    </ul>
    {rows.length > SHOWN && <p className="pt-2 text-xs text-gray-500">And {count(rows.length - SHOWN)} more.</p>}
  </>
);

const TONES = {
  red: 'border-red-200 bg-red-50/40 text-red-700',
  amber: 'border-amber-200 bg-amber-50/40 text-amber-700',
  gray: 'border-gray-200 bg-white text-gray-600',
  green: 'border-green-200 bg-green-50/40 text-green-700'
};

/**
 * A list that opens on demand (a native disclosure, so it works with the keyboard and screen readers). With
 * `byReason`, rows are grouped under their reason, most common first.
 */
export const RowList: React.FC<{
  title: string;
  rows: readonly ListedRow[];
  icon: string;
  tone?: keyof typeof TONES;
  byReason?: boolean;
  hint?: string;
}> = ({ title, rows, icon, tone = 'gray', byReason = false, hint }) => {
  if (rows.length === 0) return null;
  return (
    <details className={`group rounded-xl border ${TONES[tone]}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:p-4">
        <Icon icon={icon} className="h-5 w-5 flex-none" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-gray-900">{title}</span>
          {hint && <span className="block text-xs text-gray-500">{hint}</span>}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">{count(rows.length)}</span>
        <Icon icon="solar:alt-arrow-down-bold-duotone" className="h-4 w-4 flex-none text-gray-400 group-open:rotate-180 motion-safe:transition-transform" aria-hidden="true" />
      </summary>
      <div className="border-t border-gray-100 bg-white px-3 pb-3 sm:px-4">
        {byReason ? (
          groupByReason(rows).map(group => (
            <div key={group.reason} className="pt-3">
              <p className="text-sm font-semibold text-gray-800">
                {group.reason} <span className="font-normal text-gray-500">({count(group.rows.length)})</span>
              </p>
              <Rows rows={group.rows} showReason={false} />
            </div>
          ))
        ) : (
          <Rows rows={rows} showReason />
        )}
      </div>
    </details>
  );
};

/** A step's heading: what to do here, in one line */
export const StepIntro: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
    {children && <div className="mt-1 text-sm text-gray-600">{children}</div>}
  </div>
);
