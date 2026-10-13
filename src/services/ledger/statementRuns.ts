import { addMonths, format, isValid, parseISO, startOfMonth } from 'date-fns';
import { formatNad, fromCents } from '../../utils/billing/money';
import { toDateKey } from './dates';
import type { RuleResult } from './arRules';
import { AGE_BANDS, ageBandFor } from './receivables';
import type { AgeAnalysisRow } from './ageAnalysis';
import type { AccountFlagKind, StatementLanguage } from './accountFlags';

// ---------------------------------------------------------------------------------------------
// Statement runs: saved criteria (Eminance's "statement keys", e.g. every account over N$ 100
// older than 30 days), which accounts a run sends to, by which channel and in which language, and
// the short SMS text. A family account gets one statement, to its account holder. Sending always
// goes through communicationService (logged, counted, opt-outs respected). Statements are never
// protected with a password made from the date of birth.
// ---------------------------------------------------------------------------------------------

export type StatementChannel = 'email' | 'sms' | 'print';
export const STATEMENT_CHANNEL_LABELS: Record<StatementChannel, string> = { email: 'Email', sms: 'SMS', print: 'Print' };

export interface StatementCriteria {
  name: string;
  /** Only accounts owing at least this much (cents) */
  minBalanceCents: number;
  /** Only accounts owing something at least this many days old (0 = any) */
  minAgeDays: number;
  /** patient: what patients owe themselves (the usual statement); both: the whole account */
  portion: 'patient' | 'both';
  /** Only accounts with a member of these funds (empty = every account, private patients included) */
  funds: string[];
  excludeDisputed: boolean;
  excludeHandedOver: boolean;
  /** Channels in order of preference; an account gets the first one it has contact details for */
  channels: StatementChannel[];
  /** Printed on every statement of the run, e.g. "We close from 20 December to 3 January" */
  message: string;
  /** Months of history shown; older lines are one balance brought forward (0 = whole history) */
  historyMonths: number;
  /** Leave settled items off (parity D26): true or false for this run; null follows the practice's default */
  leaveSettledOff: boolean | null;
}

export const DEFAULT_STATEMENT_CRITERIA: StatementCriteria = {
  name: 'Monthly statements',
  minBalanceCents: 10000,
  minAgeDays: 30,
  portion: 'patient',
  funds: [],
  excludeDisputed: false,
  excludeHandedOver: true,
  channels: ['email', 'print'],
  message: '',
  historyMonths: 3,
  leaveSettledOff: null
};

/** Whether a run leaves settled items off: its own choice, else the practice's default */
export const runLeavesSettledOff = (criteria: Pick<StatementCriteria, 'leaveSettledOff'>, practiceDefault: boolean): boolean =>
  criteria.leaveSettledOff ?? practiceDefault;

export const STATEMENT_MESSAGE_MAX = 500;

export function checkStatementCriteria(criteria: StatementCriteria): RuleResult {
  if (!criteria.name.trim()) return { ok: false, error: 'Give the run a name, e.g. "Monthly statements"' };
  if (!Number.isInteger(criteria.minBalanceCents) || criteria.minBalanceCents < 0) return { ok: false, error: 'Enter the smallest balance in N$ and cents' };
  if (!Number.isInteger(criteria.minAgeDays) || criteria.minAgeDays < 0) return { ok: false, error: 'Enter the age in whole days' };
  if (criteria.channels.length === 0) return { ok: false, error: 'Choose at least one way to send the statements' };
  if (new Set(criteria.channels).size !== criteria.channels.length) return { ok: false, error: 'Each channel can be chosen once' };
  if (criteria.message.length > STATEMENT_MESSAGE_MAX) return { ok: false, error: `Keep the message under ${STATEMENT_MESSAGE_MAX} characters` };
  if (!Number.isInteger(criteria.historyMonths) || criteria.historyMonths < 0 || criteria.historyMonths > 36) return { ok: false, error: 'Show between 0 (everything) and 36 months of history' };
  return { ok: true, error: null };
}

const CHANNELS: readonly StatementChannel[] = ['email', 'sms', 'print'];

/** Saved criteria from JSON (statement_criteria.criteria); unknown or broken fields fall back to the defaults */
export function parseStatementCriteria(value: unknown, name?: string | null): StatementCriteria {
  const json = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const int = (key: string, fallback: number): number => (typeof json[key] === 'number' && Number.isInteger(json[key]) && (json[key] as number) >= 0 ? (json[key] as number) : fallback);
  const channels = Array.isArray(json.channels) ? json.channels.filter((c): c is StatementChannel => CHANNELS.includes(c as StatementChannel)) : [];
  return {
    name: name?.trim() || (typeof json.name === 'string' && json.name.trim()) || DEFAULT_STATEMENT_CRITERIA.name,
    minBalanceCents: int('min_balance_cents', DEFAULT_STATEMENT_CRITERIA.minBalanceCents),
    minAgeDays: int('min_age_days', DEFAULT_STATEMENT_CRITERIA.minAgeDays),
    portion: json.portion === 'both' ? 'both' : 'patient',
    funds: Array.isArray(json.funds) ? json.funds.filter((f): f is string => typeof f === 'string' && f.trim() !== '') : [],
    excludeDisputed: json.exclude_disputed === true,
    excludeHandedOver: json.exclude_handed_over !== false,
    channels: channels.length > 0 ? [...new Set(channels)] : [...DEFAULT_STATEMENT_CRITERIA.channels],
    message: typeof json.message === 'string' ? json.message.slice(0, STATEMENT_MESSAGE_MAX) : '',
    historyMonths: Math.min(int('history_months', DEFAULT_STATEMENT_CRITERIA.historyMonths), 36),
    // Runs saved before the choice existed follow the practice's default
    leaveSettledOff: typeof json.leave_settled_off === 'boolean' ? json.leave_settled_off : null
  };
}

export function statementCriteriaJson(criteria: StatementCriteria): Record<string, unknown> {
  return {
    min_balance_cents: criteria.minBalanceCents,
    min_age_days: criteria.minAgeDays,
    portion: criteria.portion,
    funds: criteria.funds,
    exclude_disputed: criteria.excludeDisputed,
    exclude_handed_over: criteria.excludeHandedOver,
    channels: criteria.channels,
    message: criteria.message.trim(),
    history_months: criteria.historyMonths,
    leave_settled_off: criteria.leaveSettledOff
  };
}

/** Contact details of an account holder */
export interface StatementContact {
  email: string | null;
  cellNumber: string | null;
}

export interface PlannedStatement {
  /** The account: the account holder's patient id (the patient when they pay for themselves) */
  patientId: string;
  name: string;
  /** Patients on the account with something owed: the statement lists their invoices */
  memberIds: string[];
  channel: StatementChannel;
  language: StatementLanguage;
  /** Email address or cell number; null for print */
  to: string | null;
  owedCents: number;
  /** owed - unallocated credit */
  netCents: number;
  oldestAgeDays: number | null;
}

export type StatementSkipReason = 'no_statement' | 'disputed' | 'handed_over' | 'below_minimum' | 'too_recent' | 'other_fund' | 'in_credit' | 'no_channel';

export const STATEMENT_SKIP_LABELS: Record<StatementSkipReason, string> = {
  no_statement: 'Marked "no statements"',
  disputed: 'In dispute',
  handed_over: 'Handed over',
  below_minimum: 'Owes less than the minimum',
  too_recent: 'Nothing old enough',
  other_fund: 'Another fund',
  in_credit: 'Credit covers the balance',
  no_channel: 'No email or cell number, and print is not chosen'
};

export interface StatementPlan {
  statements: PlannedStatement[];
  skipped: Array<{ patientId: string; name: string; reason: StatementSkipReason }>;
  counts: Record<StatementChannel, number>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailOf = (contact: StatementContact | undefined): string | null => {
  const email = contact?.email?.trim() ?? '';
  return EMAIL.test(email) ? email : null;
};
const cellOf = (contact: StatementContact | undefined): string | null => {
  const cell = contact?.cellNumber?.trim() ?? '';
  return cell.replace(/\D/g, '').length >= 7 ? cell : null;
};

/**
 * Who gets a statement in a run, and how. Rows are the age analysis by account (a family account
 * is one statement to its holder) in the run's portion. An account flagged "no statements" never
 * gets one; disputed and handed-over accounts as the criteria say; an account whose credit covers
 * what it owes gets none (it owes nothing). A lay-bye is paid off as agreed, so nothing on it is
 * overdue: the run's minimum age does not keep it from its statement. Contacts and languages are
 * the account holder's.
 */
export function planStatementRun(input: {
  accounts: readonly AgeAnalysisRow[];
  criteria: StatementCriteria;
  contacts: Readonly<Record<string, StatementContact>>;
  fundByPatient: Readonly<Record<string, string>>;
  languageByAccount?: Readonly<Record<string, StatementLanguage>>;
}): StatementPlan {
  const { criteria } = input;
  const plan: StatementPlan = { statements: [], skipped: [], counts: { email: 0, sms: 0, print: 0 } };
  const minBand = AGE_BANDS.findIndex(band => band.key === ageBandFor(criteria.minAgeDays));
  const funds = new Set(criteria.funds.map(fund => fund.trim().toLowerCase()));
  for (const account of input.accounts) {
    const patientId = account.accountId;
    if (!patientId) continue;
    const skip = (reason: StatementSkipReason) => plan.skipped.push({ patientId, name: account.label, reason });
    const flags: readonly AccountFlagKind[] = account.flags;
    if (flags.includes('no_statement')) { skip('no_statement'); continue; }
    if (criteria.excludeDisputed && flags.includes('dispute')) { skip('disputed'); continue; }
    if (criteria.excludeHandedOver && flags.includes('handed_over')) { skip('handed_over'); continue; }
    if (funds.size > 0 && ![patientId, ...account.patientIds].some(id => funds.has((input.fundByPatient[id] ?? '').trim().toLowerCase()))) { skip('other_fund'); continue; }
    if (account.owedCents <= 0 || account.owedCents < criteria.minBalanceCents) { skip('below_minimum'); continue; }
    if (criteria.minAgeDays > 0 && !flags.includes('lay_bye') && !AGE_BANDS.slice(minBand).some(band => account.bands[band.key] > 0)) { skip('too_recent'); continue; }
    if (account.netCents <= 0) { skip('in_credit'); continue; }
    const contact = input.contacts[patientId];
    const routes: Record<StatementChannel, string | null | false> = { email: emailOf(contact), sms: cellOf(contact), print: null };
    const channel = criteria.channels.find(option => option === 'print' || !!routes[option]);
    if (!channel) { skip('no_channel'); continue; }
    plan.statements.push({
      patientId,
      name: account.label,
      memberIds: account.patientIds,
      channel,
      language: input.languageByAccount?.[patientId] ?? 'en',
      to: channel === 'print' ? null : (routes[channel] as string),
      owedCents: account.owedCents,
      netCents: account.netCents,
      oldestAgeDays: account.oldestAgeDays
    });
    plan.counts[channel] += 1;
  }
  plan.statements.sort((a, b) => a.name.localeCompare(b.name));
  return plan;
}

/** The first day a statement shows: history months back from the start of this month; null = whole history */
export function statementFromKey(asAtKey: string, historyMonths: number): string | null {
  if (historyMonths <= 0) return null;
  const asAt = parseISO(asAtKey);
  if (!isValid(asAt)) return null;
  return toDateKey(addMonths(startOfMonth(asAt), -(historyMonths - 1)));
}

// ---------------------------------------------------------------------------------------------
// Words in the statement's language (English and Afrikaans, as Eminance offered)
// ---------------------------------------------------------------------------------------------

const SMS_WORDS: Record<StatementLanguage, { balance: string; is: string; payTo: string; account: string; number: string; branch: string; reference: string; Reference: string; queries: string }> = {
  en: { balance: 'your account balance on', is: 'is', payTo: 'Pay to', account: 'account', number: 'no.', branch: 'branch', reference: 'reference', Reference: 'Reference', queries: 'Queries' },
  af: { balance: 'u rekeningsaldo op', is: 'is', payTo: 'Betaal aan', account: 'rekening', number: 'nr.', branch: 'tak', reference: 'verwysing', Reference: 'Verwysing', queries: 'Navrae' }
};

const AF_MONTHS = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];

/** A day-first date in the statement's language: "7 Oct 2026", "7 Okt 2026" */
export function statementDate(dateKey: string, language: StatementLanguage = 'en'): string {
  const date = parseISO(dateKey);
  if (!isValid(date)) return dateKey;
  return language === 'af' ? `${date.getDate()} ${AF_MONTHS[date.getMonth()]} ${date.getFullYear()}` : format(date, 'd MMM yyyy');
}

/** Practice banking details for "how to pay" on statements and reminders */
export interface PaymentDetails {
  bankName: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  branchCode: string | null;
}

export function paymentDetailsText(details: PaymentDetails | null, reference: string | null, language: StatementLanguage = 'en'): string | null {
  if (!details?.bankName || !details.accountNumber) return null;
  const words = SMS_WORDS[language];
  const parts = [details.bankName, details.accountHolder ? `${words.account} ${details.accountHolder}` : null, `${words.number} ${details.accountNumber}`, details.branchCode ? `${words.branch} ${details.branchCode}` : null];
  return `${words.payTo} ${parts.filter(Boolean).join(', ')}${reference ? `, ${words.reference} ${reference}` : ''}.`;
}

export type ReminderLevel = 'gentle' | 'overdue' | 'final';

/** How firm a reminder is, from the age of the oldest debt: under 60 days gentle, 60-89 overdue, 90+ final */
export const reminderLevel = (oldestAgeDays: number | null): ReminderLevel =>
  oldestAgeDays === null || oldestAgeDays >= 90 ? 'final' : oldestAgeDays >= 60 ? 'overdue' : 'gentle';

const REMINDER_WORDS: Record<StatementLanguage, Record<ReminderLevel, (amount: string) => string>> = {
  en: {
    gentle: amount => `a reminder that your account balance is ${amount}.`,
    overdue: amount => `your account balance of ${amount} is overdue. Please pay it now.`,
    final: amount => `your account balance of ${amount} is more than 90 days overdue. Please pay it or contact us today.`
  },
  af: {
    gentle: amount => `'n herinnering dat u rekeningsaldo ${amount} is.`,
    overdue: amount => `u rekeningsaldo van ${amount} is agterstallig. Betaal dit asseblief nou.`,
    final: amount => `u rekeningsaldo van ${amount} is meer as 90 dae agterstallig. Betaal dit asseblief of kontak ons vandag.`
  }
};

/**
 * A debt reminder SMS, firmer as the debt ages (Eminance's 30/60/90-day reminder templates), with
 * how to pay and the account reference. No medical details, no link. In the account's language.
 */
export function reminderSmsText(input: { practiceName: string; owedCents: number; oldestAgeDays: number | null; reference: string | null; payment: PaymentDetails | null; contactPhone?: string | null; language?: StatementLanguage }): string {
  const language = input.language ?? 'en';
  const words = SMS_WORDS[language];
  const pay = paymentDetailsText(input.payment, input.reference, language);
  const howToPay = pay ? ` ${pay}` : input.reference ? ` ${words.Reference} ${input.reference}.` : '';
  const queries = input.contactPhone ? ` ${words.queries}: ${input.contactPhone}.` : '';
  return `${input.practiceName}: ${REMINDER_WORDS[language][reminderLevel(input.oldestAgeDays)](formatNad(fromCents(input.owedCents)))}${howToPay}${queries}`;
}

/**
 * The statement SMS: practice, balance, as-at date and how to pay, in the account's language; no
 * medical details and no link. Kept to two SMS parts where it can be by leaving the run message out
 * when it does not fit.
 */
export function statementSmsText(input: {
  practiceName: string;
  balanceCents: number;
  asAtKey: string;
  reference: string | null;
  payment: PaymentDetails | null;
  message?: string;
  contactPhone?: string | null;
  language?: StatementLanguage;
}): string {
  const language = input.language ?? 'en';
  const words = SMS_WORDS[language];
  const pay = paymentDetailsText(input.payment, input.reference, language);
  const howToPay = pay ? ` ${pay}` : input.reference ? ` ${words.Reference} ${input.reference}.` : '';
  const queries = input.contactPhone ? ` ${words.queries}: ${input.contactPhone}.` : '';
  const base = `${input.practiceName}: ${words.balance} ${statementDate(input.asAtKey, language)} ${words.is} ${formatNad(fromCents(input.balanceCents))}.${howToPay}${queries}`;
  const message = input.message?.trim();
  const withMessage = message ? `${base} ${message}` : base;
  return withMessage.length <= 306 ? withMessage : base;
}
