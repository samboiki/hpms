/**
 * Payment plans (parity D16): a total agreed with the patient, paid off in instalments that each post on their date as
 * an invoice the patient pays (never claimed). The instalments are worked out here and the database checks them again
 * (billing_save_payment_plan, proposals/2026-10-13-billing-extras.sql): 1 to 120, each more than N$ 0.00, on rising
 * days, adding up to the total to the cent.
 *
 * There is no scheduler: due instalments post when staff open the patient's Billing tab, or with "Post due
 * instalments" in Finance > Overview (billing_post_due_instalments). Money is in whole cents.
 */
import { addMonthsToKey, isValidDateKey } from './dates';
import { formatNad, fromCents, toCents } from './money';
import { parseAmountText } from '../stock/items';

export const PLAN_LIMITS = {
  maxInstalments: 120,
  maxTotalCents: 1_000_000_000,
  titleMin: 2,
  titleMax: 60,
  notesMax: 280
} as const;

export interface ScheduledInstalment {
  /** yyyy-MM-dd */
  dueOn: string;
  amountCents: number;
}

/**
 * The instalments of a plan: an optional deposit on the start day, then `payments` monthly payments that share the
 * rest equally (the last takes the odd cents), the first a month after the deposit, or on the start day when there is
 * no deposit. A day missing from a shorter month falls on its last day (31 Jan, 28 Feb, 31 Mar).
 */
export function buildInstalments(input: {
  totalCents: number;
  /** 0 or absent: no deposit */
  depositCents?: number;
  /** Monthly payments after the deposit (or all of them without one) */
  payments: number;
  /** yyyy-MM-dd: the deposit's day, or the first payment's without one */
  startKey: string;
}): { instalments: ScheduledInstalment[]; error: null } | { instalments: null; error: string } {
  const { totalCents, payments, startKey } = input;
  const deposit = input.depositCents ?? 0;
  if (!Number.isInteger(totalCents) || totalCents <= 0) return { instalments: null, error: 'Give the total agreed, more than N$ 0.00.' };
  if (totalCents > PLAN_LIMITS.maxTotalCents) return { instalments: null, error: `A plan is at most ${formatNad(fromCents(PLAN_LIMITS.maxTotalCents))}.` };
  if (!Number.isInteger(deposit) || deposit < 0) return { instalments: null, error: 'The deposit is an amount in N$, or leave it empty.' };
  if (deposit >= totalCents) return { instalments: null, error: 'The deposit must be less than the total: the rest is paid in instalments.' };
  const most = PLAN_LIMITS.maxInstalments - (deposit > 0 ? 1 : 0);
  if (!Number.isInteger(payments) || payments < 1 || payments > most) return { instalments: null, error: `Choose 1 to ${most} monthly payments.` };
  if (!isValidDateKey(startKey)) return { instalments: null, error: 'Choose the day the plan starts.' };
  const rest = totalCents - deposit;
  const each = Math.floor(rest / payments);
  if (each <= 0) return { instalments: null, error: `${formatNad(fromCents(rest))} cannot be split into ${payments} payments: choose fewer.` };
  const instalments: ScheduledInstalment[] = deposit > 0 ? [{ dueOn: startKey, amountCents: deposit }] : [];
  const firstMonth = deposit > 0 ? 1 : 0;
  for (let index = 0; index < payments; index += 1) {
    const last = index === payments - 1;
    instalments.push({ dueOn: addMonthsToKey(startKey, firstMonth + index), amountCents: last ? rest - each * (payments - 1) : each });
  }
  return { instalments, error: null };
}

/** The plan form as typed */
export interface PlanDraft {
  title: string;
  total: string;
  deposit: string;
  payments: string;
  startKey: string;
  practitionerId: string;
  notes: string;
}

export interface PlanPayload {
  patient_id: string;
  title: string;
  total: number;
  practitioner_id: string | null;
  notes: string | null;
  instalments: Array<{ due_on: string; amount: number }>;
}

/** What the form describes: the schedule to show and the payload to save, or what to fix first */
export function planFromDraft(
  draft: PlanDraft,
  patientId: string
): { schedule: ScheduledInstalment[]; payload: PlanPayload; error: null } | { schedule: null; payload: null; error: string } {
  const fail = (error: string) => ({ schedule: null, payload: null, error });
  const title = draft.title.trim();
  if (title.length < PLAN_LIMITS.titleMin || title.length > PLAN_LIMITS.titleMax) return fail(`Say what the plan is for in ${PLAN_LIMITS.titleMin} to ${PLAN_LIMITS.titleMax} characters, for example "Braces".`);
  const total = parseAmountText(draft.total);
  if (total === null) return fail('Give the total agreed in N$, for example 24000 or 24,000.00.');
  const deposit = draft.deposit.trim() === '' ? 0 : parseAmountText(draft.deposit);
  if (deposit === null) return fail('The deposit is an amount in N$, or leave it empty.');
  const payments = /^\d+$/.test(draft.payments.trim()) ? Number(draft.payments.trim()) : NaN;
  if (draft.notes.trim().length > PLAN_LIMITS.notesMax) return fail(`Keep the note to ${PLAN_LIMITS.notesMax} characters.`);
  const built = buildInstalments({ totalCents: toCents(total), depositCents: toCents(deposit), payments, startKey: draft.startKey });
  if (built.error !== null) return fail(built.error);
  return {
    schedule: built.instalments,
    payload: {
      patient_id: patientId,
      title,
      total,
      practitioner_id: draft.practitionerId || null,
      notes: draft.notes.trim() || null,
      instalments: built.instalments.map(item => ({ due_on: item.dueOn, amount: fromCents(item.amountCents) }))
    },
    error: null
  };
}

/** "N$ 4,000.00 now, then 10 x N$ 2,000.00 monthly" */
export function describeSchedule(schedule: readonly ScheduledInstalment[], hasDeposit: boolean): string {
  if (schedule.length === 0) return '';
  const monthly = hasDeposit ? schedule.slice(1) : schedule;
  const head = hasDeposit ? `${formatNad(fromCents(schedule[0].amountCents))} deposit, then ` : '';
  if (monthly.length === 0) return head.replace(/, then $/, '');
  const first = monthly[0].amountCents;
  const last = monthly[monthly.length - 1].amountCents;
  const body = monthly.length === 1
    ? `1 payment of ${formatNad(fromCents(first))}`
    : last === first
      ? `${monthly.length} monthly payments of ${formatNad(fromCents(first))}`
      : `${monthly.length - 1} monthly payments of ${formatNad(fromCents(first))} and a last one of ${formatNad(fromCents(last))}`;
  return `${head}${body}`;
}

// ---------------------------------------------------------------------------------------------
// Plans as stored
// ---------------------------------------------------------------------------------------------

export interface PlanInstalment {
  id: string;
  number: number;
  dueOn: string;
  amountCents: number;
  invoiceId: string | null;
  /** The day its invoice is dated; null until posted */
  postedOn: string | null;
}

export interface PaymentPlan {
  id: string;
  patientId: string;
  title: string;
  totalCents: number;
  practitionerId: string | null;
  notes: string | null;
  createdAt: string;
  stoppedAt: string | null;
  stopReason: string | null;
  instalments: PlanInstalment[];
}

export interface PlanRow {
  id: string;
  patient_id: string;
  title: string;
  total: number | string;
  practitioner_id?: string | null;
  notes?: string | null;
  created_at: string;
  stopped_at?: string | null;
  stop_reason?: string | null;
  payment_plan_instalments?: Array<{
    id: string;
    number: number;
    due_on: string;
    amount: number | string;
    invoice_id?: string | null;
    posted_on?: string | null;
  }> | null;
}

export function normalizePlan(row: PlanRow): PaymentPlan {
  return {
    id: row.id,
    patientId: row.patient_id,
    title: row.title,
    totalCents: toCents(Number(row.total)),
    practitionerId: row.practitioner_id ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    stoppedAt: row.stopped_at ?? null,
    stopReason: row.stop_reason ?? null,
    instalments: (row.payment_plan_instalments ?? [])
      .map(item => ({
        id: item.id,
        number: item.number,
        dueOn: item.due_on.slice(0, 10),
        amountCents: toCents(Number(item.amount)),
        invoiceId: item.invoice_id ?? null,
        postedOn: item.posted_on ? item.posted_on.slice(0, 10) : null
      }))
      .sort((a, b) => a.number - b.number)
  };
}

export type PlanState = 'active' | 'completed' | 'stopped';

export interface PlanProgress {
  state: PlanState;
  count: number;
  postedCount: number;
  postedCents: number;
  /** Not posted yet (and, for a stopped plan, never to be posted) */
  leftCents: number;
  /** The next instalment to post; null when none is left (or the plan is stopped) */
  next: PlanInstalment | null;
  /** Due today or earlier and not posted yet (they post when the account is opened) */
  dueNow: PlanInstalment[];
}

export function planProgress(plan: PaymentPlan, todayKey: string): PlanProgress {
  const posted = plan.instalments.filter(item => item.postedOn !== null);
  const open = plan.instalments.filter(item => item.postedOn === null);
  const stopped = plan.stoppedAt !== null;
  return {
    state: stopped ? 'stopped' : open.length === 0 ? 'completed' : 'active',
    count: plan.instalments.length,
    postedCount: posted.length,
    postedCents: posted.reduce((sum, item) => sum + item.amountCents, 0),
    leftCents: open.reduce((sum, item) => sum + item.amountCents, 0),
    next: stopped ? null : open[0] ?? null,
    dueNow: stopped ? [] : open.filter(item => item.dueOn <= todayKey)
  };
}

/** What a posting run did, in a sentence for staff; null when nothing happened */
export function describePosting(result: { posted: number; totalCents: number; waiting: number }): string | null {
  const parts: string[] = [];
  if (result.posted > 0) {
    parts.push(`${result.posted === 1 ? '1 instalment' : `${result.posted} instalments`} (${formatNad(fromCents(result.totalCents))}) posted to the account`);
  }
  if (result.waiting > 0) {
    parts.push(`${result.waiting === 1 ? '1 instalment waits' : `${result.waiting} instalments wait`} for an open month (every month up to today is closed)`);
  }
  return parts.length > 0 ? `${parts.join('; ')}.` : null;
}
