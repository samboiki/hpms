/**
 * Who may open the screens that hold money and stock (parity row Q1). The owner has not chosen role rights, so each
 * practice's administrators choose per screen in Settings > Users > Screen access. Until they choose, every role opens
 * every screen, as before; administrators and OneHealth support always can (isStaffAdmin).
 *
 * Stored per practice in practice_settings 'screen_access' as {"finance": ["doctor"], "stock": [...]}: a screen that is
 * missing is open to every role. Written only through set_screen_access (proposals/2026-10-08-screen-access.sql), whose
 * screen and role lists a unit test compares with these. The app hides the screens and closes their routes; the
 * database still lets every staff member of the practice read the data behind them.
 */
import { isStaffAdmin } from '../../components/settings/UserManagement/staffUtils';

export const SCREEN_ACCESS_SETTING_KEY = 'screen_access';

/**
 * The screens a practice can limit (set_screen_access's v_screens), with their sidebar icon. Their reports are tabs
 * inside them. Each key is also the screen's section colour (src/config/sectionColors.ts).
 */
export const GUARDED_SCREENS = [
  { key: 'finance', label: 'Finance', path: '/finance', icon: 'solar:wallet-money-bold-duotone', holds: 'invoices, payments, debtors, claims and reports' },
  { key: 'stock', label: 'Stock', path: '/stock', icon: 'solar:box-bold-duotone', holds: 'medicines, deliveries, suppliers and stock counts' },
  // Since 13 Oct 2026 (proposals/2026-10-13-inpatient-module.sql)
  { key: 'inpatient', label: 'Inpatient', path: '/inpatient', icon: 'solar:bed-bold-duotone', holds: 'wards, beds, admitted patients, their charts and visitors' }
] as const;

export type GuardedScreen = (typeof GUARDED_SCREENS)[number]['key'];

/** The roles administrators choose between (set_screen_access's v_roles); administrators always open every screen. */
export const CHOOSABLE_ROLES = ['doctor', 'nurse', 'receptionist'] as const;

export type ChoosableRole = (typeof CHOOSABLE_ROLES)[number];

/** Per screen, the roles that may open it. A screen that is missing is open to every role. */
export type ScreenAccess = Readonly<Partial<Record<GuardedScreen, readonly ChoosableRole[]>>>;

/** Reading the practice's choice (useScreenAccess). */
export interface ScreenAccessRead {
  status: 'loading' | 'error' | 'ready';
  access: ScreenAccess;
}

type AccessUser = { role?: string | null; is_super_admin?: boolean | null } | null | undefined;

/** A guarded screen's name, sidebar icon and what it holds, in plain words. */
export function screenDetails(screen: GuardedScreen): { label: string; icon: string; holds: string } {
  const guarded = GUARDED_SCREENS.find((item) => item.key === screen);
  return { label: guarded?.label ?? screen, icon: guarded?.icon ?? 'solar:lock-keyhole-minimalistic-bold-duotone', holds: guarded?.holds ?? '' };
}

/** The stored setting (any JSON) as screen -> roles. */
export function parseScreenAccess(value: unknown): ScreenAccess {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const stored = value as Record<string, unknown>;
  return Object.fromEntries(
    GUARDED_SCREENS.filter(({ key }) => Object.prototype.hasOwnProperty.call(stored, key)).map(({ key }) => {
      const roles = stored[key];
      // A damaged entry closes the screen to everyone but administrators rather than quietly opening it again
      return [key, Array.isArray(roles) ? CHOOSABLE_ROLES.filter((role) => roles.includes(role)) : []];
    })
  );
}

/** Whether the role's box is ticked: every role's is, until an administrator chooses for the screen. */
export function isRoleAllowed(access: ScreenAccess, screen: GuardedScreen, role: ChoosableRole): boolean {
  const roles = access[screen];
  return roles === undefined || roles.includes(role);
}

/** The one access rule: administrators and OneHealth support always; everyone else as the practice chose. */
export function canOpenScreen(user: AccessUser, screen: GuardedScreen, access: ScreenAccess): boolean {
  if (!user) return false;
  if (isStaffAdmin(user)) return true;
  const roles = access[screen];
  return roles === undefined || roles.some((role) => role === user.role);
}

/**
 * What a screen's route shows: 'open' (the screen), 'closed' ("Ask your practice administrator"), 'checking' (while
 * the choice is read) or 'unchecked' (it could not be read: try again).
 */
export type ScreenGate = 'open' | 'closed' | 'checking' | 'unchecked';

export function screenGate(user: AccessUser, screen: GuardedScreen, read: ScreenAccessRead): ScreenGate {
  if (!user) return 'closed';
  // Administrators never wait for the choice: they always open every screen
  if (isStaffAdmin(user)) return 'open';
  if (read.status === 'loading') return 'checking';
  if (read.status === 'error') return 'unchecked';
  return canOpenScreen(user, screen, read.access) ? 'open' : 'closed';
}

/**
 * Money figures shown outside Finance (the dashboard's revenue tile, Settings > Practice > Overhead, the revenue in the
 * Encounters analytics) follow Finance's access: a role the practice keeps out of Finance does not read the practice's
 * takings or costs elsewhere instead. They show only once the choice is known to let this person in, so they never
 * flash up while it is read or when it could not be read.
 */
export function seesFinanceFigures(user: AccessUser, read: ScreenAccessRead): boolean {
  return screenGate(user, 'finance', read) === 'open';
}

/**
 * The Optometry page holds the frames, consignment stock and lab orders, so it opens for the roles that open Stock (its
 * money reports also follow Finance, as every money figure outside Finance does). It is not a screen of its own in
 * Settings > Users > Screen access.
 */
export const OPTOMETRY_FOLLOWS: GuardedScreen = 'stock';

/** Pages that follow a guarded screen's access, by path */
const FOLLOWING_PAGES: ReadonlyMap<string, GuardedScreen> = new Map([['/optometry', OPTOMETRY_FOLLOWS]]);

/** The guarded screen a sidebar link opens (or whose access the page follows), or null for every other link. */
export function screenForPath(path: string): GuardedScreen | null {
  return GUARDED_SCREENS.find((guarded) => guarded.path === path)?.key ?? FOLLOWING_PAGES.get(path) ?? null;
}

/** The sidebar hides a link only once the practice's choice is known to close it to this person. */
export function sidebarShowsPath(user: AccessUser, path: string, read: ScreenAccessRead): boolean {
  const screen = screenForPath(path);
  return screen === null || screenGate(user, screen, read) !== 'closed';
}

/** The roles that get a box: those of the practice's active staff (administrators always have access). */
export function rolesInUse(staff: ReadonlyArray<{ role?: string | null; is_active?: boolean | null }>): ChoosableRole[] {
  return CHOOSABLE_ROLES.filter((role) => staff.some((member) => member.role === role && member.is_active !== false));
}

/**
 * The roles to save after ticking or unticking one box (set_screen_access's p_roles). Every box shown ticked saves
 * null: the screen is open to every role again, including someone who later joins in a role nobody has yet. Otherwise
 * the ticked roles, so such a newcomer starts without access to a screen the practice limited.
 */
export function rolesAfterToggle(
  access: ScreenAccess,
  screen: GuardedScreen,
  shownRoles: readonly ChoosableRole[],
  role: ChoosableRole,
  allowed: boolean
): ChoosableRole[] | null {
  const ticked = shownRoles.filter((shown) => (shown === role ? allowed : isRoleAllowed(access, screen, shown)));
  return ticked.length === shownRoles.length ? null : ticked;
}
