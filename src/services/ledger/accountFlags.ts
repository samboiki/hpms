import { formatNad, fromCents } from '../../utils/billing/money';
import { toCents } from './money';
import type { RuleResult } from './arRules';

// ---------------------------------------------------------------------------------------------
// Account flags: the one model for what staff must know about an account before they bill,
// claim, message or chase it (account_flags in proposals/2026-10-07-debtors-and-controls.sql).
//
// Account flags (cash only, dispute, handed over, credit limit, no statements, statement
// language, no interest, lay-bye) belong to whoever pays: on a family account they are set on the
// account holder and every member shows them. Patient flags (do not claim, alert) belong to the
// patient file they are set on. "No SMS" is the patient's SMS opt-out (patients.sms_opt_out, also
// set by a STOP reply): one store, so the SMS gateway and this screen can never disagree.
// "No interest" and "Lay-bye": proposals/2026-10-09-account-flags-billing.sql.
// ---------------------------------------------------------------------------------------------

export type AccountFlagKind =
  | 'cash_only'
  | 'no_claims'
  | 'dispute'
  | 'handed_over'
  | 'credit_limit'
  | 'no_statement'
  | 'statement_language'
  | 'alert'
  | 'no_interest'
  | 'lay_bye'
  | 'statement_message';

/** Every flag shown on a patient: the stored ones and the SMS opt-out */
export type FlagKind = AccountFlagKind | 'no_sms';

export type StatementLanguage = 'en' | 'af';
export const STATEMENT_LANGUAGES: ReadonlyArray<{ value: StatementLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'af', label: 'Afrikaans' }
];

export interface FlagDefinition {
  kind: FlagKind;
  label: string;
  /** One line on what it does, shown where it is set */
  meaning: string;
  /** account: set on whoever pays and shown on every family member; patient: this file only */
  level: 'account' | 'patient';
  value: 'none' | 'amount' | 'language' | 'text';
  /** A reason must be given when it is set or cleared */
  needsReason: boolean;
  /** Only these roles may set or clear it (empty = any staff member) */
  roles: readonly string[];
  tone: 'red' | 'amber' | 'violet' | 'gray' | 'cyan';
  icon: string;
}

export const FLAG_DEFINITIONS: Readonly<Record<FlagKind, FlagDefinition>> = {
  alert: {
    kind: 'alert', label: 'Account alert', meaning: 'A note about the account or paying that every staff member sees (clinical alerts belong on the safety strip)', level: 'patient', value: 'text',
    needsReason: false, roles: [], tone: 'amber', icon: 'solar:danger-triangle-bold-duotone'
  },
  cash_only: {
    kind: 'cash_only', label: 'Cash only', meaning: 'Payment is taken when the service is given; no credit', level: 'account', value: 'none',
    needsReason: true, roles: [], tone: 'amber', icon: 'solar:wallet-money-bold-duotone'
  },
  no_claims: {
    kind: 'no_claims', label: 'Do not claim', meaning: 'Do not send this patient\'s invoices to a medical aid', level: 'patient', value: 'none',
    needsReason: true, roles: [], tone: 'violet', icon: 'solar:shield-cross-bold-duotone'
  },
  dispute: {
    kind: 'dispute', label: 'In dispute', meaning: 'The account is queried: no interest, statements as the run says', level: 'account', value: 'none',
    needsReason: true, roles: [], tone: 'violet', icon: 'solar:chat-round-dots-bold-duotone'
  },
  handed_over: {
    kind: 'handed_over', label: 'Handed over', meaning: 'With a debt collector: left out of statements, interest and the work list', level: 'account', value: 'none',
    needsReason: true, roles: ['admin', 'doctor'], tone: 'red', icon: 'solar:user-hand-up-bold-duotone'
  },
  credit_limit: {
    kind: 'credit_limit', label: 'Credit limit', meaning: 'The most the account may owe; staff are warned above it', level: 'account', value: 'amount',
    needsReason: false, roles: ['admin', 'doctor'], tone: 'cyan', icon: 'solar:card-recive-bold-duotone'
  },
  no_statement: {
    kind: 'no_statement', label: 'No statements', meaning: 'Statement runs skip this account', level: 'account', value: 'none',
    needsReason: true, roles: [], tone: 'gray', icon: 'solar:bill-cross-bold-duotone'
  },
  statement_language: {
    kind: 'statement_language', label: 'Statement language', meaning: 'Statements and statement SMS in this language', level: 'account', value: 'language',
    needsReason: false, roles: [], tone: 'gray', icon: 'solar:translation-bold-duotone'
  },
  no_interest: {
    kind: 'no_interest', label: 'No interest', meaning: 'Interest runs leave this account out', level: 'account', value: 'none',
    needsReason: true, roles: ['admin', 'doctor'], tone: 'gray', icon: 'solar:sale-bold-duotone'
  },
  lay_bye: {
    kind: 'lay_bye', label: 'Lay-bye', meaning: 'Paid off as agreed (for example glasses kept until paid): no interest, and statements show what is left to pay, not what is overdue', level: 'account', value: 'none',
    needsReason: true, roles: [], tone: 'cyan', icon: 'solar:bag-check-bold-duotone'
  },
  statement_message: {
    kind: 'statement_message', label: 'Statement message', meaning: 'Printed on every statement of this account, for example an arrangement to pay', level: 'account', value: 'text',
    needsReason: false, roles: [], tone: 'gray', icon: 'solar:document-text-bold-duotone'
  },
  no_sms: {
    kind: 'no_sms', label: 'No SMS', meaning: 'The patient opted out: only essential messages (appointments, receipts) are sent', level: 'patient', value: 'none',
    needsReason: false, roles: [], tone: 'gray', icon: 'solar:chat-square-call-bold-duotone'
  }
};

/** In the order a badge row shows them: what stops staff doing something wrong first */
export const FLAG_ORDER: readonly FlagKind[] = ['alert', 'handed_over', 'dispute', 'cash_only', 'credit_limit', 'no_claims', 'lay_bye', 'no_interest', 'no_statement', 'no_sms', 'statement_language', 'statement_message'];

const STORED_KINDS: readonly AccountFlagKind[] = ['cash_only', 'no_claims', 'dispute', 'handed_over', 'credit_limit', 'no_statement', 'statement_language', 'alert', 'no_interest', 'lay_bye', 'statement_message'];

/**
 * The flags that matter where people book and bill (the visit's Billing tab, diary cards, invoices): what
 * changes how the visit is charged or paid. Statement, SMS and interest settings stay on the patient file.
 */
export const BILLING_FLAG_KINDS: readonly FlagKind[] = ['alert', 'handed_over', 'dispute', 'cash_only', 'credit_limit', 'no_claims', 'lay_bye'];

export const billingFlags = (flags: readonly EffectiveFlag[]): EffectiveFlag[] => flags.filter(flag => BILLING_FLAG_KINDS.includes(flag.kind));

/** A diary card's one icon says which flags apply, for the tooltip and screen readers: "Account: Cash only, In dispute" */
export function flagSummaryText(kinds: readonly FlagKind[]): string | null {
  const shown = FLAG_ORDER.filter(kind => kinds.includes(kind) && BILLING_FLAG_KINDS.includes(kind));
  return shown.length > 0 ? `Account: ${shown.map(kind => FLAG_DEFINITIONS[kind].label).join(', ')}` : null;
}
export const ALERT_MAX_LENGTH = 280;
/** The longest message per account printed on its statements (parity I8; the database allows 3 to 280 characters) */
export const ACCOUNT_STATEMENT_MESSAGE_MAX = 280;

export interface AccountFlag {
  id: string;
  /** The patient file the flag was set on (the account holder for account flags) */
  patientId: string;
  flag: AccountFlagKind;
  /** credit_limit */
  amountCents: number | null;
  /** statement_language code, or the alert text */
  value: string | null;
  reason: string;
  setBy: string | null;
  setAt: string;
  clearedAt: string | null;
  clearedBy: string | null;
  clearReason: string | null;
}

export interface RawAccountFlagRow {
  id: string;
  patient_id?: string | null;
  flag?: string | null;
  amount?: number | string | null;
  value?: string | null;
  reason?: string | null;
  set_by?: string | null;
  set_at?: string | null;
  cleared_at?: string | null;
  cleared_by?: string | null;
  clear_reason?: string | null;
}

export function normalizeAccountFlag(row: RawAccountFlagRow): AccountFlag | null {
  if (!row.patient_id || !row.set_at || !STORED_KINDS.includes(row.flag as AccountFlagKind)) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    flag: row.flag as AccountFlagKind,
    amountCents: row.amount === null || row.amount === undefined ? null : toCents(row.amount),
    value: row.value?.trim() || null,
    reason: row.reason?.trim() || '',
    setBy: row.set_by ?? null,
    setAt: row.set_at,
    clearedAt: row.cleared_at ?? null,
    clearedBy: row.cleared_by ?? null,
    clearReason: row.clear_reason?.trim() || null
  };
}

/** A flag as it applies to one patient */
export interface EffectiveFlag {
  kind: FlagKind;
  label: string;
  /** e.g. the alert text, "N$ 2,000.00", "Afrikaans" */
  detail: string | null;
  /** Set on the account holder's file, not this one */
  inherited: boolean;
  /** The patient file it is set on (null for the SMS opt-out) */
  setOn: string | null;
  flag: AccountFlag | null;
}

const languageLabel = (value: string | null): string => STATEMENT_LANGUAGES.find(language => language.value === value)?.label ?? 'English';

function detailOf(flag: AccountFlag): string | null {
  if (flag.flag === 'credit_limit') return flag.amountCents === null ? null : formatNad(fromCents(flag.amountCents));
  if (flag.flag === 'statement_language') return languageLabel(flag.value);
  if (flag.flag === 'alert' || flag.flag === 'statement_message') return flag.value;
  return null;
}

/** The flags in force on a patient file (cleared flags are history) */
const activeOn = (patientId: string, flags: readonly AccountFlag[]): AccountFlag[] =>
  flags.filter(flag => flag.patientId === patientId && !flag.clearedAt);

/**
 * The flags that apply to a patient: the patient's own patient flags, the account flags of whoever
 * pays (the account holder of a family account, else the patient), and the SMS opt-out. In badge order.
 */
export function effectiveFlags(input: { patientId: string; holderId: string | null; flags: readonly AccountFlag[]; smsOptOut: boolean }): EffectiveFlag[] {
  const payer = input.holderId ?? input.patientId;
  const result: EffectiveFlag[] = [];
  for (const flag of activeOn(input.patientId, input.flags)) {
    if (FLAG_DEFINITIONS[flag.flag].level === 'patient') result.push({ kind: flag.flag, label: FLAG_DEFINITIONS[flag.flag].label, detail: detailOf(flag), inherited: false, setOn: flag.patientId, flag });
  }
  for (const flag of activeOn(payer, input.flags)) {
    if (FLAG_DEFINITIONS[flag.flag].level === 'account') result.push({ kind: flag.flag, label: FLAG_DEFINITIONS[flag.flag].label, detail: detailOf(flag), inherited: payer !== input.patientId, setOn: flag.patientId, flag });
  }
  if (input.smsOptOut) result.push({ kind: 'no_sms', label: FLAG_DEFINITIONS.no_sms.label, detail: null, inherited: false, setOn: null, flag: null });
  return result.sort((a, b) => FLAG_ORDER.indexOf(a.kind) - FLAG_ORDER.indexOf(b.kind));
}

/** Flag kinds in force per patient, account flags inherited from the account holder (for lists and filters) */
export function flagKindsByPatient(input: { patientIds: readonly string[]; holderOf: (patientId: string) => string | null; flags: readonly AccountFlag[] }): Record<string, AccountFlagKind[]> {
  const byPatient: Record<string, AccountFlagKind[]> = {};
  for (const patientId of input.patientIds) {
    const kinds = effectiveFlags({ patientId, holderId: input.holderOf(patientId), flags: input.flags, smsOptOut: false })
      .map(flag => flag.kind)
      .filter((kind): kind is AccountFlagKind => kind !== 'no_sms');
    if (kinds.length > 0) byPatient[patientId] = kinds;
  }
  return byPatient;
}

/** The file an account flag is stored on: the account holder's for account flags, the patient's own otherwise */
export const flagTarget = (kind: AccountFlagKind, patientId: string, holderId: string | null): string =>
  FLAG_DEFINITIONS[kind].level === 'account' ? holderId ?? patientId : patientId;

export interface FlagChange {
  kind: AccountFlagKind;
  /** true to set (or change the value), false to clear */
  setting: boolean;
  amountCents?: number | null;
  value?: string | null;
  reason: string;
}

/**
 * A flag change before it is saved (the database checks the same): who may make it, the value it
 * needs, and a reason where it carries consequences (cash only, dispute, hand-over, do not claim,
 * no statements) because it is kept with the account.
 */
export function checkFlagChange(change: FlagChange, current: AccountFlag | null, role: string | null | undefined): RuleResult {
  const definition = FLAG_DEFINITIONS[change.kind];
  if (definition.roles.length > 0 && !definition.roles.includes(role ?? '')) {
    return { ok: false, error: `Only a practice ${definition.roles.join(' or ')} can ${change.setting ? 'set' : 'clear'} "${definition.label}"` };
  }
  if (!change.setting && !current) return { ok: false, error: `This account has no "${definition.label}" flag` };
  if (change.setting) {
    if (definition.value === 'none' && current) return { ok: false, error: `"${definition.label}" is already set` };
    if (definition.value === 'amount' && (change.amountCents === null || change.amountCents === undefined || !Number.isInteger(change.amountCents) || change.amountCents <= 0)) {
      return { ok: false, error: 'Enter the credit limit in N$ and cents' };
    }
    if (definition.value === 'language' && !STATEMENT_LANGUAGES.some(language => language.value === change.value)) return { ok: false, error: 'Choose the statement language' };
    if (definition.value === 'text') {
      const text = change.value?.trim() ?? '';
      const message = change.kind === 'statement_message';
      if (text.length < 3) return { ok: false, error: message ? 'Write the message for this account\'s statements' : 'Write the alert staff must see' };
      if (message ? text.length > ACCOUNT_STATEMENT_MESSAGE_MAX : text.length > ALERT_MAX_LENGTH) {
        return { ok: false, error: message ? `Keep the message under ${ACCOUNT_STATEMENT_MESSAGE_MAX} characters` : `Keep the alert under ${ALERT_MAX_LENGTH} characters` };
      }
    }
    if (current && definition.value !== 'none' && valueOf(current) === valueOf({ amountCents: change.amountCents ?? null, value: change.value?.trim() || null })) {
      return { ok: false, error: 'Nothing changed' };
    }
  }
  if (definition.needsReason && change.reason.trim().length < 3) return { ok: false, error: 'Give a reason: it is kept with the account' };
  return { ok: true, error: null };
}

const valueOf = (flag: Pick<AccountFlag, 'amountCents' | 'value'>): string => `${flag.amountCents ?? ''}|${flag.value ?? ''}`;

export interface CreditLimitStatus {
  limitCents: number;
  /** What the account owes now (patient portions, less unallocated credit) */
  owedCents: number;
  /** owed - limit when positive */
  overCents: number;
  over: boolean;
}

/** Whether an account is over its credit limit; null when it has none */
export function creditLimitStatus(flags: readonly EffectiveFlag[], owedCents: number): CreditLimitStatus | null {
  const limit = flags.find(flag => flag.kind === 'credit_limit')?.flag?.amountCents ?? null;
  if (limit === null) return null;
  const overCents = Math.max(owedCents - limit, 0);
  return { limitCents: limit, owedCents, overCents, over: overCents > 0 };
}

/** Who may invoice above a credit limit: practice administrators (dc_record_credit_limit_override checks the same) */
export const CREDIT_LIMIT_OVERRIDE_ROLES: readonly string[] = ['admin'];

export interface InvoiceFlagCheck {
  /** Cash only: the invoice is the patient's and nothing is claimed from a medical aid; staff confirm first */
  cashOnly: boolean;
  /** What the patient pays on the invoice: all of it on a cash-only account */
  patientCents: number;
  /** The invoice takes the account above its credit limit */
  overLimit: { limitCents: number; owedCents: number; afterCents: number; overCents: number } | null;
  /** The signed-in person may go over the limit, with a reason */
  canOverride: boolean;
  /** Something to confirm before the invoice is saved */
  needsConfirmation: boolean;
}

/**
 * The flags checked when an invoice is saved. Cash only: the whole invoice is the patient's and is not
 * claimed. Credit limit: what the account owes (patient portions less unallocated credit), less what an
 * invoice being changed already counted for, plus what the patient owes on the invoice, may not go above
 * the limit; only an administrator may go over it, with a reason. An invoice that adds nothing to what the
 * patient owes never trips the limit.
 */
export function checkInvoiceFlags(input: {
  flags: readonly EffectiveFlag[];
  /** What the account owes now; null when it cannot be read (then the limit is not checked) */
  owedCents: number | null;
  invoice: { totalCents: number; patientCents: number };
  /** An invoice being changed: what its patient portion already adds to owedCents */
  replacingPatientCents?: number;
  role: string | null | undefined;
}): InvoiceFlagCheck {
  const cashOnly = input.flags.some(flag => flag.kind === 'cash_only');
  const patientCents = Math.max(cashOnly ? input.invoice.totalCents : input.invoice.patientCents, 0);
  const limitCents = input.flags.find(flag => flag.kind === 'credit_limit')?.flag?.amountCents ?? null;
  const addedCents = patientCents - Math.max(input.replacingPatientCents ?? 0, 0);
  let overLimit: InvoiceFlagCheck['overLimit'] = null;
  if (limitCents !== null && input.owedCents !== null && addedCents > 0) {
    const afterCents = input.owedCents + addedCents;
    if (afterCents > limitCents) overLimit = { limitCents, owedCents: input.owedCents, afterCents, overCents: afterCents - limitCents };
  }
  return {
    cashOnly,
    patientCents,
    overLimit,
    canOverride: CREDIT_LIMIT_OVERRIDE_ROLES.includes(input.role ?? ''),
    needsConfirmation: cashOnly || overLimit !== null
  };
}

/** An administrator's reason for going over a credit limit, kept on the account; null when it will do */
export const overrideReasonProblem = (reason: string): string | null =>
  reason.trim().length < 3 ? 'Give a reason: it is kept with the account' : null;

/** The language statements of this account are written in */
export const statementLanguageOf = (flags: readonly EffectiveFlag[]): StatementLanguage =>
  flags.find(flag => flag.kind === 'statement_language')?.flag?.value === 'af' ? 'af' : 'en';

/** The account's own message for its statements (parity I8); null when it has none */
export const statementMessageOf = (flags: readonly EffectiveFlag[]): string | null =>
  flags.find(flag => flag.kind === 'statement_message')?.flag?.value?.trim() || null;

/** Each account's statement message by the account holder's patient id, from the flags in force (statement runs) */
export function statementMessagesByAccount(flags: readonly AccountFlag[]): Record<string, string> {
  const byAccount: Record<string, string> = {};
  for (const flag of flags) {
    if (flag.flag === 'statement_message' && !flag.clearedAt && flag.value?.trim()) byAccount[flag.patientId] = flag.value.trim();
  }
  return byAccount;
}

/** Flags that keep an account out of debt collection work (interest, statements as chosen, the work list) */
export const isHandedOver = (kinds: readonly string[]): boolean => kinds.includes('handed_over');
