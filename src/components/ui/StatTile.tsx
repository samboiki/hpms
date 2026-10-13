import React from 'react';
import { Icon } from '@iconify/react';
import { ICON_TONES, SOFT_TONES, type TileTone } from './tileTones';

/**
 * The number tile of every page (Finance, Stock, the Eminance import...). No border: the owner asked for
 * "plain, clean, straight and professional" tiles (October 2026), so a tile is either white with a soft shadow
 * (a page's headline figures) or, compact, a soft tint (a row of small figures inside a card).
 */
export interface StatTileProps {
  label: string;
  value: string;
  /** Solar bold-duotone icon */
  icon: string;
  tone?: TileTone;
  /** Compact: centred on a soft tint, for a row of small figures */
  compact?: boolean;
  /** Small text top right, e.g. "12 invoices"; on a compact tile, a line under the figure ("Last 30 days") */
  caption?: string;
  /** Under the label: a change badge or a short note */
  footer?: React.ReactNode;
  /** A clickable tile opens (or filters to) what it counts */
  onClick?: () => void;
  /** A tile that filters a list: true while its filter is in force */
  pressed?: boolean;
}

export const StatTile: React.FC<StatTileProps> = ({ label, value, icon, tone = 'cyan', compact, caption, footer, onClick, pressed }) => {
  if (compact) {
    return (
      <div className={`rounded-lg p-3 text-center ${SOFT_TONES[tone]}`}>
        <Icon icon={icon} className="mx-auto mb-1 h-6 w-6" aria-hidden="true" />
        <p className="text-xs text-gray-600">{label}</p>
        <p className="break-words text-lg font-bold text-gray-900">{value}</p>
        {caption && <p className="text-xs text-gray-500">{caption}</p>}
      </div>
    );
  }
  const body = (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={`flex-none rounded-lg p-2 ${ICON_TONES[tone]}`}>
          <Icon icon={icon} className="h-5 w-5" aria-hidden="true" />
        </span>
        {caption && <span className="text-right text-xs font-medium text-gray-500">{caption}</span>}
      </div>
      <p className="break-words text-xl font-bold text-gray-900 sm:text-2xl">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
      {footer}
    </>
  );
  const look = 'w-full rounded-xl bg-white p-4 text-left shadow-sm sm:p-5';
  if (!onClick) return <div className={look}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      // A button centres its content vertically: as a column, tiles of a row start at the same height
      className={`${look} flex flex-col transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${pressed ? 'ring-2 ring-cyan-500' : ''}`}
    >
      {body}
    </button>
  );
};
