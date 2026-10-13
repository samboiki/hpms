/**
 * The report builder (parity R22): a practice builds its own report from invoices, payments or visits, and a saved
 * report can only ever ask for the fields on the builder's fixed list (no SQL, nothing beyond what the person could
 * already read). Its figures follow Finance's own rules. Invented ids, names and amounts only.
 */
import { describe, expect, it } from 'vitest';
import { summarizeRevenue, type ArInvoiceBalance, type ArReceipt } from '../../../../services/ledgerService';
import { invoice } from '../../../../services/__tests__/ledgerTestUtils';
import {
  DEFAULT_COLUMNS,
  PART_PAID,
  definitionJson,
  filterRows,
  invoiceRows,
  newDefinition,
  parseDefinition,
  paymentRows,
  runQuery,
  visitRows,
  type BuilderVisit
} from '../reportBuilder';

const staff = { 'dr-a': 'Dr Anna Testing', 'u-rec': 'Rita Reception' };

const invoices = [
  invoice({ id: 'i1', invoiceNumber: 'INV-1', patientId: 'p1', practitionerId: 'dr-a', issueDate: '2026-10-02', total: 1000, medicalAidTotal: 800, patientTotal: 200 }),
  invoice({ id: 'i2', invoiceNumber: 'INV-2', patientId: 'p2', practitionerId: 'dr-a', issueDate: '2026-10-09', total: 250, status: 'paid', rawStatus: 'paid' }),
  invoice({ id: 'i3', invoiceNumber: 'INV-3', patientId: 'p2', practitionerId: null, issueDate: '2026-11-01', total: 400, rawStatus: 'partial' }),
  invoice({ id: 'i4', invoiceNumber: 'INV-4', patientId: 'p1', practitionerId: 'dr-a', issueDate: '2026-10-20', total: 90, status: 'cancelled', rawStatus: 'cancelled' })
];

// Receipts in use: INV-3 has had N$150 paid, so N$250 is still owed (the ledger says so, not the status)
const balance = (invoiceId: string, outstanding: { medical_aid: number; patient: number }): ArInvoiceBalance => ({
  invoiceId, patientId: null, invoiceNumber: invoiceId, issueDate: null, dueDate: null, paymentStatus: null,
  billed: { medical_aid: 0, patient: 40000 }, allocated: { medical_aid: 0, patient: 15000 }, credited: { medical_aid: 0, patient: 0 },
  writtenOff: { medical_aid: 0, patient: 0 }, journals: { medical_aid: 0, patient: 0 }, shortfallCents: 0, outstanding, hasActivity: true, hasEntries: true
});

const data = invoiceRows({
  invoices,
  balances: { i3: balance('i3', { medical_aid: 0, patient: 25000 }) },
  patientNames: { p1: 'Pat Testing', p2: 'Sam Testing' },
  fundByPatient: { p1: 'NMC1' },
  staff
});

describe('a saved report\'s definition', () => {
  it('keeps only the fields on the builder\'s list, so a stored report can never ask for anything else', () => {
    const parsed = parseDefinition({
      v: 1, source: 'invoices', columns: ['number', 'id_number', 'total', 'total', 'select * from patients'],
      filters: { status: 'pending', home_address: 'x', practitioner: 'dr-a' }, search: 'INV', min_amount: 5000, group_by: 'cell_number'
    });
    expect(parsed).toEqual({ source: 'invoices', columns: ['number', 'total'], filters: { status: 'pending', practitioner: 'dr-a' }, search: 'INV', minAmountCents: 5000, groupBy: null });
    expect(parseDefinition({ source: 'patients', columns: ['number'] })).toBeNull();
    expect(parseDefinition('select 1')).toBeNull();
    // No columns left: the source's own columns
    expect(parseDefinition({ source: 'visits', columns: ['diagnosis'] })?.columns).toEqual([...DEFAULT_COLUMNS.visits]);
    // Visits have no amount to filter on
    expect(parseDefinition({ source: 'visits', columns: ['date'], min_amount: 100 })?.minAmountCents).toBeNull();
  });

  it('is saved in the shape the database checks, and reads back the same', () => {
    const definition = { ...newDefinition('payments'), filters: { method: 'cash' }, groupBy: 'date', minAmountCents: 1000 };
    const json = definitionJson(definition);
    expect(Object.keys(json).sort()).toEqual(['columns', 'filters', 'group_by', 'min_amount', 'search', 'source', 'v']);
    expect(parseDefinition(json)).toEqual(definition);
  });
});

describe('the rows of a report', () => {
  it('shows an invoice\'s portions, status and what it still owes by Finance\'s rules (the ledger once receipts are in use)', () => {
    const byId = Object.fromEntries(data.rows.map(row => [row.id, row.values]));
    expect(byId.i1).toMatchObject({ total: 100000, medical_aid: 80000, patient_portion: 20000, owed: 100000, status: 'pending', fund: 'NMC1', practitioner: 'dr-a' });
    expect(byId.i2).toMatchObject({ owed: 0, status: 'paid', fund: 'private' });
    expect(byId.i3).toMatchObject({ owed: 25000, status: PART_PAID, practitioner: 'none' });
    // A cancelled invoice owes nothing and is listed with its status
    expect(byId.i4).toMatchObject({ owed: 0, status: 'cancelled', medical_aid: 0, patient_portion: 0 });
    expect(data.choiceLabels.practitioner).toEqual({ 'dr-a': 'Dr Anna Testing', none: 'No practitioner recorded' });
  });

  it('filters by a field, a search and the smallest amount, leaving cancelled invoices out unless they are asked for', () => {
    expect(filterRows(data, { ...newDefinition('invoices'), filters: { practitioner: 'dr-a' } }).map(row => row.id)).toEqual(['i1', 'i2']);
    expect(filterRows(data, { ...newDefinition('invoices'), filters: { status: 'cancelled' } }).map(row => row.id)).toEqual(['i4']);
    expect(filterRows(data, { ...newDefinition('invoices'), search: 'sam' }).map(row => row.id)).toEqual(['i2', 'i3']);
    expect(filterRows(data, { ...newDefinition('invoices'), minAmountCents: 30000 }).map(row => row.id)).toEqual(['i1', 'i3']);
  });

  it('adds up an invoice report of the period to Overview\'s billed for the same days', () => {
    const october = { startKey: '2026-10-01', endKey: '2026-10-31' };
    const inPeriod = invoices.filter(item => (item.issueDate ?? '') >= october.startKey && (item.issueDate ?? '') <= october.endKey);
    const periodData = invoiceRows({ invoices: inPeriod, balances: {}, patientNames: {}, fundByPatient: {}, staff });
    const report = runQuery(periodData, newDefinition('invoices'), { title: 'Invoices', basis: 'Oct 2026' });
    const totalColumn = report.table.columns.findIndex(column => column.header === 'Total');
    expect(report.table.totals?.[totalColumn]).toBe(summarizeRevenue(inPeriod, october).billed);
  });

  it('lists every record with the chosen columns, each opening its invoice, and adds up the money columns', () => {
    const report = runQuery(data, { ...newDefinition('invoices'), columns: ['number', 'status', 'total', 'owed'] }, { title: 'Invoices', basis: 'Oct 2026' });
    expect(report.table.columns.map(column => [column.header, column.type])).toEqual([['Invoice', 'text'], ['Status', 'text'], ['Total', 'money'], ['Still owed', 'money']]);
    expect(report.table.rows[2]).toEqual(['INV-3', 'Part paid', 400, 250]);
    expect(report.table.totals).toEqual(['Total (3)', '', 1650, 1250]);
    expect(report.targets[0]).toEqual({ kind: 'invoice', id: 'i1' });
    expect(report.groupKeys).toBeNull();
  });

  it('groups records with counts and totals (the main amount when no money column is chosen), months in order', () => {
    const grouped = runQuery(data, { ...newDefinition('invoices'), columns: ['number', 'patient'], groupBy: 'month' }, { title: 'Invoices', basis: 'All' });
    expect(grouped.table.columns.map(column => column.header)).toEqual(['Month', 'Invoices', 'Total']);
    expect(grouped.table.rows).toEqual([['October 2026', 2, 1250], ['November 2026', 1, 400]]);
    expect(grouped.table.totals).toEqual(['Total', 3, 1650]);
    expect(grouped.groupKeys).toEqual(['2026-10', '2026-11']);
    const byPractitioner = runQuery(data, { ...newDefinition('invoices'), columns: ['total', 'owed'], groupBy: 'practitioner' }, { title: 'Invoices', basis: 'All' });
    expect(byPractitioner.table.rows).toEqual([['Dr Anna Testing', 2, 1250, 1000], ['No practitioner recorded', 1, 400, 250]]);
  });

  it('reads payments that were not reversed, with who captured them, and visits with their outcome and whether they were booked online', () => {
    const receipt = (overrides: Partial<ArReceipt>): ArReceipt => ({
      id: 'r1', number: 'RC-1', payerType: 'medical_aid', patientId: null, fundName: 'NMC1', payerName: null, method: 'eft', amountCents: 50000,
      receivedOn: '2026-10-03', reference: null, source: 'manual', notes: null, createdBy: 'u-rec', createdAt: null, reversal: null,
      allocatedCents: 40000, refundedCents: 0, unallocatedCents: 10000, ...overrides
    });
    const payments = paymentRows({
      receipts: [receipt({}), receipt({ id: 'r2', number: 'RC-2', reversal: { at: '2026-10-04T08:00:00Z', by: 'u-rec', reason: 'Bounced' } })],
      patientNames: {},
      staff
    });
    expect(payments.rows.map(row => row.id)).toEqual(['r1']);
    expect(payments.rows[0].values).toMatchObject({ payer: 'NMC1', fund: 'NMC1', method: 'eft', captured_by: 'u-rec', unallocated: 10000 });
    expect(payments.choiceLabels.captured_by).toEqual({ 'u-rec': 'Rita Reception' });

    const visit: BuilderVisit = { id: 'v1', patientId: 'p1', doctorId: 'dr-a', dateKey: '2026-10-05', time: '09:30', type: 'follow_up', stage: 'no-show', bookedOnline: true };
    const visits = visitRows({ visits: [visit], patientNames: { p1: 'Pat Testing' }, staff });
    expect(visits.rows[0].values).toMatchObject({ outcome: 'no-show', online: 'yes', type: 'follow_up', patient: 'Pat Testing' });
    expect(visits.choiceLabels.type).toEqual({ follow_up: 'Follow Up' });
    expect(visits.rows[0].target).toEqual({ kind: 'patient', id: 'p1' });
    const report = runQuery(visits, newDefinition('visits'), { title: 'Visits', basis: 'Oct 2026' });
    expect(report.table.rows[0]).toEqual(['2026-10-05', '09:30', 'Pat Testing', 'Dr Anna Testing', 'Follow Up', 'No-show']);
  });
});
