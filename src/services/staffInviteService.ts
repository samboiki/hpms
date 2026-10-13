/**
 * Staff invitations through the invite-staff edge function: it creates the login and staff record and emails a
 * link to choose a password (only practice administrators and super admins may call it).
 */
import { supabase } from '../lib/supabase';

export interface StaffInviteDetails {
  practiceId: string;
  email: string;
  fullName: string;
  role: string;
  jobTitle?: string;
  department?: string;
  contactNumber?: string;
  address?: string;
  employeeNumber?: string;
  hpcsaNumber?: string;
  /** yyyy-MM-dd */
  startDate?: string;
}

const NOT_DEPLOYED =
  'Staff invitations are not switched on yet (the invite-staff function has not been deployed). No account was created.';

/** The function's own message for a refused call (it answers with { error }), else a plain fallback. */
async function invitationError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    // The function answers 404 itself for "no such staff member" (with its { error }); a 404 without it is the
    // function itself missing
    const body = (await context.json().catch(() => null)) as { error?: string } | null;
    if (body?.error) return body.error;
    if (context.status === 404) return NOT_DEPLOYED;
  }
  return error instanceof Error && error.message ? error.message : 'The invitation could not be sent. Please try again.';
}

async function callInviteStaff(body: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke('invite-staff', { body });
  if (error) throw new Error(await invitationError(error));
  const result = data as { success?: boolean; message?: string; error?: string } | null;
  if (!result?.success) throw new Error(result?.error ?? 'The invitation could not be sent. Please try again.');
  return result.message ?? 'Invitation sent.';
}

/** Invites a new staff member; returns the confirmation to show. Throws with a message to show when it fails. */
export function inviteStaff(details: StaffInviteDetails): Promise<string> {
  return callInviteStaff({ ...details });
}

/** Emails a new link to someone already invited (the first email failed or the link expired). */
export function resendStaffInvite(practiceId: string, email: string): Promise<string> {
  return callInviteStaff({ practiceId, email, resend: true });
}
