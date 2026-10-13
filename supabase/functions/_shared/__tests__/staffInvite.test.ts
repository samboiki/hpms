import { describe, it, expect } from 'vitest';
import { decideInviteAccess, exactLikePattern, inviteEmail, validateInvite } from '../staffInvite';
import type { Caller, StaffRow } from '../callerAccess';

// Invented ids, names and addresses: none of these exist anywhere.
const PRACTICE_A = 'practice-a';
const PRACTICE_B = 'practice-b';
const staff = (overrides: Partial<StaffRow> = {}): StaffRow => ({ practice_id: PRACTICE_A, is_active: true, is_super_admin: false, role: 'admin', ...overrides });
const caller = (overrides: Partial<Caller> = {}): Caller => ({ isServiceKey: false, user: { id: 'user-1' }, staff: staff(), assignedPracticeIds: [], ...overrides });

// Business rule: inviting creates a login with access to a practice's patient records, so only that practice's
// administrator (or a OneHealth super admin) may do it; a receptionist or a patient login never can.
describe('who may invite staff', () => {
  it('lets a practice administrator invite to their own practice', () => {
    expect(decideInviteAccess(caller(), PRACTICE_A)).toEqual({ allowed: true, practiceId: PRACTICE_A });
  });

  it('refuses other roles, even for their own practice', () => {
    for (const role of ['doctor', 'nurse', 'receptionist', null]) {
      expect(decideInviteAccess(caller({ staff: staff({ role }) }), PRACTICE_A)).toMatchObject({ allowed: false, status: 403 });
    }
  });

  it("refuses an administrator acting for another practice, even one they are assigned to", () => {
    expect(decideInviteAccess(caller(), PRACTICE_B)).toMatchObject({ allowed: false, status: 403 });
    expect(decideInviteAccess(caller({ assignedPracticeIds: [PRACTICE_B] }), PRACTICE_B)).toMatchObject({ allowed: false, status: 403 });
  });

  it('refuses a patient login, an inactive administrator and anyone not signed in', () => {
    expect(decideInviteAccess(caller({ staff: null }), PRACTICE_A)).toMatchObject({ allowed: false });
    expect(decideInviteAccess(caller({ staff: staff({ is_active: false }) }), PRACTICE_A)).toMatchObject({ allowed: false, status: 403 });
    expect(decideInviteAccess(caller({ user: null, staff: null }), PRACTICE_A)).toMatchObject({ allowed: false, status: 401 });
  });

  it('lets a super admin and the platform invite to the practice they name', () => {
    expect(decideInviteAccess(caller({ staff: staff({ role: 'doctor', is_super_admin: true }) }), PRACTICE_B)).toEqual({ allowed: true, practiceId: PRACTICE_B });
    expect(decideInviteAccess(caller({ isServiceKey: true, user: null, staff: null }), PRACTICE_B)).toEqual({ allowed: true, practiceId: PRACTICE_B });
  });
});

// Business rule: what reaches the database is checked on the server, whatever the browser sent.
describe('checking an invitation', () => {
  const valid = { practiceId: PRACTICE_A, email: ' Anna.Nghifitikeko@Example.com ', fullName: ' Anna   Nghifitikeko ', role: 'Nurse', startDate: '2026-11-01' };

  it('normalises a valid invitation', () => {
    const result = validateInvite(valid);
    expect(result).toMatchObject({ ok: true, invite: { email: 'anna.nghifitikeko@example.com', fullName: 'Anna Nghifitikeko', role: 'nurse', startDate: '2026-11-01', resend: false } });
  });

  it.each([
    { label: 'bad email', body: { ...valid, email: 'anna@' }, error: /valid email/ },
    { label: 'no name', body: { ...valid, fullName: ' ' }, error: /full name/ },
    { label: 'super admin is not a role anyone can hand out', body: { ...valid, role: 'super_admin' }, error: /role must be/ },
    { label: 'no practice', body: { ...valid, practiceId: '' }, error: /practice/ },
    { label: 'start date not a date', body: { ...valid, startDate: '1 Nov' }, error: /start date/ },
    { label: 'oversized field', body: { ...valid, address: 'x'.repeat(301) }, error: /address is too long/ }
  ])('refuses: $label', ({ body, error }) => {
    const result = validateInvite(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(error);
  });

  it('needs only the email and practice to resend a link', () => {
    expect(validateInvite({ practiceId: PRACTICE_A, email: 'anna@example.com', resend: true })).toMatchObject({ ok: true, invite: { resend: true } });
  });
});

// Business rule: an email with "_" must match only itself when checking for an existing login; in LIKE "_"
// matches any character, which could treat another person's address as this one.
it('escapes LIKE wildcards in an email address', () => {
  expect(exactLikePattern('john_doe%1@example.com')).toBe('john\\_doe\\%1@example.com');
});

// Business rule: the email shows names typed by staff; they must never become HTML that runs or reshapes it.
describe('the invitation email', () => {
  it('escapes names and links, and says the link works once', () => {
    const email = inviteEmail({ practiceName: 'Dr <b>X</b> & Co', fullName: '<script>x</script>', role: 'admin', link: 'https://example.com/verify?token=a"b', resend: false });
    expect(email.subject).toBe('Dr <b>X</b> & Co invited you to OneHealth');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('token=a&quot;b');
    expect(email.html).toContain('as an administrator');
    expect(email.text).toContain('The link works once');
  });

  it('words a resent link differently', () => {
    expect(inviteEmail({ practiceName: 'Clinic', fullName: 'Anna', role: 'nurse', link: 'https://example.com', resend: true }).subject).toBe('Your new OneHealth sign-in link for Clinic');
  });
});
