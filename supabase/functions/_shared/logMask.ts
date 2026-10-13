/**
 * How patients' contact details may appear in function logs: never in full. Supabase keeps function logs and
 * support reads them, so a number or address there is personal data shown to people who do not need it.
 */
export { maskPhone } from './authOtpPolicy.ts';

/** An email address as it may appear in function logs: "j***@example.com". */
export function maskEmail(email: string | null | undefined): string {
  const value = (email ?? '').trim();
  const at = value.lastIndexOf('@');
  if (at <= 0) return value ? '***' : '';
  return `${value[0]}***${value.slice(at)}`;
}
