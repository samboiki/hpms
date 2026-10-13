import { isStaffAdmin } from './UserManagement/staffUtils';

type PracticeUser = { role?: string | null; is_super_admin?: boolean | null } | null | undefined;

/**
 * Who sees the edit controls in Settings > Practice (profile, hours, branches, departments, overhead, inventory).
 *
 * Owner decision 13 Oct 2026: the practice's administrators change these; everyone else sees the same information
 * read-only. The database's own rule for a practice administrator is rls_is_practice_admin() (role admin or doctor,
 * proposals/2026-10-07-practice-isolation.sql), and the branches and departments policies allow exactly those roles,
 * so a doctor who may save keeps the buttons. OneHealth support (super admins) may too.
 */
export function canEditPracticeSettings(user: PracticeUser): boolean {
  return !!user && (user.role === 'admin' || user.role === 'doctor' || user.is_super_admin === true);
}

/**
 * The practice's name, type, numbers, bank details and claim batch start are stricter: the database refuses them to
 * everyone but role admin and support (proposals/2026-10-07-practice-protected-columns.sql), so only they get the
 * controls (a doctor would only meet a refusal).
 */
export function canEditProtectedPracticeDetails(user: PracticeUser): boolean {
  return isStaffAdmin(user);
}
