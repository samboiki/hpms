// Who may send SMS through centralized-sms-gateway. Pure, so it is unit tested with Vitest.
// Before this check the gateway accepted any valid token, including the public anon key in every browser,
// so anyone could send SMS charged to any practice's bundle.

export interface GatewayCaller {
  /** The request carried the service role key: one of the platform's own functions */
  isServiceKey: boolean;
  /** The signed-in user the token belongs to, if any */
  user: { id: string } | null;
  /** That user's staff row */
  staff: { practice_id: string | null; is_active: boolean | null; is_super_admin: boolean | null } | null;
  /** Practices the user is assigned to besides their main one */
  assignedPracticeIds: string[];
}

export type GatewayAccess = { allowed: true } | { allowed: false; status: 401 | 403; error: string };

export function decideGatewayAccess(caller: GatewayCaller, practiceId: string): GatewayAccess {
  if (caller.isServiceKey) return { allowed: true };
  if (!caller.user) return { allowed: false, status: 401, error: 'Sign in again to send SMS.' };
  if (!caller.staff || caller.staff.is_active === false) {
    return { allowed: false, status: 403, error: 'Only active practice staff can send SMS.' };
  }
  if (caller.staff.is_super_admin === true) return { allowed: true };
  if (practiceId && (caller.staff.practice_id === practiceId || caller.assignedPracticeIds.includes(practiceId))) {
    return { allowed: true };
  }
  return { allowed: false, status: 403, error: 'You can only send SMS for your own practice.' };
}

/** The token from an "Authorization: Bearer ..." header, or null */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(.+)$/i.exec((header ?? '').trim());
  return match ? match[1].trim() : null;
}
