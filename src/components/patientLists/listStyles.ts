/** Shared Tailwind classes for the patient-list screens (same look as the Patients page). */

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2';

export const PRIMARY_BUTTON = `inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:shadow-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-sm ${FOCUS}`;

export const SECONDARY_BUTTON = `inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const QUIET_BUTTON = `inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const DANGER_BUTTON = `inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const CARD = 'rounded-2xl border border-gray-200 bg-white shadow-sm';

export const INPUT =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100';

export const LABEL = 'mb-1.5 block text-sm font-medium text-gray-700';

export const CHIP = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium';
