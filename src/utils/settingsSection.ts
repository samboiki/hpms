/**
 * Settings opens the section a link names, not the first page of its tab: /settings?tab=practice&section=expenses opens
 * Practice > Practice Overhead, /settings?tab=users&section=payroll opens Users > Payroll. The links are built in
 * src/components/billing/invoiceLinks.ts; an unknown or missing section opens the tab's first page as before.
 */

/** The sections of Settings > Practice, in the order of its tab bar. */
export const PRACTICE_SECTIONS = ['profile', 'expenses', 'branches', 'departments', 'inventory'] as const;
export type PracticeSection = (typeof PRACTICE_SECTIONS)[number];

/** The sections of Settings > Users (My HR for staff who are not administrators). */
export const USER_SECTIONS = ['overview', 'payroll', 'leave', 'timesheets'] as const;
export type UserSection = (typeof USER_SECTIONS)[number];

/** The ?section= of the address when it is one of `sections`, else `fallback`. */
export function sectionFromAddress<T extends string>(
  sections: readonly T[],
  fallback: T,
  search: string = typeof window === 'undefined' ? '' : window.location.search
): T {
  const section = new URLSearchParams(search).get('section');
  return section !== null && (sections as readonly string[]).includes(section) ? (section as T) : fallback;
}
