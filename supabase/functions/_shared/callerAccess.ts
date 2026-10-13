// Who may call an edge function. Most functions read and write with the service role key, which bypasses
// row-level security, and the platform's verify_jwt check also accepts the public anon key that ships in the web
// app. So every function decides for itself who is calling, with these rules (pure, unit tested with Vitest):
// - machine-only functions (queues, scheduled jobs, n8n) and test tools: the service role key and nothing else
// - functions the app calls: signed-in, active staff (a patient app login has no staff row, so it is refused),
//   acting for their own practice, a practice they are assigned to, or any practice for a super admin
import { constantTimeEqual } from './smsReplyPayload.ts';

export interface StaffRow {
  practice_id: string | null;
  is_active: boolean | null;
  is_super_admin: boolean | null;
  /** 'admin', 'doctor', 'nurse', 'receptionist' (read for functions only administrators may use) */
  role?: string | null;
}

export interface Caller {
  /** The request carried the service role key: one of the platform's own functions, a scheduled job or n8n */
  isServiceKey: boolean;
  /** The signed-in user the token belongs to, if any */
  user: { id: string } | null;
  /** That user's staff row (patient app logins have none) */
  staff: StaffRow | null;
  /** Practices the user is assigned to besides their main one */
  assignedPracticeIds: string[];
}

export type Denied = { allowed: false; status: 401 | 403; error: string };
export type Access = { allowed: true } | Denied;
/** practiceId: the practice the function may act for (null only for the platform or a super admin who named none) */
export type PracticeAccess = { allowed: true; practiceId: string | null } | Denied;

export interface AccessMessages {
  signIn: string;
  staffOnly: string;
  otherPractice: string;
}

export const STAFF_MESSAGES: AccessMessages = {
  signIn: 'Sign in as practice staff to use this.',
  staffOnly: 'Only active practice staff can use this.',
  otherPractice: 'You can only use this for your own practice.'
};
const NO_PRACTICE = 'Your account is not linked to a practice. Ask your administrator to add you to one.';
const PLATFORM_ONLY = 'Only the system can run this.';

/** The token from an "Authorization: Bearer ..." header, or null */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(.+)$/i.exec((header ?? '').trim());
  return match ? match[1].trim() : null;
}

/** True when the request carries the service role key (constant-time comparison). An unset key never matches. */
export function hasServiceRoleKey(authorization: string | null | undefined, serviceRoleKey: string | null | undefined): boolean {
  const token = bearerToken(authorization);
  return !!token && !!serviceRoleKey && constantTimeEqual(token, serviceRoleKey);
}

/** Machine-only functions and test tools: the service role key and nothing else */
export function decidePlatformAccess(authorization: string | null | undefined, serviceRoleKey: string | null | undefined): Access {
  return hasServiceRoleKey(authorization, serviceRoleKey)
    ? { allowed: true }
    : { allowed: false, status: 403, error: PLATFORM_ONLY };
}

/** Any signed-in, active staff member, or the platform */
export function decideStaffAccess(caller: Caller, messages: AccessMessages = STAFF_MESSAGES): Access {
  if (caller.isServiceKey) return { allowed: true };
  if (!caller.user) return { allowed: false, status: 401, error: messages.signIn };
  if (!caller.staff || caller.staff.is_active === false) return { allowed: false, status: 403, error: messages.staffOnly };
  return { allowed: true };
}

const mayActFor = (caller: Caller, practiceId: string): boolean =>
  caller.staff?.is_super_admin === true ||
  caller.staff?.practice_id === practiceId ||
  caller.assignedPracticeIds.includes(practiceId);

/**
 * Staff acting for the practice a request names: their own, one they are assigned to, or any practice for a super
 * admin. With none named, their own practice is used, so a practice id from the request is never trusted on its
 * own. The platform may act for any practice it names.
 */
export function decidePracticeAccess(
  caller: Caller,
  requestedPracticeId: unknown,
  messages: AccessMessages = STAFF_MESSAGES
): PracticeAccess {
  const staffAccess = decideStaffAccess(caller, messages);
  if (!staffAccess.allowed) return staffAccess;
  const requested = typeof requestedPracticeId === 'string' ? requestedPracticeId.trim() : '';
  if (caller.isServiceKey) return { allowed: true, practiceId: requested || null };
  if (!requested) {
    const own = caller.staff?.practice_id ?? null;
    if (own || caller.staff?.is_super_admin === true) return { allowed: true, practiceId: own };
    return { allowed: false, status: 403, error: NO_PRACTICE };
  }
  return mayActFor(caller, requested)
    ? { allowed: true, practiceId: requested }
    : { allowed: false, status: 403, error: messages.otherPractice };
}

/**
 * Staff reading or changing an existing record (a patient, a visit) by its id: the record's own practice decides.
 * A record without a practice is for super admins and the platform only; it never falls back to the caller's practice.
 */
export function decideRecordAccess(
  caller: Caller,
  recordPracticeId: string | null | undefined,
  messages: AccessMessages = STAFF_MESSAGES
): Access {
  const staffAccess = decideStaffAccess(caller, messages);
  if (!staffAccess.allowed) return staffAccess;
  if (caller.isServiceKey) return { allowed: true };
  const allowed = recordPracticeId ? mayActFor(caller, recordPracticeId) : caller.staff?.is_super_admin === true;
  return allowed ? { allowed: true } : { allowed: false, status: 403, error: messages.otherPractice };
}

/** The parts of a supabase-js client (created with the service role key) that loadCaller uses */
export interface CallerLookupClient {
  auth: { getUser(jwt: string): PromiseLike<{ data: { user: { id: string } | null } }> };
  /** A supabase-js query builder (see RowQuery): its generic types are too deep for TypeScript to compare here */
  from(table: string): unknown;
}
/** The query builder calls loadCaller makes */
interface RowQuery {
  select(columns: string): {
    eq(column: string, value: string): PromiseLike<{ data: unknown }> & { maybeSingle(): PromiseLike<{ data: unknown }> };
  };
}

const asStaffRow = (row: unknown): StaffRow | null => {
  if (!row || typeof row !== 'object') return null;
  const value = row as Record<string, unknown>;
  return {
    practice_id: typeof value.practice_id === 'string' ? value.practice_id : null,
    is_active: typeof value.is_active === 'boolean' ? value.is_active : null,
    is_super_admin: typeof value.is_super_admin === 'boolean' ? value.is_super_admin : null,
    role: typeof value.role === 'string' ? value.role : null
  };
};

/** Practice ids of the assignments not switched off */
const activePracticeIds = (rows: unknown): string[] =>
  Array.isArray(rows)
    ? rows.flatMap((row) => {
        const value = (row ?? {}) as Record<string, unknown>;
        return typeof value.practice_id === 'string' && value.is_active !== false ? [value.practice_id] : [];
      })
    : [];

/**
 * Who is calling: the platform (service role key), or the signed-in user behind the token with their staff row and
 * practice assignments. db must use the service role key: the staff row is read past row-level security.
 */
export async function loadCaller(
  db: CallerLookupClient,
  authorization: string | null | undefined,
  serviceRoleKey: string | null | undefined
): Promise<Caller> {
  const nobody: Caller = { isServiceKey: false, user: null, staff: null, assignedPracticeIds: [] };
  if (hasServiceRoleKey(authorization, serviceRoleKey)) return { ...nobody, isServiceKey: true };
  const token = bearerToken(authorization);
  if (!token) return nobody;
  const { data } = await db.auth.getUser(token);
  const userId = data?.user?.id;
  if (!userId) return nobody;
  const table = (name: string) => db.from(name) as RowQuery;
  const [staff, assignments] = await Promise.all([
    table('users').select('practice_id, is_active, is_super_admin, role').eq('id', userId).maybeSingle(),
    table('user_practice_assignments').select('practice_id, is_active').eq('user_id', userId)
  ]);
  return { isServiceKey: false, user: { id: userId }, staff: asStaffRow(staff.data), assignedPracticeIds: activePracticeIds(assignments.data) };
}

/** The JSON answer for a refused call, with the function's own CORS headers */
export function deniedResponse(denied: Denied, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ success: false, error: denied.error }), {
    status: denied.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
