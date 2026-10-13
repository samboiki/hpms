/**
 * Who did what (parity R17 "finger print" report, Q8 audit report): one staff member's postings and changes over a
 * period, in plain words, for the practice's administrators. The database reads the trails it already keeps
 * (report_user_activity, proposals/2026-10-12-who-did-what.sql): invoices raised and changed, payments, allocations
 * and adjustments and their reversals, patient-file changes, claims sent and refusals acted on, month ends, cash-ups,
 * deposits, the daybook and Finance report prints and downloads, and patient files opened or exported, sign-ins and
 * sign-outs (record_access_log, proposals/2026-10-13-access-log.sql). Invoice changes are worded by the invoice
 * history's own rule (describeAuditEvents) and patient-file changes by the patient file's change history groups, so
 * the same change reads the same everywhere. Values of patient records never come back: which record, not what it held.
 */
import { describeAuditEvents, type InvoiceAuditEvent } from '../../billing/invoiceAudit';
import { CHANGE_GROUPS } from '../../patients/changeHistory';
import { ADJUSTMENT_LABELS, RECEIPT_METHOD_LABELS, toCents, type AdjustmentKind, type ReceiptMethod } from '../../../services/ledgerService';
import { fundLabel } from '../../../utils/remittance/funds';
import { formatDateKey, formatNad, formatMonthKey } from '../financeFormat';
import type { CsvCell } from '../financeExport';
import { REJECTION_STEP_LABELS } from './claimLineStory';
import type { LinkedReport, ReportTarget } from './reportTargets';
import type { AccessScreen } from '../../../services/recordAccessLog';

export type ActivityArea = 'invoice' | 'payment' | 'patient_file' | 'claims' | 'controls' | 'export' | 'access';

export const AREA_LABELS: Record<ActivityArea, string> = {
  invoice: 'Invoices',
  payment: 'Payments and adjustments',
  patient_file: 'Patient files',
  claims: 'Claims',
  controls: 'Day end and month end',
  export: 'Prints and downloads',
  access: 'Files opened or exported, sign-ins and sign-outs'
};

/** A row of report_user_activity */
export interface RawActivityRow {
  occurred_at: string | null;
  area: string | null;
  action: string | null;
  invoice_id: string | null;
  receipt_id: string | null;
  patient_id: string | null;
  batch_id: string | null;
  record_table: string | null;
  record_id: string | null;
  document: string | null;
  amount: number | string | null;
  details: Record<string, unknown> | null;
}

export interface ActivityEntry {
  key: string;
  at: string;
  area: ActivityArea;
  /** What was done, in a plain sentence without patient values */
  text: string;
  patientId: string | null;
  target: ReportTarget | null;
}

const AREAS = Object.keys(AREA_LABELS) as ActivityArea[];
const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());
const money = (value: unknown): string => formatNad(toCents(value) / 100);
/** A stored day as "7 Oct 2026"; anything else is shown as stored, never a broken date */
const day = (value: string): string => (/^\d{4}-\d{2}-\d{2}/.test(value) ? formatDateKey(value.slice(0, 10)) : value);

/** Report names as Finance > Reports lists them, for the downloads (report_exports.report keys) */
export type ReportNames = Readonly<Record<string, string>>;

function paymentText(action: string, row: RawActivityRow): string {
  const details = row.details ?? {};
  const document = text(row.document);
  const invoice = text(details.invoice_number);
  const amount = row.amount !== null ? money(row.amount) : '';
  const kind = ADJUSTMENT_LABELS[text(details.kind) as AdjustmentKind] ?? 'Adjustment';
  const method = RECEIPT_METHOD_LABELS[text(details.method) as ReceiptMethod];
  switch (action) {
    case 'receipt_created':
      return `Recorded payment ${document} (${[amount, method].filter(Boolean).join(', ')})`;
    case 'receipt_reversed':
      return `Reversed payment ${document}`;
    case 'allocation_created':
      return `Allocated ${amount} of payment ${document || ''} to invoice ${invoice || ''}`.replace(/\s+/g, ' ').trim();
    case 'allocation_reversed':
      return `Took back an allocation of ${amount} to invoice ${invoice || ''}`.trim();
    case 'adjustment_created':
      return `${kind} ${document}${invoice ? ` on invoice ${invoice}` : ''} (${amount})`;
    case 'adjustment_reversed':
      return `Reversed ${kind.toLowerCase()} ${document}`;
    default:
      return `${action.replace(/_/g, ' ')} ${document}`.trim();
  }
}

const TABLE_WORDS: Record<string, string> = Object.fromEntries(CHANGE_GROUPS.map(group => [group.table, group.label]));
const DONE: Record<string, string> = { insert: 'added', update: 'changed', delete: 'deleted' };

function patientFileText(row: RawActivityRow): string {
  const what = TABLE_WORDS[text(row.record_table)] ?? 'Patient record';
  return `${what} ${DONE[text(row.action)] ?? text(row.action)}`;
}

function claimsText(action: string, row: RawActivityRow): string {
  const details = row.details ?? {};
  if (action === 'batch_sent') {
    const claims = text(details.claims);
    return `Sent claim batch ${text(row.document)} to ${fundLabel(text(details.fund) || null)}${claims ? ` (${claims} claims, ${money(row.amount)})` : ''}`;
  }
  if (action === 'remittance_posted') return `Posted ${text(row.document)} from ${fundLabel(text(details.fund) || null)} (${money(row.amount)} paid)`;
  const step = REJECTION_STEP_LABELS[action.replace(/^rejection_/, '')] ?? action.replace(/^rejection_/, '').replace(/_/g, ' ');
  return `Rejection of code ${text(row.document) || '?'} (${fundLabel(text(details.fund) || null)}): ${step.toLowerCase()}`;
}

function controlsText(action: string, row: RawActivityRow): string {
  const document = text(row.document);
  switch (action) {
    case 'month_closed':
      return `Closed ${/^\d{4}-\d{2}$/.test(document) ? formatMonthKey(document, 'MMMM yyyy') : document}`;
    case 'month_reopened':
      return `Reopened ${/^\d{4}-\d{2}$/.test(document) ? formatMonthKey(document, 'MMMM yyyy') : document}`;
    case 'day_cashed_up':
      return `Cashed up ${day(document)} (${money(row.amount)} counted)`;
    case 'cash_up_replaced':
      return `Replaced the cash-up of ${day(document)}`;
    case 'deposit_prepared':
      return `Prepared deposit slip ${document} (${money(row.amount)})`;
    case 'deposit_banked':
      return `Marked deposit slip ${document} banked`;
    case 'deposit_cancelled':
      return `Cancelled deposit slip ${document}`;
    default:
      return `${action.replace(/_/g, ' ')} ${document}`.trim();
  }
}

/** Where a file was opened (record_access_log.screen), as the report says it */
const ACCESS_SCREENS: Record<AccessScreen, string> = {
  patient_file: 'the patient file',
  visit_screen: 'a visit',
  visit_page: 'a link to a visit',
  sign_in: 'the sign-in page',
  app: 'OneHealth'
};

function accessText(action: string, row: RawActivityRow): string {
  if (action === 'signed_in') return 'Signed in';
  if (action === 'signed_out') return 'Signed out';
  if (action === 'record_exported') return "Exported the patient's record";
  const screen = ACCESS_SCREENS[text(row.document) as AccessScreen];
  return `Opened the patient's file${screen ? ` (from ${screen})` : ''}`;
}

function exportText(action: string, row: RawActivityRow, reportNames: ReportNames): string {
  const details = row.details ?? {};
  if (action.startsWith('daybook_')) {
    return `${action === 'daybook_export' ? 'Downloaded' : 'Printed'} the daybook of ${day(text(row.document))} (copy ${text(details.copy) || '1'})`;
  }
  const name = reportNames[text(row.document)] ?? text(row.document).replace(/_/g, ' ');
  const rows = text(details.rows);
  const period = text(details.from) && text(details.to) ? `, ${day(text(details.from))} to ${day(text(details.to))}` : '';
  return `${action === 'report_print' ? 'Printed' : 'Downloaded'} ${name}${rows ? ` (${rows} rows${period})` : period ? ` (${period.slice(2)})` : ''}`;
}

/** Each activity in words, oldest first; invoice changes of one save read as the invoice history reads them */
export function activityEntries(rows: readonly RawActivityRow[], reportNames: ReportNames = {}, people: Readonly<Record<string, string>> = {}): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  const invoiceEvents = new Map<string, { row: RawActivityRow; event: InvoiceAuditEvent }[]>();

  rows.forEach((row, index) => {
    const area = AREAS.find(item => item === row.area);
    const action = text(row.action);
    if (!area || !action || !row.occurred_at) return;
    const at = row.occurred_at;
    const base = { key: `${area}-${index}`, at, area, patientId: row.patient_id };
    if (area === 'invoice' && action !== 'invoice_raised') {
      // Grouped per invoice and worded together below (a save that replaced lines reads as one change)
      const details = row.details ?? {};
      const event: InvoiceAuditEvent = {
        id: text(details.id) || `${index}`,
        action: action as InvoiceAuditEvent['action'],
        field: text(details.field) || null,
        old_value: text(details.old_value) || null,
        new_value: text(details.new_value) || null,
        line_code: text(details.line_code) || null,
        line_before: (details.line_before as Record<string, unknown> | null) ?? null,
        line_after: (details.line_after as Record<string, unknown> | null) ?? null,
        changed_by: null,
        changed_at: at
      };
      const key = row.invoice_id ?? '';
      invoiceEvents.set(key, [...(invoiceEvents.get(key) ?? []), { row, event }]);
      return;
    }
    let sentence = '';
    let target: ReportTarget | null = null;
    switch (area) {
      case 'invoice':
        sentence = `Raised invoice ${text(row.document)} (${money(row.amount)})`;
        target = row.invoice_id ? { kind: 'invoice', id: row.invoice_id } : null;
        break;
      case 'payment':
        sentence = paymentText(action, row);
        target = row.receipt_id ? { kind: 'receipt', id: row.receipt_id } : row.invoice_id ? { kind: 'invoice', id: row.invoice_id } : null;
        break;
      case 'patient_file':
        sentence = patientFileText(row);
        // The file's Change history says what changed (values stay in the patient's file)
        target = row.patient_id ? { kind: 'patient', id: row.patient_id, tab: 'audit' } : null;
        break;
      case 'claims': {
        sentence = claimsText(action, row);
        const claimLine = text(row.details?.claim_line_id);
        target = action === 'remittance_posted' && row.receipt_id ? { kind: 'receipt', id: row.receipt_id }
          : claimLine ? { kind: 'claim_line', id: claimLine }
            : row.batch_id ? { kind: 'batch', id: row.batch_id } : null;
        break;
      }
      case 'controls':
        sentence = controlsText(action, row);
        break;
      case 'export':
        sentence = exportText(action, row, reportNames);
        break;
      case 'access':
        sentence = accessText(action, row);
        // The file that was opened or exported (what it showed is not recorded)
        target = (action === 'patient_opened' || action === 'record_exported') && row.patient_id ? { kind: 'patient', id: row.patient_id } : null;
        break;
    }
    entries.push({ ...base, text: sentence, target });
  });

  invoiceEvents.forEach((items, invoiceId) => {
    const byId = new Map(items.map(item => [String(item.event.id), item.row]));
    const document = text(items[0]?.row.document);
    for (const described of describeAuditEvents(items.map(item => item.event), people)) {
      const row = byId.get(described.key) ?? items[0].row;
      entries.push({
        key: `invoice-${invoiceId}-${described.key}`,
        at: described.at,
        area: 'invoice',
        text: `Invoice ${document || ''}: ${described.text}`.replace(/\s+:/, ':'),
        patientId: row.patient_id,
        target: invoiceId ? { kind: 'invoice', id: invoiceId } : null
      });
    }
  });

  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * What no trail records today, said on the report so nobody reads its silence as "nothing happened" (parity Q8). Kept
 * in one place: if a trail is added, the sentence goes.
 */
export const NOT_RECORDED = [
  'Opening a patient\'s file is recorded since 13 Oct 2026, from the patient file, a visit and a link to a visit, once per person and file every 10 minutes. Seeing a patient in a list, the diary, search or the dashboard, and reading an invoice or a report, are not recorded.',
  'Sign-ins and sign-outs are recorded since 13 Oct 2026. Closing the browser or being signed out after a while leaves no sign-out, and coming back on a device that stayed signed in is not a new sign-in.',
  'Files opened by someone signed in to another practice (OneHealth support) are not recorded.',
  'Downloads and prints are recorded for the daybook, Finance reports and a patient\'s record export only; claim files, statements, debtors lists and other downloads are not.',
  'Patient-file changes cover the file, visits, vital signs and medical aid; clinical notes, letters and documents are not in this report.'
];

const WINDHOEK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Windhoek', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

/** "5 Oct 2026 10:00": the day and time in Windhoek (a late-evening action is on the Windhoek day, not the UTC one) */
export function windhoekTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const part = (type: Intl.DateTimeFormatPartTypes) => WINDHOEK.formatToParts(date).find(item => item.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')} ${part('hour')}:${part('minute')}`;
}

/** The report: one row per action; each opens what it was about */
export function activityTable(entries: readonly ActivityEntry[], person: string, periodLabel: string, patientNames: Readonly<Record<string, string>>): LinkedReport {
  return {
    table: {
      title: `Who did what: ${person}`,
      basis: periodLabel,
      columns: [
        { header: 'When', type: 'text' },
        { header: 'Area', type: 'text' },
        { header: 'What', type: 'text' },
        { header: 'Patient', type: 'text' }
      ],
      rows: entries.map(entry => [windhoekTime(entry.at), AREA_LABELS[entry.area], entry.text, (entry.patientId && patientNames[entry.patientId]) || ''] as CsvCell[]),
      notes: ['Times are Windhoek time.', ...NOT_RECORDED]
    },
    targets: entries.map(entry => entry.target),
    names: entries.map(entry => (entry.target?.kind === 'patient' ? (entry.patientId && patientNames[entry.patientId]) || 'the patient' : entry.text))
  };
}
