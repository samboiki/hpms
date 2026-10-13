/**
 * Which fund a document is from, and how it relates to the fund codes on the practice's claim files
 * (batch_headers.medical_aid_reference): MAG1 = PSEMAS, NMC1 = Namibia Medical Care, NHPM = Namibia
 * Health Plan, NAMM = NAMMED, PROS = Prosperity. Older setups used other names for the same fund
 * (PSEMAS, NMC, NHP), so comparisons go through the aliases.
 *
 * Methealth Namibia administers NMC and PSEMAS (same statement layout); Medscheme administers NHP and
 * NAMMED (same advice layout). A fund not listed here still imports: its code stays unknown and its
 * claims are matched without a fund filter.
 */
// .ts: utils/billing/fundRules.ts imports this file and is read by a Deno function too
import type { Administrator } from './types.ts';

export interface FundIdentity {
  code: string;
  label: string;
  administrator: Administrator;
  /** medical_aid_reference values (and short names on documents) meaning this fund */
  aliases: readonly string[];
  namePattern: RegExp;
  /** Start of the fund's payment references ("NHP0000000-12") */
  paymentPrefix?: string;
}

export const FUND_IDENTITIES: readonly FundIdentity[] = [
  { code: 'MAG1', label: 'PSEMAS', administrator: 'methealth', aliases: ['MAG1', 'PSEMAS', 'PSM'], namePattern: /psemas|public service employees?'? medical/i },
  { code: 'NMC1', label: 'Namibia Medical Care (NMC)', administrator: 'methealth', aliases: ['NMC1', 'NMC'], namePattern: /namibia medical care|\bnmc\b/i },
  { code: 'NHPM', label: 'Namibia Health Plan (NHP)', administrator: 'medscheme', aliases: ['NHPM', 'NHP'], namePattern: /namibia health plan|\bnhp\b/i, paymentPrefix: 'NHP' },
  { code: 'NAMM', label: 'NAMMED', administrator: 'medscheme', aliases: ['NAMM', 'NAMMED', 'NMD'], namePattern: /nammed/i, paymentPrefix: 'NMD' },
  { code: 'PROS', label: 'Prosperity Health', administrator: 'unknown', aliases: ['PROS'], namePattern: /prosperity/i }
];

const byAlias = (value: string): FundIdentity | undefined => {
  const key = value.trim().toUpperCase();
  return FUND_IDENTITIES.find(fund => fund.aliases.includes(key));
};

/** The fund named by a code ("MAG1", "NMC"), a printed name ("Namibia Health Plan") or a payment reference ("NMD...") */
export function identifyFund(...hints: ReadonlyArray<string | null | undefined>): FundIdentity | null {
  for (const hint of hints) {
    const text = (hint ?? '').trim();
    if (!text) continue;
    const alias = byAlias(text);
    if (alias) return alias;
    const named = FUND_IDENTITIES.find(fund => fund.namePattern.test(text));
    if (named) return named;
    const prefixed = FUND_IDENTITIES.find(fund => fund.paymentPrefix && text.toUpperCase().startsWith(fund.paymentPrefix));
    if (prefixed) return prefixed;
  }
  return null;
}

/** True when two fund codes or names mean the same fund ("MAG1" and "PSEMAS") */
export function sameFund(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.trim().toUpperCase() === b.trim().toUpperCase()) return true;
  const left = identifyFund(a);
  return !!left && left === identifyFund(b);
}

/** Every medical_aid_reference that may hold this fund's batches */
export function fundAliases(code: string | null | undefined): string[] {
  if (!code) return [];
  const fund = identifyFund(code);
  return fund ? [...fund.aliases] : [code.trim().toUpperCase()];
}

export const fundLabel = (code: string | null | undefined, fallback?: string | null): string =>
  identifyFund(code)?.label ?? fallback ?? code ?? 'Unknown fund';
