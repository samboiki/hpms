/**
 * One app, one sign-in screen: after sign-in the app shows the staff app or the patient app.
 *
 * Staff sign in with email and password and have a staff profile (a row in public.users). Patients sign
 * in with their cell number and an SMS code: their login was created by phone sign-in (Supabase Auth
 * app_metadata.provider 'phone', which the user cannot change) and never has a staff profile. The database
 * enforces the same split (proposals/2026-10-07-patient-portal.sql: logins without a staff profile read
 * nothing but their own linked records); these rules only decide which screens to show.
 */

export type SessionKind = 'staff' | 'patient';

/** The parts of a Supabase Auth user that tell staff and patients apart. */
export interface SessionIdentity {
  email?: string | null;
  phone?: string | null;
  /** app_metadata.provider: how the login was first created ('email', 'phone', ...) */
  provider?: string | null;
}

/** Result of reading the signed-in user's staff profile (public.users). */
export type StaffProfileLookup = 'found' | 'not_found' | 'error';

/** The base path of the patient app. Every patient screen lives under it. */
export const PATIENT_APP_PATH = '/me';

const hasText = (value: string | null | undefined): boolean => !!value && value.trim() !== '';

/** A login made by cell-number sign-in: created by phone, or a phone and no email. */
export function isPhoneOnlyIdentity(identity: SessionIdentity | null | undefined): boolean {
  if (!identity) return false;
  if (identity.provider === 'phone') return true;
  return hasText(identity.phone) && !hasText(identity.email);
}

/** The identity of a Supabase Auth user (only the fields the rules need). */
export function identityOfAuthUser(
  user: { email?: string | null; phone?: string | null; app_metadata?: { provider?: unknown } | null } | null | undefined
): SessionIdentity | null {
  if (!user) return null;
  const provider = user.app_metadata?.provider;
  return { email: user.email ?? null, phone: user.phone ?? null, provider: typeof provider === 'string' ? provider : null };
}

/**
 * Staff or patient? A staff profile always means staff. Without one, a cell-number login is a patient
 * (also when it later added an email address), and an email login keeps the staff app's existing
 * fallback (the profile could not be read, so the auth metadata is used). Null: neither, the sign-in
 * screen is shown.
 */
export function decideSessionKind(identity: SessionIdentity | null | undefined, staffProfile: StaffProfileLookup): SessionKind | null {
  if (!identity) return null;
  if (staffProfile === 'found') return 'staff';
  if (isPhoneOnlyIdentity(identity)) return 'patient';
  if (hasText(identity.email)) return 'staff';
  return null;
}

const isPatientAppPath = (pathname: string): boolean =>
  pathname === PATIENT_APP_PATH || pathname.startsWith(`${PATIENT_APP_PATH}/`);

/**
 * Route guard: where to send a session that opened `pathname`, or null when it may stay. Patients only
 * ever see the patient app; staff never see it (their own app has every staff screen).
 */
export function redirectForSession(kind: SessionKind, pathname: string): string | null {
  if (kind === 'patient') return isPatientAppPath(pathname) ? null : PATIENT_APP_PATH;
  return isPatientAppPath(pathname) ? '/' : null;
}
