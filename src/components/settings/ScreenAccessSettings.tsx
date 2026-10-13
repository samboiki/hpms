/**
 * Settings > Users > Screen access: practice administrators choose which roles open Finance and Stock, one row per
 * screen with a box per role their active staff have; administrators always can. Every box starts ticked, so nothing
 * changes until an administrator unticks one, and each click saves at once through set_screen_access
 * (screenAccessService). The rule itself is src/utils/auth/screenAccess.ts.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { STAFF_ROLE_LABELS, isStaffAdmin } from './UserManagement/staffUtils';
// The app's action colour (cyan) for buttons, shared with the stock and optometry screens
import { SECONDARY } from '../stock/stockUi';
import { loadRolesInUse, loadScreenAccess, saveScreenAccess, screenAccessQueryKey } from '../../services/screenAccessService';
import {
  GUARDED_SCREENS,
  isRoleAllowed,
  rolesAfterToggle,
  type ChoosableRole,
  type GuardedScreen
} from '../../utils/auth/screenAccess';

type RowStatus = { screen: GuardedScreen; state: 'saving' | 'saved' } | { screen: GuardedScreen; state: 'failed'; message: string };

export const ScreenAccessSettings: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const practiceId = user?.practice_id ?? null;
  const enabled = isStaffAdmin(user) && practiceId !== null;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RowStatus | null>(null);

  const accessQuery = useQuery({
    queryKey: screenAccessQueryKey(practiceId),
    queryFn: () => loadScreenAccess(practiceId as string),
    enabled
  });
  const rolesQuery = useQuery({
    queryKey: ['screen-access-roles', practiceId],
    queryFn: () => loadRolesInUse(practiceId as string),
    enabled
  });

  if (!enabled || practiceId === null) return null;

  const access = accessQuery.data;
  const shownRoles = rolesQuery.data;

  const change = async (screen: GuardedScreen, role: ChoosableRole, allowed: boolean) => {
    if (!access || !shownRoles) return;
    setStatus({ screen, state: 'saving' });
    const result = await saveScreenAccess(practiceId, screen, rolesAfterToggle(access, screen, shownRoles, role, allowed));
    if (result.ok) {
      queryClient.setQueryData(screenAccessQueryKey(practiceId), result.access);
      setStatus({ screen, state: 'saved' });
    } else {
      setStatus({ screen, state: 'failed', message: result.message });
    }
  };

  const retry = () => {
    void accessQuery.refetch();
    void rolesQuery.refetch();
  };

  return (
    <Card className="border border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-none rounded-lg bg-purple-100 p-2">
            <Icon icon="solar:shield-user-bold-duotone" className="h-5 w-5 text-purple-600" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg font-semibold text-gray-900">Screen access</CardTitle>
            <p className="text-sm text-gray-600">
              Choose who can open the screens that hold money and stock. Administrators can always open them; until you
              untick a role, everyone can, as before.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {accessQuery.isError || rolesQuery.isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <span>Screen access could not be loaded.</span>
            <button type="button" onClick={retry} className={SECONDARY}>
              Try again
            </button>
          </div>
        ) : !access || !shownRoles ? (
          <div className="h-24 rounded-xl bg-gray-100 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Loading screen access" />
        ) : shownRoles.length === 0 ? (
          <p className="text-sm text-gray-600">
            Only administrators work in this practice now, and they can always open Finance and Stock. When you add a doctor,
            nurse or receptionist, you can choose here what they open.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {GUARDED_SCREENS.map((screen) => {
              const rowStatus = status?.screen === screen.key ? status : null;
              return (
                <fieldset key={screen.key} disabled={rowStatus?.state === 'saving'} className="min-w-0 rounded-xl border border-gray-200 p-4">
                  <legend className="px-1 text-sm font-semibold text-gray-900">Who can open {screen.label}</legend>
                  <p className="text-xs text-gray-600">{screen.label} holds {screen.holds}.</p>
                  <div className="mt-2 flex flex-wrap gap-x-6">
                    <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-gray-500">
                      <input type="checkbox" checked disabled readOnly className="h-5 w-5 rounded border-gray-300 text-cyan-600" />
                      {STAFF_ROLE_LABELS.admin} (always)
                    </label>
                    {shownRoles.map((role) => (
                      <label key={role} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={isRoleAllowed(access, screen.key, role)}
                          onChange={(event) => void change(screen.key, role, event.target.checked)}
                          className="h-5 w-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        {STAFF_ROLE_LABELS[role]}
                      </label>
                    ))}
                  </div>
                  <p aria-live="polite" className="min-h-[1rem] text-xs text-gray-600">
                    {rowStatus?.state === 'saving' ? 'Saving...' : rowStatus?.state === 'saved' ? 'Saved.' : ''}
                  </p>
                  {rowStatus?.state === 'failed' && (
                    <p role="alert" className="mt-1 text-xs text-red-700">
                      {rowStatus.message}
                    </p>
                  )}
                </fieldset>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScreenAccessSettings;
