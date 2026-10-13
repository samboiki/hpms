/**
 * A list of tariff codes as staff type it for a promotion or a package ("0190, 0191 8101"): split on commas and spaces,
 * upper case, each once, in the order typed. The database tidies and checks codes the same way (billing_codes,
 * proposals/2026-10-13-billing-extras.sql).
 */
import { codeKey } from './codeRules';

export const TARIFF_CODE_PATTERN = /^[A-Z0-9./-]{1,20}$/;

export function parseCodeList(text: string, max: number): { codes: string[]; error: null } | { codes: null; error: string } {
  const codes: string[] = [];
  for (const part of text.split(/[\s,;]+/)) {
    const code = codeKey(part);
    if (!code) continue;
    if (!TARIFF_CODE_PATTERN.test(code)) return { codes: null, error: `"${code.slice(0, 30)}" is not a tariff code (letters, digits, dots, dashes or slashes).` };
    if (!codes.includes(code)) codes.push(code);
  }
  if (codes.length === 0) return { codes: null, error: 'Give at least one code, for example 0190.' };
  if (codes.length > max) return { codes: null, error: `At most ${max} codes.` };
  return { codes, error: null };
}

/** "0190, 0191" */
export const formatCodeList = (codes: readonly string[]): string => codes.join(', ');

/** True when the line's code is one of the codes */
export const coversCode = (codes: readonly string[], code: string | null | undefined): boolean => codes.includes(codeKey(code));
