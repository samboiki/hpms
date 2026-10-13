/**
 * Formats a doctor's name for display with exactly one "Dr." prefix.
 * Names in the users table are often stored as "Dr. Jane Doe", and UI code
 * that blindly prepends "Dr. " produced "Dr. Dr. Jane Doe".
 */
export function formatDoctorName(name?: string | null, fallback = 'Not assigned'): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return fallback;
  const withoutPrefix = trimmed.replace(/^(dr\.?(\s+|$))+/i, '').trim();
  return withoutPrefix ? `Dr. ${withoutPrefix}` : fallback;
}
