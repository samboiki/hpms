/**
 * Who changed an invoice, what and when, in plain words (parity D23: audited corrections).
 *
 * The database writes the events (proposals/2026-10-07-invoicing.sql: triggers on invoices_enhanced and
 * invoice_services, so no screen can skip them): a changed invoice field with its old and new value, and each line
 * added, removed or changed with its fields before and after. Saving a visit replaces its lines (removed, then added
 * again in one save); describeAuditEvents pairs those back up, shows only what really changed and leaves out lines
 * that were saved again unchanged.
 */
import { formatServiceDate } from '../../utils/billing/dates';
import { formatNad } from '../../utils/billing/money';

export interface InvoiceAuditEvent {
  id: number | string;
  /** claim_corrected and claim_resent: a sent claim line corrected and sent again, or sent again unpaid (field 32) */
  action: 'invoice_changed' | 'line_added' | 'line_removed' | 'line_changed' | 'claim_corrected' | 'claim_resent';
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  line_code?: string | null;
  line_before?: Record<string, unknown> | null;
  line_after?: Record<string, unknown> | null;
  changed_by?: string | null;
  changed_at: string;
}

export interface AuditEntry {
  key: string;
  text: string;
  by: string | null;
  at: string;
}

/** Plain names of the audited invoice fields (they start a sentence). */
const FIELD_LABELS: Record<string, string> = {
  notes: 'Note',
  practitioner_id: 'Treating practitioner',
  due_date: 'Due date',
  issue_date: 'Invoice date',
  visit_id: 'Visit',
  patient_id: 'Patient'
};

/** Plain names of the audited line fields (mid-sentence). */
const LINE_LABELS: Record<string, string> = {
  practitioner_id: 'practitioner',
  notes: 'note',
  service_date: 'date',
  tooth_number: 'tooth',
  quantity: 'quantity',
  unit_price: 'unit price',
  total_price: 'amount',
  discount_amount: 'discount',
  description: 'description',
  medical_aid_covered: 'medical aid portion',
  patient_portion: 'patient portion'
};

/** Line fields compared between before and after, in the order they are described. */
const LINE_FIELDS = ['service_date', 'practitioner_id', 'tooth_number', 'quantity', 'unit_price', 'discount_amount', 'total_price', 'medical_aid_covered', 'patient_portion', 'description', 'notes'];
const MONEY_FIELDS = new Set(['unit_price', 'total_price', 'discount_amount', 'medical_aid_covered', 'patient_portion']);
const DATE_FIELDS = new Set(['service_date', 'due_date', 'issue_date']);

const asText = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

/** A value as staff read it: day-first dates, N$ amounts, names for people. */
function shown(field: string, value: unknown, names: Readonly<Record<string, string>>): string {
  const text = asText(value);
  if (!text) return 'nothing';
  if (DATE_FIELDS.has(field)) return formatServiceDate(text);
  if (MONEY_FIELDS.has(field) && Number.isFinite(Number(text))) return formatNad(Number(text));
  if (field === 'practitioner_id') return names[text] ?? 'another practitioner';
  if (field === 'notes' || field === 'description') return `"${text}"`;
  return text;
}

const sameValue = (field: string, a: unknown, b: unknown): boolean =>
  MONEY_FIELDS.has(field) || field === 'quantity' ? Number(asText(a) || 0) === Number(asText(b) || 0) : asText(a) === asText(b);

function lineChanges(before: Record<string, unknown>, after: Record<string, unknown>, names: Readonly<Record<string, string>>): string[] {
  return LINE_FIELDS.filter(field => !sameValue(field, before[field], after[field])).map(
    field => `${LINE_LABELS[field] ?? field} ${shown(field, before[field], names)} to ${shown(field, after[field], names)}`
  );
}

const codesText = (value: unknown): string => (Array.isArray(value) && value.length > 0 ? value.map(asText).join(', ') : 'none');

/**
 * A sent claim line corrected and sent again (claim_line_correct) or sent again unpaid (claim_lines_resend), in
 * words: which batch it went into and, for a correction, what changed from what the fund received.
 */
function claimEventText(event: InvoiceAuditEvent, names: Readonly<Record<string, string>>): string {
  const before = event.line_before ?? {};
  const after = event.line_after ?? {};
  const code = asText(event.line_code);
  const into = asText(after.batch_number) ? `batch ${asText(after.batch_number)}` : 'the fund\'s open batch';
  const note = asText(event.new_value) ? ` Note: "${asText(event.new_value)}".` : '';
  if (event.action === 'claim_resent') {
    return `Claim for line ${code} sent again in ${into} (resubmission R): the fund had not paid it since batch ${asText(before.batch_number) || '?'}.${note}`;
  }
  const changes = [
    'service_date' in after ? `date ${shown('service_date', before.service_date, names)} to ${shown('service_date', after.service_date, names)}` : null,
    'icd10' in after ? `ICD-10 ${codesText(before.icd10)} to ${codesText(after.icd10)}` : null,
    'practitioner_id' in after ? `practitioner ${shown('practitioner_id', before.practitioner_id, names)} to ${shown('practitioner_id', after.practitioner_id, names)}` : null,
    'authorisation_number' in after ? `authorisation ${asText(before.authorisation_number) || 'nothing'} to ${asText(after.authorisation_number) || 'nothing'}` : null,
    'patient_id' in after ? `claimed for "${asText(after.patient_name)}" instead of "${asText(before.patient_name)}"` : null
  ].filter((text): text is string => text !== null);
  return `Claim for line ${code} corrected and sent again in ${into} (resubmission R)${changes.length > 0 ? `: ${changes.join('; ')}` : ''}.${note}`;
}

/** One moment of one person's save: events within the same second by the same person belong together. */
const saveKey = (event: InvoiceAuditEvent): string => `${event.changed_by ?? ''}|${event.changed_at.slice(0, 19)}`;

/** The events as sentences, newest first; lines saved again unchanged are left out. */
export function describeAuditEvents(events: readonly InvoiceAuditEvent[], names: Readonly<Record<string, string>> = {}): AuditEntry[] {
  const entries: AuditEntry[] = [];
  const saves = new Map<string, InvoiceAuditEvent[]>();
  events.forEach(event => saves.set(saveKey(event), [...(saves.get(saveKey(event)) ?? []), event]));

  saves.forEach(group => {
    const added = group.filter(event => event.action === 'line_added');
    const removed = group.filter(event => event.action === 'line_removed');
    const used = new Set<InvoiceAuditEvent>();
    const entry = (event: InvoiceAuditEvent, text: string) => entries.push({ key: String(event.id), text, by: event.changed_by ?? null, at: event.changed_at });

    // A removed and an added line with the same code in one save: the same line saved again
    removed.forEach(before => {
      const after = added.find(candidate => !used.has(candidate) && asText(candidate.line_code) === asText(before.line_code));
      if (!after) return;
      used.add(after).add(before);
      const changes = lineChanges(before.line_before ?? {}, after.line_after ?? {}, names);
      if (changes.length > 0) entry(after, `Line ${asText(after.line_code)}: ${changes.join('; ')}.`);
    });

    group.forEach(event => {
      if (used.has(event)) return;
      const code = asText(event.line_code);
      if (event.action === 'claim_corrected' || event.action === 'claim_resent') {
        entry(event, claimEventText(event, names));
      } else if (event.action === 'invoice_changed') {
        const field = asText(event.field);
        entry(event, `${FIELD_LABELS[field] ?? field} changed from ${shown(field, event.old_value, names)} to ${shown(field, event.new_value, names)}.`);
      } else if (event.action === 'line_added') {
        entry(event, `Line ${code} added (${shown('total_price', event.line_after?.total_price, names)}).`);
      } else if (event.action === 'line_removed') {
        entry(event, `Line ${code} removed (${shown('total_price', event.line_before?.total_price, names)}).`);
      } else {
        const changes = lineChanges(event.line_before ?? {}, event.line_after ?? {}, names);
        if (changes.length > 0) entry(event, `Line ${code}: ${changes.join('; ')}.`);
      }
    });
  });
  return entries.sort((a, b) => b.at.localeCompare(a.at) || b.key.localeCompare(a.key));
}

/** "7 Oct 2026, 10:30" in Windhoek time. */
export function formatAuditTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Windhoek' }).format(date);
  const day = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Africa/Windhoek' }).format(date);
  return `${formatServiceDate(day)}, ${time}`;
}
