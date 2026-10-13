import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { isStaffAdmin } from '../components/settings/UserManagement/staffUtils';
import { loadScreenAccess, screenAccessQueryKey } from '../services/screenAccessService';
import { seesFinanceFigures, type ScreenAccessRead } from '../utils/auth/screenAccess';

const NOTHING_CHOSEN: ScreenAccessRead = { status: 'ready', access: {} };
const noRetry = () => undefined;

/**
 * The signed-in staff member's practice choice of who opens Finance and Stock, for the sidebar and the routes
 * (screenGate / sidebarShowsPath decide). Administrators and OneHealth support always open both, so it is read only
 * for everyone else; without a practice nothing can have been chosen.
 */
export function useScreenAccess(): ScreenAccessRead & { retry: () => void } {
  const user = useAuthStore((state) => state.user);
  const practiceId = user?.practice_id ?? null;
  const needed = !!user && !isStaffAdmin(user) && practiceId !== null;
  const query = useQuery({
    queryKey: screenAccessQueryKey(practiceId),
    queryFn: () => loadScreenAccess(practiceId as string),
    enabled: needed
  });

  if (!needed) return { ...NOTHING_CHOSEN, retry: noRetry };
  const retry = () => void query.refetch();
  // A failed re-read keeps the choice already known
  if (query.data) return { status: 'ready', access: query.data, retry };
  return { status: query.isError ? 'error' : 'loading', access: {}, retry };
}

/** Whether the signed-in person sees money figures outside Finance (seesFinanceFigures). */
export function useSeesFinanceFigures(): boolean {
  const user = useAuthStore((state) => state.user);
  return seesFinanceFigures(user, useScreenAccess());
}
