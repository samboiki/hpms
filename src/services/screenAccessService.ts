/**
 * Reads and saves who may open Finance and Stock (the rule is src/utils/auth/screenAccess.ts). Staff read their
 * practice's practice_settings 'screen_access' row; the one way to write it is set_screen_access
 * (proposals/2026-10-08-screen-access.sql): active administrators of the practice and OneHealth support only, known
 * screens and roles only, every change recorded in audit_logs.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  SCREEN_ACCESS_SETTING_KEY,
  parseScreenAccess,
  rolesInUse,
  type ChoosableRole,
  type GuardedScreen,
  type ScreenAccess
} from '../utils/auth/screenAccess';

// The generated database types do not know set_screen_access, so it is called with the untyped client
const db = supabase as unknown as SupabaseClient;

/** One cache entry per practice, shared by the sidebar, the routes and Settings > Users > Screen access. */
export const screenAccessQueryKey = (practiceId: string | null) => ['screen-access', practiceId] as const;

/** The practice's choice: nothing chosen (every role opens every screen) without a row. Throws when unreadable. */
export async function loadScreenAccess(practiceId: string): Promise<ScreenAccess> {
  const { data, error } = await supabase
    .from('practice_settings')
    .select('setting_value')
    .eq('practice_id', practiceId)
    .eq('setting_key', SCREEN_ACCESS_SETTING_KEY)
    .limit(1);
  if (error) throw new Error(`Could not read who can open Finance and Stock: ${error.message}`);
  return parseScreenAccess(data?.[0]?.setting_value ?? null);
}

/** The roles of the practice's active staff that get a box (only roles are read, no names). */
export async function loadRolesInUse(practiceId: string): Promise<ChoosableRole[]> {
  const { data, error } = await supabase.from('users').select('role, is_active').eq('practice_id', practiceId);
  if (error) throw new Error(`Could not read the practice's staff roles: ${error.message}`);
  return rolesInUse(data ?? []);
}

/** The database's refusal in words a practice administrator can act on. */
export function describeScreenAccessError(error: { code?: string | null; message?: string | null } | null | undefined): string {
  const code = error?.code ?? '';
  // PostgREST: the function is not in its schema cache; Postgres: no such function
  if (code === 'PGRST202' || code === '42883') return 'Not saved: screen access is not set up in the database yet.';
  if (code === '42501') return "Not saved: only the practice's administrators can choose this.";
  if (code === 'P0002') return 'Not saved: this practice no longer exists.';
  return `Not saved: ${error?.message || 'please try again.'}`;
}

export type ScreenAccessSave = { ok: true; access: ScreenAccess } | { ok: false; message: string };

/** Saves who may open one screen; null opens it to every role again. Returns the practice's whole choice. */
export async function saveScreenAccess(
  practiceId: string,
  screen: GuardedScreen,
  roles: readonly ChoosableRole[] | null
): Promise<ScreenAccessSave> {
  const { data, error } = await db.rpc('set_screen_access', {
    p_practice_id: practiceId,
    p_screen: screen,
    p_roles: roles
  });
  if (error) return { ok: false, message: describeScreenAccessError(error) };
  return { ok: true, access: parseScreenAccess(data) };
}
