/**
 * A simple report builder (parity R22; Eminance's report generator and saved queries): a practice picks invoices,
 * payments or visits of the period, the columns it wants, filters and a grouping, saves that as a report of its own and
 * downloads or prints it. Only the fields below can be chosen (a fixed list per source, each read from fixed database
 * columns), and every row comes from the signed-in person's own reads of the practice, so a saved report can never ask
 * for more than its author could already see; there is no free SQL. Figures follow Finance's own rules: an invoice's
 * total, portions and what it still owes as on the Invoicing tab, a payment's allocated, unallocated and refunded money
 * as on Payments, a visit's outcome as in Appointments and attendance. Money in whole cents.
 */
import {
  INVOICE_STATUSES,
  PAYER_LABELS,
  RECEIPT_METHOD_LABELS,
  invoiceDateKey,
  isPartPaid,
  monthKeyOf,
  owedPortions,
  payerLabel,
  splitCents,
  type ArInvoiceBalance,
  type ArReceipt,
  type LedgerInvoice
} from '../../../services/ledgerService';
import { STAGE_LABELS, VISIT_STAGES, type VisitStage } from '../../../utils/visitStage';
import type { CsvCell, ExportColumn } from '../financeExport';
import { formatMonthKey } from '../financeFormat';
import { INVOICE_STATUS_META } from '../financeTheme';
import { tidyWords } from './patientTowns';
import { staffName, type LinkedReport, type ReportTarget, type StaffNames } from './reportTargets';

export type BuilderSource = 'invoices' | 'payments' | 'visits';
export const BUILDER_SOURCES: readonly BuilderSource[] = ['invoices', 'payments', 'visits'];
export const BUILDER_SOURCE_LABELS: Readonly<Record<BuilderSource, string>> = { invoices: 'Invoices', payments: 'Payments', visits: 'Visits' };

type FieldKind = 'text' | 'date' | 'money' | 'choice';

export interface BuilderField {
  key: string;
  label: string;
  kind: FieldKind;
  /** Choices: a row can be grouped by it and filtered on it */
  groupable?: boolean;
}

const field = (key: string, label: string, kind: FieldKind, groupable = kind === 'choice'): BuilderField => ({ key, label, kind, groupable });

/** The only fields a report can show, filter or group on */
export const BUILDER_FIELDS: Readonly<Record<BuilderSource, readonly BuilderField[]>> = {
  invoices: [
    field('number', 'Invoice', 'text'),
    field('date', 'Invoice date', 'date', true),
    field('month', 'Month', 'choice'),
    field('patient', 'Patient', 'text'),
    field('practitioner', 'Practitioner', 'choice'),
    field('fund', 'Medical aid', 'choice'),
    field('status', 'Status', 'choice'),
    field('total', 'Total', 'money'),
    field('medical_aid', 'Medical aid portion', 'money'),
    field('patient_portion', 'Patient portion', 'money'),
    field('owed', 'Still owed', 'money')
  ],
  payments: [
    field('number', 'Payment', 'text'),
    field('date', 'Day received', 'date', true),
    field('month', 'Month', 'choice'),
    field('payer_type', 'Paid by', 'choice'),
    field('payer', 'Payer', 'text'),
    field('fund', 'Medical aid fund', 'choice'),
    field('method', 'Method', 'choice'),
    field('captured_by', 'Captured by', 'choice'),
    field('amount', 'Amount', 'money'),
    field('allocated', 'Allocated to invoices', 'money'),
    field('unallocated', 'Not allocated', 'money'),
    field('refunded', 'Refunded', 'money')
  ],
  visits: [
    field('date', 'Day', 'date', true),
    field('month', 'Month', 'choice'),
    field('time', 'Time', 'text'),
    field('patient', 'Patient', 'text'),
    field('practitioner', 'Practitioner', 'choice'),
    field('type', 'Visit type', 'choice'),
    field('outcome', 'Outcome', 'choice'),
    field('online', 'Booked online', 'choice')
  ]
};

/** What a new report on each source shows */
export const DEFAULT_COLUMNS: Readonly<Record<BuilderSource, readonly string[]>> = {
  invoices: ['number', 'date', 'patient', 'practitioner', 'fund', 'status', 'total', 'owed'],
  payments: ['number', 'date', 'payer', 'method', 'amount', 'unallocated'],
  visits: ['date', 'time', 'patient', 'practitioner', 'type', 'outcome']
};

/** The amount "at least N$" applies to; visits have none */
export const MAIN_AMOUNT: Readonly<Record<BuilderSource, string | null>> = { invoices: 'total', payments: 'amount', visits: null };

/** The text fields "Search" looks in */
const SEARCHED: Readonly<Record<BuilderSource, readonly string[]>> = { invoices: ['number', 'patient'], payments: ['number', 'payer'], visits: ['patient'] };

const COUNT_LABELS: Readonly<Record<BuilderSource, string>> = { invoices: 'Invoices', payments: 'Payments', visits: 'Visits' };

export const fieldOf = (source: BuilderSource, key: string): BuilderField | undefined => BUILDER_FIELDS[source].find(item => item.key === key);

// ---------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------

export type BuilderValue = string | number | null;

/** One record: a value per field (money in cents, days as yyyy-MM-dd, choices by their key) and what it opens */
export interface BuilderRow {
  id: string;
  values: Readonly<Record<string, BuilderValue>>;
  target: ReportTarget | null;
  /** What the row is called in its link ("Open invoice INV-1") */
  name: string;
}

export interface BuilderData {
  source: BuilderSource;
  rows: BuilderRow[];
  /** The words for a choice's key, per field (a practitioner's name for their id) */
  choiceLabels: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export const NO_PRACTITIONER = 'none';
export const PRIVATE = 'private';
export const PART_PAID = 'part_paid';

const nameOf = (id: string | null, names: Readonly<Record<string, string>>, missing: string): string => (id && names[id]) || missing;

const monthLabels = (rows: readonly BuilderRow[]): Record<string, string> =>
  Object.fromEntries([...new Set(rows.map(row => row.values.month).filter((key): key is string => typeof key === 'string'))].map(key => [key, formatMonthKey(key, 'MMMM yyyy')]));

const staffLabels = (ids: ReadonlyArray<BuilderValue>, staff: StaffNames, missing: string): Record<string, string> =>
  Object.fromEntries([...new Set(ids)].filter((id): id is string => typeof id === 'string').map(id => [id, id === NO_PRACTITIONER ? missing : staffName(id, staff, 'Practitioner not on the staff list')]));

/** Invoices: number, date, patient, practitioner, fund, status, total, portions and what is still owed */
export function invoiceRows(input: {
  invoices: readonly LedgerInvoice[];
  balances: Readonly<Record<string, ArInvoiceBalance>>;
  patientNames: Readonly<Record<string, string>>;
  fundByPatient: Readonly<Record<string, string>>;
  staff: StaffNames;
}): BuilderData {
  const rows = input.invoices.map(invoice => {
    const split = splitCents(invoice);
    const owed = owedPortions(invoice, input.balances[invoice.id]);
    const dateKey = invoiceDateKey(invoice);
    const fund = (invoice.patientId && input.fundByPatient[invoice.patientId]) || PRIVATE;
    return {
      id: invoice.id,
      values: {
        number: invoice.invoiceNumber,
        date: dateKey,
        month: dateKey ? monthKeyOf(dateKey) : null,
        patient: nameOf(invoice.patientId, input.patientNames, 'Patient not found'),
        practitioner: invoice.practitionerId ?? NO_PRACTITIONER,
        fund,
        status: isPartPaid(invoice) && invoice.status !== 'paid' ? PART_PAID : invoice.status,
        total: split.totalCents,
        medical_aid: invoice.status === 'cancelled' ? 0 : split.medicalAidCents,
        patient_portion: invoice.status === 'cancelled' ? 0 : split.patientCents,
        owed: owed.medical_aid + owed.patient
      },
      target: { kind: 'invoice' as const, id: invoice.id },
      name: invoice.invoiceNumber
    };
  });
  const funds = [...new Set(rows.map(row => row.values.fund))];
  return {
    source: 'invoices',
    rows,
    choiceLabels: {
      month: monthLabels(rows),
      practitioner: staffLabels(rows.map(row => row.values.practitioner), input.staff, 'No practitioner recorded'),
      fund: Object.fromEntries(funds.map(fund => [fund, fund === PRIVATE ? 'Private (no medical aid)' : fund])),
      status: { ...Object.fromEntries(INVOICE_STATUSES.map(status => [status, INVOICE_STATUS_META[status].label])), [PART_PAID]: 'Part paid' }
    }
  };
}

/** Payments (receipts that were not reversed): number, day, payer, fund, method, who captured it and its money */
export function paymentRows(input: { receipts: readonly ArReceipt[]; patientNames: Readonly<Record<string, string>>; staff: StaffNames }): BuilderData {
  const rows = input.receipts.filter(receipt => !receipt.reversal).map(receipt => ({
    id: receipt.id,
    values: {
      number: receipt.number,
      date: receipt.receivedOn,
      month: receipt.receivedOn ? monthKeyOf(receipt.receivedOn) : null,
      payer_type: receipt.payerType,
      payer: payerLabel(receipt, { ...input.patientNames }),
      fund: receipt.payerType === 'medical_aid' ? receipt.fundName ?? 'Medical aid' : PRIVATE,
      method: receipt.method,
      captured_by: receipt.createdBy ?? NO_PRACTITIONER,
      amount: receipt.amountCents,
      allocated: receipt.allocatedCents,
      unallocated: receipt.unallocatedCents,
      refunded: receipt.refundedCents
    },
    target: { kind: 'receipt' as const, id: receipt.id },
    name: receipt.number
  }));
  const funds = [...new Set(rows.map(row => row.values.fund))];
  return {
    source: 'payments',
    rows,
    choiceLabels: {
      month: monthLabels(rows),
      payer_type: { ...PAYER_LABELS },
      fund: Object.fromEntries(funds.map(fund => [fund, fund === PRIVATE ? 'Not a medical aid' : fund])),
      method: { ...RECEIPT_METHOD_LABELS },
      captured_by: staffLabels(rows.map(row => row.values.captured_by), input.staff, 'Not recorded')
    }
  };
}

/** A visit as the builder reads it (visits, with the stage worked out by Finance's rules) */
export interface BuilderVisit {
  id: string;
  patientId: string | null;
  doctorId: string | null;
  /** The appointment day: the scheduled date, else the visit date */
  dateKey: string | null;
  /** HH:mm */
  time: string | null;
  type: string | null;
  stage: VisitStage;
  bookedOnline: boolean;
}

/** Visits: day, time, patient, practitioner, type, outcome and whether it was booked online; each opens the patient */
export function visitRows(input: { visits: readonly BuilderVisit[]; patientNames: Readonly<Record<string, string>>; staff: StaffNames }): BuilderData {
  const rows = input.visits.map(visit => ({
    id: visit.id,
    values: {
      date: visit.dateKey,
      month: visit.dateKey ? monthKeyOf(visit.dateKey) : null,
      time: visit.time,
      patient: nameOf(visit.patientId, input.patientNames, 'Patient not found'),
      practitioner: visit.doctorId ?? NO_PRACTITIONER,
      type: visit.type?.trim() ? visit.type.trim().toLowerCase() : 'not_recorded',
      outcome: visit.stage,
      online: visit.bookedOnline ? 'yes' : 'no'
    },
    target: visit.patientId ? { kind: 'patient' as const, id: visit.patientId } : null,
    name: nameOf(visit.patientId, input.patientNames, 'Patient not found')
  }));
  const types = [...new Set(rows.map(row => row.values.type))];
  return {
    source: 'visits',
    rows,
    choiceLabels: {
      month: monthLabels(rows),
      practitioner: staffLabels(rows.map(row => row.values.practitioner), input.staff, 'No practitioner recorded'),
      type: Object.fromEntries(types.map(type => [type, type === 'not_recorded' ? 'Not recorded' : tidyWords(type.replace(/[_-]+/g, ' '))])),
      outcome: Object.fromEntries(VISIT_STAGES.map(stage => [stage, STAGE_LABELS[stage]])),
      online: { yes: 'Yes', no: 'No' }
    }
  };
}

/** The period's records of one source, as read (reportBuilderService.ts) */
export type BuilderInput =
  | { source: 'invoices'; invoices: LedgerInvoice[]; balances: Record<string, ArInvoiceBalance>; patientNames: Record<string, string>; fundByPatient: Record<string, string> }
  | { source: 'payments'; receipts: ArReceipt[]; patientNames: Record<string, string> }
  | { source: 'visits'; visits: BuilderVisit[]; patientNames: Record<string, string> };

/** The builder's rows for what was read, practitioners named from the staff list */
export function builderData(input: BuilderInput, staff: StaffNames): BuilderData {
  switch (input.source) {
    case 'invoices':
      return invoiceRows({ invoices: input.invoices, balances: input.balances, patientNames: input.patientNames, fundByPatient: input.fundByPatient, staff });
    case 'payments':
      return paymentRows({ receipts: input.receipts, patientNames: input.patientNames, staff });
    case 'visits':
      return visitRows({ visits: input.visits, patientNames: input.patientNames, staff });
  }
}

// ---------------------------------------------------------------------------------------------
// The query: columns, filters and a grouping (what a saved report keeps)
// ---------------------------------------------------------------------------------------------

export interface QueryDefinition {
  source: BuilderSource;
  /** Field keys in the order shown */
  columns: string[];
  /** A groupable field's key -> the value it must have */
  filters: Record<string, string>;
  /** Text the search fields must contain */
  search: string;
  /** The main amount must be at least this (cents); null: any */
  minAmountCents: number | null;
  /** A groupable field's key: one row per value with counts and totals; null: every record */
  groupBy: string | null;
}

export const LIMITS = { columns: 20, filters: 12, search: 100, filterValue: 200, minAmountCents: 100_000_000_000 } as const;

export const newDefinition = (source: BuilderSource): QueryDefinition => ({
  source, columns: [...DEFAULT_COLUMNS[source]], filters: {}, search: '', minAmountCents: null, groupBy: null
});

/**
 * A saved report's definition as it was stored, checked again: an unknown source makes it unreadable (null); fields
 * that are not in the list, too many columns and over-long text are dropped, so a stored definition can only ever ask
 * for the fields above.
 */
export function parseDefinition(value: unknown): QueryDefinition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const source = BUILDER_SOURCES.find(item => item === raw.source);
  if (!source) return null;
  const fields = BUILDER_FIELDS[source];
  const known = new Set(fields.map(item => item.key));
  const groupable = new Set(fields.filter(item => item.groupable).map(item => item.key));
  const columns = Array.isArray(raw.columns)
    ? [...new Set(raw.columns.filter((key): key is string => typeof key === 'string' && known.has(key)))].slice(0, LIMITS.columns)
    : [];
  const filters: Record<string, string> = {};
  if (raw.filters && typeof raw.filters === 'object' && !Array.isArray(raw.filters)) {
    for (const [key, filterValue] of Object.entries(raw.filters as Record<string, unknown>).slice(0, LIMITS.filters)) {
      if (groupable.has(key) && typeof filterValue === 'string' && filterValue.length > 0 && filterValue.length <= LIMITS.filterValue) filters[key] = filterValue;
    }
  }
  const min = raw.min_amount;
  return {
    source,
    columns: columns.length > 0 ? columns : [...DEFAULT_COLUMNS[source]],
    filters,
    search: typeof raw.search === 'string' ? raw.search.slice(0, LIMITS.search) : '',
    minAmountCents: MAIN_AMOUNT[source] && typeof min === 'number' && Number.isInteger(min) && min > 0 && min <= LIMITS.minAmountCents ? min : null,
    groupBy: typeof raw.group_by === 'string' && groupable.has(raw.group_by) ? raw.group_by : null
  };
}

/** The definition as it is saved (report_queries.definition; the database checks the same shape) */
export const definitionJson = (definition: QueryDefinition): Record<string, unknown> => ({
  v: 1,
  source: definition.source,
  columns: definition.columns,
  filters: definition.filters,
  search: definition.search.trim(),
  min_amount: definition.minAmountCents,
  group_by: definition.groupBy
});

// ---------------------------------------------------------------------------------------------
// Running it
// ---------------------------------------------------------------------------------------------

/**
 * The records that pass the filters, the search and the minimum amount. Cancelled invoices are left out unless the
 * status filter asks for them, so an invoice report adds up to what Finance calls billed.
 */
export function filterRows(data: BuilderData, definition: QueryDefinition): BuilderRow[] {
  const term = definition.search.trim().toLowerCase();
  const amountKey = MAIN_AMOUNT[data.source];
  const filters = Object.entries(definition.filters);
  const hideCancelled = data.source === 'invoices' && definition.filters.status !== 'cancelled';
  return data.rows.filter(row => {
    if (hideCancelled && row.values.status === 'cancelled') return false;
    for (const [key, value] of filters) if (String(row.values[key] ?? '') !== value) return false;
    if (term && !SEARCHED[data.source].some(key => String(row.values[key] ?? '').toLowerCase().includes(term))) return false;
    if (definition.minAmountCents !== null && amountKey && Number(row.values[amountKey] ?? 0) < definition.minAmountCents) return false;
    return true;
  });
}

/** The words for a value: a choice's label, else the value itself */
export const choiceLabel = (data: BuilderData, key: string, value: BuilderValue): string =>
  value === null || value === undefined ? 'Not recorded' : data.choiceLabels[key]?.[String(value)] ?? String(value);

/** The choices a filter offers: the values present in the period's records, by their words */
export function choicesOf(data: BuilderData, key: string): Array<{ value: string; label: string }> {
  const values = [...new Set(data.rows.map(row => row.values[key]).filter((value): value is string | number => value !== null && value !== undefined).map(String))];
  const chronological = key === 'month' || key === 'date';
  return values
    .map(value => ({ value, label: choiceLabel(data, key, value) }))
    .sort((a, b) => (chronological ? a.value.localeCompare(b.value) : a.label.localeCompare(b.label)));
}

const columnType = (item: BuilderField): ExportColumn['type'] => (item.kind === 'money' ? 'money' : item.kind === 'date' ? 'date' : 'text');

const cellOf = (data: BuilderData, item: BuilderField, value: BuilderValue): CsvCell => {
  if (item.kind === 'money') return typeof value === 'number' ? value / 100 : null;
  if (item.kind === 'choice') return choiceLabel(data, item.key, value);
  return value;
};

/** What each kind of report counts, in the words of the Finance report it matches */
const SOURCE_NOTES: Readonly<Record<BuilderSource, string>> = {
  invoices: 'Cancelled invoices are left out unless you choose the status Cancelled, so the totals are what Finance calls billed for these days.',
  payments: 'Payments received in the period; reversed payments are left out, as in every Finance report.',
  visits: 'Every visit on a day of the period, as in Appointments and attendance: cancelled and missed ones are included, with their outcome.'
};

export interface BuiltReport extends LinkedReport {
  /** Grouped: each row's group value (a row click filters the records to it) */
  groupKeys: string[] | null;
}

/**
 * The report: every record with the chosen columns (each opens its invoice, payment or patient), or, grouped, one row
 * per value of the grouping field with how many records and the totals of the chosen money columns (the main amount
 * when none is chosen). The totals row adds up every record that passed the filters.
 */
export function runQuery(data: BuilderData, definition: QueryDefinition, input: { title: string; basis: string }): BuiltReport {
  const fields = definition.columns.map(key => fieldOf(data.source, key)).filter((item): item is BuilderField => !!item);
  const rows = filterRows(data, definition);
  const notes = [
    'Built from the fields listed for this kind of record, read with your own access to the practice. Money columns add up every record that passed the filters.',
    SOURCE_NOTES[data.source]
  ];
  const group = definition.groupBy ? fieldOf(data.source, definition.groupBy) : undefined;
  if (!group) {
    return {
      table: {
        title: input.title,
        basis: input.basis,
        columns: fields.map(item => ({ header: item.label, type: columnType(item) })),
        rows: rows.map(row => fields.map(item => cellOf(data, item, row.values[item.key] ?? null))),
        totals: fields.map((item, index) => item.kind === 'money'
          ? rows.reduce((sum, row) => sum + Number(row.values[item.key] ?? 0), 0) / 100
          : index === 0 ? `Total (${rows.length})` : ''),
        notes
      },
      targets: rows.map(row => row.target),
      names: rows.map(row => row.name),
      groupKeys: null
    };
  }
  const chosenMoney = fields.filter(item => item.kind === 'money');
  const mainKey = MAIN_AMOUNT[data.source];
  const main = mainKey ? fieldOf(data.source, mainKey) : undefined;
  const money = chosenMoney.length > 0 ? chosenMoney : main ? [main] : [];
  const groups = new Map<string, { value: BuilderValue; count: number; sums: number[] }>();
  for (const row of rows) {
    const value = row.values[group.key] ?? null;
    const key = String(value ?? '');
    const entry = groups.get(key) ?? { value, count: 0, sums: money.map(() => 0) };
    entry.count += 1;
    money.forEach((item, index) => { entry.sums[index] += Number(row.values[item.key] ?? 0); });
    groups.set(key, entry);
  }
  const chronological = group.key === 'month' || group.key === 'date';
  const ordered = [...groups.entries()].sort(([keyA, a], [keyB, b]) => (chronological
    ? keyA.localeCompare(keyB)
    : (b.sums[0] ?? 0) - (a.sums[0] ?? 0) || b.count - a.count || choiceLabel(data, group.key, a.value).localeCompare(choiceLabel(data, group.key, b.value))));
  return {
    table: {
      title: input.title,
      basis: `${input.basis} · per ${group.label.toLowerCase()}`,
      columns: [
        { header: group.label, type: group.kind === 'date' ? 'date' : 'text' },
        { header: COUNT_LABELS[data.source], type: 'count' },
        ...money.map(item => ({ header: item.label, type: 'money' as const }))
      ],
      rows: ordered.map(([, entry]) => [
        group.kind === 'date' ? entry.value : choiceLabel(data, group.key, entry.value),
        entry.count,
        ...entry.sums.map(cents => cents / 100)
      ]),
      totals: ['Total', rows.length, ...money.map((_, index) => ordered.reduce((sum, [, entry]) => sum + entry.sums[index], 0) / 100)],
      notes
    },
    targets: ordered.map(() => null),
    groupKeys: ordered.map(([key]) => key)
  };
}
