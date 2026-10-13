/** Tones of the shared number tiles (StatTile.tsx) and of section card icons (FinanceUI SectionCard) */
export type TileTone = 'cyan' | 'blue' | 'amber' | 'green' | 'red' | 'violet' | 'gray' | 'orange' | 'indigo' | 'slate';

/** Icon chip in a tone */
export const ICON_TONES: Record<TileTone, string> = {
  cyan: 'bg-cyan-100 text-cyan-600',
  blue: 'bg-blue-100 text-blue-600',
  amber: 'bg-amber-100 text-amber-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  violet: 'bg-violet-100 text-violet-600',
  gray: 'bg-gray-100 text-gray-600',
  orange: 'bg-orange-100 text-orange-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  slate: 'bg-slate-200 text-slate-700'
};

/** Soft tint of a compact tile (no border) */
export const SOFT_TONES: Record<TileTone, string> = {
  cyan: 'bg-cyan-50 text-cyan-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  violet: 'bg-violet-50 text-violet-600',
  gray: 'bg-gray-50 text-gray-600',
  orange: 'bg-orange-50 text-orange-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  slate: 'bg-slate-100 text-slate-600'
};
