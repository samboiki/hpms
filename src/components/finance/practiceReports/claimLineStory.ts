/**
 * One claim line's story on one timeline (parity F10): when the service was claimed and in which batch and file, each
 * answer of the fund, the rejection queue and what staff did about it, corrections and resends, credit-note reversals
 * and the payments that reached the invoice line. The database gathers every claim line of the service
 * (claim_line_story, proposals/2026-10-12-claims-dashboard-and-story.sql); this module puts the events in order and in
 * plain words. Corrections and resends are worded by the invoice history's own rule (describeAuditEvents), so both say
 * the same thing.
 */
import { describeAuditEvents, type InvoiceAuditEvent } from '../../billing/invoiceAudit';
import { PORTION_LABELS, RECEIPT_METHOD_LABELS, toCents, type Portion, type ReceiptMethod } from '../../../services/ledgerService';
import { fundLabel } from '../../../utils/remittance/funds';
import { CATEGORY_LABELS, type ReasonCategory } from '../../../utils/remittance/reasonCodes';
import { LINE_STATUS_LABELS, type LineStatus } from '../../../utils/remittance/types';
import { formatNad, formatDateKey } from '../financeFormat';
import { REJECTION_STATUS_LABELS } from '../remittances/remittanceUi';
import type { RejectionStatus } from '../../../utils/remittance/matching';
import { staffName, type StaffNames } from './reportTargets';

export type StoryKind = 'claimed' | 'answer' | 'fund_payment' | 'rejection' | 'rejection_step' | 'correction' | 'reversal' | 'payment';

/** A row of claim_line_story */
export interface RawStoryEvent {
  kind: string;
  occurred_at: string | null;
  on_date: string | null;
  claim_line_id: string | null;
  batch_id: string | null;
  batch_number: number | null;
  document_id: string | null;
  receipt_id: string | null;
  rejection_id: string | null;
  invoice_id: string | null;
  actor: string | null;
  amount: number | string | null;
  details: Record<string, unknown> | null;
}

export type StoryTone = 'cyan' | 'green' | 'amber' | 'red' | 'violet' | 'gray';

export interface StoryEntry {
  key: string;
  kind: StoryKind;
  /** When it happened (recorded) */
  at: string;
  /** The day it counts (sent day, payment date) */
  dateKey: string | null;
  title: string;
  detail: string | null;
  tone: StoryTone;
  /** Who did it, when a person did */
  by: string | null;
  batchId: string | null;
  receiptId: string | null;
  invoiceId: string | null;
  rejectionId: string | null;
}

const KINDS: readonly StoryKind[] = ['claimed', 'answer', 'fund_payment', 'rejection', 'rejection_step', 'correction', 'reversal', 'payment'];

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());
const money = (value: unknown): string => formatNad(toCents(value) / 100);
/** A stored day as "7 Oct 2026"; anything that is not a yyyy-MM-dd day is shown as stored, never a broken date */
const day = (value: string): string => (/^\d{4}-\d{2}-\d{2}/.test(value) ? formatDateKey(value.slice(0, 10)) : value);
const textList = (value: unknown): string[] => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

export const REJECTION_STEP_LABELS: Record<string, string> = {
  created: 'Put in the rejection queue',
  resubmitted: 'Sent again to the fund',
  billed_patient: 'Moved to the patient\'s account',
  written_off: 'Written off',
  waiting: 'Waiting for the fund',
  reopened: 'Opened again',
  closed: 'Closed',
  note: 'Note added',
  resolved_by_payment: 'Paid later by the fund'
};

const REVERSAL_STATES: Record<string, string> = {
  queued: 'waiting for the fund\'s next credit file',
  in_file: 'in a credit file not sent yet',
  sent: 'sent to the fund in a credit file',
  cancelled: 'cancelled (the credit note was reversed)'
};

function claimedEntry(event: RawStoryEvent, details: Record<string, unknown>): Pick<StoryEntry, 'title' | 'detail' | 'tone'> {
  const fund = fundLabel(text(details.fund) || null);
  const batch = event.batch_number !== null ? `batch ${event.batch_number}` : 'a batch';
  const again = text(details.flag) ? ` again (resubmission ${text(details.flag)})` : '';
  const line = [
    text(details.line_number) ? `Line ${text(details.line_number)}` : null,
    text(details.tariff_code) ? `code ${text(details.tariff_code)}` : null,
    text(details.service_date) ? `service ${day(text(details.service_date))}` : null,
    event.amount !== null ? money(event.amount) : null
  ].filter(Boolean).join(', ');
  const file = text(details.file_name) ? ` File ${text(details.file_name)}.` : '';
  if (details.sent === true) return { title: `Claimed${again} from ${fund} in ${batch}`, detail: `${line}.${file}`, tone: 'cyan' };
  return { title: `Waiting in ${batch} for ${fund}, not sent yet`, detail: `${line}.`, tone: 'gray' };
}

function answerEntry(event: RawStoryEvent, details: Record<string, unknown>): Pick<StoryEntry, 'title' | 'detail' | 'tone'> {
  const fund = fundLabel(text(details.fund) || null);
  const status = (text(details.status) || 'info') as LineStatus;
  const codes = textList(details.reason_codes);
  const reasons = textList(details.reason_texts);
  const why = codes.length > 0 ? `Fund code ${codes.join('/')}${reasons.length > 0 ? `: ${reasons.join('; ')}` : ''}.` : '';
  const file = text(details.file_name) ? ` From ${text(details.file_name)}.` : '';
  const title =
    status === 'paid' ? `${fund} paid ${money(event.amount)}`
      : status === 'part_paid' ? `${fund} paid ${money(event.amount)} of ${money(details.claimed)}`
        : status === 'rejected' ? `${fund} did not pay`
          : `${fund}: ${(LINE_STATUS_LABELS[status] ?? 'answered').toLowerCase()}`;
  const tone: StoryTone = status === 'paid' ? 'green' : status === 'part_paid' ? 'amber' : status === 'rejected' ? 'red' : 'violet';
  return { title, detail: `${why}${file}`.trim() || null, tone };
}

function rejectionEntry(event: RawStoryEvent, details: Record<string, unknown>): Pick<StoryEntry, 'title' | 'detail' | 'tone'> {
  const category = text(details.category) as ReasonCategory;
  const status = text(details.status) as RejectionStatus;
  return {
    title: `In the rejection queue: ${text(details.plain_reason) || 'reason not given'}`,
    detail: [CATEGORY_LABELS[category], REJECTION_STATUS_LABELS[status] ? `now ${REJECTION_STATUS_LABELS[status].toLowerCase()}` : null, `${money(event.amount)} at stake`]
      .filter(Boolean).join(' · '),
    tone: 'red'
  };
}

function correctionEntry(event: RawStoryEvent, details: Record<string, unknown>): Pick<StoryEntry, 'title' | 'detail' | 'tone'> {
  const audit = {
    id: text(details.id) || text(event.occurred_at),
    action: text(details.action) as InvoiceAuditEvent['action'],
    field: text(details.field) || null,
    old_value: text(details.old_value) || null,
    new_value: text(details.new_value) || null,
    line_code: text(details.line_code) || null,
    line_before: (details.line_before as Record<string, unknown> | null) ?? null,
    line_after: (details.line_after as Record<string, unknown> | null) ?? null,
    changed_by: event.actor,
    changed_at: event.occurred_at ?? ''
  } satisfies InvoiceAuditEvent;
  const [entry] = describeAuditEvents([audit]);
  return { title: audit.action === 'claim_resent' ? 'Sent again (not paid)' : 'Corrected and sent again', detail: entry?.text ?? null, tone: 'violet' };
}

function entryText(event: RawStoryEvent, kind: StoryKind, details: Record<string, unknown>, names: StaffNames): Pick<StoryEntry, 'title' | 'detail' | 'tone'> {
  switch (kind) {
    case 'claimed':
      return claimedEntry(event, details);
    case 'answer':
      return answerEntry(event, details);
    case 'fund_payment':
      return { title: `Payment from ${fundLabel(text(details.fund) || null)} keyed: ${money(event.amount)}`, detail: text(details.reference) ? `Reference ${text(details.reference)}.` : null, tone: 'green' };
    case 'rejection':
      return rejectionEntry(event, details);
    case 'rejection_step':
      return {
        title: REJECTION_STEP_LABELS[text(details.action)] ?? (text(details.action).replace(/_/g, ' ') || 'Queue item changed'),
        detail: text(details.note) || null,
        tone: 'amber'
      };
    case 'correction':
      return correctionEntry(event, details);
    case 'reversal':
      return {
        title: `Credit note ${text(details.credit_note)}: ${money(event.amount)} taken back from the fund`,
        detail: REVERSAL_STATES[text(details.state)] ? `Reversal ${REVERSAL_STATES[text(details.state)]}${event.batch_number !== null ? ` (batch ${event.batch_number})` : ''}.` : null,
        tone: 'gray'
      };
    case 'payment': {
      const portion = PORTION_LABELS[text(details.portion) as Portion] ?? 'Payment';
      const method = RECEIPT_METHOD_LABELS[text(details.method) as ReceiptMethod];
      return {
        title: `${portion} portion paid: ${money(event.amount)} from payment ${text(details.receipt_number)}`,
        detail: [method, event.actor ? `allocated by ${staffName(event.actor, names)}` : null].filter(Boolean).join(' · ') || null,
        tone: 'green'
      };
    }
  }
}

/** The story in order of when things happened (the claim first when two share a moment) */
export function storyEntries(events: readonly RawStoryEvent[], names: StaffNames = {}): StoryEntry[] {
  const entries: StoryEntry[] = [];
  events.forEach((event, index) => {
    const kind = KINDS.find(item => item === event.kind);
    if (!kind || !event.occurred_at) return;
    const details = event.details ?? {};
    const words = entryText(event, kind, details, names);
    entries.push({
      key: `${kind}-${index}`,
      kind,
      at: event.occurred_at,
      dateKey: event.on_date ? event.on_date.slice(0, 10) : null,
      ...words,
      by: event.actor && kind !== 'answer' && kind !== 'payment' ? staffName(event.actor, names) : null,
      batchId: event.batch_id,
      receiptId: event.receipt_id,
      invoiceId: event.invoice_id,
      rejectionId: event.rejection_id
    });
  });
  const order = (entry: StoryEntry) => KINDS.indexOf(entry.kind);
  return entries.sort((a, b) => a.at.localeCompare(b.at) || order(a) - order(b));
}

/** Where the story stands now, in one line: the latest answer or step */
export function storyHeadline(entries: readonly StoryEntry[]): string {
  if (entries.length === 0) return 'Nothing recorded for this claim line yet.';
  const latest = entries[entries.length - 1];
  return `Latest: ${latest.title}${latest.dateKey ? ` (${day(latest.dateKey)})` : ''}.`;
}
