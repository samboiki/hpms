import {
  UNKNOWN_ADMINISTRATOR,
  creditByPayer,
  familyAccounts,
  flagKindsByPatient,
  holderByPatient,
  type AccountFlag,
  type AccountHolderLink,
  type AgeAnalysisContext,
  type ArReceipt
} from '../../../services/ledgerService';
import { identifyFund } from '../../../utils/remittance/funds';
import type { PracticePayerData } from '../../../services/payerAccountService';

/**
 * One way to build the age analysis context for every screen (Debtors, Reports, the month-end
 * pack), so an account, a fund or an administrator means the same thing everywhere.
 */

const ADMINISTRATOR_LABELS: Record<string, string> = {
  methealth: 'Methealth Namibia',
  medscheme: 'Medscheme Namibia',
  switchon: 'SwitchOn'
};

/** One spelling per fund ("NHP", "Namibia Health Plan" -> "Namibia Health Plan (NHP)"); unknown funds as written */
export const canonicalFund = (name: string): string => identifyFund(name)?.label ?? name.trim();

/** The administrator that runs a fund (Methealth for PSEMAS and NMC, Medscheme for NHP and NAMMED) */
export function administratorOf(fund: string): string {
  const administrator = identifyFund(fund)?.administrator;
  return (administrator && ADMINISTRATOR_LABELS[administrator]) || UNKNOWN_ADMINISTRATOR;
}

export interface AgeContextInput {
  patientNames: Readonly<Record<string, string>>;
  /** medical_aid_details.provider per patient, as stored */
  schemeByPatient: Readonly<Record<string, string>>;
  optionByPatient?: Readonly<Record<string, string>>;
  links?: readonly AccountHolderLink[];
  flags?: readonly AccountFlag[];
  /** Receipts with unallocated money (credit and fund suspense) */
  receipts?: readonly ArReceipt[];
  /**
   * The workspace's company and fund accounts (FinanceWorkspace.payers; undefined before they are loaded). Required,
   * so no screen builds an age analysis that counts an account's invoices under its patient (parity A14, A19)
   */
  payers: Pick<PracticePayerData, 'byInvoice'> | undefined;
}

export function ageContext(input: AgeContextInput): AgeAnalysisContext {
  const fundByPatient = Object.fromEntries(Object.entries(input.schemeByPatient).map(([patientId, fund]) => [patientId, canonicalFund(fund)]));
  const credit = creditByPayer(input.receipts ?? []);
  const creditByFund: Record<string, number> = {};
  for (const [fund, cents] of Object.entries(credit.byFund)) {
    const key = canonicalFund(fund);
    creditByFund[key] = (creditByFund[key] ?? 0) + cents;
  }
  const family = familyAccounts(input.links ?? []);
  const patientIds = [...new Set([...Object.keys(input.patientNames), ...(input.flags ?? []).map(flag => flag.patientId)])];
  return {
    patientNames: input.patientNames,
    fundByPatient,
    optionByPatient: input.optionByPatient,
    holderByPatient: holderByPatient(input.links ?? []),
    administratorOf,
    flagsByPatient: flagKindsByPatient({ patientIds, holderOf: family.holderOf, flags: input.flags ?? [] }),
    creditByPatient: credit.byPatient,
    creditByFund,
    // An invoice billed to a company or fund account is on the account's row in every age analysis
    payerByInvoice: input.payers?.byInvoice ?? {}
  };
}
