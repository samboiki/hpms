/** The smallest password staff may choose (Supabase Auth refuses shorter ones too when its own minimum is higher). */
export const MIN_PASSWORD_LENGTH = 8;

/** What is wrong with a new password and its confirmation, or null when it can be saved. */
export function passwordProblem(password: string, confirmation: string): string | null {
  if (password.trim().length === 0) return 'Choose a password.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use at least one letter and one number.';
  if (password !== confirmation) return 'The two passwords are not the same.';
  return null;
}
