/**
 * The state of every tooth, worked out from two sources:
 * - the invoice lines that carry a tooth number (already stored for every dental invoice): an 8369 on tooth 36 means
 *   36 has a resin filling from that date; an 8201 means it was extracted;
 * - what was recorded on the chart (dental_chart_entries, proposals/2026-10-07-dental-chart.sql): work found at an
 *   examination ("existing", "defective"), planned work and its status.
 *
 * Planned work is done when its code was billed on its tooth on or after the day it was planned (or on the invoice its
 * quote became): the invoice is the proof, so nobody has to tick it off, and a cancelled invoice puts it back on the
 * plan. Work done without a matching line is marked done by hand.
 * Later work replaces earlier work it covers: a new filling replaces the filling on the same surfaces, a crown replaces
 * the fillings under it, an extraction leaves the tooth missing. Everything stays in the tooth's history.
 */
import { formatServiceDate, toDateKey } from '../billing/dates';
import type { QuoteStatus } from '../../components/quotes/quotes';
import { parseBilledTeeth } from './fdi';
import { formatSurfaces, surfaceList } from './surfaces';
import { WORK_LABELS, surfaceCountForCode, workForCode, type DentalWork } from './workTypes';

export type EntryStatus = 'existing' | 'defective' | 'planned' | 'done' | 'removed';

export const ENTRY_STATUS_LABELS: Readonly<Record<EntryStatus, string>> = {
  existing: 'Existing',
  defective: 'Defective',
  planned: 'To do',
  done: 'Done',
  removed: 'Taken off the plan'
};

/** A dental_chart_entries row as the screens use it (names instead of user ids). */
export interface ChartEntry {
  id: string;
  tooth: string;
  /** Filling surfaces in stored order ("MOD"); null for other work */
  surfaces: string | null;
  work: DentalWork;
  status: EntryStatus;
  /** Planned work: the code it is billed with */
  tariffCode: string | null;
  /** Planned work: which planned visit (1, 2, 3 ...) and the order within it */
  planVisit: number | null;
  planOrder: number | null;
  quoteId: string | null;
  visitId: string | null;
  invoiceId: string | null;
  note: string | null;
  recordedBy: string | null;
  /** ISO timestamp */
  recordedAt: string;
  statusChangedAt: string | null;
  /** Set when the entry was entered in error: it stays in the history, crossed out */
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
}

/** A dental_chart_changes row (the audit trail). */
export interface ChartChange {
  id: string;
  entryId: string;
  action: 'recorded' | 'status' | 'quote' | 'error';
  fromStatus: EntryStatus | null;
  toStatus: EntryStatus | null;
  quoteId: string | null;
  reason: string | null;
  changedBy: string | null;
  changedAt: string;
}

/** An invoice line with a tooth number. */
export interface BilledLine {
  /** invoice_services.id */
  key: string;
  invoiceId: string;
  invoiceNumber: string;
  visitId: string | null;
  /** The service date (yyyy-MM-dd): the line's own date, else its visit's, else the invoice's */
  date: string | null;
  code: string;
  description: string;
  teeth: string[];
  /** The invoice was cancelled: shown crossed out, never as work done */
  cancelled: boolean;
}

/** A quote a plan item was put on. */
export interface QuoteRef {
  id: string;
  quoteNumber: string;
  /** As shown: a draft or sent quote past its "valid until" date is expired */
  status: QuoteStatus;
  convertedInvoiceId: string | null;
}

// ---------------------------------------------------------------------------------------------------
// Invoice lines
// ---------------------------------------------------------------------------------------------------

export interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  visit_id: string | null;
  issue_date: string | null;
  created_at: string | null;
  payment_status: string | null;
}

export interface InvoiceLineRow {
  id: string;
  invoice_id: string;
  code: string | null;
  description: string | null;
  tooth_number: string | null;
  /** Once the invoicing update is applied: the line's own date (null = the visit's) */
  service_date?: string | null;
}

export interface VisitDateRow {
  id: string;
  visit_date: string | null;
}

/**
 * The patient's billed lines with teeth, oldest first. `unplaced` counts lines whose tooth number is not a tooth, so
 * the screen can say some billing could not be placed on the chart.
 */
export function toBilledLines(
  invoices: readonly InvoiceRow[],
  lines: readonly InvoiceLineRow[],
  visits: readonly VisitDateRow[]
): { lines: BilledLine[]; unplaced: number } {
  const invoiceById = new Map(invoices.map(invoice => [invoice.id, invoice]));
  const visitDate = new Map(visits.map(visit => [visit.id, visit.visit_date]));
  let unplaced = 0;
  const billed = lines.flatMap(line => {
    const invoice = invoiceById.get(line.invoice_id);
    if (!invoice) return [];
    const { teeth, invalid } = parseBilledTeeth(line.tooth_number);
    if (invalid.length > 0) unplaced += 1;
    if (teeth.length === 0) return [];
    const date =
      toDateKey(line.service_date ?? null) ??
      toDateKey((invoice.visit_id ? visitDate.get(invoice.visit_id) : null) ?? null) ??
      toDateKey(invoice.issue_date) ??
      toDateKey(invoice.created_at);
    return [
      {
        key: line.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number?.trim() || 'Invoice',
        visitId: invoice.visit_id,
        date,
        code: (line.code ?? '').trim().toUpperCase(),
        description: line.description?.trim() || '',
        teeth,
        cancelled: (invoice.payment_status ?? '').trim().toLowerCase() === 'cancelled'
      }
    ];
  });
  billed.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.key.localeCompare(b.key));
  return { lines: billed, unplaced };
}

// ---------------------------------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------------------------------

/** The local calendar day of a timestamp (the browser is on Windhoek time); a bare date is kept as it is. */
export const dayOf = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value.length === 10 ? toDateKey(value) : toDateKey(new Date(value));
};

/** Work on a tooth now. */
export interface ToothWork {
  key: string;
  /** Never 'extraction' (afterwards the tooth is 'missing') or 'other' */
  work: Exclude<DentalWork, 'extraction' | 'other'>;
  /** Known surfaces (charted fillings); null when only the billing is known */
  surfaces: string | null;
  /** How many surfaces the billed code is for, when the surfaces themselves are not known */
  surfaceCount: number | null;
  status: 'existing' | 'defective' | 'done';
  /** yyyy-MM-dd: when it was recorded, done or billed */
  date: string | null;
  source: 'chart' | 'billed';
  /** The chart entry (recorded work, or planned work that is done) */
  entryId: string | null;
  /** The invoice line that billed it */
  line: BilledLine | null;
  code: string | null;
}

/** A planned item: still to do, or done (by hand, or billed). */
export interface PlanItem {
  entry: ChartEntry;
  done: boolean;
  /** The invoice line that did the work */
  billedBy: BilledLine | null;
  doneDate: string | null;
  quote: QuoteRef | null;
}

export type ToothEventKind = 'billed' | 'recorded' | 'planned' | 'status' | 'quote' | 'error';

/** One line of a tooth's history. */
export interface ToothEvent {
  key: string;
  kind: ToothEventKind;
  /** yyyy-MM-dd */
  date: string | null;
  text: string;
  by: string | null;
  line: BilledLine | null;
  visitId: string | null;
  quote: QuoteRef | null;
  /** A cancelled invoice, or an entry entered in error */
  struck: boolean;
  /** Orders events of the same day: billing (no time) before what was charted that day */
  sortKey: string;
}

export interface ToothRecord {
  tooth: string;
  /** What is on the tooth now, oldest first (work that was replaced is left out) */
  now: ToothWork[];
  missing: boolean;
  /** Planned work on this tooth that is still to do, in plan order */
  plan: PlanItem[];
  /** Everything that happened to the tooth, newest first */
  events: ToothEvent[];
}

export interface ChartModel {
  teeth: ReadonlyMap<string, ToothRecord>;
  /** Every plan item (to do and done), oldest first */
  planItems: PlanItem[];
  /** Teeth with anything billed or charted */
  recordedTeeth: string[];
}

export interface ChartInput {
  billed: readonly BilledLine[];
  entries: readonly ChartEntry[];
  changes?: readonly ChartChange[];
  quotes?: readonly QuoteRef[];
}

const sameCode = (a: string | null, b: string | null): boolean =>
  (a ?? '').trim().toUpperCase() !== '' && (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase();

/**
 * Matches planned work to the invoice line that did it: the same code on the same tooth, billed on the invoice the
 * item's quote became or on or after the day it was planned, not cancelled. Each line (per tooth) completes one item.
 */
function completePlan(entries: readonly ChartEntry[], billed: readonly BilledLine[], quotes: ReadonlyMap<string, QuoteRef>): PlanItem[] {
  const used = new Set<string>();
  const planEntries = entries
    .filter(entry => (entry.status === 'planned' || entry.status === 'done') && entry.tariffCode)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
  return planEntries.map(entry => {
    const quote = entry.quoteId ? quotes.get(entry.quoteId) ?? null : null;
    const plannedDay = dayOf(entry.recordedAt);
    const fromQuote = (line: BilledLine) => quote?.convertedInvoiceId === line.invoiceId;
    const candidates = billed.filter(
      line =>
        !line.cancelled &&
        sameCode(line.code, entry.tariffCode) &&
        line.teeth.includes(entry.tooth) &&
        !used.has(`${line.key}|${entry.tooth}`) &&
        (fromQuote(line) || (line.date !== null && plannedDay !== null && line.date >= plannedDay))
    );
    candidates.sort((a, b) => Number(fromQuote(b)) - Number(fromQuote(a)) || (a.date ?? '').localeCompare(b.date ?? '') || a.key.localeCompare(b.key));
    const line = candidates[0] ?? null;
    if (line) {
      used.add(`${line.key}|${entry.tooth}`);
      return { entry, done: true, billedBy: line, doneDate: line.date, quote };
    }
    const done = entry.status === 'done';
    return { entry, done, billedBy: null, doneDate: done ? dayOf(entry.statusChangedAt ?? entry.recordedAt) : null, quote };
  });
}

const fillingsOverlap = (earlier: ToothWork, later: ToothWork): boolean => {
  // Without known surfaces the newer filling is the better information
  if (!earlier.surfaces || !later.surfaces) return true;
  const laterSurfaces = surfaceList(later.surfaces);
  return surfaceList(earlier.surfaces).some(surface => laterSurfaces.includes(surface));
};

/** Applies later work over earlier work (see the file comment); input oldest first. */
export function currentWork(history: readonly ToothWork[]): ToothWork[] {
  let now: ToothWork[] = [];
  for (const work of history) {
    if (work.work === 'missing') {
      // The natural tooth is gone: only an implant or a bridge stays in its place
      now = now.filter(item => item.work === 'implant' || item.work === 'bridge');
    } else if (work.work === 'filling' || work.work === 'crown' || work.work === 'root_canal') {
      // Work on the natural tooth means it is there after all
      now = now.filter(item => item.work !== 'missing');
      if (work.work === 'crown') now = now.filter(item => item.work !== 'crown' && item.work !== 'filling');
      if (work.work === 'root_canal') now = now.filter(item => item.work !== 'root_canal');
      if (work.work === 'filling') now = now.filter(item => item.work !== 'filling' || !fillingsOverlap(item, work));
    } else {
      now = now.filter(item => item.work !== work.work);
    }
    now.push(work);
  }
  return now;
}

const SOURCE_ORDER = { billed: 0, chart: 1 } as const;

const asToothWork = (work: DentalWork): ToothWork['work'] | null => {
  if (work === 'other') return null;
  return work === 'extraction' ? 'missing' : work;
};

/** "Filling M O D", "Filling (3 surfaces)", "Crown". */
export function describeWork(work: Pick<ToothWork, 'work' | 'surfaces' | 'surfaceCount'>): string {
  const label = WORK_LABELS[work.work];
  if (work.work !== 'filling') return label;
  if (work.surfaces) return `${label} ${formatSurfaces(work.surfaces)}`;
  if (work.surfaceCount) return `${label} (${work.surfaceCount === 4 ? '4 or more' : work.surfaceCount} surface${work.surfaceCount === 1 ? '' : 's'})`;
  return label;
}

/** "Filling M O D", "Extraction" for an entry. */
export const describeEntryWork = (entry: Pick<ChartEntry, 'work' | 'surfaces'>): string =>
  entry.work === 'filling' && entry.surfaces ? `${WORK_LABELS.filling} ${formatSurfaces(entry.surfaces)}` : WORK_LABELS[entry.work];

const STATUS_CHANGE_TEXT: Readonly<Record<EntryStatus, string>> = {
  existing: 'marked as not defective',
  defective: 'marked defective',
  planned: 'put back on the plan',
  done: 'marked done',
  removed: 'taken off the plan'
};

export function buildChart(input: ChartInput): ChartModel {
  const quotes = new Map((input.quotes ?? []).map(quote => [quote.id, quote]));
  const live = input.entries.filter(entry => !entry.voidedAt);
  const planItems = completePlan(live, input.billed, quotes);
  const completedLines = new Set(planItems.flatMap(item => (item.billedBy ? [`${item.billedBy.key}|${item.entry.tooth}`] : [])));

  const records = new Map<string, { history: ToothWork[]; plan: PlanItem[]; events: ToothEvent[] }>();
  const recordOf = (tooth: string) => {
    let record = records.get(tooth);
    if (!record) {
      record = { history: [], plan: [], events: [] };
      records.set(tooth, record);
    }
    return record;
  };

  // Billed work (lines that completed a plan item are shown through that item, with its surfaces)
  for (const line of input.billed) {
    for (const tooth of line.teeth) {
      const record = recordOf(tooth);
      record.events.push({
        key: `billed-${line.key}-${tooth}`,
        kind: 'billed',
        date: line.date,
        text: `${line.code}${line.description ? ` ${line.description}` : ''}${line.cancelled ? ' (invoice cancelled)' : ''}`,
        by: null,
        line,
        visitId: line.visitId,
        quote: null,
        struck: line.cancelled,
        sortKey: line.date ?? ''
      });
      const work = workForCode(line.code);
      const toothWork = work ? asToothWork(work) : null;
      if (line.cancelled || !toothWork || completedLines.has(`${line.key}|${tooth}`)) continue;
      record.history.push({
        key: `billed-${line.key}-${tooth}`,
        work: toothWork,
        surfaces: null,
        surfaceCount: surfaceCountForCode(line.code),
        status: 'done',
        date: line.date,
        source: 'billed',
        entryId: null,
        line,
        code: line.code
      });
    }
  }

  // What was charted: existing and defective work, and planned work that is done. The history says how an entry was
  // first recorded (the audit trail's first line); later status changes are lines of their own.
  const recordedAs = new Map((input.changes ?? []).flatMap(change => (change.action === 'recorded' && change.toStatus ? [[change.entryId, change.toStatus] as const] : [])));
  for (const entry of input.entries) {
    const record = recordOf(entry.tooth);
    const firstStatus = recordedAs.get(entry.id) ?? entry.status;
    const planned = firstStatus === 'planned' || entry.status === 'planned' || entry.status === 'done' || entry.status === 'removed';
    const what = describeEntryWork(entry);
    record.events.push({
      key: `entry-${entry.id}`,
      kind: planned ? 'planned' : 'recorded',
      date: dayOf(entry.recordedAt),
      text: planned
        ? `Planned${entry.tariffCode ? ` ${entry.tariffCode}` : ''}: ${what}`
        : `${what} recorded as ${firstStatus === 'defective' ? 'defective' : 'existing'}`,
      by: entry.recordedBy,
      line: null,
      visitId: entry.visitId,
      quote: entry.quoteId ? quotes.get(entry.quoteId) ?? null : null,
      struck: Boolean(entry.voidedAt),
      sortKey: entry.recordedAt
    });
    if (entry.voidedAt || (entry.status !== 'existing' && entry.status !== 'defective')) continue;
    const work = asToothWork(entry.work);
    if (!work) continue;
    record.history.push({
      key: `entry-${entry.id}`,
      work,
      surfaces: entry.surfaces,
      surfaceCount: null,
      status: entry.status,
      date: dayOf(entry.recordedAt),
      source: 'chart',
      entryId: entry.id,
      line: null,
      code: null
    });
  }

  for (const item of planItems) {
    const record = recordOf(item.entry.tooth);
    if (!item.done) {
      record.plan.push(item);
      continue;
    }
    const work = asToothWork(item.entry.work);
    if (!work) continue;
    record.history.push({
      key: `plan-${item.entry.id}`,
      work,
      surfaces: item.entry.surfaces,
      surfaceCount: surfaceCountForCode(item.entry.tariffCode ?? ''),
      status: 'done',
      date: item.doneDate,
      source: 'chart',
      entryId: item.entry.id,
      line: item.billedBy,
      code: item.entry.tariffCode
    });
  }

  // The audit trail: status changes, quotes and mistakes, on the tooth of their entry
  const entryById = new Map(input.entries.map(entry => [entry.id, entry]));
  for (const change of input.changes ?? []) {
    const entry = entryById.get(change.entryId);
    if (!entry || change.action === 'recorded') continue;
    const quote = change.quoteId ? quotes.get(change.quoteId) ?? null : null;
    const what = describeEntryWork(entry);
    const text =
      change.action === 'error'
        ? `${what}: entered in error${change.reason ? ` (${change.reason})` : ''}`
        : change.action === 'quote'
          ? `${what} put on quote${quote ? ` ${quote.quoteNumber}` : ''}`
          : `${what} ${change.toStatus ? STATUS_CHANGE_TEXT[change.toStatus] : 'changed'}`;
    recordOf(entry.tooth).events.push({
      key: `change-${change.id}`,
      kind: change.action,
      date: dayOf(change.changedAt),
      text,
      by: change.changedBy,
      line: null,
      visitId: null,
      quote,
      struck: false,
      sortKey: change.changedAt
    });
  }

  const teeth = new Map<string, ToothRecord>();
  for (const [tooth, record] of records) {
    const history = [...record.history].sort(
      (a, b) => (a.date ?? '').localeCompare(b.date ?? '') || SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] || a.key.localeCompare(b.key)
    );
    const now = currentWork(history);
    const plan = [...record.plan].sort(
      (a, b) =>
        (a.entry.planVisit ?? 0) - (b.entry.planVisit ?? 0) ||
        (a.entry.planOrder ?? 0) - (b.entry.planOrder ?? 0) ||
        a.entry.recordedAt.localeCompare(b.entry.recordedAt)
    );
    const events = [...record.events].sort((a, b) => b.sortKey.localeCompare(a.sortKey) || b.key.localeCompare(a.key));
    teeth.set(tooth, { tooth, now, missing: now.some(item => item.work === 'missing'), plan, events });
  }

  return { teeth, planItems, recordedTeeth: [...teeth.keys()].sort() };
}

/** What a screen reader hears for a tooth button: its number, name, what is on it and what is planned. */
export function toothSummary(record: ToothRecord | undefined): string {
  if (!record) return 'nothing recorded';
  const parts = record.now.map(work => `${describeWork(work)}${work.status === 'defective' ? ', defective' : ''}`);
  if (record.plan.length > 0) parts.push(`${record.plan.length} planned`);
  return parts.length > 0 ? parts.join('; ') : 'nothing recorded';
}

/** "7 Oct 2026" for a history line; '' when the date is unknown. */
export const eventDate = (event: Pick<ToothEvent, 'date'>): string => (event.date ? formatServiceDate(event.date) : '');
