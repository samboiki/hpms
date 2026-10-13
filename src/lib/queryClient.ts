import { QueryClient, type DefaultOptions, type QueryKey } from '@tanstack/react-query';

/** How long a loaded screen counts as up to date (owner, 13 Oct 2026: a 5-minute cache) */
export const CACHE_MINUTES = 5;

/**
 * The app's React Query defaults. A screen opened again within CACHE_MINUTES shows what it loaded instead of reading
 * everything again: `refetchOnMount: true` refetches only data older than staleTime (it was 'always', which read every
 * query again on every mount whatever its age). A save therefore has to say what it changed (refreshAfterSave below).
 */
export const QUERY_DEFAULTS: DefaultOptions = {
  queries: {
    staleTime: 1000 * 60 * CACHE_MINUTES,
    gcTime: 1000 * 60 * 30, // 30 minutes cache time (was cacheTime)
    refetchOnWindowFocus: false, // Disable aggressive refetching
    refetchOnMount: true, // Only refetch if stale
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status?: number }).status ?? 0;
        if (status >= 400 && status < 500) return false;
      }
      return failureCount < 2;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
  },
  mutations: {
    retry: false // Don't retry mutations by default
  }
};

/** The app's one query cache (main.tsx provides it; services and stores outside React refresh it through here) */
export const queryClient = new QueryClient({ defaultOptions: QUERY_DEFAULTS });

/** The practice row shared by the menu, the practice colours, the tariff list and the diary (src/lib/practiceRow.ts) */
export const PRACTICE_ROW_KEY = 'practice-row';

/**
 * What a save changed, and the cached screens that show it. Before the 5-minute cache these screens read everything
 * again whenever they were opened; now a save marks them out of date, so they read again (at once if on screen).
 */
export const SAVE_AFFECTS = {
  // A staff member's record (name, role, department, branch, photo, active): Settings > Users and its HR tabs
  staff: [['users'], ['my-staff-profile'], ['staff-details'], ['all-users'], ['users-for-adjustments'], ['employee-salaries'], ['user-stats'], ['team-stats']],
  // A salary: Payroll, the payslip adjustments' percentages, bonuses due
  salary: [['employee-salaries'], ['employee-salary'], ['current-salary'], ['user-details'], ['staff-details'], ['bonus-due-employees']],
  // Payslips created, paid or deleted: Payroll, the person's payslip count, bonuses due
  payslips: [['payslips'], ['user-stats'], ['bonus-due-employees']],
  // The practice profile (name, logo, colours, type, opening hours): the menu, the diary, tariffs, payslip heading
  practice: [[PRACTICE_ROW_KEY], ['practice-heading'], ['user-practice-hours']]
} as const satisfies Record<string, readonly QueryKey[]>;

export type SavedThing = keyof typeof SAVE_AFFECTS;

/** After a successful save: every cached screen that shows what was saved reads it again. */
export function refreshAfterSave(what: SavedThing, client: QueryClient = queryClient): Promise<void> {
  return Promise.all(SAVE_AFFECTS[what].map(queryKey => client.invalidateQueries({ queryKey: [...queryKey] }))).then(() => undefined);
}
