// Inviting a staff member to OneHealth (the invite-staff function): who may invite, what a valid invitation is, and
// the invitation email. A practice administrator invites staff to their own practice; a super admin to any practice.
// The new person chooses their own password from the emailed link, so no password is ever typed by someone else.
// Pure and unit tested with Vitest; explicit .ts imports for Deno.
import { decidePracticeAccess, type Caller, type PracticeAccess } from './callerAccess.ts';

export const INVITABLE_ROLES = ['receptionist', 'nurse', 'doctor', 'admin'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export interface StaffInvite {
  practiceId: string;
  email: string;
  fullName: string;
  role: InvitableRole;
  jobTitle: string | null;
  department: string | null;
  contactNumber: string | null;
  address: string | null;
  employeeNumber: string | null;
  hpcsaNumber: string | null;
  /** yyyy-MM-dd */
  startDate: string | null;
  /** Send a new link to someone already invited (the first email failed or the link expired) */
  resend: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Practice administrators invite to their own practice only; super admins and the platform to the practice named. */
export function decideInviteAccess(caller: Caller, requestedPracticeId: unknown): PracticeAccess {
  const access = decidePracticeAccess(caller, requestedPracticeId);
  if (!access.allowed || caller.isServiceKey || caller.staff?.is_super_admin === true) return access;
  if ((caller.staff?.role ?? '').trim().toLowerCase() !== 'admin') {
    return { allowed: false, status: 403, error: 'Only a practice administrator can invite staff.' };
  }
  if (access.practiceId !== caller.staff?.practice_id) {
    return { allowed: false, status: 403, error: 'You can only invite staff to your own practice.' };
  }
  return access;
}

const optionalText = (value: unknown, maxLength: number): string | null | undefined => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text.length > maxLength) return undefined;
  return text || null;
};

/** Checks the invitation the app sent; the message says what to correct. */
export function validateInvite(input: unknown): { ok: true; invite: StaffInvite } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'The invitation details are missing.' };
  const body = input as Record<string, unknown>;
  const practiceId = typeof body.practiceId === 'string' ? body.practiceId.trim() : '';
  if (!practiceId) return { ok: false, error: 'Choose the practice to invite to.' };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return { ok: false, error: 'Enter a valid email address.' };
  const resend = body.resend === true;
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().replace(/\s+/g, ' ') : '';
  if (!resend && (fullName.length < 2 || fullName.length > 100)) return { ok: false, error: 'Enter the full name (2 to 100 characters).' };
  const role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
  if (!resend && !(INVITABLE_ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: `The role must be one of: ${INVITABLE_ROLES.join(', ')}.` };
  }

  const fields = {
    jobTitle: optionalText(body.jobTitle, 100),
    department: optionalText(body.department, 100),
    contactNumber: optionalText(body.contactNumber, 30),
    address: optionalText(body.address, 300),
    employeeNumber: optionalText(body.employeeNumber, 30),
    hpcsaNumber: optionalText(body.hpcsaNumber, 30),
    startDate: optionalText(body.startDate, 10)
  };
  const tooLong = Object.entries(fields).find(([, value]) => value === undefined);
  if (tooLong) return { ok: false, error: `The ${tooLong[0].replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`)} is too long.` };
  if (fields.startDate && !DATE_PATTERN.test(fields.startDate)) return { ok: false, error: 'The start date must be a date (yyyy-mm-dd).' };

  return {
    ok: true,
    invite: {
      practiceId,
      email,
      fullName,
      role: (role || 'receptionist') as InvitableRole,
      jobTitle: fields.jobTitle ?? null,
      department: fields.department ?? null,
      contactNumber: fields.contactNumber ?? null,
      address: fields.address ?? null,
      employeeNumber: fields.employeeNumber ?? null,
      hpcsaNumber: fields.hpcsaNumber ?? null,
      startDate: fields.startDate ?? null,
      resend
    }
  };
}

/** An email for an exact, case-insensitive ILIKE match: "_" and "%" are wildcards in LIKE, so they are escaped. */
export function exactLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ROLE_LABELS: Record<string, string> = { receptionist: 'receptionist', nurse: 'nurse', doctor: 'doctor', admin: 'administrator' };

/** The invitation email (subject, HTML and plain text). Names are escaped; the link is used once. */
export function inviteEmail(input: { practiceName: string; fullName: string; role: string; link: string; resend: boolean }): {
  subject: string;
  html: string;
  text: string;
} {
  const practice = input.practiceName.trim() || 'your practice';
  const name = input.fullName.trim() || 'there';
  const role = ROLE_LABELS[input.role] ?? input.role;
  const subject = input.resend ? `Your new OneHealth sign-in link for ${practice}` : `${practice} invited you to OneHealth`;
  const lead = input.resend
    ? `Here is a new link to choose your OneHealth password for ${practice}.`
    : `${practice} has invited you to OneHealth as ${role === 'administrator' ? 'an' : 'a'} ${role}.`;
  const after = 'The link works once. If it has expired, ask your practice administrator to send a new one. If you did not expect this email, you can ignore it.';
  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
<div style="max-width:520px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border-radius:16px;padding:28px">
<p style="margin:0 0 4px;font-size:13px;color:#0f766e;font-weight:bold">OneHealth</p>
<h1 style="margin:0 0 16px;font-size:20px">Hello ${escapeHtml(name)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escapeHtml(lead)} Choose your password to sign in.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Choose my password</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280">${escapeHtml(after)}</p>
</div></div></body></html>`;
  const text = `Hello ${name}\n\n${lead} Choose your password to sign in:\n${input.link}\n\n${after}\n`;
  return { subject, html, text };
}
